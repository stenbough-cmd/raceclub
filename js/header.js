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
    straight to Account.html on click. The dropdown itself now only has
    Logout in it (Edit Profile was removed from the dropdown -- Edit
    Profile is reached via the popup on Account.html's sidebar instead).

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
  stack falls back to blank/"Driver".

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
  The Apple-style red notification dot in the avatar's corner is
  admin-only, and means "there are pending account approvals waiting on
  you" -- the one notification type that exists right now. It's NOT read
  from the cache (that would go stale) -- once the avatar renders, if the
  cached role is Admin, this file fires a background
  adminListPendingAccounts call and adds the dot only if the total is > 0.
  This never blocks the header from rendering; it's a background
  enhancement.

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

// Lets a page that already has the pending-approvals count (right now
// that's just Account.html's Admin section) push it straight to the
// header dot instead of the header firing its own redundant fetch for
// the exact same data -- see the skipNotifCheck option below.
function updateHeaderNotifDot(hasPending) {
  var dot = document.getElementById('rc-header-notif-dot');
  if (dot) dot.style.display = hasPending ? 'block' : 'none';
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
    // The whole avatar/name/role/chevron cluster is now ONE clickable
    // toggle button -- clicking anywhere in it opens/closes the dropdown,
    // which no longer navigates to Account.html directly (see header
    // comment above for why). MY ACCOUNT restores a one-click path back to
    // the account/dashboard page from anywhere on the site, sitting above
    // Logout in the dropdown itself.
    html += '<button type="button" class="rc-header-account-toggle" id="rc-header-account-toggle" aria-haspopup="true" aria-expanded="false" aria-label="Account menu">' +
              '<span class="rc-header-avatar">' + initials + '<span class="rc-notif-dot" id="rc-header-notif-dot" style="display:none;"></span></span>' +
              '<span class="rc-header-account-text">' +
                '<span class="rc-header-account-name">' + escapeHtmlHeader_(displayName).toUpperCase() + '</span>' +
                '<span class="rc-header-account-role">' + escapeHtmlHeader_(role) + '</span>' +
              '</span>' +
              '<svg class="rc-header-account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
            '</button>' +
            '<div class="rc-header-account-menu" id="rc-header-account-menu" style="display:none;">' +
              '<a class="rc-header-menu-item" href="Account.html">My Account</a>' +
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

    function closeMenu() {
      menu.style.display = 'none';
      toggle.setAttribute('aria-expanded', 'false');
    }
    function openMenu() {
      menu.style.display = 'block';
      toggle.setAttribute('aria-expanded', 'true');
    }
    toggle.addEventListener('click', function (evt) {
      evt.stopPropagation();
      if (menu.style.display === 'block') closeMenu(); else openMenu();
    });
    document.addEventListener('click', function (evt) {
      if (menu.style.display !== 'block') return;
      if (menu.contains(evt.target) || toggle.contains(evt.target)) return;
      closeMenu();
    });
    document.addEventListener('keydown', function (evt) {
      if (evt.key === 'Escape' && menu.style.display === 'block') closeMenu();
    });

    // Same fire-and-forget logout pattern as Account.html's sidebar Log
    // Out button: clear the local token and redirect immediately, fire
    // the API call without waiting on it.
    document.getElementById('rc-header-menu-logout').addEventListener('click', function () {
      fetchApi('logout', { method: 'POST', token: token }).catch(function () {});
      clearToken();
      window.location.href = 'login.html';
    });

    // Background-only: never blocks the header from rendering, and only
    // fires for admins (everyone else has nothing to be notified about
    // yet -- pending account approval is the only notification type that
    // exists right now). Skipped when the page says it'll report the
    // count itself (see updateHeaderNotifDot above).
    if (!opts.skipNotifCheck && cached && cached.role === 'Admin') {
      fetchApi('adminListPendingAccounts', { token: token })
        .then(function (data) {
          if (!data.success) return;
          updateHeaderNotifDot((data.pending || []).length > 0);
        })
        .catch(function () { /* silent -- this is a background enhancement, not critical */ });
    }
  }
}

function escapeHtmlHeader_(str) {
  var d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
