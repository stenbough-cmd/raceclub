// Race Club -- give the STAGED (demo) League Hub stories a track photo.
// Usage:   node tools/add-staged-photos.js path/to/website/staged/hub.json
// Opens that file, and for every Race Story / Season Finale without a photo picks a random one from assets/tracks/tracks.json
// (the list made by tools/make-track-index.js) for the story's track, then adds photoFile and photoCaption (the long track name
// and country). Stories that already have a photo keep it. Season Previews get none. The file is saved in place.
// The long names below are only for these demo stories; real stories get theirs from the Tracks tab in Sheets.
var fs = require('fs'), path = require('path');
var file = process.argv[2];
if (!file) { console.error('Usage: node tools/add-staged-photos.js path/to/website/staged/hub.json'); process.exit(1); }
var tracksFile = process.argv[3] || path.join(__dirname, '..', 'assets', 'tracks', 'tracks.json');
var manifest = JSON.parse(fs.readFileSync(tracksFile, 'utf8'));
var LONG = {
  'bahrain': 'Bahrain International Circuit, Bahrain', 'catalunya': 'Circuit de Barcelona-Catalunya, Spain', 'cota': 'Circuit of the Americas, United States',
  'daytona': 'Daytona International Speedway, United States', 'fuji': 'Fuji Speedway, Japan', 'imola': 'Autodromo Enzo e Dino Ferrari, Italy',
  'interlagos': 'Autodromo Jose Carlos Pace, Brazil', 'laguna seca': 'WeatherTech Raceway Laguna Seca, United States', 'le mans': 'Circuit de la Sarthe, France',
  'long beach': 'Streets of Long Beach Circuit, United States', 'lusail': 'Lusail International Circuit, Qatar', 'monza': 'Autodromo Nazionale Monza, Italy',
  'paul ricard': 'Circuit Paul Ricard, France', 'portimao': 'Autodromo Internacional do Algarve, Portugal', 'road atlanta': 'Michelin Raceway Road Atlanta, United States',
  'sebring': 'Sebring International Raceway, United States', 'silverstone': 'Silverstone Circuit, United Kingdom', 'spa': 'Circuit de Spa-Francorchamps, Belgium'
};
var plain = function (t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase(); };
var raw = fs.readFileSync(file, 'utf8');
var hub = JSON.parse(raw);
var indent = /^\{\n/.test(raw) ? 1 : 0;
var added = 0, skipped = [];
(hub.news || []).forEach(function (n) {
  if (!n.isStory || n.storyKind === 'preview' || n.photoFile) return;
  var key = plain(n.shortName);
  var folder = Object.keys(manifest).filter(function (k) { return plain(k) === key; })[0];
  if (!folder || !manifest[folder].length) { skipped.push(n.shortName || '(no track)'); return; }
  n.photoFile = folder + '/' + manifest[folder][Math.floor(Math.random() * manifest[folder].length)];
  n.photoCaption = LONG[plain(folder)] || '';
  added++;
});
fs.writeFileSync(file, indent ? JSON.stringify(hub, null, 1) : JSON.stringify(hub));
console.log('Photos added to ' + added + ' staged stor' + (added === 1 ? 'y' : 'ies') + (skipped.length ? '; no photo folder for: ' + skipped.join(', ') : '') + '.');
