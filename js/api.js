/*
  Race Club — js/api.js  (v0.2.5, GitHub Pages edition)

  WHAT CHANGED VS. THE GOOGLE SITES VERSION:
  The old single-file embed (Login.html) declared API_BASE_URL once at the
  top of its one giant <script> block, because everything lived in one
  file. Now that login/register/verify/profile are real separate .html
  pages on the same origin, API_BASE_URL and the fetch helper live here in
  one shared file that every page loads via <script src="js/api.js">, so
  there's still only ONE place to paste the deployment URL, and no
  behavior is duplicated per page.

  The request pattern itself (action query param, token in the query
  string, text/plain POST body to dodge Apps Script's lack of CORS
  preflight support) is copied verbatim from the source file — see
  fetchApi() below.
*/

// ---- CONFIGURE THIS ONE LINE ----
// Paste your deployed Apps Script Web App URL here (Deploy > Manage
// deployments > Web app > URL). Every page on this site reads it from
// here — you only need to change it in this one place.
var API_BASE_URL = 'https://script.google.com/macros/s/AKfycbz3jhxWDanYIywi8vn2YYQVwq2MO68tZA4RJpj5fXmUa5ckLo0QpT_lrAwqpsHPnQUV/exec';
// ----------------------------------

// True when API_BASE_URL is still the placeholder above. Pages should
// check this and show a clear setup message instead of silently failing
// (same degrade-gracefully behavior as the source file).
function apiBaseUrlIsUnset() {
  return !API_BASE_URL || API_BASE_URL.indexOf('PASTE_YOUR') !== -1;
}

// ---- PUBLISHED-CSV CONFIG (2026-09-26, Matt's ask: run League Hub and Meet
// The Grid off a published Google Sheets CSV instead of Apps Script) ----
// Leave either of these blank until you've done the one-time manual step in
// Google Sheets: open the sheet, File > Share > Publish to web, pick the
// tab named ("PublishedLeagueHub" or "PublishedGridTeaser"), format
// "Comma-separated values (.csv)", check "Automatically republish when
// changes are made," then Publish -- paste the URL it gives you here. Both
// tabs are created automatically the next time their normal Apps Script
// cache gets refreshed (an import, a season action, a Cars catalog change,
// etc.) -- see _rcPublishJsonToSheet_ in Website.gs -- so there's nothing to
// create by hand, only to publish.
//
// Leaving either blank is completely safe: fetchPublishedJson() below
// rejects immediately with RC_NO_CSV_URL, and every caller (league.js,
// index.html) catches that and falls straight through to the existing
// fetchApi() call, exactly as if this feature didn't exist yet.
var RC_LEAGUE_HUB_CSV_URL = '';
var RC_GRID_TEASER_CSV_URL = '';

// fetchPublishedJson(csvUrl) -> Promise<Object>
//
// Fetches a Google Sheets "Publish to the web" CSV URL directly -- a plain
// static file served by Google's own servers, no Apps Script execution at
// all -- and reassembles it back into the JSON object it was published
// from. See _rcPublishJsonToSheet_'s long comment in Website.gs for the
// write side of this: the payload is JSON.stringify()'d, chunked into
// <=45,000-character pieces (Sheets' single-cell limit is 50,000), and
// written one chunk per row in column A of a dedicated tab with no header
// row.
//
// Google's CSV export wraps any cell containing a comma, quote, or newline
// in double quotes and doubles internal quotes (standard CSV escaping).
// Since JSON.stringify() never emits a literal newline character inside a
// string (only the escaped two-character sequence \n), every chunk is
// guaranteed to come back as exactly one line in the exported CSV -- so
// reassembly is just: split on newlines, strip a wrapping pair of quotes
// and un-double any doubled quotes on each line, concatenate, then
// JSON.parse the result.
//
// Rejects (never resolves with a broken payload) on:
//   RC_NO_CSV_URL          -- csvUrl is blank/unset (feature not turned on
//                             yet, or Matt hasn't pasted the URL in above)
//   RC_CSV_FETCH_FAILED_<status> -- the fetch itself failed or came back
//                             non-OK (e.g. the tab was unpublished)
//   RC_CSV_EMPTY            -- fetch succeeded but the body was blank
//                             (tab exists but was never actually written,
//                             or was cleared)
//   (a JSON.parse SyntaxError) -- reassembled text wasn't valid JSON
// Every caller is expected to .catch() any of these and fall back to the
// normal fetchApi() call -- this is a pure performance optimization, never
// the only path to the data.
function fetchPublishedJson(csvUrl) {
  if (!csvUrl) return Promise.reject(new Error('RC_NO_CSV_URL'));

  return fetch(csvUrl, { cache: 'no-store' }).then(function (res) {
    if (!res.ok) throw new Error('RC_CSV_FETCH_FAILED_' + res.status);
    return res.text();
  }).then(function (text) {
    if (!text) throw new Error('RC_CSV_EMPTY');

    var lines = text.split(/\r\n|\r|\n/).filter(function (line) {
      return line.length > 0;
    });
    if (!lines.length) throw new Error('RC_CSV_EMPTY');

    var jsonStr = lines.map(function (line) {
      var unquoted = line;
      if (unquoted.charAt(0) === '"' && unquoted.charAt(unquoted.length - 1) === '"') {
        unquoted = unquoted.substring(1, unquoted.length - 1);
      }
      return unquoted.replace(/""/g, '"');
    }).join('');

    return JSON.parse(jsonStr);
  });
}

