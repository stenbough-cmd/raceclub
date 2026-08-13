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
  Right side (Oswald nav text):
    - Logged out (no getToken()):  "HOME · LOGIN/REGISTER"
    - Logged in (getToken()):      "ACCOUNT" with a dropdown revealing
      "PROFILE" and "LOGOUT". The dropdown opens on hover (desktop) AND on
      click (so it also works on touch/mobile, which can't hover) -- see
      the click handler below plus the `:hover` CSS fallback in
      css/style.css.

  Logout uses the exact same fire-and-forget pattern as profile.html's
  sidebar Log Out button: call the logout API action, ignore whether it
  succeeds, always clear the local token and redirect.
*/
var RC_HEADER_HEIGHT = 72;

function renderHeader() {
  var mount = document.getElementById('rc-header');
  if (!mount) return;

  var token = (typeof getToken === 'function') ? getToken() : null;
  mount.className = 'rc-fixed-header';

  var html = '';
  html += '<a class="rc-header-logo-link" href="index.html">' +
            '<img class="rc-header-logo" src="assets/race-club-header-logo.png" alt="Race Club">' +
          '</a>';
  html += '<nav class="rc-header-nav">';
  if (token) {
    html += '<div class="rc-header-account" id="rc-header-account">' +
              '<button type="button" class="rc-header-link rc-header-account-toggle" id="rc-header-account-toggle">ACCOUNT</button>' +
              '<div class="rc-header-dropdown" id="rc-header-dropdown">' +
                '<a href="profile.html">PROFILE</a>' +
                '<button type="button" id="rc-header-logout">LOGOUT</button>' +
              '</div>' +
            '</div>';
  } else {
    html += '<a class="rc-header-link" href="index.html">HOME</a>' +
            '<span class="rc-header-sep">&middot;</span>' +
            '<a class="rc-header-link" href="login.html">LOGIN/REGISTER</a>';
  }
  html += '</nav>';

  mount.innerHTML = html;

  if (token) {
    var accountWrap = document.getElementById('rc-header-account');
    var toggle = document.getElementById('rc-header-account-toggle');

    // Click-to-toggle (works on touch/mobile, where :hover doesn't fire).
    toggle.addEventListener('click', function (evt) {
      evt.stopPropagation();
      accountWrap.classList.toggle('rc-header-dropdown-open');
    });
    // Click anywhere else closes it.
    document.addEventListener('click', function (evt) {
      if (!accountWrap.contains(evt.target)) {
        accountWrap.classList.remove('rc-header-dropdown-open');
      }
    });

    document.getElementById('rc-header-logout').addEventListener('click', function () {
      fetchApi('logout', { method: 'POST', token: token }).catch(function () {}).finally(function () {
        clearToken();
        window.location.href = 'index.html';
      });
    });
  }
}
