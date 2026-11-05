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

// ---- STAGED LEAGUE HUB (Admin-only preview) ----
// When the Admin switch (Account > Admin > Data Management > Staged League Hub) is ON in THIS browser, the
// League Hub, every Race Recap, driver profile pages and driver reports read made-up data from
// website/staged/ in the race-club-data repo instead of the real league. Only read-only requests are answered this way; nothing
// is ever written to the Sheet, and every other request still goes to the real server. The switch lives
// in this browser only (localStorage) and is ignored unless the saved profile is an Admin.
var RC_STAGED_FLAG_KEY = 'rc_staged_hub_on';
function rcStagedHubOn() {
  try {
    if (localStorage.getItem(RC_STAGED_FLAG_KEY) !== '1') return false;
    if (!localStorage.getItem('raceclub_token')) return false;
    var prof = JSON.parse(localStorage.getItem('raceclub_profile_cache') || 'null');
    return !!(prof && prof.role === 'Admin');
  } catch (err) { return false; }
}
function rcSetStagedHub(on) {
  try { if (on) localStorage.setItem(RC_STAGED_FLAG_KEY, '1'); else localStorage.removeItem(RC_STAGED_FLAG_KEY); } catch (err) { /* storage blocked */ }
}
// All saved website data lives in the race-club-data repo (GitHub Pages). Must match GITHUB_ARCHIVE_BASE_URL plus 'website/staged/'.
var RC_STAGED_BASE = 'https://stenbough-cmd.github.io/race-club-data/website/staged/';
var _rcStagedFiles_ = {};
function _rcStagedFile_(name) {
  if (!_rcStagedFiles_[name]) {
    _rcStagedFiles_[name] = fetch(RC_STAGED_BASE + name + '.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('RC_STAGED_' + r.status);
      // The signed-in member takes the place of one made-up driver (see _rcStagedSwap_), so they appear in the staged results.
      return r.text().then(function (t) { return JSON.parse(_rcStagedSwap_(t)); });
    });
    _rcStagedFiles_[name].catch(function () { delete _rcStagedFiles_[name]; });
  }
  return _rcStagedFiles_[name];
}
function _rcStagedRoundFile_(roundId) {
  if (!/^CRND-\d{4}$/.test(String(roundId || ''))) return Promise.resolve(null);
  return _rcStagedFile_('round-' + roundId).catch(function () { return null; });
}

// ---- The signed-in member inside the staged league -------------------------------------------------
// While the Staged League Hub is ON, one made-up driver (RC-90012, mid-pack) is swapped for the signed-in member: the id and
// the name are replaced in every staged file as it is read, so the member shows in the hub, the results, the recaps and their own
// profile page. Nothing is written anywhere; it only changes what this browser draws.
var RC_STAGED_ME_ID = 'RC-90012';
var RC_STAGED_ME_NAME = 'Kasper Nieminen';
function _rcStagedMe_() {
  try {
    var pc = (typeof getProfileCache === 'function') ? getProfileCache() : null;
    if (pc && pc.profileId && pc.displayName) return { id: String(pc.profileId), name: String(pc.displayName).trim() };
  } catch (err) { /* no cache: no swap */ }
  return null;
}
function _rcStagedSwap_(text) {
  var me = _rcStagedMe_();
  if (!me) return text;
  var esc = function (x) { return JSON.stringify(x).slice(1, -1); };
  var parts = me.name.split(/\s+/);
  var first = parts[0], last = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
  return text.split(RC_STAGED_ME_ID).join(me.id).split(RC_STAGED_ME_NAME).join(esc(me.name))
    .replace(/\bNieminen\b/g, function () { return esc(last); }).replace(/\bKasper\b/g, function () { return esc(first); });
}

