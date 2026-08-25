/*
  Race Club — js/header.js  (v0.3.0)

  Shared fixed site header used on every page. Each page includes this
  file (after js/api.js and js/auth.js, both of which it depends on),
  puts an empty <div id="rc-header"></div> as the very first thing inside
  <body>, and calls renderHeader() in a small inline <script> right after
  that div. renderHeader() fills the div with the header markup and wires
  up its behavior -- it does not need to run on DOMContentLoaded since the
  div already exists by the time the inline script tag runs.

  Left side: the header wordmark (assets/race-club-header-logo.png),
  linking to index.html.
  Right side: HOME always shows first, logged in or not (it used to
  disappear entirely once a token existed, which left no way back to the
  landing page from the header -- fixed). After that:
    - Logged out (no getToken()):  "HOME · LOGIN/REGISTER"
    - Logged in (getToken()):      "HOME ·" + a small initials avatar,
      itself a plain link straight to Account.html. No dropdown -- there
      used to be one (PROFILE/LOGOUT), removed per Matt's call to keep the
      avatar's click behavior identical on every device instead of
      hover-on-desktop/tap-on-mobile needing to stay in sync. The site
      keeps a driver logged in via a long-lived token until it actually
      expires, so there's no real need for a quick Logout from every page
      -- it still lives in Account.html's own sidebar.

  AVATAR + NOTIFICATION DOT: the avatar's initials come from
  getProfileCache() (js/auth.js) -- a small cached copy of the last-known
  profile, written by login.html/Account.html whenever they have a fresh
  payload anyway, specifically so THIS file never has to make its own
  Apps Script round-trip just to render an avatar on every single page
  load (Apps Script's cold-start cost is real, see the login-latency
  history elsewhere in this project). If there's no cache yet (e.g. the
  token was set some other way), the avatar falls back to "?".

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
  admin-only, and means "there are pending account approvals/verifications
  waiting on you" -- the one notification type that exists right now. It's
  NOT read from the cache (that would go stale) -- once the avatar renders,
  if the cached role has the manageUsers permission, this file fires a
  background adminListPendingAccounts call and adds the dot only if the
  total is > 0. This never blocks the header from rendering; it's a
  background enhancement. See the matching dot on the Admin sidebar nav
  item in Account.html (renderAdminSection) for the same signal in-page.

  Logout uses the exact same fire-and-forget pattern as Account.html's
  sidebar Log Out button: call the logout API action, ignore whether it
  succeeds, always clear the local token and redirect.
*/
var RC_HEADER_HEIGHT = 72;

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
  // HOME now always shows, logged in or not -- only the item after the
  // separator changes (LOGIN/REGISTER vs. the ACCOUNT avatar). It used
  // to disappear entirely once a token existed, which meant there was no
  // way back to the landing page from the header while logged in.
  html += '<nav class="rc-header-nav">';
  html += '<a class="rc-header-link" href="index.html">HOME</a>' +
          '<span class="rc-header-sep">&middot;</span>';
  if (token) {
    var initials = _rcHeaderInitials(cached ? (cached.displayName || cached.username) : '');
    // No dropdown at all now, per Matt's call -- the avatar is just a
    // plain link straight to Account.html, same click behavior on every
    // device (no hover/touch distinction to worry about, no dead zones,
    // nothing to keep consistent between desktop and mobile). Logout no
    // longer has a header-level entry point on pages other than
    // Account.html -- Matt's reasoning: the site keeps you logged in via
    // a long-lived token until it actually expires, so quick access to
    // Logout from every page isn't really needed; it's still right there
    // in Account.html's own sidebar for the times it is.
    html += '<a class="rc-header-account-toggle" id="rc-header-account-toggle" href="Account.html" aria-label="Go to Account">' +
              '<span class="rc-header-avatar">' + initials + '<span class="rc-notif-dot" id="rc-header-notif-dot" style="display:none;"></span></span>' +
            '</a>';
  } else {
    html += '<a class="rc-header-link" href="login.html">LOGIN/REGISTER</a>';
  }
  html += '</nav>';

  mount.innerHTML = html;

  if (token) {
    // No dropdown/logout wiring here anymore -- the avatar is a plain
    // <a href="Account.html">, so clicking it just navigates like any
    // other link, nothing to attach a click handler to.

    // Background-only: never blocks the header from rendering, and only
    // fires for admins (everyone else has nothing to be notified about
    // yet -- pending account approval is the only notification type that
    // exists right now). Skipped when the page says it'll report the
    // count itself (see updateHeaderNotifDot above).
    var perms = cached ? (cached.permissions || []) : [];
    if (!opts.skipNotifCheck && perms.indexOf('manageUsers') !== -1) {
      fetchApi('adminListPendingAccounts', { token: token })
        .then(function (data) {
          if (!data.success) return;
          var total = data.organizerRequests.length + data.driverRequests.length + data.unverifiedSignups.length;
          updateHeaderNotifDot(total > 0);
        })
        .catch(function () { /* silent -- this is a background enhancement, not critical */ });
    }
  }
}
