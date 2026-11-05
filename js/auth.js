// Race Club — js/auth.js (v0.2.5, GitHub Pages edition)
// WHAT CHANGED VS. THE GOOGLE SITES VERSION: The source file kept its session token in localStorage
// because that was the only way to persist state across views WITHIN one sandboxed embed iframe.

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

// Notification cache (setNotifCache/getNotifCache/NOTIF_CACHE_KEY) removed in full.

// ---------------------------------------------------------------------
// LIGHTWEIGHT PROFILE CACHE — lets the shared header (js/header.js) show the driver's
// avatar/initials on every page without an extra Apps Script round-trip on every single page load
// (which would add real latency given Apps Script's cold-start cost).
// ---------------------------------------------------------------------
// Takes the flattened profile object itself (buildProfilePayload's shape server-side --
// {displayName, role, ...}), NOT a raw fetchApi() response wrapper.
function setProfileCache(profile) {
  profile = profile || {};
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
      profileId: profile.profileId || '',
      displayName: profile.displayName || '',
      role: profile.role || '',
      // Blank/absent means "no avatar chosen," same as Account.html's own buildAvatarCircle()
      // convention.
      avatarFilename: profile.avatarFilename || ''
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

// Call at the top of any page that requires a logged-in user (Account.html). Redirects to
// login.html immediately if no token is saved.
function redirectIfNoToken() {
  var token = getToken();
  if (!token) {
    window.location.href = 'login.html';
    return null;
  }
  return token;
}
