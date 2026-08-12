/*
  Race Club — js/api.js  (v0.2.5, GitHub Pages edition)

  WHAT CHANGED VS. THE GOOGLE SITES VERSION:
  The old single-file embed (Login.html) declared API_BASE_URL once at the
  top of its one giant <script> block, because everything lived in one
  file. Now that login/register/verify/profile are real separate .html
  pages on the same origin, API_BASE_URL and the fetch helper live here in
  one shared file that every page loads via <script src="js/api.js">, so
  there's still only ONE place to paste the deployment URL, and no
  behavior is duplicated per page.

  The request pattern itself (action query param, token in the query
  string, text/plain POST body to dodge Apps Script's lack of CORS
  preflight support) is copied verbatim from the source file — see
  fetchApi() below.
*/

// ---- CONFIGURE THIS ONE LINE ----
// Paste your deployed Apps Script Web App URL here (Deploy > Manage
// deployments > Web app > URL). Every page on this site reads it from
// here — you only need to change it in this one place.
var API_BASE_URL = 'https://script.google.com/macros/s/PASTE_YOUR_DEPLOYMENT_ID/exec';
// ----------------------------------

// True when API_BASE_URL is still the placeholder above. Pages should
// check this and show a clear setup message instead of silently failing
// (same degrade-gracefully behavior as the source file).
function apiBaseUrlIsUnset() {
  return !API_BASE_URL || API_BASE_URL.indexOf('PASTE_YOUR') !== -1;
}

/**
 * fetchApi(action, options) -> Promise<Object>
 *
 * Wraps the fetch/text-plain/JSON pattern used throughout the source file.
 *   action:  string, e.g. 'login', 'getProfile', 'adminApproveAccount'
 *   options.method: 'GET' or 'POST' (default 'GET')
 *   options.token:  session token, appended to the URL query string
 *                   (never sent in the POST body — required by the API
 *                   contract).
 *   options.body:   plain object, JSON-stringified into the POST body.
 *
 * IMPORTANT: POST requests use Content-Type: text/plain;charset=utf-8, NOT
 * application/json. Apps Script Web Apps can't handle a CORS preflight
 * (OPTIONS) request, which application/json would trigger. text/plain
 * avoids the preflight; the server still parses the body as JSON
 * regardless of the declared content type. Do not change this.
 */
function fetchApi(action, options) {
  options = options || {};
  var method = options.method || 'GET';
  var url = API_BASE_URL + '?action=' + encodeURIComponent(action);
  if (options.token) url += '&token=' + encodeURIComponent(options.token);

  var fetchOpts = { method: method };
  if (method === 'POST') {
    fetchOpts.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
    fetchOpts.body = JSON.stringify(options.body || {});
  }

  return fetch(url, fetchOpts).then(function (res) { return res.json(); });
}
