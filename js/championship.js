// Race Club -- js/championship.js
// Backs championship.html, the single-player "offline" championship (CHAMP chat). The page is laid
// out exactly like the League Hub (league.html) and reuses css/league.css's class names, so it
// looks the same; css/championship.css swaps the colors to the light member-page palette.
//
// This is a separate file from js/league.js on purpose: league.js starts itself on load and talks
// to the online league's endpoints, so the renderers here are adapted copies (rcc- prefix) fed by
// the championship backend (Championship.gs, champ* actions) instead.
//
// Access: championship.html?id=<ProfileID>. Not logged in -> index.html. Logged in as anyone other
// than that ProfileID (or, for now, not an Admin) -> their own Account.html dashboard. The server
// checks the same thing on every call.

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
function _rccEsc(str) {
  var d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}
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
function _rccGo(url) { _rccCarryToasts(); window.location.href = url; }
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
function _rccClassLabel(cls) { return cls === 'Hypercar' ? 'Hypercar' : cls; }
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
  img.src = manufacturerLogoSrc(manufacturer, 'black');
  manufacturerLogoFallback(img, manufacturer, onFail || function () { img.style.display = 'none'; });
  return img;
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
  if (raw === null || raw === undefined || raw === '' || isNaN(t) || t <= 0) return '--';
  var ms = Math.round(t * 1000);
  var m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  return m + ':' + (s < 10 ? '0' : '') + s + '.' + ('00' + r).slice(-3);
}
function _rccTotalTime(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '--';
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
function _rccFormat12h(hhmm) {
  if (!hhmm) return '';
  var p = String(hhmm).split(':');
  var h = parseInt(p[0], 10);
  if (isNaN(h) || p.length < 2) return hhmm;
  return ((h % 12) || 12) + ':' + p[1] + ' ' + (h >= 12 ? 'PM' : 'AM');
}
function _rccTimeOfDay(hhmm) {
  var h = parseInt(String(hhmm || '').split(':')[0], 10);
  if (isNaN(h)) return '';
  if (h >= 5 && h < 12) return 'Morning';
  if (h >= 12 && h < 17) return 'Midday';
  if (h >= 17 && h < 21) return 'Evening';
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
  _rccCarryToasts();
  window.location.reload();
}

function _rccHidePageLoader() {
  var loader = document.getElementById('rcl-page-loader');
  if (!loader) return;
  loader.classList.add('rcl-page-loader-hidden');
  setTimeout(function () { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 450);
}

// Returns false (and navigates away) when this viewer may not see this page.
function _rccCheckAccess() {
  var token = getToken();
  if (!token) { window.location.replace('index.html'); return false; }
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
  if (me.profileId && (id !== me.profileId || !(me.role === 'Admin' || me.champAccess))) {
    window.location.replace('Account.html');
    return false;
  }
  RCC.ownerId = id;
  return true;
}

function _rccApi(action, params, opts) {
  opts = opts || {};
  var p = Object.assign({ ownerId: RCC.ownerId }, params || {});
  if (opts.post) {
    // Any save makes this browser's saved copies of the page out of date, so they're dropped the
    // moment a write succeeds: the reload that follows then waits for fresh data instead of
    // flashing the old page first.
    return fetchApi(action, { method: 'POST', token: RCC.token, params: { ownerId: RCC.ownerId }, body: p }).then(function (res) {
      if (res && res.success) _rccForgetSavedPages();
      return res;
    });
  }
  return fetchApi(action, { token: RCC.token, params: p, timeoutMs: opts.timeoutMs || RC_FETCH_TIMEOUT_MS_LONG });
}

// Server-side refusal -> the same redirects the page itself applies.
function _rccHandleAuthError(res) {
  if (!res || res.success) return false;
  if (res.error === 'NOT_AUTHENTICATED') { window.location.replace('index.html'); return true; }
  if (res.error === 'NOT_OWNER' || res.error === 'NOT_AVAILABLE') { window.location.replace('Account.html'); return true; }
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
  var overlay = _rccEl('div', 'rcl-modal-overlay rcl-modal-overlay-over-nav rcc-modal-overlay');
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
      _rccToast('No answer from the server after 6 minutes. Reload the page to see whether it went through.', 'error');
    });
  });
  return m;
}

// ---------------------------------------------------------------------
// HERO + BLACK LINK BAR
// ---------------------------------------------------------------------
function rccRenderHero(page) {
  var seasonEl = document.getElementById('rcl-hero-season');
  var metaEl = document.getElementById('rcc-hero-meta');
  seasonEl.innerHTML = '';
  metaEl.innerHTML = '';
  // No season yet: the hero shows just RACE CLUB / CHAMPIONSHIP (no season line).
  seasonEl.style.display = (page && page.hasSeason) ? '' : 'none';
  if (!page || !page.hasSeason) return;
  seasonEl.appendChild(_rccText('span', 'rcl-hero-season-num', 'Season ' + page.seasonNumber));
  seasonEl.appendChild(_rccText('span', 'rcl-hero-season-sep', ' / '));
  seasonEl.appendChild(_rccText('span', 'rcl-hero-season-name', page.seasonName));
  // "**Name** · [logo] Team **#n** · AI Difficulty N% · X of Y Rounds" (name and car number bold, Matt).
  var bits = [];
  var diff = (page.seasonDetails.raceSettings || {}).aiDifficulty;
  if (diff) bits.push('AI Difficulty ' + diff + '%');
  bits.push(page.roundsCompleted + ' of ' + page.totalRounds + ' Rounds');
  if (page.seasonEnded) bits.push('Season Ended');
  if (page.registration) {
    metaEl.appendChild(_rccText('strong', 'rcc-hero-meta-name', page.owner.displayName));
    metaEl.appendChild(document.createTextNode(' · '));
    if (page.registration.manufacturer) metaEl.appendChild(_rccLogo('rcc-hero-meta-logo', page.registration.manufacturer));
    metaEl.appendChild(document.createTextNode(page.registration.teamName + ' '));
    metaEl.appendChild(_rccText('strong', 'rcc-hero-meta-num', '#' + page.registration.carNumber));
    metaEl.appendChild(document.createTextNode(' · '));
  }
  metaEl.appendChild(document.createTextNode(bits.join(' · ')));
}

function rccRenderActionBar(page) {
  var bar = document.getElementById('rcc-actionbar');
  bar.innerHTML = '';
  var inner = _rccEl('div', 'rcc-actionbar-inner');
  bar.appendChild(inner);
  var links = _rccEl('div', 'rcc-actionbar-links');
  inner.appendChild(links);

  var hasSeason = !!(page && page.hasSeason);
  var active = hasSeason && !page.seasonEnded;
  function add(label, enabled, onClick, why) {
    var b = _rccText('button', 'rcc-actionbar-link', label);
    b.type = 'button';
    b.disabled = !enabled;
    if (!enabled && why) b.title = why;
    if (enabled) b.addEventListener('click', onClick);
    links.appendChild(b);
  }
  add('Create Season', !(page && page.hasActiveSeason), rccOpenSeasonWizard.bind(null, null), 'End your current season first.');
  add('Edit Season', active, function () { rccOpenSeasonWizard(page.seasonId); }, 'No active season to edit.');
  add('End Season', active, rccOpenEndSeason, 'No active season to end.');
  add('Delete Season', hasSeason, rccOpenDeleteSeason, 'No season to delete.');
  if (active && !page.registration) {
    add('Choose Your Team', true, rccOpenRegistration);
  } else {
    add('Team Information', hasSeason, rccOpenTeamInfo, 'No season yet.');
  }
  var cal = (page && page.calendar) || [];
  var anyEmpty = cal.some(function (c) { return !c.hasQualifyResults && !c.hasRaceResults; });
  var anyResults = cal.some(function (c) { return c.hasQualifyResults || c.hasRaceResults; });
  add('Upload Results', active && !!page.registration && anyEmpty, function () { rccOpenUpload(null, false); },
    !active ? 'No active season.' : (!page.registration ? 'Choose your team first.' : 'Every round already has results.'));
  add('Erase Results', active && anyResults, rccOpenErase, !active ? 'No active season.' : 'No results to erase yet.');
  add('Help', true, rccOpenHelp);

  // Past seasons -- a plain dropdown, shown only once there's more than one season.
  if (page && page.seasons && page.seasons.length > 1) {
    var pick = _rccEl('label', 'rcc-actionbar-season');
    pick.appendChild(_rccText('span', null, 'Season'));
    var sel = document.createElement('select');
    page.seasons.forEach(function (s) {
      var o = new Option('Season ' + s.seasonNumber + ' · ' + s.name + (s.status === 'Completed' ? ' (Ended)' : ''), s.seasonId);
      if (s.seasonId === page.seasonId) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      window.location.href = 'championship.html?id=' + encodeURIComponent(RCC.ownerId) + '&season=' + encodeURIComponent(sel.value);
    });
    pick.appendChild(sel);
    inner.appendChild(pick);
  }
}

// ---------------------------------------------------------------------
// TICKER (adapted from league.js's _rclBuildTickerItems/_rclRenderTicker)
// ---------------------------------------------------------------------
// Gaps are runs of non-breaking spaces (league.js does the same): a run of plain spaces collapses
// to a single space in HTML, which is what squeezed every entry together.
function _rccNbsp(n) { return document.createTextNode(new Array(n + 1).join('\u00a0')); }

