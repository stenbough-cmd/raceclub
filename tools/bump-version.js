// Race Club -- bump the site-wide version number.
// Usage (from the site folder, in Terminal):   node tools/bump-version.js 0.9.1
// It rewrites js/version.js and the "?v=" on every local <script src> / <link href> in every .html file,
// so browsers fetch fresh copies of every file after you publish. Run it once per release, before git commit.
var fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..');
var v = process.argv[2];
if (!v || !/^[0-9A-Za-z._-]+$/.test(v)) { console.error('Usage: node tools/bump-version.js 0.9.1'); process.exit(1); }
var vf = path.join(root, 'js', 'version.js');
var src = fs.readFileSync(vf, 'utf8');
if (!/var RC_VERSION = '[^']*';/.test(src)) { console.error('js/version.js has no RC_VERSION line'); process.exit(1); }
fs.writeFileSync(vf, src.replace(/var RC_VERSION = '[^']*';/, "var RC_VERSION = '" + v + "';"));
var tag = /(<(?:script[^>]*?\ssrc|link[^>]*?\shref)=")((?:js|css)\/[A-Za-z0-9._-]+\.(?:js|css))(?:\?v=[^"]*)?(")/g;
var changed = 0;
fs.readdirSync(root).filter(function (f) { return /\.html$/.test(f); }).forEach(function (f) {
  var p = path.join(root, f), s = fs.readFileSync(p, 'utf8');
  var n = s.replace(tag, function (m, a, file, c) { changed++; return a + file + '?v=' + v + c; });
  if (n !== s) fs.writeFileSync(p, n);
});
console.log('Version is now ' + v + ' (' + changed + ' file tags updated in the .html pages).');
