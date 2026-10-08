// Race Club — js/api.js (v0.2.5, GitHub Pages edition)
// WHAT CHANGED VS. THE GOOGLE SITES VERSION: The old single-file embed (Login.html) declared
// API_BASE_URL once at the top of its one giant <script> block, because everything lived in one
// file.

// ---- CONFIGURE THIS ONE LINE ---- Paste your deployed Apps Script Web App URL here (Deploy >
// Manage deployments > Web app > URL). Every page on this site reads it from here — you only need
// to change it in this one place.
var API_BASE_URL = 'https://script.google.com/macros/s/AKfycbz3jhxWDanYIywi8vn2YYQVwq2MO68tZA4RJpj5fXmUa5ckLo0QpT_lrAwqpsHPnQUV/exec';
// ----------------------------------

// True when API_BASE_URL is still the placeholder above. Pages should check this and show a clear
// setup message instead of silently failing (same degrade-gracefully behavior as the source file).
function apiBaseUrlIsUnset() {
  return !API_BASE_URL || API_BASE_URL.indexOf('PASTE_YOUR') !== -1;
}

// ---- PUBLISHED-CSV CONFIG ---- Leave either of these blank until you've done the one-time manual
// step in Google Sheets: open the sheet, File > Share > Publish to web, pick the tab named
// ("PublishedLeagueHub" or "PublishedGridTeaser"), format "Comma-separated values (.csv)", check
// "Automatically republish when changes are made," then Publish -- paste the URL it gives you here.
var RC_LEAGUE_HUB_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRnHINZoKMD2_tz8zjp3sf8qnpgi4MeZu0SaC_Gfz3YLsu2xtEdBZjcrCDYZlh9Yd7MW0p4smgybDob/pub?gid=37344457&single=true&output=csv';
// Driver directory (profile.html + the league page's background prefetch). Leave blank until the
// 'PublishedDriverDirectory' tab has been published to the web the same way; while blank, the
// directory is fetched through the Apps Script API instead (slower, but identical data).
var RC_DRIVER_DIRECTORY_CSV_URL = '';
var RC_GRID_TEASER_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRnHINZoKMD2_tz8zjp3sf8qnpgi4MeZu0SaC_Gfz3YLsu2xtEdBZjcrCDYZlh9Yd7MW0p4smgybDob/pub?gid=1748486478&single=true&output=csv';

// fetchPublishedJson(csvUrl) -> Promise<Object>
// Fetches a Google Sheets "Publish to the web" CSV URL directly -- a plain static file served by
// Google's own servers, no Apps Script execution at all -- and reassembles it back into the JSON
// object it was published from.
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