function rccRenderTicker(page) {
  var track = document.getElementById('rcl-ticker-track');
  if (!track) return;
  track.innerHTML = '';
  if (!page || !page.hasSeason) { track.style.animation = 'none'; return; }
  var items = [];
  items.push({ tag: 'SEASON ' + page.seasonNumber, text: page.seasonName });
  var lr = page.lastRace;
  if (lr) {
    var groups = _rccSortClasses(lr.classes || [], function (c) { return c.className; }).map(function (cls) {
      return { tag: 'TOP TEN ' + cls.className.toUpperCase() + ' RESULTS', rows: (cls.standings || []).slice(0, 10) };
    });
    items.push({ tag: 'ROUND ' + lr.roundNum, bold: lr.eventName, dim: lr.track ? ' at ' + lr.track + (lr.layout ? ': ' + lr.layout : '') : '', groups: groups });
    var mfr = (page.standings.manufacturers || []).slice(0, 3);
    if (mfr.length && mfr.some(function (m) { return m.points > 0; })) items.push({ tag: 'TOP 3 MANUFACTURER STANDINGS', mfr: mfr });
  } else {
    // Before any results: one entry per car, its crew together ([logo] Driver, Driver, Driver #n).
    var byClass = {};
    (page.grid || []).forEach(function (g) { (byClass[g.carClass] || (byClass[g.carClass] = [])).push(g); });
    _rccSortClasses(Object.keys(byClass), function (c) { return c; }).forEach(function (cls) {
      var cars = byClass[cls].filter(function (g) { return (g.crew || []).length; });
      if (!cars.length) return;
      items.push({ tag: cls.toUpperCase() + ' DRIVERS', cars: cars });
    });
  }
  if (page.nextRound) {
    items.push({ tag: 'NEXT ROUND', bold: page.nextRound.eventName, dim: page.nextRound.track ? ' at ' + page.nextRound.track + (page.nextRound.layout ? ': ' + page.nextRound.layout : '') : '' });
  }

  function driverEntry(row) {
    var entry = _rccEl('span', 'rcl-ticker-driver-entry');
    if (row.manufacturer) entry.appendChild(_rccLogo('rcl-ticker-driver-logo', row.manufacturer));
    entry.appendChild(_rccText('span', 'rcl-ticker-driver-name' + (row.isPlayer ? ' rcc-me-text' : ''), row.name));
    if (row.carNumber) entry.appendChild(_rccText('span', 'rcl-ticker-driver-num', ' #' + row.carNumber));
    return entry;
  }
  function rowList(rows, ranked) {
    var list = _rccEl('span', 'rcl-ticker-driver-list');
    rows.forEach(function (row, i) {
      if (i > 0) list.appendChild(_rccNbsp(10));
      if (ranked) { list.appendChild(_rccText('span', 'rcl-ticker-driver-rank', _rccOrdinal(i + 1))); list.appendChild(_rccNbsp(2)); }
      list.appendChild(driverEntry(row));
    });
    return list;
  }
  function buildRun() {
    var frag = document.createDocumentFragment();
    items.forEach(function (item) {
      var el = _rccEl('div', 'rcl-ticker-item');
      el.appendChild(_rccText('span', 'rcl-ticker-item-tag', item.tag + ':'));
      if (item.bold !== undefined) {
        el.appendChild(_rccText('span', 'rcl-ticker-prefix-bold', item.bold));
        if (item.dim) el.appendChild(_rccText('span', 'rcl-ticker-prefix-dim', item.dim));
        if (item.groups) el.appendChild(_rccNbsp(5));
      } else if (item.text) {
        el.appendChild(document.createTextNode(item.text));
      }
      if (item.groups) {
        var all = _rccEl('span', 'rcl-ticker-driver-list');
        item.groups.forEach(function (g, gi) {
          if (gi > 0) all.appendChild(_rccNbsp(15));
          var sec = _rccEl('span', 'rcl-ticker-class-section');
          sec.appendChild(_rccText('span', 'rcl-ticker-item-tag', g.tag + ':'));
          sec.appendChild(rowList(g.rows, true));
          all.appendChild(sec);
        });
        el.appendChild(all);
      } else if (item.rows) {
        el.appendChild(rowList(item.rows, !item.unranked));
      } else if (item.cars) {
        var cl = _rccEl('span', 'rcl-ticker-driver-list');
        item.cars.forEach(function (g, i) {
          if (i > 0) cl.appendChild(_rccNbsp(10));
          var entry = _rccEl('span', 'rcl-ticker-driver-entry');
          if (g.manufacturer) entry.appendChild(_rccLogo('rcl-ticker-driver-logo', g.manufacturer));
          entry.appendChild(_rccText('span', 'rcl-ticker-driver-name' + (g.isMine ? ' rcc-me-text' : ''), g.crew.join(', ')));
          if (g.carNumber) entry.appendChild(_rccText('span', 'rcl-ticker-driver-num', ' #' + g.carNumber));
          cl.appendChild(entry);
        });
        el.appendChild(cl);
      } else if (item.mfr) {
        var ml = _rccEl('span', 'rcl-ticker-driver-list');
        item.mfr.forEach(function (m, i) {
          if (i > 0) ml.appendChild(_rccNbsp(8));
          ml.appendChild(_rccText('span', 'rcl-ticker-driver-rank', _rccOrdinal(i + 1)));
          ml.appendChild(_rccNbsp(2));
          var entry = _rccEl('span', 'rcl-ticker-driver-entry');
          entry.appendChild(_rccLogo('rcl-ticker-driver-logo', m.manufacturer));
          entry.appendChild(_rccText('span', 'rcl-ticker-driver-name', m.manufacturer));
          ml.appendChild(entry);
        });
        el.appendChild(ml);
      }
      frag.appendChild(el);
    });
    frag.appendChild(_rccEl('div', 'rcl-ticker-loop-dot', '&bull;'));
    return frag;
  }
  track.appendChild(buildRun());
  track.appendChild(buildRun());
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  requestAnimationFrame(function () {
    var viewport = track.parentElement;
    if (!viewport) return;
    var runWidth = track.scrollWidth / 2;
    var mainSec = Math.max(runWidth / 64, 12);
    track.style.setProperty('--rcl-ticker-start', viewport.clientWidth + 'px');
    track.style.animation = 'none';
    void track.offsetWidth;
    track.style.animation = 'rcl-ticker-intro 1.10s linear forwards, rcl-ticker-scroll ' + mainSec.toFixed(2) + 's linear 1.10s infinite';
  });
}

// ---------------------------------------------------------------------
// LAST RACE / SEASON PREVIEW / SEASON RECAP
// ---------------------------------------------------------------------
function _rccPodium(rows) {
  var top3 = (rows || []).slice(0, 3);
  var podium = _rccEl('div', 'rcl-lr-podium');
  if (!top3.length) { podium.appendChild(_rccEmpty('No Data To Display', 'No classified finishers yet.')); return podium; }
  var order = top3.length === 3 ? [1, 0, 2] : top3.map(function (_, i) { return i; });
  order.forEach(function (idx) {
    var row = top3[idx];
    var tile = _rccEl('div', 'rcl-lr-podium-tile rcl-lr-podium-tile-p' + (idx + 1));
    var drv = _rccEl('div', 'rcl-lr-podium-driver');
    drv.appendChild(_rccLogo('rcl-lr-podium-logo', row.manufacturer));
    var ident = _rccEl('div', 'rcl-lr-podium-identity');
    ident.appendChild(_rccText('span', 'rcl-lr-podium-name' + (row.isPlayer ? ' rcc-me-text' : ''), (row.name || '').toUpperCase()));
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
  details.push(row('Driver', page.owner.displayName + (page.registration ? ' · ' + page.registration.teamName + ' #' + page.registration.carNumber : ' · no team chosen yet')));
  if (rs.aiDifficulty) details.push(row('AI Difficulty', rs.aiDifficulty + '%'));
  if (rs.aiAggression) details.push(row('AI Aggression', rs.aiAggression));
  details.push(row('Championship Rounds', String(page.totalRounds)));
  if (classes.length) details.push(row(classes.length === 1 ? 'Class' : 'Classes', classes.map(function (c) { return c + ' (' + (d.classSeasons || {})[c] + ')'; }).join(', ')));
  details.push(row('Cars On The Grid', String((page.grid || []).length)));
  var session = [];
  if (rs.practiceLengthMin) session.push(row('Practice Duration', rs.practiceLengthMin + ' min'));
  if (rs.qualifyLengthMin) session.push(row('Qualify Duration', rs.qualifyLengthMin + ' min'));
  var tables = d.pointsTables || {};
  var tiers = Object.keys(tables).filter(function (t) { return (tables[t].points || []).length; });
  if (tiers.length) session.push(row('Race Durations', tiers.map(function (t) { return t + ' ' + tables[t].duration + ' mins'; }).join(', ')));
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

  var rules = [];
  if (rs.raceStart) rules.push(row('Start', rs.raceStart));
  if (rs.flagRules) rules.push(row('Flag Rules', rs.flagRules));
  if (rs.mechanicalFailures) rules.push(row('Mechanical Failures', rs.mechanicalFailures));
  if (rs.setupRules) rules.push(row('Setups', rs.setupRules));
  if (rs.tireWearMultiplier) rules.push(row('Tire Wear', rs.tireWearMultiplier));
  if (rs.tireCount) rules.push(row('Tires Allowed', String(rs.tireCount)));
  if (rs.fuelMultiplier) rules.push(row('Fuel Multiplier', rs.fuelMultiplier));
  if (rs.pitStopReq) rules.push(row('Pitstop Requirements', rs.pitStopReq));
  if (d.trackLimitsPreset) rules.push(row('Track Limits', d.trackLimitsPreset));
  if (rs.trackLimitPoints) rules.push(row('Infractions until Drive-Thru', rs.trackLimitPoints + ' pts'));
  group('Race Rules', [rules]);
}

function rccRenderLastRace(page) {
  var body = document.getElementById('rcl-last-race');
  var titleEl = document.getElementById('rcl-last-race-title');
  body.innerHTML = '';
  body.classList.remove('rcl-seasonfmt-modal-body');
  if (!page || !page.hasSeason) {
    titleEl.textContent = 'Welcome';
    body.appendChild(_rccEmpty('No Championship Yet', 'Use Create Season in the bar above to set up your first offline season: pick the classes, the rounds and the AI difficulty, then join a team.'));
    return;
  }
  if (page.seasonEnded) {
    titleEl.textContent = 'Season Recap';
    _rccSortClasses(page.standings.drivers || [], function (c) { return c.className; }).forEach(function (cls) {
      var w = _rccEl('div', 'rcl-lr-class');
      var h = _rccText('div', 'rcl-standings-class-header', cls.className.toUpperCase() + ' CHAMPIONS');
      h.appendChild(_rccText('span', 'rcl-lr-class-header-sub', ' SEASON ' + page.seasonNumber));
      w.appendChild(h);
      w.appendChild(_rccPodium(cls.standings));
      body.appendChild(w);
    });
    return;
  }
  if (!page.lastRace) {
    titleEl.textContent = 'Season Preview';
    body.classList.add('rcl-seasonfmt-modal-body');
    if (!page.registration) {
      var cta = _rccEl('div', 'rcc-cta');
      cta.appendChild(_rccText('div', 'rcc-cta-text', 'Your season is set up. Choose the team you will drive for to start racing.'));
      var btn = _rccText('button', 'rc-btn-secondary', 'Choose Your Team');
      btn.type = 'button';
      btn.addEventListener('click', rccOpenRegistration);
      cta.appendChild(btn);
      body.appendChild(cta);
    }
    _rccSeasonFormat(page, body);
    return;
  }
  titleEl.textContent = 'Last Race';
  var r = page.lastRace;
  (r.classes || []).forEach(function (cls) {
    var w = _rccEl('div', 'rcl-lr-class');
    var h = _rccText('div', 'rcl-standings-class-header', cls.className.toUpperCase() + ' HIGHLIGHTS');
    h.appendChild(_rccText('span', 'rcl-lr-class-header-sub', ' FROM ROUND ' + r.roundNum + (r.track ? ' AT ' + r.track.toUpperCase() : '')));
    w.appendChild(h);
    w.appendChild(_rccPodium(cls.standings));
    if ((cls.headlineMentions || []).length) w.appendChild(_rccMentions(cls.headlineMentions));
    body.appendChild(w);
  });
  if (r.you) {
    var you = _rccEl('div', 'rcc-you-line');
    you.appendChild(_rccText('span', 'rcc-you-label', 'Your Result'));
    var bits = ['P' + (r.you.classPosition || '-') + ' in ' + r.you.carClass, (r.you.points || 0) + ' pts'];
    if (r.you.wonPole) bits.push('Pole');
    if (r.you.wonFastestLap) bits.push('Fastest Lap');
    if (r.you.wonMostLapsLed) bits.push('Most Laps Led');
    you.appendChild(_rccText('span', 'rcc-you-value', bits.join(' · ')));
    var link = _rccText('button', 'rcc-link-btn', 'Full Results');
    link.type = 'button';
    link.addEventListener('click', function () { rccOpenResults(r.roundId, 'race'); });
    you.appendChild(link);
    body.appendChild(you);
  }
}

// ---------------------------------------------------------------------
// CALENDAR CAROUSEL (adapted from league.js -- no dates in championship mode, so the countdown is
// replaced by round status: Race Recap once results are in, Upload Results for the next round)
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
    var tod = _rccTimeOfDay(entry.igRaceStart);
    var len = entry.raceLengthMinutes ? entry.raceLengthMinutes + ' Mins Long' : '';
    var session = (tod ? tod + ' Race' : '') + (len ? (tod ? ', ' : '') + len : '');
    if (session) lines.push(session);
    if (entry.weather) lines.push(entry.weather + ', ' + (entry.chanceOfRain || 0) + '% Chance Rain' + (entry.temperatureC !== null && entry.temperatureC !== undefined ? ', ' + entry.temperatureC + '° C' : ''));
    if (entry.hasQualifyResults && !entry.hasRaceResults) lines.push('Qualifying imported, race still to come');
    if (lines.length) {
      var det = _rccEl('div', 'rcl-carousel-details');
      lines.forEach(function (l) { det.appendChild(_rccText('div', 'rcl-carousel-details-line', l)); });
      // The race ran a different length than planned: the card shows what was raced (and its points
      // tier, server side); hovering the details shows the plan.
      if (entry.raceLengthAsRaced) det.title = 'As raced: ' + entry.raceLengthMinutes + ' mins (' + entry.raceLengthTier + ' points). Planned: ' + entry.plannedRaceLengthMinutes + ' mins (' + entry.plannedRaceLengthTier + ').';
      hero.appendChild(det);
    }
    var btns = _rccEl('div', 'rcl-carousel-hero-btns');
    var btn;
    if (entry.hasRaceResults || entry.hasQualifyResults) {
      btn = _rccText('button', 'rcl-carousel-hero-btn', entry.hasResults ? 'RACE RECAP' : 'QUALIFYING RESULTS');
      btn.addEventListener('click', function (evt) { evt.stopPropagation(); rccOpenResults(entry.roundId, entry.hasRaceResults ? 'race' : 'qualifying'); });
    } else if (idx === nextIdx && !page.seasonEnded && page.registration) {
      btn = _rccText('button', 'rcl-carousel-hero-btn', 'UPLOAD RESULTS');
      btn.addEventListener('click', function (evt) { evt.stopPropagation(); rccOpenUpload(entry.roundId, true); });
    } else {
      btn = _rccText('button', 'rcl-carousel-hero-btn rcl-carousel-hero-btn-disabled', idx === nextIdx ? 'UP NEXT' : 'NOT YET RACED');
      btn.disabled = true;
    }
    btn.type = 'button';
    btns.appendChild(btn);
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
    if (max > 0) track.style.height = max + 'px';
  });
}

