// Race Club — js/header.js (v0.4.0)
// Shared fixed site header used on every page.
var RC_HEADER_HEIGHT = 70;

// Return-to-page after login (ECO chat, 2026-10-10). When someone starts Register / Login from the
// home, League Hub, Championship or driver profile page, we remember that page for 30 minutes
// (sessionStorage, this tab only). login.html sends them back to it after a successful login
// instead of the Dashboard. Works through register -> verify -> login too, since all of that stays
// in the same tab. Any other way into login.html (Account.html timing out, a typed address) has
// nothing remembered, so those still go to the Dashboard.
var RC_RETURN_PAGES_ = ['', 'index.html', 'league.html', 'championship.html', 'profile.html'];
function rcRememberReturnPage() {
  try {
    var file = (location.pathname.split('/').pop() || '').toLowerCase();
    if (RC_RETURN_PAGES_.indexOf(file) === -1) return;
    sessionStorage.setItem('raceclub_return_to', JSON.stringify({ url: (file || 'index.html') + location.search + location.hash, t: Date.now() }));
  } catch (e) {}
}
// Where login.html should go: the remembered page if it is fresh and one of the allowed pages,
// otherwise the Dashboard. Clears the memory either way.
function rcTakeReturnPage() {
  var dest = 'Account.html';
  try {
    var raw = sessionStorage.getItem('raceclub_return_to');
    sessionStorage.removeItem('raceclub_return_to');
    var o = raw ? JSON.parse(raw) : null;
    if (o && o.url && (Date.now() - o.t) < 30 * 60 * 1000 && /^[a-z0-9-]+\.html([?#][^\s]*)?$/i.test(o.url)) {
      var f = o.url.split(/[?#]/)[0].toLowerCase();
      if (RC_RETURN_PAGES_.indexOf(f) > 0) dest = o.url;
    }
  } catch (e) {}
  return dest;
}
document.addEventListener('click', function (evt) {
  var a = evt.target && evt.target.closest ? evt.target.closest('a[href]') : null;
  if (!a) return;
  var h = a.getAttribute('href') || '';
  if (/^(login|register)\.html([?#]|$)/i.test(h)) rcRememberReturnPage();
}, true);
var RC_TOAST_CONTAINER_ID = 'rc-toast-container';

// Shared helmet-avatar helpers -- defined here (not per file) because header.js loads on every
// page before any other script runs. A driver's avatar is now a custom helmet: profile.avatarFilename
// holds "helmet:" + a small JSON recipe (anything else = no helmet designed yet = default helmet).
// The heavy drawing code lives in js/helmet-avatar.js + js/helmet.js and is loaded only when a
// helmet actually has to be drawn; a drawn helmet is remembered for the browser session, so the next
// page paints it instantly.
var RC_HELMET_CACHE_V_ = 'rch6';
function rcHelmetCacheKey_(value, w) {
  var d = '', ver = '';
  try { ver = localStorage.getItem('rcHelmetVer') || ''; } catch (e) {}   // the helmet version number: a new number means every saved picture is stale
  if (!value) { try { d = localStorage.getItem('rcHelmetDefSig') || ''; } catch (e) {} }   // changes whenever the default helmet or design list changes
  return RC_HELMET_CACHE_V_ + ':' + w + ':' + ver + ':' + (value || ('default' + d));
}
function _rcHelmetEsc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// HTML for one helmet placeholder. Already-drawn helmets come back as a finished <img>.
function rcHelmetHtml_(value, width, cls) {
  var src = '';
  try { src = sessionStorage.getItem(rcHelmetCacheKey_(value, width)) || ''; } catch (e) {}
  var inner = src ? '<img class="rc-helmet" alt="" style="width:' + width + 'px;height:auto" src="' + _rcHelmetEsc_(src) + '">' : '';
  return '<span class="rc-helmet-slot ' + _rcHelmetEsc_(cls || '') + '" data-rc-helmet="' + _rcHelmetEsc_(value || '') + '" data-w="' + width + '"' +
    (src ? ' data-rc-done="1"' : '') + ' style="width:' + width + 'px">' + inner + '</span>';
}

var _rcHelmetModuleP_ = null;
function _rcHelmetModule_() {
  if (!_rcHelmetModuleP_) {
    _rcHelmetModuleP_ = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'js/helmet-avatar.js?v=29'; s.async = true;
      s.onload = function () { res(); };
      s.onerror = function () { _rcHelmetModuleP_ = null; rej(new Error('helmet module')); };
      document.head.appendChild(s);
    });
  }
  return _rcHelmetModuleP_;
}
// Draws every helmet placeholder inside root (default: the whole page).
function rcHelmetHydrate_(root) {
  var r = root || document;
  if (!r.querySelector('[data-rc-helmet]:not([data-rc-done])')) return Promise.resolve();
  return _rcHelmetModule_().then(function () { return window.rcHelmetHydrateNow_(r); }).catch(function () {});
}
// The site's start-lights loading block, for popups that must open before their content is ready.
function rcHelmetSpinner_(message) {
  var wrap = document.createElement('div'); wrap.className = 'rc-inline-spinner-wrap';
  var lights = document.createElement('div'); lights.className = 'rc-startlights';
  for (var i = 0; i < 5; i++) { var l = document.createElement('span'); l.className = 'rc-startlight'; lights.appendChild(l); }
  wrap.appendChild(lights);
  var t = document.createElement('div'); t.className = 'rc-loading-text'; t.textContent = message || 'Loading...';
  wrap.appendChild(t);
  return wrap;
}
function _rcHelmetCss_() {
  if (document.querySelector('link[data-rch-css]') || document.querySelector('link[href*="helmet.css"]')) return;
  var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/helmet.css?v=22'; l.setAttribute('data-rch-css', '1');
  document.head.appendChild(l);
}
// Opens the Customize Helmet popup AT ONCE with the loading lights, then fills it in once everything
// has loaded. o = { profile, token, showModal, showToast, onChange }.
function rcHelmetCustomize_(o) {
  _rcHelmetCss_();
  var body = document.createElement('div'); body.className = 'rch-designer rch-player';
  body.appendChild(rcHelmetSpinner_('Loading your helmet designer...'));
  var modal = o.showModal('Customize Helmet', { bodyEl: body, wide: true });
  var shell = { body: body, modal: modal };
  return _rcHelmetModule_().then(function () { return window.rcHelmetCustomizeNow_(o, shell); })
    .catch(function () {
      body.innerHTML = '<p class="rch-hint">Could not open the helmet customizer. Close this and try again.</p>';
    });
}

// Hamburger icon -- same stroke-width/cap/join convention as every other inline icon on the site
// (Account.html's ICON_* constants), just declared here since header.js is its own script scope.
var RC_HEADER_ICON_HAMBURGER = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>';

function _rcEnsureToastContainer() {
  var c = document.getElementById(RC_TOAST_CONTAINER_ID);
  if (!c) {
    c = document.createElement('div');
    c.id = RC_TOAST_CONTAINER_ID;
    c.className = 'rc-toast-container';
    document.body.appendChild(c);
  }
  return c;
}

// Default duration by type -- used only when a caller doesn't pass its own durationMs. Error toasts
// get the longest window since a failure is the one result worth still being readable a few seconds
// later; success/confirmation toasts get a touch longer than the old one-size default too; info
// keeps exactly what it always was.
var RC_TOAST_DEFAULT_DURATION_MS_ = { error: 7000, success: 5000, info: 4200 };

function showToast(message, type, durationMs) {
  if (!message) return;
  type = (type === 'success' || type === 'error') ? type : 'info';
  durationMs = durationMs || RC_TOAST_DEFAULT_DURATION_MS_[type];

  var container = _rcEnsureToastContainer();
  var toast = document.createElement('div');
  toast.className = 'rc-toast rc-toast-' + type;

  var text = document.createElement('span');
  text.className = 'rc-toast-text';
  text.textContent = message;

  var closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'rc-toast-close';
  closeBtn.setAttribute('aria-label', 'Dismiss');
  closeBtn.innerHTML = '&times;';

  toast.appendChild(text);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  // Double rAF so the browser paints the pre-transition state first -- adding rc-toast-in in the
  // same tick the element is inserted can get coalesced by the browser and skip the slide/fade-in
  // entirely.
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { toast.classList.add('rc-toast-in'); });
  });

  var timeoutId;
  function dismiss() {
    clearTimeout(timeoutId);
    toast.classList.remove('rc-toast-in');
    toast.classList.add('rc-toast-out');
    setTimeout(function () { toast.remove(); }, 220);
  }
  closeBtn.addEventListener('click', dismiss);
  timeoutId = setTimeout(dismiss, durationMs);
  return { dismiss: dismiss };
}

// Icons for the account dropdown -- the same glyphs Account.html's sidebar uses for each item.
var RC_HEADER_MENU_ICONS_ = {
  hub: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="22" x2="4" y2="3"></line><path d="M4 4h14l-3 4 3 4H4"></path></svg>',
  champ: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8v5a4 4 0 0 1-8 0V3z"></path><path d="M8 4H4a3 3 0 0 0 3 5"></path><path d="M16 4h4a3 3 0 0 1-3 5"></path><path d="M12 12v4"></path><path d="M9 20h6"></path><path d="M10 20v-2.5"></path><path d="M14 20v-2.5"></path></svg>',
  profile: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"></path></svg>',
  dash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1"></rect><rect x="13" y="3" width="8" height="8" rx="1"></rect><rect x="3" y="13" width="8" height="8" rx="1"></rect><rect x="13" y="13" width="8" height="8" rx="1"></rect></svg>',
  admin: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>',
  league: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"></rect><path d="M9 3v2h6V3"></path><line x1="8" y1="11" x2="16" y2="11"></line><line x1="8" y1="15" x2="16" y2="15"></line></svg>',
  steward: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"></path><path d="M9 12l2 2 4-4"></path></svg>',
  edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z"></path></svg>',
  help: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M9.2 9a2.8 2.8 0 0 1 5.4 1c0 1.8-2.6 2-2.6 3.6"></path><line x1="12" y1="17" x2="12" y2="17.2"></line></svg>',
  feedback: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3 1-4.2A8 8 0 1 1 21 12Z"></path><line x1="8" y1="11" x2="16" y2="11"></line><line x1="8" y1="14" x2="13" y2="14"></line></svg>',
  login: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>',
  logout: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>'
};
function _rcMenuIcon_(key) { return '<span class="rc-header-menu-icon" aria-hidden="true">' + (RC_HEADER_MENU_ICONS_[key] || '') + '</span>'; }

// Builds the Dashboard..Stewarding portion of the account dropdown, mirroring Account.html's
// sidebar order/gating exactly (see the big comment at that markup's call site above).
function _rcBuildAccountMenuSectionLinks(role) {
  function link(section, label, iconKey) {
    return '<a class="rc-header-menu-item" href="Account.html#' + section + '" data-rc-section="' + section + '">' + _rcMenuIcon_(iconKey) + '<span>' + label + '</span></a>';
  }
  // Small arrow on the links that leave the current page for another page (same marker as the Account sidebar).
  var EXT = '<svg class="rc-nav-ext" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"></path><path d="M8 7h9v9"></path></svg>';
  var DIV = '<hr class="rc-header-menu-divider">';
  // Same grouping and order as Account.html's sidebar (reorganized 2026-10-17):
  //   Me: Dashboard, My Profile Page, Settings | The league: League Hub, Championship |
  //   Staff (only the ones this role unlocks): League Tools, Stewarding, Admin.
  // The caller adds a divider, then League Help / Feedback / Discord, a divider, and Logout.
  var html = link('dashboard', 'Dashboard', 'dash');
  // My Profile Page: off-page link to the driver's own public career page (saved login profile).
  var myProfile = (typeof getProfileCache === 'function') ? getProfileCache() : null;
  if (myProfile && /^RC-\d+$/.test(String(myProfile.profileId || ''))) {
    html += '<a class="rc-header-menu-item" href="profile.html?id=' + encodeURIComponent(myProfile.profileId) + '">' + _rcMenuIcon_('profile') + '<span>My Profile Page</span></a>';
  }
  html += '<button type="button" class="rc-header-menu-item" id="rc-header-menu-editprofile">' + _rcMenuIcon_('edit') + '<span>Edit Profile</span></button>';
  html += DIV;
  html += '<a class="rc-header-menu-item" href="league.html">' + _rcMenuIcon_('hub') + '<span>League Hub</span>' + EXT + '</a>';
  // Championship (CHAMP chat, 2026-10-08): the driver's own offline championship page. Open to Admins and to anyone
  // with Championship Access (the + on their role); everyone else sees it grayed out and unclickable.
  var champProfile = myProfile;
  var champId = champProfile && /^RC-\d+$/.test(String(champProfile.profileId || '')) ? champProfile.profileId : '';
  if ((role === 'Admin' || (champProfile && champProfile.champAccess)) && champId) {
    html += '<a class="rc-header-menu-item" href="championship.html?id=' + encodeURIComponent(champId) + '">' + _rcMenuIcon_('champ') + '<span>Championship</span>' + EXT + '</a>';
  } else {
    html += '<span class="rc-header-menu-item" aria-disabled="true" title="Needs Championship Access (the + on your role)." style="opacity:0.4;cursor:not-allowed;">' + _rcMenuIcon_('champ') + '<span>Championship</span></span>';
  }
  var staff = '';
  if (role === 'Admin' || role === 'Organizer') staff += link('league', 'League Tools', 'league');
  if (role === 'Admin' || role === 'Organizer' || role === 'Steward') staff += link('stewarding', 'Stewarding', 'steward');
  if (role === 'Admin') staff += link('admin', 'Admin', 'admin');
  if (staff) html += DIV + '<div class="rc-header-menu-label">Staff</div>' + staff;
  return html;
}

function _rcHeaderInitials(name) {
  var parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Championship Access marker (CHAMP chat, 2026-10-08): a bold + right after the role name
// (DRIVER+, STEWARD+, ORGANIZER+) for anyone who may run their own offline championship. Admins
// always have access and keep a plain ADMIN pill. Takes a profile-cache object or a Users row.
function rcRolePlusHtml(p) {
  if (!p) return '';
  var role = p.role || p.Role;
  var on = p.champAccess !== undefined ? !!p.champAccess : (p.ChampAccess === true || String(p.ChampAccess).toLowerCase() === 'true');
  if (role === 'Admin' || !on) return '';
  return '<b style="font-weight:900;font-size:1.15em;line-height:1;margin-left:1px;">+</b>';
}

// Same Admin/Organizer/Steward/Driver/Prospect -> .rc-badge-role-* mapping as Account.html's own
// ROLE_PILL_CLASS (Admin section's Members list), duplicated here rather than shared since
// header.js and Account.html are separate script scopes on separate pages -- see the
// .rc-badge-role-* rules in style.css for the actual colors.
var RC_HEADER_ROLE_PILL_CLASS_ = {
  Admin: 'rc-badge-role-admin',
  Organizer: 'rc-badge-role-organizer',
  Steward: 'rc-badge-role-steward',
  Driver: 'rc-badge-role-driver',
  Prospect: 'rc-badge-role-prospect'
};

// updateHeaderNotifDot (the bell's unread-count badge) removed.

// Shared Edit Profile bridge. window.rcOpenEditProfileModal is the bridge Account.html sets once
// its own profile/token are loaded (see buildFullProfileUI there); call it directly when present --
// no navigation, the modal just opens in place.
function _rcOpenEditProfileFromHeader() {
  if (typeof window.rcOpenEditProfileModal === 'function') {
    window.rcOpenEditProfileModal();
  } else if (typeof window.rcOpenEditProfileModalInPlace === 'function') {
    window.rcOpenEditProfileModalInPlace();
  } else {
    sessionStorage.setItem('raceclub_open_edit_profile', '1');
    window.location.href = 'Account.html';
  }
}

// League Help from the account dropdown. On Account.html it shows the in-page Help section; everywhere else it
// opens the Help popup (the same one league.html opens), so the driver never leaves the page.
function _rcOpenLeagueHelpFromHeader() {
  if (typeof window.rcNavigateToSection === 'function') {
    window.rcNavigateToSection('help');
  } else if (typeof window._rclOpenLeagueRulesModal === 'function') {
    window._rclOpenLeagueRulesModal();
  } else if (typeof RULEBOOK_SECTIONS !== 'undefined') {
    rcOpenLeagueHelpModal_();
  } else {
    window.location.href = 'Account.html#help';
  }
}

// Same Help popup as league.html's _rclOpenLeagueRulesModal (js/league.js): same classes, same
// RULEBOOK_SECTIONS source. Used on pages that do not load league.js (the Driver Profile page).
var _rcHelpScrollY_ = 0;
function rcOpenLeagueHelpModal_() {
  function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  var overlay = mk('div', 'rcl-modal-overlay rcl-modal-overlay-over-nav');
  var dialog = mk('div', 'rcl-modal-dialog');
  var head = mk('div', 'rcl-modal-head');
  head.appendChild(mk('div', 'rcl-modal-title', 'Help: Race Club\'s Online League'));
  var closeBtn = mk('button', 'rcl-modal-close', '&times;');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  head.appendChild(closeBtn);
  dialog.appendChild(head);
  var body = mk('div', 'rcl-modal-body rcl-rules-modal-body');
  var rbNav = mk('div', 'rc-rulebook-nav');
  rbNav.appendChild(mk('div', 'rc-rulebook-nav-title', 'Jump To A Section'));
  var rbNavGrid = mk('div', 'rc-rulebook-nav-grid');
  var rbSections = mk('div');
  RULEBOOK_SECTIONS.forEach(function (sec) {
    var link = document.createElement('a');
    link.href = '#rcl-rulebook-sec-' + sec.id;
    link.className = 'rc-rulebook-nav-link' + (sec.draft ? ' rc-rulebook-draft' : '');
    link.textContent = sec.num + '. ' + sec.title;
    rbNavGrid.appendChild(link);
    var secWrap = mk('div', 'rc-rulebook-section');
    secWrap.id = 'rcl-rulebook-sec-' + sec.id;
    secWrap.appendChild(mk('h3', null, sec.num + '. ' + sec.title));
    if (sec.draft) {
      secWrap.appendChild(mk('p', 'rc-rulebook-draft-note', sec.draftNote ? ('Not yet drafted. ' + sec.draftNote) : 'Not yet drafted.'));
    } else {
      var secBody = mk('div');
      secBody.innerHTML = sec.html || '';
      secWrap.appendChild(secBody);
    }
    rbSections.appendChild(secWrap);
  });
  rbNav.appendChild(rbNavGrid);
  body.appendChild(rbNav);
  body.appendChild(rbSections);
  dialog.appendChild(body);
  overlay.appendChild(dialog);
  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('rc-modal-scroll-locked');
    document.body.style.top = '';
    window.scrollTo(0, _rcHelpScrollY_);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  _rcHelpScrollY_ = window.scrollY || window.pageYOffset || 0;
  document.body.style.top = '-' + _rcHelpScrollY_ + 'px';
  document.body.classList.add('rc-modal-scroll-locked');
}

// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// Click-outside/Escape listener leak fix -- renderHeader() runs more than once per page (same
// reason a poll timer would have needed a clear-then-restart dance), and every run used to attach a
// FRESH document-level click and keydown listener via a fresh closure over that run's own
// toggle/menu elements, with nothing ever removing the previous run's pair. mount.innerHTML
// replaces those elements each render, so the old listeners kept running forever against
// now-detached nodes -- harmless individually (a `.contains()` check against a disconnected element
// is just always false) but an unbounded, ever-growing pair of document listeners for the life of
// the tab, one more added every single header re-render.
var _rcHeaderOutsideClickHandler = null;
var _rcHeaderEscapeHandler = null;

// Shared hover-away-closes helper: closeFn fires once the pointer has left every element in
// `elements` for `delayMs` without re-entering any of them.
function _rcWireHoverAwayClose(elements, closeFn, delayMs) {
  delayMs = delayMs || 250;
  var timer = null;
  function cancel() {
    if (timer) { clearTimeout(timer); timer = null; }
  }
  function scheduleClose() {
    cancel();
    timer = setTimeout(closeFn, delayMs);
  }
  elements.forEach(function (elm) {
    elm.addEventListener('mouseenter', cancel);
    elm.addEventListener('mouseleave', scheduleClose);
  });
}

// Which navbar logo is "current": home (Race Club, and every page that is not one of the other two),
// league (league.html) or champ (championship.html). Drives the logo sizes in style.css.
function _rcNavActive_() {
  var p = (location.pathname || '').split('/').pop().toLowerCase();
  if (p === 'league.html') return 'league';
  if (p === 'championship.html') return 'champ';
  return 'home';
}

// Clicking one of the three logos first flips the active size (so the logos grow and shrink, about
// 0.22s), then goes to the page. A modified click (new tab) or reduced motion navigates straight away.
function _rcWireNavLogos_(mount) {
  if (!mount || mount._rcNavLogos) return;
  mount._rcNavLogos = true;
  mount.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a.rc-header-logo-link, a.rc-header-leaguehub-logo-link') : null;
    if (!a || ev.defaultPrevented || ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    if (window.innerWidth < 641) return;
    var href = a.getAttribute('href') || '';
    var target = href === 'league.html' ? 'league' : (href === 'championship.html' ? 'champ' : (href === 'index.html' ? 'home' : ''));
    if (!target) return;
    if (target === mount.getAttribute('data-nav-active')) return; // already here: normal link behavior
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    ev.preventDefault();
    mount.setAttribute('data-nav-active', target);
    setTimeout(function () { window.location.href = href; }, 230);
  });
}

// Shows just the logo -- no HOME/LOGIN/ACCOUNT at all -- while a page is still waiting to find out
// whether its own session is actually valid. Used by Account.html in place of an immediate
// renderHeader() call, so the navbar never asserts a login state (or a logged-out state) it hasn't
// confirmed yet.
function renderHeaderPending() {
  var mount = document.getElementById('rc-header');
  if (!mount) return;
  mount.className = 'rc-fixed-header';
  mount.setAttribute('data-nav-active', _rcNavActive_());
  _rcWireNavLogos_(mount);
  // League Hub badge included here too. Included in this pending state too so the header doesn't
  // visibly gain the badge a moment later once renderHeader() takes over -- it reads as present
  // from the very first paint.
  mount.innerHTML = '<a class="rc-header-logo-link" href="index.html">' +
      '<img class="rc-header-logo" src="assets/images/race-club-header-logo.webp" alt="Race Club">' +
    '</a>' +
    '<span class="rc-header-leaguehub-badge">' +
      '<a class="rc-header-leaguehub-logo-link" href="league.html">' +
        '<img class="rc-header-leaguehub-logo" src="assets/images/league_hub_logo.webp" alt="League Hub" draggable="false">' +
      '</a>' +
    '</span>' +
    // Championship logo (CHAMP chat, 2026-10-09): its own badge with the League Hub classes, so it
    // gets the same responsive gap from League Hub as League Hub has from the Race Club logo.
    '<span class="rc-header-leaguehub-badge" style="padding-left:5.25px;position:relative;top:-1px">' +
      '<a class="rc-header-leaguehub-logo-link" href="championship.html">' +
        '<img class="rc-header-leaguehub-logo" src="assets/images/championship_logo.webp" alt="Championship" draggable="false">' +
      '</a>' +
    '</span>' +
    '<nav class="rc-header-nav"></nav>';
}

// opts.forceLoggedOut: renders the logged-OUT nav (HOME · LOGIN/REGISTER) even if a token is
// present in localStorage. This never clears the token itself (that would force a real re-login
// over what might just be a momentary connection problem) -- it only affects what the header LOOKS
// like on this page load.
function renderHeader(opts) {
  opts = opts || {};
  var mount = document.getElementById('rc-header');
  if (!mount) return;

  var token = opts.forceLoggedOut ? null : ((typeof getToken === 'function') ? getToken() : null);
  var cached = (token && typeof getProfileCache === 'function') ? getProfileCache() : null;
  mount.className = 'rc-fixed-header';
  mount.setAttribute('data-nav-active', _rcNavActive_());
  _rcWireNavLogos_(mount);

  var html = '';
  html += '<a class="rc-header-logo-link" href="index.html">' +
            '<img class="rc-header-logo" src="assets/images/race-club-header-logo.webp" alt="Race Club">' +
          '</a>';
  // League Hub badge. Sits in the same left-hand flex cluster as the logo, not spaced apart from it
  // -- see .rc-header-nav's margin-left: auto (style.css) for how the nav still ends up pushed
  // flush right regardless.
  html += '<span class="rc-header-leaguehub-badge">' +
            '<a class="rc-header-leaguehub-logo-link" href="league.html">' +
              // draggable="false" -- stops the browser's native "pick up and drag this image out"
              // behavior. The matching user-select/user-drag CSS is on .rc-header-leaguehub-logo
              // (style.css) -- together they keep this reading as a clickable link, not draggable/
              // selectable image content.
              '<img class="rc-header-leaguehub-logo" src="assets/images/league_hub_logo.webp" alt="League Hub" draggable="false">' +
            '</a>' +
          '</span>';
  // Championship logo (CHAMP chat, 2026-10-09): its own badge with the League Hub classes, so it
  // sits the same distance from League Hub as League Hub sits from the Race Club logo (48px, 12px
  // on tablets). Links to championship.html: your own championship, or the Welcome box and demo.
  // padding-left 14px: the League Hub image has more blank edge than this one, so the visible gaps
  // only match with it. top:-1px lifts the logo 1px so it sits centred in the bar (Matt).
  html += '<span class="rc-header-leaguehub-badge" style="padding-left:5.25px;position:relative;top:-1px">' +
            '<a class="rc-header-leaguehub-logo-link" href="championship.html">' +
              '<img class="rc-header-leaguehub-logo" src="assets/images/championship_logo.webp" alt="Championship" draggable="false">' +
            '</a>' +
          '</span>';
  html += '<nav class="rc-header-nav">';
  // Logged-in behavior is unchanged -- League Hub still lives in the account dropdown (see the menu
  // markup below), never duplicated in the top bar either way.
  if (token) {
    var displayName = cached ? (cached.displayName || '') : '';
    // Sessions saved before the profile ID was cached have no ID for the My Profile link; fetch it
    // once in the background, save it, and redraw (guarded so it can never loop).
    if (cached && !cached.profileId && typeof fetchApi === 'function' && !window._rcProfileIdHealing_) {
      window._rcProfileIdHealing_ = true;
      fetchApi('getProfile', { token: token }).then(function (data) {
        if (data && data.success && data.profile && data.profile.profileId) {
          setProfileCache(data.profile);
          renderHeader(opts);
        }
      }).catch(function () {});
    }
    // Role / Championship Access are cached at login, so an admin change (DRIVER -> DRIVER+, a new
    // role) never reached a member who stayed logged in. Re-read the profile once per page load and
    // redraw only if something that shows in the header or menu actually changed (cannot loop).
    if (cached && cached.profileId && typeof fetchApi === 'function' && !window._rcProfileFreshChecked_) {
      window._rcProfileFreshChecked_ = true;
      fetchApi('getProfile', { token: token }).then(function (data) {
        if (!data || !data.success || !data.profile) return;
        var f = data.profile;
        if (String(f.role) !== String(cached.role) || !!f.champAccess !== !!cached.champAccess ||
            String(f.displayName || '') !== String(cached.displayName || '') ||
            String(f.avatarFilename || '') !== String(cached.avatarFilename || '')) {
          setProfileCache(f);
          renderHeader(opts);
        }
      }).catch(function () {});
    }
    var role = cached ? (cached.role || 'Driver') : 'Driver';

    // MY ACCOUNT restores a one-click path back to the account/dashboard page from anywhere on the
    // site, sitting above Logout in the dropdown itself.
    var avatarFilename = cached ? (cached.avatarFilename || '') : '';
    html += '<button type="button" class="rc-header-account-toggle" id="rc-header-account-toggle" aria-haspopup="true" aria-expanded="false" aria-label="Account menu">' +
              '<span class="rc-header-avatar">' + rcHelmetHtml_(avatarFilename, 46, 'rc-helmet-header') + '</span>' +
              '<span class="rc-header-account-text">' +
                '<span class="rc-header-account-name">' + escapeHtmlHeader_(displayName).toUpperCase() + '</span>' +
                '<span class="rc-badge-chip rc-header-account-role ' + (RC_HEADER_ROLE_PILL_CLASS_[role] || 'rc-badge-role-driver') + '">' + escapeHtmlHeader_(role) + rcRolePlusHtml(cached) + '</span>' +
              '</span>' +
              // 16x16 -- was 14x14, the one outlier against the 16x16 standard every other small
              // nav/menu icon on the site uses (Account.html's ICON_CHEVRON_DOWN and the rest of
              // its icon set).
              '<svg class="rc-header-account-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
              // Hamburger icon -- hidden by default (.rc-header-hamburger-icon, style.css), shown
              // in place of the avatar/name/role/chevron above at <=820px.
              '<span class="rc-header-hamburger-icon" aria-hidden="true">' + RC_HEADER_ICON_HAMBURGER + '</span>' +
            '</button>' +
            // Dropdown now mirrors Account.html's own sidebar, same order --
            // Dashboard/Calendar/Results/ Protests/Career, a divider, League Hub, then whichever of
            // Admin/League Tools/Stewarding this role actually unlocks (same cumulative
            // Driver<Steward<Organizer<Admin hierarchy Account.html's own nav gating uses), a
            // divider, Edit Profile/ Help/Feedback, a divider, Logout.
            '<div class="rc-header-account-menu" id="rc-header-account-menu" style="display:none;">' +
              _rcBuildAccountMenuSectionLinks(role) +
              '<hr class="rc-header-menu-divider">' +
              '<button type="button" class="rc-header-menu-item" id="rc-header-menu-help">' + _rcMenuIcon_('help') + '<span>League Help</span></button>' +
              '<button type="button" class="rc-header-menu-item" id="rc-header-menu-feedback">' + _rcMenuIcon_('feedback') + '<span>Feedback</span></button>' +
              // Discord link, right under Feedback (same order as the Account.html sidebar), opening in a new tab.
              '<a class="rc-header-menu-item rc-header-menu-item-discord" href="https://discord.com/channels/1538292330870611968/1551231154353479730" target="_blank" rel="noopener noreferrer"><span class="rc-header-menu-icon" aria-hidden="true"><img class="rc-header-menu-discord-img" src="assets/images/Discord-Symbol-White.svg" alt="" width="16" height="12"></span><span>Discord</span></a>' +
              '<hr class="rc-header-menu-divider">' +
              '<button type="button" class="rc-header-menu-item" id="rc-header-menu-logout">' + _rcMenuIcon_('logout') + '<span>Logout</span></button>' +
            '</div>';
  } else {
    // Now mirrors the logged-in toggle's pattern: the plain link stays for desktop, hidden below
    // 820px in favor of a hamburger button that opens a small panel with League Hub (since
    // .rc-header-leaguehub-badge next to the logo hides at this same width, this is the only way to
    // reach it on mobile while logged out) and Register/Login.
    html += '<a class="rc-header-link" id="rc-header-login-link" href="login.html">REGISTER / LOGIN</a>' +
            '<button type="button" class="rc-header-hamburger-toggle" id="rc-header-hamburger-toggle" aria-haspopup="true" aria-expanded="false" aria-label="Menu">' +
              // grayed-out plain white helmet in place of the hamburger icon (phones only, see style.css)
              rcHelmetHtml_('helmet:{"d":1,"b":["white","gloss"],"a1":["white","gloss"],"a2":["white","gloss"],"v":"smoke"}', 46, 'rc-helmet-header rc-helmet-off') +
            '</button>' +
            '<div class="rc-header-account-menu" id="rc-header-mobile-menu" style="display:none;">' +
              '<a class="rc-header-menu-item" href="league.html">' + _rcMenuIcon_('hub') + '<span>League Hub</span></a>' +
              '<a class="rc-header-menu-item" href="championship.html">' + _rcMenuIcon_('champ') + '<span>Championship</span></a>' +
              '<hr class="rc-header-menu-divider">' +
              '<a class="rc-header-menu-item" href="login.html">' + _rcMenuIcon_('login') + '<span>Register / Login</span></a>' +
            '</div>';
  }
  html += '</nav>';

  mount.innerHTML = html;

  rcHelmetHydrate_(mount);

  if (token) {
    var toggle = document.getElementById('rc-header-account-toggle');
    var menu = document.getElementById('rc-header-account-menu');

    function closeAccountMenu() {
      menu.style.display = 'none';
      toggle.setAttribute('aria-expanded', 'false');
    }
    function openAccountMenu() {
      menu.style.display = 'block';
      toggle.setAttribute('aria-expanded', 'true');
    }

    toggle.addEventListener('click', function (evt) {
      evt.stopPropagation();
      if (menu.style.display === 'block') closeAccountMenu(); else openAccountMenu();
    });
    // Remove the previous render's document-level listeners before adding this render's instead of
    // just stacking another pair on top.
    if (_rcHeaderOutsideClickHandler) document.removeEventListener('click', _rcHeaderOutsideClickHandler);
    if (_rcHeaderEscapeHandler) document.removeEventListener('keydown', _rcHeaderEscapeHandler);

    _rcHeaderOutsideClickHandler = function (evt) {
      if (menu.style.display === 'block' && !menu.contains(evt.target) && !toggle.contains(evt.target)) closeAccountMenu();
    };
    _rcHeaderEscapeHandler = function (evt) {
      if (evt.key !== 'Escape') return;
      if (menu.style.display === 'block') closeAccountMenu();
    };
    document.addEventListener('click', _rcHeaderOutsideClickHandler);
    document.addEventListener('keydown', _rcHeaderEscapeHandler);

    // The account dropdown also closes the instant the pointer leaves BOTH its toggle button and
    // its own menu, not just on an outside click. Opening is still click-only; this only ever
    // closes it early.
    _rcWireHoverAwayClose([toggle, menu], closeAccountMenu);

    // Section links -- call window.rcNavigateToSection in place when it exists (we're already on
    // Account.html, so this just switches sections, no reload), otherwise let the href do a real
    // navigation to Account.html#<section>, which that page's own load-time hash check picks up and
    // opens directly.
    Array.prototype.forEach.call(menu.querySelectorAll('[data-rc-section]'), function (a) {
      a.addEventListener('click', function (evt) {
        closeAccountMenu();
        if (typeof window.rcNavigateToSection === 'function') {
          evt.preventDefault();
          window.rcNavigateToSection(a.getAttribute('data-rc-section'));
        }
      });
    });

    // Edit Profile -- works from any page, not just Account.html's own sidebar.
    // window.rcOpenEditProfileModal is a bridge Account.html sets once its profile/token are
    // actually loaded (see buildFullProfileUI there); when it's there, call it directly -- no
    // navigation, the modal just opens in place.
    document.getElementById('rc-header-menu-editprofile').addEventListener('click', function () {
      closeAccountMenu();
      _rcOpenEditProfileFromHeader();
    });

    // League Help -- Account.html: its in-page Help section. Any other page: the same Help popup league.html
    // opens (rulebook-content.js), in place.
    document.getElementById('rc-header-menu-help').addEventListener('click', function () {
      closeAccountMenu();
      _rcOpenLeagueHelpFromHeader();
    });

    // Feedback -- unlike Edit Profile, opens in place on whatever page the user is already on, no
    // navigation involved. See _rcOpenFeedbackModal() below.
    document.getElementById('rc-header-menu-feedback').addEventListener('click', function () {
      closeAccountMenu();
      _rcOpenFeedbackModal();
    });

    // Same fire-and-forget logout pattern as Account.html's sidebar Log Out button: clear the local
    // token and redirect immediately, fire the API call without waiting on it.
    document.getElementById('rc-header-menu-logout').addEventListener('click', function () {
      fetchApi('logout', { method: 'POST', token: token, quick: true }).catch(function () {});
      clearToken();
      window.location.href = 'login.html';
    });

    // ---------------------------------------------------------------
    // ---------------------------------------------------------------
  } else {
    // Logged-out hamburger -- same open/ close/outside-click/Escape/hover-away pattern as the
    // logged-in account toggle above, just against the smaller League Hub/Register- Login panel
    // instead of the full account menu.
    var hamburgerToggle = document.getElementById('rc-header-hamburger-toggle');
    var mobileMenu = document.getElementById('rc-header-mobile-menu');

    function closeMobileMenu() {
      mobileMenu.style.display = 'none';
      hamburgerToggle.setAttribute('aria-expanded', 'false');
    }
    function openMobileMenu() {
      mobileMenu.style.display = 'block';
      hamburgerToggle.setAttribute('aria-expanded', 'true');
    }

    hamburgerToggle.addEventListener('click', function (evt) {
      evt.stopPropagation();
      if (mobileMenu.style.display === 'block') closeMobileMenu(); else openMobileMenu();
    });

    if (_rcHeaderOutsideClickHandler) document.removeEventListener('click', _rcHeaderOutsideClickHandler);
    if (_rcHeaderEscapeHandler) document.removeEventListener('keydown', _rcHeaderEscapeHandler);

    _rcHeaderOutsideClickHandler = function (evt) {
      if (mobileMenu.style.display === 'block' && !mobileMenu.contains(evt.target) && !hamburgerToggle.contains(evt.target)) closeMobileMenu();
    };
    _rcHeaderEscapeHandler = function (evt) {
      if (evt.key !== 'Escape') return;
      if (mobileMenu.style.display === 'block') closeMobileMenu();
    };
    document.addEventListener('click', _rcHeaderOutsideClickHandler);
    document.addEventListener('keydown', _rcHeaderEscapeHandler);

    _rcWireHoverAwayClose([hamburgerToggle, mobileMenu], closeMobileMenu);
  }
}

function escapeHtmlHeader_(str) {
  var d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------
// SITEWIDE FOOTER LEGAL DISCLAIMER -- every page's .rc-site-footer now ends with a "Legal
// Disclaimer" link that opens the full disclaimer text in a popup.
function rcOpenLegalModal() {
  var backdrop = document.createElement('div');
  backdrop.className = 'rc-modal-backdrop';
  // Center dead-center on pages that have no driver dashboard sidebar -- .rc-modal- backdrop's own
  // padding-left:244px (style.css, desktop only) shifts every modal right to center it over
  // Account.html's content area beside the sidebar, which is correct there but leaves this same
  // modal off-center on league.html/index.html, neither of which has a sidebar to offset for.
  if (!document.querySelector('.rc-sidebar')) {
    backdrop.classList.add('rc-modal-backdrop-centered');
  }
  var modal = document.createElement('div');
  modal.className = 'rc-modal rc-modal-wide';
  var head = document.createElement('div');
  head.className = 'rc-modal-head';
  var title = document.createElement('h3');
  title.style.margin = '0';
  title.style.fontSize = '16px';
  title.textContent = 'Legal Disclaimer';
  head.appendChild(title);
  var closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'rc-modal-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '&times;';
  head.appendChild(closeBtn);
  var body = document.createElement('div');
  body.className = 'rc-modal-body rc-legal-text';
  // Static, trusted, hand-authored content -- no escaping needed, this never includes any
  // user-supplied data.
  body.innerHTML =
    '<p class="rc-legal-updated">Last Updated: October 2026</p>' +
    '<h4>Independent Community</h4>' +
    '<p>Race Club Online is an independent community-operated sim racing league and informational platform. Race Club Online is not affiliated with, endorsed by, sponsored by, or otherwise associated with any game developer, game publisher, motorsport organization, racing team, racing series, vehicle manufacturer, race circuit operator, trademark owner, or governing body unless explicitly stated otherwise.</p>' +
    '<h4>Trademarks and Intellectual Property</h4>' +
    '<p>All trademarks, service marks, trade names, logos, vehicle names, team names, team liveries, car designs, circuit names, series names, and other intellectual property displayed on this website are the property of their respective owners.</p>' +
    '<p>Any such references are used solely for identification, informational, educational, commentary, statistical, historical, or community-related purposes. The use of these marks does not imply any affiliation, sponsorship, endorsement, approval, or partnership with Race Club Online.</p>' +
    '<h4>Le Mans Ultimate</h4>' +
    '<p>Race Club Online may reference the Le Mans Ultimate racing simulation, its content, events, vehicles, classes, and tracks for purposes related to league organization, competition, statistics, and community discussion.</p>' +
    '<p>Race Club Online is an independent community and is not affiliated with, endorsed by, sponsored by, or otherwise associated with Le Mans Ultimate, Studio 397, Motorsport Games, the Automobile Club de l’Ouest (ACO), FIA World Endurance Championship (WEC), the European Le Mans Series (ELMS), or any related organizations.</p>' +
    '<p>References to the WEC and the ELMS, including their names, seasons, car classes, and entries, are descriptive only. Race Club Online is not a part of, sanctioned by, or tied to the WEC, the ELMS, or their organizers, and its seasons and championships are separate community events.</p>' +
    '<h4>Racing Teams and Liveries</h4>' +
    '<p>Race Club Online displays the names of real-world racing teams, along with images of the cars and team liveries as they appear in Le Mans Ultimate, so that drivers can recognize the entries on the grid, in standings, and in results. Team descriptions and story content on this website are written by Race Club Online for informational and entertainment purposes.</p>' +
    '<p>Race Club Online is not affiliated with, endorsed by, or sponsored by any of the racing teams shown, and no team, driver, or sponsor has reviewed or approved the content on this website. Team names, logos, liveries, and car designs remain the property of their respective owners. Any in-league team, sponsor, or story content is fictional or community-created and does not represent the views, actions, or statements of any real team or person.</p>' +
    '<h4>Vehicle Manufacturers and Racing Circuits</h4>' +
    '<p>References to real-world vehicle manufacturers, race circuits, racing series, and motorsport organizations are provided solely to identify content used within league competition and statistical reporting.</p>' +
    '<p>All manufacturer logos, vehicle names, circuit names, and related trademarks remain the property of their respective owners.</p>' +
    '<h4>Statistics and Competition Data</h4>' +
    '<p>Race Club Online collects, processes, and displays race results, standings, statistics, driver rankings, and historical data derived from community-organized events. While reasonable efforts are made to ensure accuracy, Race Club Online makes no guarantees regarding the completeness, accuracy, or availability of any data presented on the site.</p>' +
    '<h4>No Commercial Relationship</h4>' +
    '<p>Participation in Race Club Online does not create any relationship with any game developer, publisher, manufacturer, sanctioning body, or trademark owner referenced on the website.</p>' +
    '<h4>Content Removal Requests</h4>' +
    '<p>Race Club Online respects the intellectual property rights of others. If you are a rights holder and believe that any content displayed on this website infringes upon your intellectual property rights or creates confusion regarding ownership, affiliation, or endorsement, please contact us and we will promptly review the request.</p>' +
    '<h4>Limitation of Liability</h4>' +
    '<p>Race Club Online is provided on an "as-is" and "as-available" basis. By using this website, users acknowledge that participation in online leagues, competitions, rankings, and community activities is voluntary. Race Club Online and its operators shall not be liable for any damages, losses, disputes, or inconveniences arising from the use of this website or participation in league activities.</p>';
  modal.appendChild(head);
  modal.appendChild(body);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  var scrollYBeforeModal = window.scrollY || window.pageYOffset || 0;
  document.body.style.top = '-' + scrollYBeforeModal + 'px';
  document.body.classList.add('rc-modal-scroll-locked');

  function close() {
    backdrop.remove();
    document.body.classList.remove('rc-modal-scroll-locked');
    document.body.style.top = '';
    window.scrollTo(0, scrollYBeforeModal);
  }
  closeBtn.addEventListener('click', close);
}

// A no-op if the link isn't on the page for some reason, so this is always safe to call.
function rcWireFooterLegalLink() {
  var link = document.getElementById('rc-footer-legal-link');
  if (link) link.addEventListener('click', function (evt) { evt.preventDefault(); rcOpenLegalModal(); });
}

// Feedback categories -- must match FEEDBACK_CATEGORIES_ in Website.gs exactly.
var _RC_FEEDBACK_CATEGORIES_ = ['Bug Report', 'Feature Request', 'Rulebook / Rules Question', 'Account or Login Issue', 'Request League Role', 'Request Championship Mode', 'General Feedback', 'Other'];
var _RC_FEEDBACK_MESSAGE_MAX_ = 500;

// Feedback popup -- unlike Edit Profile (_rcOpenEditProfileFromHeader above, which navigates to
// Account.html and delegates to its own modal system), this is fully self-contained here so it
// opens IN PLACE on whatever page the user is already on, no navigation.
function _rcOpenFeedbackModal() {
  var isDark = document.body.classList.contains('rc-league-page');
  // Feedback needs a login (the server fills in the name and email from the account).
  if (!((typeof getToken === 'function') && getToken())) {
    window.location.href = 'login.html';
    return;
  }

  var backdrop = document.createElement('div');
  // rcl-modal-overlay-over-nav -- sits above .rc-fixed-header (css/style.css, z-index:1000) instead
  // of below it, so the navbar dims along with the rest of the page for this popup specifically.
  backdrop.className = isDark ? 'rcl-modal-overlay rcl-modal-overlay-over-nav' : 'rc-modal-backdrop';
  var modal = document.createElement('div');
  // rcl-modal-dialog-narrow -- the dark shell's plain .rcl-modal-dialog defaults to 820px
  // (News/Points Table's own width), while the light .rc-modal this branch uses is 460px; the
  // narrow modifier (css/league.css) brings the dark side down to match.
  modal.className = isDark ? 'rcl-modal-dialog rcl-modal-dialog-narrow' : 'rc-modal';
  var head = document.createElement('div');
  head.className = isDark ? 'rcl-modal-head' : 'rc-modal-head';
  var title = document.createElement(isDark ? 'div' : 'h3');
  if (isDark) {
    title.className = 'rcl-modal-title';
  } else {
    title.style.margin = '0';
    title.style.fontSize = '16px';
  }
  title.textContent = 'Feedback';
  head.appendChild(title);
  var closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = isDark ? 'rcl-modal-close' : 'rc-modal-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '&times;';
  head.appendChild(closeBtn);
  var body = document.createElement('div');
  body.className = isDark ? 'rcl-modal-body' : 'rc-modal-body';

  var introP = document.createElement('p');
  introP.style.marginTop = '0';
  introP.style.fontSize = '13px';
  introP.style.color = isDark ? 'var(--rcl-ink-dim)' : 'var(--rc-steel)';
  introP.textContent = 'Spotted a bug, have an idea, or just want to tell us something? Send it straight to the Race Club team.';
  body.appendChild(introP);

  var categoryLabel = document.createElement('label');
  categoryLabel.style.marginTop = '0';
  categoryLabel.textContent = 'Feedback Type';
  body.appendChild(categoryLabel);
  var categorySelect = document.createElement('select');
  _RC_FEEDBACK_CATEGORIES_.forEach(function (cat) {
    var opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });
  body.appendChild(categorySelect);

  // Name auto-filled from the logged-in driver's own profile and locked -- reads the same
  // lightweight profile cache the header itself already uses to show the driver's name/avatar
  // (getProfileCache, js/auth.js), so no extra round trip.
  var nameLabel = document.createElement('label');
  nameLabel.textContent = 'Name';
  body.appendChild(nameLabel);
  var nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.maxLength = 120;
  var cachedProfileForFeedback_ = (typeof getProfileCache === 'function') ? getProfileCache() : null;
  nameInput.value = (cachedProfileForFeedback_ && cachedProfileForFeedback_.displayName) || '';
  nameInput.disabled = true;
  body.appendChild(nameInput);

  var messageLabel = document.createElement('label');
  messageLabel.textContent = 'Message';
  body.appendChild(messageLabel);
  var messageInput = document.createElement('textarea');
  messageInput.rows = 5;
  messageInput.maxLength = _RC_FEEDBACK_MESSAGE_MAX_;
  body.appendChild(messageInput);

  // Live character counter -- same "cap + count down" convention as
  // Protests' 200-word description limit elsewhere on the site.
  var charCount = document.createElement('div');
  charCount.style.fontSize = '11px';
  charCount.style.marginTop = '4px';
  charCount.style.textAlign = 'right';
  charCount.style.color = isDark ? 'var(--rcl-ink-faint)' : 'var(--rc-steel)';
  charCount.textContent = _RC_FEEDBACK_MESSAGE_MAX_ + ' characters remaining';
  body.appendChild(charCount);
  messageInput.addEventListener('input', function () {
    charCount.textContent = (_RC_FEEDBACK_MESSAGE_MAX_ - messageInput.value.length) + ' characters remaining';
  });

  var errorMsg = document.createElement('div');
  errorMsg.style.display = 'none';
  errorMsg.style.marginTop = '10px';
  errorMsg.style.fontSize = '12.5px';
  errorMsg.style.color = 'var(--rc-red)';
  body.appendChild(errorMsg);

  // Fires a write (sends the email) on click -- red/solid, same "gray
  // unless it saves" rule every button on the site follows.
  var submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = isDark ? 'rcl-feedback-submit-btn' : 'rc-btn-primary';
  submitBtn.style.marginTop = '18px';
  submitBtn.textContent = 'Send Feedback';
  body.appendChild(submitBtn);

  modal.appendChild(head);
  modal.appendChild(body);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  var scrollYBeforeModal = window.scrollY || window.pageYOffset || 0;
  document.body.style.top = '-' + scrollYBeforeModal + 'px';
  document.body.classList.add('rc-modal-scroll-locked');

  function close() {
    backdrop.remove();
    document.body.classList.remove('rc-modal-scroll-locked');
    document.body.style.top = '';
    window.scrollTo(0, scrollYBeforeModal);
  }
  closeBtn.addEventListener('click', close);

  submitBtn.addEventListener('click', function () {
    var message = messageInput.value.trim();
    errorMsg.style.display = 'none';
    if (!message) {
      errorMsg.textContent = 'Enter a message before sending.';
      errorMsg.style.display = 'block';
      return;
    }
    if (message.length > _RC_FEEDBACK_MESSAGE_MAX_) {
      errorMsg.textContent = 'Message is too long -- keep it under ' + _RC_FEEDBACK_MESSAGE_MAX_ + ' characters.';
      errorMsg.style.display = 'block';
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    fetchApi('submitFeedback', {
      method: 'POST',
      token: (typeof getToken === 'function') ? getToken() : null,
      body: {
        category: categorySelect.value,
        name: nameInput.value.trim(),
        message: message,
        pageUrl: window.location.href
      }
    }).then(function (result) {
      if (!result || !result.success) {
        var fbErr = new Error((result && result.message) || 'Send failed');
        fbErr.userMessage = result && result.message;
        throw fbErr;
      }
      // Swap the body's contents in place for a confirmation view -- no navigation, no reload.
      // Closing just removes the backdrop, same close() as the form view above, so the driver lands
      // back on whatever page/section they were already looking at.
      body.innerHTML = '';
      var confirmTitle = document.createElement('p');
      confirmTitle.style.margin = '4px 0 4px';
      confirmTitle.style.fontSize = '15px';
      confirmTitle.style.fontWeight = '700';
      confirmTitle.style.textAlign = 'center';
      confirmTitle.style.color = isDark ? 'var(--rcl-ink)' : 'var(--rc-carbon)';
      confirmTitle.textContent = 'Thanks, your feedback was sent.';
      body.appendChild(confirmTitle);
      var confirmSub = document.createElement('p');
      confirmSub.style.margin = '0 0 18px';
      confirmSub.style.fontSize = '13px';
      confirmSub.style.textAlign = 'center';
      confirmSub.style.color = isDark ? 'var(--rcl-ink-dim)' : 'var(--rc-steel)';
      confirmSub.textContent = 'The Race Club team will take a look.';
      body.appendChild(confirmSub);
      var closeConfirmBtn = document.createElement('button');
      closeConfirmBtn.type = 'button';
      closeConfirmBtn.className = isDark ? 'rcl-feedback-submit-btn' : 'rc-btn-primary';
      closeConfirmBtn.textContent = 'Close';
      closeConfirmBtn.addEventListener('click', close);
      body.appendChild(closeConfirmBtn);
    }).catch(function (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Feedback';
      errorMsg.textContent = (err && err.userMessage) || 'Could not send feedback -- try again.';
      errorMsg.style.display = 'block';
    });
  });
}

// ---------------------------------------------------------------------
// Header clicks while a popup is open. The popup's dark backdrop sits over the navbar (so it dims with
// the page), which used to swallow clicks on the avatar menu and the logos. A click on the dimmed
// navbar now closes the open popup(s) and then passes the click on to the avatar menu / logo under the
// pointer. A popup that is busy saving refuses to close, and then the click is simply ignored.
// ---------------------------------------------------------------------
document.addEventListener('click', function (e) {
  var back = e.target;
  if (!back || !back.classList || !(back.classList.contains('rc-modal-backdrop') || back.classList.contains('rcl-modal-overlay'))) return;
  var header = document.getElementById('rc-header');
  if (!header) return;
  var r = header.getBoundingClientRect();
  if (e.clientY < r.top || e.clientY > r.bottom) return;
  var target = null, stack = document.elementsFromPoint(e.clientX, e.clientY);
  for (var i = 0; i < stack.length; i++) {
    if (header.contains(stack[i]) && stack[i] !== header) {
      var c = stack[i].closest ? stack[i].closest('a, button') : null;
      if (c && header.contains(c)) { target = c; break; }
    }
  }
  if (!target) return;
  var popups = document.querySelectorAll('.rc-modal-backdrop, .rcl-modal-overlay');
  Array.prototype.forEach.call(popups, function (p) {
    var x = p.querySelector('.rc-modal-close, .rcl-modal-close');
    if (x && !x.disabled) x.click();
  });
  if (document.querySelector('.rc-modal-backdrop, .rcl-modal-overlay')) return;   // one refused to close (saving)
  setTimeout(function () { target.click(); }, 0);
}, true);


// Keeps drawn helmets in step with the helmet list. A helmet picture is saved in this tab so pages load fast, so when an admin edits a helmet
// the saved pictures are out of date. On each page load (at most every 10 minutes) one tiny request asks the server for the current helmet
// version number; only when it differs from the one this browser has does the helmet code load, fetch the new designs and draw the helmets again.
function rcHelmetVersionCheck_() {
  try {
    if (typeof fetchApi !== 'function' || !document.querySelector('[data-rc-helmet]')) return;
    var pc = (typeof getProfileCache === 'function') ? getProfileCache() : null, av = (pc && pc.avatarFilename) || '';
    // an older team-helmet avatar does not know which manufacturer it follows: fix that once per session
    if (av.indexOf('helmet:') === 0 && av.indexOf('"t":1') > 0 && av.indexOf('"m":') < 0 && !sessionStorage.getItem('rcHelmetHealed')) {
      sessionStorage.setItem('rcHelmetHealed', '1');
      _rcHelmetModule_().then(function () { return window.rcHelmetHealNow_ && window.rcHelmetHealNow_(); }).catch(function () {});
    }
    var last = Number(localStorage.getItem('rcHelmetVerChecked')) || 0;
    if (Date.now() - last < 600000) return;
    localStorage.setItem('rcHelmetVerChecked', String(Date.now()));
    fetchApi('getHelmetVersion', {}).then(function (res) {
      if (!res || !res.success) return;
      if (String(res.version) === (localStorage.getItem('rcHelmetVer') || '')) return;
      return _rcHelmetModule_().then(function () { return window.rcHelmetRefreshNow_(); });
    }).catch(function () {});
  } catch (e) {}
}
window.addEventListener('load', function () { setTimeout(rcHelmetVersionCheck_, 1200); });


// "Always use team helmet" button for the Edit Profile popup: same look as Customize Helmet, with a light that is green when it is on.
// Returns the button. cls = the same classes the Customize Helmet button uses.
function rcHelmetTeamToggle_(profile, token, cls, showToast, onChange) {
  var b = document.createElement('button'); b.type = 'button'; b.className = cls + ' rc-team-toggle';
  var light = document.createElement('span'); light.className = 'rc-team-light';
  var label = document.createElement('span'); label.textContent = 'Always use team design';
  b.appendChild(light); b.appendChild(label);
  function isOn() { var v = String(profile.avatarFilename || ''); return v.indexOf('helmet:') === 0 && /"t":1/.test(v) && /"a":1/.test(v); }
  function show(on) { b.classList.toggle('rc-team-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  var shown = isOn(), inflight = 0, chain = Promise.resolve();
  show(shown);
  // The button reacts at once (on or off); the saves happen one after another in the background, and the button goes back if one did not work.
  b.addEventListener('click', function (evt) {
    evt.preventDefault();
    shown = !shown; show(shown);
    var want = shown;
    inflight++;
    chain = chain.then(function () {
      if (isOn() === want) return;
      return _rcHelmetModule_().then(function () {
        return window.rcHelmetToggleTeamNow_({ profile: profile, token: token, toast: showToast, onChange: onChange });
      });
    }).catch(function () { if (showToast) showToast('Could not change your helmet.', 'error'); }).then(function () {
      inflight--;
      if (inflight === 0) { shown = isOn(); show(shown); }
    });
  });
  return b;
}