// How long a single attempt is allowed to hang before it's treated as
// failed (2026-09-14, Matt's report: "the dashboard sometimes never loads
// anything"). Apps Script Web Apps queue same-user requests rather than
// truly running them in parallel (see the long comment on
// fetchDashboardData in Account.html), so a request can sit waiting on the
// server's own queue far longer than a normal page load should ever
// tolerate. Previously fetchApi had NO timeout at all -- a slow/stuck
// request just left whatever was waiting on it (most visibly, the
// Dashboard's "Loading your dashboard..." spinner) spinning forever, with
// nothing ever resolving or rejecting to say otherwise. 20s is generous
// (Apps Script cold starts genuinely can take several seconds) while still
// being far short of "the driver gives up and reloads."
var RC_FETCH_TIMEOUT_MS = 20000;

// Longer budget for the handful of POST actions that are genuinely heavy,
// multi-row writes rather than a normal single-row save -- createSeason/
// updateSeason especially, which fan a single admin submit out into many
// Rounds/Races/bye-week/special-event rows server-side (2026-09-19, Matt's
// report: "unable to save to server, your season is saved" right after a
// Create Season that actually went through). The default 20s budget above
// was sized for dashboard-style reads, not this -- a full season with a
// long calendar can genuinely take longer than that to finish writing, so
// the client was aborting and reporting failure on writes that were still
// quietly completing on the server. Passed as options.timeoutMs on the
// specific fetchApi calls that need it; every other caller keeps the
// default above.
var RC_FETCH_TIMEOUT_MS_LONG = 45000;

// Import XML's own budget, longer still (2026-09-24, Matt's ask) -- a race
// results file is the single heaviest write on the site (thousands of Lap
// rows, plus the race report build on top of that), so it gets its own
// timeout rather than sharing RC_FETCH_TIMEOUT_MS_LONG above with the
// merely-heavy writes (createSeason/updateSeason, adminCreateNews/
// adminUpdateNews). Only openImportXmlModal's own _rcFetchOnce_ call
// (Account.html) uses this -- bumping it doesn't touch how long any other
// action waits before giving up.
var RC_FETCH_TIMEOUT_MS_IMPORT = 120000;

// Recompute Season's own budget (2026-09-26, Matt's report: "Recompute
// Season says it cannot reach the server when I click on it and wait" --
// this call had NO timeoutMs override at all, so it inherited the 20s
// default meant for small dashboard reads. handleAdminRecomputeSeason
// (Seasons.gs) re-runs SeasonHistory/StandingsCache for every completed
// round in the season in sequence -- real per-round Sheets I/O, the same
// order of magnitude as a single round import above -- so any season past
// a couple of rounds was blowing straight through 20s: the client aborted
// and reported failure while the script kept quietly finishing server-
// side. 2 minutes, matching Matt's own ask for how long the "Recomputing
// Season Standings..." popup (see openSeasonManagementSection's
// recomputeBtn, Account.html) should be allowed to sit up.
var RC_FETCH_TIMEOUT_MS_RECOMPUTE = 120000;

