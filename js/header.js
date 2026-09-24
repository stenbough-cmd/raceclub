/*
  Race Club — js/header.js  (v0.4.0)

  Shared fixed site header used on every page. Each page includes this
  file (after js/api.js and js/auth.js, both of which it depends on),
  puts an empty <div id="rc-header"></div> as the very first thing inside
  <body>, and calls renderHeader() in a small inline <script> right after
  that div. renderHeader() fills the div with the header markup and wires
  up its behavior -- it does not need to run on DOMContentLoaded since the
  div already exists by the time the inline script tag runs.

  WHAT CHANGED THIS PASS (Matt's direct call, "a design decision moving
  forward"):
  - HOME is gone from the header entirely -- the logo itself already links
    to index.html, so it was a redundant second way to do the same thing.
  - The logo and avatar are both slightly larger (38px -> 46px logo,
    32px -> 40px avatar) to give the header a bit more presence.
  - Logged out: "LEAGUE HUB · REGISTER/LOGIN" (League Hub added 2026-09-18,
    since league.html is public).
  - Logged in: League Hub moves out of the top bar and into the account
    dropdown instead (top of the menu, above a divider) -- added
    2026-09-18, same day league.html shipped.
  - The dropdown mirrored Account.html's own sidebar order/gating in full
    (2026-09-19): Dashboard, Calendar, Results, Protests, Career, a
    divider, League Hub, then whichever of Admin/League Tools/Stewarding
    this role unlocks, a divider, Help, Edit Profile, a divider, Logout.
    Calendar, Protests and Career were removed from this list (2026-09-24)
    -- Calendar and Protests are now popups reached from Dashboard cards
    instead of standalone sections, and Career was removed entirely. See
    _rcBuildAccountMenuSectionLinks below and its click wiring in
    renderHeader() for how each remaining link switches sections in place
    on Account.html itself but does a real navigation from anywhere else.
  - Logged in: the avatar + name/role stack (First Last in caps, bold;
    role -- Prospect/Driver/Steward/Organizer/Admin -- underneath in a
    lighter weight and color) and the chevron are now ONE single clickable
    element (rc-header-account-toggle, a <button>) instead of a separate
    link + caret button. Clicking anywhere in that box (avatar, name, role,
    or chevron) opens/closes the dropdown -- it no longer navigates
    straight to Account.html on click. The dropdown has Dashboard (was
    "My Account", renamed 2026-09-01, Matt's call), Edit Profile, and
    Logout. Edit Profile (added back to the dropdown 2026-09-01, Matt's
    call: "let the popup display no matter which page it's on") opens
    Account.html's openEditProfileModal() directly via
    window.rcOpenEditProfileModal, a small bridge Account.html sets once
    its own profile/token are loaded (see buildFullProfileUI there) --
    when that bridge isn't there (this page IS Account.html but hasn't
    finished loading yet, or this is a different page entirely, e.g.
    login.html/index.html), it instead sets a sessionStorage flag and
    navigates to Account.html, which opens the modal itself once it's
    ready (see the raceclub_open_edit_profile check in Account.html's
    buildFullProfileUI).

  FLIP-BACK (this pass): the name shown here has always come from
  cached.displayName (server-computed FirstName + LastName + Suffix), NOT
  username -- that was already correct before this pass and still is.
  Username exists now purely as the login identifier; it's never shown in
  the header.

  AVATAR + NAME/ROLE: all three come from getProfileCache() (js/auth.js)
  -- a small cached copy of the last-known profile, written by
  login.html/Account.html whenever they have a fresh payload anyway,
  specifically so THIS file never has to make its own Apps Script
  round-trip just to render the header on every single page load (Apps
  Script's cold-start cost is real, see the login-latency history
  elsewhere in this project). If there's no cache yet (e.g. the token was
  set some other way), the avatar falls back to "?" and the name/role
  stack falls back to blank/"Driver". The name/role text is left-justified
  (Matt's call) via text-align on .rc-header-account-text.

  HONESTY ABOUT WHAT "LOGGED IN" MEANS: showing the avatar off a cached
  token is an optimistic guess, not proof the session is actually still
  valid. That was fine for pages that never call the API at all (index,
  login, register, verify -- there's nothing for them to falsely confirm).
  But Account.html DOES call the API to confirm the session, and if that
  call fails to even reach the server, the avatar rendering instantly
  from cache made the navbar look successfully logged in while the actual
  page content below it was failing -- a confusing, actively misleading
  combination Matt flagged directly. So Account.html no longer calls this
  function immediately: it calls renderHeaderPending() first (logo only,
  no claim either way about login state), then calls THIS function for
  real only once its own API call has actually resolved -- with
  opts.forceLoggedOut set if that call failed to reach the server at all,
  so the header falls back to the logged-out look rather than asserting a
  session it was never able to verify.

  NOTIFICATION BELL / NEW-SEASON NOTIFICATIONS: the whole in-app
  notification bell system (the standalone bell icon that used to sit to
  the LEFT of the avatar, its dropdown, its red unread dot, the
  season/upgrade/welcome/results/season-ended notification kinds, and the
  server-side Notifications sheet + each driver's own NotificationState
  backing it) was removed in full (2026-09-24, Matt's call: eliminate the
  in-app notification system entirely, moving to an external Discord bot).
  The avatar's own account-menu dropdown, described next, is unaffected --
  it was always a separate control.

  ACCOUNT DROPDOWN STAYS RED WHILE OPEN (this pass): the avatar used to
  only turn red on :hover. Now .rc-header-account-toggle[aria-expanded]
  drives the red, so it stays red for as long as the dropdown is actually
  open -- opened by a click, not by hovering. It closes (and the avatar
  reverts) on a second click, an outside click, Escape, OR the pointer
  leaving BOTH the toggle button and the menu itself (not just leaving the
  button) -- see _rcWireHoverAwayClose, a small shared helper that tracks
  mouseenter/mouseleave across a set of elements and only fires its close
  callback once none of them are hovered, with a short delay so a normal
  mouse movement across the gap between button and menu doesn't trip it.

  TOAST NOTIFICATIONS (new this pass): showToast(message, type, durationMs)
  is the one sitewide way any page shows a transient result/status message
  going forward -- Matt's call: notifications live as a temporary toast in
  the bottom-right corner, not as text sitting inside a form's own message
  box. Lives here (not its own file) since every page already loads this
  script. `type` is 'success' | 'error' | 'info' (default 'info'), just
  changes the toast's left-edge accent color. Multiple toasts stack,
  newest at the bottom, each auto-dismisses after `durationMs` or on its
  own close (x) click. DURATION (2026-09-23, Matt's ask): an explicit
  `durationMs` argument always wins; when the caller leaves it out, the
  default now depends on `type` -- 7000ms for 'error' (Matt: give a bad
  result more time to actually be read), 5000ms for 'success' (a
  confirmation), 4200ms for 'info' (unchanged, the original one-size
  default from before this pass). See the .rc-toast* rules in
  style.css. NOTE: a message that comes bundled with its own follow-up
  action -- login.html's "Resend verification email" button,
  register.html's EMAIL_TAKEN "Log in with that account" panel -- keeps
  its explanatory text inline next to that button rather than moving to a
  toast, since a toast that auto-dismisses in a few seconds is the wrong
  home for text a driver needs to still be reading when they click the
  button below it. Everything else (plain success/failure results with no
  attached action) now goes through showToast.
*/
var RC_HEADER_HEIGHT = 70;
var RC_TOAST_CONTAINER_ID = 'rc-toast-container';

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

