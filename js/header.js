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
  - Logged out: just "REGISTER/LOGIN", same single link to login.html as
    before, HOME's separator gone with it.
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

  NOTIFICATION BELL (this pass, replaces the old avatar-corner dot): a
  standalone bell icon now sits to the LEFT of the avatar, with its own
  dropdown and its own Apple-style red dot -- the dot used to live in the
  avatar's own corner, which conflated "there's something to react to"
  with "here's your account menu," two unrelated ideas. Clicking the bell
  opens a list of notifications, each with an OK button that acknowledges
  it (removes it from the list and clears the dot once none remain).
  There's no real notifications table in the backend yet, so
  acknowledgement is tracked client-side, per browser, in localStorage
  (RC_NOTIF_ACK_KEY) -- acknowledging on one device doesn't clear it on
  another, which is a real limitation worth a proper backend notifications
  table later, but is fine for the one notification type that exists
  right now. That one type is unchanged from before: "an account is
  waiting on your approval," admin-only, sourced from
  adminListPendingAccounts. _rcFetchNotifications() is written as a list
  builder specifically so more notification types can be appended later
  without reworking the bell UI itself. This also drops the old
  opts.skipNotifCheck escape hatch -- it existed so Account.html's Admin
  section wouldn't trigger a second redundant adminListPendingAccounts
  call, but that section is still just a placeholder with no fetch of its
  own, so the flag was actually just silently preventing the dot from
  ever showing on Account.html. Every renderHeader() call now fetches its
  own notifications; Account.html's three call sites were updated to stop
  passing it.

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

  NEW-SEASON NOTIFICATIONS (2026-08-30, Matt's ask): a second notification
  type now feeds the same bell, this one backed by a real server-side
  Notifications sheet + each driver's own NotificationState (unlike the
  client-side-only localStorage acknowledgement the pending-approval type
  above still uses) -- see handleGetNotifications/handleDismissNotifications
  in DataCache.gs. Fires the moment a season actually becomes open for
  registration; visible to Driver role and above (Prospects have nothing to
  register for yet, same gate the Registration Status/Current Seat dashboard
  cards already use). Each item shows a date stamp and has NO OK button --
  unlike the pending-approval type, it dismisses itself automatically once
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
  newest at the bottom, each auto-dismisses after `durationMs` (default
  4200ms) or on its own close (x) click. See the .rc-toast* rules in
  style.css. NOTE: a message that comes bundled with its own follow-up
  action -- login.html's "Resend verification email" button,
  register.html's EMAIL_TAKEN "Log in with that account" panel -- keeps
  its explanatory text inline next to that button rather than moving to a
  toast, since a toast that auto-dismisses in a few seconds is the wrong
  home for text a driver needs to still be reading when they click the
  button below it. Everything else (plain success/failure results with no
  attached action) now goes through showToast.
*/
var RC_HEADER_HEIGHT = 72;
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