// Made-up protests for the staged league: some filed by the member, some against them, and some between other drivers.
// Same shapes the real protest calls answer with, so the dashboard tile, the Protests popup and the Stewarding docket draw as they will live.
var _rcStagedCtx_P = null;
function _rcStagedCtx_() {
  if (_rcStagedCtx_P) return _rcStagedCtx_P;
  _rcStagedCtx_P = Promise.all([_rcStagedFile_('hub'), _rcStagedFile_('profiles')]).then(function (a) {
    var hub = a[0] || {}, prof = a[1] || {};
    var me = _rcStagedMe_();
    if (!me) return null;
    var people = [], myCls = '';
    (hub.standings || []).forEach(function (blk) {
      (blk.standings || []).forEach(function (row) {
        var id = row.profileId || row.id || '';
        if (!row.name) return;
        people.push({ id: id, name: row.name, cls: blk.className });
        if (id === me.id || row.name === me.name) myCls = blk.className;
      });
    });
    var rivals = people.filter(function (x) { return x.id !== me.id && x.name !== me.name && x.cls === myCls; });
    var others = people.filter(function (x) { return x.id !== me.id && x.name !== me.name; });
    if (rivals.length < 2) rivals = others;
    if (others.length < 4) return null;
    var rounds = (hub.calendar || []).filter(function (e) { return e.kind === 'round' && e.hasResults !== false; })
      .sort(function (x, y) { return (Number(x.roundNumber) || 0) - (Number(y.roundNumber) || 0); });
    if (!rounds.length) return null;
    var seed = 20261104;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    function pick(list, not) { var x, n = 0; do { x = list[Math.floor(rnd() * list.length)]; n++; } while (not && not.indexOf(x.id) !== -1 && n < 30); return x; }
    var TYPES = ['Avoidable Collision', 'Unsafe Rejoin', 'Blocking / Weaving', 'Blue Flag Violation', 'Deliberate Retaliation', 'Unsportsmanlike Conduct'];
    var DESC = {
      'Avoidable Collision': 'Was hit from behind on the brake zone into the chicane and lost two positions.',
      'Unsafe Rejoin': 'Rejoined across the racing line after going off and forced me wide.',
      'Blocking / Weaving': 'Moved more than once on the straight while I was already alongside.',
      'Blue Flag Violation': 'Did not give way for several corners while being lapped.',
      'Deliberate Retaliation': 'Drove into the side of my car after the earlier contact.',
      'Unsportsmanlike Conduct': 'Repeated abusive comments in the lobby after the race.'
    };
    var self = { id: me.id, name: me.name };
    // Per round plan: [filer, against, status, tier]. 'me', 'rv' (rival), 'x'/'y' (two other drivers).
    var PLAN = [
      [['x', 'y', 'Upheld', 2], ['me', 'rv', 'Denied', null]],
      [['rv', 'me', 'Upheld', 3], ['x', 'y', 'Denied', null]],
      [['x', 'y', 'Upheld', 4], ['y', 'x', 'Upheld', 1], ['rv', 'me', 'Denied', null]],
      [['me', 'rv', 'Upheld', 2], ['x', 'y', 'Denied', null]],
      [['x', 'y', 'Upheld', 3], ['rv', 'me', 'Upheld', 1], ['me', 'rv', 'Denied', null]],
      [['x', 'y', 'Upheld', 5], ['me', 'rv', 'Denied', null]]
    ];
    var LAST = [['me', 'rv', 'Pending', null], ['rv', 'me', 'Pending', null], ['x', 'y', 'Pending', null]];
    var all = [], n = 0;
    rounds.forEach(function (r, i) {
      var isLast = i === rounds.length - 1;
      var plan = isLast ? LAST : PLAN[i % PLAN.length];
      var rv = pick(rivals), x = pick(others, [rv.id]), y = pick(others, [rv.id, x.id]);
      var who = { me: self, rv: rv, x: x, y: y };
      plan.forEach(function (pl, k) {
        var f = who[pl[0]], a = who[pl[1]], type = TYPES[(n * 5 + i + k) % TYPES.length];
        var sub = new Date(new Date(r.startUtc || '2026-08-23T19:00:00.000Z').getTime() + (3 + k * 2) * 3600000).toISOString();
        all.push({
          protestId: 'PRT-' + String(9000 + n), status: pl[2], infractionType: type, roundLabel: r.eventName || ('Round ' + r.roundNumber),
          roundNumber: Number(r.roundNumber) || (i + 1), trackName: r.track || '', eventName: r.eventName || '', shortName: r.shortName || (r.track || '').slice(0, 3).toUpperCase(),
          filerName: f.name, involvedNames: [f.name, a.name], isMine: f.id === me.id, source: 'Driver-Filed', isAutoFlagged: false,
          penaltyTier: pl[3], submittedAt: sub, seasonId: hub.seasonId || '', resultsFinalized: !isLast, roundId: r.roundId,
          lapNumber: 3 + ((n * 7 + i * 3) % 28), againstProfileId: a.id, against2ProfileId: '', description: DESC[type], suggestedTier: null,
          reviewedAt: pl[2] === 'Pending' ? null : new Date(new Date(sub).getTime() + 20 * 3600000).toISOString(), reviewedByName: pl[2] === 'Pending' ? null : 'Chief Steward',
          _mine: f.id === me.id || a.id === me.id
        });
        n++;
      });
    });
    function strip(p) { var o = {}; Object.keys(p).forEach(function (k) { if (k !== '_mine') o[k] = p[k]; }); return o; }
    var mine = all.filter(function (p) { return p._mine; }).sort(function (a, b) { return new Date(b.submittedAt) - new Date(a.submittedAt); }).map(strip);
    var lastRoundId = rounds[rounds.length - 1].roundId;
    var currentMine = mine.filter(function (p) { return p.roundId === lastRoundId; });
    var seat = null;
    try {
      var pg = (prof.pages || {})[me.id], th = pg && pg.teamHistory && pg.teamHistory[0];
      if (th && th.seat) {
        seat = { success: true, hasSeat: true, team: th.seat.team || '', manufacturer: th.seat.manufacturer || '', carNumber: th.seat.carNumber || '', carModel: th.seat.carModel || '',
          carClass: th.seat.carClass || myCls, position: th.position || null, positionOutOf: th.classSize || null, points: th.points || 0, podiums: th.podiums || 0,
          statsKnown: true, carYear: String(th.seat.carYear || ''), carSeries: th.seat.carSeries || '' };
      }
    } catch (err) { /* keep the real seat */ }
    var feedRounds = rounds.slice().reverse().map(function (r) {
      var ps = all.filter(function (p) { return p.roundId === r.roundId; }).map(strip).sort(function (a, b) { return new Date(b.submittedAt) - new Date(a.submittedAt); });
      return { roundId: r.roundId, seasonId: hub.seasonId || '', seasonName: hub.seasonName || '', roundNumber: Number(r.roundNumber) || 0, eventName: r.eventName || '', track: r.track || '',
        shortName: r.shortName || (r.track || '').slice(0, 3).toUpperCase(), startUtc: r.startUtc || '', resultsFinalized: r.roundId !== lastRoundId,
        pendingCount: ps.filter(function (p) { return p.status === 'Pending'; }).length, protests: ps };
    });
    return {
      seat: seat,
      dash: { success: true, protests: currentMine.slice(0, 3), totalCount: currentMine.length, pendingCount: currentMine.filter(function (p) { return p.status === 'Pending'; }).length },
      mineFull: { success: true, protests: mine, totalCount: mine.length, pendingCount: mine.filter(function (p) { return p.status === 'Pending'; }).length },
      feed: { success: true, rounds: feedRounds }
    };
  });
  _rcStagedCtx_P.catch(function () { _rcStagedCtx_P = null; });
  return _rcStagedCtx_P;
}

