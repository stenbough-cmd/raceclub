/*
  Race Club — js/auth.js  (v0.2.5, GitHub Pages edition)

  WHAT CHANGED VS. THE GOOGLE SITES VERSION:
  The source file kept its session token in localStorage because that was
  the only way to persist state across views WITHIN one sandboxed embed
  iframe. Now that every page is served from the same GitHub Pages origin,
  localStorage works exactly the way it normally would across separate
  pages — a token saved by login.html is visible to Account.html on the
  next navigation, no special-casing required. This file centralizes the
  token helpers and the 30-minute inactivity auto-logout timer so every
  page uses the exact same logic instead of copy-pasting it.

  NAVIGATION NOTE: since the token now persists reliably across real page
  loads, the "carry the username to verify.html" step (register/login ->
  verify) uses sessionStorage (see js reference in register.html/login.html/
  verify.html) rather than an in-memory JS variable — that only survives
  within one page's lifetime, and verify.html is a separate page load.
*/

var TOKEN_KEY = 'raceclub_token';
var PROFILE_CACHE_KEY = 'raceclub_profile_cache';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PROFILE_CACHE_KEY);
}

// ---------------------------------------------------------------------
// LIGHTWEIGHT PROFILE CACHE — lets the shared header (js/header.js) show
// the driver's avatar/initials on every page without an extra Apps
// Script round-trip on every single page load (which would add real
// latency given Apps Script's cold-start cost). Whenever a page already
// has a fresh profile payload anyway -- login.html's login response,
// Account.html's getProfile call -- it calls setProfileCache() so any
// OTHER page's header can read it back instantly. Only a few small
// fields are kept (not the whole payload) since this is just for
// rendering the header, not a source of truth for anything else.
// ---------------------------------------------------------------------
// Takes the flattened profile object itself (buildProfilePayload's shape
// server-side -- {displayName, role, ...}), NOT a raw fetchApi() response
// wrapper. Callers with a wrapper (login's {success, token, profile},
// getProfile's {success, profile}) must pass the nested .profile through,
// not the wrapper itself -- a bug fixed this pass (both call sites were
// passing the wrapper, which meant every field read back out as blank).
function setProfileCache(profile) {
  profile = profile || {};
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
      displayName: profile.displayName || '',
      role: profile.role || ''
    }));
  } catch (err) { /* storage full/unavailable -- header just falls back to '?' */ }
}

function getProfileCache() {
  try {
    var raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

// Call at the top of any page that requires a logged-in user (Account.html).
// Redirects to login.html immediately if no token is saved. Returns the
// token if present, so the caller can go straight on to load the profile.
function redirectIfNoToken() {
  var token = getToken();
  if (!token) {
    window.location.href = 'login.html';
    return null;
  }
  return token;
}

// ---------------------------------------------------------------------
// INACTIVITY AUTO-LOGOUT — 30 minutes of no mouse/keyboard/touch activity
// logs the user out and sends them back to login.html with an explanation.
// This is a client-side idle timer, separate from the session token's own
// server-side expiry (7 days) -- the token stays valid that whole time,
// this just stops trusting an inactive browser tab with it. Ported
// verbatim from the source file's behavior, just relocated here so
// Account.html can call one function instead of repeating this block.
// ---------------------------------------------------------------------
var INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
var _inactivityTimer = null;

function _handleInactivityTimeout() {
  var token = getToken();
  if (!token) return; // nobody logged in -- nothing to do
  fetchApi('logout', { method: 'POST', token: token }).catch(function () {});
  clearToken();
  sessionStorage.setItem('raceclub_login_message', 'You were logged out after 30 minutes of inactivity — please log in again.');
  window.location.href = 'login.html';
}

function resetInactivityTimer() {
  if (_inactivityTimer) clearTimeout(_inactivityTimer);
  _inactivityTimer = setTimeout(_handleInactivityTimeout, INACTIVITY_LIMIT_MS);
}

// Call once on any authenticated page (Account.html) to start the idle
// timer and wire up the activity listeners that reset it.
function startInactivityWatcher() {
  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(function (evt) {
    window.addEventListener(evt, resetInactivityTimer, { passive: true });
  });
  resetInactivityTimer();
}
