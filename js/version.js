// Race Club -- the ONE site-wide version number.
// Every page loads this file first. Scripts that load other files while the page is running
// (header.js, helmet-avatar.js, championship-dashboard.js) add "?v=" + RC_VERSION to those files.
// Do NOT edit by hand: run  node tools/bump-version.js 0.9.1  from the site folder, which changes this number
// AND the "?v=" on every <script>/<link> tag in every .html file in one go.
var RC_VERSION = '0.9.7';
// rcAsset('js/helmet.js') -> 'js/helmet.js?v=0.9.0'. Used by scripts that load other files on demand.
function rcAsset(path) { return path + '?v=' + RC_VERSION; }

// rcLoadScript(src): load a script on demand, once. Returns a promise (shared by helmet-avatar.js and championship-dashboard.js).
var _rcScriptLoads = {};
function rcLoadScript(src) {
  if (!_rcScriptLoads[src]) {
    _rcScriptLoads[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = function () { resolve(); };
      s.onerror = function () { delete _rcScriptLoads[src]; reject(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }
  return _rcScriptLoads[src];
}

// rcEscapeHtml(value): the one HTML escaper for the whole site (text and attribute safe). Each page script keeps its own short
// name (esc, escapeHtml, _rccEsc ...) but they all call this.
function rcEscapeHtml(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
