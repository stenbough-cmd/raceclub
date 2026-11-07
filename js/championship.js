// Race Club -- js/championship.js
// Backs championship.html, the single-player "offline" championship (CHAMP chat). The page is laid
// out exactly like the League Hub (league.html) and reuses css/league.css's class names, so it
// looks the same; css/championship.css swaps the colors to the light member-page palette.
//
// This is a separate file from js/league.js on purpose: league.js starts itself on load and talks
// to the online league's endpoints, so the renderers here are adapted copies (rcc- prefix) fed by
// the championship backend (Championship.gs, champ* actions) instead.
//
// Access: championship.html?id=<ProfileID>. Every signed-in member gets their own championship
// (another id sends them to theirs); logged-out visitors get one container asking them to sign up. The server checks ownership on
// every call.

// ---------------------------------------------------------------------
// SMALL HELPERS
// ---------------------------------------------------------------------
function _rccEl(tag, className, html) {
  var e = document.createElement(tag);
  if (className) e.className = className;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
function _rccText(tag, className, text) {
  var e = document.createElement(tag);
  if (className) e.className = className;
  e.textContent = text == null ? '' : String(text);
  return e;
}
function _rccEsc(str) { return rcEscapeHtml(str); }
function _rccSpinner(message) {
  var wrap = _rccEl('div', 'rc-inline-spinner-wrap');
  var lights = _rccEl('div', 'rc-startlights');
  for (var i = 0; i < 5; i++) lights.appendChild(_rccEl('span', 'rc-startlight'));
  wrap.appendChild(lights);
  wrap.appendChild(_rccText('div', 'rc-loading-text', message));
  return wrap;
}
function _rccEmpty(title, subtitle) {
  var wrap = _rccEl('div', 'rcl-empty-state');
  wrap.appendChild(_rccEl('div', 'rcl-empty-state-icon',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"></line></svg>'));
  wrap.appendChild(_rccText('div', 'rcl-empty-state-title', title || 'No Data To Display'));
  if (subtitle) wrap.appendChild(_rccText('div', 'rcl-empty-state-subtitle', subtitle));
  return wrap;
}
function _rccOrdinal(n) {
  var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
// Toasts (lower right, same as the rest of the site). The last few shown just before a reload or a
// page change are carried over (sessionStorage) and shown again once the new page has loaded.
var RCC_FLASH_KEY = 'rcc_flash_toasts';
var _rccRecentToasts = [];
function _rccToast(msg, type) {
  if (!msg) return;
  _rccRecentToasts.push({ msg: msg, type: type || 'info', at: Date.now() });
  if (typeof showToast === 'function') showToast(msg, type || 'info');
}
function _rccCarryToasts() {
  var recent = _rccRecentToasts.filter(function (t) { return Date.now() - t.at < 4000; });
  if (!recent.length) return;
  try { sessionStorage.setItem(RCC_FLASH_KEY, JSON.stringify(recent)); } catch (err) { /* toast just won't repeat */ }
}
function _rccShowCarriedToasts() {
  var list = null;
  try { list = JSON.parse(sessionStorage.getItem(RCC_FLASH_KEY) || 'null'); sessionStorage.removeItem(RCC_FLASH_KEY); } catch (err) { list = null; }
  (list || []).forEach(function (t) { if (typeof showToast === 'function') showToast(t.msg, t.type); });
}
function _rccGo(url) {
  // Embedded in the Account dashboard (js/championship-dashboard.js): stay there; the dashboard redraws itself.
  if (window.RCC_EMBEDDED && /^championship\.html/.test(String(url))) { rccReloadAfterSave(); return; }
  _rccCarryToasts(); window.location.href = url;
}
var RCC_CLASS_ORDER = ['Hypercar', 'LMP2', 'LMP3', 'LMGT3', 'LMGTE'];
function _rccSortClasses(list, nameOf) {
  return list.slice().sort(function (a, b) {
    var ai = RCC_CLASS_ORDER.indexOf(nameOf(a)), bi = RCC_CLASS_ORDER.indexOf(nameOf(b));
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
function _rccClassPill(cls) {
  var colors = { LMGTE: 'rc-badge-lmgte', LMGT3: 'rc-badge-lmgt3', LMP3: 'rc-badge-lmp3', LMP2: 'rc-badge-lmp2', Hypercar: 'rc-badge-hypercar' };
  var pill = _rccText('span', 'rc-badge-chip rc-badge-chip-abbrev' + (colors[cls] ? ' ' + colors[cls] : ''), cls === 'Hypercar' ? 'HY' : cls);
  return pill;
}
function _rccLogo(className, manufacturer, onFail) {
  var img = document.createElement('img');
  img.className = className;
  img.alt = manufacturer || '';
  if (!manufacturer || typeof manufacturerLogoSrc !== 'function') { img.style.display = 'none'; return img; }
  // Black logo variants -- this page is light, the League Hub's white logos would vanish here.
  // The Highlights ticker is dark (like the hub's), so its logos are the white variants.
  img.src = manufacturerLogoSrc(manufacturer, /ticker/.test(className) ? 'white' : 'black');
  manufacturerLogoFallback(img, manufacturer, onFail || function () { img.style.display = 'none'; });
  return img;
}
// The player's own name as a link to their public profile (profile.html?id=RC-xxxxx, the same link
// the League Hub uses). Only the player has a profile; AI drivers stay plain text. The profile page
// will show championship stats for members (Matt).
function _rccPlayerName(className, name) {
  // No link for now (Matt, 2026-10-14): the career page shows online league stats only, so the
  // player's name is plain text everywhere on this page.
  return _rccText('span', (className ? className + ' ' : '') + 'rcc-player-link', name || '');
}

// Country flags -- used for tracks only (calendar cards, standings round columns). Drivers never
// show a flag on this page (Matt).
function _rccFlag(className, country) {
  if (!country || typeof countryFlagSrc !== 'function') return null;
  var src = countryFlagSrc(country);
  if (!src) return null;
  var img = document.createElement('img');
  img.className = className;
  img.src = src;
  img.alt = '';
  img.title = country;
  img.onerror = function () { img.style.display = 'none'; };
  return img;
}
function _rccLapTime(raw) {
  var t = Number(raw);
  if (raw === null || raw === undefined || raw === '' || isNaN(t) || t <= 0) return '—';
  var ms = Math.round(t * 1000);
  var m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  return m + ':' + (s < 10 ? '0' : '') + s + '.' + ('00' + r).slice(-3);
}
function _rccTotalTime(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '—';
  var ms = Math.round(seconds * 1000);
  var h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  return h + ':' + ('0' + m).slice(-2) + ':' + ('0' + s).slice(-2) + '.' + ('00' + r).slice(-3);
}
function _rccEventTime(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '';
  var total = Math.max(0, Math.floor(seconds));
  var h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return (h ? h + ':' + ('0' + m).slice(-2) : m) + ':' + ('0' + s).slice(-2);
}
function _rccFormatDate(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
// In-game race start (Matt, 2026-10-09): one of RCC_RACE_STARTS. Older rounds stored a clock time
// ("14:00"), which maps to the matching part of the day.
var RCC_RACE_STARTS = ['Morning', 'Midday', 'Afternoon', 'Evening', 'Night'];
// The in-game clock time that goes with each part of the day (Matt, 2026-11-06). Easy to change here.
var RCC_START_CLOCK = { Morning: '9:00 AM', Midday: '12:00 PM', Afternoon: '3:00 PM', Evening: '6:00 PM', Night: '10:00 PM' };
function _rccStartLabel(v) {
  var t = _rccTimeOfDay(v);
  return t ? t + ' (' + RCC_START_CLOCK[t] + ')' : '';
}
function _rccTimeOfDay(v) {
  if (RCC_RACE_STARTS.indexOf(String(v || '')) !== -1) return String(v);
  var h = parseInt(String(v || '').split(':')[0], 10);
  if (isNaN(h)) return '';
  if (h >= 5 && h < 11) return 'Morning';
  if (h >= 11 && h < 14) return 'Midday';
  if (h >= 14 && h < 17) return 'Afternoon';
  if (h >= 17 && h < 20) return 'Evening';
  return 'Night';
}

var _RCC_ICON_TROPHY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8v5a4 4 0 0 1-8 0V3z"></path><path d="M8 4H4a3 3 0 0 0 3 5"></path><path d="M16 4h4a3 3 0 0 1-3 5"></path><path d="M12 12v4"></path><path d="M9 20h6"></path><path d="M10 20v-2.5"></path><path d="M14 20v-2.5"></path></svg>';
var _RCC_ICON_LAPS_LED = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path><path d="M3 21v-5h5"></path></svg>';
var _RCC_ICON_POLE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="21" x2="6" y2="3"></line><path d="M6 4l12 4-12 4"></path></svg>';
var _RCC_ICON_STOPWATCH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l3 2"></path><path d="M9 2h6"></path><path d="M12 2v3"></path></svg>';
var RCC_MENTION_ICONS = {
  hardCharger: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"></path><path d="M15 7h6v6"></path></svg>',
  fallenFavorite: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l6 6 4-4 8 8"></path><path d="M15 17h6v-6"></path></svg>',
  ironMan: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z"></path><path d="M9 12l2 2 4-4"></path></svg>',
  photoFinish: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-2h6l2 2h3v11H4V8z"></path><circle cx="12" cy="13.5" r="3.5"></circle></svg>',
  statementLap: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"></path></svg>',
  bounceBack: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5v6a5 5 0 0 0 5 5h11"></path><path d="M16 12l4 4-4 4"></path></svg>',
  streakWatch: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c3 4-3 5-3 9a3 3 0 0 0 6 0c0-1-1-2-1-2 2 1 3 3 3 5a5 5 0 0 1-10 0c0-5 5-6 5-12z"></path></svg>',
  closingIn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l7 6-7 6"></path><path d="M20 6l-7 6 7 6"></path></svg>',
  positionSwap: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v12"></path><path d="M4 13l3 3 3-3"></path><path d="M17 20V8"></path><path d="M20 11l-3-3-3 3"></path></svg>'
};

// ---------------------------------------------------------------------
// PAGE STATE + ACCESS
// ---------------------------------------------------------------------
var RCC = { token: null, ownerId: '', page: null, standingsTab: 'drivers' };

function _rccQuery(name) {
  try { return new URLSearchParams(window.location.search).get(name) || ''; } catch (err) { return ''; }
}

// Reload this same page (same owner, same season) after a save -- the site's "reload after save"
// rule. No timers, no polling.
function rccReloadAfterSave() {
  if (window.RCC_EMBEDDED && typeof window.RCC_EMBEDDED_RELOAD === 'function') { window.RCC_EMBEDDED_RELOAD(); return; }   // Account dashboard: redraw the dashboard instead
  _rccCarryToasts();
  window.location.reload();
}

// The start-lights page loader again (Matt, 2026-10-20: switching seasons shows the site's loading
// sequence while the season loads). Same markup as championship.html's #rcl-page-loader.
function _rccShowPageLoader(message) {
  var old = document.getElementById('rcl-page-loader');
  if (old && old.parentNode) old.parentNode.removeChild(old);
  // league.css hides the loader while this class is on (a saved copy was drawn at page open).
  document.documentElement.classList.remove('rcl-has-cache');
  var loader = _rccEl('div', 'rcl-page-loader');
  loader.id = 'rcl-page-loader';
  var card = _rccSpinner(message || 'Loading championship...');
  card.classList.add('rc-inline-spinner-page');
  loader.appendChild(card);
  document.body.insertBefore(loader, document.body.firstChild);
  _rccLockScroll();
}

// Lifts the "plain empty page" state (html.rc-pending, championship.html) so every container appears together.
function _rccReveal() { if (typeof window.rcRevealPage === 'function') window.rcRevealPage(); }

function _rccHidePageLoader() {
  var loader = document.getElementById('rcl-page-loader');
  if (!loader) return;
  loader.classList.add('rcl-page-loader-hidden');
  setTimeout(function () { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 450);
}

// Returns the page mode: 'owner' (any signed-in member: their own championship) or 'loggedout' (nobody
// signed in: one sign-up message and nothing else) -- or false after navigating away.
function _rccCheckAccess() {
  var token = getToken();
  if (!token) return 'loggedout';
  RCC.token = token;
  var me = getProfileCache() || {};
  var id = _rccQuery('id');
  if (!id && me.profileId) {
    // No id in the address -- send the viewer to their own championship URL.
    var url = 'championship.html?id=' + encodeURIComponent(me.profileId);
    var season = _rccQuery('season');
    if (season) url += '&season=' + encodeURIComponent(season);
    window.location.replace(url);
    return false;
  }
  // Someone else's id: back to your own championship.
  if (me.profileId && id !== me.profileId) {
    window.location.replace('championship.html?id=' + encodeURIComponent(me.profileId));
    return false;
  }
  RCC.ownerId = id;
  return 'owner';
}

function _rccApi(action, params, opts) {
  opts = opts || {};
  var p = Object.assign({ ownerId: RCC.ownerId }, params || {});
  if (opts.post) {
    return fetchApi(action, { method: 'POST', token: RCC.token, params: { ownerId: RCC.ownerId }, body: p });
  }
  return fetchApi(action, { token: RCC.token, params: p, timeoutMs: opts.timeoutMs || RC_FETCH_TIMEOUT_MS_LONG });
}

// ---------------------------------------------------------------------
// PAGE DATA. champGetPage and champGetRoundResults are answered from files on GitHub (js/api.js,
// RC_DATA_ROUTES_): championship/<id>/current.json, <id>/<SeasonID>/page.json and <id>/rounds/<RoundID>.json,
// for running and ended seasons alike. When a file is missing or older than this browser's own last save,
// fetchApi asks Apps Script for the same data. Nothing is kept in this browser.
// ---------------------------------------------------------------------
function _rccGetPage(seasonId) {
  return _rccApi('champGetPage', { seasonId: seasonId });
}

// Server-side refusal -> the same redirects the page itself applies.
function _rccHandleAuthError(res) {
  if (!res || res.success) return false;
  if (res.error === 'NOT_AUTHENTICATED') { window.location.replace('index.html'); return true; }
  if (res.error === 'NOT_OWNER') { window.location.replace('Account.html'); return true; }
  return false;
}

// ---------------------------------------------------------------------
// MODAL SHELL -- the League Hub's .rcl-modal-* shell. The X is locked (and every other button in
// the popup grayed) while a write is in flight, same rule as Account.html's showModal.
// ---------------------------------------------------------------------
var _rccScrollY = 0;
function _rccLockScroll() {
  _rccScrollY = window.scrollY || window.pageYOffset || 0;
  document.body.style.top = '-' + _rccScrollY + 'px';
  document.body.classList.add('rc-modal-scroll-locked');
}
function _rccUnlockScroll() {
  if (document.querySelector('.rcl-modal-overlay')) return;
  document.body.classList.remove('rc-modal-scroll-locked');
  document.body.style.top = '';
  window.scrollTo(0, _rccScrollY);
}

function rccOpenModal(title, opts) {
  opts = opts || {};
  var overlay = _rccEl('div', 'rcl-modal-overlay rcl-modal-overlay-over-nav rcc-modal-overlay' + (window.RCC_EMBEDDED ? ' rcc-page' : ''));   // embedded (Account dashboard): rcc-page here makes championship.css's popup rules apply
  var dialog = _rccEl('div', 'rcl-modal-dialog' + (opts.wide ? ' rcl-modal-dialog-wide' : '') + (opts.narrow ? ' rcl-modal-dialog-narrow' : ''));
  var head = _rccEl('div', 'rcl-modal-head');
  var titleEl = _rccText('div', 'rcl-modal-title', title);
  head.appendChild(titleEl);
  var closeBtn = _rccEl('button', 'rcl-modal-close', '&times;');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  head.appendChild(closeBtn);
  dialog.appendChild(head);
  var body = _rccEl('div', 'rcl-modal-body');
  dialog.appendChild(body);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  _rccLockScroll();

  var closed = false;
  function onWriteState() {
    var busy = typeof rcWritesInFlight === 'number' && rcWritesInFlight > 0;
    closeBtn.disabled = busy;
    dialog.classList.toggle('rc-modal-busy', busy);
  }
  if (typeof rcOnWriteStateChange === 'function') rcOnWriteStateChange(onWriteState);
  function close(force) {
    if (closed) return;
    if (!force && typeof rcWritesInFlight === 'number' && rcWritesInFlight > 0) return;
    closed = true;
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    _rccUnlockScroll();
    if (opts.onClose) opts.onClose();
  }
  closeBtn.addEventListener('click', function () { close(false); });
  return {
    overlay: overlay, dialog: dialog, body: body, close: close,
    setTitle: function (t, pillNode) { titleEl.textContent = t + (pillNode ? ' ' : ''); if (pillNode) titleEl.appendChild(pillNode); }
  };
}

// Pending-button pattern: the write button goes gray/disabled with a "...ing" label and stays that
// way until the server's real answer arrives (or Apps Script's 6 minutes run out).
function rccRunWrite(btn, pendingLabel, fn) {
  var original = btn.textContent;
  btn.disabled = true;
  btn.classList.add('rcc-btn-pending');
  btn.textContent = pendingLabel;
  return Promise.resolve().then(fn).then(function (res) {
    if (!res || !res.success) { btn.disabled = false; btn.classList.remove('rcc-btn-pending'); btn.textContent = original; }
    return res;
  }, function (err) {
    btn.disabled = false; btn.classList.remove('rcc-btn-pending'); btn.textContent = original;
    throw err;
  });
}

// Confirm popup: gray Cancel + red commit (the commit is the button that actually writes).
function rccConfirm(title, message, commitLabel, pendingLabel, doWrite, onSuccess) {
  var m = rccOpenModal(title, { narrow: true });
  m.body.appendChild(_rccText('p', 'rcc-confirm-text', message));
  var row = _rccEl('div', 'rcc-btn-row');
  var cancel = _rccText('button', 'rc-btn-secondary rc-btn-sm', 'Cancel');
  cancel.type = 'button';
  var commit = _rccText('button', 'rc-btn-primary rc-btn-sm', commitLabel);
  commit.type = 'button';
  row.appendChild(cancel);
  row.appendChild(commit);
  m.body.appendChild(row);
  var errLine = _rccEl('div', 'rcc-error-line');
  m.body.appendChild(errLine);
  cancel.addEventListener('click', function () { m.close(false); });
  commit.addEventListener('click', function () {
    errLine.textContent = '';
    cancel.disabled = true;
    rccRunWrite(commit, pendingLabel, doWrite).then(function (res) {
      cancel.disabled = false;
      if (_rccHandleAuthError(res)) return;
      if (!res || !res.success) { _rccToast((res && res.message) || 'That did not work. Try again.', 'error'); return; }
      m.close(true);
      if (onSuccess) onSuccess(res);
    }).catch(function () {
      cancel.disabled = false;
      _rccToast('No answer from the server. Reload the page to see whether it went through.', 'error');
    });
  });
  return m;
}

// ---------------------------------------------------------------------
// HERO + BLACK LINK BAR
// ---------------------------------------------------------------------
// Eyebrow above CHAMPIONSHIP (Matt, 2026-10-15): "<FULL NAME>'S SINGLE PLAYER" for a signed-in driver,
// "SINGLE PLAYER MODE" when nobody is signed in. The name comes from the saved sign-in profile.
// WELCOME popup (no season yet): how to start (Matt, 2026-10-17).
function rccOpenWelcomeTip() {
  var m = rccOpenModal('Welcome', { narrow: true });
  m.dialog.classList.add('rcc-light-dialog');
  m.body.appendChild(_rccText('p', 'rcc-confirm-text', 'Welcome to the Single Player Championship. To start your first season, press Create Season in the Single Player Championship section of your Dashboard.'));
}

function rccRenderActionBar(page) {
  var bar = document.getElementById('rcc-actionbar');
  bar.innerHTML = '';
  var inner = _rccEl('div', 'rcc-actionbar-inner');
  // The page links live in the avatar menu now; this bar holds only the season picker.

  // Season picker (Matt, 2026-10-20, same as the League Hub's): every season, newest first, at the
  // right end of the bar, shown once any season exists. Labels are "Season N: Name" (no dates: rounds
  // have no calendar dates in championship mode). Picking one swaps the page in place.
  var barTitle = _rccEl('div', 'rcc-actionbar-title', '<span class="rcl-navbar-title-lite">Single Player</span> Championship');
  barTitle.style.opacity = '1';
  inner.appendChild(barTitle);
  if (page && page.seasons && page.seasons.length) {
    var sel = document.createElement('select');
    sel.className = 'rcc-actionbar-season';
    sel.setAttribute('aria-label', 'Season');
    page.seasons.forEach(function (s) { sel.appendChild(new Option(_rccSeasonLabel(s), s.seasonId)); });
    sel.value = page.seasonId || page.seasons[0].seasonId;
    sel.addEventListener('change', function () {
      if (RCC.onSeasonPick) RCC.onSeasonPick(sel.value);
      else window.location.href = 'championship.html?id=' + encodeURIComponent(RCC.ownerId) + '&season=' + encodeURIComponent(sel.value);
    });
    inner.appendChild(sel);
  }
  bar.appendChild(inner);
}

// Season title block above the first container (css/league.css, .rcl-season-title): eyebrow, "Season N: Name", and the date the
// season was created plus its number of rounds.
function rccRenderSeasonTitle(page) {
  var el = document.getElementById('rcc-season-title');
  if (!el) return;
  el.innerHTML = '';
  if (!page || !page.hasSeason) { el.hidden = true; return; }
  var rec = (page.seasons || []).filter(function (s) { return s.seasonId === page.seasonId; })[0] || {};
  var name = String(page.seasonName || rec.name || '').trim();
  var n = page.seasonNumber || rec.seasonNumber;
  var title = name;
  if (!title) title = n ? 'Season ' + n : 'Season';
  title = title.replace(/\s*[\u2014\u2013]\s*/g, ': ').replace(/\s+-\s+/g, ': ');
  el.appendChild(_rccText('div', 'rcl-season-eyebrow', n ? 'Season ' + n : 'Season'));
  el.appendChild(_rccText('h1', 'rcl-season-name', title));
  var bits = [];
  var made = rec.createdAt ? new Date(rec.createdAt) : null;
  if (made && !isNaN(made.getTime())) bits.push('Created ' + made.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
  var rounds = Number(page.totalRounds) || 0;
  if (rounds) bits.push(rounds + (rounds === 1 ? ' round' : ' rounds'));
  if (bits.length) el.appendChild(_rccText('div', 'rcl-season-line', bits.join(' \u00B7 ')));
  el.hidden = false;
}

function _rccSeasonLabel(s) {
  return s.seasonNumber ? 'Season ' + s.seasonNumber + (s.name ? ' - ' + s.name : '') : (s.name || s.seasonId);
}

// A season that failed to load: a RETRY panel at the top of the page (same as the League Hub's).
function _rccClearLoadError() {
  var old = document.getElementById('rcc-load-error');
  if (old && old.parentNode) old.parentNode.removeChild(old);
}
function _rccShowLoadError(onRetry, title) {
  _rccClearLoadError();
  _rccReveal();
  var main = document.querySelector('.rcl-main');
  if (!main) return;
  var box = _rccEl('div', 'rcl-row-full rcc-load-error');
  box.id = 'rcc-load-error';
  box.appendChild(_rccEmpty(title || 'Could Not Load That Season', 'Check your connection and try again.'));
  var btn = _rccText('button', 'rcc-load-error-btn', 'RETRY');
  btn.type = 'button';
  btn.addEventListener('click', function () {
    btn.disabled = true;
    btn.textContent = 'LOADING...';
    onRetry();
  });
  box.appendChild(btn);
  main.insertBefore(box, main.firstChild);
}
// ---------------------------------------------------------------------
// LAST RACE / SEASON PREVIEW / SEASON RECAP
// ---------------------------------------------------------------------
// Podium tiles show the car's profile picture (assets/cars/<year>-<number>.png) where the maker
// logo used to be; a missing picture shows nothing (Matt). year: the class's season year.
function _rccPodium(rows, year, series) {
  var top3 = (rows || []).slice(0, 3);
  var podium = _rccEl('div', 'rcl-lr-podium');
  if (!top3.length) { podium.appendChild(_rccEmpty('No Data To Display', 'No classified finishers yet.')); return podium; }
  var order = top3.length === 3 ? [1, 0, 2] : top3.map(function (_, i) { return i; });
  order.forEach(function (idx) {
    var row = top3[idx];
    var tile = _rccEl('div', 'rcl-lr-podium-tile rcl-lr-podium-tile-p' + (idx + 1));
    var drv = _rccEl('div', 'rcl-lr-podium-driver');
    if (year && row.carNumber) {
      var car = document.createElement('img');
      car.className = 'rcc-podium-car';
      car.alt = '';
      _rccCarImg(car, year, row.carNumber, series, function () { car.style.display = 'none'; });
      drv.appendChild(car);
    }
    var ident = _rccEl('div', 'rcl-lr-podium-identity');
    ident.appendChild(row.isPlayer ? _rccPlayerName('rcl-lr-podium-name rcc-me-text', (row.name || '').toUpperCase())
      : _rccText('span', 'rcl-lr-podium-name', (row.name || '').toUpperCase()));
    // Car number right after the driver's name (Matt).
    // Same size and weight as the name (Matt).
    if (row.carNumber) ident.appendChild(_rccText('span', 'rcl-lr-podium-name rcc-podium-num', '#' + row.carNumber));
    drv.appendChild(ident);
    tile.appendChild(drv);
    var stand = _rccEl('div', 'rcl-lr-podium-stand');
    var wrap = _rccEl('span', 'rcl-lr-podium-standnum-wrap');
    wrap.appendChild(_rccText('span', 'rcl-lr-podium-standnum', String(idx + 1)));
    wrap.appendChild(_rccText('span', 'rcl-lr-podium-standsuffix', ['st', 'nd', 'rd'][idx]));
    stand.appendChild(wrap);
    tile.appendChild(stand);
    podium.appendChild(tile);
  });
  return podium;
}

function _rccClassYear(page, className) {
  var sd = (page && page.seasonDetails) || {};
  return (sd.classSeasons || {})[className] || sd.seasonYear || '';
}

function _rccMentions(mentions) {
  var grid = _rccEl('div', 'rcl-lr-mentions');
  mentions.slice(0, 3).forEach(function (m) {
    var tile = _rccEl('div', 'rcl-lr-mention-tile');
    var head = _rccEl('div', 'rcl-lr-mention-head');
    head.appendChild(_rccEl('span', 'rcl-lr-mention-icon', RCC_MENTION_ICONS[m.typeKey] || ''));
    head.appendChild(_rccText('span', 'rcl-lr-mention-title', (m.title || '').toUpperCase()));
    tile.appendChild(head);
    tile.appendChild(_rccText('div', 'rcl-lr-mention-stat', m.stat || ''));
    var names = (m.drivers || []).map(function (d) { return d.name; }).filter(Boolean).join(' & ');
    if (names) tile.appendChild(_rccText('div', 'rcl-lr-mention-drivers', names));
    tile.appendChild(_rccText('div', 'rcl-lr-mention-narrative', m.narrative || ''));
    grid.appendChild(tile);
  });
  return grid;
}

// Season format rows (Season Details / Championship Points / Race Rules) -- same pill-headed
// sections as the League Hub's Season Preview, with championship-mode content.
function _rccSeasonFormat(page, body) {
  var d = page.seasonDetails || {};
  var rs = d.raceSettings || {};
  function row(label, value) {
    return _rccEl('div', 'rcl-seasonfmt-row', '<span class="rcl-seasonfmt-row-label">' + _rccEsc(label) + ':</span> <span class="rcl-seasonfmt-row-value">' + _rccEsc(value) + '</span>');
  }
  function group(label, blocks) {
    var g = _rccEl('div', 'rcl-hero-stats-group');
    g.appendChild(_rccText('div', 'rcl-hero-stats-label', label));
    var list = _rccEl('div', 'rcl-seasonfmt-list');
    blocks.forEach(function (rows) {
      if (!rows.length) return;
      var b = _rccEl('div', 'rcl-seasonfmt-block');
      rows.forEach(function (r) { b.appendChild(r); });
      list.appendChild(b);
    });
    g.appendChild(list);
    body.appendChild(g);
  }
  var classes = Object.keys(d.classes || {}).filter(function (c) { return d.classes[c]; });
  classes = _rccSortClasses(classes, function (c) { return c; });
  var details = [];
  // Driver line only before a team is chosen; after that Current Seat at the top shows it (Matt, 2026-10-27).
  if (!page.registration) details.push(row('Driver', page.owner.displayName + ' (no team chosen yet)'));
  if (rs.aiDifficulty) details.push(row('AI Difficulty', rs.aiDifficulty + '% (' + _rccSkillLevel(rs.aiDifficulty) + ')'));
  if (rs.aiAggression) details.push(row('AI Aggression', rs.aiAggression));
  details.push(row('Championship Rounds', String(page.totalRounds)));
  var yr = d.seasonYear || (classes.length ? (d.classSeasons || {})[classes[0]] : '');
  details.push(row('Series', (d.series || 'WEC') + (yr ? ' ' + yr : '')));
  if (classes.length) details.push(row(classes.length === 1 ? 'Class' : 'Classes', classes.join(', ')));
  details.push(row('Cars On The Grid', String((page.grid || []).length)));
  var session = [];
  var tables = d.pointsTables || {};
  var tiers = Object.keys(tables).filter(function (t) { return (tables[t].points || []).length; });
  if (tiers.length) session.push(row('Race Durations', tiers.map(function (t) { return t + ' ' + _rccDur(tables[t].duration); }).join(', ')));
  group('Season Details', [details, session]);

  var tierRows = tiers.map(function (t) {
    var pts = (tables[t].points || []).map(function (v, i) { return '<span class="rcl-seasonfmt-pos">P' + (i + 1) + '</span> ' + _rccEsc(v); }).join(', ');
    return _rccEl('div', 'rcl-seasonfmt-row', '<span class="rcl-seasonfmt-row-label">' + _rccEsc(t) + ':</span> ' + pts);
  });
  var b = d.bonusPoints || {};
  var bonusRows = [];
  if (Number(b.pole)) bonusRows.push(row('Pole Position', '+' + b.pole + ' pts'));
  if (Number(b.fastestLap)) bonusRows.push(row('Fastest Lap', '+' + b.fastestLap + ' pts'));
  if (Number(b.mostLapsLed)) bonusRows.push(row('Most Laps Led', '+' + b.mostLapsLed + ' pts'));
  group('Championship Points', [tierRows, bonusRows]);

  // Same two groups as the season wizard (LMU's Difficulty and Advanced tabs).
  var diff = [], adv = [];
  if (rs.damage) diff.push(row('Damage Simulation', rs.damage));
  if (rs.tireWearMultiplier) diff.push(row('Tyre Wear', _rccMultLabel(rs.tireWearMultiplier)));
  if (rs.tireWarmers) diff.push(row('Tyre Warmers', rs.tireWarmers));
  if (rs.tireCount) diff.push(row('Available Tyres', String(rs.tireCount)));
  if (rs.fuelMultiplier) diff.push(row('Fuel Usage', _rccMultLabel(rs.fuelMultiplier)));
  if (rs.timeScale) adv.push(row('Time Scale', _rccTimeScaleLabel(rs.timeScale)));
  if (rs.flagRules) adv.push(row('Flag Rules', rs.flagRules));
  if (d.trackLimitsPreset) adv.push(row('Track Limits Rules', d.trackLimitsPreset));
  if (rs.mechanicalFailures) adv.push(row('Mechanical Failures', rs.mechanicalFailures));
  if (rs.trackLimitPoints) adv.push(row('Track Limits Points', String(rs.trackLimitPoints)));
  var sessionRows = [];
  if (rs.raceStart) sessionRows.push(row('Start', rs.raceStart === 'Fast' ? 'Fast Rolling' : rs.raceStart));
  if (rs.realRoadTimeScale) sessionRows.push(row('RealRoad Time Scale', _rccTimeScaleLabel(rs.realRoadTimeScale)));
  sessionRows.push(row('Qualifying Session', rs.qualifying === 'No' ? 'No (Random start)' : 'Yes'));
  var rules = diff.concat(adv, sessionRows);
  group('Race Rules', [rules]);
}

// Each class's highlights for one race: header, podium and highlight cards. Shared by Last Race and
// the Race Recap's Highlights page (Matt, 2026-10-19).
// Race Recap page header (Matt, 2026-10-20): the metal bar with "<TITLE>" in bold and
// "FROM ROUND N AT <TRACK SHORT NAME>" in light, on every page that has one.
function _rccRecapHeader(title, r) {
  var h = _rccText('div', 'rcl-standings-class-header', title.toUpperCase());
  r = r || {};
  if (r.roundNum || r.track) h.appendChild(_rccText('span', 'rcl-lr-class-header-sub', ' FROM ROUND ' + (r.roundNum || '') + (r.track ? ' AT ' + String(r.track).toUpperCase() : '')));
  return h;
}

function _rccHighlightBlocks(page, r, body) {
  (r.classes || []).forEach(function (cls) {
    var w = _rccEl('div', 'rcl-lr-class');
    w.appendChild(_rccRecapHeader(cls.className + ' Highlights', r));
    w.appendChild(_rccPodium(cls.standings, _rccClassYear(page, cls.className), (page.seasonDetails || {}).series));
    if ((cls.headlineMentions || []).length) w.appendChild(_rccMentions(cls.headlineMentions));
    body.appendChild(w);
  });
}

// Race Recap > Highlights: the Last Race container for the chosen round.
function _rccHighlightsBody(result, el) {
  el.innerHTML = '';
  if (!result || !(result.classes || []).length) { el.appendChild(_rccEmpty('No Data To Display', 'The highlights appear once this round\u2019s race results are uploaded.')); return; }
  var wrap = _rccEl('div', 'rcc-recap-highlights');
  _rccHighlightBlocks(RCC.page, result, wrap);
  el.appendChild(wrap);
}

function rccRenderLastRace(page) {
  var body = document.getElementById('rcl-last-race');
  var titleEl = document.getElementById('rcl-last-race-title');
  var panel = document.getElementById('rcl-last-race-panel');
  var classesHost = document.getElementById('rcl-numbers-classes');
  body.innerHTML = '';
  if (classesHost) classesHost.innerHTML = '';
  body.classList.remove('rcl-seasonfmt-modal-body');
  if (panel) panel.hidden = true;
  if (!page || !page.hasSeason) {
    if (panel) panel.hidden = false;
    titleEl.textContent = 'Welcome';
    body.appendChild(_rccEmpty('No Championship Yet', 'Open the Single Player Championship section of your Dashboard and press Create Season to set up your first offline season. Pick the series, year, classes, rounds and AI difficulty, then choose your team there.'));
    return;
  }
  // An ended season keeps showing the last round's highlights; no Season Recap or Champions view
  // (Matt, 2026-10-13: titles never change at season end).
  if (!page.lastRace) {
    // The season's details now close the Season Preview story, so this container only shows the call to action.
    if (page.registration) return;
    if (panel) panel.hidden = false;
    titleEl.textContent = 'Season Preview';
    var cta = _rccEl('div', 'rcc-cta');
    cta.appendChild(_rccText('div', 'rcc-cta-text', 'Your season is set up. Choose the team you will drive for in the Single Player Championship section of your Dashboard to start racing.'));
    var btn = _rccText('a', 'rc-btn-secondary', 'Go To Dashboard');
    btn.href = 'Account.html';
    cta.appendChild(btn);
    body.appendChild(cta);
    return;
  }
  // One highlights container per class, like the League Hub's By The Numbers.
  var r = page.lastRace;
  (r.classes || []).forEach(function (cls) {
    var cp = _rccEl('section', 'rcl-panel rcl-lr-panel');
    var head = _rccEl('div', 'rcl-panel-head');
    head.appendChild(_rccText('div', 'rcl-panel-title', String(cls.className || 'Class').toUpperCase() + ' HIGHLIGHTS'));
    if (r.roundNum || r.track) head.appendChild(_rccText('div', 'rcl-panel-note', 'FROM ROUND ' + (r.roundNum || '') + (r.track ? ' AT ' + String(r.track).toUpperCase() : '')));
    cp.appendChild(head);
    var cb = _rccEl('div', 'rcl-panel-body');
    cb.appendChild(_rccPodium(cls.standings, _rccClassYear(page, cls.className), (page.seasonDetails || {}).series));
    if ((cls.headlineMentions || []).length) cb.appendChild(_rccMentions(cls.headlineMentions));
    cp.appendChild(cb);
    classesHost.appendChild(cp);
  });
  // Link under the containers: opens this round's Race Recap and Driver Reports.
  var foot = _rccEl('div', 'rcl-lr-footer');
  var link = _rccEl('button', 'rcl-lr-footer-link', 'SEE THE FULL RACE RECAPS AND DRIVER REPORTS <span class="rcl-lr-footer-arrow" aria-hidden="true">&rarr;</span>');
  link.type = 'button';
  link.addEventListener('click', function () { rccOpenResults(r.roundId, 'race'); });
  foot.appendChild(link);
  classesHost.appendChild(foot);
}

// ---------------------------------------------------------------------
// CALENDAR CAROUSEL (adapted from league.js -- no dates in championship mode, so the countdown is
// replaced by round status: Race Recap once results are in, Up Next for the next round)
// ---------------------------------------------------------------------
function rccRenderCarousel(page) {
  var outer = document.getElementById('rcl-race-carousel');
  outer.innerHTML = '';
  var entries = (page && page.hasSeason) ? (page.calendar || []) : [];
  if (!entries.length) {
    outer.style.display = page && page.hasSeason ? '' : 'none';
    if (page && page.hasSeason) outer.appendChild(_rccEmpty('No Data To Display', 'This season has no rounds yet.'));
    return;
  }
  outer.style.display = '';
  var nextIdx = -1;
  entries.forEach(function (e, i) { if (nextIdx === -1 && !e.hasResults) nextIdx = i; });
  var activeIdx = nextIdx === -1 ? entries.length - 1 : nextIdx;
  var track = _rccEl('div', 'rcl-carousel-track');
  outer.appendChild(track);
  var items = [];
  function setActive(idx) {
    activeIdx = idx;
    items.forEach(function (el, i) { el.classList.toggle('rcl-carousel-item-active', i === idx); });
  }
  entries.forEach(function (entry, idx) {
    var item = _rccEl('div', 'rcl-carousel-item' + (idx === activeIdx ? ' rcl-carousel-item-active' : '') + (entry.hasResults ? ' rcl-carousel-item-finished' : ''));
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    var header = _rccEl('div', 'rcl-carousel-header');
    var flag = _rccFlag('rcl-carousel-flag', entry.country);
    if (flag) header.appendChild(flag);
    header.appendChild(_rccText('div', 'rcl-carousel-eventname', entry.eventName || 'Race'));
    if (entry.track) header.appendChild(_rccText('div', 'rcl-carousel-trackname', entry.track));
    header.appendChild(_rccText('div', 'rcl-carousel-datetime', 'Round ' + entry.roundNum + ' of ' + entries.length + ''));
    item.appendChild(header);

    var compact = _rccEl('div', 'rcl-carousel-compact-header');
    var cflag = _rccFlag('rcl-carousel-flag', entry.country);
    if (cflag) compact.appendChild(cflag);
    if (entry.track) compact.appendChild(_rccText('div', 'rcl-carousel-compact-track', entry.track.slice(0, 3)));
    compact.appendChild(_rccText('div', 'rcl-carousel-compact-month', 'Round'));
    compact.appendChild(_rccText('div', 'rcl-carousel-compact-day', String(entry.roundNum)));
    item.appendChild(compact);

    var hero = _rccEl('div', 'rcl-carousel-hero');
    var lines = [];
    var tod = _rccStartLabel(entry.igRaceStart);
    var len = entry.raceLengthMinutes ? _rccDur(entry.raceLengthMinutes) + ' Long' : '';
    var session = (tod ? tod + ' Race' : '') + (len ? (tod ? ', ' : '') + len : '');
    if (session) lines.push(session);
    // Weather preset in words (the results file records no weather); the time of day above gives the rest.
    if (entry.weatherText) lines.push(entry.weatherText);
    if (entry.hasQualifyResults && !entry.hasRaceResults) lines.push('Qualifying results uploaded. The race results are still to come.');
    if (lines.length) {
      var det = _rccEl('div', 'rcl-carousel-details');
      lines.forEach(function (l) {
        var lineEl = _rccText('div', 'rcl-carousel-details-line', l);
        // Keep "1h 12m" in lower case h and m inside the capitalised line (Matt, 2026-10-17).
        if (len && l.indexOf(len) !== -1) {
          lineEl.textContent = '';
          var cut = l.indexOf(len), durTxt = _rccDur(entry.raceLengthMinutes);
          lineEl.appendChild(document.createTextNode(l.slice(0, cut)));
          lineEl.appendChild(_rccText('span', 'rcc-dur', durTxt));
          lineEl.appendChild(document.createTextNode(l.slice(cut + durTxt.length)));
        }
        det.appendChild(lineEl);
      });
      // The race ran longer than planned: the card shows what was raced, and hovering the details
      // shows the plan (points always follow the planned length).
      if (entry.raceLengthAsRaced) det.title = 'Raced for ' + _rccDur(entry.raceLengthMinutes) + '. The round is planned as a ' + entry.plannedRaceLengthTier + ' race of ' + _rccDur(entry.plannedRaceLengthMinutes) + ', and it scores ' + entry.plannedRaceLengthTier + ' points.';
      hero.appendChild(det);
    }
    var btns = _rccEl('div', 'rcl-carousel-hero-btns');
    var btn, drBtn = null;
    if (entry.hasRaceResults || entry.hasQualifyResults) {
      btn = _rccText('button', 'rcl-carousel-hero-btn', entry.hasResults ? 'RACE RECAP' : 'QUALIFYING RESULTS');
      btn.addEventListener('click', function (evt) { evt.stopPropagation(); rccOpenResults(entry.roundId, entry.hasRaceResults ? 'race' : 'qualifying'); });
      if (entry.hasRaceResults) {
        drBtn = _rccText('button', 'rcl-carousel-hero-btn', 'DRIVER REPORT');
        drBtn.type = 'button';
        drBtn.addEventListener('click', function (evt) { evt.stopPropagation(); rccOpenResults(entry.roundId, 'driver'); });
      }
    } else {
      // No Upload Results button on the calendar (Matt, 2026-11-01): uploading is done from the Dashboard.
      btn = _rccText('button', 'rcl-carousel-hero-btn rcl-carousel-hero-btn-disabled', idx === nextIdx ? 'UP NEXT' : 'NOT YET RACED');
      btn.disabled = true;
    }
    btn.type = 'button';
    btns.appendChild(btn);
    if (drBtn) btns.appendChild(drBtn);
    hero.appendChild(btns);
    item.appendChild(hero);
    item.addEventListener('click', function () { if (idx !== activeIdx) setActive(idx); });
    item.addEventListener('keydown', function (evt) { if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); setActive(idx); } });
    items.push(item);
    track.appendChild(item);
  });
  requestAnimationFrame(function () {
    var max = 0;
    items.forEach(function (el) {
      var was = el.classList.contains('rcl-carousel-item-active');
      el.style.transition = 'none';
      if (!was) el.classList.add('rcl-carousel-item-active');
      max = Math.max(max, el.scrollHeight);
      if (!was) el.classList.remove('rcl-carousel-item-active');
      void el.offsetHeight;
      el.style.transition = '';
    });
    // The track is border-box, so its own top and bottom padding go on top of the tallest card
    // (otherwise the padding is eaten and the space under the carousel can't be changed).
    var cs = getComputedStyle(track);
    var padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    if (max > 0) track.style.height = (max + padY) + 'px';
  });
}

// ---------------------------------------------------------------------
// STANDINGS -- Drivers / Teams tabs, plus the Manufacturers' podium section below
// ---------------------------------------------------------------------
var RCC_METAL = ['rcl-standings-row-p1', 'rcl-standings-row-p2', 'rcl-standings-row-p3'];

function _rccPosBadge(idx, text) {
  return _rccText('div', 'rcl-standings-pos' + (RCC_METAL[idx] ? ' ' + RCC_METAL[idx] : ''), text !== undefined ? text : String(idx + 1));
}

// One board per class (Hypercar first, then LMP2, LMP3, LMGT3, LMGTE), each in its own panel.
// Columns: Pos | maker logo | N° | Driver or Team | one column per round (track flag header; points,
// bonus in superscript) | Total. Drivers: crew-mates of one car with equal points share a line and a rank
// ("Name, Name, Name"), as the FIA prints WEC standings. Hypercar shows the drivers' world
// championship only; every other class has a metal Drivers/Teams switch in the panel header.
RCC.standingsView = RCC.standingsView || {};

function _rccStandingsLines(cls, kind) {
  var lines = [];
  if (kind === 'teams') {
    (cls.standings || []).forEach(function (row) { lines.push({ row: row, names: [row.teamName] }); });
    return lines;
  }
  var byKey = {};
  (cls.standings || []).forEach(function (row) {
    var key = row.isPlayer ? null : String(row.teamName) + '|' + String(row.carNumber) + '|' + String(row.championshipPoints);
    if (key && byKey[key]) { byKey[key].names.push(row.name); return; }
    var line = { row: row, names: [row.name] };
    if (key) byKey[key] = line;
    lines.push(line);
  });
  return lines;
}

// Three grid cells for a board row: maker logo | car number | name. The logo slot always stays
// (empty space when there's no logo or it fails to load) so every number and name lines up. The
// number keeps leading zeros exactly as stored (#007). Hover on the name shows the full name + number.
// Car profile picture for the CAR column: assets/cars/<season year>-<car number>.png (transparent
// PNG, e.g. 2023-85.png for the 2023 Iron Dames #85). No two cars share a number in one season. A
// missing picture leaves the slot empty, so the columns still line up.
// Car pictures on this page use the small copies in assets/cars/small/ (300px wide, a few KB each)
// instead of the full-size originals (about 1180px wide), so they download and draw quickly (Matt).
// If a car has no small copy yet, the original is used; if neither exists, onMissing runs.
// js/img-loader.js still picks .webp first, then .jpg, .jpeg, .png, for both.
function _rccCarImg(img, year, carNumber, series, onMissing) {
  var full = rcCarImageSrc(year, carNumber, series);
  if (!full) { if (onMissing) onMissing(); return; }
  var triedFull = false;
  img.onerror = function () {
    if (!triedFull) { triedFull = true; img.src = full; return; }
    if (onMissing) onMissing();
  };
  img.src = full.replace('assets/cars/', 'assets/cars/small/');
}
function _rccCarPic(year, carNumber, series) {
  var slot = _rccEl('div', 'rcl-standings-mfr-logo-slot rcc-board-car-slot');
  if (year && carNumber) {
    var img = document.createElement('img');
    img.className = 'rcl-standings-mfr-logo rcc-board-car';
    img.alt = '';
    _rccCarImg(img, year, carNumber, series, function () { img.style.display = 'none'; });
    slot.appendChild(img);
  }
  return slot;
}

function _rccBoardCells(row, name, kind, carYear, series, showTeam) {
  var slot = _rccEl('div', 'rcl-standings-mfr-logo-slot');
  if (row.manufacturer) slot.appendChild(_rccLogo('rcl-standings-mfr-logo', row.manufacturer));
  var num = _rccText('div', 'rcc-board-num', row.carNumber ? '#' + row.carNumber : '');
  var nameCell = _rccEl('div', 'rcl-standings-name-row rcc-board-name-cell');
  // The player's name (drivers board only) links to their public profile.
  nameCell.appendChild(row.isPlayer && kind !== 'teams' ? _rccPlayerName('rcl-standings-name rcc-me-text', name)
    : _rccText('span', 'rcl-standings-name' + (row.isPlayer ? ' rcc-me-text' : ''), name));
  // GT and prototype drivers boards: the team in gray right after the driver names (Matt, 2026-10-13).
  if (showTeam && row.teamName) nameCell.appendChild(_rccText('span', 'rcl-standings-team', row.teamName));
  nameCell.title = name + (row.carNumber ? ' #' + row.carNumber : '') + (showTeam && row.teamName ? ', ' + row.teamName : '');
  // carYear is set only on boards that show the CAR column (Teams boards and Hypercar).
  return carYear !== undefined ? [slot, _rccCarPic(carYear, row.carNumber, series), num, nameCell] : [slot, num, nameCell];
}

// DRIVER LIST (Matt, 2026-10-22). Before the first results, one panel per class on the grid, laid out
// like the standings board without the position, round and points columns: manufacturer logo, car
// picture, car number, then the car's drivers ("S. Buemi, B. Hartley, R. Hirakawa") with the team in
// gray. Cars in car-number order. Your car shows your name. Header: "<CLASS> DRIVER LIST" in bold and
// "FOR SEASON N" in normal weight.
function _rccDriverInitials(full) {
  // First and middle names become initials; the last name stays whole, with particles like "de" or
  // "van" kept on it ("Reshad de Gerus" -> "R. de Gerus").
  var parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts.join(' ');
  var particles = ['de', 'da', 'di', 'do', 'dos', 'du', 'del', 'della', 'der', 'den', 'van', 'von', 'la', 'le', 'ten', 'ter', 'bin', 'al'];
  var lastStart = parts.length - 1;
  while (lastStart > 1 && particles.indexOf(parts[lastStart - 1].toLowerCase()) !== -1) lastStart--;
  var initials = parts.slice(0, lastStart).map(function (p) {
    return p.split('-').map(function (bit) { return bit.charAt(0).toUpperCase() + '.'; }).join('-');
  });
  return initials.join(' ') + ' ' + parts.slice(lastStart).join(' ');
}

function _rccRenderDriverLists(page, host) {
  var grid = page.grid || [];
  var classes = [];
  grid.forEach(function (g) { if (g.carClass && classes.indexOf(g.carClass) === -1) classes.push(g.carClass); });
  classes = _rccSortClasses(classes, function (c) { return c; });
  var sd = page.seasonDetails || {};
  classes.forEach(function (className) {
    var cars = grid.filter(function (g) { return g.carClass === className; }).sort(function (a, b) {
      return (Number(a.carNumber) || 0) - (Number(b.carNumber) || 0) || String(a.carNumber).localeCompare(String(b.carNumber));
    });
    var row = _rccEl('div', 'rcl-row-full');
    var panel = _rccEl('section', 'rcl-panel');
    var banner = (className === 'LMGTE' || className === 'LMGT3') ? 'gt' : (className === 'Hypercar' ? 'hyper' : 'proto');
    var headEl = _rccEl('div', 'rcl-panel-head rcc-panel-head-tabs rcc-class-head rcc-class-head-' + banner);
    headEl.appendChild(_rccText('div', 'rcl-panel-title', className + ' Driver List'));
    var body = _rccEl('div', 'rcl-panel-body');
    var board = _rccEl('div', 'rcl-standings-class rcc-board rcc-driverlist');
    var head = _rccText('div', 'rcl-standings-class-header', className.toUpperCase() + ' DRIVER LIST');
    if (page.seasonNumber) head.appendChild(_rccText('span', 'rcl-lr-class-header-sub', ' FOR SEASON ' + page.seasonNumber));
    board.appendChild(head);
    var carYear = (sd.classSeasons || {})[className] || sd.seasonYear || '';
    var scroller = _rccEl('div', 'rcc-board-scroll');
    var table = _rccEl('div', 'rcc-board-table rcc-board-has-car');
    table.style.setProperty('--rcc-board-cols', '78px 110px 44px minmax(140px, 1fr)');
    table.style.minWidth = (78 + 116 + 44 + 140 + 6 * 3 + 12) + 'px';
    var hr = _rccEl('div', 'rcc-board-row rcc-board-head');
    hr.appendChild(_rccText('div', 'rcc-board-logo-head', 'Manu'));
    hr.appendChild(_rccText('div', 'rcc-board-logo-head', 'Car'));
    hr.appendChild(_rccEl('div', 'rcc-board-num-head', 'N<sup class="rcc-board-num-deg">&deg;</sup>'));
    hr.appendChild(_rccText('div', 'rcc-board-name-head', 'Drivers'));
    table.appendChild(hr);
    cars.forEach(function (g) {
      var crew = g.isMine ? (g.crew || []) : (g.realCrew || []);
      var names = crew.map(_rccDriverInitials).join(', ');
      var line = { manufacturer: g.manufacturer, carNumber: g.carNumber, teamName: g.teamName, isPlayer: !!g.isMine };
      var rowEl = _rccEl('div', 'rcc-board-row rcl-standings-row' + (g.isMine ? ' rcc-row-me' : ''));
      // A car with no driver names on the Cars tab shows its team once, in the name spot.
      _rccBoardCells(line, names || g.teamName || '', 'drivers', carYear, sd.series, !!names).forEach(function (cell) { rowEl.appendChild(cell); });
      table.appendChild(rowEl);
    });
    scroller.appendChild(table);
    board.appendChild(scroller);
    body.appendChild(board);
    panel.appendChild(headEl);
    panel.appendChild(body);
    row.appendChild(panel);
    host.appendChild(row);
  });
}

function _rccStandingsBoard(page, className, kind) {
  var source = kind === 'teams' ? page.standings.teams : page.standings.drivers;
  var cls = (source || []).filter(function (c) { return c.className === className; })[0] || { className: className, standings: [] };
  var board = _rccEl('div', 'rcl-standings-class rcc-board');
  var head;
  if (className === 'Hypercar') {
    head = _rccText('div', 'rcl-standings-class-header', 'RACE CLUB WORLD ENDURANCE CHAMPIONSHIP');
    head.appendChild(_rccText('span', 'rcl-lr-class-header-sub', ' FOR HYPERCAR DRIVERS'));
  } else {
    head = _rccText('div', 'rcl-standings-class-header', 'RACE CLUB ENDURANCE TROPHY');
    head.appendChild(_rccText('span', 'rcl-lr-class-header-sub', ' FOR ' + className.toUpperCase() + (kind === 'teams' ? ' TEAMS' : ' DRIVERS')));
  }
  board.appendChild(head);

  var rounds = page.calendar || [];
  var scoredIdx = {};
  (page.standings.scoredRoundIds || []).forEach(function (id, i) { scoredIdx[id] = i; });
  // Pos | logo | N° | name | one column per round | Pts. The name column shrinks first: names cut off
  // with "..." as the round columns need the room, down to 140px. Only past that (a very long
  // calendar) does the board scroll sideways. minWidth = the columns + the 6px gaps between them +
  // the rows' 6px side padding.
  var n = rounds.length;
  // CAR column (car profile picture) on every Teams board and always on Hypercar (Matt).
  var showCar = kind === 'teams' || className === 'Hypercar';
  var sd = page.seasonDetails || {};
  var carYear = showCar ? ((sd.classSeasons || {})[className] || sd.seasonYear || '') : undefined;
  var cols = '44px 78px ' + (showCar ? '110px ' : '') + '44px minmax(140px, 1fr) repeat(' + n + ', 46px) 58px';
  var scroller = _rccEl('div', 'rcc-board-scroll');
  var table = _rccEl('div', 'rcc-board-table' + (showCar ? ' rcc-board-has-car' : ''));
  table.style.setProperty('--rcc-board-cols', cols);
  table.style.minWidth = (44 + 78 + (showCar ? 116 : 0) + 44 + 140 + 46 * n + 58 + 6 * (n + 4) + 12) + 'px';
  var hr = _rccEl('div', 'rcc-board-row rcc-board-head');
  hr.appendChild(_rccText('div', null, 'Pos'));
  hr.appendChild(_rccText('div', 'rcc-board-logo-head', 'Manu'));
  if (showCar) hr.appendChild(_rccText('div', 'rcc-board-logo-head', 'Car'));
  hr.appendChild(_rccEl('div', 'rcc-board-num-head', 'N<sup class="rcc-board-num-deg">&deg;</sup>'));
  hr.appendChild(_rccText('div', 'rcc-board-name-head', kind === 'teams' ? 'Teams' : 'Drivers'));
  rounds.forEach(function (r) {
    var cell = _rccEl('div', 'rcc-board-round-head');
    cell.title = 'Round ' + r.roundNum + (r.track ? ' · ' + r.track : '');
    var f = _rccFlag('rcc-board-flag', r.country);
    if (f) cell.appendChild(f); else cell.appendChild(_rccText('span', null, 'R' + r.roundNum));
    hr.appendChild(cell);
  });
  hr.appendChild(_rccText('div', 'rcc-board-total-head', 'Pts'));
  table.appendChild(hr);

  var lines = _rccStandingsLines(cls, kind);
  if (!lines.length) {
    scroller.appendChild(table);
    board.appendChild(scroller);
    board.appendChild(_rccEmpty('No Data To Display', (page.roundsCompleted || 0) ? 'No entries in this class.' : 'The standings appear once the first round has results.'));
    _rccStandingsFooter(board, page);
    return board;
  }
  lines.forEach(function (line, idx) {
    var row = line.row;
    var rowEl = _rccEl('div', 'rcc-board-row rcl-standings-row' + (RCC_METAL[idx] ? ' ' + RCC_METAL[idx] : '') + (row.isPlayer ? ' rcc-row-me' : ''));
    rowEl.appendChild(_rccPosBadge(idx));
    _rccBoardCells(row, line.names.join(', '), kind, carYear, sd.series, kind !== 'teams' && className !== 'Hypercar').forEach(function (cell) { rowEl.appendChild(cell); });
    rounds.forEach(function (r) {
      var cell = _rccEl('div', 'rcc-board-round');
      var i = scoredIdx[r.roundId];
      if (i === undefined) { cell.textContent = ''; }
      else {
        var total = Number((row.perRound || [])[i]) || 0;
        var bonus = Number((row.perRoundBonus || [])[i]) || 0;
        cell.appendChild(document.createTextNode(String(total - bonus)));
        if (bonus) cell.appendChild(_rccText('sup', 'rcc-board-bonus', String(bonus)));
      }
      rowEl.appendChild(cell);
    });
    var pts = _rccEl('div', 'rcl-standings-pts');
    pts.appendChild(_rccText('div', 'rcl-standings-pts-num', String(row.championshipPoints)));
    rowEl.appendChild(pts);
    table.appendChild(rowEl);
  });
  scroller.appendChild(table);
  board.appendChild(scroller);
  _rccStandingsFooter(board, page);
  return board;
}

// "+1 Bonus points for Pole Position, Fastest Lap" when every bonus is worth the same, or
// "+1 Bonus points for Pole Position and +2 bonus points for Most Laps Led" when they differ
// (categories grouped by value, in the wizard's order). Null when the season has no bonus points.
function _rccBonusNote(page) {
  var b = ((page && page.seasonDetails) || {}).bonusPoints || {};
  var groups = [];
  [['pole', 'Pole Position'], ['fastestLap', 'Fastest Lap'], ['mostLapsLed', 'Most Laps Led']].forEach(function (pair) {
    var n = Number(b[pair[0]]) || 0;
    if (n <= 0) return;
    var g = groups.filter(function (x) { return x.n === n; })[0];
    if (!g) { g = { n: n, names: [] }; groups.push(g); }
    g.names.push(pair[1]);
  });
  if (!groups.length) return null;
  return groups.map(function (g, i) {
    return '+' + g.n + (i === 0 ? ' Bonus' : ' bonus') + ' points for ' + g.names.join(', ');
  }).join(' and ');
}

// Footer under every standings board (where the old PRELIMINARY / OFFICIAL line sat): the bonus
// points note.
function _rccStandingsFooter(board, page) {
  var foot = _rccEl('div', 'rcl-results-bottom-row rcl-results-status-footer rcc-board-footer');
  var bonus = _rccBonusNote(page);
  if (bonus) foot.appendChild(_rccText('div', 'rcl-standings-status-note rcc-board-note', bonus));
  // (The phone-only "FOR FULL RESULTS, VIEW ON PC BROWSER" note was removed, Matt 2026-10-13.)
  board.appendChild(foot);
}

function rccRenderStandings(page) {
  var host = document.getElementById('rcc-standings-panels');
  // Manufacturers' Standings sits right above the Hypercar board (Matt, 2026-10-13). It is moved
  // inside this host below, so take it back out before clearing the host.
  var mfr = document.getElementById('rcl-manufacturer-standings');
  if (mfr && host.contains(mfr)) host.parentNode.insertBefore(mfr, host.nextSibling);
  host.innerHTML = '';
  if (!page || !page.hasSeason) return;
  // No standings boards until a round has results (Matt, 2026-10-20). Until then each class shows its
  // DRIVER LIST instead (Matt, 2026-10-22).
  if (!(page.roundsCompleted > 0)) { _rccRenderDriverLists(page, host); return; }
  var classes = _rccSortClasses((page.standings.drivers || []).map(function (c) { return c.className; }), function (c) { return c; });
  classes.forEach(function (className) {
    // Above each class board: Manufacturers' Standings (Hypercar) or Team Endurance Trophy (others).
    if (className === 'Hypercar') { if (mfr) host.appendChild(mfr); }
    else { var trophy = _rccTeamTrophy(page, className); if (trophy) host.appendChild(trophy); }
    var row = _rccEl('div', 'rcl-row-full');
    var panel = _rccEl('section', 'rcl-panel');
    var headEl = _rccEl('div', 'rcl-panel-head');
    // Titles stay the same when the season ends, no "Final" (Matt, 2026-10-13).
    headEl.appendChild(_rccText('div', 'rcl-panel-title', className + ' Standings'));
    var body = _rccEl('div', 'rcl-panel-body');
    // Drivers board only. The Teams board and its Drivers/Teams switch were replaced by the Team
    // Endurance Trophy section above the board (Matt, 2026-10-13).
    body.appendChild(_rccStandingsBoard(page, className, 'drivers'));
    panel.appendChild(headEl);
    panel.appendChild(body);
    row.appendChild(panel);
    host.appendChild(row);
  });
}

// TEAM ENDURANCE STANDINGS (Matt, 2026-10-13): every class except Hypercar. Bare on the page like
// Manufacturers' Standings: the top 3 as a podium (P2 / P1 / P3, car picture up to 200x60, rank,
// team name and number, points), then 4th onward in a 2-column list (rank, car picture up to
// 175x60, team name and number, points). Your team is in red. Hidden until the class has points.
function _rccTeamTrophy(page, className) {
  if (!page || !page.hasSeason || !(page.roundsCompleted > 0)) return null;
  var cls = (page.standings.teams || []).filter(function (c) { return c.className === className; })[0];
  var list = cls ? (cls.standings || []) : [];
  if (!list.length || !list.some(function (t) { return Number(t.championshipPoints) > 0; })) return null;
  var sd = page.seasonDetails || {};
  var year = (sd.classSeasons || {})[className] || sd.seasonYear || '';
  var box = _rccEl('div', 'rcl-row-full rcc-team-trophy');
  box.appendChild(_rccText('div', 'rcl-mfr-title', 'Team Endurance Standings'));
  box.appendChild(_rccText('div', 'rcl-mfr-subtitle', className + ' Class'));
  var ptsText = function (t) { return String(t.championshipPoints) + (Number(t.championshipPoints) === 1 ? ' PT' : ' PTS'); };
  var carSlot = function (t, cls) {
    var slot = _rccEl('span', cls);
    if (year && t.carNumber) {
      var img = document.createElement('img');
      img.className = 'rcc-tt-car';
      img.alt = '';
      img.loading = 'lazy';
      _rccCarImg(img, year, t.carNumber, sd.series, function () { img.remove(); });
      slot.appendChild(img);
    }
    return slot;
  };
  var nameEl = function (t, cls) {
    var name = _rccEl('span', cls);
    name.appendChild(_rccText('span', null, String(t.teamName || '').toUpperCase()));
    if (t.carNumber) name.appendChild(_rccText('span', 'rcc-tt-num', ' #' + t.carNumber));
    name.title = (t.teamName || '') + (t.carNumber ? ' #' + t.carNumber : '');
    return name;
  };
  // Top 3: P2 / P1 / P3 like the Manufacturers' podium, without the boxes.
  var top3 = list.slice(0, 3);
  var podium = _rccEl('div', 'rcl-mfr-podium rcc-tt-podium');
  (top3.length === 3 ? [1, 0, 2] : top3.map(function (_, i) { return i; })).forEach(function (idx) {
    var t = top3[idx];
    var tile = _rccEl('div', 'rcl-mfr-tile rcl-mfr-tile-p' + (idx + 1) + ' rcc-tt-tile' + (t.isPlayer ? ' rcc-tt-me' : ''));
    tile.appendChild(carSlot(t, 'rcc-tt-podium-car'));
    var rl = _rccEl('div', 'rcl-mfr-tile-rankline');
    rl.appendChild(_rccText('span', 'rcl-mfr-tile-rank', String(idx + 1)));
    tile.appendChild(rl);
    tile.appendChild(nameEl(t, 'rcl-mfr-tile-name rcc-tt-tile-name'));
    tile.appendChild(_rccText('div', 'rcl-mfr-tile-points', ptsText(t)));
    podium.appendChild(tile);
  });
  box.appendChild(podium);
  var rest = list.slice(3);
  if (rest.length) {
    var grid = _rccEl('div', 'rcc-tt-list');
    grid.style.setProperty('--rcc-tt-rows', String(Math.ceil(rest.length / 2)));
    rest.forEach(function (t, i) {
      var r = _rccEl('div', 'rcc-tt-item' + (t.isPlayer ? ' rcc-tt-me' : ''));
      r.appendChild(_rccText('span', 'rcc-tt-rank', (i + 4) + '.'));
      r.appendChild(carSlot(t, 'rcc-tt-car-slot'));
      r.appendChild(nameEl(t, 'rcc-tt-name'));
      r.appendChild(_rccText('span', 'rcc-tt-pts', ptsText(t)));
      grid.appendChild(r);
    });
    box.appendChild(grid);
  }
  return box;
}

function rccRenderManufacturers(page) {
  var body = document.getElementById('rcl-manufacturer-standings');
  body.innerHTML = '';
  var list = (page && page.hasSeason && page.roundsCompleted > 0) ? (page.standings.manufacturers || []) : [];
  if (!list.length || !list.some(function (m) { return m.points > 0; })) { body.style.display = 'none'; return; }
  body.style.display = '';
  body.appendChild(_rccText('div', 'rcl-mfr-title', "Manufacturers' Standings"));
  body.appendChild(_rccText('div', 'rcl-mfr-subtitle', 'Hypercar Class · Factory Entries'));
  // The player's manufacturer (only when they drive a factory Hypercar): name in blue-gray and bold (Matt, 2026-10-25).
  var mine = (page.grid || []).filter(function (g) { return g.isMine; })[0];
  var myMfr = (mine && mine.carClass === 'Hypercar' && mine.factory) ? String(mine.manufacturer || '').toUpperCase() : '';
  var top3 = list.slice(0, 3);
  var podium = _rccEl('div', 'rcl-mfr-podium');
  var order = top3.length === 3 ? [1, 0, 2] : top3.map(function (_, i) { return i; });
  order.forEach(function (idx) {
    var m = top3[idx];
    var tile = _rccEl('div', 'rcl-mfr-tile rcl-mfr-tile-p' + (idx + 1));
    var box = _rccEl('div', 'rcl-mfr-tile-box');
    var inner = _rccEl('div', 'rcl-mfr-tile-box-inner');
    inner.appendChild(_rccLogo('rcl-mfr-tile-logo', m.manufacturer));
    box.appendChild(inner);
    tile.appendChild(box);
    var rl = _rccEl('div', 'rcl-mfr-tile-rankline');
    rl.appendChild(_rccText('span', 'rcl-mfr-tile-rank', String(idx + 1)));
    tile.appendChild(rl);
    tile.appendChild(_rccText('div', 'rcl-mfr-tile-name' + (myMfr && m.manufacturer.toUpperCase() === myMfr ? ' rcc-mfr-me' : ''), m.manufacturer.toUpperCase()));
    tile.appendChild(_rccText('div', 'rcl-mfr-tile-points', Math.round(m.points) + ' PTS'));
    podium.appendChild(tile);
  });
  body.appendChild(podium);
  var rest = list.slice(3);
  if (rest.length) {
    var restList = _rccEl('div', 'rcl-mfr-rest');
    restList.style.setProperty('--rcl-mfr-rest-rows', String(Math.ceil(rest.length / 2)));
    rest.forEach(function (m, i) {
      var r = _rccEl('div', 'rcl-mfr-rest-item');
      r.appendChild(_rccText('span', 'rcl-mfr-rest-rank', (i + 4) + '.'));
      // Small black logo (46x20 box, league.css); the box stays empty if a logo is missing so names line up.
      var logoSlot = _rccEl('span', 'rcl-mfr-rest-logo-slot');
      logoSlot.appendChild(_rccLogo('rcl-mfr-rest-logo', m.manufacturer));
      r.appendChild(logoSlot);
      r.appendChild(_rccText('span', 'rcl-mfr-rest-name' + (myMfr && m.manufacturer.toUpperCase() === myMfr ? ' rcc-mfr-me' : ''), m.manufacturer.toUpperCase()));
      r.appendChild(_rccText('span', 'rcl-mfr-rest-pts', Math.round(m.points) + ' PTS'));
      restList.appendChild(r);
    });
    body.appendChild(restList);
  }
}

function _rccGap(row, ref) {
  if (!ref || row.finishTimeSeconds === null || ref.finishTimeSeconds === null) return '—';
  var down = (ref.laps || 0) - (row.laps || 0);
  if (down > 0) return '+' + down + ' Lap' + (down === 1 ? '' : 's');
  var g = row.finishTimeSeconds - ref.finishTimeSeconds;
  return g <= 0 ? '—' : '+' + g.toFixed(3);
}

// Race Details: what the results file says about the race (length, laps, failures, damage, fuel and
// tyre use, your assists, any laps the AI drove your car) next to what was planned for the round.
// Shown once, under the popup's dropdowns and above the first class header.
function _rccRaceDetails(details) {
  if (!details || (!(details.fromFile || []).length && !(details.planned || []).length)) return null;
  var box = _rccEl('div', 'rcc-race-details');
  box.appendChild(_rccText('div', 'rcl-race-class-name', 'Race Details'));
  var cols = _rccEl('div', 'rcc-race-details-cols');
  [['From The Race File', details.fromFile], ['Planned For This Round', details.planned]].forEach(function (pair) {
    if (!(pair[1] || []).length) return;
    var col = _rccEl('div', 'rcc-race-details-col');
    col.appendChild(_rccText('div', 'rcc-race-details-head', pair[0]));
    pair[1].forEach(function (x) {
      var val = x.label === 'Start' && x.value === 'Fast' ? 'Fast Rolling' : x.value;
      col.appendChild(_rccEl('div', 'rcl-seasonfmt-row', '<span class="rcl-seasonfmt-row-label">' + _rccEsc(x.label) + ':</span> <span class="rcl-seasonfmt-row-value">' + _rccEsc(val) + '</span>'));
    });
    cols.appendChild(col);
  });
  box.appendChild(cols);
  return box;
}

// The player's seat line, laid out like the Dashboard's Current Seat card (Matt), used in the page
// header and on the Driver Report: the car picture (hidden if missing), then DRIVER NAME (bold,
// black) and TEAM NAME #57 (normal weight, steel), then the maker logo in front of the car name.
// Uses the shared rc-cs-* styles from style.css so it stays identical to the Dashboard card.
// dr: the Driver Report's own team / number when it has them. links: name -> public profile,
// team -> Team Information (header only).
function _rccSeatLine(page, dr, links) {
  var reg = page.registration || {};
  dr = dr || {};
  return _rccSeatIdentity(page, {
    carNumber: dr.carNumber || reg.carNumber, carClass: dr.carClass || reg.carClass,
    teamName: dr.teamName || reg.teamName, manufacturer: reg.manufacturer, carModel: reg.carModel,
    // Header and Driver Report are identical (Matt, 2026-10-11): DRIVER NAME bold, linked to the
    // driver's career page (profile.html), then TEAM NAME #57 in normal weight steel, then the maker
    // logo, car name and class pill. In the header the team also opens Team Information.
    driverName: (page.owner && page.owner.displayName) || '',
    driverLink: true,
    teamLink: !!links,
    classPill: true
  });
}
// seat: { carNumber, carClass, teamName, manufacturer, carModel, driverName (null = team only, bold
// black), teamLink (team opens Team Information), classPill (class pill after the car name),
// tags (extra elements after the team name) }.
// 'Factory' / 'Privateer' for Hypercar entries, '' for every other class.
function _rccEntryType(carClass, factory) { return carClass === 'Hypercar' ? (factory ? 'Factory' : 'Privateer') : ''; }
function _rccSeatIdentity(page, seat) {
  var carNumber = String(seat.carNumber || '');
  var carYear = _rccClassYear(page, seat.carClass);
  var row = _rccEl('div', 'rc-cs-row rcc-seat-line');
  if ((carYear && carNumber) || seat.keepSlot) {
    var picWrap = _rccEl('div', 'rc-cs-logo-wrap');
    var pic = document.createElement('img');
    pic.className = 'rc-cs-logo';
    pic.alt = '';
    // A missing picture: Team Information keeps the empty box so the names line up; elsewhere the box goes.
    var noPic = function () { if (seat.keepSlot) pic.style.visibility = 'hidden'; else picWrap.style.display = 'none'; };
    if (carYear && carNumber) _rccCarImg(pic, carYear, carNumber, (page.seasonDetails || {}).series, noPic);
    else pic.style.visibility = 'hidden';
    picWrap.appendChild(pic);
    row.appendChild(picWrap);
  }
  var textCol = _rccEl('div', 'rc-cs-textcol');
  var nameLine = _rccEl('div', 'rc-cs-team-name rc-cs-team-name-flex rcr-who-name');
  var teamOnly = seat.driverName == null;
  if (!teamOnly) nameLine.appendChild(seat.driverLink ? _rccPlayerName('rcr-who-driver', seat.driverName) : _rccText('span', 'rcr-who-driver', seat.driverName));
  var teamText = (seat.teamName || '') + (carNumber ? ' #' + carNumber : '');
  if (teamText) {
    var team = _rccEl(seat.teamLink ? 'button' : 'span', (teamOnly ? 'rcr-who-driver' : 'rcr-who-team') + (seat.teamLink ? ' rcc-seat-line-team' : ''));
    team.textContent = teamText;
    if (seat.teamLink) { team.type = 'button'; team.title = 'Team Information'; team.addEventListener('click', rccOpenTeamInfo); }
    nameLine.appendChild(team);
  }
  // Hypercar entries: a light gray FACTORY / PRIVATEER pill after the number, class pill size (Matt).
  if (seat.entryType) nameLine.appendChild(_rccText('span', 'rc-badge-chip rc-badge-chip-abbrev rcc-badge-entry', seat.entryType.toUpperCase()));
  (seat.tags || []).forEach(function (t) { nameLine.appendChild(t); });
  textCol.appendChild(nameLine);
  if (seat.manufacturer || seat.carModel || seat.classPill) {
    var carLine = _rccEl('div', 'rc-cs-car-line rc-cs-car-line-flex');
    if (seat.manufacturer) carLine.appendChild(_rccLogo('rc-cs-maker-logo', seat.manufacturer));
    if (seat.carModel) carLine.appendChild(_rccText('span', null, seat.carModel));
    if (seat.classPill && seat.carClass) carLine.appendChild(_rccClassPill(seat.carClass));
    textCol.appendChild(carLine);
  }
  row.appendChild(textCol);
  return row;
}

// Driver Report and Race Details each have their own page in the Race Recap dropdown (Matt).
function _rccDriverReportBody(result, el) {
  el.innerHTML = '';
  var drEl = result && result.driverReport && typeof _rccDriverReport === 'function' ? _rccDriverReport(result.driverReport) : null;
  if (!drEl) { el.appendChild(_rccEmpty('No Data To Display', 'The Driver Report appears once this round\u2019s race results are uploaded.')); return; }
  var who = _rccSeatLine(RCC.page || {}, result.driverReport || {}, false);
  who.classList.add('rcr-report-who');
  // Bordered card around the whole report, like the League Hub's (.rcl-dr-light).
  var card = _rccEl('div', 'rcr-card');
  card.appendChild(who);
  card.appendChild(drEl);
  el.appendChild(card);
}
function _rccRaceDetailsBody(result, el) {
  el.innerHTML = '';
  var det = result ? _rccRaceDetails(result.raceDetails) : null;
  if (!det) { el.appendChild(_rccEmpty('No Data To Display', 'No race details for this round yet.')); return; }
  el.appendChild(det);
}

// The DRIVER REPORT card button opens the Race Recap popup on its Driver Report page (Matt).

function _rccRaceBody(result, el) {
  el.innerHTML = '';
  if (!result || !(result.classes || []).length) { el.appendChild(_rccEmpty('No Data To Display', 'No race result imported for this round.')); return; }
  result.classes.forEach(function (cls, ci) {
    var w = _rccEl('div', 'rcl-race-class');
    w.appendChild(_rccRecapHeader(cls.className + ' Results', result));
    // Icons next to the names and a key under the board replace the Winner / Most Laps Led / Pole /
    // Fastest Lap list (Matt, 2026-10-13). No winner icon: P1 already says it.
    var awards = [];
    if (cls.classMostLapsLedCount && cls.classMostLapsLedCarNumber) awards.push({ icon: _RCC_ICON_LAPS_LED, label: 'Most Laps Led', num: String(cls.classMostLapsLedCarNumber), who: cls.classMostLapsLedDriver });
    if (cls.classPoleSitter) awards.push({ icon: _RCC_ICON_POLE, label: 'Pole Position', num: String(cls.classPoleSitterCarNumber || ''), who: cls.classPoleSitter });
    if (cls.classFastestLapDriver) awards.push({ icon: _RCC_ICON_STOPWATCH, label: 'Fastest Lap', num: String(cls.classFastestLapCarNumber || ''), who: cls.classFastestLapDriver });
    var head = _rccEl('div', 'rcl-race-col-head rcl-race-grid-recap');
    ['Pos', 'Manu', 'N<sup class="rcc-board-num-deg">&deg;</sup>', 'Driver', 'Laps', 'Total Time', 'Interval', 'Gap', 'Avg (KM/H)', 'Best Lap', 'Pts'].forEach(function (t) { head.appendChild(_rccEl('div', null, t)); });
    w.appendChild(head);
    var rows = cls.standings || [];
    var leader = rows[0] || null;
    rows.forEach(function (row, idx) {
      var dnf = /dnf/i.test(row.finishStatus || '');
      var r = _rccEl('div', 'rcl-race-row rcl-race-grid-recap' + (RCC_METAL[idx] ? ' ' + RCC_METAL[idx] : '') + (row.isPlayer ? ' rcc-row-me' : ''));
      r.appendChild(_rccPosBadge(idx, dnf ? 'DNF' : undefined));
      // Same cells as the Standings board: maker logo | N° | driver name (no team name).
      var recapCells = _rccBoardCells(row, row.name, 'drivers');
      if (dnf) { recapCells[1].classList.add('rcc-recap-dnf'); recapCells[2].classList.add('rcl-standings-identity-dnf'); }
      var mine = awards.filter(function (a) { return a.num ? a.num === String(row.carNumber) : a.who === row.name; });
      if (mine.length) {
        var ic = _rccEl('span', 'rcc-recap-icons');
        mine.forEach(function (a) { var i = _rccEl('span', 'rcc-recap-icon', a.icon); i.title = a.label; i.setAttribute('aria-label', a.label); ic.appendChild(i); });
        recapCells[2].appendChild(ic);
      }
      recapCells.forEach(function (cell) { r.appendChild(cell); });
      r.appendChild(_rccText('div', 'rcl-race-row-num', String(row.laps || 0)));
      r.appendChild(_rccText('div', 'rcl-race-row-num', _rccTotalTime(row.finishTimeSeconds)));
      r.appendChild(_rccText('div', 'rcl-race-row-gap', idx === 0 ? '—' : _rccGap(row, rows[idx - 1])));
      r.appendChild(_rccText('div', 'rcl-race-row-gap', idx === 0 ? 'Leader' : _rccGap(row, leader)));
      var kmh = '—';
      if (result.trackLengthMeters && row.laps && row.finishTimeSeconds > 0) kmh = ((result.trackLengthMeters * row.laps / 1000) / (row.finishTimeSeconds / 3600)).toFixed(1);
      r.appendChild(_rccText('div', 'rcl-race-row-avg', kmh));
      r.appendChild(_rccText('div', 'rcl-race-row-bestlap', _rccLapTime(row.bestLapTime)));
      r.appendChild(_rccText('div', 'rcl-race-row-pts', row.points === null || row.points === undefined ? '—' : '+' + row.points));
      w.appendChild(r);
    });
    if (awards.length) {
      var key = _rccEl('div', 'rcc-recap-key');
      awards.forEach(function (a) {
        var k = _rccEl('span', 'rcc-recap-key-item');
        k.appendChild(_rccEl('span', 'rcc-recap-icon', a.icon));
        k.appendChild(_rccText('span', null, a.label));
        key.appendChild(k);
      });
      w.appendChild(key);
    }
    el.appendChild(w);
  });

  // (The Race Report has its own page in the recap since 2026-10-20: _rccRaceReportBody.)
}

// Race Recap > Race Report: every lap's events for the whole field, on its own page with the recap
// header and no red "Race Report" heading (Matt, 2026-10-20).
function _rccRaceReportBody(result, el) {
  el.innerHTML = '';
  if (!result || !(result.raceReport || []).length) { el.appendChild(_rccEmpty('No Data To Display', 'No race report for this round yet.')); return; }
  var playerName = null;
  (result.classes || []).forEach(function (cls) { (cls.standings || []).forEach(function (r) { if (r.isPlayer) playerName = r.name; }); });
  el.appendChild(_rccRecapHeader('Race Report', result));
  var report = result.raceReport || [];
  if (report.length) {
    var sec = _rccEl('div', 'rcl-report-section');
    var byLap = {}, order = [];
    report.forEach(function (en) { if (!byLap[en.lapNum]) { byLap[en.lapNum] = []; order.push(en.lapNum); } byLap[en.lapNum].push(en); });
    var CLAUSE = { wall: 'rcl-report-clause-wall', car: 'rcl-report-clause-car', damage: 'rcl-report-clause-damage', pit: 'rcl-report-clause-pit', position_gain: 'rcl-report-clause-gain', position_loss: 'rcl-report-clause-loss', retirement: 'rcl-report-clause-retirement', fastest_lap: 'rcl-report-clause-fastest' };
    order.forEach(function (lapNum) {
      var lapRow = _rccEl('div', 'rcl-report-lap');
      lapRow.appendChild(_rccText('div', 'rcl-report-lap-num', 'Lap ' + lapNum));
      var tw = _rccEl('div', 'rcl-report-lap-text');
      byLap[lapNum].forEach(function (en) {
        var line = _rccEl('p', 'rcl-report-line');
        if (en.clauses) {
          if (en.carClass) { var pc = _rccEl('span', 'rcl-report-pill-col'); pc.appendChild(_rccClassPill(en.carClass)); line.appendChild(pc); }
          // Race time from the green flag (the report stores session time, which includes the
          // formation lap and the start).
          if (en.et !== null && en.et !== undefined) line.appendChild(_rccText('span', 'rcl-report-timestamp', _rccEventTime(en.et - (result.greenFlagEt || 0))));
          // Every name in normal weight except yours (Matt).
          line.appendChild(_rccText('span', 'rcl-report-name' + (playerName && en.name === playerName ? ' rcc-report-me' : ''), en.name));
          var all = en.positionClause ? en.clauses.concat([en.positionClause]) : en.clauses;
          all.forEach(function (c, i) {
            line.appendChild(document.createTextNode(i === 0 ? ' ' : ', '));
            // Every event is gray except position changes and fastest lap (Matt, 2026-10-13; this
            // replaces the bold red penalty of 2026-10-11).
            var cc = CLAUSE[c.kind] || (c.kind ? 'rcl-report-clause-' + c.kind : null);
            line.appendChild(_rccText('span', cc, c.text));
          });
          line.appendChild(document.createTextNode('.'));
        } else {
          line.textContent = en.text;
        }
        tw.appendChild(line);
      });
      lapRow.appendChild(tw);
      sec.appendChild(lapRow);
    });
    el.appendChild(sec);
  }
}

function _rccQualifyingBody(result, el) {
  el.innerHTML = '';
  if (!result || !result.hasQualifying || !(result.classes || []).length) { el.appendChild(_rccEmpty('No Qualifying Data', 'No qualifying session was imported for this round.')); return; }
  result.classes.forEach(function (cls) {
    var w = _rccEl('div', 'rcl-race-class');
    w.appendChild(_rccRecapHeader(cls.className + ' Qualifying Results', result));
    var head = _rccEl('div', 'rcl-race-col-head rcl-race-grid-recap rcl-race-grid-recap-q');
    ['Pos', 'Manu', 'N<sup class="rcc-board-num-deg">&deg;</sup>', 'Driver', 'Best Lap', 'Sector 1', 'Sector 2', 'Sector 3', 'Avg (KM/H)'].forEach(function (t) { head.appendChild(_rccEl('div', null, t)); });
    w.appendChild(head);
    (cls.standings || []).forEach(function (row, idx) {
      var r = _rccEl('div', 'rcl-race-row rcl-race-grid-recap rcl-race-grid-recap-q' + (RCC_METAL[idx] ? ' ' + RCC_METAL[idx] : '') + (row.isPlayer ? ' rcc-row-me' : ''));
      r.appendChild(_rccPosBadge(idx));
      _rccBoardCells(row, row.name, 'drivers').forEach(function (cell) { r.appendChild(cell); });
      r.appendChild(_rccText('div', 'rcl-race-row-bestlap', _rccLapTime(row.bestLapTime)));
      r.appendChild(_rccText('div', 'rcl-race-row-num', _rccLapTime(row.sector1)));
      r.appendChild(_rccText('div', 'rcl-race-row-num', _rccLapTime(row.sector2)));
      r.appendChild(_rccText('div', 'rcl-race-row-num', _rccLapTime(row.sector3)));
      r.appendChild(_rccText('div', 'rcl-race-row-avg', row.avgKmh !== null && row.avgKmh !== undefined ? String(row.avgKmh) : '—'));
      w.appendChild(r);
    });
    el.appendChild(w);
  });
}

function _rccMyLapsBody(result, el) {
  el.innerHTML = '';
  var sessions = (result && result.sessions) || [];
  if (!sessions.length) { el.appendChild(_rccEmpty('No Data To Display', 'None of your laps were imported for this round.')); return; }
  sessions.forEach(function (s) {
    var w = _rccEl('div', 'rcl-race-class');
    // Same recap header as every other page (Matt, 2026-10-20); the session's numbers move to a line under it.
    w.appendChild(_rccRecapHeader(s.kind === 'race' ? 'My Race Laps' : 'My Qualifying Laps', result));
    var sum = 'P' + (s.classPosition || '—') + ' in class · Best ' + _rccLapTime(s.bestLapTime) + (s.kind === 'race' ? ' · ' + s.pitstops + ' stop' + (s.pitstops === 1 ? '' : 's') : '');
    w.appendChild(_rccText('div', 'rcc-laps-summary', sum));
    var table = _rccEl('div', 'rcc-laps-table');
    var head = _rccEl('div', 'rcc-laps-row rcc-laps-head');
    ['Lap', 'Pos', 'Lap Time', 'S1', 'S2', 'S3', 'Top Speed', 'Fuel', 'Tyres (FL FR RL RR)', 'Compound'].forEach(function (t) { head.appendChild(_rccText('div', null, t)); });
    table.appendChild(head);
    var best = Infinity;
    s.laps.forEach(function (l) { var t = Number(l.lapTime); if (t > 0 && t < best) best = t; });
    // Fastest lap time bold purple (Matt, 2026-10-20; the sector purples were taken back out the same day).
    s.laps.forEach(function (l) {
      var r = _rccEl('div', 'rcc-laps-row' + (Number(l.lapTime) === best ? ' rcc-laps-best' : '') + (l.pit ? ' rcc-laps-pit' : ''));
      r.appendChild(_rccText('div', null, String(l.lapNum) + (l.pit ? ' PIT' : '')));
      r.appendChild(_rccText('div', null, l.positionAtLap ? 'P' + l.positionAtLap : '—'));
      r.appendChild(_rccText('div', Number(l.lapTime) === best ? 'rcc-laps-fastest' : null, _rccLapTime(l.lapTime)));
      r.appendChild(_rccText('div', null, _rccLapTime(l.sector1)));
      r.appendChild(_rccText('div', null, _rccLapTime(l.sector2)));
      r.appendChild(_rccText('div', null, _rccLapTime(l.sector3)));
      r.appendChild(_rccText('div', null, l.topSpeed ? Number(l.topSpeed).toFixed(1) : '—'));
      r.appendChild(_rccText('div', null, l.fuel !== '' ? Math.round(Number(l.fuel) * 100) + '%' : '—'));
      var tw = [l.tireWearFL, l.tireWearFR, l.tireWearRL, l.tireWearRR].map(function (v) { return v === '' ? '—' : Math.round(Number(v) * 100); }).join(' ');
      r.appendChild(_rccText('div', null, tw));
      r.appendChild(_rccText('div', null, String(l.frontCompound || '').replace(/^\d+,/, '')));
      table.appendChild(r);
    });
    w.appendChild(table);
    if ((s.events || []).length) {
      var evs = _rccEl('div', 'rcc-laps-events');
      // MY EVENTS recap header in place of the red "Your Events" (Matt, 2026-10-20). It sits straight in the
      // class block so on phones it stays the popup's width like the other bars.
      var evHead = _rccRecapHeader('My Events', result);
      evHead.classList.add('rcc-laps-events-head');
      w.appendChild(evHead);
      s.events.forEach(function (ev) {
        var line = _rccEl('p', 'rcl-report-line');
        var et = Number(ev.elapsedTime);
        if (!isNaN(et)) line.appendChild(_rccText('span', 'rcl-report-timestamp', _rccEventTime(et - (s.greenFlagEt || 0))));
        line.appendChild(document.createTextNode(' ' + _rccMyEventText(ev)));
        evs.appendChild(line);
      });
      w.appendChild(evs);
    }
    el.appendChild(w);
  });
}

// Your Events wording (Matt, 2026-10-13): penalties and track limits in plain words; everything else
// is the game's own text.
function _rccMyEventText(ev) {
  var d = ev.detail || {};
  var who = d.DriverName || '';
  var pen = d.PenaltyType || 'a';
  if (ev.eventType === 'SimPenaltyIssued') return (who + ' received ' + pen + ' penalty').trim();
  if (ev.eventType === 'SimPenaltyServed') {
    var lost = ev.lostSeconds;
    return (who + ' served ' + pen + ' penalty' + (lost !== null && lost !== undefined ? ' and lost ' + lost + (lost === 1 ? ' second' : ' seconds') : '')).trim();
  }
  if (ev.eventType === 'TrackLimit') {
    var pts = Number(d.WarningPoints);
    if (pts > 0) return 'Track Limit Warning: ' + pts + ' track cut penalty issued.';
    var outcome = String(d.Outcome || ev.rawText || 'No Further Action').trim();
    return 'Track Limit Warning: ' + outcome.replace(/\.$/, '') + '.';
  }
  return ev.rawText || ev.eventType;
}

function rccOpenResults(roundId, kind) {
  var page = RCC.page;
  var rounds = page.importedRounds || [];
  var m = rccOpenModal('Race Recap', { wide: true });
  m.dialog.classList.add('rcl-modal-dialog-allresults');
  if (!rounds.length) { m.body.appendChild(_rccEmpty('No Data To Display', 'No results have been imported yet.')); return; }
  var row = _rccEl('div', 'rcl-allresults-select-row');
  var sel = document.createElement('select');
  sel.className = 'rcl-allresults-select';
  rounds.forEach(function (r) { sel.appendChild(new Option('Round ' + r.roundNum + ' - ' + r.eventName + (r.track ? ': ' + r.track : ''), r.roundId)); });
  var kindSel = document.createElement('select');
  kindSel.className = 'rcl-allresults-session-select';
  // Highlights first in the list (Matt, 2026-10-19); the recap still opens on Race unless asked otherwise.
  // Race Details first, above Highlights (Matt, 2026-10-26).
  kindSel.appendChild(new Option('Race Details', 'details'));
  kindSel.appendChild(new Option('Highlights', 'highlights'));
  kindSel.appendChild(new Option('Race Results', 'race'));
  kindSel.appendChild(new Option('Qualifying Results', 'qualifying'));
  kindSel.appendChild(new Option('Driver Report', 'driver'));
  kindSel.appendChild(new Option('Race Report', 'report'));
  kindSel.appendChild(new Option('My Laps', 'mylaps'));
  row.appendChild(sel);
  row.appendChild(kindSel);
  m.body.appendChild(row);
  var out = _rccEl('div', 'rcl-allresults-body');
  m.body.appendChild(out);
  var cache = {};
  // Both dropdowns are locked while a page of the recap is loading, so nothing can be picked until
  // its data is on screen (Matt).
  function busy(on) { sel.disabled = on; kindSel.disabled = on; }
  function load() {
    // Highlights, Driver Report and Race Details come from the same race result as the Race page.
    var apiKind = ['driver', 'details', 'highlights', 'report'].indexOf(kindSel.value) !== -1 ? 'race' : kindSel.value;
    var key = sel.value + ':' + apiKind;
    var builder = { qualifying: _rccQualifyingBody, mylaps: _rccMyLapsBody, driver: _rccDriverReportBody, details: _rccRaceDetailsBody, highlights: _rccHighlightsBody, report: _rccRaceReportBody }[kindSel.value] || _rccRaceBody;
    if (cache[key]) { builder(cache[key], out); return; }
    out.innerHTML = '';
    out.appendChild(_rccSpinner('Loading results...'));
    busy(true);
    _rccApi('champGetRoundResults', { roundId: sel.value, kind: apiKind }).then(function (res) {
      busy(false);
      if (_rccHandleAuthError(res)) return;
      var result = res && res.success ? res.result : null;
      if (result) cache[key] = result;
      builder(result, out);
    }).catch(function () {
      busy(false);
      out.innerHTML = '';
      out.appendChild(_rccEmpty('Could Not Load', 'Could not reach the server. Close this popup and try again.'));
    });
  }
  sel.value = rounds.some(function (r) { return r.roundId === roundId; }) ? roundId : rounds[0].roundId;
  kindSel.value = kind || 'race';
  sel.addEventListener('change', load);
  kindSel.addEventListener('change', load);
  load();
}

// ---------------------------------------------------------------------
// TEAM INFORMATION -- the whole grid with crews
// ---------------------------------------------------------------------
function rccOpenTeamInfo() {
  var page = RCC.page;
  var m = rccOpenModal('Team Information', { wide: true });
  var grid = page.grid || [];
  // Your Team: the same seat line as the page header and the Dashboard's Current Seat card, with
  // the class pill after the car name (Matt).
  if (page.registration) {
    var reg = page.registration;
    var mine = _rccEl('div', 'rcc-myteam');
    mine.appendChild(_rccText('div', 'rcc-myteam-label', 'Your Team'));
    mine.appendChild(_rccSeatIdentity(page, { carNumber: reg.carNumber, carClass: reg.carClass, teamName: reg.teamName, manufacturer: reg.manufacturer, carModel: reg.carModel, driverName: null, classPill: true, keepSlot: true, entryType: _rccEntryType(reg.carClass, (grid.filter(function (g) { return g.isMine; })[0] || {}).factory) }));
    if (reg.teamDesc) mine.appendChild(_rccText('p', 'rcc-myteam-desc', reg.teamDesc));
    m.body.appendChild(mine);
  }
  var classes = [];
  grid.forEach(function (g) { if (classes.indexOf(g.carClass) === -1) classes.push(g.carClass); });
  _rccSortClasses(classes, function (c) { return c; }).forEach(function (cls) {
    var w = _rccEl('div', 'rcl-race-class');
    w.appendChild(_rccText('div', 'rcl-standings-class-header', cls.toUpperCase() + ' GRID'));
    grid.filter(function (g) { return g.carClass === cls; }).forEach(function (g) {
      // Every car in the same seat-line format as Your Team (Matt), driver line underneath.
      var r = _rccEl('div', 'rcc-grid-row' + (g.isMine ? ' rcc-row-me' : ''));
      var tags = [];
      if (g.isMine) tags.push(_rccText('span', 'rcc-tag rcc-tag-me', 'You'));
      var ident = _rccSeatIdentity(page, { carNumber: g.carNumber, carClass: g.carClass, teamName: g.teamName, manufacturer: g.manufacturer, carModel: g.carModel, driverName: null, keepSlot: true, entryType: _rccEntryType(g.carClass, g.factory), tags: tags });
      ident.querySelector('.rc-cs-textcol').appendChild(_rccText('div', 'rcc-grid-crew', g.crew.length ? (g.crew.length === 1 ? 'Driver: ' : 'Drivers: ') + g.crew.join(', ') : 'The driver appears after their first race in the current season.'));
      r.appendChild(ident);
      w.appendChild(r);
    });
    m.body.appendChild(w);
  });
}

// ---------------------------------------------------------------------
// REGISTRATION -- the car picker, signing sequence and season notice are js/car-picker.js, the same code the League's
// "Register for Season" uses. This only supplies the Championship's data and its save.
// ---------------------------------------------------------------------
function rccOpenRegistration() {
  var page = RCC.page;
  rcOpenCarPicker({
    mode: 'championship',
    openModal: function (title, opts) {
      opts = opts || {};
      var m = rccOpenModal(title, { wide: !!opts.wide, onClose: opts.onClose });
      m.dialog.classList.add('rcc-light-dialog');
      return {
        body: m.body,
        close: m.close,
        setTitle: m.setTitle,
        hideClose: function () { var x = m.dialog.querySelector('.rcl-modal-close'); if (x) x.style.display = 'none'; }
      };
    },
    // The season's grid is already on the page, so there is nothing to fetch.
    loadTeams: function (carClass) {
      var teams = (page.grid || []).filter(function (g) { return !carClass || g.carClass === carClass; });
      return Promise.resolve({ success: true, teams: teams });
    },
    carImage: function (team) { return { year: _rccClassYear(page, team.carClass), series: (page.seasonDetails || {}).series }; },
    join: function (team) { return _rccApi('champJoinTeam', { seasonId: page.seasonId, teamId: team.teamId }, { post: true }); },
    onAuthError: _rccHandleAuthError,
    reload: rccReloadAfterSave,
    toast: _rccToast
  });
}

// DROP OUT of the season's seat (before the first result is imported): same wording as the League's popup.
function rccOpenDropOut() {
  var page = RCC.page;
  var reg = page.registration || {};
  var seat = [reg.teamName, reg.carNumber ? '#' + reg.carNumber : ''].filter(Boolean).join(' ');
  rccConfirm('Forfeit Your Seat?',
    'You are about to drop out and give up your seat' + (seat ? ' with ' + seat : '') + '. By dropping out you forfeit that seat and it goes back on the grid for another driver to take. You can choose a team again whenever you like.',
    'Drop Out', 'Dropping Out...',
    function () { return _rccApi('champDropOut', { seasonId: page.seasonId }, { post: true }); },
    function () { _rccToast('You have dropped out and your seat is free.', 'success'); rccReloadAfterSave(); });
}

// ---------------------------------------------------------------------
// SEASON WIZARD -- Create / Edit (one popup, all sections on one scrolling form)
// ---------------------------------------------------------------------
// Stored values stay Off / Realistic / 2x / 3x; the screen shows what LMU shows (Matt, 2026-11-06).
var RCC_MULTIPLIERS = [{ label: 'OFF', value: 'Off' }, { label: 'REAL', value: 'Realistic' }, { label: 'X2', value: '2x' }, { label: 'X3', value: '3x' }];
function _rccMultLabel(v) {
  var m = { off: 'OFF', realistic: 'REAL', real: 'REAL' };
  var k = String(v).toLowerCase();
  if (m[k]) return m[k];
  return /^\d+x$/i.test(String(v)) ? String(v).toUpperCase() : String(v);
}
function _rccTimeScaleLabel(v) { return /^x\d+$/i.test(String(v)) ? String(v).toUpperCase() : String(v); }
var RCC_SERIES = ['WEC', 'ELMS'];
var RCC_DAMAGE = ['Off', 'Low', 'Medium', 'High', 'Realistic'];
var RCC_TRACK_LIMITS = ['None', 'Relaxed', 'Default', 'Strict'];
// A car's series from the Cars tab's Series column; blank means WEC (every car before ELMS was added).
function _rccCarSeries(car) { var v = String((car && car.Series) || '').trim().toUpperCase(); return v === 'ELMS' ? 'ELMS' : 'WEC'; }
// A Cars row's class, with an _ELMS ending dropped (LMP2_ELMS -> LMP2), same rule as Championship.gs's
// _champClassKey_ (Matt, 2026-10-22).
var RCC_CLASS_ALIASES = { Hyper: 'Hypercar', HYPER: 'Hypercar', GT3: 'LMGT3', GTE: 'LMGTE' };
function _rccClassKey(raw) { var k = String(raw || '').trim().replace(/_ELMS$/i, ''); return RCC_CLASS_ALIASES[k] || k; }
// LMU's four weather presets (Matt, 2026-10-09); the results file records no weather, so a round
// only keeps which preset was planned.
var RCC_WEATHER_PRESETS = ['Sunny', 'Cloudy', 'Rainy', 'Real World'];
// LMU Advanced > Time Scale, and Sessions > RealRoad Time Scale (default Normal on both).
var RCC_TIME_SCALES = ['None', 'Normal'];  // plus X2..X60 below
for (var _rccT = 2; _rccT <= 60; _rccT++) RCC_TIME_SCALES.push({ label: 'X' + _rccT, value: 'x' + _rccT });
RCC_TIME_SCALES.push('Use Race %');
var RCC_REALROAD_SCALES = ['Normal'];
for (var _rccQ = 2; _rccQ <= 15; _rccQ++) RCC_REALROAD_SCALES.push(_rccQ + 'x');
RCC_REALROAD_SCALES.push('Session %', 'Static');

// AI skill names by percentage. These are Matt's original bands; the game's own labels are still to be
// confirmed by him (2026-11-06), so change them here when he does.
function _rccSkillLevel(pct) {
  pct = Number(pct);
  if (pct >= 101) return 'Expert';
  if (pct >= 91) return 'Pro';
  if (pct >= 81) return 'Intermediate';
  return 'Rookie';
}

function _rccDefaultDetails() {
  return {
    classes: { Hypercar: false, LMP2: false, LMP3: false, LMGT3: false, LMGTE: false },
    classSeasons: { Hypercar: '', LMP2: '', LMP3: '', LMGT3: '', LMGTE: '' },
    pointsTables: {
      Sprint: { duration: 45, points: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] },
      Medium: { duration: 60, points: [38, 27, 23, 18, 15, 12, 9, 6, 3, 2] },
      Long: { duration: 72, points: [50, 36, 30, 24, 20, 16, 12, 8, 4, 2] }
    },
    bonusPoints: { pole: 1, fastestLap: 1, mostLapsLed: 1 },
    dropWeeks: 0,
    trackLimitsPreset: 'Default',
    series: 'WEC',
    seasonYear: '',
    raceSettings: { aiDifficulty: 90, damage: 'Realistic', tireWearMultiplier: 'Realistic', tireWarmers: 'Off', tireCount: 8, fuelMultiplier: 'Realistic', timeScale: 'Normal', flagRules: 'Full', mechanicalFailures: 'Normal', aiAggression: 'Medium', trackLimitPoints: 5, raceStart: 'Rolling', realRoadTimeScale: 'Normal', qualifying: 'Yes' }
  };
}

function _rccField(label, input, hint) {
  var w = _rccEl('div', 'rcc-field');
  var l = _rccText('label', null, label);
  w.appendChild(l);
  w.appendChild(input);
  if (hint) w.appendChild(_rccText('div', 'rc-hint', hint));
  return w;
}
function _rccSelect(options, value, onChange) {
  var s = document.createElement('select');
  options.forEach(function (o) {
    var opt = typeof o === 'object' ? new Option(o.label, o.value) : new Option(String(o), String(o));
    s.appendChild(opt);
  });
  if (value !== undefined && value !== null) s.value = String(value);
  if (onChange) s.addEventListener('change', function () { onChange(s.value); });
  return s;
}
// Race lengths (Matt, 2026-10-17): Create Season offers these minutes, shown as "45m", "1h", "1h 12m".
var RCC_RACE_LENGTHS = [15, 20, 30, 45, 60, 72, 90, 120, 144, 180, 240, 360, 480, 600, 720, 1440];
function _rccDur(min) {
  var n = Math.round(Number(min) || 0);
  if (n < 60) return n + 'm';
  var h = Math.floor(n / 60), m = n % 60;
  return h + 'h' + (m ? ' ' + m + 'm' : '');
}

function _rccNumber(value, onChange, min, max) {
  var i = document.createElement('input');
  i.type = 'number';
  if (min !== undefined) i.min = String(min);
  if (max !== undefined) i.max = String(max);
  i.value = value === null || value === undefined ? '' : String(value);
  i.addEventListener('input', function () { onChange(i.value === '' ? '' : Number(i.value)); });
  return i;
}
function _rccTextInput(value, onChange, maxLen) {
  var i = document.createElement('input');
  i.type = 'text';
  if (maxLen) i.maxLength = maxLen;
  i.value = value || '';
  i.addEventListener('input', function () { onChange(i.value); });
  return i;
}
function _rccSection(title) {
  var s = _rccEl('div', 'rcc-wiz-section');
  s.appendChild(_rccText('div', 'rcc-wiz-section-title', title));
  return s;
}

function rccOpenSeasonWizard(seasonId) {
  var editing = !!seasonId;
  var m = rccOpenModal(editing ? 'Edit Season' : 'Create Season', { wide: true });
  m.dialog.classList.add('rcc-light-dialog');
  m.body.appendChild(_rccSpinner('Loading tracks and cars...'));
  var loads = [
    fetchApi('getTracks', { token: RCC.token }),
    fetchApi('getCars', { token: RCC.token }),
    editing ? _rccApi('champGetSeasonForEdit', { seasonId: seasonId }) : Promise.resolve(null)
  ];
  Promise.all(loads).then(function (res) {
    if (res[2] && _rccHandleAuthError(res[2])) return;
    var tracks = ((res[0] && res[0].tracks) || []).filter(function (t) { return (t.Active || 'Active') !== 'Inactive'; });
    var cars = ((res[1] && res[1].cars) || []).filter(function (c) { return (c.Active || 'Active') !== 'Inactive'; });
    if (!tracks.length || !cars.length) {
      m.body.innerHTML = '';
      m.body.appendChild(_rccEmpty('Could Not Load', 'Could not load the track and car lists. Close this popup and try again.'));
      return;
    }
    _rccBuildWizard(m, tracks, cars, res[2]);
  }).catch(function () {
    m.body.innerHTML = '';
    m.body.appendChild(_rccEmpty('Could Not Load', 'Could not reach the server. Close this popup and try again.'));
  });
}

function _rccQualifyingSet(details) { return details && details.raceSettings && (details.raceSettings.qualifying === 'Yes' || details.raceSettings.qualifying === 'No'); }

function _rccBuildWizard(m, tracks, cars, edit) {
  var editing = !!edit;
  var details = editing ? JSON.parse(JSON.stringify(edit.seasonDetails || {})) : _rccDefaultDetails();
  var defaults = _rccDefaultDetails();
  ['classes', 'classSeasons', 'pointsTables', 'bonusPoints', 'raceSettings'].forEach(function (k) { if (!details[k]) details[k] = defaults[k]; });
  details.dropWeeks = 0;
  if (!details.trackLimitsPreset) details.trackLimitsPreset = 'Default';
  // Edit rules (Matt): once a season exists, its series, year, classes, points and bonuses never
  // change, and rounds with results are locked. Everything else can change at any time.
  var classesLocked = editing;
  var pointsLocked = editing;
  if (!_rccQualifyingSet(details)) details.raceSettings.qualifying = 'Yes';
  var state = {
    name: editing ? edit.name : '',
    details: details,
    rounds: editing ? edit.rounds.map(function (r) {
      return { roundId: r.roundId, trackId: r.trackId, eventName: r.eventName, raceLengthTier: r.raceLengthTier, weatherPreset: r.weatherPreset || 'Sunny', igRaceStart: _rccTimeOfDay(r.igRaceStart) || 'Midday', raceStart: r.raceStart || 'Rolling', realRoadTimeScale: r.realRoadTimeScale || 'Normal', locked: r.locked };
    }) : []
  };

  // Tracks grouped by venue, layouts within.
  var venues = [];
  var layoutsByVenue = {};
  tracks.forEach(function (t) {
    if (venues.indexOf(t.TrackName) === -1) { venues.push(t.TrackName); layoutsByVenue[t.TrackName] = []; }
    layoutsByVenue[t.TrackName].push(t);
  });
  venues.sort(function (a, b) { return String(a).localeCompare(String(b)); });
  // Layouts (Matt, 2026-10-14): a WEC layout first (the default), then ELMS, then the rest A to Z.
  var layoutRank = function (row) { var l = String(row.Layout || '').toUpperCase(); return /\bWEC\b/.test(l) ? 0 : /\bELMS\b/.test(l) ? 1 : 2; };
  venues.forEach(function (v) {
    layoutsByVenue[v].sort(function (a, b) { return layoutRank(a) - layoutRank(b) || String(a.Layout || '').localeCompare(String(b.Layout || '')); });
  });
  // Track dropdown labels (Matt, 2026-10-14): "TrackName (ShortName)".
  var venueOptions = venues.map(function (v) {
    var sn = (layoutsByVenue[v].filter(function (row) { return row.ShortName; })[0] || {}).ShortName;
    return { label: v + (sn && sn !== v ? ' (' + sn + ')' : ''), value: v };
  });
  var trackById = {};
  tracks.forEach(function (t) { trackById[t.TrackID] = t; });
  function newRound() {
    var t = layoutsByVenue[venues[0]][0];
    return { roundId: '', trackId: t.TrackID, eventName: '', raceLengthTier: Object.keys(state.details.pointsTables)[0] || 'Sprint', weatherPreset: 'Sunny', igRaceStart: 'Midday', raceStart: 'Rolling', realRoadTimeScale: 'Normal', locked: false };
  }
  if (!state.rounds.length) for (var i = 0; i < 6; i++) state.rounds.push(newRound());

  // Years per class from the Cars tab.
  var yearsByClass = {};
  cars.forEach(function (c) {
    var y = String(c.Season);
    var ck = _rccClassKey(c.Class);
    var list = yearsByClass[ck] || (yearsByClass[ck] = []);
    if (y && list.indexOf(y) === -1) list.push(y);
  });
  Object.keys(yearsByClass).forEach(function (k) { yearsByClass[k].sort().reverse(); });

  m.body.innerHTML = '';
  var form = _rccEl('div', 'rcc-wizard');
  m.body.appendChild(form);

  // --- Season ---
  // Season Name (50%) | Series (25%) | Year (25%). Series and year pick the grid, the same way LMU's
  // Race Weekend starts from a series and a year; classes with no cars there are grayed out below.
  var sec1 = _rccSection('Season');
  var seasonRow = _rccEl('div', 'rcc-season-row');
  seasonRow.appendChild(_rccField('Season Name', _rccTextInput(state.name, function (v) { state.name = v; }, 60)));
  if (RCC_SERIES.indexOf(state.details.series) === -1) state.details.series = 'WEC';
  var seriesSel = _rccSelect(RCC_SERIES, state.details.series, function (v) { state.details.series = v; fillYears(); applyGrid(); });
  seriesSel.id = 'rcc-season-series';
  seriesSel.disabled = classesLocked;
  seasonRow.appendChild(_rccField('Series', seriesSel));
  // Only years that have active cars in the chosen series, newest first. A season being edited keeps
  // its own year in the list even if those cars have since been retired.
  var pickedYear = String(state.details.seasonYear || '');
  RCC_CLASS_ORDER.forEach(function (c) { if (!pickedYear && state.details.classes[c] && state.details.classSeasons[c]) pickedYear = String(state.details.classSeasons[c]); });
  var yearSel = document.createElement('select');
  yearSel.id = 'rcc-season-year';
  function yearsFor(series) {
    var ys = [];
    cars.forEach(function (c) { var y = String(c.Season || ''); if (y && _rccCarSeries(c) === series && ys.indexOf(y) === -1) ys.push(y); });
    return ys.sort().reverse();
  }
  function fillYears() {
    var ys = yearsFor(state.details.series);
    if (editing && pickedYear && ys.indexOf(pickedYear) === -1) { ys.push(pickedYear); ys.sort().reverse(); }
    yearSel.innerHTML = '';
    if (!ys.length) {
      yearSel.appendChild(new Option('No ' + state.details.series + ' cars yet', ''));
      pickedYear = '';
      yearSel.disabled = true;
      return;
    }
    ys.forEach(function (y) { yearSel.appendChild(new Option(y, y)); });
    if (ys.indexOf(pickedYear) === -1) pickedYear = ys[0];
    yearSel.value = pickedYear;
    yearSel.disabled = classesLocked;
  }
  yearSel.addEventListener('change', function () { pickedYear = yearSel.value; applyGrid(); });
  fillYears();
  seasonRow.appendChild(_rccField('Year', yearSel));
  sec1.appendChild(seasonRow);
  form.appendChild(sec1);

  // --- Classes ---
  var sec2 = _rccSection('Classes');
  if (classesLocked) sec2.appendChild(_rccText('div', 'rc-hint', 'The series, year and classes are set when a season is created and cannot be changed.'));
  var classGrid = _rccEl('div', 'rcc-class-grid');
  var classRows = [];
  RCC_CLASS_ORDER.forEach(function (cls) {
    var rowEl = _rccEl('div', 'rcc-class-row');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'rcc-class-' + cls;
    cb.checked = !!state.details.classes[cls];
    var lbl = _rccText('label', 'rcc-class-label', cls);
    lbl.htmlFor = cb.id;
    var count = _rccEl('span', 'rcc-class-count');
    cb.addEventListener('change', function () { state.details.classes[cls] = cb.checked; });
    rowEl.appendChild(cb);
    rowEl.appendChild(lbl);
    rowEl.appendChild(count);
    classGrid.appendChild(rowEl);
    classRows.push({ cls: cls, row: rowEl, cb: cb, count: count });
  });
  // Every ticked class takes the season's series and year; a class with no cars there is grayed
  // out and unticked.
  function applyGrid() {
    var series = state.details.series;
    state.details.seasonYear = pickedYear;
    classRows.forEach(function (x) {
      var n = cars.filter(function (c) { return _rccClassKey(c.Class) === x.cls && String(c.Season) === pickedYear && _rccCarSeries(c) === series; }).length;
      x.count.textContent = n ? n + ' car' + (n === 1 ? '' : 's') : (pickedYear ? 'No ' + series + ' cars in ' + pickedYear : 'No ' + series + ' cars');
      x.row.classList.toggle('rcc-class-row-off', !n);
      if (!n && !classesLocked) { x.cb.checked = false; state.details.classes[x.cls] = false; }
      x.cb.disabled = classesLocked || !n;
      if (!classesLocked) state.details.classSeasons[x.cls] = n ? pickedYear : '';
    });
  }
  applyGrid();
  sec2.appendChild(classGrid);
  sec2.appendChild(_rccText('div', 'rc-hint', 'Every active car in a picked class, from that series and year, joins the grid. Your rivals are the real drivers listed on each car.'));
  form.appendChild(sec2);

  // --- Race settings ---
  var rs = state.details.raceSettings;
  // Grouped like LMU's Event Settings tabs: Difficulty, then Advanced (Matt, 2026-10-09). Start and
  // RealRoad Time Scale are per round (Rounds below).
  var sec3 = _rccSection('Difficulty');
  var diffOptions = [];
  // Skill bands (Matt): 75-80% Rookie, 81-90% Intermediate, 91-100% Pro, 101-105% Expert.
  for (var d = 75; d <= 105; d++) diffOptions.push({ label: d + '% (' + _rccSkillLevel(d) + ')', value: d });
  var g3 = _rccEl('div', 'rcc-field-grid');
  if (!rs.damage) rs.damage = 'Realistic';
  if (!rs.tireWarmers) rs.tireWarmers = 'Off';
  if (!rs.timeScale) rs.timeScale = 'Normal';
  if (RCC_TRACK_LIMITS.indexOf(state.details.trackLimitsPreset) === -1) state.details.trackLimitsPreset = 'Default';
  g3.appendChild(_rccField('AI Difficulty', _rccSelect(diffOptions, rs.aiDifficulty || 90, function (v) { rs.aiDifficulty = Number(v); })));
  g3.appendChild(_rccField('Damage Simulation', _rccSelect(RCC_DAMAGE, rs.damage, function (v) { rs.damage = v; })));
  g3.appendChild(_rccField('Tyre Wear', _rccSelect(RCC_MULTIPLIERS, rs.tireWearMultiplier, function (v) { rs.tireWearMultiplier = v; })));
  g3.appendChild(_rccField('Tyre Warmers', _rccSelect(['On', 'Off'], rs.tireWarmers, function (v) { rs.tireWarmers = v; })));
  g3.appendChild(_rccField('Available Tyres', _rccNumber(rs.tireCount, function (v) { rs.tireCount = v; }, 0)));
  g3.appendChild(_rccField('Fuel Usage', _rccSelect(RCC_MULTIPLIERS, rs.fuelMultiplier, function (v) { rs.fuelMultiplier = v; })));
  sec3.appendChild(g3);
  form.appendChild(sec3);

  var secAdv = _rccSection('Advanced');
  var gA = _rccEl('div', 'rcc-field-grid');
  gA.appendChild(_rccField('Time Scale', _rccSelect(RCC_TIME_SCALES, rs.timeScale, function (v) { rs.timeScale = v; })));
  gA.appendChild(_rccField('Flag Rules', _rccSelect(['None', 'Black Only', 'Full', 'Full w/o DQ'], rs.flagRules || 'Full', function (v) { rs.flagRules = v; })));
  gA.appendChild(_rccField('Track Limits Rules', _rccSelect(RCC_TRACK_LIMITS, state.details.trackLimitsPreset, function (v) { state.details.trackLimitsPreset = v; })));
  gA.appendChild(_rccField('Mechanical Failures', _rccSelect(['Off', 'Normal', 'Time Scale'], rs.mechanicalFailures || 'Normal', function (v) { rs.mechanicalFailures = v; })));
  gA.appendChild(_rccField('AI Aggression', _rccSelect(['Low', 'Medium', 'High'], rs.aiAggression || 'Medium', function (v) { rs.aiAggression = v; })));
  gA.appendChild(_rccField('Track Limits Points', _rccNumber(rs.trackLimitPoints, function (v) { rs.trackLimitPoints = v; }, 0)));
  secAdv.appendChild(gA);
  form.appendChild(secAdv);

  // --- Points ---
  var sec4 = _rccSection('Points');
  if (pointsLocked) sec4.appendChild(_rccText('div', 'rc-hint', 'The points and bonuses are set when a season is created and cannot be changed.'));
  var tables = state.details.pointsTables;
  Object.keys(tables).forEach(function (tier) {
    var t = tables[tier];
    var row = _rccEl('div', 'rcc-points-row');
    row.appendChild(_rccText('div', 'rcc-points-tier', tier));
    // Length picked from the fixed list (Matt, 2026-10-17). A season saved with another length keeps it as an extra choice.
    var lens = RCC_RACE_LENGTHS.slice();
    if (t.duration && lens.indexOf(Number(t.duration)) === -1) { lens.push(Number(t.duration)); lens.sort(function (a, b) { return a - b; }); }
    if (!t.duration) t.duration = 60;
    var dur = _rccSelect(lens.map(function (v) { return { label: _rccDur(v), value: String(v) }; }), String(t.duration), function (v) { t.duration = Number(v); });
    dur.disabled = pointsLocked;
    row.appendChild(_rccField('Length', dur));
    // One box per finishing position, P1 to P10.
    var cur = (t.points || []).slice(0, 10);
    while (cur.length < 10) cur.push(0);
    t.points = cur;
    var boxes = _rccEl('div', 'rcc-points-boxes');
    cur.forEach(function (val, i) {
      var cell = _rccEl('div', 'rcc-points-cell');
      cell.appendChild(_rccText('span', 'rcc-points-pos', 'P' + (i + 1)));
      var box = _rccNumber(val, function (v) { t.points[i] = v === '' ? 0 : Math.max(0, Number(v) || 0); }, 0);
      box.disabled = pointsLocked;
      cell.appendChild(box);
      boxes.appendChild(cell);
    });
    row.appendChild(boxes);
    sec4.appendChild(row);
  });
  var b = state.details.bonusPoints;
  var poleSel = null;
  var bonusRow = _rccEl('div', 'rcc-bonus-row');
  bonusRow.appendChild(_rccText('div', 'rcc-points-tier', 'Bonus'));
  var g4 = _rccEl('div', 'rcc-field-grid rcc-bonus-grid');
  [['pole', 'Pole Position Bonus'], ['fastestLap', 'Fastest Lap Bonus'], ['mostLapsLed', 'Most Laps Led Bonus']].forEach(function (pair) {
    var n = _rccSelect([0, 1, 2, 3, 4, 5], Math.min(5, Math.max(0, Number(b[pair[0]]) || 0)), function (v) { b[pair[0]] = Number(v); });
    n.disabled = pointsLocked;
    if (pair[0] === 'pole') poleSel = n;
    g4.appendChild(_rccField(pair[1], n));
  });
  bonusRow.appendChild(g4);
  sec4.appendChild(bonusRow);
  form.appendChild(sec4);

  // --- Rounds ---
  // Sessions: the settings shared by every round (start type, RealRoad, whether there's a
  // qualifying session), then the rounds. Without qualifying the grid is random, uploads need only
  // the Race file, and there is no pole bonus.
  var sec5 = _rccSection('Sessions');
  var gS = _rccEl('div', 'rcc-field-grid rcc-sessions-grid');
  if (!rs.raceStart) rs.raceStart = 'Rolling';
  if (!rs.realRoadTimeScale) rs.realRoadTimeScale = 'Normal';
  // "Fast" is saved as before; it reads Fast Rolling (Matt, 2026-10-14).
  gS.appendChild(_rccField('Start', _rccSelect([{ label: 'Rolling', value: 'Rolling' }, { label: 'Fast Rolling', value: 'Fast' }], rs.raceStart, function (v) { rs.raceStart = v; })));
  gS.appendChild(_rccField('RealRoad Time Scale', _rccSelect(RCC_REALROAD_SCALES, rs.realRoadTimeScale, function (v) { rs.realRoadTimeScale = v; })));
  var qualSel = _rccSelect([{ label: 'Yes', value: 'Yes' }, { label: 'No (Random start)', value: 'No' }], rs.qualifying, function (v) { rs.qualifying = v; syncPole(); });
  qualSel.id = 'rcc-qualifying';
  // Locked once any round has results: switching it would change which rounds count as complete.
  var qualLocked = editing && state.rounds.some(function (r) { return r.locked; });
  qualSel.disabled = qualLocked;
  gS.appendChild(_rccField('Qualifying Session', qualSel));
  sec5.appendChild(gS);
  if (qualLocked) sec5.appendChild(_rccText('div', 'rc-hint', 'The qualifying setting cannot be changed once a round has results.'));
  function syncPole() {
    if (!poleSel) return;
    var noQuali = rs.qualifying === 'No';
    if (noQuali && !pointsLocked) { b.pole = 0; poleSel.value = '0'; }
    poleSel.disabled = pointsLocked || noQuali;
    poleSel.title = noQuali ? 'No pole bonus without a qualifying session.' : '';
  }
  syncPole();
  var roundsWrap = _rccEl('div', 'rcc-rounds');
  sec5.appendChild(roundsWrap);
  var addBtn = _rccText('button', 'rc-btn-secondary rc-btn-sm', 'Add Round');
  addBtn.type = 'button';
  addBtn.addEventListener('click', function () { state.rounds.push(newRound()); drawRounds(); });
  sec5.appendChild(addBtn);
  form.appendChild(sec5);

  function drawRounds() {
    roundsWrap.innerHTML = '';
    state.rounds.forEach(function (r, idx) {
      var card = _rccEl('div', 'rcc-round' + (r.locked ? ' rcc-round-locked' : ''));
      var head = _rccEl('div', 'rcc-round-head');
      head.appendChild(_rccText('div', 'rcc-round-num', 'Round ' + (idx + 1) + (r.locked ? ' · results imported, locked' : '')));
      if (!r.locked) {
        var tools = _rccEl('div', 'rcc-round-tools');
        var up = _rccText('button', 'rc-btn-secondary rc-btn-row', 'Move Up');
        up.type = 'button';
        up.disabled = idx === 0 || state.rounds[idx - 1].locked;
        up.addEventListener('click', function () { var x = state.rounds[idx - 1]; state.rounds[idx - 1] = r; state.rounds[idx] = x; drawRounds(); });
        var down = _rccText('button', 'rc-btn-secondary rc-btn-row', 'Move Down');
        down.type = 'button';
        // A round with results keeps its round number, so nothing can move past it or be removed
        // from in front of it.
        down.disabled = idx === state.rounds.length - 1 || state.rounds[idx + 1].locked;
        down.addEventListener('click', function () { var x = state.rounds[idx + 1]; state.rounds[idx + 1] = r; state.rounds[idx] = x; drawRounds(); });
        var del = _rccText('button', 'rc-btn-secondary rc-btn-row', 'Remove');
        del.type = 'button';
        del.disabled = state.rounds.length === 1 || state.rounds.slice(idx + 1).some(function (x) { return x.locked; });
        del.addEventListener('click', function () { state.rounds.splice(idx, 1); drawRounds(); });
        tools.appendChild(up); tools.appendChild(down); tools.appendChild(del);
        head.appendChild(tools);
      }
      card.appendChild(head);
      var t = trackById[r.trackId] || layoutsByVenue[venues[0]][0];
      if (r.locked) {
        card.appendChild(_rccText('div', 'rcc-round-locked-text', (r.eventName || 'Event') + ' · ' + (t.TrackName || '') + ': ' + (t.Layout || '') + ' · ' + r.raceLengthTier));
        roundsWrap.appendChild(card);
        return;
      }
      var g = _rccEl('div', 'rcc-field-grid');
      var layoutSel = _rccSelect([], null);
      function fillLayouts(venue, keepId) {
        layoutSel.innerHTML = '';
        (layoutsByVenue[venue] || []).forEach(function (row) { layoutSel.appendChild(new Option(row.Layout || 'Standard', row.TrackID)); });
        layoutSel.value = keepId && trackById[keepId] && trackById[keepId].TrackName === venue ? keepId : layoutSel.options[0].value;
        r.trackId = layoutSel.value;
      }
      var venueSel = _rccSelect(venueOptions, t.TrackName, function (v) { fillLayouts(v); });
      layoutSel.addEventListener('change', function () { r.trackId = layoutSel.value; });
      fillLayouts(t.TrackName, r.trackId);
      g.appendChild(_rccField('Event Name', _rccTextInput(r.eventName, function (v) { r.eventName = v; }, 60)));
      g.appendChild(_rccField('Track', venueSel));
      g.appendChild(_rccField('Layout', layoutSel));
      g.appendChild(_rccField('Race Length', _rccSelect(Object.keys(state.details.pointsTables), r.raceLengthTier, function (v) { r.raceLengthTier = v; })));
      card.appendChild(g);
      // Second row: the session's own settings.
      g = _rccEl('div', 'rcc-field-grid rcc-round-row2');
      g.appendChild(_rccField('Weather Preset', _rccSelect(RCC_WEATHER_PRESETS, r.weatherPreset || 'Sunny', function (v) { r.weatherPreset = v; })));
      g.appendChild(_rccField('In-Game Race Start', _rccSelect(RCC_RACE_STARTS.map(function (t) { return { label: _rccStartLabel(t), value: t }; }), r.igRaceStart || 'Midday', function (v) { r.igRaceStart = v; })));
      card.appendChild(g);
      roundsWrap.appendChild(card);
    });
  }
  drawRounds();

  var saveRow = _rccEl('div', 'rcc-btn-row rcc-btn-row-end');
  var err = _rccEl('div', 'rcc-error-line');
  var save = _rccText('button', 'rc-btn-primary rc-btn-sm', editing ? 'Save Changes' : 'Create Season');
  save.type = 'button';
  saveRow.appendChild(save);
  form.appendChild(err);
  form.appendChild(saveRow);

  save.addEventListener('click', function () {
    err.textContent = '';
    if (!state.name.trim()) { _rccToast('Give the season a name.', 'error'); return; }
    if (!RCC_CLASS_ORDER.some(function (c) { return state.details.classes[c]; })) { _rccToast('Pick at least one class.', 'error'); return; }
    if (!state.rounds.length) { _rccToast('Add at least one round.', 'error'); return; }
    var payload = {
      name: state.name.trim(),
      seasonDetails: state.details,
      rounds: state.rounds.map(function (r) {
        return { roundId: r.roundId, trackId: r.trackId, eventName: r.eventName, raceLengthTier: r.raceLengthTier, weatherPreset: r.weatherPreset, igRaceStart: r.igRaceStart, raceStart: r.raceStart, realRoadTimeScale: r.realRoadTimeScale };
      })
    };
    if (editing) payload.seasonId = edit.seasonId;
    rccRunWrite(save, editing ? 'Saving Changes...' : 'Creating Season...', function () {
      return _rccApi(editing ? 'champUpdateSeason' : 'champCreateSeason', payload, { post: true });
    }).then(function (res) {
      if (_rccHandleAuthError(res)) return;
      if (!res || !res.success) { _rccToast((res && res.message) || 'Could not save the season.', 'error'); return; }
      _rccToast(editing ? 'Season updated.' : 'Season created. Now choose your team.', 'success');
      m.close(true);
      if (!editing) {
        _rccGo('championship.html?id=' + encodeURIComponent(RCC.ownerId));
      } else {
        rccReloadAfterSave();
      }
    }).catch(function () {
      _rccToast('No answer from the server. Reload the page to see whether it was saved.', 'error');
    });
  });
}

// ---------------------------------------------------------------------
// END SEASON
// ---------------------------------------------------------------------
function rccOpenEndSeason() {
  var page = RCC.page;
  var open = (page.calendar || []).filter(function (c) { return !c.hasResults; });
  if (!open.length) {
    rccConfirm('End Season', 'End "' + page.seasonName + '"? The standings become final and the season can no longer be edited. You can then create your next season.',
      'End Season', 'Ending Season...',
      function () { return _rccApi('champEndSeason', { seasonId: page.seasonId }, { post: true }); },
      function () { _rccToast('Season ended.', 'success'); rccReloadAfterSave(); });
    return;
  }
  // Ending before every round is raced (Matt): allowed, but the season is marked unfinished and does
  // not count toward a career. Deleting the season is the other way out.
  var list = open.map(function (c) { return 'Round ' + c.roundNum; });
  var still = list.length === 1 ? list[0] + ' has' : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] + ' have';
  // Ending early also asks for END SEASON typed in the box (audit A11, Matt 2026-10-22: only when
  // ending early). Same pattern as Delete Season.
  var m = rccOpenModal('End Season Unfinished', { narrow: true });
  m.body.appendChild(_rccText('p', 'rcc-confirm-text', still + ' not been raced yet. If you end "' + page.seasonName + '" now, it is saved as an unfinished season. If you would rather remove it completely, use Delete Season instead.'));
  var input = document.createElement('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.placeholder = RCC_END_PHRASE;
  m.body.appendChild(_rccField('Type ' + RCC_END_PHRASE + ' to confirm', input));
  var row = _rccEl('div', 'rcc-btn-row rcc-btn-row-end');
  var cancel = _rccText('button', 'rc-btn-secondary rc-btn-sm', 'Cancel');
  cancel.type = 'button';
  var commit = _rccText('button', 'rc-btn-primary rc-btn-sm', 'End Unfinished');
  commit.type = 'button';
  commit.disabled = true;
  row.appendChild(cancel);
  row.appendChild(commit);
  m.body.appendChild(row);
  function typedOk() { return input.value.replace(/\s+/g, ' ').trim().toUpperCase() === RCC_END_PHRASE; }
  input.addEventListener('input', function () { commit.disabled = !typedOk(); });
  input.focus();
  cancel.addEventListener('click', function () { m.close(false); });
  commit.addEventListener('click', function () {
    if (!typedOk()) return;
    cancel.disabled = true;
    input.disabled = true;
    rccRunWrite(commit, 'Ending Season...', function () {
      return _rccApi('champEndSeason', { seasonId: page.seasonId, unfinished: '1' }, { post: true });
    }).then(function (res) {
      cancel.disabled = false;
      input.disabled = false;
      if (_rccHandleAuthError(res)) return;
      if (!res || !res.success) { _rccToast((res && res.message) || 'That did not work. Try again.', 'error'); return; }
      _rccToast('Season ended unfinished.', 'success');
      m.close(true);
      rccReloadAfterSave();
    }).catch(function () {
      cancel.disabled = false;
      input.disabled = false;
      _rccToast('No answer from the server. Reload the page to see whether it went through.', 'error');
    });
  });
}
var RCC_END_PHRASE = 'END SEASON';

// ---------------------------------------------------------------------
// DELETE SEASON -- deletes the season being shown (active or ended). The red button stays locked
// until DELETE SEASON is typed in the box, since this can't be undone.
// ---------------------------------------------------------------------
var RCC_DELETE_PHRASE = 'DELETE SEASON';
function rccOpenDeleteSeason() {
  var page = RCC.page;
  var m = rccOpenModal('Delete Season', { narrow: true });
  m.body.appendChild(_rccText('p', 'rcc-confirm-text', 'Delete Season ' + page.seasonNumber + ' "' + page.seasonName + '"? This removes its rounds, your team signing, and every imported result and lap. It cannot be undone.'));
  var input = document.createElement('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.placeholder = RCC_DELETE_PHRASE;
  m.body.appendChild(_rccField('Type ' + RCC_DELETE_PHRASE + ' to confirm', input));
  var row = _rccEl('div', 'rcc-btn-row rcc-btn-row-end');
  var cancel = _rccText('button', 'rc-btn-secondary rc-btn-sm', 'Cancel');
  cancel.type = 'button';
  var commit = _rccText('button', 'rc-btn-primary rc-btn-sm', 'Delete Season');
  commit.type = 'button';
  commit.disabled = true;
  row.appendChild(cancel);
  row.appendChild(commit);
  m.body.appendChild(row);
  var errLine = _rccEl('div', 'rcc-error-line');
  m.body.appendChild(errLine);
  function typedOk() { return input.value.replace(/\s+/g, ' ').trim().toUpperCase() === RCC_DELETE_PHRASE; }
  input.addEventListener('input', function () { commit.disabled = !typedOk(); });
  input.focus();
  cancel.addEventListener('click', function () { m.close(false); });
  commit.addEventListener('click', function () {
    if (!typedOk()) return;
    errLine.textContent = '';
    cancel.disabled = true;
    input.disabled = true;
    rccRunWrite(commit, 'Deleting Season...', function () {
      return _rccApi('champDeleteSeason', { seasonId: page.seasonId }, { post: true });
    }).then(function (res) {
      cancel.disabled = false;
      input.disabled = false;
      if (_rccHandleAuthError(res)) return;
      if (!res || !res.success) { _rccToast((res && res.message) || 'Could not delete the season.', 'error'); return; }
      _rccToast('Season deleted.', 'success');
      m.close(true);
      _rccGo('championship.html?id=' + encodeURIComponent(RCC.ownerId));
    }).catch(function () {
      cancel.disabled = false;
      input.disabled = false;
      _rccToast('No answer from the server. Reload the page to see whether it was deleted.', 'error');
    });
  });
}

// ---------------------------------------------------------------------
// UPLOAD RESULTS
// ---------------------------------------------------------------------
// Upload Results. From a calendar card (lockRound) it is for that one round; from the black bar it
// opens with a dropdown of the rounds that don't have results yet (first one picked). Two required
// files, 1 = Qualify, 2 = Race, sent together; the server checks they belong to the same race
// weekend and the round's track. Results are official as soon as they're in. Errors and the success
// message are toasts; on success the popup closes and the page reloads.
function _rccRoundLabel(c) {
  return 'Round ' + c.roundNum + ' · ' + c.eventName + (c.track ? ' (' + c.track + (c.layout ? ': ' + c.layout : '') + ')' : '');
}
function rccOpenUpload(roundId, lockRound) {
  var page = RCC.page;
  var cal = page.calendar || [];
  // Rounds are uploaded in calendar order: only the first round without results can take an upload.
  var c = cal.filter(function (x) { return !x.hasResults; })[0];
  if (!c) { _rccToast('Every round already has results.', 'error'); return; }
  if (lockRound && c.roundId !== roundId) {
    var asked = cal.filter(function (x) { return x.roundId === roundId; })[0];
    _rccToast(asked && asked.hasResults ? 'Round ' + asked.roundNum + ' already has results. Use Erase Results first.' : 'Upload the results for Round ' + c.roundNum + ' first. Rounds are uploaded in calendar order.', 'error');
    return;
  }
  if (c.hasQualifyResults || c.hasRaceResults) { _rccToast('Round ' + c.roundNum + ' has part of its results. Use Erase Results on it, then upload again.', 'error'); return; }
  var m = rccOpenModal('Upload Results', { narrow: false });
  m.dialog.classList.add('rcc-light-dialog');
  var roundSel = null;
  // "Round N" is the label; the line under it is just the event and track (Matt, 2026-10-13).
  m.body.appendChild(_rccField('Round ' + c.roundNum, _rccText('div', 'rcc-upload-round', c.eventName + (c.track ? ' (' + c.track + (c.layout ? ': ' + c.layout : '') + ')' : ''))));
  // The race in the game has to be at least as long as the round's planned length.
  if (c.plannedRaceLengthMinutes) {
    m.body.appendChild(_rccText('div', 'rc-hint', 'This round is a ' + (c.plannedRaceLengthTier || '') + ' race of ' + c.plannedRaceLengthMinutes +
      ' minutes. The race in the game has to be the same length or longer, or the upload is refused.'));
  }
  function fileInput() {
    var f = document.createElement('input');
    f.type = 'file';
    f.accept = '.xml,text/xml';
    return f;
  }
  // Seasons without a qualifying session (random start) upload the Race file alone.
  var noQuali = ((page.seasonDetails || {}).raceSettings || {}).qualifying === 'No';
  var qFile = noQuali ? null : fileInput();
  var rFile = fileInput();
  if (qFile) m.body.appendChild(_rccField('1. Qualifying Results (XML)', qFile));
  m.body.appendChild(_rccField(noQuali ? 'Race Results (XML)' : '2. Race Results (XML)', rFile));
  var row = _rccEl('div', 'rcc-btn-row rcc-btn-row-end');
  var go = _rccText('button', 'rc-btn-primary rc-btn-sm', 'Upload Results');
  go.type = 'button';
  go.disabled = true;
  row.appendChild(go);
  m.body.appendChild(row);
  function bothChosen() { return !!((!qFile || (qFile.files && qFile.files[0])) && rFile.files && rFile.files[0]); }
  if (qFile) qFile.addEventListener('change', function () { go.disabled = !bothChosen(); });
  rFile.addEventListener('change', function () { go.disabled = !bothChosen(); });
  function readFile(f) {
    return new Promise(function (resolve, reject) {
      var rd = new FileReader();
      rd.onload = function () { resolve({ name: f.name, text: String(rd.result || '') }); };
      rd.onerror = function () { var err = new Error('Could not read ' + f.name + '. Choose the file again.'); err.rccShow = true; reject(err); };
      rd.readAsText(f);
    });
  }
  function lockInputs(on) { if (qFile) qFile.disabled = on; rFile.disabled = on; if (roundSel) roundSel.disabled = on; }

  // send(extra): reads the chosen files and uploads them; extra adds { confirmTrack: true } after the
  // player answers Upload Anyway in the "Different Track?" popup.
  function send(extra) {
    var reads = qFile ? [readFile(qFile.files[0]), readFile(rFile.files[0])] : [readFile(rFile.files[0])];
    return Promise.all(reads).then(function (read) {
      var q = qFile ? read[0] : null, r = qFile ? read[1] : read[0];
      var body = { seasonId: page.seasonId, roundId: c.roundId, raceFilename: r.name, raceXml: r.text };
      if (q) { body.qualifyFilename = q.name; body.qualifyXml = q.text; }
      if (extra) Object.keys(extra).forEach(function (k) { body[k] = extra[k]; });
      return _rccApi('champImportXml', body, { post: true });
    });
  }
  function uploaded(res) {
    (res.warnings || []).forEach(function (w) { _rccToast(w, 'info'); });
    _rccToast('Round ' + c.roundNum + ' results uploaded.', 'success');
    m.close(true);
    rccReloadAfterSave();
  }
  // The track names in the files look different from the round's (Matt, 2026-10-22): ask instead of
  // refusing. Meant for the same track under a slightly different name in the game; Cancel goes back
  // to the upload window with the files still chosen, so they can be swapped.
  function askTrack(res) {
    var cm = rccConfirm('Different Track?',
      (qFile ? 'These files were' : 'This file was') + ' raced at ' + (res.fileTrack || 'another track') + ', but Round ' + (res.roundNum || c.roundNum) + ' is at ' + (res.roundTrack || 'another track') + '.',
      'Upload Anyway', 'Uploading...', function () { return send({ confirmTrack: true }); }, uploaded);
    var first = cm.body.querySelector('.rcc-confirm-text');
    first.parentNode.insertBefore(_rccText('p', 'rcc-confirm-text', qFile ? 'Upload them to this round anyway?' : 'Upload it to this round anyway?'), first.nextSibling);
  }

  go.addEventListener('click', function () {
    if (!bothChosen()) { _rccToast(qFile ? 'Choose both files. File 1 is the Qualify results and file 2 is the Race results.' : 'Choose the Race results file.', 'error'); return; }
    lockInputs(true);
    rccRunWrite(go, 'Uploading...', function () { return send(null); }).then(function (res) {
      if (_rccHandleAuthError(res)) return;
      if (res && res.needsConfirm && res.confirmKind === 'track') {
        lockInputs(false);
        askTrack(res);
        return;
      }
      if (!res || !res.success) {
        _rccToast((res && res.message) || 'Import failed.', 'error');
        lockInputs(false);
        return;
      }
      uploaded(res);
    }).catch(function (e) {
      lockInputs(false);
      // Only our own file-reading message is shown as is. Network and server faults get plain wording.
      _rccToast(e && e.rccShow ? e.message : 'The upload did not get an answer from the server. Reload the page to see whether the results went in, then try again if they did not.', 'error');
    });
  });
}

// ---------------------------------------------------------------------
// HELP -- the last link in the black bar. Same look as the League Hub's rulebook popup (.rc-rulebook-*
// in css/style.css): a "Jump To A Section" box, then every section. The text lives in
// js/championship-help.js (RCC_HELP_SECTIONS). Section links scroll inside the popup instead of
// changing the page address.
// ---------------------------------------------------------------------
function rccOpenHelp() {
  var m = rccOpenModal('Help: Single Player Championship', { wide: true });
  m.body.classList.add('rcc-help-body');
  var sections = typeof RCC_HELP_SECTIONS !== 'undefined' ? RCC_HELP_SECTIONS : [];
  // Quick start for new drivers (Matt, 2026-10-13), above Jump To A Section.
  if (typeof RCC_HELP_QUICKSTART !== 'undefined') {
    var qs = _rccEl('div', 'rcc-quick');
    qs.innerHTML = RCC_HELP_QUICKSTART;
    m.body.appendChild(qs);
  }
  var nav = _rccEl('div', 'rc-rulebook-nav');
  nav.appendChild(_rccText('div', 'rc-rulebook-nav-title', 'Jump To A Section'));
  var grid = _rccEl('div', 'rc-rulebook-nav-grid');
  nav.appendChild(grid);
  m.body.appendChild(nav);
  sections.forEach(function (sec) {
    var wrap = _rccEl('div', 'rc-rulebook-section');
    wrap.appendChild(_rccText('h3', null, sec.num + '. ' + sec.title));
    var body = document.createElement('div');
    body.innerHTML = sec.html || '';
    wrap.appendChild(body);
    var link = _rccText('a', 'rc-rulebook-nav-link', sec.num + '. ' + sec.title);
    link.href = '#';
    link.addEventListener('click', function (evt) {
      evt.preventDefault();
      wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    grid.appendChild(link);
    m.body.appendChild(wrap);
  });
}

// ---------------------------------------------------------------------
// SEASON PREVIEW -- the running season's settings and calendar (what to copy into the game). Same
// Season Details / Championship Points / Race Rules rows as the pre-season panel, plus the rounds.
// ---------------------------------------------------------------------
function rccOpenSeasonPreview() {
  var page = RCC.page;
  var m = rccOpenModal('Season Preview', { wide: true });
  m.body.classList.add('rcc-preview-body');
  // No "Season N / Name" line at the top (Matt, 2026-10-22); the page hero already names the season.
  // CURRENT SEAT first, once you have signed for a team (Matt, 2026-10-27; it was its own popup).
  if (page.registration) {
    var seat = _rccEl('div', 'rcl-hero-stats-group rcc-preview-seat');
    seat.appendChild(_rccText('div', 'rcl-hero-stats-label', 'Current Seat'));
    var wrap = _rccEl('div', 'rcc-current-seat');
    wrap.appendChild(_rccSeatLine(page, null, true));
    if (page.registration.teamDesc) wrap.appendChild(_rccText('p', 'rcc-myteam-desc rcc-current-seat-desc', page.registration.teamDesc));
    seat.appendChild(wrap);
    m.body.appendChild(seat);
  }
  _rccSeasonFormat(page, m.body);
  var g = _rccEl('div', 'rcl-hero-stats-group');
  g.appendChild(_rccText('div', 'rcl-hero-stats-label', 'Rounds'));
  var list = _rccEl('div', 'rcl-seasonfmt-list rcc-preview-rounds');
  (page.calendar || []).forEach(function (c) {
    var bits = [c.track + (c.layout ? ': ' + c.layout : '')];
    // Lengths as "45m", "1h", "1h 12m" (Matt, 2026-10-17).
    var len = c.raceLengthAsRaced ? _rccDur(c.plannedRaceLengthMinutes) + ' (' + c.plannedRaceLengthTier + ', raced ' + _rccDur(c.raceLengthMinutes) + ')'
      : (c.raceLengthMinutes ? _rccDur(c.raceLengthMinutes) + ' (' + c.raceLengthTier + ')' : '');
    if (len) bits.push(len);
    if (_rccTimeOfDay(c.igRaceStart)) bits.push(_rccStartLabel(c.igRaceStart) + ' Start');
    if (c.weatherText) bits.push(c.weatherText);
    if (c.hasResults) bits.push('Raced');
    list.appendChild(_rccEl('div', 'rcl-seasonfmt-row', '<span class="rcl-seasonfmt-row-label">Round ' + c.roundNum + ' · ' + _rccEsc(c.eventName) + ':</span> <span class="rcl-seasonfmt-row-value">' + _rccEsc(bits.join(' · ')) + '</span>'));
  });
  g.appendChild(list);
  m.body.appendChild(g);
}

// ---------------------------------------------------------------------
// ERASE RESULTS -- pick a round that has results from a dropdown, then erase it. The round stays on
// the calendar, ready for a new upload. Allowed until the season ends.
// ---------------------------------------------------------------------
function rccOpenErase() {
  var page = RCC.page;
  var done = (page.calendar || []).filter(function (x) { return x.hasQualifyResults || x.hasRaceResults; });
  if (!done.length) { _rccToast('No results to erase yet.', 'error'); return; }
  // Only the latest round with results can be erased (audit A12, Matt 2026-10-22), so later rounds'
  // results and stories never point at a round that is gone.
  var c = done[done.length - 1];
  var m = rccOpenModal('Erase Results', { narrow: false });
  m.dialog.classList.add('rcc-light-dialog');
  m.body.appendChild(_rccField('Round', _rccText('div', 'rcc-upload-round', _rccRoundLabel(c))));
  var text = _rccEl('p', 'rcc-confirm-text');
  m.body.appendChild(text);
  function say() {
    text.textContent = 'Erase every imported result for Round ' + c.roundNum + ' (' + c.eventName + ')? The round itself stays on the calendar, ready for a new upload.';
  }
  say();
  var row = _rccEl('div', 'rcc-btn-row');
  var cancel = _rccText('button', 'rc-btn-secondary rc-btn-sm', 'Cancel');
  cancel.type = 'button';
  var commit = _rccText('button', 'rc-btn-primary rc-btn-sm', 'Erase Results');
  commit.type = 'button';
  row.appendChild(cancel);
  row.appendChild(commit);
  m.body.appendChild(row);
  cancel.addEventListener('click', function () { m.close(false); });
  commit.addEventListener('click', function () {
    var round = c;
    cancel.disabled = true;
    rccRunWrite(commit, 'Erasing...', function () {
      return _rccApi('champEraseRound', { roundId: round.roundId }, { post: true });
    }).then(function (res) {
      cancel.disabled = false;
      if (_rccHandleAuthError(res)) return;
      if (!res || !res.success) { _rccToast((res && res.message) || 'That did not work. Try again.', 'error'); return; }
      _rccToast('Round ' + round.roundNum + ' erased.', 'success');
      m.close(true);
      rccReloadAfterSave();
    }).catch(function () {
      cancel.disabled = false;
      _rccToast('No answer from the server. Reload the page to see whether it went through.', 'error');
    });
  });
}

// Saved copies of the page kept by earlier versions are removed (the page now comes from files).
try {
  Object.keys(localStorage).forEach(function (k) { if (k.indexOf('rc_champ_page_v1:') === 0) localStorage.removeItem(k); });
} catch (err) { /* storage blocked: nothing to remove */ }

// ---------------------------------------------------------------------
// BOOT
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// All saved data lives in the race-club-data repo (Matt, 2026-10-27). This base address must match the
// Script Property GITHUB_ARCHIVE_BASE_URL plus 'website/data/' (the same as RC_DATA_BASE in index.html).
var RCC_DATA_BASE = 'https://stenbough-cmd.github.io/race-club-data/website/data/';

function _rccPageShell(showParts) {
  _rccHidePageLoader();
  _rccUnlockScroll();
  ['rcl-last-race-panel', 'rcl-race-carousel', 'rcc-standings-panels', 'rcl-manufacturer-standings'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    var box = id === 'rcl-last-race-panel' ? el.parentNode : el;
    box.style.display = showParts ? '' : 'none';
  });
  var bar = document.getElementById('rcc-actionbar');
  if (bar) bar.style.display = showParts ? '' : 'none';
}

// One container under the site header and the black link bar, nothing else: no ticker, hero or panels (Matt, 2026-11-01 for the
// switched-off message; the logged-out sign-up message uses the same layout, 2026-11-02).
function _rccShowOnlyMessage(panelId, title, text, actions) {
  _rccClearLoadError();
  _rccHidePageLoader();
  _rccUnlockScroll();
  // The black link bar stays under the site header (Matt, 2026-11-02): Log In or Dashboard, League Hub, Championship.
  var bar = document.getElementById('rcc-actionbar');
  if (bar) { rccRenderActionBar(null); bar.style.display = ''; }
  var main = document.querySelector('.rcl-main');
  if (!main) { _rccReveal(); return; }
  if (document.getElementById(panelId)) { _rccReveal(); return; }
  Array.prototype.forEach.call(main.children, function (child) { child.style.display = 'none'; });
  main.classList.add('rcc-only-message');
  var box = _rccEl('div', 'rcl-panel rcl-row-full');
  box.id = panelId;
  var empty = _rccEmpty(title, text);
  if (actions && actions.length) {
    var row = _rccEl('div', 'rcc-off-actions');
    actions.forEach(function (a) {
      var link = _rccText('a', 'rc-btn-secondary rc-btn-sm', a.label);
      link.href = a.href;
      row.appendChild(link);
    });
    empty.appendChild(row);
  }
  box.appendChild(empty);
  main.insertBefore(box, main.firstChild);
  _rccReveal();
}

// Signed in but no season yet (Matt, 2026-11-02: there is no ON/OFF switch any more, every member has the Championship): one message
// pointing to Create Season on the Dashboard and the Help section.
function _rccShowNoSeason() {
  _rccShowOnlyMessage('rcc-noseason-panel', 'No Championship Season Yet',
    'You do not have a Single Player Championship season right now. Create one with Create Season in the Single Player Championship section of your Dashboard, then come back here to follow your standings, calendar and race stories. New to it? The Help guide walks you through setting up a season and importing your races.',
    [{ label: 'Go To Dashboard', href: 'Account.html' }]);
  // Help sits right next to the Dashboard button.
  var row = document.querySelector('#rcc-noseason-panel .rcc-off-actions');
  if (row && typeof rccOpenHelp === 'function') {
    var help = _rccText('button', 'rc-btn-secondary rc-btn-sm', 'Open Help');
    help.type = 'button';
    help.addEventListener('click', function () { rccOpenHelp(); });
    row.appendChild(help);
  }
}

// Nobody is signed in: the same kind of container, inviting the visitor to sign up (no demo any more).
function _rccShowLoggedOut() {
  _rccShowOnlyMessage('rcc-signup-panel', 'Sign Up To Play Championship Mode',
    'The Single Player Championship is a separate offline season that you set up and play on your own, with your own team, calendar, standings and race stories. It is free for every Race Club member. Create an account or log in, then create a season in the Single Player Championship section of your Dashboard to get started.',
    [{ label: 'Log In', href: 'login.html' }, { label: 'Create An Account', href: 'register.html' }]);
}


// The site's hover bubble (.rc-tooltip-bubble in css/style.css, same as Account.html's
// rcInitTooltips): any .rc-tooltip[data-tooltip] element shows it on hover or focus.
function _rccInitTooltips() {
  var bubble = null, current = null;
  function show(t) {
    if (!bubble) {
      bubble = _rccEl('div', 'rc-tooltip-bubble');
      bubble.appendChild(_rccEl('span', 'rc-tooltip-bubble-text'));
      bubble.appendChild(_rccEl('span', 'rc-tooltip-bubble-arrow'));
      document.body.appendChild(bubble);
    }
    current = t;
    bubble.firstChild.textContent = t.getAttribute('data-tooltip') || '';
    bubble.classList.add('rc-tooltip-bubble-visible');
    place(t);
  }
  function place(t) {
    var r = t.getBoundingClientRect(), bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    var above = r.top - bh - 10 > 0;
    var left = Math.max(8, Math.min(window.innerWidth - bw - 8, r.left + r.width / 2 - bw / 2));
    bubble.style.left = left + 'px';
    bubble.style.top = (above ? r.top - bh - 8 : r.bottom + 8) + 'px';
    bubble.classList.toggle('rc-tooltip-bubble-above', above);
    bubble.classList.toggle('rc-tooltip-bubble-below', !above);
    bubble.lastChild.style.left = (r.left + r.width / 2 - left) + 'px';
  }
  function hide() { current = null; if (bubble) bubble.classList.remove('rc-tooltip-bubble-visible'); }
  var find = function (n) { return n && n.closest ? n.closest('.rc-tooltip[data-tooltip]') : null; };
  document.addEventListener('mouseover', function (e) { var t = find(e.target); if (t) show(t); });
  document.addEventListener('mouseout', function (e) { var t = find(e.target); if (t && (!e.relatedTarget || !t.contains(e.relatedTarget))) hide(); });
  document.addEventListener('focusin', function (e) { var t = find(e.target); if (t) show(t); });
  document.addEventListener('focusout', function (e) { if (find(e.target)) hide(); });
  document.addEventListener('scroll', function () { if (current) place(current); }, true);
}

function rccRenderAll(page) {
  RCC.page = page;
  // A season showed up after the "no season" message was drawn (for example the first answer came from a saved copy): start over.
  if (page && page.hasSeason && document.getElementById('rcc-noseason-panel')) { window.location.reload(); return; }
  if (page && page.success !== false && !page.hasSeason && !window.RCC_EMBEDDED && !RCC.viewSeasonId) { _rccShowNoSeason(); return; }
  rccRenderActionBar(page);
  rccRenderSeasonTitle(page);
  rccRenderLastRace(page);
  rccRenderCarousel(page);
  rccRenderStandings(page);
  rccRenderManufacturers(page);
  rccRenderStories(page);
  rccRunStoryQueue(page);
}

document.addEventListener('DOMContentLoaded', function () {
  if (window.RCC_EMBEDDED) return;   // loaded by the Account dashboard (js/championship-dashboard.js): no page to start
  _rccInitTooltips();
  var mode = _rccCheckAccess();
  if (!mode) return;
  if (mode === 'loggedout') { _rccShowLoggedOut(); return; }
  _rccShowCarriedToasts();

  // The page waits behind the loading popup and draws once, with the finished data.
  var currentText = null;
  document.documentElement.classList.remove('rcl-has-cache');
  _rccLockScroll();

  // 2. Fetch fresh data; redraw only when it differs from what's on screen.
  // The season the page opened on stays in memory (currentText), so picking it again in the season
  // picker is instant, and a background refresh never switches away from a past season.
  var revalidating = false;
  // The first load failed and this browser has no saved copy (audit A4, Matt 2026-10-22): show "Could
  // Not Load The Championship" with RETRY instead of an empty page that looks like no season. The
  // player stays logged in; only a real "please log in" answer goes to the login page.
  function showLoadFailed() {
    _rccPageShell(false);
    _rccShowLoadError(function () { revalidate(); }, 'Could Not Load The Championship');
  }
  function revalidate() {
    if (revalidating) return;
    revalidating = true;
    var hadCopy = !!currentText;
    _rccGetPage(_rccQuery('season')).then(function (page) {
      if (_rccHandleAuthError(page)) return;
      return page;
    }).then(function (page) {
      if (!page) return;
      if (page && page.success) {
        var text = JSON.stringify(page);
        // A RETRY that worked: take the error panel away and bring the page back.
        if (document.getElementById('rcc-load-error')) { _rccClearLoadError(); _rccPageShell(true); }
        if (text !== currentText) {
          currentText = text;
          if (!RCC.viewSeasonId) rccRenderAll(page);
        }
      } else if (!hadCopy) {
        showLoadFailed();
      }
    }).catch(function () {
      if (!hadCopy) showLoadFailed();
    }).then(function () {
      revalidating = false;
      _rccReveal();
      if (!hadCopy) { _rccUnlockScroll(); _rccHidePageLoader(); }
    });
  }
  revalidate();

  // Season picker: load another season in place. The page dims while it loads; a failed load puts the
  // picker back on the season still showing and offers RETRY.
  var pickToken = 0;
  RCC.onSeasonPick = function (seasonId) {
    _rccClearLoadError();
    var myToken = ++pickToken;
    var defaultId = '';
    try { defaultId = currentText ? (JSON.parse(currentText).seasonId || '') : ''; } catch (err) { defaultId = ''; }
    if (!seasonId || seasonId === defaultId) {
      RCC.viewSeasonId = '';
      _rccHidePageLoader();
      _rccUnlockScroll();
      if (currentText) { try { rccRenderAll(JSON.parse(currentText)); } catch (err) { /* keep what is shown */ } }
      return;
    }
    _rccShowPageLoader('Loading season...');
    _rccGetPage(seasonId).then(function (page) {
      if (myToken !== pickToken) return;
      if (_rccHandleAuthError(page)) return;
      if (!page || !page.success || page.seasonId !== seasonId) throw new Error('season load failed');
      RCC.viewSeasonId = seasonId;
      rccRenderAll(page);
    }).catch(function () {
      if (myToken !== pickToken) return;
      if (RCC.page) rccRenderActionBar(RCC.page);
      _rccShowLoadError(function () { RCC.onSeasonPick(seasonId); });
    }).then(function () {
      if (myToken !== pickToken) return;
      _rccHidePageLoader();
      _rccUnlockScroll();
    });
  };

  // Coming back with the browser's Back button can restore the page from memory; refresh quietly.
  window.addEventListener('pageshow', function (evt) { if (evt.persisted) revalidate(); });
});

// ---------------------------------------------------------------------
// SEASON STORIES (Matt, 2026-10-11): Gemini's Season Preview, race stories and finale wrap-up, laid
// out like the League Hub's League News (33% next to Last Race). The page asks the server to write
// any missing story by itself (page.storyQueue), one at a time, oldest first.
// ---------------------------------------------------------------------
var RCC_STORY_PREVIEW_CHARS = 1000;

function _rccStoryInline(esc) {
  return esc.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
// Full story body: blank lines split paragraphs; "## " lines are section headings.
function _rccStoryBlocks(container, raw) {
  String(raw || '').split(/\n\s*\n/).forEach(function (para) {
    var run = [];
    var flush = function () { if (run.length) container.appendChild(_rccEl('p', null, run.map(function (l) { return _rccStoryInline(_rccEsc(l)); }).join('<br>'))); run = []; };
    para.trim().split('\n').forEach(function (line) {
      var hm = /^##\s+(.+)$/.exec(line.trim());
      if (hm) { flush(); container.appendChild(_rccEl('h3', 'rcl-news-h', _rccStoryInline(_rccEsc(hm[1])))); }
      else if (line.trim()) run.push(line.trim());
    });
    flush();
  });
}
// On-page preview: the first ~1,000 characters, cut at a word, with headings kept as headings.
function _rccStoryPreview(raw, limit) {
  var full = String(raw || '');
  var cut = full;
  var truncated = full.length > limit;
  if (truncated) {
    cut = full.slice(0, limit);
    var sp = cut.lastIndexOf(' ');
    if (sp > limit * 0.6) cut = cut.slice(0, sp);
    cut = cut.replace(/[\s.,;:!?-]+$/, '') + '…';
  }
  var box = _rccEl('div', 'rcl-news-current-body');
  _rccStoryBlocks(box, cut);
  return { el: box, truncated: truncated };
}
// Track photos for a story. A Race Story or Season Finale has one photo; a Season Preview has two (photoFile "a|b", photoCaption "ca|cb").
// Photo number i is a <figure> with an italic caption (long track name, country), floated at about a third of the width (half in the
// popup, see league.css). A photo that fails to load simply is not there.
function _rccStoryPhotoEl(s, i, right) {
  if (!s || !s.photoFile) return null;
  var file = String(s.photoFile).split('|')[i || 0];
  if (!file) return null;
  var fig = document.createElement('figure');
  fig.className = 'rcl-story-photo rcl-story-photo-side' + (right ? ' rcl-story-photo-right' : '');
  var img = document.createElement('img');
  var caption = String(s.photoCaption || '').split('|')[i || 0] || '';
  img.alt = caption;
  img.decoding = 'async';
  img.loading = 'lazy';
  img.addEventListener('error', function () { if (fig.parentNode) fig.parentNode.removeChild(fig); });
  img.src = rcStoryPhotoUrl(file);
  fig.appendChild(img);
  if (caption) {
    var cap = document.createElement('figcaption');
    cap.textContent = caption;
    fig.appendChild(cap);
  }
  return fig;
}
// First photo at the top left of the story body, second (Season Previews) midway through the text, to the right.
function _rccPlaceStoryPhotos(bodyEl, s, firstOnly) {   // firstOnly: the on-page preview shows one photo, the popup shows all
  var first = _rccStoryPhotoEl(s, 0, false);
  var second = firstOnly ? null : _rccStoryPhotoEl(s, 1, true);
  var blocks = [].slice.call(bodyEl.children);
  if (second) {
    var at = Math.ceil(blocks.length / 2);
    if (blocks[at]) bodyEl.insertBefore(second, blocks[at]); else bodyEl.appendChild(second);
  }
  if (first) bodyEl.insertBefore(first, bodyEl.firstChild);
}
function _rccStoryMeta(s, noAuthor) {
  // Every story is written by Race Club Press (Matt, 2026-10-14). The kind (Season Preview, Race Story,
  // Season Finale) is in the pill before this text, so it is not repeated here (League News look, 2026-10-27).
  // noAuthor: the story window on the page leaves the author out; the popup keeps it (League Hub, 2026-10-27).
  var bits = noAuthor ? [] : ['By Race Club Press'];
  if (s.kind !== 'preview') bits.push('Round ' + (s.roundNum || '?') + (s.track ? ' · ' + s.track : ''));
  var d = _rccFormatDate(s.createdAt);
  if (d) bits.push(d);
  return bits.join(' · ');
}
// The byline row: label pill (SEASON PREVIEW gold, RACE STORY / SEASON FINALE navy), then the text. It is
// a direct child of .rcl-news-headrow, so league.css puts it on its own full-width row under the title.
function _rccStoryMetaEl(s, noAuthor) {
  var pill = s.kind === 'preview' ? '<span class="rcl-news-tag rcl-news-tag-preview">Season Preview</span>'
    : '<span class="rcl-news-tag rcl-news-tag-story">' + (s.kind === 'finale' ? 'Season Finale' : 'Race Story') + '</span>';
  return _rccEl('div', 'rcl-news-meta', pill + _rccEsc(_rccStoryMeta(s, noAuthor)));
}
// Title row: tile, title, then the byline row (same markup as the League Hub's _rclNewsHeadRow).
function _rccStoryHeadRow(s, noAuthor) {
  var row = _rccEl('div', 'rcl-news-headrow rcc-story-headrow');
  var bw = _rccEl('div', 'rcl-news-badge-wrap');
  bw.appendChild(_rccStoryBadge(s));
  row.appendChild(bw);
  row.appendChild(_rccText('div', 'rcl-news-title', s.title));
  row.appendChild(_rccStoryMetaEl(s, noAuthor));
  return row;
}

function rccRenderStories(page) {
  var body = document.getElementById('rcc-stories-body');
  var panel = document.getElementById('rcc-stories-panel');
  if (!body || !panel) return;
  body.innerHTML = '';
  panel.style.display = page && page.hasSeason ? '' : 'none';
  // No season (a new member): Season Stories is hidden, so the Welcome / Last Race panel takes the
  // whole row instead of the narrow left column (Matt, 2026-10-14).
  var row = document.getElementById('rcc-stories-row');
  if (row) row.classList.toggle('rcl-news-lastrace-row-newsonly', !(page && page.hasSeason));
  if (!page || !page.hasSeason) return;
  var all = page.stories || [];
  var published = all.filter(function (s) { return s.status === 'published'; });
  RCC.storyList = published;
  // Writing / failed notice above the newest story.
  if (RCC.storyWriting) {
    var w = _rccEl('div', 'rcc-story-status');
    w.appendChild(_rccEl('span', 'rcc-story-pulse'));
    w.appendChild(_rccText('span', null, RCC.storyWriting.kind === 'preview' ? 'Writing your season preview. This takes about a minute.' : 'Writing the Round ' + (RCC.storyWriting.roundNum || '') + ' story. This takes about a minute.'));
    body.appendChild(w);
  } else if (RCC.storyFailed) {
    var f = _rccEl('div', 'rcc-story-status rcc-story-failed');
    f.appendChild(_rccText('span', null, 'The story could not be written this time. '));
    var retry = _rccText('button', 'rc-link-btn rcc-story-retry', 'Retry Story');
    retry.type = 'button';
    retry.addEventListener('click', function () { RCC.storyFailed = null; rccRunStoryQueue(page); });
    f.appendChild(retry);
    if (RCC.storyFailedWhy) f.appendChild(_rccText('div', 'rcc-story-why-text', RCC.storyFailedWhy));
    body.appendChild(f);
  }
  if (!published.length) {
    if (!RCC.storyWriting && !RCC.storyFailed) {
      body.appendChild(_rccEmpty('No Stories Yet', page.registration ? 'Your season preview is on its way.' : 'Choose your team and your season preview will be written here.'));
    }
    return;
  }
  var layout = _rccEl('div', 'rcl-news-layout');
  var cur = published[0];
  var wrap = _rccEl('div', 'rcl-news-item rcl-news-current');
  // Story badge beside the title; the byline keeps "By Race Club Press". The title opens the full story, like Continue Reading.
  var curHead = _rccStoryHeadRow(cur);
  var curTitle = curHead.querySelector('.rcl-news-title');
  curTitle.classList.add('rcc-story-title-link');
  curTitle.setAttribute('role', 'button');
  curTitle.tabIndex = 0;
  curTitle.addEventListener('click', function () { rccOpenStory(0); });
  curTitle.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rccOpenStory(0); } });
  wrap.appendChild(curHead);
  var pv = _rccStoryPreview(cur.body, RCC_STORY_PREVIEW_CHARS);
  _rccPlaceStoryPhotos(pv.el, cur, true);
  wrap.appendChild(pv.el);
  var more = _rccText('button', 'rcl-news-continue', 'Continue Reading');
  more.type = 'button';
  more.addEventListener('click', function () { rccOpenStory(0); });
  wrap.appendChild(more);
  layout.appendChild(wrap);
  if (published.length > 1) {
    // Older stories under the preview, newest first; each opens by itself in a popup, with a subheading like the League Hub's.
    var prev = _rccEl('div', 'rcl-news-previous');
    prev.appendChild(_rccText('div', 'rcl-news-previous-head', 'Older Stories'));
    published.slice(1).forEach(function (s, i) {
      var b = _rccEl('button', 'rcl-news-previous-title rcc-story-prev');
      b.type = 'button';
      b.appendChild(_rccStoryBadge(s, true));
      var tx = _rccEl('span', 'rcl-news-previous-text');
      tx.appendChild(_rccText('span', 'rcl-news-previous-name', s.title || 'Untitled'));
      var kind = s.kind === 'preview' ? 'Season Preview' : (s.kind === 'finale' ? 'Season Finale' : 'Race Story');
      tx.appendChild(_rccText('span', 'rcl-news-previous-sub', (kind + ' ' + _rccStoryMeta(s)).toUpperCase()));
      b.appendChild(tx);
      b.addEventListener('click', function () { rccOpenStory(i + 1); });
      prev.appendChild(b);
    });
    layout.appendChild(prev);
  }
  body.appendChild(layout);
}

// Thumbs up / down under a story (owner only; a thumbs down asks why).
function _rccStoryVote(story) {
  var box = _rccEl('div', 'rcc-story-vote');
  box.appendChild(_rccText('span', 'rcc-story-vote-q', 'Did you enjoy this story?'));
  var thumb = function (dir) {
    var b = _rccEl('button', 'rcc-thumb rcc-thumb-' + dir + (story.vote === dir ? ' rcc-thumb-on' : ''),
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11v9H4v-9h3zm2 9h8.2a2 2 0 0 0 2-1.6l1.3-6.4A2 2 0 0 0 18.5 9H14l.7-3.4A1.6 1.6 0 0 0 13.1 4L9 9.6V20z"/></svg>');
    b.type = 'button';
    b.setAttribute('aria-label', dir === 'up' ? 'Thumbs up' : 'Thumbs down');
    b.setAttribute('aria-pressed', story.vote === dir ? 'true' : 'false');
    b.addEventListener('click', function () {
      if (dir === 'up') { send('up', ''); return; }
      form.style.display = form.style.display === 'none' ? '' : 'none';
      if (form.style.display === '') txt.focus();
    });
    return b;
  };
  box.appendChild(thumb('up'));
  box.appendChild(thumb('down'));
  var form = _rccEl('div', 'rcc-story-why');
  form.style.display = 'none';
  var txt = document.createElement('textarea');
  txt.maxLength = 1000;
  txt.rows = 3;
  txt.placeholder = 'What didn’t you like about this story?';
  form.appendChild(txt);
  var go = _rccText('button', 'rc-btn-primary rc-btn-sm', 'Send Feedback');
  go.type = 'button';
  go.addEventListener('click', function () {
    if (!txt.value.trim()) { _rccToast('Tell us what you didn’t like about the story.', 'error'); return; }
    send('down', txt.value.trim());
  });
  form.appendChild(go);
  box.appendChild(form);
  function send(vote, comment) {
    _rccApi('champStory', { op: 'feedback', storyId: story.storyId, vote: vote, comment: comment }, { post: true }).then(function (res) {
      if (_rccHandleAuthError(res)) return;
      if (!res || !res.success) { _rccToast((res && res.message) || 'Could not save your feedback.', 'error'); return; }
      story.vote = vote;
      box.querySelectorAll('.rcc-thumb').forEach(function (t) { var on = t.classList.contains('rcc-thumb-' + vote); t.classList.toggle('rcc-thumb-on', on); t.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      form.style.display = 'none';
      _rccToast('Thanks for the feedback. Your next stories will take it into account.', 'success');
    }).catch(function () { _rccToast('Could not reach the server. Try again.', 'error'); });
  }
  return box;
}

// Full story popup with Load More Stories, like the League Hub's news popup.
// Story tile, the League Hub's markup (_rclNewsBadgeHtml in js/league.js, 2026-10-27): a navy tile with a
// checkered strip, a small RD and the round number (the finale too); the season preview shows a flag.
var RCC_BADGE_FLAG_SVG = '<svg class="rcl-news-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4"/><path d="M5 4h13l-2.5 4 2.5 4H5"/><path d="M9 4v8M13 4v8" stroke-width="1.4"/></svg>';
function _rccStoryBadge(s, small) {
  var sm = small ? ' rcl-news-badge-sm' : '';
  if (s.kind === 'preview') {
    var pre = _rccEl('span', 'rcl-news-badge rcl-news-badge-rd rcl-news-badge-pre' + sm, RCC_BADGE_FLAG_SVG);
    pre.title = 'Season preview';
    return pre;
  }
  var n = Number(s.roundNum) || 0;
  return _rccEl('span', 'rcl-news-badge rcl-news-badge-rd' + sm,
    '<span class="rcl-news-badge-top">RD</span><span class="rcl-news-badge-bottom">' + (n < 10 ? '0' + n : String(n)) + '</span>');
}

function rccOpenStory(startIndex) {
  var list = RCC.storyList || [];
  if (!list.length) return;
  var m = rccOpenModal('Season Stories', { wide: true });
  m.dialog.classList.add('rcc-story-dialog');
  var shownUpTo = startIndex;
  var more = _rccEl('div', 'rcl-modal-loadmore-wrap');
  var moreBtn = _rccText('button', 'rcl-modal-loadmore-btn', 'Load More Stories');
  moreBtn.type = 'button';
  more.appendChild(moreBtn);
  function add(s) {
    var w = _rccEl('div', 'rcl-news-item rcl-modal-story');
    // Badge to the left of the title and date, like the League News popup (Matt, 2026-10-13).
    w.appendChild(_rccStoryHeadRow(s));
    if (s.standfirst) w.appendChild(_rccText('p', 'rcc-story-standfirst', s.standfirst));
    var b = _rccEl('div', 'rcl-news-body');
    _rccStoryBlocks(b, s.body);
    _rccPlaceStoryPhotos(b, s);
    w.appendChild(b);
    if (s.kind === 'preview' && RCC.page && RCC.page.hasSeason) {
      // Season Details / Championship Points / Race Rules always close the Season Preview story, drawn from the live season data.
      var det = _rccEl('div', 'rcl-story-details');
      var detIn = _rccEl('div', 'rcl-seasonfmt-modal-body rcl-story-details-body');
      _rccSeasonFormat(RCC.page, detIn);
      det.appendChild(detIn);
      w.appendChild(det);
    }
    w.appendChild(_rccStoryVote(s));
    m.body.appendChild(w);
  }
  add(list[startIndex]);
  // Shows just the story that was clicked (no Load More), like the League Hub.
  function vis() { more.style.display = 'none'; }
  vis();
  moreBtn.addEventListener('click', function () {
    m.body.removeChild(more);
    for (var n = 0; n < 3 && shownUpTo + 1 < list.length; n++) { shownUpTo++; add(list[shownUpTo]); }
    m.body.appendChild(more);
    vis();
  });
}

// Writes the next missing story, then the next, refreshing the box after each one.
function rccRunStoryQueue(page) {
  if (!page || !page.hasSeason || RCC.storyWriting) return;
  var q = page.storyQueue || [];
  if (!q.length) return;
  var next = q[0];
  RCC.storyWriting = next;
  RCC.storyFailed = null;
  rccRenderStories(page);
  _rccApi('champStory', { op: 'generate', seasonId: page.seasonId, kind: next.kind, roundId: next.roundId || '' }, { timeoutMs: 330000 }).then(function (res) {
    RCC.storyWriting = null;
    if (_rccHandleAuthError(res)) return;
    // The server's own reason shows under the notice, so a setup problem can be spotted.
    // Another request (a retry of this one) is already writing it: wait for it instead.
    if (res && res.success && res.already && res.status === 'writing') { RCC.storyWriting = next; rccRenderStories(page); _rccWatchStory(page, next, Date.now() + 6 * 60 * 1000); return; }
    if (!res || !res.success) { RCC.storyFailed = next; RCC.storyFailedWhy = (res && res.message) || (res ? 'The story could not be written this time.' : 'No answer from the server.'); rccRenderStories(page); return; }
    return _rccApi('champStory', { op: 'list', seasonId: page.seasonId }).then(function (lr) {
      if (lr && lr.success) { page.stories = lr.stories; page.storyQueue = lr.queue; }
      rccRenderStories(page);
      if (lr && lr.success && lr.queue.length) rccRunStoryQueue(page);
    });
  }).catch(function () {
    // The browser can give up on a long request while Apps Script is still writing the story (a full
    // column can take a few minutes). Keep checking the story list for up to 6 more minutes before
    // calling it a failure, and keep the "Writing..." notice up meanwhile.
    _rccWatchStory(page, next, Date.now() + 6 * 60 * 1000);
  });
}

function _rccWatchStory(page, item, until) {
  setTimeout(function () {
    _rccApi('champStory', { op: 'list', seasonId: page.seasonId }).then(function (lr) {
      if (!lr || !lr.success) throw new Error('list');
      var key = function (s) { return item.kind === 'preview' ? s.kind === 'preview' : s.roundId === item.roundId; };
      var mine = (lr.stories || []).filter(key)[0];
      if (mine && mine.status === 'writing' && Date.now() < until) { _rccWatchStory(page, item, until); return; }
      RCC.storyWriting = null;
      page.stories = lr.stories; page.queue = lr.queue; page.storyQueue = lr.queue;
      if (!mine || mine.status !== 'published') { RCC.storyFailed = item; RCC.storyFailedWhy = mine && mine.status === 'failed' ? 'The writer stopped before finishing. Retry the story.' : 'No answer from the server.'; }
      rccRenderStories(page);
      if (mine && mine.status === 'published' && lr.queue.length) rccRunStoryQueue(page);
    }).catch(function () {
      if (Date.now() < until) { _rccWatchStory(page, item, until); return; }
      RCC.storyWriting = null; RCC.storyFailed = item; RCC.storyFailedWhy = 'No answer from the server.'; rccRenderStories(page);
    });
  }, 20000);
}

// ---------------------------------------------------------------------
// RACE SETUP GUIDE (Matt, 2026-11-06). Shows each Le Mans Ultimate screen (assets/championship_help/)
// with the player's own season and round values laid over the game's values, so they can match 1:1.
// Colours: red = must match or the upload is refused, blue = should match for accurate records,
// grey = the driver's choice. Item boxes are in the screenshots' displayed pixel space (W x H below)
// and converted to percentages, so they scale with the picture.
// ---------------------------------------------------------------------
var RCC_SG_LEVEL = {
  must: { cls: 'rcc-sg-must', name: 'Must match or the upload is refused' },
  should: { cls: 'rcc-sg-should', name: 'Should match for accurate records' },
  free: { cls: 'rcc-sg-free', name: 'Your choice' }
};
var RCC_SG_IMG = 'assets/championship_help/';

function _rccSgClock(min) {
  var h = Math.floor(min / 60), m = min % 60;
  return h + (m ? ' hrs ' + m + ' mins' : ' hrs');
}
function _rccSgPreset(p) {
  var s = String(p || 'Sunny').toLowerCase();
  if (s.indexOf('real') !== -1) return 3;
  if (s.indexOf('rain') !== -1) return 2;
  if (s.indexOf('cloud') !== -1) return 1;
  return 0;
}

// Values the guide needs, from the season and the chosen round.
function _rccSgContext(page, c) {
  var d = page.seasonDetails || {};
  var rs = d.raceSettings || {};
  var classes = Object.keys(d.classes || {}).filter(function (k) { return d.classes[k]; });
  var yr = d.seasonYear || (classes.length ? (d.classSeasons || {})[classes[0]] : '');
  var mins = Number(c.raceLengthAsRaced ? c.plannedRaceLengthMinutes : c.raceLengthMinutes) || 0;
  var tod = _rccTimeOfDay(c.igRaceStart) || 'Midday';
  return {
    d: d, rs: rs, classes: _rccSortClasses(classes, function (k) { return k; }), year: yr, series: d.series || 'WEC',
    mins: mins, h: Math.floor(mins / 60), m: mins % 60, tod: tod, clock: RCC_START_CLOCK[tod],
    preset: _rccSgPreset(c.weatherPreset), presetName: c.weatherPreset || 'Sunny',
    counts: null, round: c, shot: (_rccSgTrackShot(c) || {}).file || '', hasShot: !!_rccSgTrackShot(c), shotQOff: !!(_rccSgTrackShot(c) || {}).qOff, reg: page.registration || null,
    teamLine: (function () {
      var r = page.registration || {};
      if (!r.teamName) return { name: 'YOUR TEAM NAME #NN', car: 'YOUR CAR' };
      var mk = String(r.manufacturer || '').trim(), md = String(r.carModel || '').trim();
      var car = (mk && md.toLowerCase().indexOf(mk.toLowerCase()) !== 0) ? mk + ' ' + md : (md || mk);
      return { name: (String(r.teamName) + (r.carNumber ? ' #' + r.carNumber : '')).toUpperCase(), car: car.toUpperCase() || 'YOUR CAR' };
    })(),
    qual: rs.qualifying !== 'No', rolling: rs.raceStart === 'Fast' ? 'Fast Rolling' : 'Rolling'
  };
}

// Fonts that stand in for the game's: a tall condensed one for names, a wide one for the outlined location line.
function _rccSgFonts() {
  if (document.getElementById('rcc-sg-fonts')) return;
  var l = document.createElement('link');
  l.id = 'rcc-sg-fonts'; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Syncopate:wght@700&display=swap';
  document.head.appendChild(l);
}
// Text that keeps the game's letter height and is squeezed sideways (never wrapped) when it would run past its box.
function _rccSgSqueeze(el, text, fontCqw, wCqw) {
  el.textContent = text;
  el.style.fontSize = fontCqw + 'cqw';
  el.setAttribute('data-fit', '1');
}
// Once on screen (and again when the web fonts arrive): squeeze each fitted line to its box, shrinking the type if it would need more than 45%.
function _rccSgFit(root) {
  var list = root.querySelectorAll('[data-fit]');
  for (var n = 0; n < list.length; n++) {
    var el = list[n], box = el.parentNode;
    el.style.transform = '';
    var base = parseFloat(el.style.fontSize);
    if (!el.getAttribute('data-base')) el.setAttribute('data-base', base); else base = parseFloat(el.getAttribute('data-base'));
    el.style.fontSize = base + 'cqw';
    var avail = box.clientWidth, nat = el.offsetWidth;
    if (!avail || !nat || nat <= avail) continue;
    var k = avail / nat;
    if (k < 0.55) { el.style.fontSize = (base * k / 0.55).toFixed(2) + 'cqw'; k = 0.55; }
    el.style.transform = 'scaleX(' + k.toFixed(3) + ')';
  }
}
// Matt's Event Settings screenshot for each track (assets/championship_help/05-<name>.jpg). The names are his file names, typos included.
var RCC_SG_SHOTS = [
  [/bahrain|sakhir/, '05-bahrain.jpg'], [/barcelona|catalunya|cataluyna|montmel/, '05-cataluyna.jpg'], [/americas|cota|austin/, '05-COTA.jpg', 1],
  [/daytona/, '05-daytona.jpg', 1], [/fuji/, '05-fuji.jpg'], [/imola|enzo/, '05-imola.jpg'], [/interlagos|paulo/, '05-interlagos.jpg'],
  [/laguna/, '05-laguna.jpg'], [/le mans|sarthe/, '05-le mans.jpg'], [/long beach/, '05-long beach.jpg'], [/lusail|qatar/, '05-lusail.jpg'],
  [/monza/, '05-monza.jpg'], [/ricard|castellet/, '05-paul ricard.jpg'], [/portim|algarve/, '05-portimao.jpg'],
  [/road atlanta|petit/, '05-road atlants.jpg'], [/sebring/, '05-sebring.jpg'], [/spa|francorchamps/, '05-spa.jpg']
];
function _rccSgTrackShot(c) {
  var t = (String((c && c.trackName) || '') + ' ' + String((c && c.track) || '')).toLowerCase();
  for (var n = 0; n < RCC_SG_SHOTS.length; n++) if (RCC_SG_SHOTS[n][0].test(t)) return { file: encodeURI(RCC_SG_SHOTS[n][1]), qOff: !!RCC_SG_SHOTS[n][2] };
  return null;
}
function _rccSgCarName(r) {
  var mk = String((r && r.manufacturer) || '').trim(), md = String((r && r.carModel) || '').trim();
  return (mk && md.toLowerCase().indexOf(mk.toLowerCase()) !== 0) ? (mk + ' ' + md).trim() : (md || mk);
}
// Splits a team line into two balanced lines at a space (the game wraps a long team name the same way).
function _rccSgSplit(text) {
  var words = text.split(' ');
  if (words.length < 2) return [text];
  var best = 1, bestDiff = 1e9;
  for (var k = 1; k < words.length; k++) {
    var a = words.slice(0, k).join(' ').length, b = words.slice(k).join(' ').length;
    if (Math.abs(a - b) < bestDiff) { bestDiff = Math.abs(a - b); best = k; }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}
// Event Settings, right side: the maker's logo left of the game's vertical line, the team name, number and car name to the
// right of it, and the car's livery underneath. With no screenshot for the track, the round's track is drawn too.
function _rccSgHeader(scr, x) {
  var c = x.round || {};
  var r = x.reg || {};
  // The Qualifying card follows the season's setting (On / Off). A real card from Matt's screenshots is laid over the
  // screenshot's own card only when the two disagree.
  if (x.hasShot && x.qual === x.shotQOff) scr.items.push({ kind: 'ov', x: 563, y: 459, w: 379, h: 204, build: function (b) {
    var im = document.createElement('img'); im.className = 'rcc-sg-ov-qcard'; im.alt = ''; im.src = 'assets/championship_help/' + (x.qual ? 'q-on.webp' : 'q-off.webp'); b.appendChild(im);
  } });
  if (!x.hasShot) {
    var flagSrc = (c.country && typeof countryFlagSrc === 'function') ? countryFlagSrc(c.country) : '';
    if (flagSrc) scr.items.push({ kind: 'ov', x: 188, y: 153, w: 150, h: 92, build: function (b) {
      var im = document.createElement('img'); im.src = flagSrc; im.alt = c.country; im.className = 'rcc-sg-ov-flag'; b.appendChild(im);
    } });
    var tn = String(c.trackName || c.track || '').toUpperCase();
    if (tn) scr.items.push({ kind: 'ov', x: 356, y: 140, w: 1110, h: 110, build: function (b) {
      var t = _rccEl('span', 'rcc-sg-ov-title'); _rccSgSqueeze(t, tn, 6.6); b.appendChild(t);
    } });
    var place = [c.region, c.country].filter(Boolean).join(', ').toUpperCase();
    if (place) scr.items.push({ kind: 'ov', x: 190, y: 270, w: 1260, h: 70, build: function (b) {
      var t = _rccEl('span', 'rcc-sg-ov-place'); _rccSgSqueeze(t, place, 2.6); b.appendChild(t);
    } });
  }
  if (!r.teamName) return;
  if (r.manufacturer) scr.items.push({ kind: 'ov', x: 1420, y: 462, w: 112, h: 104, build: function (b) {
    var im = document.createElement('img'); im.className = 'rcc-sg-ov-logo'; im.alt = '';
    im.src = manufacturerLogoSrc(r.manufacturer, 'white');
    manufacturerLogoFallback(im, r.manufacturer, function () { im.style.display = 'none'; });
    b.appendChild(im);
  } });
  var tl = (String(r.teamName) + (r.carNumber ? ' #' + r.carNumber : '')).toUpperCase();
  var car = _rccSgCarName(r).toUpperCase();
  scr.items.push({ kind: 'ov', x: 1613, y: 462, w: 355, h: 180, build: function (b) {
    b.classList.add('rcc-sg-ov-teambox');
    (tl.length > 22 ? _rccSgSplit(tl) : [tl]).forEach(function (ln) {
      var d = _rccEl('div', 'rcc-sg-ov-teamline'); var t = _rccEl('span', 'rcc-sg-ov-team'); _rccSgSqueeze(t, ln, 3.2); d.appendChild(t); b.appendChild(d);
    });
    if (car) { var d2 = _rccEl('div', 'rcc-sg-ov-carline'); var t2 = _rccEl('span', 'rcc-sg-ov-carname'); _rccSgSqueeze(t2, car, 1.4); d2.appendChild(t2); b.appendChild(d2); }
  } });
  if (r.carNumber && x.year) scr.items.push({ kind: 'ov', x: 1420, y: 680, w: 520, h: 190, build: function (b) {
    var im = document.createElement('img'); im.className = 'rcc-sg-ov-car'; im.alt = '';
    _rccCarImg(im, x.year, r.carNumber, x.series, function () { im.style.display = 'none'; });
    b.appendChild(im);
  } });
}

// One screen: { img, W, H, title, intro, items: [{ x, y, w, h, kind, level, text, label, value }] }.
// kind 'chip' covers the game's value with ours, 'box' only outlines, 'slider' draws the difficulty slider.
function _rccSgScreens(x) {
  var rs = x.rs, d = x.d;
  var wearTxt = _rccMultLabel(rs.tireWearMultiplier), fuelTxt = _rccMultLabel(rs.fuelMultiplier);
  var timeTxt = _rccTimeScaleLabel(rs.timeScale), rrTxt = _rccTimeScaleLabel(rs.realRoadTimeScale || 'Normal');
  var pct = Number(rs.aiDifficulty) || 0;
  var lenShort = (x.h ? x.h + 'H' : '') + (x.m ? (x.h ? ' ' : '') + x.m + 'M' : '');
  var startShort = x.rolling === 'Rolling' ? 'ROLLING' : 'FAST';
  var seasonTab = (x.year ? x.year + ' ' : '') + 'SEASON';
  var screens = [];

  // 05 Event Settings
  var s5 = { img: x.hasShot ? x.shot : '05-no-track.jpg', W: 2000, H: 1123, title: 'Event Settings', intro: 'This is the first screen you see after choosing your track and car. Match the red and blue values, then click Advanced Settings to adjust the AI Difficulty, Session details, Weather forecast and Advanced settings.', items: [] };
  _rccSgHeader(s5, x);
  s5.items.push({ kind: 'box', level: 'free', x: 167, y: 462, w: 376, h: 198, label: 'Practice', value: 'Your choice. Practice is never uploaded.' });
  s5.items.push({ kind: 'box', level: x.qual ? 'free' : 'should', x: 565, y: 462, w: 375, h: 198, label: 'Qualifying', value: x.qual ? 'On. The length is your choice.' : 'Off. Untick Qualifying so the race starts from a random grid.' });
  if (lenShort) s5.items.push({ kind: 'chip', level: 'must', x: 1198, y: 606, w: 74, h: 40, text: lenShort, label: 'Race Length', value: _rccSgClock(x.mins) + ' or longer' });
  s5.items.push({ kind: 'chip', level: 'should', x: 1022, y: 606, w: 96, h: 40, text: startShort, label: 'Race Start', value: x.rolling });
  s5.items.push({ kind: 'chip', level: 'must', x: 343, y: 693, w: 121, h: 38, light: true, text: seasonTab, label: 'Starting Grid', value: (x.year ? x.year + ' Season' : 'Your season') + '. Never Fill Grid.' });
  // Only the classes that have cars for this season's series and year (from the uploaded car list); until that list has loaded, the season's own classes.
  var CL = { Hypercar: ['HY', 'HYPERCAR'], LMP2: ['P2', 'LMP2'], LMP3: ['P3', 'LMP3'], LMGT3: ['GT3', 'LMGT3'], LMGTE: ['GTE', 'LMGTE'] };
  var shown = RCC_CLASS_ORDER.filter(function (k) { return x.counts ? x.counts[k] > 0 : x.classes.indexOf(k) !== -1; });
  // The screenshot's own three tiles stay under ours; cover whatever ours leave uncovered.
  if (shown.length < 3) s5.items.push({ kind: 'cover', level: 'free', x: 167 + shown.length * 158 - 6, y: 742, w: 640 - (167 + shown.length * 158 - 6), h: 134 });
  shown.forEach(function (k, i) {
    var cnt = x.counts ? x.counts[k] : null;
    s5.items.push({ kind: 'class', level: 'must', x: 167 + i * 158, y: 747, w: 145, h: 122, big: CL[k][0], sub: CL[k][1], count: (cnt === null || cnt === undefined) ? '' : String(cnt), on: x.classes.indexOf(k) !== -1,
      label: i === 0 ? 'Classes on the grid' : '', value: 'Tick only ' + (x.classes.join(', ') || 'your season’s classes') });
  });
  if (d.trackLimitsPreset) s5.items.push({ kind: 'chip', level: 'should', x: 368, y: 957, w: 136, h: 46, text: String(d.trackLimitsPreset).toUpperCase(), label: 'Rules', value: d.trackLimitsPreset });
  if (rs.fuelMultiplier) s5.items.push({ kind: 'chip', level: 'should', x: 580, y: 957, w: 84, h: 46, text: fuelTxt, label: 'Fuel Usage', value: fuelTxt });
  if (rs.tireWearMultiplier) s5.items.push({ kind: 'chip', level: 'should', x: 732, y: 957, w: 84, h: 46, text: wearTxt, label: 'Tyre Wear', value: wearTxt });
  if (rs.tireWarmers) s5.items.push({ kind: 'chip', level: 'should', x: 888, y: 957, w: 84, h: 46, text: String(rs.tireWarmers).toUpperCase(), label: 'Tyre Warmers', value: String(rs.tireWarmers).toUpperCase() });
  if (rs.tireCount) s5.items.push({ kind: 'chip', level: 'should', x: 1048, y: 957, w: 60, h: 46, text: String(rs.tireCount), label: 'Available Tyres', value: String(rs.tireCount) });
  screens.push(s5);

  // 09 Difficulty
  var s9 = { img: '09.jpg', W: 2000, H: 1123, title: 'Difficulty', intro: 'Use the arrows on each row until the game shows the same value.', items: [] };
  if (pct) s9.items.push({ kind: 'slider', level: 'should', x: 1040, y: 323, w: 458, h: 40, pct: pct, text: _rccSkillLevel(pct) + ' (' + pct + '%)', label: 'Opponent Difficulty', value: _rccSkillLevel(pct) + ' (' + pct + '%)' });
  if (rs.damage) s9.items.push({ kind: 'chip', level: 'should', x: 1352, y: 372, w: 156, h: 34, text: rs.damage, drop: true, label: 'Damage Simulation', value: rs.damage });
  [['Tyre Wear', rs.tireWearMultiplier, wearTxt, 418], ['Tyre Warmers', rs.tireWarmers, rs.tireWarmers, 464], ['Available Tyres', rs.tireCount, String(rs.tireCount), 510], ['Fuel Usage', rs.fuelMultiplier, fuelTxt, 556]].forEach(function (r) {
    if (r[1]) s9.items.push({ kind: 'chip', level: 'should', x: 1330, y: r[3], w: 122, h: 34, text: r[2], label: r[0], value: r[2] });
  });
  s9.items.push({ kind: 'box', level: 'free', x: 492, y: 640, w: 1026, h: 335, label: 'Your Assists', value: 'Your choice.' });
  screens.push(s9);

  // 06 Sessions
  var s6 = { img: '06.jpg', W: 2000, H: 1581, title: 'Sessions', intro: 'Scroll down in the game to reach the Race section. The Race Time is the one that must match.', items: [] };
  s6.items.push({ kind: 'box', level: 'free', x: 492, y: 255, w: 996, h: 392, label: 'Practice', value: 'Your choice. Practice is never uploaded.' });
  s6.items.push({ kind: 'chip', level: 'should', x: 1330, y: 600, w: 90, h: 36, text: rrTxt, label: 'Practice RealRoad Time Scale', value: rrTxt });
  s6.items.push({ kind: 'box', level: 'free', x: 492, y: 676, w: 996, h: 344, label: 'Qualifying', value: 'The length, start time and grip are your choice.' });
  s6.items.push({ kind: 'chip', level: x.qual ? 'should' : 'should', x: 1384, y: 748, w: 104, h: 36, text: x.qual ? 'On' : 'Off', label: 'Qualifying', value: x.qual ? 'On' : 'Off' });
  s6.items.push({ kind: 'chip', level: 'must', x: 1190, y: 1166, w: 66, h: 36, text: x.h + ' hrs', label: 'Race Time (hours)', value: x.h + ' hrs' });
  s6.items.push({ kind: 'chip', level: 'must', x: 1330, y: 1166, w: 90, h: 36, text: x.m + ' mins', label: 'Race Time (minutes)', value: x.m + ' mins' });
  s6.items.push({ kind: 'chip', level: 'should', x: 1316, y: 1212, w: 104, h: 36, text: x.clock, label: 'Race Start Time (' + x.tod + ')', value: x.clock });
  s6.items.push({ kind: 'chip', level: 'should', x: 1290, y: 1258, w: 130, h: 36, text: x.rolling, label: 'Race Start Type', value: x.rolling });
  if (!x.qual) s6.items.push({ kind: 'chip', level: 'should', x: 1330, y: 1303, w: 90, h: 36, text: 'Random', label: 'Grid Position', value: 'Random' });
  s6.items.push({ kind: 'box', level: 'free', x: 492, y: 1346, w: 996, h: 92, label: 'Race Starting Grip and RealRoad Wet', value: 'Your choice.' });
  s6.items.push({ kind: 'chip', level: 'should', x: 1330, y: 1440, w: 90, h: 36, text: rrTxt, label: 'Race RealRoad Time Scale', value: rrTxt });
  screens.push(s6);

  // 07 Weather
  var s7 = { img: '07.jpg', W: 2000, H: 1267, title: 'Weather', intro: 'Click the same preset button in Practice, Qualifying and Race. The game fills in the sky, rain chance and temperature for you, so the preset buttons are the only part to match.', items: [] };
  var px = [278, 345, 412, 480];
  [['Practice', 321], ['Qualifying', 649], ['Race', 985]].forEach(function (r) {
    s7.items.push({ kind: 'box', level: 'should', x: px[x.preset] - 27, y: r[1] - 27, w: 54, h: 54, label: r[0] + ' preset', value: x.presetName });
  });
  screens.push(s7);

  // 08 Advanced
  var s8 = { img: '08.jpg', W: 2000, H: 1124, title: 'Advanced', intro: 'Use the arrows on each row until the game shows the same value.', items: [] };
  [['Time Scale', rs.timeScale ? timeTxt : '', 343], ['Flag Rules', rs.flagRules, 389], ['Track Limits Rules', d.trackLimitsPreset, 435], ['Mechanical Failures', rs.mechanicalFailures, 481], ['AI Aggression', rs.aiAggression, 527], ['Track Limits Points Allowed', rs.trackLimitPoints, 573]].forEach(function (r) {
    if (r[1] === '' || r[1] === undefined || r[1] === null) return;
    s8.items.push({ kind: 'chip', level: 'should', x: 1290, y: r[2] - 17, w: 158, h: 34, text: String(r[1]), label: r[0], value: String(r[1]) });
  });
  screens.push(s8);
  return screens;
}

// Greyed-out car drawn over the game's car picture (Event Settings guide).
var RCC_SG_CAR_SVG = '<svg viewBox="0 0 490 165" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g fill="#5b6672"><path d="M30 112c4-18 20-28 52-33l92-28c24-9 52-14 80-14 30 0 52 6 70 16l62 22c40 6 60 14 70 30 4 8 2 16-4 20H38c-8 0-10-6-8-13z"/><path d="M150 52l40-22c20-9 70-9 96 2l30 20z" fill="#76828f"/></g><g fill="#2a3139"><circle cx="118" cy="124" r="30"/><circle cx="388" cy="124" r="30"/></g><g fill="#7c8793"><circle cx="118" cy="124" r="14"/><circle cx="388" cy="124" r="14"/></g></svg>';

function _rccSgPct(v, total) { return (v / total * 100).toFixed(3) + '%'; }

function _rccSgFigure(scr) {
  var fig = _rccEl('div', 'rcc-sg-fig');
  var scroll = _rccEl('div', 'rcc-sg-scroll');
  var shot = _rccEl('div', 'rcc-sg-shot');
  var img = document.createElement('img');
  img.src = RCC_SG_IMG + scr.img;
  img.alt = 'Le Mans Ultimate ' + scr.title + ' screen';
  img.loading = 'lazy';
  shot.appendChild(img);
  scr.items.forEach(function (it) {
    var lvl = RCC_SG_LEVEL[it.level || 'free'];
    var box = _rccEl('div', 'rcc-sg-item rcc-sg-' + it.kind + ' ' + lvl.cls);
    box.style.left = _rccSgPct(it.x, scr.W);
    box.style.top = _rccSgPct(it.y, scr.H);
    box.style.width = _rccSgPct(it.w, scr.W);
    box.style.height = _rccSgPct(it.h, scr.H);
    var wc = it.w / scr.W * 100, hc = it.h / scr.W * 100;
    if (it.kind === 'ov') { box.className = 'rcc-sg-item rcc-sg-ov'; it.build(box); } else if (it.kind === 'class') {
      box.className += ' ' + (it.on ? 'rcc-sg-class-on' : 'rcc-sg-class-off');
      var ck = _rccEl('span', 'rcc-sg-class-check', it.on ? '&#10003;' : '');
      ck.style.fontSize = '0.5cqw';
      box.appendChild(ck);
      var bg = _rccText('span', 'rcc-sg-class-big', it.big);
      bg.style.fontSize = '2cqw';
      box.appendChild(bg);
      var sb = _rccEl('span', 'rcc-sg-class-sub');
      sb.style.fontSize = Math.min(hc * 0.12, (wc - 1.2) / ((it.sub.length + (it.count ? it.count.length + 1 : 0)) * 0.62)).toFixed(2) + 'cqw';
      sb.appendChild(_rccText('span', '', it.sub));
      if (it.count) sb.appendChild(_rccText('span', '', it.count));
      box.appendChild(sb);
    } else if (it.kind === 'plate') {
      var p1 = _rccText('span', 'rcc-sg-plate-name', it.name);
      p1.style.fontSize = Math.min(hc * 0.2, (wc - 1.6) / (Math.max(1, it.name.length) * 0.62)).toFixed(2) + 'cqw';
      var p2 = _rccText('span', 'rcc-sg-plate-car', it.car);
      p2.style.fontSize = Math.min(hc * 0.1, (wc - 1.6) / (Math.max(1, it.car.length) * 0.7)).toFixed(2) + 'cqw';
      box.appendChild(p1); box.appendChild(p2);
    } else if (it.kind === 'car') {
      box.innerHTML = RCC_SG_CAR_SVG;
    } else if (it.kind === 'chip') {
      var t = _rccText('span', 'rcc-sg-chip-text', it.text);
      var avail = wc - 0.9 - (it.drop ? 1.6 : 0);
      t.style.fontSize = Math.min(1.05, avail / (Math.max(1, String(it.text).length) * 0.72), hc * 0.62).toFixed(2) + 'cqw';
      if (it.light) box.className += ' rcc-sg-light';
      box.appendChild(t);
      if (it.drop) box.appendChild(_rccEl('span', 'rcc-sg-chip-caret', '&#9662;'));
    } else if (it.kind === 'slider') {
      var st = _rccText('span', 'rcc-sg-slider-text', it.text);
      st.style.fontSize = Math.min(1.05, (wc * 0.5) / (Math.max(1, String(it.text).length) * 0.72)).toFixed(2) + 'cqw';
      box.appendChild(st);
      var track = _rccEl('span', 'rcc-sg-slider-track');
      var handle = _rccEl('span', 'rcc-sg-slider-handle');
      handle.style.left = (((it.pct - 75) / 30) * 100).toFixed(1) + '%';
      track.appendChild(handle);
      box.appendChild(track);
    }
    shot.appendChild(box);
  });
  scroll.appendChild(shot);
  fig.appendChild(scroll);
  var legend = _rccEl('ul', 'rcc-sg-legend');
  scr.items.forEach(function (it) {
    if (!it.label) return;
    legend.appendChild(_rccEl('li', 'rcc-sg-legend-row ' + RCC_SG_LEVEL[it.level].cls, '<span class="rcc-sg-dot"></span><span class="rcc-sg-legend-label">' + _rccEsc(it.label) + '</span><span class="rcc-sg-legend-value">' + _rccEsc(it.value) + '</span>'));
  });
  fig.appendChild(legend);
  return fig;
}

// The two menu screens cannot be simulated, so they get a highlighted box and a reminder.
function _rccSgMenuFigure(img, W, H, boxes, caption) {
  var fig = _rccEl('div', 'rcc-sg-fig rcc-sg-fig-small');
  var shot = _rccEl('div', 'rcc-sg-shot');
  var im = document.createElement('img');
  im.src = RCC_SG_IMG + img;
  im.alt = caption;
  im.loading = 'lazy';
  shot.appendChild(im);
  boxes.forEach(function (b) {
    var box = _rccEl('div', 'rcc-sg-item rcc-sg-box rcc-sg-must');
    box.style.left = _rccSgPct(b[0], W); box.style.top = _rccSgPct(b[1], H);
    box.style.width = _rccSgPct(b[2], W); box.style.height = _rccSgPct(b[3], H);
    shot.appendChild(box);
  });
  fig.appendChild(shot);
  return fig;
}

function rccOpenSetupGuide(roundNum) {
  var page = RCC.page;
  var cal = page.calendar || [];
  if (!cal.length) { _rccToast('This season has no rounds yet.', 'error'); return; }
  var current = cal[0];
  cal.forEach(function (c) { if (roundNum && Number(c.roundNum) === Number(roundNum)) current = c; });
  _rccSgFonts();
  var m = rccOpenModal('Race Setup Guide', { wide: true });
  m.dialog.classList.add('rcc-light-dialog');
  m.body.classList.add('rcc-sg-body');

  var top = _rccEl('div', 'rcc-sg-top');
  var sel = _rccSelect(cal.map(function (c) { return { label: 'Round ' + c.roundNum + ' · ' + c.eventName + ' (' + c.track + ')', value: String(c.roundNum) }; }), String(current.roundNum), function (v) {
    cal.forEach(function (c) { if (String(c.roundNum) === String(v)) current = c; });
    render();
  });
  top.appendChild(_rccField('Round', sel));
  var key = _rccEl('div', 'rcc-sg-key');
  ['must', 'should', 'free'].forEach(function (k) {
    key.appendChild(_rccEl('span', 'rcc-sg-key-item ' + RCC_SG_LEVEL[k].cls, '<span class="rcc-sg-dot"></span>' + _rccEsc(RCC_SG_LEVEL[k].name)));
  });
  top.appendChild(key);
  m.body.appendChild(top);
  var holder = _rccEl('div', 'rcc-sg-holder');
  m.body.appendChild(holder);

  function section(title, text) {
    var s = _rccEl('div', 'rcc-sg-section');
    s.appendChild(_rccText('div', 'rcc-sg-section-title', title));
    if (text) s.appendChild(_rccText('p', 'rcc-sg-section-text', text));
    return s;
  }
  var carCounts = null;
  function render() {
    holder.innerHTML = '';
    var x = _rccSgContext(page, current);
    x.counts = carCounts;

    var s0 = section('Start a Single Player Session');
    var pair = _rccEl('div', 'rcc-sg-pair');
    var a = _rccEl('div', 'rcc-sg-pair-item');
    a.appendChild(_rccText('div', 'rcc-sg-step', '1. Choose RACE WEEKEND'));
    a.appendChild(_rccSgMenuFigure('00.jpg', 2000, 1124, [[56, 274, 436, 115]], 'Le Mans Ultimate main menu'));
    pair.appendChild(a);
    var b = _rccEl('div', 'rcc-sg-pair-item');
    var yrs = { WEC: { 2026: [624, 830, 60, 44], 2025: [696, 830, 60, 44], 2024: [768, 830, 62, 44], 2023: [841, 830, 62, 44] }, ELMS: { 2026: [1297, 570, 62, 44], 2025: [1369, 570, 62, 44] } };
    var ser = String(x.series).toUpperCase() === 'ELMS' ? 'ELMS' : 'WEC';
    var yb = (yrs[ser] || {})[x.year];
    b.appendChild(_rccText('div', 'rcc-sg-step', '2. Choose ' + ser + (x.year ? ' ' + x.year : '')));
    b.appendChild(_rccSgMenuFigure('01.jpg', 2000, 1122, yb ? [yb] : [], 'Le Mans Ultimate series picker'));
    pair.appendChild(b);
    s0.appendChild(pair);
    var rg = page.registration || {};
    var carNm = _rccSgCarName(rg);
    var trackBold = '<strong>' + _rccEsc(current.track || current.trackName || 'the track') + (current.layout ? ', ' + _rccEsc(current.layout) + ' layout' : '') + '</strong>';
    var carBold = rg.teamName ? ' (<strong>' + _rccEsc(rg.teamName) + (rg.carNumber ? ' #' + _rccEsc(rg.carNumber) : '') + (carNm ? ', ' + _rccEsc(carNm) : '') + (rg.carClass ? ' in the ' + _rccEsc(rg.carClass) + ' class' : '') + '</strong>)' : '';
    s0.appendChild(_rccEl('p', 'rcc-sg-section-text', 'Then pick the round’s track (' + trackBold + ') on the Circuit tab and your team’s car' + carBold + ' on the Car tab. If the track is missing, switch the filter to All.'));
    holder.appendChild(s0);

    _rccSgScreens(x).forEach(function (scr, i) {
      var s = section((i + 1) + '. ' + scr.title, scr.intro);
      s.appendChild(_rccSgFigure(scr));
      holder.appendChild(s);
    });
    _rccSgFit(holder);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { _rccSgFit(holder); });
  }
  render();
  // Number of cars in each class for this season's series and year, from the same car list the season wizard uses.
  fetchApi('getCars', { token: RCC.token }).then(function (res) {
    var cars = ((res && res.cars) || []).filter(function (c) { return (c.Active || 'Active') !== 'Inactive'; });
    var d = page.seasonDetails || {};
    var series = String(d.series || 'WEC').toUpperCase() === 'ELMS' ? 'ELMS' : 'WEC';
    var out = {};
    RCC_CLASS_ORDER.forEach(function (cls) {
      var yr = String((d.classSeasons || {})[cls] || d.seasonYear || '');
      out[cls] = cars.filter(function (c) { return _rccClassKey(c.Class) === cls && String(c.Season) === yr && _rccCarSeries(c) === series; }).length;
    });
    carCounts = out;
    render();
  }).catch(function () { /* counts just stay blank */ });
}