// Returns a Promise with the staged answer, or null when this request is not one the staged data covers.
function _rcStagedAnswer_(action, options) {
  var params = (options && options.params) || {};
  var isPost = options && options.method === 'POST';
  if (action === 'leagueStory') {
    return Promise.resolve(isPost ? { success: false, message: 'Story feedback is switched off while the Staged League Hub is on.' }
      : { success: true, signedIn: false, eligibleSeasonIds: [], votes: {} });
  }
  if (isPost) return null;
  var NF = { success: false, error: 'NOT_FOUND', message: 'No posted results for that round.' };
  if (action === 'getDashboardData') {
    return _rcFetchApiLive_(action, options).then(function (d) {
      return _rcStagedCtx_().then(function (c) {
        if (!c || !d || !d.success) return d;
        if (c.seat) d.currentSeat = c.seat;
        d.myProtests = c.dash;
        return d;
      }).catch(function () { return d; });
    });
  }
  if (action === 'getProtestsPageData') {
    return _rcFetchApiLive_(action, options).then(function (d) {
      return _rcStagedCtx_().then(function (c) { if (c && d && d.success) d.mine = c.mineFull; return d; }).catch(function () { return d; });
    });
  }
  if (action === 'getStewardingFeed') {
    return _rcStagedCtx_().then(function (c) { return c ? c.feed : _rcFetchApiLive_(action, options); }).catch(function () { return _rcFetchApiLive_(action, options); });
  }
  if (action === 'getLeagueHub') {
    return _rcStagedFile_('hub').then(function (hub) { return (params.seasonId && params.seasonId !== hub.seasonId) ? { success: false, error: 'NOT_FOUND' } : hub; });
  }
  if (action === 'getMemberList') return _rcStagedFile_('hub').then(function (hub) { return { success: true, members: hub.members }; });
  if (action === 'getDriverDirectory') return _rcStagedFile_('directory');
  if (action === 'getPublicRoundResults') return _rcStagedRoundFile_(params.roundId).then(function (f) { return f ? { success: true, result: f.result } : NF; });
  if (action === 'getPublicRoundQualifying') return _rcStagedRoundFile_(params.roundId).then(function (f) { return f ? { success: true, result: f.qualifying } : NF; });
  if (action === 'getDriverProfileRound') {
    return _rcStagedRoundFile_(params.roundId).then(function (f) {
      var r = f && f.driverRounds && f.driverRounds[params.profileId];
      return r || { success: true, hasData: false, round: { roundId: params.roundId } };
    });
  }
  if (action === 'getDriverProfilePage') {
    return _rcStagedFile_('profiles').then(function (f) { return (f.pages && f.pages[params.profileId]) || { success: false, error: 'PROFILE_NOT_FOUND' }; });
  }
  if (action === 'getDriverProfileRivals') {
    return _rcStagedFile_('profiles').then(function (f) { return (f.rivals && f.rivals[params.profileId]) || { success: true, rivals: [] }; });
  }
  return null;
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', function () {
    if (rcStagedHubOn() && !/^\[STAGED\]/.test(document.title)) document.title = '[STAGED] ' + document.title;
  });
}