// ---------------------------------------------------------------------
// STANDINGS -- Drivers / Teams tabs, plus the Manufacturers' podium section below
// ---------------------------------------------------------------------
var RCC_METAL = ['rcl-standings-row-p1', 'rcl-standings-row-p2', 'rcl-standings-row-p3'];

function _rccPosBadge(idx, text) {
  return _rccText('div', 'rcl-standings-pos' + (RCC_METAL[idx] ? ' ' + RCC_METAL[idx] : ''), text !== undefined ? text : String(idx + 1));
}

function _rccIdentity(row, opts) {
  opts = opts || {};
  var identity = _rccEl('div', 'rcl-standings-identity' + (opts.dnf ? ' rcl-standings-identity-dnf' : ''));
  var slot = _rccEl('div', 'rcl-standings-mfr-logo-slot');
  // No logo (or it fails to load): the slot stays as empty space so every name in a table lines up.
  if (row.manufacturer) slot.appendChild(_rccLogo('rcl-standings-mfr-logo', row.manufacturer));
  identity.appendChild(slot);
  var nameRow = _rccEl('div', 'rcl-standings-name-row' + (opts.wrap ? ' rcc-name-row-wrap' : ''));
  nameRow.appendChild(_rccText('span', 'rcl-standings-name' + (row.isPlayer ? ' rcc-me-text' : ''), opts.nameOverride || row.name));
  if (row.carNumber && !opts.hideNumber) nameRow.appendChild(_rccText('span', 'rcl-standings-carnum', '#' + row.carNumber));
  if (opts.sub) nameRow.appendChild(_rccText('span', 'rcl-standings-team', opts.sub));
  else if (row.teamName && !opts.hideTeam) nameRow.appendChild(_rccText('span', 'rcl-standings-team', row.teamName));
  identity.appendChild(nameRow);
  return identity;
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

function _rccMetalSwitch(view, onChange) {
  var sw = _rccEl('button', 'rcc-metal-switch' + (view === 'teams' ? ' rcc-metal-switch-teams' : ''));
  sw.type = 'button';
  sw.setAttribute('role', 'switch');
  sw.setAttribute('aria-checked', view === 'teams' ? 'true' : 'false');
  sw.setAttribute('aria-label', 'Show team standings');
  sw.appendChild(_rccEl('span', 'rcc-metal-knob'));
  sw.appendChild(_rccText('span', 'rcc-metal-label rcc-metal-label-drivers', 'Drivers'));
  sw.appendChild(_rccText('span', 'rcc-metal-label rcc-metal-label-teams', 'Teams'));
  sw.addEventListener('click', function () { onChange(view === 'teams' ? 'drivers' : 'teams'); });
  return sw;
}

// Three grid cells for a board row: maker logo | car number | name. The logo slot always stays
// (empty space when there's no logo or it fails to load) so every number and name lines up. The
// number keeps leading zeros exactly as stored (#007). Hover on the name shows the full name + number.
function _rccBoardCells(row, name) {
  var slot = _rccEl('div', 'rcl-standings-mfr-logo-slot');
  if (row.manufacturer) slot.appendChild(_rccLogo('rcl-standings-mfr-logo', row.manufacturer));
  var num = _rccText('div', 'rcc-board-num', row.carNumber ? '#' + row.carNumber : '');
  var nameCell = _rccEl('div', 'rcl-standings-name-row rcc-board-name-cell');
  nameCell.appendChild(_rccText('span', 'rcl-standings-name' + (row.isPlayer ? ' rcc-me-text' : ''), name));
  nameCell.title = name + (row.carNumber ? ' #' + row.carNumber : '');
  return [slot, num, nameCell];
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
  var cols = '44px 50px 44px minmax(140px, 1fr) repeat(' + n + ', 46px) 58px';
  var scroller = _rccEl('div', 'rcc-board-scroll');
  var table = _rccEl('div', 'rcc-board-table');
  table.style.setProperty('--rcc-board-cols', cols);
  table.style.minWidth = (44 + 50 + 44 + 140 + 46 * n + 58 + 6 * (n + 4) + 12) + 'px';
  var hr = _rccEl('div', 'rcc-board-row rcc-board-head');
  hr.appendChild(_rccText('div', null, 'Pos'));
  hr.appendChild(_rccEl('div'));
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
    board.appendChild(_rccEmpty('No Data To Display', 'No entries in this class.'));
    _rccStandingsFooter(board, page);
    return board;
  }
  lines.forEach(function (line, idx) {
    var row = line.row;
    var rowEl = _rccEl('div', 'rcc-board-row rcl-standings-row' + (RCC_METAL[idx] ? ' ' + RCC_METAL[idx] : '') + (row.isPlayer ? ' rcc-row-me' : ''));
    rowEl.appendChild(_rccPosBadge(idx));
    _rccBoardCells(row, line.names.join(', ')).forEach(function (cell) { rowEl.appendChild(cell); });
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
// points note, plus the phone-only "view on PC" note (same wording as the League Hub) since phones
// only get Pos, Drivers/Teams and Pts.
function _rccStandingsFooter(board, page) {
  var foot = _rccEl('div', 'rcl-results-bottom-row rcl-results-status-footer rcc-board-footer');
  var bonus = _rccBonusNote(page);
  if (bonus) foot.appendChild(_rccText('div', 'rcl-standings-status-note rcc-board-note', bonus));
  foot.appendChild(_rccText('div', 'rcl-standings-status-note rcc-board-note rcl-standings-status-mobile-note', 'FOR FULL RESULTS, VIEW ON PC BROWSER'));
  board.appendChild(foot);
}

function rccRenderStandings(page) {
  var host = document.getElementById('rcc-standings-panels');
  host.innerHTML = '';
  if (!page || !page.hasSeason) return;
  var classes = _rccSortClasses((page.standings.drivers || []).map(function (c) { return c.className; }), function (c) { return c; });
  classes.forEach(function (className) {
    var row = _rccEl('div', 'rcl-row-full');
    var panel = _rccEl('section', 'rcl-panel');
    var headEl = _rccEl('div', 'rcl-panel-head rcc-panel-head-tabs');
    headEl.appendChild(_rccText('div', 'rcl-panel-title', className + (page.seasonEnded ? ' Final Standings' : ' Standings')));
    var body = _rccEl('div', 'rcl-panel-body');
    var hasTeams = className !== 'Hypercar' && (page.standings.teams || []).some(function (t) { return t.className === className && t.standings.length; });
    var switchSlot = _rccEl('div', 'rcc-switch-slot');
    headEl.appendChild(switchSlot);
    function draw() {
      var view = hasTeams ? (RCC.standingsView[className] || 'drivers') : 'drivers';
      switchSlot.innerHTML = '';
      if (hasTeams) switchSlot.appendChild(_rccMetalSwitch(view, function (next) { RCC.standingsView[className] = next; draw(); }));
      body.innerHTML = '';
      body.appendChild(_rccStandingsBoard(page, className, view));
    }
    draw();
    panel.appendChild(headEl);
    panel.appendChild(body);
    row.appendChild(panel);
    host.appendChild(row);
  });
}

function rccRenderManufacturers(page) {
  var body = document.getElementById('rcl-manufacturer-standings');
  body.innerHTML = '';
  var list = (page && page.hasSeason && page.roundsCompleted > 0) ? (page.standings.manufacturers || []) : [];
  if (!list.length || !list.some(function (m) { return m.points > 0; })) { body.style.display = 'none'; return; }
  body.style.display = '';
  body.appendChild(_rccText('div', 'rcl-mfr-title', page.seasonEnded ? "Final Manufacturers' Standings" : "Manufacturers' Standings"));
  body.appendChild(_rccText('div', 'rcl-mfr-subtitle', 'Hypercar Class · Factory Entries'));
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
    tile.appendChild(_rccText('div', 'rcl-mfr-tile-name', m.manufacturer.toUpperCase()));
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
      r.appendChild(_rccText('span', 'rcl-mfr-rest-name', m.manufacturer.toUpperCase()));
      r.appendChild(_rccText('span', 'rcl-mfr-rest-pts', Math.round(m.points) + ' PTS'));
      restList.appendChild(r);
    });
    body.appendChild(restList);
  }
}