// Default duration by type (2026-09-23, Matt's ask) -- used only when a
// caller doesn't pass its own durationMs. Error toasts get the longest
// window since a failure is the one result worth still being readable a
// few seconds later; success/confirmation toasts get a touch longer than
// the old one-size default too; info keeps exactly what it always was.
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

  // Double rAF so the browser paints the pre-transition state first --
  // adding rc-toast-in in the same tick the element is inserted can get
  // coalesced by the browser and skip the slide/fade-in entirely.
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

// Builds the Dashboard..Stewarding portion of the account dropdown,
// mirroring Account.html's sidebar order/gating exactly (see the big
// comment at that markup's call site above). Kept as its own function
// since it needs the role gating math but not any of the DOM the rest
// of renderHeader() has already built yet.
function _rcBuildAccountMenuSectionLinks(role) {
  function link(section, label) {
    return '<a class="rc-header-menu-item" href="Account.html#' + section + '" data-rc-section="' + section + '">' + label + '</a>';
  }
  // League Hub moved to the very top of the dropdown, above Dashboard
  // (2026-09-19, Matt's call) -- mirrors the same move in Account.html's
  // sidebar (buildSidebarNav). Off-page link to the public league.html,
  // not an in-page section, so it skips data-rc-section entirely (same as
  // before this reorder).
  var html = '<a class="rc-header-menu-item" href="league.html">League Hub</a>';
  html += '<hr class="rc-header-menu-divider">';
  // Calendar, Protests and Career removed from this dropdown (2026-09-24,
  // Matt's call): Calendar and Protests are now popups reached from
  // Dashboard cards rather than standalone sections (see Account.html's
  // Next Race / Protest cards), and Career was removed entirely (it will
  // live on a future public driver profile instead). Dashboard/Results
  // are the only section links left here.
  html += link('dashboard', 'Dashboard') + link('results', 'Results');
  // A second divider between Results and the permission-gated items --
  // only when at least one of them actually shows for this role, so a
  // Driver/Steward-without-Organizer account never ends up with two
  // dividers back to back and nothing between them.
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

// Same Admin/Organizer/Steward/Driver/Prospect -> .rc-badge-role-* mapping
// as Account.html's own ROLE_PILL_CLASS (Admin section's Members list),
// duplicated here rather than shared since header.js and Account.html are
// separate script scopes on separate pages -- see the .rc-badge-role-*
// rules in style.css for the actual colors. Used to turn the header
// avatar cluster's plain role text (2026-09-21, Matt's call: "add a pill
// to the avatar section, below the name, with the correct pill for the
// profile") into the same colored pill the Admin section uses.
var RC_HEADER_ROLE_PILL_CLASS_ = {
  Admin: 'rc-badge-role-admin',
  Organizer: 'rc-badge-role-organizer',
  Steward: 'rc-badge-role-steward',
  Driver: 'rc-badge-role-driver',
  Prospect: 'rc-badge-role-prospect'
};

// updateHeaderNotifDot (the bell's unread-count badge) removed (2026-09-24,
// Matt's call: eliminate the in-app notification bell system entirely,
// moving to an external Discord bot).

// Shared Edit Profile bridge (2026-09-19, pulled out of the account
// dropdown's click handler so other callers can open the same modal
// instead of navigating to an Account.html section).
// window.rcOpenEditProfileModal
// is the bridge Account.html sets once its own profile/token are loaded
// (see buildFullProfileUI there); call it directly when present -- no
// navigation, the modal just opens in place. On index.html/league.html
// (2026-09-21, Matt's ask: "make it so that the popup appears on the
// index or league page, with league styling") window.rcOpenEditProfileModal
// doesn't exist, but window.rcOpenEditProfileModalInPlace does -- see
// js/edit-profile.js, loaded on those two pages -- which builds the same
// popup itself, themed to match. Only login.html/register.html/
// verify.html/reset-password.html (none of which ever show the account
// dropdown at all -- no token means no dropdown, see renderHeader above)
// still fall through to the old navigate-to-Account.html path.
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
// NOTIFICATION BELL -- the whole in-app notification bell system (bell
// icon, dropdown, ack/dismiss tracking, the season/upgrade/welcome/
// results/season-ended fetch below, and its supporting controller/cache
// plumbing) was removed in full here (2026-09-24, Matt's call: eliminate
// the in-app notification system entirely, moving to an external Discord
// bot). What used to live in this section: RC_NOTIF_ACK_KEY,
// _RC_NOTIF_DISMISS_KINDS_, _rcGetAckedNotifIds/_rcAckNotif,
// _rcFetchSeasonNotifications/_rcFormatNotifDate, _rcNotifController,
// the fetch dedupe window, and the globally-exposed
// rcDismissSeasonNotification()/rcRefreshNotificationsNow() helpers
// Account.html's registration flow used to call.
// ---------------------------------------------------------------------
// Click-outside/Escape listener leak fix (2026-09-13, sitewide review) --
// renderHeader() runs more than once per page (same reason a poll timer
// would have needed a clear-then-restart dance), and every run used to
// attach a FRESH document-level click and keydown listener via a fresh
// closure over that run's own toggle/menu elements, with nothing ever
// removing the previous run's pair. mount.innerHTML replaces those
// elements each render, so the old listeners kept running forever against
// now-detached nodes -- harmless individually (a `.contains()` check
// against a disconnected element is just always false) but an unbounded,
// ever-growing pair of document listeners for the life of the tab, one
// more added every single header re-render. Fix: stash the current
// handler here, remove it before attaching the next one.
var _rcHeaderOutsideClickHandler = null;
var _rcHeaderEscapeHandler = null;

// Shared hover-away-closes helper: closeFn fires once the pointer has
// left every element in `elements` for `delayMs` without re-entering any
// of them. The delay is what lets a mouse cross the gap between a toggle
// button and its dropdown (moving down and slightly sideways) without
// the menu slamming shut mid-move.
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

// Shows just the logo -- no HOME/LOGIN/ACCOUNT at all -- while a page is
// still waiting to find out whether its own session is actually valid.
// Used by Account.html in place of an immediate renderHeader() call, so
// the navbar never asserts a login state (or a logged-out state) it
// hasn't confirmed yet. See the long comment above renderHeader() for why
// this exists.
function renderHeaderPending() {
  var mount = document.getElementById('rc-header');
  if (!mount) return;
  mount.className = 'rc-fixed-header';
  mount.innerHTML = '<a class="rc-header-logo-link" href="index.html">' +
      '<img class="rc-header-logo" src="assets/images/race-club-header-logo.png" alt="Race Club">' +
    '</a><nav class="rc-header-nav"></nav>';
}

// opts.forceLoggedOut: renders the logged-OUT nav (HOME · LOGIN/REGISTER)
// even if a token is present in localStorage. Used when a page tried to
// verify that token against the API and couldn't even reach the server --
// the token might still be perfectly valid, but this page has no way to
// know that right now, so the header shouldn't claim it does either. This
// never clears the token itself (that would force a real re-login over
// what might just be a momentary connection problem) -- it only affects
// what the header LOOKS like on this page load.
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
  html += '<nav class="rc-header-nav">';
  // League Hub link -- top navbar only while logged OUT, next to LOGIN/
  // REGISTER (2026-09-18, Matt's call). Once logged in it moves into the
  // account dropdown instead (see the menu markup below) rather than
  // sitting in the top bar twice.
  if (!token) {
    html += '<a class="rc-header-link" href="league.html">LEAGUE HUB</a>';
    html += '<span class="rc-header-sep">·</span>';
  }
  if (token) {
    var displayName = cached ? (cached.displayName || '') : '';
    var initials = _rcHeaderInitials(displayName);
    var role = cached ? (cached.role || 'Driver') : 'Driver';

    // Notification bell markup (toggle button + dropdown, previously sat
    // to the LEFT of the avatar cluster here) removed in full (2026-09-24,
    // Matt's call: eliminate the in-app notification system entirely,
    // moving to an external Discord bot).

    // The whole avatar/name/role/chevron cluster is one clickable toggle
    // button -- clicking anywhere in it opens/closes the dropdown, which
    // no longer navigates to Account.html directly (see header comment
    // above for why). MY ACCOUNT restores a one-click path back to the
    // account/dashboard page from anywhere on the site, sitting above
    // Logout in the dropdown itself.
    // Avatar image (added 2026-08-30, Matt's call) -- initials render
    // underneath regardless, and the chosen avatar image sits on top of
    // them absolutely-positioned (.rc-header-avatar-img in style.css);
    // its onerror just hides the <img> itself, revealing the initials
    // underneath, same "silently fall back" convention Account.html's own
    // buildAvatarCircle() uses. cached.avatarFilename comes from
    // setProfileCache() (js/auth.js).
    var avatarFilename = cached ? (cached.avatarFilename || '') : '';
    var avatarImgHtml = avatarFilename
      ? '<img class="rc-header-avatar-img" src="assets/avatars/' + escapeHtmlHeader_(avatarFilename) + '" alt="" onerror="this.style.display=\'none\';">'
      : '';
    html += '<button type="button" class="rc-header-account-toggle" id="rc-header-account-toggle" aria-haspopup="true" aria-expanded="false" aria-label="Account menu">' +
              '<span class="rc-header-avatar">' + initials + avatarImgHtml + '</span>' +
              '<span class="rc-header-account-text">' +
                '<span class="rc-header-account-name">' + escapeHtmlHeader_(displayName).toUpperCase() + '</span>' +
                '<span class="rc-badge-chip rc-header-account-role ' + (RC_HEADER_ROLE_PILL_CLASS_[role] || 'rc-badge-role-driver') + '">' + escapeHtmlHeader_(role) + '</span>' +
              '</span>' +
              // 16x16 (2026-09-13 fix, sitewide review) -- was 14x14, the one
              // outlier against the 16x16 standard every other small nav/menu
              // icon on the site uses (Account.html's ICON_CHEVRON_DOWN and
              // the rest of its icon set). No CSS width/height override on
              // .rc-header-account-chevron, so this inline attribute is the
              // only place the size is set -- safe to bump with no other
              // measurement (unlike the bell icon below) tied to it.
              '<svg class="rc-header-account-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
            '</button>' +
            // Dropdown now mirrors Account.html's own sidebar, same order
            // (2026-09-19, Matt's call) -- Dashboard/Calendar/Results/
            // Protests/Career, a divider, League Hub, then whichever of
            // Admin/League Tools/Stewarding this role actually unlocks
            // (same cumulative Driver<Steward<Organizer<Admin hierarchy
            // Account.html's own nav gating uses), a divider, Edit Profile/
            // Help/Feedback, a divider, Logout. Reordered 2026-09-21 (Matt's
            // ask) -- was Help/Edit Profile/divider/Logout with no Feedback
            // item; same reorder applied to Account.html's own sidebar (see
            // buildSidebarNav there). Every section link uses the
            // Account.html#<id> hash + data-rc-section pattern -- see
            // the click wiring below, which reuses that exact "call
            // window.rcNavigateToSection in place if it's there (we're
            // already on Account.html), otherwise let the href really
            // navigate there" bridge. Edit Profile and Feedback are both
            // popups, not sections -- see _rcOpenEditProfileFromHeader()/
            // _rcOpenFeedbackModal() below, wired further down.
            '<div class="rc-header-account-menu" id="rc-header-account-menu" style="display:none;">' +
              _rcBuildAccountMenuSectionLinks(role) +
              '<hr class="rc-header-menu-divider">' +
              '<button type="button" class="rc-header-menu-item" id="rc-header-menu-editprofile">Edit Profile</button>' +
              '<a class="rc-header-menu-item" href="Account.html#help" data-rc-section="help">Help</a>' +
              '<button type="button" class="rc-header-menu-item" id="rc-header-menu-feedback">Feedback</button>' +
              '<hr class="rc-header-menu-divider">' +
              '<button type="button" class="rc-header-menu-item" id="rc-header-menu-logout">Logout</button>' +
            '</div>';
  } else {
    html += '<a class="rc-header-link" href="login.html">REGISTER/LOGIN</a>';
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
    // Remove the previous render's document-level listeners before adding
    // this render's (2026-09-13 leak fix -- see _rcHeaderOutsideClickHandler
    // above) instead of just stacking another pair on top.
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

    // The account dropdown also closes the instant the pointer leaves
    // BOTH its toggle button and its own menu, not just on an outside
    // click -- see _rcWireHoverAwayClose's own comment for why. Opening
    // is still click-only; this only ever closes it early.
    _rcWireHoverAwayClose([toggle, menu], closeAccountMenu);

    // Section links (Dashboard..Stewarding/Help, added 2026-09-19) --
    // call window.rcNavigateToSection in place when it exists
    // (we're already on Account.html, so this just switches sections,
    // no reload), otherwise let the href do a real navigation to
    // Account.html#<section>, which that page's own load-time hash
    // check picks up and opens directly.
    Array.prototype.forEach.call(menu.querySelectorAll('[data-rc-section]'), function (a) {
      a.addEventListener('click', function (evt) {
        closeAccountMenu();
        if (typeof window.rcNavigateToSection === 'function') {
          evt.preventDefault();
          window.rcNavigateToSection(a.getAttribute('data-rc-section'));
        }
      });
    });

    // Edit Profile -- works from any page (2026-09-01, Matt's call), not
    // just Account.html's own sidebar. window.rcOpenEditProfileModal is a
    // bridge Account.html sets once its profile/token are actually loaded
    // (see buildFullProfileUI there); when it's there, call it directly
    // -- no navigation, the modal just opens in place. When it's not
    // (any other page, or Account.html mid-load), stash a flag and
    // navigate there instead; Account.html checks that flag once its own
    // load finishes and opens the modal itself, same handoff pattern
    // already used for a fresh-login profile payload.
    document.getElementById('rc-header-menu-editprofile').addEventListener('click', function () {
      closeAccountMenu();
      _rcOpenEditProfileFromHeader();
    });

    // Feedback -- unlike Edit Profile, opens in place on whatever page the
    // user is already on, no navigation involved (2026-09-21, Matt's ask:
    // "does not have to open the popup on the account page"). See
    // _rcOpenFeedbackModal() below.
    document.getElementById('rc-header-menu-feedback').addEventListener('click', function () {
      closeAccountMenu();
      _rcOpenFeedbackModal();
    });

    // Same fire-and-forget logout pattern as Account.html's sidebar Log
    // Out button: clear the local token and redirect immediately, fire
    // the API call without waiting on it.
    document.getElementById('rc-header-menu-logout').addEventListener('click', function () {
      fetchApi('logout', { method: 'POST', token: token }).catch(function () {});
      clearToken();
      window.location.href = 'login.html';
    });

    // ---------------------------------------------------------------
    // NOTIFICATION BELL -- the whole fetch/render/dismiss block that used
    // to live here (currentNotifications/currentNotifHistory,
    // _rcRenderNotifList, _rcDismissShownSeasonNotifs,
    // _rcClearAllNotifications, _rcRefreshNotifications, the notif cache
    // seed/persist calls, and the fetch-dedupe check) was removed in full
    // (2026-09-24, Matt's call: eliminate the in-app notification system
    // entirely, moving to an external Discord bot).
    // ---------------------------------------------------------------
  }
}