// ---- DRIVER DIRECTORY (public list behind profile.html) ----
// Read from league/directory.json (see RC_DATA_ROUTES_). Nothing is kept in this browser: the file is
// revalidated on every load, which costs a tiny 304 reply when it has not changed.
function rcReadSavedDriverDirectory() { return null; }
function rcFetchDriverDirectory() {
  return fetchApi('getDriverDirectory', {}).then(function (dir) {
    if (!dir || !dir.success || !Array.isArray(dir.drivers)) throw new Error('RC_DIRECTORY_BAD');
    return dir;
  });
}
// The league page used this to warm the saved copy; with no saved copy there is nothing to warm.
function rcDriverDirectoryIsStale() { return false; }

// Writes (POSTs) wait up to Apps Script's 6-minute execution limit plus slack, so an admin always gets
// the server's real acknowledgement or error instead of guessing whether a short client timeout hid
// a success.
var RC_POST_TIMEOUT_MS = 370000;

// Number of writes currently in flight, plus a listener hook -- Account.html uses it to lock every
// open popup's X/Cancel/buttons until the server has answered. Listeners run AFTER the counter
// changes and BEFORE the caller's own .then, so a popup's success handler can close itself.
var rcWritesInFlight = 0;
var rcWriteListeners_ = [];
function rcOnWriteStateChange(fn) {
  rcWriteListeners_.push(fn);
  return function () {
    var i = rcWriteListeners_.indexOf(fn);
    if (i !== -1) rcWriteListeners_.splice(i, 1);
  };
}
function rcNotifyWriteListeners_() {
  rcWriteListeners_.slice().forEach(function (fn) { try { fn(rcWritesInFlight); } catch (err) { /* a listener must never break a request */ } });
}
function rcWriteStarted_() { rcWritesInFlight++; rcNotifyWriteListeners_(); }
function rcWriteFinished_() { rcWritesInFlight = Math.max(0, rcWritesInFlight - 1); rcNotifyWriteListeners_(); }

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
var RC_FETCH_TIMEOUT_MS_FINALIZE = 240000;

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
    .then(function (data) {
      if (data && data._pub) rcNoteDataRevs(data._pub);   // Apps Script just published data files (Publish.gs)
      return data;
    })
    .catch(function (err) {
      if (timer) clearTimeout(timer);
      if (timedOut) throw new Error('RC_FETCH_TIMEOUT');
      throw err;
    });
}