// ---------------------------------------------------------------------
// RESULTS POPUP -- Race / Qualifying / My Laps for any imported round
// ---------------------------------------------------------------------
function _rccCategoryBreakdown(cls) {
  var wrap = _rccEl('div', 'rcl-race-categories rcl-race-categories-inclass');
  function cat(icon, title, name, num, kind) {
    if (!name) return;
    var c = _rccEl('div', 'rcl-race-category');
    var h = _rccEl('div', 'rcl-race-category-title');
    h.appendChild(_rccEl('span', 'rcl-race-category-icon', icon));
    h.appendChild(document.createTextNode(title));
    c.appendChild(h);
    var r = _rccEl('div', 'rcl-race-category-row' + (kind ? ' rcl-race-category-row-' + kind : ''));
    r.appendChild(_rccText('span', 'rcl-race-category-name', name));
    if (num) r.appendChild(_rccText('span', 'rcl-race-category-number', '#' + num));
    c.appendChild(r);
    wrap.appendChild(c);
  }
  cat(_RCC_ICON_TROPHY, 'Winner', cls.classWinner, cls.classWinnerCarNumber, 'winner');
  if (cls.classMostLapsLedCount) cat(_RCC_ICON_LAPS_LED, 'Most Laps Led', cls.classMostLapsLedDriver, cls.classMostLapsLedCarNumber);
  cat(_RCC_ICON_POLE, 'Pole Sitter', cls.classPoleSitter, cls.classPoleSitterCarNumber);
  cat(_RCC_ICON_STOPWATCH, 'Fastest Lap', cls.classFastestLapDriver, cls.classFastestLapCarNumber);
  return wrap;
}

function _rccGap(row, ref) {
  if (!ref || row.finishTimeSeconds === null || ref.finishTimeSeconds === null) return '--';
  var down = (ref.laps || 0) - (row.laps || 0);
  if (down > 0) return '+' + down + ' Lap' + (down === 1 ? '' : 's');
  var g = row.finishTimeSeconds - ref.finishTimeSeconds;
  return g <= 0 ? '--' : '+' + g.toFixed(3);
}