function escapeHtmlHeader_(str) {
  var d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// ---------------------------------------------------------------------
// SITEWIDE FOOTER LEGAL DISCLAIMER (added 2026-09-20, Matt's ask) -- every
// page's .rc-site-footer now ends with a "Legal Disclaimer" link that
// opens the full disclaimer text in a popup. Lives here (not Account.html)
// since header.js is the one script every page already loads, including
// the ones that never load Account.html's own showModal (index, login,
// register, reset-password, verify, league). Builds the exact same
// .rc-modal-backdrop/.rc-modal/.rc-modal-head/.rc-modal-body markup
// Account.html's showModal uses (see style.css) by hand with
// document.createElement, since this file has no el()/escapeHtml helper
// of its own and doesn't need one just for this. Same "closable only via
// the X button" lockdown convention as every other modal on the site
// (2026-08-30 rule) -- no backdrop-click or Escape close, even though
// this one's read-only and low-stakes, just for one consistent modal
// behavior sitewide.
function rcOpenLegalModal() {
  var backdrop = document.createElement('div');
  backdrop.className = 'rc-modal-backdrop';
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
  // Static, trusted, hand-authored content (Matt's own legal.txt) -- no
  // escaping needed, this never includes any user-supplied data.
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

// Called once from a small inline <script> right after each page's own
// <footer class="rc-site-footer"> markup (same explicit-call convention
// renderHeader() itself uses) -- wires the footer's "Legal Disclaimer"
// link to open the modal above. A no-op if the link isn't on the page for
// some reason, so this is always safe to call.
function rcWireFooterLegalLink() {
  var link = document.getElementById('rc-footer-legal-link');
  if (link) link.addEventListener('click', function (evt) { evt.preventDefault(); rcOpenLegalModal(); });
}

// Feedback categories -- must match FEEDBACK_CATEGORIES_ in Website.gs
// exactly (a category the backend doesn't recognize just falls back to
// "Other" there, so this isn't load-bearing, but keeping them in sync
// means the email Matt gets always shows the category the driver actually
// picked).
var _RC_FEEDBACK_CATEGORIES_ = ['Bug Report', 'Feature Request', 'Rulebook / Rules Question', 'Account or Login Issue', 'General Feedback', 'Other'];
var _RC_FEEDBACK_MESSAGE_MAX_ = 500;

// Feedback popup (2026-09-21, Matt's ask) -- unlike Edit Profile
// (_rcOpenEditProfileFromHeader above, which navigates to Account.html and
// delegates to its own modal system), this is fully self-contained here so
// it opens IN PLACE on whatever page the user is already on, no navigation
// ("does not have to open the popup on the account page" -- Matt's own
// clarification). Branches on document.body.classList.contains
// ('rc-league-page') to build either the light .rc-modal-* shell (every
// page except league.html) or the dark .rcl-modal-* shell (league.html),
// reusing each page's own already-existing modal CSS rather than inventing
// a third "universal" shell -- deliberately NOT the same pattern
// rcOpenLegalModal() above uses, since that one never got dark theming and
// still renders light even on league.html (a known gap this doesn't
// repeat). Same "closable only via the X button" lockdown as every other
// modal on the site, and the same manual document.createElement approach
// as rcOpenLegalModal() (this file has no el()/escapeHtml helper of its
// own).
function _rcOpenFeedbackModal() {
  var isDark = document.body.classList.contains('rc-league-page');

  var backdrop = document.createElement('div');
  // rcl-modal-overlay-over-nav (2026-09-21, Matt's ask: "only when EDIT
  // PROFILE and FEEDBACK popups are visible on the league page, dim the
  // navbar with the main league page... keep the other popups how they
  // are") -- sits above .rc-fixed-header (css/style.css, z-index:1000)
  // instead of below it, so the navbar dims along with the rest of the
  // page for this popup specifically. Every other league.html popup
  // (News, Points Table, Drivers, Season Details, Legal Disclaimer) keeps
  // the plain .rcl-modal-overlay, unchanged.
  backdrop.className = isDark ? 'rcl-modal-overlay rcl-modal-overlay-over-nav' : 'rc-modal-backdrop';
  var modal = document.createElement('div');
  // rcl-modal-dialog-narrow (2026-09-21, Matt's catch: "make the league
  // page feedback popup the same width as the account page's feedback
  // popup") -- the dark shell's plain .rcl-modal-dialog defaults to 820px
  // (News/Points Table's own width), while the light .rc-modal this
  // branch uses is 460px; the narrow modifier (css/league.css) brings the
  // dark side down to match.
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

  var nameLabel = document.createElement('label');
  nameLabel.textContent = 'Name';
  body.appendChild(nameLabel);
  var nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.maxLength = 120;
  nameInput.required = true;
  body.appendChild(nameInput);

  var emailLabel = document.createElement('label');
  emailLabel.textContent = 'Email (optional)';
  body.appendChild(emailLabel);
  var emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.maxLength = 180;
  body.appendChild(emailInput);

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
    // Name required, email optional (2026-09-21, Matt's ask) -- was both
    // optional.
    if (!nameInput.value.trim()) {
      errorMsg.textContent = 'Enter your name before sending.';
      errorMsg.style.display = 'block';
      return;
    }
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
        email: emailInput.value.trim(),
        message: message,
        pageUrl: window.location.href
      }
    }).then(function (result) {
      if (!result || !result.success) throw new Error((result && result.message) || 'Send failed');
      // Swap the body's contents in place for a confirmation view -- no
      // navigation, no reload (2026-09-21, Matt's ask: "a verification
      // shows up and the person can close the verification and return to
      // the page they were on"). Closing just removes the backdrop, same
      // close() as the form view above, so the driver lands back on
      // whatever page/section they were already looking at.
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