// ---- PUBLIC DATA FILES (GitHub Pages) ----
// Public, read-only data is published by Apps Script as JSON files in the race-club-data repo (Publish.gs) and read
// straight from GitHub Pages (about 20 ms) instead of calling Apps Script (about 1.6 s). fetchApi decides this itself,
// so a page keeps calling fetchApi('getPublicRoundResults', ...) exactly as before and never knows which route answered.
//   - Files are fetched from a fixed address with cache: 'no-cache': the browser asks GitHub "changed?" on every load
//     (a tiny 304 reply when not), and nothing is kept in the browser.
//   - A file is used only if it is valid (schema matches, has a revision) and is not older than the newest revision
//     this browser has been told about. Apps Script adds `_pub` to the reply of any request that published a file,
//     so the person who just saved never sees an older copy than their own save produced.
//   - Missing, unreadable, slow (8 s) or older-than-expected file: the same request goes to Apps Script, and the
//     first such request for a file also carries republish=1 so Apps Script writes the file for the next visitor.
//   - Add ?source=api to any page address to skip files and use Apps Script only (for checking a page).
var RC_DATA_BASE_URL = 'https://stenbough-cmd.github.io/race-club-data/website/data/';
// Web address of a story photo. "spa/spa_061.jpg" is a track photo on the website itself (assets/tracks/); "user/RND-0007_123.jpg" is a
// picture an organizer chose in Upload Results, kept in the data repo (website/images/tracks/user/).
function rcStoryPhotoUrl(file) {
  var enc = String(file || '').split('/').map(encodeURIComponent).join('/');
  if (/^user\//.test(file)) return RC_DATA_BASE_URL.replace(/data\/$/, 'images/tracks/') + enc;
  return 'assets/tracks/' + enc;
}
var RC_DATA_SCHEMA = 1;                       // must match RC_PUBLISH_SCHEMA_ in Publish.gs
var RC_DATA_FILE_TIMEOUT_MS = 8000;
var RC_DATA_REVS_KEY_ = 'rc_pub_revs';        // tiny { path: { rev, t } } note, not data; entries expire after 15 minutes
var RC_DATA_REVS_KEEP_MS_ = 15 * 60 * 1000;
var RC_DATA_SOURCE = (function () {
  try { var m = /[?&]source=(api|files)(?:&|$)/.exec(location.search); return m ? m[1] : 'files'; } catch (err) { return 'files'; }
})();

function _rcDataRoundPath_(p) {
  return /^RND-\d{3,8}$/.test(String(p.roundId || '')) ? 'rounds/' + p.roundId + '.json' : null;
}
// A data file minus its meta block = the object the action returns.
function _rcDataStrip_(f) {
  var out = {};
  Object.keys(f).forEach(function (k) { if (k !== 'meta') out[k] = f[k]; });
  return out;
}
// The few League Hub fields that depend on the clock (client-side twin of _rcRefreshTimeDerivedLeagueHubFields_ in
// Website.gs; keep them in lockstep). A published file is minutes or days old, so these are recomputed on every read.
function rcPatchHubTimeFields(hub) {
  if (!hub || !hub.hasSeason || !Array.isArray(hub.calendar)) return hub;
  var nowMs = Date.now();
  hub.calendar.forEach(function (entry) {
    entry.finished = !!(entry.startUtc && new Date(entry.startUtc).getTime() < nowMs);
    entry.raceOver = !!(entry.startUtc && (new Date(entry.startUtc).getTime() + 3 * 60 * 60 * 1000) <= nowMs);
  });
  var done = hub.calendar.filter(function (e) { return e.kind === 'round' && e.finished && e.hasResults; });
  hub.roundsCompleted = done.length;
  hub.hasUnofficialResults = done.some(function (e) { return !e.resultsFinalized; });
  var next = hub.calendar.filter(function (e) { return e.kind !== 'bye' && !e.raceOver; })[0];
  hub.nextRace = next ? {
    kind: next.kind, eventName: next.eventName || '', track: next.track || '', layout: next.layout || '',
    startUtc: next.startUtc || '', raceLengthTier: next.raceLengthTier || '', roundNum: next.roundNum || 0, totalRounds: hub.totalRounds
  } : null;
  return hub;
}
// action -> which file answers it and which part of the file is the answer (the same object the action returns).
var RC_DATA_ROUTES_ = {
  getPublicRoundResults: { file: _rcDataRoundPath_, pick: function (f) { return f.results; } },
  getPublicRoundQualifying: { file: _rcDataRoundPath_, pick: function (f) { return f.qualifying; } },
  // One driver's report for one round (My Laps + Driver Report): the whole file is the answer.
  // League Hub (current season only; a past season, ?seasonId=, still asks Apps Script) and the Driver Directory.
  getLeagueHub: {
    file: function (p) { return p.seasonId ? null : 'league/hub.json'; },
    pick: function (f) { return rcPatchHubTimeFields(_rcDataStrip_(f)); }
  },
  // A driver's profile page and rivalries (two files; rivals are the slow build, so they are their own file).
  getDriverProfilePage: {
    file: function (p) { return /^RC-\d{5,6}$/.test(String(p.profileId || '')) ? 'profiles/' + p.profileId + '.json' : null; },
    pick: _rcDataStrip_
  },
  getDriverProfileRivals: {
    file: function (p) { return /^RC-\d{5,6}$/.test(String(p.profileId || '')) ? 'profiles/' + p.profileId + '/rivals.json' : null; },
    pick: _rcDataStrip_
  },
  // Championship (running and ended seasons alike): the owner's page, and each round's Race / Qualifying / My Laps result.
  champGetPage: {
    file: function (p) {
      if (!/^RC-\d{5,6}$/.test(String(p.ownerId || ''))) return null;
      if (!p.seasonId) return 'championship/' + p.ownerId + '/current.json';
      return /^CSZN-\d{4,8}$/.test(String(p.seasonId)) ? 'championship/' + p.ownerId + '/' + p.seasonId + '/page.json' : null;
    },
    pick: _rcDataStrip_
  },
  champGetRoundResults: {
    file: function (p) {
      return (/^RC-\d{5,6}$/.test(String(p.ownerId || '')) && /^CRND-\d{4,8}$/.test(String(p.roundId || '')))
        ? 'championship/' + p.ownerId + '/rounds/' + p.roundId + '.json' : null;
    },
    pick: function (f, p) { var r = f[(p && p.kind) || 'race']; return r ? { success: true, result: r } : null; }
  },
  getDriverDirectory: { file: function () { return 'league/directory.json'; }, pick: _rcDataStrip_ },
  getDriverProfileRound: {
    file: function (p) { return (/^RND-\d{3,8}$/.test(String(p.roundId || '')) && /^RC-\d{5,6}$/.test(String(p.profileId || ''))) ? 'rounds/' + p.roundId + '/' + p.profileId + '.json' : null; },
    pick: function (f) { return f; }
  }
};

function _rcDataRevs_() {
  try {
    var o = JSON.parse(localStorage.getItem(RC_DATA_REVS_KEY_) || '{}');
    return (o && typeof o === 'object') ? o : {};
  } catch (err) { return {}; }
}
// Called with the `_pub` map of any Apps Script reply: { 'rounds/RND-0001.json': rev, ... }.
function rcNoteDataRevs(pub) {
  if (!pub || typeof pub !== 'object') return;
  try {
    var now = Date.now(), revs = _rcDataRevs_(), keep = {};
    Object.keys(revs).forEach(function (k) { if (revs[k] && now - revs[k].t < RC_DATA_REVS_KEEP_MS_) keep[k] = revs[k]; });
    Object.keys(pub).forEach(function (k) {
      var rev = Number(pub[k]);
      if (rev && (!keep[k] || rev > keep[k].rev)) keep[k] = { rev: rev, t: now };
    });
    localStorage.setItem(RC_DATA_REVS_KEY_, JSON.stringify(keep));
  } catch (err) { /* storage blocked: every file is then used as published, which is still correct for other visitors */ }
}

var _rcDataInflight_ = {};
function _rcDataFile_(rel) {
  if (_rcDataInflight_[rel]) return _rcDataInflight_[rel];
  var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, RC_DATA_FILE_TIMEOUT_MS) : null;
  var opts = { cache: 'no-cache' };
  if (controller) opts.signal = controller.signal;
  var p = fetch(RC_DATA_BASE_URL + rel, opts).then(function (res) {
    if (timer) clearTimeout(timer);
    if (!res.ok) throw new Error('RC_DATA_' + res.status);
    return res.json();
  }, function (err) {
    if (timer) clearTimeout(timer);
    throw err;
  }).then(function (f) {
    if (!f || !f.meta || f.meta.schema !== RC_DATA_SCHEMA || typeof f.meta.rev !== 'number') throw new Error('RC_DATA_BAD');
    var known = _rcDataRevs_()[rel];
    if (known && Date.now() - known.t < RC_DATA_REVS_KEEP_MS_ && f.meta.rev < known.rev) throw new Error('RC_DATA_OLD');
    return f;
  });
  _rcDataInflight_[rel] = p;
  // Share one fetch between calls made together (Race and Qualifying tabs), then forget it so a later call is fresh.
  var forget = function () { setTimeout(function () { if (_rcDataInflight_[rel] === p) delete _rcDataInflight_[rel]; }, 3000); };
  p.then(forget, forget);
  return p;
}