// Name/username character rules -- mirrors _rcValidateIdentityFields_ in Auth.gs (the server is the
// real gate; this just gives instant feedback). Names: Latin letters (accents OK), numbers, spaces,
// hyphens, apostrophes, periods. Usernames: letters, numbers, underscores, hyphens, periods.
// `original` is the saved account (or null for a new one); a field is only checked when it is new
// or changed, so older accounts can still save other edits. Returns '' when fine, else the message.
function rcIdentityProblem(fields, original) {
  original = original || null;
  function changed(key, stored) {
    return !original || String(fields[key] || '').trim() !== String(stored || '').trim();
  }
  function nameProblem(label, value) {
    var v = String(value || '').trim();
    if (!v) return label + ' is required.';
    if (v.length > 40) return label + ' must be 40 characters or fewer.';
    if (!/^[\p{Script=Latin}\p{M}0-9][\p{Script=Latin}\p{M}0-9 .'\u2019-]*$/u.test(v)) {
      return label + ' can only use Latin letters (accents are fine), numbers, spaces, hyphens, apostrophes and periods.';
    }
    return '';
  }
  var msg = '';
  if (fields.username !== undefined && changed('username', original && original.username)) {
    var u = String(fields.username || '').trim();
    if (!u) msg = 'Username is required.';
    else if (u.length > 30) msg = 'Username must be 30 characters or fewer.';
    else if (!/^[A-Za-z0-9_.-]+$/.test(u)) msg = 'Username can only use letters, numbers, underscores, hyphens and periods (no spaces).';
    if (msg) return msg;
  }
  if (fields.firstName !== undefined && changed('firstName', original && original.firstName)) {
    msg = nameProblem('First name', fields.firstName); if (msg) return msg;
  }
  if (fields.lastName !== undefined && changed('lastName', original && original.lastName)) {
    msg = nameProblem('Last name', fields.lastName); if (msg) return msg;
  }
  return '';
}

// ---- DRIVER DIRECTORY (public list behind profile.html) ----
// Saved in this browser (localStorage) so a profile can draw instantly from the last copy while a
// fresh one is fetched quietly in the background (stale-while-revalidate). Every storage call is
// wrapped: private windows / blocked storage just mean "no saved copy".
var RC_DRIVER_DIRECTORY_STORAGE_KEY_ = 'rc_driver_directory_v1';

function rcReadSavedDriverDirectory() {
  try {
    var raw = localStorage.getItem(RC_DRIVER_DIRECTORY_STORAGE_KEY_);
    if (!raw) return null;
    var dir = JSON.parse(raw);
    return (dir && Array.isArray(dir.drivers)) ? dir : null;
  } catch (err) { return null; }
}

// Fetches the current directory (published CSV first, Apps Script as the fallback), saves it, and
// resolves with it. Rejects if both routes fail.
function rcFetchDriverDirectory() {
  return fetchPublishedJson(RC_DRIVER_DIRECTORY_CSV_URL).catch(function () {
    return fetchApi('getDriverDirectory', { timeoutMs: RC_FETCH_TIMEOUT_MS_LONG });
  }).then(function (dir) {
    if (!dir || !dir.success || !Array.isArray(dir.drivers)) throw new Error('RC_DIRECTORY_BAD');
    try {
      localStorage.setItem(RC_DRIVER_DIRECTORY_STORAGE_KEY_, JSON.stringify(dir));
      localStorage.setItem(RC_DRIVER_DIRECTORY_STORAGE_KEY_ + '_t', String(Date.now()));
    } catch (err) { /* storage unavailable */ }
    return dir;
  });
}

// True when there is no saved directory, or it was saved more than maxAgeMs ago.
function rcDriverDirectoryIsStale(maxAgeMs) {
  try {
    var t = Number(localStorage.getItem(RC_DRIVER_DIRECTORY_STORAGE_KEY_ + '_t')) || 0;
    return !rcReadSavedDriverDirectory() || (Date.now() - t) > maxAgeMs;
  } catch (err) { return true; }
}

// How long a single attempt is allowed to hang before it's treated as failed.
var RC_FETCH_TIMEOUT_MS = 20000;

// Longer budget for the handful of POST actions that are genuinely heavy, multi-row writes rather
// than a normal single-row save -- createSeason/ updateSeason especially, which fan a single admin
// submit out into many Rounds/Races/bye-week/special-event rows server-side.
var RC_FETCH_TIMEOUT_MS_LONG = 45000;

// Import XML's own budget, longer still -- a race results file is the single heaviest write on the
// site (thousands of Lap rows, plus the race report build on top of that), so it gets its own
// timeout rather than sharing RC_FETCH_TIMEOUT_MS_LONG above with the merely-heavy writes
// (createSeason/updateSeason, adminCreateNews/ adminUpdateNews).
var RC_FETCH_TIMEOUT_MS_IMPORT = 120000;

var RC_FETCH_TIMEOUT_MS_RECOMPUTE = 120000;

// Finalize Results' own budget, 2 minutes -- adminFinalizeRound rebuilds the League Hub payload and the
// public round cache after its write, so it can run well past the 20s default.
var RC_FETCH_TIMEOUT_MS_FINALIZE = 120000;

// Protest submission's own budget, 1 minute -- submitProtest had no timeoutMs override at all
// before this, so it inherited the 20s default meant for small dashboard reads even though filing a
// protest can take longer under load.
var RC_FETCH_TIMEOUT_MS_PROTEST = 60000;

// Edit Profile's SAVE CHANGES budget, 1 minute -- updateOwnProfile and changeOwnPassword both had
// no timeoutMs override at all before this, so they inherited the 20s default meant for small
// dashboard reads.
var RC_FETCH_TIMEOUT_MS_PROFILE = 60000;

// Login's own budget, 1 minute -- the login POST had no timeoutMs override at all before this, so
// it inherited the 20s default meant for small dashboard reads, even though a cold Apps Script
// start plus the login handler's own Sheets lookup can genuinely take longer than that under load.
var RC_FETCH_TIMEOUT_MS_LOGIN = 60000;

// Apply Ruling's own budget, 2 minutes -- adminRuleOnProtest had no timeoutMs override at all
// before this, so a batch of rulings (openRoundReviewModal's APPLY RULING button, Account.html,
// fires one adminRuleOnProtest call per selected protest via Promise.all) inherited the 20s default
// meant for small dashboard reads.
var RC_FETCH_TIMEOUT_MS_RULINGS = 120000;

// Integrity Check's own budget, 5 minutes -- adminIntegrityCheck (Seasons.gs) runs a full unsplit
// pass over the active season: every cache refresh, every completed round's
// StandingsCache/public-round-cache rebuild, and a full Registrations/Teams/Cars/StandingsCache
// referential scan, all in one request.
var RC_FETCH_TIMEOUT_MS_INTEGRITY = 300000;

// Automatic retries after a short, then longer, pause.
var RC_FETCH_RETRY_DELAYS_MS = [700, 2500];

// GET-only (see fetchApi below for why) -- every GET action in this codebase is a pure read, so
// retrying one is always safe: worst case, it re-reads data that hasn't changed. A POST is never
// blindly retried here.

function _rcFetchOnce_(url, fetchOpts, timeoutMs) {
  // AbortController -- not supported on truly ancient browsers, but every browser this site
  // otherwise targets has it; fetchApi already assumes a modern `fetch()` exists at all, so this
  // adds no new floor.
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
      // Apps Script occasionally answers a struggling request with an HTML error page instead of
      // JSON (not a network failure -- the request "succeeded" as far as fetch() is concerned).
      // res.json() throws on that, which is exactly what should count as a failed attempt here
      // rather than an unhandled parse error further down the chain.
      return res.json();
    })
    .catch(function (err) {
      if (timer) clearTimeout(timer);
      if (timedOut) throw new Error('RC_FETCH_TIMEOUT');
      throw err;
    });
}

// fetchApi(action, options) -> Promise<Object>
// Wraps the fetch/text-plain/JSON pattern used throughout the source file. action: string, e.g.
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