function _rccRaceBody(result, el) {
  el.innerHTML = '';
  if (!result || !(result.classes || []).length) { el.appendChild(_rccEmpty('No Data To Display', 'No race result imported for this round.')); return; }
  result.classes.forEach(function (cls) {
    var w = _rccEl('div', 'rcl-race-class');
    w.appendChild(_rccText('div', 'rcl-standings-class-header', cls.className.toUpperCase() + ' STANDINGS'));
    w.appendChild(_rccCategoryBreakdown(cls));
    var head = _rccEl('div', 'rcl-race-col-head rcl-race-grid-allresults');
    ['Pos', 'Driver', 'Laps', 'Total Time', 'Interval', 'Gap', 'Avg (KM/H)', 'Best Lap', 'Pts'].forEach(function (t) { head.appendChild(_rccText('div', null, t)); });
    w.appendChild(head);
    var rows = cls.standings || [];
    var leader = rows[0] || null;
    rows.forEach(function (row, idx) {
      var dnf = /dnf/i.test(row.finishStatus || '');
      var r = _rccEl('div', 'rcl-race-row rcl-race-grid-allresults' + (RCC_METAL[idx] ? ' ' + RCC_METAL[idx] : '') + (row.isPlayer ? ' rcc-row-me' : ''));
      r.appendChild(_rccPosBadge(idx, dnf ? 'DNF' : undefined));
      r.appendChild(_rccIdentity(row, { dnf: dnf }));
      r.appendChild(_rccText('div', 'rcl-race-row-num', String(row.laps || 0)));
      r.appendChild(_rccText('div', 'rcl-race-row-num', _rccTotalTime(row.finishTimeSeconds)));
      r.appendChild(_rccText('div', 'rcl-race-row-gap', idx === 0 ? '--' : _rccGap(row, rows[idx - 1])));
      r.appendChild(_rccText('div', 'rcl-race-row-gap', idx === 0 ? 'Leader' : _rccGap(row, leader)));
      var kmh = '--';
      if (result.trackLengthMeters && row.laps && row.finishTimeSeconds > 0) kmh = ((result.trackLengthMeters * row.laps / 1000) / (row.finishTimeSeconds / 3600)).toFixed(1);
      r.appendChild(_rccText('div', 'rcl-race-row-avg', kmh));
      r.appendChild(_rccText('div', 'rcl-race-row-bestlap', _rccLapTime(row.bestLapTime)));
      r.appendChild(_rccText('div', 'rcl-race-row-pts', row.points === null || row.points === undefined ? '--' : '+' + row.points));
      w.appendChild(r);
    });
    el.appendChild(w);
  });

  var report = result.raceReport || [];
  if (report.length) {
    var sec = _rccEl('div', 'rcl-report-section');
    sec.appendChild(_rccText('div', 'rcl-race-class-name', 'Race Report'));
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
          if (en.et !== null && en.et !== undefined) line.appendChild(_rccText('span', 'rcl-report-timestamp', _rccEventTime(en.et)));
          line.appendChild(_rccText('span', 'rcl-report-name', en.name));
          var all = en.positionClause ? en.clauses.concat([en.positionClause]) : en.clauses;
          all.forEach(function (c, i) {
            line.appendChild(document.createTextNode(i === 0 ? ' ' : ', '));
            line.appendChild(_rccText('span', CLAUSE[c.kind] || null, c.text));
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
    w.appendChild(_rccText('div', 'rcl-standings-class-header', cls.className.toUpperCase() + ' QUALIFYING'));
    var head = _rccEl('div', 'rcl-race-col-head rcl-race-grid-qualifying');
    ['Pos', 'Driver', 'Best Lap', 'Sector 1', 'Sector 2', 'Sector 3', 'Avg (KM/H)'].forEach(function (t) { head.appendChild(_rccText('div', null, t)); });
    w.appendChild(head);
    (cls.standings || []).forEach(function (row, idx) {
      var r = _rccEl('div', 'rcl-race-row rcl-race-grid-qualifying' + (RCC_METAL[idx] ? ' ' + RCC_METAL[idx] : '') + (row.isPlayer ? ' rcc-row-me' : ''));
      r.appendChild(_rccPosBadge(idx));
      r.appendChild(_rccIdentity(row));
      r.appendChild(_rccText('div', 'rcl-race-row-bestlap', _rccLapTime(row.bestLapTime)));
      r.appendChild(_rccText('div', 'rcl-race-row-num', _rccLapTime(row.sector1)));
      r.appendChild(_rccText('div', 'rcl-race-row-num', _rccLapTime(row.sector2)));
      r.appendChild(_rccText('div', 'rcl-race-row-num', _rccLapTime(row.sector3)));
      r.appendChild(_rccText('div', 'rcl-race-row-avg', row.avgKmh !== null && row.avgKmh !== undefined ? String(row.avgKmh) : '--'));
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
    var title = (s.kind === 'race' ? 'Race' : 'Qualifying') + ' · P' + (s.classPosition || '-') + ' in class · Best ' + _rccLapTime(s.bestLapTime) + (s.kind === 'race' ? ' · ' + s.pitstops + ' stop' + (s.pitstops === 1 ? '' : 's') : '');
    w.appendChild(_rccText('div', 'rcl-standings-class-header', title.toUpperCase()));
    var table = _rccEl('div', 'rcc-laps-table');
    var head = _rccEl('div', 'rcc-laps-row rcc-laps-head');
    ['Lap', 'Pos', 'Lap Time', 'S1', 'S2', 'S3', 'Top Speed', 'Fuel', 'Tires (FL FR RL RR)', 'Compound'].forEach(function (t) { head.appendChild(_rccText('div', null, t)); });
    table.appendChild(head);
    var best = Infinity;
    s.laps.forEach(function (l) { var t = Number(l.lapTime); if (t > 0 && t < best) best = t; });
    s.laps.forEach(function (l) {
      var r = _rccEl('div', 'rcc-laps-row' + (Number(l.lapTime) === best ? ' rcc-laps-best' : '') + (l.pit ? ' rcc-laps-pit' : ''));
      r.appendChild(_rccText('div', null, String(l.lapNum) + (l.pit ? ' PIT' : '')));
      r.appendChild(_rccText('div', null, l.positionAtLap ? 'P' + l.positionAtLap : '--'));
      r.appendChild(_rccText('div', null, _rccLapTime(l.lapTime)));
      r.appendChild(_rccText('div', null, _rccLapTime(l.sector1)));
      r.appendChild(_rccText('div', null, _rccLapTime(l.sector2)));
      r.appendChild(_rccText('div', null, _rccLapTime(l.sector3)));
      r.appendChild(_rccText('div', null, l.topSpeed ? Number(l.topSpeed).toFixed(1) : '--'));
      r.appendChild(_rccText('div', null, l.fuel !== '' ? Math.round(Number(l.fuel) * 100) + '%' : '--'));
      var tw = [l.tireWearFL, l.tireWearFR, l.tireWearRL, l.tireWearRR].map(function (v) { return v === '' ? '--' : Math.round(Number(v) * 100); }).join(' ');
      r.appendChild(_rccText('div', null, tw));
      r.appendChild(_rccText('div', null, String(l.frontCompound || '').replace(/^\d+,/, '')));
      table.appendChild(r);
    });
    w.appendChild(table);
    if ((s.events || []).length) {
      var evs = _rccEl('div', 'rcc-laps-events');
      evs.appendChild(_rccText('div', 'rcl-race-class-name', 'Your Events'));
      s.events.forEach(function (ev) {
        var line = _rccEl('p', 'rcl-report-line');
        var et = Number(ev.elapsedTime);
        if (!isNaN(et)) line.appendChild(_rccText('span', 'rcl-report-timestamp', _rccEventTime(et)));
        line.appendChild(document.createTextNode(' ' + (ev.rawText || ev.eventType)));
        evs.appendChild(line);
      });
      w.appendChild(evs);
    }
    el.appendChild(w);
  });
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
  kindSel.appendChild(new Option('Race', 'race'));
  kindSel.appendChild(new Option('Qualifying', 'qualifying'));
  kindSel.appendChild(new Option('My Laps', 'mylaps'));
  row.appendChild(sel);
  row.appendChild(kindSel);
  m.body.appendChild(row);
  var out = _rccEl('div', 'rcl-allresults-body');
  m.body.appendChild(out);
  var cache = {};
  function load() {
    var key = sel.value + ':' + kindSel.value;
    var builder = kindSel.value === 'qualifying' ? _rccQualifyingBody : (kindSel.value === 'mylaps' ? _rccMyLapsBody : _rccRaceBody);
    if (cache[key]) { builder(cache[key], out); return; }
    out.innerHTML = '';
    out.appendChild(_rccSpinner('Loading results...'));
    _rccApi('champGetRoundResults', { roundId: sel.value, kind: kindSel.value }).then(function (res) {
      if (_rccHandleAuthError(res)) return;
      var result = res && res.success ? res.result : null;
      if (result) cache[key] = result;
      builder(result, out);
    }).catch(function () {
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
  if (page.registration) {
    var mine = _rccEl('div', 'rcc-myteam');
    mine.appendChild(_rccLogo('rcc-myteam-logo', page.registration.manufacturer));
    var col = _rccEl('div');
    col.appendChild(_rccText('div', 'rcc-myteam-label', 'Your Team'));
    col.appendChild(_rccText('div', 'rcc-myteam-name', page.registration.teamName + ' #' + page.registration.carNumber));
    col.appendChild(_rccText('div', 'rcc-myteam-sub', page.registration.carModel + ' · ' + page.registration.carClass + ' · joined ' + _rccFormatDate(page.registration.joinedAt)));
    if (page.registration.teamDesc) col.appendChild(_rccText('p', 'rcc-myteam-desc', page.registration.teamDesc));
    mine.appendChild(col);
    m.body.appendChild(mine);
  }
  var classes = [];
  grid.forEach(function (g) { if (classes.indexOf(g.carClass) === -1) classes.push(g.carClass); });
  _rccSortClasses(classes, function (c) { return c; }).forEach(function (cls) {
    var w = _rccEl('div', 'rcl-race-class');
    w.appendChild(_rccText('div', 'rcl-standings-class-header', cls.toUpperCase() + ' GRID'));
    grid.filter(function (g) { return g.carClass === cls; }).forEach(function (g) {
      var r = _rccEl('div', 'rcc-grid-row' + (g.isMine ? ' rcc-row-me' : ''));
      r.appendChild(_rccLogo('rcc-grid-logo', g.manufacturer));
      var info = _rccEl('div', 'rcc-grid-info');
      var top = _rccEl('div', 'rcc-grid-top');
      top.appendChild(_rccText('span', 'rcc-grid-team', g.teamName + ' #' + g.carNumber));
      if (cls === 'Hypercar') top.appendChild(_rccText('span', 'rcc-tag' + (g.factory ? ' rcc-tag-factory' : ''), g.factory ? 'Factory' : 'Privateer'));
      if (g.isMine) top.appendChild(_rccText('span', 'rcc-tag rcc-tag-me', 'You'));
      info.appendChild(top);
      info.appendChild(_rccText('div', 'rcc-grid-model', g.carModel));
      info.appendChild(_rccText('div', 'rcc-grid-crew', g.crew.length ? 'Drivers: ' + g.crew.join(', ') : 'Drivers: none listed yet (filled in from your first imported result)'));
      r.appendChild(info);
      w.appendChild(r);
    });
    m.body.appendChild(w);
  });
}

// ---------------------------------------------------------------------
// REGISTRATION -- class, team, signing sequence (same flow and classes as Account.html)
// ---------------------------------------------------------------------
function rccOpenRegistration() {
  var page = RCC.page;
  var grid = page.grid || [];
  var m = rccOpenModal('Choose Your Class', { wide: true });
  m.dialog.classList.add('rcc-light-dialog');

  function classScreen() {
    m.setTitle('Choose Your Class');
    m.body.innerHTML = '';
    var present = [];
    grid.forEach(function (g) { if (present.indexOf(g.carClass) === -1) present.push(g.carClass); });
    m.body.appendChild(_rccText('p', 'rcc-reg-intro', 'Pick the class you will race in this season. Your AI rivals fill every other seat.'));
    var pick = _rccEl('div', 'rc-class-pick-grid');
    (typeof CAR_CLASS_LIST !== 'undefined' ? CAR_CLASS_LIST : present).forEach(function (cls) {
      var cars = grid.filter(function (g) { return g.carClass === cls; });
      var can = cars.length > 0;
      var color = (typeof CAR_CLASS_BADGE_COLOR_VAR !== 'undefined' && CAR_CLASS_BADGE_COLOR_VAR[cls]) || '--rc-steel';
      var btn = _rccEl('button', 'rc-class-pick-btn' + (can ? '' : ' rc-class-pick-btn-locked rc-class-pick-btn-inactive'));
      btn.type = 'button';
      btn.disabled = !can;
      btn.style.setProperty('--rc-class-pick-color', 'var(' + color + ')');
      var content = _rccEl('div', 'rc-class-pick-btn-content');
      content.appendChild(_rccText('div', 'rc-class-pick-btn-name', cls === 'Hypercar' ? 'HY' : cls));
      content.appendChild(_rccText('div', 'rc-class-pick-btn-seats', can ? cars.length + ' car' + (cars.length === 1 ? '' : 's') : 'Inactive'));
      btn.appendChild(content);
      btn.appendChild(_rccEl('div', 'rc-class-pick-btn-lock', '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="5.5" y1="18.5" x2="18.5" y2="5.5"></line></svg>'));
      if (can) btn.addEventListener('click', function () { teamScreen(cls); });
      pick.appendChild(btn);
    });
    m.body.appendChild(pick);
  }

  function teamScreen(cls) {
    m.setTitle('Choose Your Team', _rccClassPill(cls));
    m.body.innerHTML = '';
    var back = _rccText('button', 'rc-link-btn', '← Choose a different class');
    back.type = 'button';
    back.style.cssText = 'display:block;margin-bottom:10px;';
    back.addEventListener('click', classScreen);
    m.body.appendChild(back);
    var teams = grid.filter(function (g) { return g.carClass === cls; });
    var mfrs = [];
    teams.forEach(function (t) { if (t.manufacturer && mfrs.indexOf(t.manufacturer) === -1) mfrs.push(t.manufacturer); });
    mfrs.sort();
    var listSlot = _rccEl('div');
    function renderList(filter) {
      listSlot.innerHTML = '';
      teams.filter(function (t) { return !filter || t.manufacturer === filter; }).forEach(function (t) { listSlot.appendChild(teamCard(t, cls)); });
    }
    if (mfrs.length > 1) {
      var row = _rccEl('div', 'rc-team-manu-filter-row');
      var entries = [];
      var all = _rccText('button', 'rc-team-manu-filter-all', 'ALL');
      all.type = 'button';
      row.appendChild(all);
      entries.push({ m: null, b: all });
      mfrs.forEach(function (mf) {
        var b = _rccEl('button', 'rc-team-manu-filter-logo');
        b.type = 'button';
        b.title = mf;
        b.appendChild(_rccLogo('', mf, function () { b.style.display = 'none'; }));
        row.appendChild(b);
        entries.push({ m: mf, b: b });
      });
      entries.forEach(function (en) {
        en.b.addEventListener('click', function () {
          entries.forEach(function (x) { x.b.classList.toggle('rc-team-manu-filter-dim', en.m !== null && x.m !== en.m); });
          renderList(en.m);
        });
      });
      m.body.appendChild(row);
    }
    m.body.appendChild(listSlot);
    renderList(null);
  }

  function teamCard(team, cls) {
    var card = _rccEl('div', 'rc-team-card');
    var head = _rccEl('div', 'rc-team-card-head');
    var identity = _rccEl('div', 'rc-team-card-identity');
    var logoBox = _rccEl('div', 'rc-team-logo-box');
    logoBox.appendChild(_rccLogo('', team.manufacturer, function () { logoBox.style.display = 'none'; }));
    identity.appendChild(logoBox);
    var nameCol = _rccEl('div');
    nameCol.appendChild(_rccText('div', 'rc-team-name', (team.teamName || 'Unnamed Team') + (team.carNumber ? ' #' + team.carNumber : '')));
    if (team.carModel) nameCol.appendChild(_rccText('div', 'rc-team-subtitle', team.carModel + (cls === 'Hypercar' ? (team.factory ? ' · Factory' : ' · Privateer') : '')));
    identity.appendChild(nameCol);
    head.appendChild(identity);
    card.appendChild(head);
    if (team.teamDesc) card.appendChild(_rccText('p', 'rcc-team-desc', team.teamDesc));
    if (team.realCrew && team.realCrew.length) card.appendChild(_rccText('p', 'rcc-team-desc', 'You replace: ' + team.realCrew.join(', ')));
    var footer = _rccEl('div', 'rc-team-card-footer');
    var join = _rccText('button', 'rc-btn-primary', 'Join This Team');
    join.type = 'button';
    var err = _rccEl('div', 'rcc-error-line');
    join.addEventListener('click', function () { doJoin(team, cls, join, err); });
    footer.appendChild(join);
    footer.appendChild(err);
    card.appendChild(footer);
    return card;
  }

  // Same as Account.html: the join request goes out immediately while the signing sequence plays;
  // its real answer is only read once the driver presses Continue.
  function doJoin(team, cls, btn, err) {
    btn.disabled = true;
    err.textContent = '';
    var joinPromise = _rccApi('champJoinTeam', { seasonId: page.seasonId, teamId: team.teamId }, { post: true });
    rccSigningSequence(team, cls, function () {
      m.close(true);
      joinPromise.then(function (res) {
        if (_rccHandleAuthError(res)) return;
        if (res && res.success) { _rccToast('You\'re registered!', 'success'); rccReloadAfterSave(); return; }
        _rccToast((res && res.message) || 'Could not confirm this registration -- reloading to check.', 'error');
        rccReloadAfterSave();
      }).catch(function () {
        _rccToast('Reloading to confirm your registration...', 'success');
        rccReloadAfterSave();
      });
    });
  }

  classScreen();
}

var RCC_SIGNING_MESSAGES = ['Drafting team documents...', 'Notifying the team principal...', 'Fitting your race suit...', 'Calibrating the seat...', 'Finalizing your contract...', 'Bringing the car to pit lane...'];
var RCC_WELCOME_LINES = [
  'Welcome to {team}! We have been waiting for a driver like you, and we finally found one. This seat is yours, now let\'s go show everyone what we can do!',
  'You earned this, plain and simple! {team} doesn\'t hand out seats, we award them. Buckle up, this is going to be a season to remember!',
  'From everyone at {team}: congratulations! You\'re not just joining a team, you\'re joining a family that believes in you. Let\'s get out there and win!',
  'This is the moment every driver dreams about, and it\'s yours! {team} is fully behind you, every lap, every race. Now go make us proud!',
  'The whole {team} garage is buzzing about you! You\'ve got the talent, we\'ve got the car, together we\'re unstoppable. Let\'s go racing!',
  'Welcome to {team}, driver! Today you take the first step toward something incredible. Strap in, the season starts now!'
];

// Port of Account.html's openSigningSequence (same markup and css/style.css classes).
function rccSigningSequence(team, cls, onFinish) {
  var overlay = _rccEl('div', 'rc-signing-overlay');
  var stage = _rccEl('div', 'rc-signing-stage rc-signing-stage-suspense');
  overlay.appendChild(stage);
  document.body.appendChild(overlay);
  var wm = document.createElement('img');
  wm.className = 'rc-signing-wordmark-img';
  wm.alt = 'Race Club';
  wm.src = 'assets/images/Race Club (Full, Black).png';
  stage.appendChild(wm);
  var lights = _rccEl('div', 'rc-startlights');
  for (var i = 0; i < 5; i++) lights.appendChild(_rccEl('div', 'rc-startlight'));
  stage.appendChild(lights);
  var msg = _rccText('div', 'rc-signing-message', RCC_SIGNING_MESSAGES[0]);
  stage.appendChild(msg);
  var mi = 0;
  var msgTimer = setInterval(function () { mi = (mi + 1) % RCC_SIGNING_MESSAGES.length; msg.textContent = RCC_SIGNING_MESSAGES[mi]; }, 1400);

  var img = document.createElement('img');
  img.className = 'rc-signing-welcome-img';
  img.alt = '';
  var started = Date.now(), ready = false, advanced = false;
  var failsafe = setTimeout(function () { ready = true; tryAdvance(); }, 8000);
  img.addEventListener('load', function () { ready = true; tryAdvance(); });
  img.addEventListener('error', function () { ready = true; tryAdvance(); });
  img.src = (cls === 'LMGTE' || cls === 'LMGT3') ? 'assets/images/gt_welcome.jpg' : (cls === 'Hypercar' ? 'assets/images/hypercar_welcome.jpg' : 'assets/images/prototype_welcome.jpg');

  function tryAdvance() {
    if (advanced) return;
    setTimeout(function () {
      if (advanced || !ready) return;
      advanced = true;
      clearInterval(msgTimer);
      clearTimeout(failsafe);
      welcome();
    }, Math.max(0, 3800 - (Date.now() - started)));
  }
  var revealed = false, finished = false;
  function welcome() {
    stage.className = 'rc-signing-stage rc-signing-stage-welcome';
    stage.innerHTML = '';
    stage.appendChild(img);
    void img.offsetHeight;
    img.classList.add('rc-signing-welcome-img-visible');
    setTimeout(reveal, 900 + 3000);
  }
  function reveal() {
    if (revealed) return;
    revealed = true;
    img.classList.add('rc-signing-welcome-img-dim');
    var content = _rccEl('div', 'rc-signing-welcome-overlay');
    var wm2 = document.createElement('img');
    wm2.className = 'rc-signing-wordmark-img rc-signing-wordmark-img-lg';
    wm2.alt = 'Race Club';
    wm2.src = 'assets/images/Race Club (Full, Black).png';
    content.appendChild(wm2);
    content.appendChild(_rccText('div', 'rc-signing-congrats', 'CONGRATULATIONS'));
    var hypeWrap = _rccEl('div', 'rc-signing-hype-wrap');
    var hype = _rccEl('div', 'rc-signing-hype');
    hype.appendChild(_rccText('span', 'rc-signing-hype-mark rc-signing-hype-mark-open', '“'));
    var line = RCC_WELCOME_LINES[Math.floor(Math.random() * RCC_WELCOME_LINES.length)].split('{team}').join(team.teamName || 'the team');
    hype.appendChild(_rccText('span', 'rc-signing-hype-text', line));
    hype.appendChild(_rccText('span', 'rc-signing-hype-mark rc-signing-hype-mark-close', '”'));
    hypeWrap.appendChild(hype);
    hypeWrap.appendChild(_rccText('div', 'rc-signing-hype-attribution', '· Team Principal'));
    content.appendChild(hypeWrap);
    var ident = _rccEl('div', 'rc-signing-reveal-identity');
    if (team.manufacturer) ident.appendChild(_rccLogo('rc-signing-reveal-logo', team.manufacturer));
    ident.appendChild(_rccText('div', 'rc-signing-reveal-team', (team.teamName || 'Unnamed Team') + (team.carNumber ? ' #' + team.carNumber : '')));
    content.appendChild(ident);
    var row = _rccEl('div', 'rc-signing-reveal-btn-row');
    row.style.opacity = '0';
    var cont = _rccText('button', 'rc-btn-primary rc-signing-continue', 'Continue');
    cont.type = 'button';
    cont.addEventListener('click', function () {
      if (finished) return;
      finished = true;
      overlay.remove();
      onFinish();
    });
    row.appendChild(cont);
    content.appendChild(row);
    stage.appendChild(content);
    void content.offsetHeight;
    content.classList.add('rc-signing-welcome-overlay-visible');
    setTimeout(function () { row.style.opacity = '1'; }, 1400);
  }
}

// ---------------------------------------------------------------------
// SEASON WIZARD -- Create / Edit (one popup, all sections on one scrolling form)
// ---------------------------------------------------------------------
var RCC_WEATHER = ['Clear', 'Light Clouds', 'Partially Cloudy', 'Overcast', 'Cloudy & Drizzle', 'Cloudy & Light Rain', 'Overcast & Light Rain', 'Overcast & Rain', 'Overcast & Heavy Rain', 'Overcast & Storm'];
var RCC_MULTIPLIERS = ['Off', 'Realistic', '2x', '3x'];
// Dry weather: no rain possible, so Chance of Rain is locked at 0% for these.
var RCC_DRY_WEATHER = ['Clear', 'Light Clouds', 'Partially Cloudy'];
var RCC_RAIN_CHANCES = [];
for (var _rccR = 0; _rccR <= 100; _rccR += 5) RCC_RAIN_CHANCES.push({ label: _rccR + '%', value: _rccR });
function _rccSnapRain(v) { var n = Math.round((Number(v) || 0) / 5) * 5; return Math.max(0, Math.min(100, n)); }

function _rccDefaultDetails() {
  return {
    classes: { Hypercar: false, LMP2: false, LMP3: false, LMGT3: false, LMGTE: false },
    classSeasons: { Hypercar: '', LMP2: '', LMP3: '', LMGT3: '', LMGTE: '' },
    pointsTables: {
      Sprint: { duration: 40, points: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] },
      Medium: { duration: 60, points: [38, 27, 23, 18, 15, 12, 9, 6, 3, 2] },
      Long: { duration: 80, points: [50, 36, 30, 24, 20, 16, 12, 8, 4, 2] }
    },
    bonusPoints: { pole: 1, fastestLap: 1, mostLapsLed: 1 },
    dropWeeks: 0,
    trackLimitsPreset: 'Default',
    raceSettings: { aiDifficulty: 90, aiAggression: 'Medium', mechanicalFailures: 'Normal', flagRules: 'Full', raceStart: 'Rolling', setupRules: 'Fixed', pitStopReq: 'None', fuelMultiplier: 'Realistic', tireWearMultiplier: 'Realistic', tireCount: 8, trackLimitPoints: 5, practiceLengthMin: 30, qualifyLengthMin: 7 }
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

function _rccBuildWizard(m, tracks, cars, edit) {
  var editing = !!edit;
  var details = editing ? JSON.parse(JSON.stringify(edit.seasonDetails || {})) : _rccDefaultDetails();
  var defaults = _rccDefaultDetails();
  ['classes', 'classSeasons', 'pointsTables', 'bonusPoints', 'raceSettings'].forEach(function (k) { if (!details[k]) details[k] = defaults[k]; });
  details.dropWeeks = 0;
  if (!details.trackLimitsPreset) details.trackLimitsPreset = 'Default';
  var classesLocked = editing && edit.registered;
  var pointsLocked = editing && edit.anyResults;
  var state = {
    name: editing ? edit.name : '',
    details: details,
    rounds: editing ? edit.rounds.map(function (r) {
      return { roundId: r.roundId, trackId: r.trackId, eventName: r.eventName, raceLengthTier: r.raceLengthTier, weather: r.weather || 'Clear', chanceOfRain: r.chanceOfRain || 0, temperatureC: r.temperatureC === null ? '' : r.temperatureC, igRaceStart: r.igRaceStart || '14:00', locked: r.locked };
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
  var trackById = {};
  tracks.forEach(function (t) { trackById[t.TrackID] = t; });
  function newRound() {
    var t = layoutsByVenue[venues[0]][0];
    return { roundId: '', trackId: t.TrackID, eventName: '', raceLengthTier: Object.keys(state.details.pointsTables)[0] || 'Sprint', weather: 'Clear', chanceOfRain: 0, temperatureC: 25, igRaceStart: '14:00', locked: false };
  }
  if (!state.rounds.length) for (var i = 0; i < 6; i++) state.rounds.push(newRound());

  // Years per class from the Cars tab.
  var yearsByClass = {};
  cars.forEach(function (c) {
    var y = String(c.Season);
    var list = yearsByClass[c.Class] || (yearsByClass[c.Class] = []);
    if (y && list.indexOf(y) === -1) list.push(y);
  });
  Object.keys(yearsByClass).forEach(function (k) { yearsByClass[k].sort().reverse(); });

  m.body.innerHTML = '';
  var form = _rccEl('div', 'rcc-wizard');
  m.body.appendChild(form);

  // --- Season ---
  var sec1 = _rccSection('Season');
  sec1.appendChild(_rccField('Season Name', _rccTextInput(state.name, function (v) { state.name = v; }, 60)));
  form.appendChild(sec1);

  // --- Classes ---
  var sec2 = _rccSection('Classes');
  if (classesLocked) sec2.appendChild(_rccText('div', 'rc-hint', 'Locked: you have already joined a team, so the grid can no longer change.'));
  var classGrid = _rccEl('div', 'rcc-class-grid');
  RCC_CLASS_ORDER.forEach(function (cls) {
    var years = yearsByClass[cls] || [];
    var rowEl = _rccEl('div', 'rcc-class-row');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'rcc-class-' + cls;
    cb.checked = !!state.details.classes[cls];
    cb.disabled = classesLocked || !years.length;
    var lbl = _rccText('label', 'rcc-class-label', cls);
    lbl.htmlFor = cb.id;
    var yearSel = _rccSelect(years.length ? years : ['No cars'], state.details.classSeasons[cls] || years[0], function (v) { state.details.classSeasons[cls] = v; updateCount(); });
    yearSel.disabled = classesLocked || !years.length;
    if (!state.details.classSeasons[cls] && years.length) state.details.classSeasons[cls] = years[0];
    var count = _rccEl('span', 'rcc-class-count');
    function updateCount() {
      var n = cars.filter(function (c) { return c.Class === cls && String(c.Season) === String(state.details.classSeasons[cls]); }).length;
      count.textContent = years.length ? n + ' car' + (n === 1 ? '' : 's') : 'No active cars';
    }
    cb.addEventListener('change', function () { state.details.classes[cls] = cb.checked; });
    updateCount();
    rowEl.appendChild(cb);
    rowEl.appendChild(lbl);
    rowEl.appendChild(yearSel);
    rowEl.appendChild(count);
    classGrid.appendChild(rowEl);
  });
  sec2.appendChild(classGrid);
  sec2.appendChild(_rccText('div', 'rc-hint', 'Every active car in a picked class and year joins the grid. Your rivals are the real drivers listed on each car.'));
  form.appendChild(sec2);

  // --- Race settings ---
  var rs = state.details.raceSettings;
  var sec3 = _rccSection('Race Settings');
  var diffOptions = [];
  for (var d = 75; d <= 105; d++) diffOptions.push({ label: d + '%', value: d });
  var g3 = _rccEl('div', 'rcc-field-grid');
  g3.appendChild(_rccField('AI Difficulty', _rccSelect(diffOptions, rs.aiDifficulty || 90, function (v) { rs.aiDifficulty = Number(v); })));
  g3.appendChild(_rccField('AI Aggression', _rccSelect(['Low', 'Medium', 'High'], rs.aiAggression || 'Medium', function (v) { rs.aiAggression = v; })));
  g3.appendChild(_rccField('Mechanical Failures', _rccSelect(['Off', 'Normal', 'Time Scale'], rs.mechanicalFailures || 'Normal', function (v) { rs.mechanicalFailures = v; })));
  g3.appendChild(_rccField('Flag Rules', _rccSelect(['None', 'Black Only', 'Full', 'Full w/o DQ'], rs.flagRules || 'Full', function (v) { rs.flagRules = v; })));
  g3.appendChild(_rccField('Start', _rccSelect(['Rolling', 'Fast'], rs.raceStart || 'Rolling', function (v) { rs.raceStart = v; })));
  g3.appendChild(_rccField('Setup Rules', _rccSelect(['Fixed', 'Open'], rs.setupRules, function (v) { rs.setupRules = v; })));
  g3.appendChild(_rccField('Pit Stop Requirements', _rccSelect(['None', 'Mandatory Tire Change', 'Mandatory Fuel-Only'], rs.pitStopReq, function (v) { rs.pitStopReq = v; })));
  g3.appendChild(_rccField('Fuel Multiplier', _rccSelect(RCC_MULTIPLIERS, rs.fuelMultiplier, function (v) { rs.fuelMultiplier = v; })));
  g3.appendChild(_rccField('Tire Wear Multiplier', _rccSelect(RCC_MULTIPLIERS, rs.tireWearMultiplier, function (v) { rs.tireWearMultiplier = v; })));
  g3.appendChild(_rccField('Track Limits', _rccSelect(['Strict', 'Relaxed', 'Default'], state.details.trackLimitsPreset, function (v) { state.details.trackLimitsPreset = v; })));
  g3.appendChild(_rccField('Tire Count Allowed', _rccNumber(rs.tireCount, function (v) { rs.tireCount = v; }, 0)));
  g3.appendChild(_rccField('Track Limit Points Before DT', _rccNumber(rs.trackLimitPoints, function (v) { rs.trackLimitPoints = v; }, 0)));
  g3.appendChild(_rccField('Practice Length (min)', _rccNumber(rs.practiceLengthMin, function (v) { rs.practiceLengthMin = v; }, 0)));
  g3.appendChild(_rccField('Qualify Length (min)', _rccNumber(rs.qualifyLengthMin, function (v) { rs.qualifyLengthMin = v; }, 0)));
  sec3.appendChild(g3);
  form.appendChild(sec3);

  // --- Points ---
  var sec4 = _rccSection('Points');
  if (pointsLocked) sec4.appendChild(_rccText('div', 'rc-hint', 'Locked: results have been imported, so points can no longer change.'));
  var tables = state.details.pointsTables;
  Object.keys(tables).forEach(function (tier) {
    var t = tables[tier];
    var row = _rccEl('div', 'rcc-points-row');
    row.appendChild(_rccText('div', 'rcc-points-tier', tier));
    var dur = _rccNumber(t.duration, function (v) { t.duration = v; }, 0);
    dur.disabled = pointsLocked;
    row.appendChild(_rccField('Minutes', dur));
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
  var bonusRow = _rccEl('div', 'rcc-bonus-row');
  bonusRow.appendChild(_rccText('div', 'rcc-points-tier', 'Bonus'));
  var g4 = _rccEl('div', 'rcc-field-grid rcc-bonus-grid');
  [['pole', 'Pole Position Bonus'], ['fastestLap', 'Fastest Lap Bonus'], ['mostLapsLed', 'Most Laps Led Bonus']].forEach(function (pair) {
    var n = _rccSelect([0, 1, 2, 3, 4, 5], Math.min(5, Math.max(0, Number(b[pair[0]]) || 0)), function (v) { b[pair[0]] = Number(v); });
    n.disabled = pointsLocked;
    g4.appendChild(_rccField(pair[1], n));
  });
  bonusRow.appendChild(g4);
  sec4.appendChild(bonusRow);
  form.appendChild(sec4);

  // --- Rounds ---
  var sec5 = _rccSection('Rounds');
  sec5.appendChild(_rccText('div', 'rc-hint', 'No dates in championship mode: run the rounds in order, whenever you like. Leave Event Name blank to use the season name.'));
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
        down.disabled = idx === state.rounds.length - 1;
        down.addEventListener('click', function () { var x = state.rounds[idx + 1]; state.rounds[idx + 1] = r; state.rounds[idx] = x; drawRounds(); });
        var del = _rccText('button', 'rc-btn-secondary rc-btn-row', 'Remove');
        del.type = 'button';
        del.disabled = state.rounds.length === 1;
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
      var venueSel = _rccSelect(venues, t.TrackName, function (v) { fillLayouts(v); });
      layoutSel.addEventListener('change', function () { r.trackId = layoutSel.value; });
      fillLayouts(t.TrackName, r.trackId);
      g.appendChild(_rccField('Event Name', _rccTextInput(r.eventName, function (v) { r.eventName = v; }, 60)));
      g.appendChild(_rccField('Track', venueSel));
      g.appendChild(_rccField('Layout', layoutSel));
      g.appendChild(_rccField('Race Length', _rccSelect(Object.keys(state.details.pointsTables), r.raceLengthTier, function (v) { r.raceLengthTier = v; })));
      r.chanceOfRain = _rccSnapRain(r.chanceOfRain);
      var rainSel = _rccSelect(RCC_RAIN_CHANCES, r.chanceOfRain, function (v) { r.chanceOfRain = Number(v); });
      function syncRain() {
        var dry = RCC_DRY_WEATHER.indexOf(r.weather) !== -1;
        if (dry) { r.chanceOfRain = 0; rainSel.value = '0'; }
        rainSel.disabled = dry;
        rainSel.title = dry ? 'No rain in ' + r.weather + ' weather.' : '';
      }
      g.appendChild(_rccField('Weather', _rccSelect(RCC_WEATHER, r.weather, function (v) { r.weather = v; syncRain(); })));
      g.appendChild(_rccField('Chance of Rain', rainSel));
      syncRain();
      g.appendChild(_rccField('Temperature (°C)', _rccNumber(r.temperatureC, function (v) { r.temperatureC = v; })));
      var timeInput = document.createElement('input');
      timeInput.type = 'time';
      timeInput.value = r.igRaceStart || '';
      timeInput.addEventListener('input', function () { r.igRaceStart = timeInput.value; });
      g.appendChild(_rccField('In-Game Race Start', timeInput));
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
        return { roundId: r.roundId, trackId: r.trackId, eventName: r.eventName, raceLengthTier: r.raceLengthTier, weather: r.weather, chanceOfRain: r.chanceOfRain, temperatureC: r.temperatureC, igRaceStart: r.igRaceStart };
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
      _rccToast('No answer from the server after 6 minutes. Reload the page to see whether it was saved.', 'error');
    });
  });
}

// ---------------------------------------------------------------------
// END SEASON
// ---------------------------------------------------------------------
function rccOpenEndSeason() {
  var page = RCC.page;
  var open = (page.calendar || []).filter(function (c) { return !c.hasResults; });
  if (open.length) {
    _rccToast('Every round needs its results before the season can end. Still to race: ' + open.map(function (c) { return 'Round ' + c.roundNum; }).join(', ') + '.', 'error');
    return;
  }
  rccConfirm('End Season', 'End "' + page.seasonName + '"? The standings become final and the season can no longer be edited. You can then create your next season.',
    'End Season', 'Ending Season...',
    function () { return _rccApi('champEndSeason', { seasonId: page.seasonId }, { post: true }); },
    function () { _rccToast('Season ended.', 'success'); rccReloadAfterSave(); });
}

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
      _rccToast('No answer from the server after 6 minutes. Reload the page to see whether it was deleted.', 'error');
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
  var open = cal.filter(function (x) { return !x.hasQualifyResults && !x.hasRaceResults; });
  var c;
  if (lockRound) {
    c = cal.filter(function (x) { return x.roundId === roundId; })[0];
    if (!c) { _rccToast('That round is not part of this season.', 'error'); return; }
    if (c.hasQualifyResults || c.hasRaceResults) { _rccToast('Round ' + c.roundNum + ' already has results. Use Erase Results first.', 'error'); return; }
  } else {
    if (!open.length) { _rccToast('Every round already has results.', 'error'); return; }
    c = open[0];
  }
  var m = rccOpenModal('Upload Results', { narrow: false });
  m.dialog.classList.add('rcc-light-dialog');
  var roundSel = null;
  if (lockRound) {
    m.body.appendChild(_rccField('Round', _rccText('div', 'rcc-upload-round', _rccRoundLabel(c))));
  } else {
    roundSel = _rccSelect(open.map(function (x) { return { label: _rccRoundLabel(x), value: x.roundId }; }), c.roundId, function (v) {
      c = open.filter(function (x) { return x.roundId === v; })[0] || c;
    });
    m.body.appendChild(_rccField('Round', roundSel));
  }
  function fileInput() {
    var f = document.createElement('input');
    f.type = 'file';
    f.accept = '.xml,text/xml';
    return f;
  }
  var qFile = fileInput();
  var rFile = fileInput();
  m.body.appendChild(_rccField('1. Qualify Results (XML)', qFile));
  m.body.appendChild(_rccField('2. Race Results (XML)', rFile));
  var row = _rccEl('div', 'rcc-btn-row rcc-btn-row-end');
  var go = _rccText('button', 'rc-btn-primary rc-btn-sm', 'Upload Results');
  go.type = 'button';
  go.disabled = true;
  row.appendChild(go);
  m.body.appendChild(row);
  function bothChosen() { return !!(qFile.files && qFile.files[0] && rFile.files && rFile.files[0]); }
  qFile.addEventListener('change', function () { go.disabled = !bothChosen(); });
  rFile.addEventListener('change', function () { go.disabled = !bothChosen(); });
  function readFile(f) {
    return new Promise(function (resolve, reject) {
      var rd = new FileReader();
      rd.onload = function () { resolve({ name: f.name, text: String(rd.result || '') }); };
      rd.onerror = function () { reject(new Error('Could not read ' + f.name)); };
      rd.readAsText(f);
    });
  }
  function lockInputs(on) { qFile.disabled = on; rFile.disabled = on; if (roundSel) roundSel.disabled = on; }

  go.addEventListener('click', function () {
    if (!bothChosen()) { _rccToast('Choose both files: 1 is the Qualify results, 2 is the Race results.', 'error'); return; }
    lockInputs(true);
    rccRunWrite(go, 'Uploading...', function () {
      return Promise.all([readFile(qFile.files[0]), readFile(rFile.files[0])]).then(function (read) {
        return _rccApi('champImportXml', {
          seasonId: page.seasonId, roundId: c.roundId,
          qualifyFilename: read[0].name, qualifyXml: read[0].text,
          raceFilename: read[1].name, raceXml: read[1].text
        }, { post: true });
      });
    }).then(function (res) {
      if (_rccHandleAuthError(res)) return;
      if (!res || !res.success) {
        _rccToast((res && res.message) || 'Import failed.', 'error');
        lockInputs(false);
        return;
      }
      (res.warnings || []).forEach(function (w) { _rccToast(w, 'info'); });
      _rccToast('Round ' + c.roundNum + ' results uploaded.', 'success');
      m.close(true);
      rccReloadAfterSave();
    }).catch(function (e) {
      lockInputs(false);
      _rccToast(e && e.message ? e.message : 'No answer from the server after 6 minutes. Reload the page to see whether the files went in.', 'error');
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
  var m = rccOpenModal('Help', { wide: true });
  m.body.classList.add('rcc-help-body');
  var sections = typeof RCC_HELP_SECTIONS !== 'undefined' ? RCC_HELP_SECTIONS : [];
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
// ERASE RESULTS -- pick a round that has results from a dropdown, then erase it. The round stays on
// the calendar, ready for a new upload. Allowed until the season ends.
// ---------------------------------------------------------------------
function rccOpenErase() {
  var page = RCC.page;
  var done = (page.calendar || []).filter(function (x) { return x.hasQualifyResults || x.hasRaceResults; });
  if (!done.length) { _rccToast('No results to erase yet.', 'error'); return; }
  var c = done[done.length - 1];
  var m = rccOpenModal('Erase Results', { narrow: false });
  m.dialog.classList.add('rcc-light-dialog');
  var sel = _rccSelect(done.map(function (x) { return { label: _rccRoundLabel(x), value: x.roundId }; }), c.roundId, function (v) {
    c = done.filter(function (x) { return x.roundId === v; })[0] || c;
    say();
  });
  m.body.appendChild(_rccField('Round', sel));
  var text = _rccEl('p', 'rcc-confirm-text');
  m.body.appendChild(text);
  function say() {
    text.textContent = 'Erase every imported result for Round ' + c.roundNum + ' (' + c.eventName + ')? The round itself stays on the calendar, ready for a new upload. Driver names already added to the Cars tab stay there.';
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
    sel.disabled = true;
    rccRunWrite(commit, 'Erasing...', function () {
      return _rccApi('champEraseRound', { roundId: round.roundId }, { post: true });
    }).then(function (res) {
      cancel.disabled = false;
      sel.disabled = false;
      if (_rccHandleAuthError(res)) return;
      if (!res || !res.success) { _rccToast((res && res.message) || 'That did not work. Try again.', 'error'); return; }
      _rccToast('Round ' + round.roundNum + ' erased.', 'success');
      m.close(true);
      rccReloadAfterSave();
    }).catch(function () {
      cancel.disabled = false;
      sel.disabled = false;
      _rccToast('No answer from the server after 6 minutes. Reload the page to see whether it went through.', 'error');
    });
  });
}

// ---------------------------------------------------------------------
// SAVED COPY (same idea as league.js's rc_league_hub_v1): the last page payload is kept in this
// browser, drawn instantly on the next visit, then refreshed quietly in the background with one
// Apps Script call. The screen only redraws if the fresh data differs. One copy per owner + season
// view; championship.html's <head> checks the same key to skip the loading overlay.
// ---------------------------------------------------------------------
var RCC_SAVED_PREFIX = 'rc_champ_page_v1:';
function _rccSavedKey() { return RCC_SAVED_PREFIX + RCC.ownerId + ':' + (_rccQuery('season') || ''); }
function _rccReadSaved() { try { return localStorage.getItem(_rccSavedKey()); } catch (err) { return null; } }
function _rccWriteSaved(text) { try { localStorage.setItem(_rccSavedKey(), text); } catch (err) { /* storage full or blocked -- the page still works */ } }
function _rccForgetSavedPages() {
  try {
    var prefix = RCC_SAVED_PREFIX + RCC.ownerId + ':';
    var drop = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(prefix) === 0) drop.push(k);
    }
    drop.forEach(function (k) { localStorage.removeItem(k); });
  } catch (err) { /* nothing saved, nothing to drop */ }
}

// ---------------------------------------------------------------------
// BOOT
// ---------------------------------------------------------------------
function rccRenderAll(page) {
  RCC.page = page;
  rccRenderHero(page);
  rccRenderActionBar(page);
  rccRenderTicker(page);
  rccRenderLastRace(page);
  rccRenderCarousel(page);
  rccRenderStandings(page);
  rccRenderManufacturers(page);
}

document.addEventListener('DOMContentLoaded', function () {
  if (!_rccCheckAccess()) return;
  _rccShowCarriedToasts();
  var EMPTY = { hasSeason: false, owner: { displayName: '' }, seasons: [] };

  // 1. Draw the saved copy instantly, if this browser has one.
  var currentText = null;
  var savedText = _rccReadSaved();
  if (savedText) {
    try {
      var saved = JSON.parse(savedText);
      if (saved && saved.success) {
        currentText = savedText;
        rccRenderAll(saved);
        _rccHidePageLoader();
      }
    } catch (parseErr) { currentText = null; }
  }
  if (!currentText) {
    document.documentElement.classList.remove('rcl-has-cache');
    _rccLockScroll();
  }

  // 2. Fetch fresh data; redraw only when it differs from what's on screen.
  var revalidating = false;
  function revalidate() {
    if (revalidating) return;
    revalidating = true;
    var hadCopy = !!currentText;
    _rccApi('champGetPage', { seasonId: _rccQuery('season') }).then(function (page) {
      if (_rccHandleAuthError(page)) return;
      if (page && page.success) {
        var text = JSON.stringify(page);
        if (text !== currentText) {
          currentText = text;
          _rccWriteSaved(text);
          rccRenderAll(page);
        }
      } else if (!hadCopy) {
        rccRenderAll(EMPTY);
        _rccToast((page && page.message) || 'Could not load the championship.', 'error');
      }
    }).catch(function () {
      if (!hadCopy) {
        rccRenderAll(EMPTY);
        _rccToast('Could not reach the server. Reload the page to try again.', 'error');
      }
    }).then(function () {
      revalidating = false;
      if (!hadCopy) { _rccUnlockScroll(); _rccHidePageLoader(); }
    });
  }
  revalidate();

  // Coming back with the browser's Back button can restore the page from memory; refresh quietly.
  window.addEventListener('pageshow', function (evt) { if (evt.persisted) revalidate(); });
});