var _rcRepublished_ = {};

// fetchApi(action, options) -> Promise<Object>
// Wraps the fetch/text-plain/JSON pattern used throughout the source file. action: string, e.g.
function fetchApi(action, options) {
  options = options || {};
  if (rcStagedHubOn()) {
    var stagedAnswer = _rcStagedAnswer_(action, options);
    if (stagedAnswer) return stagedAnswer;
  }
  var route = RC_DATA_ROUTES_[action];
  if (route && RC_DATA_SOURCE === 'files' && (options.method || 'GET') === 'GET') {
    var rel = route.file(options.params || {});
    if (rel) {
      return _rcDataFile_(rel).then(function (f) {
        var res = route.pick(f, options.params || {});
        if (!res || !res.success) throw new Error('RC_DATA_EMPTY');
        return res;
      }).catch(function (err) {
        var o = Object.assign({}, options);
        o.params = Object.assign({}, options.params);
        // A file that exists but is older than this browser's own save is already being published: no rebuild is asked for.
        var oldFile = !!(err && err.message === 'RC_DATA_OLD');
        if (!oldFile && !_rcRepublished_[rel]) { _rcRepublished_[rel] = true; o.params.republish = '1'; }
        return _rcFetchApiLive_(action, o);
      });
    }
  }
  return _rcFetchApiLive_(action, options);
}

// The Apps Script route (what fetchApi was before data files).
function _rcFetchApiLive_(action, options) {
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

  if (method === 'POST') {
    // Every write waits for the server's real answer, up to Apps Script's own 6-minute execution
    // limit (plus a little slack so the server's own failure arrives first). quick:true is for
    // fire-and-forget calls (logout) that should never hold anything up.
    if (options.quick) return _rcFetchOnce_(url, fetchOpts, options.timeoutMs);
    var rcLocks_ = options.background !== true;   // background:true = a save that must not lock the popup (instant-feeling toggles)
    if (rcLocks_) rcWriteStarted_();
    return _rcFetchOnce_(url, fetchOpts, RC_POST_TIMEOUT_MS).then(function (data) {
      if (rcLocks_) rcWriteFinished_();
      return data;
    }, function (err) {
      if (rcLocks_) rcWriteFinished_();
      throw err;
    });
  }
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
