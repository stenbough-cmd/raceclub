// Race Club — js/header.js (v0.4.0)
// Shared fixed site header used on every page.
var RC_HEADER_HEIGHT = 70;
var RC_TOAST_CONTAINER_ID = 'rc-toast-container';

// Shared avatar helpers -- defined here, not duplicated per file, since header.js already loads on
// every page before any other inline script runs (same pattern as
// showToast/_rcHeaderInitials/renderHeader, all already called directly from
// Account.html/edit-profile.js as globals).
// profile.avatarFilename is now one of three shapes: '' -> no avatar; caller shows initials
// 'avatar-NN.png' / 'avatar_default.jpg' (a preset or the default file) -> assets/avatars/<name>
// 'https://...' (a driver-pasted link) -> the URL itself, unchanged
var RC_AVATAR_DEFAULT_FILE_ = 'avatar_default.jpg';

function rcAvatarSrc_(avatarFilename) {
  if (!avatarFilename) return '';
  return (/^https:\/\//i.test(avatarFilename)) ? avatarFilename : ('assets/avatars/' + avatarFilename);
}

// Wire onto an <img> that's already showing an avatar (img.src already set via rcAvatarSrc_ above).
// onFinalFailure runs only once the default image ITSELF has also failed to load (or the src was
// already the default when it failed) -- callers use it to reveal initials, same last-resort each
// avatar circle already had before this change.
function rcWireAvatarFallback_(img, onFinalFailure) {
  img.onerror = function () {
    if (img.src.indexOf(RC_AVATAR_DEFAULT_FILE_) !== -1) {
      if (onFinalFailure) onFinalFailure();
      return;
    }
    img.src = 'assets/avatars/' + RC_AVATAR_DEFAULT_FILE_;
  };
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

// Builds the Dashboard..Stewarding portion of the account dropdown, mirroring Account.html's
// sidebar order/gating exactly (see the big comment at that markup's call site above).
function _rcBuildAccountMenuSectionLinks(role) {
  function link(section, label) {
    return '<a class="rc-header-menu-item" href="Account.html#' + section + '" data-rc-section="' + section + '">' + label + '</a>';
  }
  // Off-page link to the public league.html, not an in-page section, so it skips data-rc-section
  // entirely (same as before this reorder).
  var html = '<a class="rc-header-menu-item" href="league.html">League Hub</a>';
  html += '<hr class="rc-header-menu-divider">';
  // The section id stays 'results' on purpose (matches data-rc-section/#results routing) -- only
  // the label text changes. Dashboard/Career are the only section links left here.
  html += link('dashboard', 'Dashboard') + link('results', 'Career');
  // A second divider between Career and the permission-gated items -- only when at least one of
  // them actually shows for this role, so a Driver/Steward-without-Organizer account never ends up
  // with two dividers back to back and nothing between them.
  var hasGatedItems = role === 'Admin' || role === 'Organizer' || role === 'Steward';
  if (hasGatedItems) html += '<hr class="rc-header-menu-divider">';
  if (role === 'Admin') html += link('admin', 'Admin');
  if (role === 'Admin' || role === 'Organizer') html += link('league', 'League Tools');
  if (role === 'Admin' || role === 'Organizer' || role === 'Steward') html += link('stewarding', 'Stewarding');
  return html;
}

function _rcHeaderInitials(name) {
  var parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

// Shows just the logo -- no HOME/LOGIN/ACCOUNT at all -- while a page is still waiting to find out
// whether its own session is actually valid. Used by Account.html in place of an immediate
// renderHeader() call, so the navbar never asserts a login state (or a logged-out state) it hasn't
// confirmed yet.
function renderHeaderPending() {
  var mount = document.getElementById('rc-header');
  if (!mount) return;
  mount.className = 'rc-fixed-header';
  // League Hub badge included here too. Included in this pending state too so the header doesn't
  // visibly gain the badge a moment later once renderHeader() takes over -- it reads as present
  // from the very first paint.
  mount.innerHTML = '<a class="rc-header-logo-link" href="index.html">' +
      '<img class="rc-header-logo" src="assets/images/race-club-header-logo.png" alt="Race Club">' +
    '</a>' +
    '<span class="rc-header-leaguehub-badge">' +
      '<a class="rc-header-leaguehub-logo-link" href="league.html">' +
        '<img class="rc-header-leaguehub-logo" src="assets/images/league_hub_logo.png" alt="League Hub" draggable="false">' +
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

  var html = '';
  html += '<a class="rc-header-logo-link" href="index.html">' +
            '<img class="rc-header-logo" src="assets/images/race-club-header-logo.png" alt="Race Club">' +
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
              '<img class="rc-header-leaguehub-logo" src="assets/images/league_hub_logo.png" alt="League Hub" draggable="false">' +
            '</a>' +
          '</span>';
  html += '<nav class="rc-header-nav">';
  // Logged-in behavior is unchanged -- League Hub still lives in the account dropdown (see the menu
  // markup below), never duplicated in the top bar either way.
  if (token) {
    var displayName = cached ? (cached.displayName || '') : '';
    var initials = _rcHeaderInitials(displayName);
    var role = cached ? (cached.role || 'Driver') : 'Driver';

    // MY ACCOUNT restores a one-click path back to the account/dashboard page from anywhere on the
    // site, sitting above Logout in the dropdown itself.
    var avatarFilename = cached ? (cached.avatarFilename || '') : '';
    var avatarSrc = rcAvatarSrc_(avatarFilename);
    var avatarImgHtml = avatarSrc
      ? '<img class="rc-header-avatar-img" src="' + escapeHtmlHeader_(avatarSrc) + '" alt="" onerror="if(this.src.indexOf(\'' + RC_AVATAR_DEFAULT_FILE_ + '\')!==-1){this.style.display=\'none\';}else{this.src=\'assets/avatars/' + RC_AVATAR_DEFAULT_FILE_ + '\';}">'
      : '';
    html += '<button type="button" class="rc-header-account-toggle" id="rc-header-account-toggle" aria-haspopup="true" aria-expanded="false" aria-label="Account menu">' +
              '<span class="rc-header-avatar">' + initials + avatarImgHtml + '</span>' +
              '<span class="rc-header-account-text">' +
                '<span class="rc-header-account-name">' + escapeHtmlHeader_(displayName).toUpperCase() + '</span>' +
                '<span class="rc-badge-chip rc-header-account-role ' + (RC_HEADER_ROLE_PILL_CLASS_[role] || 'rc-badge-role-driver') + '">' + escapeHtmlHeader_(role) + '</span>' +
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
              '<button type="button" class="rc-header-menu-item" id="rc-header-menu-editprofile">Edit Profile</button>' +
              '<a class="rc-header-menu-item" href="Account.html#help" data-rc-section="help">Help</a>' +
              '<button type="button" class="rc-header-menu-item" id="rc-header-menu-feedback">Feedback</button>' +
              // Discord link, right under Feedback, matching the sidebar's own order exactly (Edit
              // Profile, Help, Feedback, Discord -- see buildSidebarNav, Account.html) -- opens in
              // a new tab so a driver never loses their place on whatever page this dropdown is
              // open on.
              '<a class="rc-header-menu-item rc-header-menu-item-discord" href="https://discord.com/channels/1538292330870611968/1551231154353479730" target="_blank" rel="noopener noreferrer">Discord</a>' +
              '<hr class="rc-header-menu-divider">' +
              '<button type="button" class="rc-header-menu-item" id="rc-header-menu-logout">Logout</button>' +
            '</div>';
  } else {
    // Now mirrors the logged-in toggle's pattern: the plain link stays for desktop, hidden below
    // 820px in favor of a hamburger button that opens a small panel with League Hub (since
    // .rc-header-leaguehub-badge next to the logo hides at this same width, this is the only way to
    // reach it on mobile while logged out) and Register/Login.
    html += '<a class="rc-header-link" id="rc-header-login-link" href="login.html">REGISTER / LOGIN</a>' +
            '<button type="button" class="rc-header-hamburger-toggle" id="rc-header-hamburger-toggle" aria-haspopup="true" aria-expanded="false" aria-label="Menu">' +
              RC_HEADER_ICON_HAMBURGER +
            '</button>' +
            '<div class="rc-header-account-menu" id="rc-header-mobile-menu" style="display:none;">' +
              '<a class="rc-header-menu-item" href="league.html">League Hub</a>' +
              '<hr class="rc-header-menu-divider">' +
              '<a class="rc-header-menu-item" href="login.html">Register / Login</a>' +
            '</div>';
  }
  html += '</nav>';

  mount.innerHTML = html;

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

    // Feedback -- unlike Edit Profile, opens in place on whatever page the user is already on, no
    // navigation involved. See _rcOpenFeedbackModal() below.
    document.getElementById('rc-header-menu-feedback').addEventListener('click', function () {
      closeAccountMenu();
      _rcOpenFeedbackModal();
    });

    // Same fire-and-forget logout pattern as Account.html's sidebar Log Out button: clear the local
    // token and redirect immediately, fire the API call without waiting on it.
    document.getElementById('rc-header-menu-logout').addEventListener('click', function () {
      fetchApi('logout', { method: 'POST', token: token }).catch(function () {});
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
  return d.innerHTML;
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
    '<p class="rc-legal-updated">Last Updated: September 2026</p>' +
    '<h4>Independent Community</h4>' +
    '<p>Race Club Online is an independent community-operated sim racing league and informational platform. Race Club Online is not affiliated with, endorsed by, sponsored by, or otherwise associated with any game developer, game publisher, motorsport organization, racing series, vehicle manufacturer, race circuit operator, trademark owner, or governing body unless explicitly stated otherwise.</p>' +
    '<h4>Trademarks and Intellectual Property</h4>' +
    '<p>All trademarks, service marks, trade names, logos, vehicle names, team names, circuit names, series names, and other intellectual property displayed on this website are the property of their respective owners.</p>' +
    '<p>Any such references are used solely for identification, informational, educational, commentary, statistical, historical, or community-related purposes. The use of these marks does not imply any affiliation, sponsorship, endorsement, approval, or partnership with Race Club Online.</p>' +
    '<h4>Le Mans Ultimate</h4>' +
    '<p>Race Club Online may reference the Le Mans Ultimate racing simulation, its content, events, vehicles, classes, and tracks for purposes related to league organization, competition, statistics, and community discussion.</p>' +
    '<p>Race Club Online is an independent community and is not affiliated with, endorsed by, sponsored by, or otherwise associated with Le Mans Ultimate, Studio 397, Motorsport Games, the Automobile Club de l’Ouest (ACO), FIA World Endurance Championship (WEC), or any related organizations.</p>' +
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
var _RC_FEEDBACK_CATEGORIES_ = ['Bug Report', 'Feature Request', 'Rulebook / Rules Question', 'Account or Login Issue', 'General Feedback', 'Other'];
var _RC_FEEDBACK_MESSAGE_MAX_ = 500;

// Feedback popup -- unlike Edit Profile (_rcOpenEditProfileFromHeader above, which navigates to
// Account.html and delegates to its own modal system), this is fully self-contained here so it
// opens IN PLACE on whatever page the user is already on, no navigation.
function _rcOpenFeedbackModal() {
  var isDark = document.body.classList.contains('rc-league-page');

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
      body: {
        category: categorySelect.value,
        name: nameInput.value.trim(),
        message: message,
        pageUrl: window.location.href
      }
    }).then(function (result) {
      if (!result || !result.success) throw new Error((result && result.message) || 'Send failed');
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
    }).catch(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Feedback';
      errorMsg.textContent = 'Could not send feedback -- try again.';
      errorMsg.style.display = 'block';
    });
  });
}