function showToast(message, type, durationMs) {
  if (!message) return;
  type = (type === 'success' || type === 'error') ? type : 'info';
  durationMs = durationMs || 4200;

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

function _rcHeaderInitials(name) {
  var parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// The bell's Apple-style red dot -- shown whenever there's at least one
// unacknowledged notification.
function updateHeaderNotifDot(hasPending) {
  var dot = document.getElementById('rc-header-bell-dot');
  if (dot) dot.style.display = hasPending ? 'block' : 'none';
}

// ---------------------------------------------------------------------
// NOTIFICATION BELL -- see the header comment above for the full
// rationale. Acknowledgement is tracked client-side (no backend
// notifications table exists yet), keyed by notification id, so an
// acknowledged item stays acknowledged across reloads on THIS browser.
// ---------------------------------------------------------------------
var RC_NOTIF_ACK_KEY = 'raceclub_acknowledged_notifs';

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

// Builds the current notification list. Written as a list-builder (not
// inlined into renderHeader) specifically so more notification types can
// be appended here later -- e.g. concat more fetches together -- without
// touching the bell's rendering/wiring code at all. Right now the only
// type that exists is "an account is waiting on your approval" (admin
// only), unchanged in source from the old avatar-corner dot.
function _rcFetchNotifications(token, cached) {
  if (!cached || (cached.role !== 'Admin' && cached.role !== 'Organizer')) return Promise.resolve([]);
  return fetchApi('adminListPendingAccounts', { token: token })
    .then(function (data) {
      if (!data.success) return [];
      var acked = _rcGetAckedNotifIds();
      return (data.pending || [])
        .map(function (u) {
          return {
            id: 'pending-' + u.ProfileID,
            message: (u.DisplayName || 'A driver') + ' is waiting for account approval.'
          };
        })
        .filter(function (n) { return acked.indexOf(n.id) === -1; });
    })
    .catch(function () { return []; });
}

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
  return fetchApi('getNotifications', { token: token })
    .then(function (data) {
      if (!data || !data.success) return { active: [], history: [] };
      var active = (data.active || []).map(function (n) {
        if (n.kind === 'upgrade') {
          return {
            id: 'upgrade-' + n.notificationId, notificationId: n.notificationId, kind: 'upgrade',
            message: n.message,
            dateStamp: _rcFormatNotifDate(n.createdAt)
          };
        }
        return {
          id: 'season-' + n.seasonId, seasonId: n.seasonId, kind: 'season',
          message: 'Registration is open for ' + (n.seasonName || 'a new season') + '.',
          dateStamp: _rcFormatNotifDate(n.createdAt)
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
      '<img class="rc-header-logo" src="assets/race-club-header-logo.png" alt="Race Club">' +
    '</a><nav class="rc-header-nav"></nav>';
}

// opts.skipNotifCheck: Account.html passes this since its own Admin
// section (approvalQueueSection) already fetches the pending-approvals
// list for the sidebar's nav dot -- without this flag, an admin loading
// Account.html would trigger TWO separate adminListPendingAccounts calls
// for the exact same data (one from here, one from there), which was
// part of what made things feel slow. Account.html calls
// updateHeaderNotifDot() itself once its own fetch resolves instead.
//
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
            '<img class="rc-header-logo" src="assets/race-club-header-logo.png" alt="Race Club">' +
          '</a>';
  html += '<nav class="rc-header-nav">';
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
              '<span class="rc-header-bell-icon-wrap">' +
                '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>' +
                '<span class="rc-notif-dot" id="rc-header-bell-dot" style="display:none;"></span>' +
              '</span>' +
            '</button>' +
            '<div class="rc-header-notif-menu" id="rc-header-notif-menu" style="display:none;">' +
              '<div class="rc-header-notif-head">Notifications</div>' +
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
                '<span class="rc-header-account-role">' + escapeHtmlHeader_(role) + '</span>' +
              '</span>' +
              '<svg class="rc-header-account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
            '</button>' +
            '<div class="rc-header-account-menu" id="rc-header-account-menu" style="display:none;">' +
              '<a class="rc-header-menu-item" href="Account.html">Dashboard</a>' +
              '<button type="button" class="rc-header-menu-item" id="rc-header-menu-editprofile">Edit Profile</button>' +
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
    document.addEventListener('click', function (evt) {
      if (menu.style.display === 'block' && !menu.contains(evt.target) && !toggle.contains(evt.target)) closeAccountMenu();
      if (notifMenu.style.display === 'block' && !notifMenu.contains(evt.target) && !bellToggle.contains(evt.target)) closeNotifMenu();
    });
    document.addEventListener('keydown', function (evt) {
      if (evt.key !== 'Escape') return;
      if (menu.style.display === 'block') closeAccountMenu();
      if (notifMenu.style.display === 'block') closeNotifMenu();
    });

    // Both dropdowns also close the instant the pointer leaves BOTH their
    // toggle button and their own menu, not just on an outside click --
    // see the header comment above and _rcWireHoverAwayClose's own
    // comment for why. Opening is still click-only for both; this only
    // ever closes them early.
    _rcWireHoverAwayClose([toggle, menu], closeAccountMenu);
    _rcWireHoverAwayClose([bellToggle, notifMenu], closeNotifMenu);

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
      if (typeof window.rcOpenEditProfileModal === 'function') {
        window.rcOpenEditProfileModal();
      } else {
        sessionStorage.setItem('raceclub_open_edit_profile', '1');
        window.location.href = 'Account.html';
      }
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
    // OK-button handlers (pending-approval type) and the dismiss-on-close
    // flow (season + upgrade types, see closeNotifMenu above) can mutate
    // and re-render them. Three notification kinds share this one list
    // now: 'pending' (admin-only, client-side ack, unchanged from before
    // this pass), 'season' (Driver+, server-side dismiss, added
    // 2026-08-30), and 'upgrade' (any account whose Status/Role just
    // increased, server-side dismiss, also added 2026-08-30 -- see
    // handleGetNotifications/createAccountUpgradeNotification_ in
    // DataCache.gs).
    // ---------------------------------------------------------------
    var currentNotifications = [];
    var currentNotifHistory = [];

    function _rcRenderNotifList() {
      var listEl = document.getElementById('rc-header-notif-list');
      if (!listEl) return;
      listEl.innerHTML = '';
      if (currentNotifications.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'rc-header-notif-empty';
        empty.textContent = "You're all caught up.";
        listEl.appendChild(empty);
      } else {
        currentNotifications.forEach(function (n) {
          var item = document.createElement('div');
          item.className = 'rc-header-notif-item';
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
          // Only the pending-approval type gets an OK button -- season AND
          // upgrade notifications both dismiss themselves when this
          // dropdown closes (see closeNotifMenu/_rcDismissShownSeasonNotifs
          // above), neither is ever acknowledged by hand.
          if (n.kind !== 'season' && n.kind !== 'upgrade') {
            var okBtn = document.createElement('button');
            okBtn.type = 'button';
            okBtn.className = 'rc-header-notif-ok';
            okBtn.textContent = 'OK';
            okBtn.addEventListener('click', function () {
              _rcAckNotif(n.id);
              currentNotifications = currentNotifications.filter(function (x) { return x.id !== n.id; });
              _rcRenderNotifList();
              updateHeaderNotifDot(currentNotifications.length > 0);
            });
            item.appendChild(okBtn);
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
    function _rcDismissShownSeasonNotifs() {
      var shownSeason = currentNotifications.filter(function (n) { return n.kind === 'season'; });
      var shownUpgrade = currentNotifications.filter(function (n) { return n.kind === 'upgrade'; });
      if (!shownSeason.length && !shownUpgrade.length) return;
      var seasonIds = shownSeason.map(function (n) { return n.seasonId; });
      var notificationIds = shownUpgrade.map(function (n) { return n.notificationId; });
      currentNotifications = currentNotifications.filter(function (n) { return n.kind !== 'season' && n.kind !== 'upgrade'; });
      var newHistory = shownSeason.map(function (n) {
        return { message: n.message.replace('is open for', 'opened for'), dateStamp: n.dateStamp };
      }).concat(shownUpgrade.map(function (n) {
        return { message: n.message, dateStamp: n.dateStamp };
      }));
      currentNotifHistory = newHistory.concat(currentNotifHistory).slice(0, 5);
      updateHeaderNotifDot(currentNotifications.length > 0);
      fetchApi('dismissNotifications', { method: 'POST', token: token, body: { seasonIds: JSON.stringify(seasonIds), notificationIds: JSON.stringify(notificationIds) } })
        .catch(function () { /* fire-and-forget -- already reflected on screen either way */ });
    }

    // Exposes a way for code OUTSIDE this render (Account.html's
    // registration flow) to dismiss one season's notification the instant
    // a driver registers, even if the bell was never opened -- see
    // rcDismissSeasonNotification() above.
    _rcNotifController = {
      dismissSeason: function (seasonId) {
        var match = currentNotifications.filter(function (n) { return n.kind === 'season' && n.seasonId === seasonId; })[0];
        if (!match) return; // already dismissed, or never showed for this driver
        currentNotifications = currentNotifications.filter(function (n) { return n !== match; });
        currentNotifHistory = [{ message: match.message.replace('is open for', 'opened for'), dateStamp: match.dateStamp }].concat(currentNotifHistory).slice(0, 5);
        _rcRenderNotifList();
        updateHeaderNotifDot(currentNotifications.length > 0);
        fetchApi('dismissNotifications', { method: 'POST', token: token, body: { seasonIds: JSON.stringify([seasonId]) } })
          .catch(function () {});
      }
    };

    // Named so both the initial load AND the poll interval below call the
    // exact same fetch-and-render path -- a poll tick is just this run
    // again, nothing bespoke. Re-renders the list even if the dropdown is
    // currently open (rare -- a driver rarely leaves it open 45+ seconds --
    // and matches how a freshly-arrived item should just appear).
    function _rcRefreshNotifications() {
      return Promise.all([
        _rcFetchNotifications(token, cached),
        _rcFetchSeasonNotifications(token, cached)
      ]).then(function (results) {
        var pending = results[0] || [];
        var season = results[1] || { active: [], history: [] };
        currentNotifications = pending.concat(season.active);
        currentNotifHistory = season.history;
        _rcRenderNotifList();
        updateHeaderNotifDot(currentNotifications.length > 0);
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