// Automatic retries after a short, then longer, pause (2026-09-14, same
// report: "no season is currently open" shown when one genuinely was, plus
// a follow-up report that a single retry still wasn't enough headroom
// under real load). A transient failure -- a timeout, a dropped
// connection, or Apps Script returning a non-JSON error page under load --
// used to be indistinguishable from a real "no" answer by the time it
// reached calling code, since every caller across the site treats a
// rejected fetchApi promise as "there's nothing here" (see e.g.
// registrationStatusCard's renderUnregistered in Account.html). Two
// retries, backing off (700ms, then 2500ms) rather than hammering
// immediately, gives Apps Script's own same-user request queue real time
// to drain between attempts instead of just adding a 3rd request to the
// same pileup that likely caused the failure in the first place.
var RC_FETCH_RETRY_DELAYS_MS = [700, 2500];

// GET-only (see fetchApi below for why) -- every GET action in this
// codebase is a pure read, so retrying one is always safe: worst case, it
// re-reads data that hasn't changed. A POST is never blindly retried here.

// Retry-storm risk (2026-09-23, Matt's report: doGet executions kept
// piling up in the Apps Script log continuously while just sitting on the
// Dashboard, not clicking anything). Because "Execute as: Me" serializes
// EVERY visitor's request through one shared queue, a 20s client-side
// timeout can fire simply because a request sat in that queue behind
// other traffic, not because anything is actually stuck -- the abandoned
// attempt keeps running server-side (see the "Execute as: Me" comments
// elsewhere in this codebase) while the retry above adds a second request
// to the very queue that caused the delay. For a one-off user action
// that's still the right trade (see the 2026-09-14 report above). For a
// SILENT, UNPROMPTED BACKGROUND POLL it's pure downside: a missed tick is
// invisible to the driver (the next poll picks up whatever changed) but
// every retried tick compounds the exact congestion that made it slow in
// the first place. options.noRetry (see fetchApi's own doc comment below)
// opts a caller out of this whole retry path -- the header's old 45s
// notification-bell poll used to be the one caller of this; the bell
// itself is gone (2026-09-24, Matt's call: eliminate the in-app
// notification system entirely, moving to an external Discord bot), but
// noRetry is left in place as general infrastructure for any future
// silent background poll.

function _rcFetchOnce_(url, fetchOpts, timeoutMs) {
  // AbortController -- not supported on truly ancient browsers, but every
  // browser this site otherwise targets has it; fetchApi already assumes a
  // modern `fetch()` exists at all, so this adds no new floor.
  var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var timedOut = false;
  var timer = null;
  if (controller) {
    fetchOpts = Object.assign({}, fetchOpts, { signal: controller.signal });
    timer = setTimeout(function () {
      timedOut = true;
      controller.abort();
    }, timeoutMs || RC_FETCH_TIMEOUT_MS);
  }
  return fetch(url, fetchOpts)
    .then(function (res) {
      if (timer) clearTimeout(timer);
      // Apps Script occasionally answers a struggling request with an HTML
      // error page instead of JSON (not a network failure -- the request
      // "succeeded" as far as fetch() is concerned). res.json() throws on
      // that, which is exactly what should count as a failed attempt here
      // rather than an unhandled parse error further down the chain.
      return res.json();
    })
    .catch(function (err) {
      if (timer) clearTimeout(timer);
      if (timedOut) throw new Error('RC_FETCH_TIMEOUT');
      throw err;
    });
}

