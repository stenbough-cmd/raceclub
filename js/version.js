// Race Club -- the ONE site-wide version number.
// Every page loads this file first. Scripts that load other files while the page is running
// (header.js, helmet-avatar.js, championship-dashboard.js) add "?v=" + RC_VERSION to those files.
// Do NOT edit by hand: run  node tools/bump-version.js 0.9.1  from the site folder, which changes this number
// AND the "?v=" on every <script>/<link> tag in every .html file in one go.
var RC_VERSION = '0.9.1';
// rcAsset('js/helmet.js') -> 'js/helmet.js?v=0.9.0'. Used by scripts that load other files on demand.
function rcAsset(path) { return path + '?v=' + RC_VERSION; }
