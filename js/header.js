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
  - The dropdown now mirrors Account.html's own sidebar order/gating in
    full (2026-09-19): Dashboard, Calendar, Results, Protests, Career, a
    divider, League Hub, then whichever of Admin/League Tools/Stewarding
    this role unlocks, a divider, Help, Edit Profile, a divider, Logout.
    See _rcBuildAccountMenuSectionLinks below and its click wiring in
    renderHeader() for how each link switches sections in place on
    Account.html itself but does a real navigation from anywhere else.
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

  NOTIFICATION BELL: a standalone bell icon sits to the LEFT of the
  avatar, with its own dropdown and its own Apple-style red dot --
  deliberately separate from the avatar's own account-menu dropdown, so
  "there's something to react to" and "here's your account menu" stay two
  unrelated ideas. Every renderHeader() call fetches its own notifications
  in the background. The admin "an account is waiting on your approval"
  type that used to live here (sourced from adminListPendingAccounts,
  client-side-acknowledged via localStorage) is gone entirely (2026-09-19,
  Matt's call: no more admin-approval queue -- Members are grouped by role
  via adminListDrivers' hasSeat flag instead, see Account.html). What's
  left: 'season', 'upgrade', and 'welcome' ("Choose an avatar!", added
  2026-09-19) -- all server-side, Notifications sheet-backed, see
  NEW-SEASON NOTIFICATIONS below. The old sponsors notification type is
  also gone (2026-09-17 V1 scope cut, Sponsorship system out of the site).

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
  The bell dropdown behaves the same way (opens on click, auto-closes on
  hover-off) -- both toggles are wired through the same helper.

  NEW-SEASON NOTIFICATIONS (2026-08-30, Matt's ask): a notification type
  backed by a real server-side Notifications sheet + each driver's own
  NotificationState -- see handleGetNotifications/handleDismissNotifications
  in DataCache.gs. Fires the moment a season actually becomes open for
  registration; visible to Driver role and above (Prospects have nothing to
  register for yet, same gate the Registration Status/Current Seat dashboard
  cards already use). Each item shows a date stamp and has NO OK button --
  it dismisses itself automatically once
  the driver has actually seen it: closing the bell dropdown (not opening
  it -- see below) dismisses every season notification that was showing,
  moving it into that driver's own capped-at-5 history list (shown further
  down the dropdown, muted, under a "Recently Opened" divider). Registering
  for that season dismisses it the same way even if the bell was never
  opened -- Account.html's registration flow calls the global
  rcDismissSeasonNotification(seasonId) helper below on success, which
  reaches into whatever bell state currently exists (or calls the API
  directly if the header hasn't rendered yet).
  Dismissal is deliberately wired to CLOSE, not the click that opens the
  bell -- dismissing at open time would clear the list out from under the
  driver while they're still reading it, since both happen in the same
  render pass. Practically this is still "click the bell" from the
  driver's side (open, read, close -- or click away, which closes it the
  same way), just sequenced so the content doesn't disappear while it's on
  screen.

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
  html += link('dashboard', 'Dashboard') + link('calendar', 'Calendar') + link('results', 'Results') +
    link('protests', 'Protests') + link('career', 'Career');
  // A second divider between Career and the permission-gated items --
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

// The bell's notification badge -- shown, with the actual unread count as
// its text, whenever there's at least one unacknowledged notification
// (2026-09-01, Matt's call: "make the bubble larger and add a notification
// number to it" -- this used to just be a plain dot with no count, toggled
// by a boolean). Accepts a number now; anything above 9 collapses to "9+"
// so the badge never has to stretch wide enough to look like a pill instead
// of a circle.
function updateHeaderNotifDot(count) {
  count = count || 0;
  var dot = document.getElementById('rc-header-bell-dot');
  if (dot) {
    if (count > 0) {
      dot.textContent = count > 9 ? '9+' : String(count);
      dot.style.display = 'flex';
    } else {
      dot.textContent = '';
      dot.style.display = 'none';
    }
  }
  // Every call here is the best-known count at that moment (the initial
  // cache-paint call included -- writing the same value back is harmless),
  // so this is the one place that keeps the cache-then-verify cache (see
  // setNotifCountCache/getNotifCountCache in js/auth.js) current, rather
  // than sprinkling cache writes across every call site that mutates
  // currentNotifications.
  if (typeof setNotifCountCache === 'function') setNotifCountCache(count);
}

// Shared Edit Profile bridge (2026-09-19, pulled out of the account
// dropdown's click handler so the "Choose an avatar!" notification link
// -- see the 'welcome' kind in _rcFetchSeasonNotifications/
// _rcRenderNotifList below -- can open the same modal instead of
// navigating to an Account.html section). window.rcOpenEditProfileModal
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
// NOTIFICATION BELL -- see the header comment above for the full
// rationale. Acknowledgement is tracked client-side (no backend
// notifications table exists yet), keyed by notification id, so an
// acknowledged item stays acknowledged across reloads on THIS browser.
// ---------------------------------------------------------------------
var RC_NOTIF_ACK_KEY = 'raceclub_acknowledged_notifs';

// Kinds dismissed server-side on bell-close (see _rcDismissShownSeasonNotifs/
// _rcClearAllNotifications below) rather than via the client-side ack list
// above -- 'season' is seasonId-keyed, everything else here is
// notificationId-keyed. Kept as one list so a future kind only needs to be
// added in this one place. 'results_preliminary'/'results_official' added
// 2026-09-24.
var _RC_NOTIF_DISMISS_KINDS_ = ['season', 'upgrade', 'welcome', 'results_preliminary', 'results_official'];

function _rcGetAckedNotifIds() {
  try {
    var raw = localStorage.getItem(RC_NOTIF_ACK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function _rcAckNotif(id) {
  try {
    var ids = _rcGetAckedNotifIds();
    if (ids.indexOf(id) === -1) ids.push(id);
    localStorage.setItem(RC_NOTIF_ACK_KEY, JSON.stringify(ids));
  } catch (e) {
    // localStorage unavailable/full -- acknowledgement just won't persist
    // across reloads, not worth failing the click over.
  }
}

// The admin "an account is waiting on your approval" notification (and
// its _rcFetchNotifications helper) is gone entirely (2026-09-19, Matt's
// call: no more admin-approval queue). "Choose your sponsors" (and its
// _rcFetchSponsorNotifications helper) was removed earlier, 2026-09-17 --
// V1 scope cut, the whole Sponsorship system is out of the site for now.
// See season-1-mvp-scope.md.

// New-season + account-upgrade notifications (added 2026-08-30). Backed by
// a real Notifications sheet + each driver's own NotificationState, not
// client-side acknowledgement -- see handleGetNotifications in
// DataCache.gs. The season kind is Driver-and-above only (Prospects have
// nothing to register for yet); the upgrade kind is NEVER gated on role
// here, since an upgrade notification is exactly what tells a Prospect
// they've just become a Driver -- so this whole fetch always runs for any
// logged-in cached profile, not just non-Prospects. Returns
// { active: [...], history: [...] }, already shaped for the bell UI; both
// empty for a logged-out call.
function _rcFetchSeasonNotifications(token, cached) {
  if (!cached) return Promise.resolve({ active: [], history: [] });
  // noRetry (2026-09-23, see the retry-storm comment on RC_FETCH_RETRY_DELAYS_MS
  // in js/api.js) -- this same call also runs unattended every 45s from
  // the header's own poll timer, so a slow tick just resolving quietly on
  // the NEXT tick beats piling a retry onto the same queue that's already
  // running behind.
  return fetchApi('getNotifications', { token: token, noRetry: true })
    .then(function (data) {
      if (!data || !data.success) return { active: [], history: [] };
      var active = (data.active || []).map(function (n) {
        if (n.kind === 'welcome') {
          // "Choose an avatar!" (2026-09-19) -- links straight to the Edit
          // Profile modal via _rcOpenEditProfileFromHeader, not an
          // Account.html section (see _rcRenderNotifList's click handler
          // below, which special-cases section === 'editprofile').
          return {
            id: 'welcome-' + n.notificationId, notificationId: n.notificationId, kind: 'welcome',
            message: n.message,
            dateStamp: _rcFormatNotifDate(n.createdAt),
            section: 'editprofile', linkLabel: 'Choose Avatar'
          };
        }
        if (n.kind === 'upgrade') {
          return {
            id: 'upgrade-' + n.notificationId, notificationId: n.notificationId, kind: 'upgrade',
            message: n.message,
            dateStamp: _rcFormatNotifDate(n.createdAt)
          };
        }
        if (n.kind === 'results_preliminary' || n.kind === 'results_official') {
          // Results-posted (2026-09-24) -- links to the Results section,
          // same as any other "go look at this" item. n.message already
          // comes fully formed off the server (createResultsNotification_
          // in Notifications.gs), e.g. "Round 3: Sebring -- Preliminary
          // Results Posted", so it's used as-is rather than rebuilt here.
          return {
            id: n.kind + '-' + n.notificationId, notificationId: n.notificationId, kind: n.kind,
            message: n.message,
            dateStamp: _rcFormatNotifDate(n.createdAt),
            section: 'results', linkLabel: 'View Results'
          };
        }
        return {
          id: 'season-' + n.seasonId, seasonId: n.seasonId, kind: 'season',
          message: 'Registration is open for ' + (n.seasonName || 'a new season') + '.',
          dateStamp: _rcFormatNotifDate(n.createdAt),
          section: 'dashboard', linkLabel: 'Register'
        };
      });
      // History entries come back as the RAW stored shape (no kind field)
      // -- {seasonId, seasonName, dismissedAt} for a season, or
      // {notificationId, message, dismissedAt} for an upgrade -- see
      // handleDismissNotifications in DataCache.gs. Tell them apart by
      // which id field is present.
      var history = (data.history || []).map(function (h) {
        if (h.notificationId) {
          return {
            id: 'upgrade-history-' + h.notificationId + '-' + h.dismissedAt,
            message: h.message,
            dateStamp: _rcFormatNotifDate(h.dismissedAt)
          };
        }
        return {
          id: 'season-history-' + h.seasonId + '-' + h.dismissedAt,
          message: 'Registration opened for ' + (h.seasonName || 'a season') + '.',
          dateStamp: _rcFormatNotifDate(h.dismissedAt)
        };
      });
      return { active: active, history: history };
    })
    .catch(function () { return { active: [], history: [] }; });
}

function _rcFormatNotifDate(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Set each time renderHeader() actually builds the logged-in bell (null
// otherwise, e.g. logged out) -- lets rcDismissSeasonNotification() below
// reach into whatever bell state currently exists from OUTSIDE this file,
// specifically so Account.html's registration flow can dismiss a season's
// notification the instant a driver registers, even if they never opened
// the bell at all.
var _rcNotifController = null;

// Live bell polling (added 2026-08-30, Matt's call: "push the update to
// the bell without a refresh of the page") -- re-fetches both notification
// types on an interval so a new approval request or a newly-opened season
// shows up (dot + list) while the driver just sits on the page, instead of
// only ever refreshing on the next full page load/navigation. One shared
// timer, cleared and restarted every time renderHeader() rebuilds the
// logged-in bell (it's called more than once per page -- see the header
// comment above) so re-renders never stack up duplicate timers, and
// cleared outright when the header renders logged-out.
var _rcNotifPollTimer = null;
var RC_NOTIF_POLL_MS = 45000;

// Click-outside/Escape listener leak fix (2026-09-13, sitewide review) --
// renderHeader() runs more than once per page (same reason the poll timer
// above needs the clear-then-restart dance), and every run used to attach
// a FRESH document-level click and keydown listener via a fresh closure
// over that run's own toggle/menu/bellToggle/notifMenu elements, with
// nothing ever removing the previous run's pair. mount.innerHTML replaces
// those elements each render, so the old listeners kept running forever
// against now-detached nodes -- harmless individually (a `.contains()`
// check against a disconnected element is just always false) but an
// unbounded, ever-growing pair of document listeners for the life of the
// tab, one more added every single header re-render. Same fix as the poll
// timer: stash the current handler here, remove it before attaching the
// next one.
var _rcHeaderOutsideClickHandler = null;
var _rcHeaderEscapeHandler = null;

// Called by Account.html once a registration actually succeeds (see
// buildRegistrationModal's onDone) -- dismisses that season's notification
// immediately, same as closing the bell after seeing it would. Falls back
// to calling the API directly (fire-and-forget) if the header's bell
// hasn't rendered this state yet, so the dismissal still reaches the
// server either way.
function rcDismissSeasonNotification(seasonId) {
  if (!seasonId) return;
  if (_rcNotifController && typeof _rcNotifController.dismissSeason === 'function') {
    _rcNotifController.dismissSeason(seasonId);
    return;
  }
  var token = (typeof getToken === 'function') ? getToken() : null;
  if (token && typeof fetchApi === 'function') {
    fetchApi('dismissNotifications', { method: 'POST', token: token, body: { seasonIds: JSON.stringify([seasonId]) } })
      .catch(function () { /* fire-and-forget -- nothing on screen depends on this succeeding */ });
  }
}

// Called by Account.html right after any action that should clear a
// notification without the driver ever opening the bell (2026-09-01,
// Matt's call: "automatically acknowledge any pending notification if any
// relevant action is done without visiting the notification dropdown
// first"). The sponsor-picking use case this was originally written for is
// gone (2026-09-17 V1 scope cut), but other callers (e.g. right after
// joinTeam) still use this to refresh the bell immediately instead of
// waiting for the next 45s poll tick. A no-op if the bell hasn't rendered
// this state yet (logged out, or this page has no header).
function rcRefreshNotificationsNow() {
  if (_rcNotifController && typeof _rcNotifController.refresh === 'function') _rcNotifController.refresh();
}

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

    // Bell sits to the LEFT of the avatar cluster -- its own toggle
    // button + dropdown, entirely separate from the account menu (see
    // header comment above).
    html += '<button type="button" class="rc-header-bell-toggle" id="rc-header-bell-toggle" aria-haspopup="true" aria-expanded="false" aria-label="Notifications">' +
              // The dot is now positioned against THIS inner wrapper
              // (sized to match the 19x19 bell glyph), not the outer
              // button -- the button's own 38x38 circular hit target is
              // much bigger than the visible icon, so a dot positioned off
              // the button's own corner used to land well outside the bell
              // itself. Matt's call, 2026-08-30.
              // Left at 19x19, not the site's usual 16x16 icon standard
              // (2026-09-13 sitewide review flagged this as an inconsistency
              // "where feasible" to fix -- this one isn't): .rc-header-bell-
              // icon-wrap above is sized to match this exact 19x19, and the
              // .rc-notif-dot's -10px/-8px offsets were tuned against that
              // same size. Shrinking the svg without re-tuning both would
              // pull the unread-count dot off the bell's corner again --
              // the exact bug this whole wrapper was built to fix.
              '<span class="rc-header-bell-icon-wrap">' +
                '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>' +
                '<span class="rc-notif-dot" id="rc-header-bell-dot" style="display:none;"></span>' +
              '</span>' +
            '</button>' +
            '<div class="rc-header-notif-menu" id="rc-header-notif-menu" style="display:none;">' +
              '<div class="rc-header-notif-head"><span>Notifications</span>' +
                '<button type="button" class="rc-header-notif-clear" id="rc-header-notif-clear" hidden>Clear</button>' +
              '</div>' +
              '<div class="rc-header-notif-list" id="rc-header-notif-list"></div>' +
            '</div>';

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
            // Account.html#<id> hash + data-rc-section pattern the
            // notification bell's own links already established -- see
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

  // Cache-then-verify bell paint (2026-09-24, Matt's ask) -- paints the
  // unread dot INSTANTLY from the last-known count (see
  // setNotifCountCache/getNotifCountCache in js/auth.js) before the real
  // getNotifications call below even starts, so the dot doesn't visibly
  // flip off-then-on on every full-page navigation. The real fetch result
  // (in _rcRefreshNotifications further down) overwrites both the DOM and
  // the cache once it resolves, correcting this guess either way.
  if (token && typeof getNotifCountCache === 'function') {
    updateHeaderNotifDot(getNotifCountCache());
  }

  if (token) {
    var toggle = document.getElementById('rc-header-account-toggle');
    var menu = document.getElementById('rc-header-account-menu');
    var bellToggle = document.getElementById('rc-header-bell-toggle');
    var notifMenu = document.getElementById('rc-header-notif-menu');

    function closeAccountMenu() {
      menu.style.display = 'none';
      toggle.setAttribute('aria-expanded', 'false');
    }
    function openAccountMenu() {
      closeNotifMenu();
      menu.style.display = 'block';
      toggle.setAttribute('aria-expanded', 'true');
    }
    function closeNotifMenu() {
      var wasOpen = notifMenu.style.display === 'block';
      notifMenu.style.display = 'none';
      bellToggle.setAttribute('aria-expanded', 'false');
      // Dismiss on CLOSE, not open -- see the header comment's NEW-SEASON
      // NOTIFICATIONS section for why. Only fires if the dropdown was
      // actually open (an outside click while it's already shut is a
      // no-op, same as before this pass).
      if (wasOpen) _rcDismissShownSeasonNotifs();
    }
    function openNotifMenu() {
      closeAccountMenu();
      notifMenu.style.display = 'block';
      bellToggle.setAttribute('aria-expanded', 'true');
    }

    toggle.addEventListener('click', function (evt) {
      evt.stopPropagation();
      if (menu.style.display === 'block') closeAccountMenu(); else openAccountMenu();
    });
    bellToggle.addEventListener('click', function (evt) {
      evt.stopPropagation();
      if (notifMenu.style.display === 'block') closeNotifMenu(); else openNotifMenu();
    });
    // Remove the previous render's document-level listeners before adding
    // this render's (2026-09-13 leak fix -- see _rcHeaderOutsideClickHandler
    // above) instead of just stacking another pair on top.
    if (_rcHeaderOutsideClickHandler) document.removeEventListener('click', _rcHeaderOutsideClickHandler);
    if (_rcHeaderEscapeHandler) document.removeEventListener('keydown', _rcHeaderEscapeHandler);

    _rcHeaderOutsideClickHandler = function (evt) {
      if (menu.style.display === 'block' && !menu.contains(evt.target) && !toggle.contains(evt.target)) closeAccountMenu();
      if (notifMenu.style.display === 'block' && !notifMenu.contains(evt.target) && !bellToggle.contains(evt.target)) closeNotifMenu();
    };
    _rcHeaderEscapeHandler = function (evt) {
      if (evt.key !== 'Escape') return;
      if (menu.style.display === 'block') closeAccountMenu();
      if (notifMenu.style.display === 'block') closeNotifMenu();
    };
    document.addEventListener('click', _rcHeaderOutsideClickHandler);
    document.addEventListener('keydown', _rcHeaderEscapeHandler);

    // Both dropdowns also close the instant the pointer leaves BOTH their
    // toggle button and their own menu, not just on an outside click --
    // see the header comment above and _rcWireHoverAwayClose's own
    // comment for why. Opening is still click-only for both; this only
    // ever closes them early.
    _rcWireHoverAwayClose([toggle, menu], closeAccountMenu);
    _rcWireHoverAwayClose([bellToggle, notifMenu], closeNotifMenu);

    // Section links (Dashboard..Stewarding/Help, added 2026-09-19) --
    // same bridge pattern the notification bell's own links use just
    // above: call window.rcNavigateToSection in place when it exists
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
    // NOTIFICATION BELL -- fetched in the background on every render
    // (see header comment above for why opts.skipNotifCheck is gone).
    // currentNotifications/currentNotifHistory are closured so the
    // dismiss-on-close flow (season/upgrade/welcome types, see
    // closeNotifMenu above) can mutate and re-render them. Three
    // notification kinds share this one list: 'season' (Driver+,
    // server-side dismiss, added 2026-08-30), 'upgrade' (any account whose
    // Status/Role just increased, server-side dismiss, also added
    // 2026-08-30 -- see handleGetNotifications/createAccountUpgradeNotification_
    // in DataCache.gs), and 'welcome' ("Choose an avatar!", server-side
    // dismiss, added 2026-09-19 -- see createChooseAvatarNotification_ in
    // DataCache.gs).
    // ---------------------------------------------------------------
    var currentNotifications = [];
    var currentNotifHistory = [];

    function _rcRenderNotifList() {
      var listEl = document.getElementById('rc-header-notif-list');
      if (!listEl) return;
      // Shown whenever there's anything to clear -- active items OR a
      // lingering "Recently Opened" history entry (2026-09-02 fix: this used
      // to only check currentNotifications, so once nothing was active the
      // button vanished even though a stale history item was still sitting
      // there with no way to get rid of it).
      var clearBtn = document.getElementById('rc-header-notif-clear');
      if (clearBtn) clearBtn.hidden = currentNotifications.length === 0 && currentNotifHistory.length === 0;
      listEl.innerHTML = '';
      if (currentNotifications.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'rc-header-notif-empty';
        empty.textContent = "You're all caught up.";
        listEl.appendChild(empty);
      } else {
        currentNotifications.forEach(function (n) {
          // fullRowLink (2026-09-02, Matt's call, sponsors specifically:
          // "get rid of the CHOOSE SPONSORS button... make the whole
          // message thing a link") -- the item itself becomes the <a>
          // (its whole row is clickable, not just a chip inside it) when
          // n.fullRowLink is set (currently just the sponsors kind, see
          // _rcFetchSponsorNotifications above); everything else (pending
          // approval's "Review", a future kind) keeps the separate
          // trailing text link below, unchanged.
          var item = document.createElement(n.fullRowLink ? 'a' : 'div');
          item.className = 'rc-header-notif-item' + (n.fullRowLink ? ' rc-header-notif-item-link' : '');
          if (n.fullRowLink) {
            item.href = 'Account.html#' + n.section;
            item.addEventListener('click', function (evt) {
              if (typeof window.rcNavigateToSection === 'function') {
                evt.preventDefault();
                window.rcNavigateToSection(this.getAttribute('href').replace(/^Account\.html#/, ''));
                closeNotifMenu();
              }
            });
          }
          var textCol = document.createElement('div');
          textCol.className = 'rc-header-notif-text-col';
          var text = document.createElement('span');
          text.className = 'rc-header-notif-text';
          text.textContent = n.message;
          textCol.appendChild(text);
          if (n.dateStamp) {
            var date = document.createElement('span');
            date.className = 'rc-header-notif-date';
            date.textContent = n.dateStamp;
            textCol.appendChild(date);
          }
          item.appendChild(textCol);
          // A link straight to wherever this notification needs the driver
          // to actually go, not an "OK" acknowledge button (2026-09-02,
          // Matt's call: "it should be links listed for actions that need
          // to happen... a link that takes the user directly to the page").
          // Every kind that names something actionable sets n.section when
          // it's built below (pending -> Admin, sponsors -> Sponsors,
          // season -> Dashboard, where the Registration Status card lives);
          // 'upgrade' is purely informational (an account/role change
          // already happened, there's nothing left to go do) so it never
          // gets one. Clicking just navigates -- it does NOT acknowledge/
          // dismiss the notification itself, since visiting the page
          // doesn't mean the underlying thing (an approval, a sponsor
          // pick) actually got done; each kind still clears itself the
          // same way it always has (pending/sponsors: naturally stops
          // being generated once resolved, or Clear; season: dismissed
          // when the dropdown closes).
          if (n.section && !n.fullRowLink) {
            var linkEl = document.createElement('a');
            linkEl.className = 'rc-header-notif-link';
            linkEl.textContent = n.linkLabel || 'Go';
            if (n.section === 'editprofile') {
              // 'welcome' kind ("Choose an avatar!") -- opens the Edit
              // Profile modal directly via the shared bridge instead of
              // navigating to an Account.html section (2026-09-19).
              linkEl.href = 'Account.html';
              linkEl.addEventListener('click', function (evt) {
                evt.preventDefault();
                closeNotifMenu();
                _rcOpenEditProfileFromHeader();
              });
            } else {
              linkEl.href = 'Account.html#' + n.section;
              linkEl.addEventListener('click', function (evt) {
                // window.rcNavigateToSection is the bridge Account.html sets
                // once it's loaded (see buildFullProfileUI there) -- present
                // means this IS Account.html already, so switch sections in
                // place instead of letting the href fire a same-document
                // hash change that showSection() would never find out about.
                // Absent (any other page) just falls through to the href's
                // real navigation.
                if (typeof window.rcNavigateToSection === 'function') {
                  evt.preventDefault();
                  window.rcNavigateToSection(this.getAttribute('href').replace(/^Account\.html#/, ''));
                  closeNotifMenu();
                }
              });
            }
            item.appendChild(linkEl);
          }
          listEl.appendChild(item);
        });
      }

      // History (2026-08-30) -- up to 5 recently-dismissed season
      // notifications, muted, underneath a divider. Nothing here is
      // interactive; it's just a record of what already opened and was
      // seen, same "leave the history up to 5" ask.
      if (currentNotifHistory.length > 0) {
        var histHead = document.createElement('div');
        histHead.className = 'rc-header-notif-history-head';
        histHead.textContent = 'Recently Opened';
        listEl.appendChild(histHead);
        currentNotifHistory.slice(0, 5).forEach(function (h) {
          var histItem = document.createElement('div');
          histItem.className = 'rc-header-notif-item rc-header-notif-history-item';
          var histText = document.createElement('span');
          histText.className = 'rc-header-notif-text';
          histText.textContent = h.message;
          histItem.appendChild(histText);
          if (h.dateStamp) {
            var histDate = document.createElement('span');
            histDate.className = 'rc-header-notif-date';
            histDate.textContent = h.dateStamp;
            histItem.appendChild(histDate);
          }
          listEl.appendChild(histItem);
        });
      }
    }

    // Fires when the bell dropdown closes (see closeNotifMenu above) --
    // moves every currently-showing season AND upgrade notification into
    // history (capped at 5, newest first) and tells the server, so neither
    // comes back as active next time this driver logs in or the header
    // re-renders. No-op if there's nothing season/upgrade-typed currently
    // active.
    // clearHistory (2026-09-02, Matt's ask) -- optional, defaults to false
    // for the normal dismiss-on-close path (a season/upgrade item just
    // shown should still fall into "Recently Opened", same as always).
    // Clear (see _rcClearAllNotifications below) passes true instead, so it
    // wipes the ENTIRE stored history rather than just prepending to it --
    // that's the only way a stale history item with nothing newer to push
    // it off its 5-slot cap ever actually goes away. When true, this runs
    // even with nothing currently active, since there's nothing to dismiss
    // but still a history to clear.
    function _rcDismissShownSeasonNotifs(clearHistory) {
      var shownSeason = currentNotifications.filter(function (n) { return n.kind === 'season'; });
      // 'welcome' swept in alongside 'upgrade' (2026-09-19) -- both are
      // targeted, notificationId-keyed rows dismissed the exact same way
      // server-side (see handleDismissNotifications, DataCache.gs).
      // 'results_preliminary'/'results_official' (2026-09-24) join the
      // same bucket -- also notificationId-keyed, also dismissed on close.
      var shownUpgrade = currentNotifications.filter(function (n) {
        return n.kind === 'upgrade' || n.kind === 'welcome' || n.kind === 'results_preliminary' || n.kind === 'results_official';
      });
      if (!shownSeason.length && !shownUpgrade.length && !clearHistory) return;
      var seasonIds = shownSeason.map(function (n) { return n.seasonId; });
      var notificationIds = shownUpgrade.map(function (n) { return n.notificationId; });
      currentNotifications = currentNotifications.filter(function (n) { return _RC_NOTIF_DISMISS_KINDS_.indexOf(n.kind) === -1; });
      var newHistory = shownSeason.map(function (n) {
        return { message: n.message.replace('is open for', 'opened for'), dateStamp: n.dateStamp };
      }).concat(shownUpgrade.map(function (n) {
        return { message: n.message, dateStamp: n.dateStamp };
      }));
      currentNotifHistory = clearHistory ? newHistory.slice(0, 5) : newHistory.concat(currentNotifHistory).slice(0, 5);
      updateHeaderNotifDot(currentNotifications.length);
      var body = { seasonIds: JSON.stringify(seasonIds), notificationIds: JSON.stringify(notificationIds) };
      if (clearHistory) body.clearHistory = '1';
      fetchApi('dismissNotifications', { method: 'POST', token: token, body: body })
        .catch(function () { /* fire-and-forget -- already reflected on screen either way */ });
    }

    // "Clear" (2026-09-01, Matt's call) -- acknowledges/dismisses
    // EVERYTHING currently showing at once, regardless of kind: the
    // OK-ackable types (pending-approval, sponsors) get their ids written
    // to the client-side ack list same as clicking each OK button by hand,
    // and any season/upgrade items go through the exact same
    // dismiss-and-move-to-history path _rcDismissShownSeasonNotifs already
    // uses on close. Leaves the dropdown open (clearing isn't the same
    // gesture as closing) so the driver sees the empty state right away.
    //
    // 2026-09-02 fix: also wipes "Recently Opened" history (pass true) --
    // Clear is meant to actually empty the dropdown, and a stale
    // already-dismissed item with nothing newer to bump it off its 5-slot
    // cap was sitting there indefinitely with no way to get rid of it.
    function _rcClearAllNotifications() {
      currentNotifications.filter(function (n) { return _RC_NOTIF_DISMISS_KINDS_.indexOf(n.kind) === -1; })
        .forEach(function (n) { _rcAckNotif(n.id); });
      currentNotifications = currentNotifications.filter(function (n) { return _RC_NOTIF_DISMISS_KINDS_.indexOf(n.kind) !== -1; });
      currentNotifHistory = [];
      _rcRenderNotifList();
      updateHeaderNotifDot(currentNotifications.length);
      _rcDismissShownSeasonNotifs(true);
      _rcRenderNotifList();
      updateHeaderNotifDot(currentNotifications.length);
    }
    var clearAllBtn = document.getElementById('rc-header-notif-clear');
    if (clearAllBtn) clearAllBtn.addEventListener('click', function (evt) { evt.stopPropagation(); _rcClearAllNotifications(); });

    // Exposes a way for code OUTSIDE this render (Account.html's
    // registration/sponsor flows) to dismiss one season's notification, or
    // force an immediate re-fetch of everything, even if the bell was
    // never opened -- see rcDismissSeasonNotification() and
    // rcRefreshNotificationsNow() above/below. The immediate refresh
    // matters for the sponsors notification specifically: it's derived
    // live off getMySponsors, so without an explicit nudge here it would
    // otherwise only clear itself on the next 45s poll tick after a driver
    // actually picks their sponsors.
    _rcNotifController = {
      dismissSeason: function (seasonId) {
        var match = currentNotifications.filter(function (n) { return n.kind === 'season' && n.seasonId === seasonId; })[0];
        if (!match) return; // already dismissed, or never showed for this driver
        currentNotifications = currentNotifications.filter(function (n) { return n !== match; });
        currentNotifHistory = [{ message: match.message.replace('is open for', 'opened for'), dateStamp: match.dateStamp }].concat(currentNotifHistory).slice(0, 5);
        _rcRenderNotifList();
        updateHeaderNotifDot(currentNotifications.length);
        fetchApi('dismissNotifications', { method: 'POST', token: token, body: { seasonIds: JSON.stringify([seasonId]) } })
          .catch(function () {});
      },
      refresh: function () { return _rcRefreshNotifications(); }
    };

    // Named so both the initial load AND the poll interval below call the
    // exact same fetch-and-render path -- a poll tick is just this run
    // again, nothing bespoke. Re-renders the list even if the dropdown is
    // currently open (rare -- a driver rarely leaves it open 45+ seconds --
    // and matches how a freshly-arrived item should just appear).
    function _rcRefreshNotifications() {
      // No more admin-approval-queue fetch here (2026-09-19, Matt's call).
      // Sponsor notifications were dropped earlier, 2026-09-17 -- V1 scope
      // cut, Sponsorship system out of the site. See season-1-mvp-scope.md.
      return _rcFetchSeasonNotifications(token, cached).then(function (season) {
        season = season || { active: [], history: [] };
        currentNotifications = season.active;
        currentNotifHistory = season.history;
        _rcRenderNotifList();
        // Also corrects the count cache with the real value (see
        // updateHeaderNotifDot) -- overwrites the guess the bell was
        // painted with right after mount.innerHTML above.
        updateHeaderNotifDot(currentNotifications.length);
      });
    }

    _rcRefreshNotifications();

    if (_rcNotifPollTimer) clearInterval(_rcNotifPollTimer);
    _rcNotifPollTimer = setInterval(_rcRefreshNotifications, RC_NOTIF_POLL_MS);
  } else {
    _rcNotifController = null;
    if (_rcNotifPollTimer) { clearInterval(_rcNotifPollTimer); _rcNotifPollTimer = null; }
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