/**
 * fetchApi(action, options) -> Promise<Object>
 *
 * Wraps the fetch/text-plain/JSON pattern used throughout the source file.
 *   action:  string, e.g. 'login', 'getProfile', 'adminApproveAccount'
 *   options.method: 'GET' or 'POST' (default 'GET')
 *   options.token:  session token, appended to the URL query string
 *                   (never sent in the POST body — required by the API
 *                   contract).
 *   options.body:   plain object, JSON-stringified into the POST body.
 *   options.params: plain object of extra GET query-string params (e.g.
 *                   { seasonId: '...', carClass: 'LMGT3' } for
 *                   getAvailableTeams, v0.20). Only ever appended to the
 *                   URL, never sent for POST -- Apps Script GET handlers
 *                   read these off e.parameter, same as action/token.
 *                   Blank/null/undefined values are skipped rather than
 *                   sent as the literal string "undefined".
 *   options.timeoutMs: overrides RC_FETCH_TIMEOUT_MS for just this call --
 *                   pass RC_FETCH_TIMEOUT_MS_LONG for a heavy multi-row
 *                   write (createSeason/updateSeason). Leave unset for the
 *                   normal 20s budget.
 *   options.noRetry: GET only -- skips the automatic retry-on-timeout below
 *                   entirely (single attempt, same as a POST). For a
 *                   silent background poll a missed tick costs nothing --
 *                   another one fires on the next tick anyway -- so
 *                   retrying under load only adds a second competing
 *                   request to an already-congested queue instead of
 *                   helping (2026-09-23, see the retry-storm comment above
 *                   RC_FETCH_RETRY_DELAYS_MS). No caller passes this today
 *                   (the header's old 45s notification-bell poll was the
 *                   one caller, removed 2026-09-24 along with the whole
 *                   in-app notification system) -- left in place for the
 *                   next silent background poll that needs it.
 *

 * IMPORTANT: POST requests use Content-Type: text/plain;charset=utf-8, NOT
 * application/json. Apps Script Web Apps can't handle a CORS preflight
 * (OPTIONS) request, which application/json would trigger. text/plain
 * avoids the preflight; the server still parses the body as JSON
 * regardless of the declared content type. Do not change this.
 *
 * Times out after RC_FETCH_TIMEOUT_MS. GET requests then retry up to
 * twice, backing off per RC_FETCH_RETRY_DELAYS_MS, before finally
 * rejecting (2026-09-14) -- see the comments on those constants above.
 * Every existing caller already either chains .then/.catch or just awaits
 * the promise, so this is invisible to them except that a single bad round
 * trip no longer has to become a dead spinner or a wrong "nothing here"
 * render.
 *
 * POST requests are deliberately NEVER auto-retried here, timeout or not.
 * A POST is a write (joinTeam, proposeWager, chooseSponsors, an admin
 * save...) and a timeout does not mean the write failed -- Apps Script may
 * well keep running and complete it after the client gives up waiting (see
 * doJoinTeamDirect's own long comment in Account.html, which exists
 * because of exactly this ambiguity). Blindly retrying a timed-out POST
 * risks silently DOUBLE-submitting a write the first attempt actually
 * completed -- a second team purchase, a duplicate wager, a repeated
 * sponsor pick -- which would be a worse bug than the timeout itself. A
 * POST's own call site is the right place to decide how to recover from an
 * ambiguous outcome (reload and check real server state, same pattern
 * doJoinTeamDirect already uses), not this shared helper.
 */
function fetchApi(action, options) {
  options = options || {};
  var method = options.method || 'GET';
  var url = API_BASE_URL + '?action=' + encodeURIComponent(action);
  if (options.token) url += '&token=' + encodeURIComponent(options.token);
  if (options.params) {
    Object.keys(options.params).forEach(function (key) {
      var val = options.params[key];
      if (val === undefined || val === null || val === '') return;
      url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(val);
    });
  }

  var fetchOpts = { method: method };
  if (method === 'POST') {
    fetchOpts.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
    fetchOpts.body = JSON.stringify(options.body || {});
  }

  if (method === 'POST') return _rcFetchOnce_(url, fetchOpts, options.timeoutMs);
  if (options.noRetry) return _rcFetchOnce_(url, fetchOpts, options.timeoutMs);

  var attempt = function (retriesLeft) {
    return _rcFetchOnce_(url, fetchOpts, options.timeoutMs).catch(function (err) {
      if (!retriesLeft.length) throw err;
      var delay = retriesLeft[0];
      var rest = retriesLeft.slice(1);
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          attempt(rest).then(resolve, reject);
        }, delay);
      });
    });
  };
  return attempt(RC_FETCH_RETRY_DELAYS_MS);
}
