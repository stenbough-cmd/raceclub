// Race Club -- rebuild the track photo list.
// Usage (from the site folder, in Terminal):   node tools/make-track-index.js
// Looks inside every folder of assets/tracks/ (one folder per track, named by the track's ShortName in Sheets,
// e.g. assets/tracks/spa/) and writes assets/tracks/tracks.json, which the story writers read to pick a random
// photo: {"spa": ["spa_056.jpg", "spa_057.jpg"]}. Run it every time you add or remove photos, BEFORE git commit.
var fs = require('fs'), path = require('path');
var dir = path.join(__dirname, '..', 'assets', 'tracks');
var out = {}, total = 0;
fs.readdirSync(dir).sort().forEach(function (name) {
  var p = path.join(dir, name);
  if (!fs.statSync(p).isDirectory() || name.charAt(0) === '.' || name.charAt(0) === '_') return;
  var files = fs.readdirSync(p).filter(function (f) { return /\.(jpe?g|png|webp)$/i.test(f); }).sort();
  if (files.length) { out[name] = files; total += files.length; }
});
fs.writeFileSync(path.join(dir, 'tracks.json'), JSON.stringify(out, null, 1) + '\n');
console.log('tracks.json written: ' + Object.keys(out).length + ' track folder(s), ' + total + ' photo(s).');
Object.keys(out).forEach(function (k) { console.log('  ' + k + ': ' + out[k].length); });
