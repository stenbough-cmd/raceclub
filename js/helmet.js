/* =====================================================================
   Race Club helmet renderer  (js/helmet.js)
   ---------------------------------------------------------------------
   Draws a driver's custom racing helmet onto a <canvas> from a small
   "recipe" (design + 3 colours + 3 finishes + visor + optional logos).
   No images are uploaded anywhere: every helmet is built in the browser
   from the fixed files in assets/helmets/engine/ plus one pattern PNG
   from assets/helmets/images/.

   Public API (window.RCHelmet):
     PALETTE, FINISHES, VISORS      -- the choices shown in the editor
     configure({ designs, logos })  -- which design slots / logo files exist
     defaultRecipe(), randomRecipe(), normalizeRecipe(r)
     render(recipe, { width })      -- Promise -> <canvas> (transparent background)
     mount(el, recipe, { width })   -- render and put the canvas inside el
   ===================================================================== */
(function () {
  'use strict';

  var ASSET_BASE = 'assets/helmets/';
  // The cropped area of the 1254x1254 source that contains the helmet (plus a few px of margin).
  var CROP = { x: 50, y: 102, w: 1152, h: 996 };

  // ---- the 16 colours (id -> hex) ------------------------------------------------------------
  var PALETTE = [
    { id: 'white',    name: 'Pearl White',    hex: '#f4f4f6' },
    { id: 'silver',   name: 'Silver',         hex: '#b8bec8' },
    { id: 'graphite', name: 'Graphite',       hex: '#3a3f48' },
    { id: 'black',    name: 'Black',          hex: '#14161a' },
    { id: 'red',      name: 'Racing Red',     hex: '#d4102a' },
    { id: 'maroon',   name: 'Maroon',         hex: '#7a1424' },
    { id: 'orange',   name: 'Orange',         hex: '#f26a1b' },
    { id: 'yellow',   name: 'Modena Yellow',  hex: '#ffd21f' },
    { id: 'lime',     name: 'Lime Green',     hex: '#8bd400' },
    { id: 'green',    name: 'British Racing Green', hex: '#0b5d3b' },
    { id: 'teal',     name: 'Teal',           hex: '#0e8f8a' },
    { id: 'sky',      name: 'Sky Blue',       hex: '#3aa0e8' },
    { id: 'blue',     name: 'Royal Blue',     hex: '#1d4ed8' },
    { id: 'navy',     name: 'Navy',           hex: '#14264f' },
    { id: 'purple',   name: 'Purple',         hex: '#6b2fb3' },
    { id: 'pink',     name: 'Hot Pink',       hex: '#e0338f' }
  ];

  var FINISHES = [
    { id: 'gloss',    name: 'Gloss' },
    { id: 'matte',    name: 'Matte' },
    { id: 'satin',    name: 'Satin' },
    { id: 'metallic', name: 'Metallic' },
    { id: 'pearl',    name: 'Pearl' },
    { id: 'candy',    name: 'Candy' },
    { id: 'carbon',   name: 'Carbon' }
  ];

  var VISORS = [
    { id: 'smoke', name: 'Smoke',       c1: '#3b424d', c2: '#0a0c10' },
    { id: 'clear', name: 'Clear',       c1: '#aebdc9', c2: '#4b5d6b' },
    { id: 'gold',  name: 'Gold',        c1: '#fcd34d', c2: '#92400e' },
    { id: 'blue',  name: 'Blue',        c1: '#5b9bff', c2: '#0b2a6b' },
    { id: 'green', name: 'Green',       c1: '#4ade80', c2: '#0f5132' }
  ];

  // how strongly the shared highlight layer shows on each finish
  var SPEC_K = { gloss: 1.0, matte: 0.2, satin: 0.6, metallic: 1.0, pearl: 1.0, candy: 1.1, carbon: 1.0 };

  // ---- basic shapes (drawn with code, no picture files) ---------------------------------------
  // Each path draws centred on 0,0 inside a w x h box.
  function poly(c, pts) { c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); }
  function rrect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  var SHAPES = [
    { id: 'rect', name: 'Rectangle', draw: function (c, w, h) { c.beginPath(); c.rect(-w / 2, -h / 2, w, h); c.fill(); } },
    { id: 'round', name: 'Rounded rectangle', draw: function (c, w, h) { rrect(c, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.25); c.fill(); } },
    { id: 'pill', name: 'Pill', draw: function (c, w, h) { rrect(c, -w / 2, -h / 2, w, h, Math.min(w, h) / 2); c.fill(); } },
    { id: 'circle', name: 'Circle / oval', draw: function (c, w, h) { c.beginPath(); c.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); c.fill(); } },
    { id: 'ring', name: 'Ring', draw: function (c, w, h) { c.beginPath(); c.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); c.ellipse(0, 0, w * 0.32, h * 0.32, 0, 0, Math.PI * 2, true); c.fill('evenodd'); } },
    { id: 'triangle', name: 'Triangle', draw: function (c, w, h) { poly(c, [[0, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]); c.fill(); } },
    { id: 'diamond', name: 'Diamond', draw: function (c, w, h) { poly(c, [[0, -h / 2], [w / 2, 0], [0, h / 2], [-w / 2, 0]]); c.fill(); } },
    { id: 'hexagon', name: 'Hexagon', draw: function (c, w, h) { poly(c, [[-w * 0.25, -h / 2], [w * 0.25, -h / 2], [w / 2, 0], [w * 0.25, h / 2], [-w * 0.25, h / 2], [-w / 2, 0]]); c.fill(); } },
    { id: 'star', name: 'Star', draw: function (c, w, h) {
        var pts = [], i; for (i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, k = (i % 2) ? 0.4 : 1; pts.push([Math.cos(a) * w / 2 * k, Math.sin(a) * h / 2 * k]); }
        poly(c, pts); c.fill(); } },
    { id: 'chevron', name: 'Chevron', draw: function (c, w, h) { poly(c, [[-w / 2, -h / 2], [w * 0.15, -h / 2], [w / 2, 0], [w * 0.15, h / 2], [-w / 2, h / 2], [-w * 0.15, 0]]); c.fill(); } },
    { id: 'stripe', name: 'Slanted stripe', draw: function (c, w, h) { poly(c, [[-w / 2 + w * 0.25, -h / 2], [w / 2, -h / 2], [w / 2 - w * 0.25, h / 2], [-w / 2, h / 2]]); c.fill(); } },
    { id: 'cross', name: 'Cross', draw: function (c, w, h) { var a = w * 0.17, b = h * 0.17; poly(c, [[-a, -h / 2], [a, -h / 2], [a, -b], [w / 2, -b], [w / 2, b], [a, b], [a, h / 2], [-a, h / 2], [-a, b], [-w / 2, b], [-w / 2, -b], [-a, -b]]); c.fill(); } },
    { id: 'checker', name: 'Checkered strip', draw: function (c, w, h) {
        var cols = 8, rows = 2, cw = w / cols, ch = h / rows, x, y, fillStyle = c.fillStyle;
        for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) { c.fillStyle = ((x + y) % 2) ? '#ffffff' : fillStyle; c.fillRect(-w / 2 + x * cw, -h / 2 + y * ch, cw + 0.5, ch + 0.5); }
        c.fillStyle = fillStyle; } }
  ];
  function shapeById(id) { for (var i = 0; i < SHAPES.length; i++) if (SHAPES[i].id === id) return SHAPES[i]; return null; }

  var MFR_BASE = 'assets/manufacturers/';   // the site's existing manufacturer logos -- not copied anywhere
var cfg = { designs: [], manufacturers: [], logos: [] };   // designs: [{slot, name, file}]  manufacturers: ['Ford', ...]  logos: [{name, file}] (custom logos such as the Race Club logo, files in assets/helmets/images/)
  function configure(o) {
    o = o || {};
    if (o.assetBase) ASSET_BASE = o.assetBase;
    if (o.designs) cfg.designs = o.designs.slice();
    if (o.manufacturers) cfg.manufacturers = o.manufacturers.slice();
    if (o.logos) cfg.logos = o.logos.slice();
    if (o.mfrBase) MFR_BASE = o.mfrBase;
    if (o.showLocked !== undefined) cfg.showLocked = !!o.showLocked;
  }
  // Designs a person may pick: locked designs (HelmetAssets.Locked) are for admins only. cfg.designs keeps ALL of
  // them so a helmet that already uses a locked design still draws.
  function visibleDesigns() { return cfg.designs.filter(function (d) { return !d.locked || cfg.showLocked; }); }

  // ---- recipes -------------------------------------------------------------------------------
  // Reads one pixel of a design's pattern picture. Accent 2 is painted lime #9BF20C (kept well away from the magenta
  // shell color); designs painted with the older pure red are still read correctly. Returns [accent2, accent1] weights.
  var LIME_ = [155 / 255, 242 / 255, 12 / 255];
  function patternWeights(pr, pg, pb, al) {
    var gL = pg / LIME_[1];                                     // how much lime: only lime has green
    if (gL > 0.03) {
      if (gL > 1) gL = 1;
      var wM = pr - LIME_[0] * gL; if (wM < 0) wM = 0;           // magenta (shell) share
      var wB = pb - LIME_[2] * gL - wM; if (wB < 0) wB = 0;      // blue (accent 1) share
      return [al * gL, al * (wB > 1 ? 1 : wB)];
    }
    if (pr > 0.85 && pb > 0.85 && pg < 0.1 && al > 0.5) return [0, 0];   // solid magenta = base
    return [al * pr, al * pb];                                   // older art: red = accent 2, blue = accent 1
  }

  function findColor(id) { for (var i = 0; i < PALETTE.length; i++) if (PALETTE[i].id === id) return PALETTE[i]; return null; }
  function hexOf(v) {
    if (typeof v === 'string' && v.charAt(0) === '#' && /^#[0-9a-fA-F]{6}$/.test(v)) return v;
    var c = findColor(v); return c ? c.hex : '#f4f4f6';
  }
  function findVisor(id) { for (var i = 0; i < VISORS.length; i++) if (VISORS[i].id === id) return VISORS[i]; return VISORS[0]; }
  function okFinish(f) { for (var i = 0; i < FINISHES.length; i++) if (FINISHES[i].id === f) return f; return 'gloss'; }

  function defaultRecipe() {
    return { d: 1, b: ['white', 'gloss'], a1: ['blue', 'gloss'], a2: ['red', 'gloss'], v: 'smoke', logos: [] };
  }
  function normalizeRecipe(r) {
    var def = defaultRecipe(); r = r || {};
    function slot(x, dflt) { x = x || dflt; return [x[0] || dflt[0], okFinish(x[1])]; }
    var out = {
      d: isNaN(parseInt(r.d, 10)) ? 1 : parseInt(r.d, 10),   // 0 = plain white helmet, no design
      b: slot(r.b, def.b), a1: slot(r.a1, def.a1), a2: slot(r.a2, def.a2),
      v: findVisor(r.v).id,
      logos: []
    };
    (r.logos || []).forEach(function (l) {
      if (l && l.s && shapeById(l.s)) {
        out.logos.push({ s: l.s, c: (typeof l.c === 'string' && l.c) ? l.c : 'red', m: '', v: 'std', f: '', x: +l.x || 0, y: +l.y || 0, w: +l.w || 200, h: +l.h || 200, r: +l.r || 0, sh: l.sh === 0 ? 0 : 1 });
        return;
      }
      if (!l || !(l.f || l.m)) return;
      out.logos.push({ m: l.m ? String(l.m) : '', v: (l.v === 'white' || l.v === 'black') ? l.v : 'std', f: l.f ? String(l.f) : '', x: +l.x || 0, y: +l.y || 0, w: +l.w || 200, h: +l.h || 200, r: +l.r || 0, sh: l.sh === 0 ? 0 : 1 });
    });
    return out;
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function randomRecipe(keepDesign) {
    var ids = PALETTE.map(function (p) { return p.id; });
    var base = pick(ids), a1, a2;
    do { a1 = pick(ids); } while (a1 === base);
    do { a2 = pick(ids); } while (a2 === base || a2 === a1);
    // weight towards gloss so most random helmets look classic
    var fin = ['gloss', 'gloss', 'gloss', 'satin', 'metallic', 'metallic', 'matte', 'pearl', 'candy', 'carbon'];
    var d = keepDesign === 0 ? 0 : (keepDesign || 1);
    if (!keepDesign && keepDesign !== 0 && visibleDesigns().length) d = pick(visibleDesigns()).slot;
    return { d: d, b: [base, pick(fin)], a1: [a1, pick(fin)], a2: [a2, pick(fin)], v: pick(VISORS).id, logos: [] };
  }

  // ---- image loading + caches ----------------------------------------------------------------
  var imgCache = {};
  function loadImg(url) {
    if (!imgCache[url]) {
      imgCache[url] = new Promise(function (res, rej) {
        var im = new Image();
        im.onload = function () { res(im); };
        im.onerror = function () { delete imgCache[url]; rej(new Error('missing ' + url)); };
        // The site's js/img-loader.js rewrites every image address to .webp first and only walks back
        // to .png/.jpg through the page-wide error event, which never fires for pictures that are not
        // on the page. That made every .png design and logo "missing". __rcSetting tells the loader to
        // leave this one alone (harmless on pages without the loader).
        im.__rcSetting = true;
        im.src = url;
        im.__rcSetting = false;
      });
    }
    return imgCache[url];
  }
  // Drops any design whose picture file is missing, so a sheet row without a file silently does not show.
  function pruneDesigns() {
    return Promise.all(cfg.designs.map(function (d) {
      return loadImg(ASSET_BASE + 'images/' + d.file).then(function () { return true; }, function () { return false; });
    })).then(function (ok) {
      cfg.designs = cfg.designs.filter(function (d, i) { return ok[i]; });
      return cfg.designs;
    });
  }
  function slug(n) { return String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, ''); }
  // Tries the site's existing manufacturer files in order, same naming the rest of the site uses:
  // {slug}-white / {slug}-black (if asked for) then plain {slug}; .webp first, then .png, then .svg.
  function logoCandidates(l) {
    if (!l.m && String(l.f).indexOf('u:') === 0) {   // a logo uploaded in the Logo Manager: its picture travels with the logo list
      var uid = String(l.f).slice(2);
      for (var ui = 0; ui < cfg.logos.length; ui++) if (cfg.logos[ui].id === uid && cfg.logos[ui].data) return [cfg.logos[ui].data];
      return [];
    }
    if (!l.m) return [ASSET_BASE + 'images/' + l.f];   // custom logos live beside the designs, listed in the HelmetAssets tab
    var sg = slug(l.m), names = [];
    // RC_MFR_VARIANTS (js/reference-data.js) lists the manufacturers that really have -black / -white files;
    // when the list is not loaded on this page, every variant is tried as before.
    var hasPair = (typeof RC_MFR_VARIANTS !== 'object') || !!RC_MFR_VARIANTS[sg];
    if (hasPair && (l.v === 'white' || l.v === 'black')) names.push(sg + '-' + l.v);
    names.push(sg);
    if (hasPair && l.v === 'std') { names.push(sg + '-black'); names.push(sg + '-white'); }
    var urls = [];
    names.forEach(function (n) { ['webp', 'png', 'svg'].forEach(function (e) { urls.push(MFR_BASE + n + '.' + e); }); });
    return urls;
  }
  function loadFirst(urls, i) {
    i = i || 0;
    if (i >= urls.length) return Promise.resolve(null);
    return loadImg(urls[i]).catch(function () { return loadFirst(urls, i + 1); });
  }
  function designUrl(slot) {
    for (var i = 0; i < cfg.designs.length; i++) if (cfg.designs[i].slot === slot) return ASSET_BASE + 'images/' + cfg.designs[i].file;
    return null;
  }
  var dataCache = {};   // key -> ImageData (scaled) ; small LRU
  var dataKeys = [];
  function scaledData(key, img, w, h, crop) {
    var k = key + '@' + w;
    if (dataCache[k]) return dataCache[k];
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    if (crop) ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, w, h);
    else ctx.drawImage(img, 0, 0, w, h);
    var d = ctx.getImageData(0, 0, w, h);
    dataCache[k] = d; dataKeys.push(k);
    if (dataKeys.length > 14) delete dataCache[dataKeys.shift()];
    return d;
  }
  var enginePromise = null;
  function engine() {
    if (!enginePromise) enginePromise = Promise.all([
      loadImg(ASSET_BASE + 'engine/base.webp'),
      loadImg(ASSET_BASE + 'engine/maps1.webp'),
      loadImg(ASSET_BASE + 'engine/maps2.webp')
    ]);
    return enginePromise;
  }

  // ---- per-pixel finishes --------------------------------------------------------------------
  function hash2(x, y) {                       // deterministic 0..1 noise
    var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  var T = [0, 0, 0];

  // writes the shaded colour for one pixel into T.  c = [r,g,b] 0-255
  function finishPx(kind, c, SH, HL, sx, sy, scale) {
    var r = c[0], g = c[1], b = c[2], k, w;
    var shc = clamp(SH, 0, 1);
    if (kind === 'gloss') {
      k = clamp(SH * 1.12, 0, 1.12); r *= k; g *= k; b *= k; w = HL;
    } else if (kind === 'matte') {
      k = 0.80 + 0.28 * shc; r *= k; g *= k; b *= k; w = HL * 0.10;
    } else if (kind === 'satin') {
      k = clamp(SH * 1.06, 0, 1.08); r *= k; g *= k; b *= k; w = HL * 0.38;
    } else if (kind === 'metallic') {
      var cell = Math.max(2, Math.round(2 / Math.max(scale, 0.25)));
      var u = hash2(Math.floor(sx / cell), Math.floor(sy / cell));
      var nz = (u - 0.5) * 3.46;
      var sp = u > 0.985 ? (u - 0.985) / 0.015 : 0;
      k = clamp(SH * 1.12, 0, 1.12) * (0.92 + 0.07 * nz * (scale < 0.4 ? 0.3 : 1));
      r *= k; g *= k; b *= k;
      w = HL;
      if (scale >= 0.4 && sp > 0) { r += (255 - r) * sp * 0.9; g += (255 - g) * sp * 0.9; b += (255 - b) * sp * 0.9; }
    } else if (kind === 'pearl') {
      var a = 0.5 + 0.5 * Math.sin((sx * 0.7 + sy * 0.9) / 110);
      var m1 = 0.30 * a, m2 = 0.30 * 0.85;
      r = r * (1 - m1) + (255 * (1 - a) + 90 * a) * m2;
      g = g * (1 - m1) + (120 * (1 - a) + 220 * a) * m2;
      b = b * (1 - m1) + (200 * (1 - a) + 230 * a) * m2;
      k = clamp(SH * 1.10, 0, 1.10); r *= k; g *= k; b *= k; w = HL * 0.85;
    } else if (kind === 'candy') {
      var cr = r / 255, cg = g / 255, cb = b / 255;
      var dr = Math.pow(cr, 1.6) * 255 * 1.1, dg = Math.pow(cg, 1.6) * 255 * 1.1, db = Math.pow(cb, 1.6) * 255 * 1.1;
      var t = clamp(SH, 0, 1.05);
      var tone = 0.50 + 0.60 * t;
      var lens = clamp((t - 0.78) * 3, 0, 1) * 0.5;
      r = dr * tone * (1 - lens) + clamp(r * 1.12, 0, 255) * lens;
      g = dg * tone * (1 - lens) + clamp(g * 1.12, 0, 255) * lens;
      b = db * tone * (1 - lens) + clamp(b * 1.12, 0, 255) * lens;
      w = HL;
    } else { // carbon (tintable)
      var p = 11, wv;
      var uu = (sx + sy) / p, vv = (sx - sy) / p;
      var tw = (Math.floor(uu) + Math.floor(vv)) & 1;
      var s1 = 0.5 + 0.5 * Math.sin(uu * Math.PI), s2 = 0.5 + 0.5 * Math.sin(vv * Math.PI);
      var weave = tw === 0 ? 0.35 + 0.45 * s1 : 0.25 + 0.45 * s2;
      var fade = clamp((scale - 0.22) / 0.30, 0, 1);
      weave = 0.6 * (1 - fade) + weave * fade;
      var tr = r * 0.5 + 12, tg = g * 0.5 + 12, tb = b * 0.5 + 14;
      k = (0.65 + 1.3 * weave) * clamp(SH, 0.5, 1);
      r = tr * k; g = tg * k; b = tb * k; w = HL * 0.9 + 0.04 * weave;
    }
    w = clamp(w, 0, 1);
    T[0] = r + (255 - r) * w; T[1] = g + (255 - g) * w; T[2] = b + (255 - b) * w;
  }

  function hexRgb(h) { h = hexOf(h); return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }

  // ---- unsharp mask (crisp edges), same settings as the approved mockups ----------------------
  function sharpen(buf, w, h, sigma, amount, thresh) {
    var rad = Math.ceil(sigma * 2.5), ker = [], sum = 0, i;
    for (i = -rad; i <= rad; i++) { var v = Math.exp(-(i * i) / (2 * sigma * sigma)); ker.push(v); sum += v; }
    for (i = 0; i < ker.length; i++) ker[i] /= sum;
    var tmp = new Float32Array(buf.length), out = new Float32Array(buf.length);
    var x, y, c, j;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      for (c = 0; c < 3; c++) {
        var s = 0;
        for (j = -rad; j <= rad; j++) { var xx = x + j; xx = xx < 0 ? 0 : (xx >= w ? w - 1 : xx); s += buf[(y * w + xx) * 4 + c] * ker[j + rad]; }
        tmp[(y * w + x) * 4 + c] = s;
      }
    }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      for (c = 0; c < 3; c++) {
        var s2 = 0;
        for (j = -rad; j <= rad; j++) { var yy = y + j; yy = yy < 0 ? 0 : (yy >= h ? h - 1 : yy); s2 += tmp[(yy * w + x) * 4 + c] * ker[j + rad]; }
        var o = (y * w + x) * 4 + c, dlt = buf[o] - s2;
        out[o] = (Math.abs(dlt) >= thresh) ? buf[o] + dlt * amount : buf[o];
      }
    }
    for (var n = 0; n < buf.length; n++) if ((n & 3) !== 3) buf[n] = out[n];
  }

  // ---- main render ---------------------------------------------------------------------------
  function render(recipe, opts) {
    recipe = normalizeRecipe(recipe);
    opts = opts || {};
    var Wt = Math.max(24, Math.round(opts.width || 300));
    var scale = Wt / CROP.w;
    var Ht = Math.round(CROP.h * scale);
    var patUrl = designUrl(recipe.d);
    var logoLoads = recipe.logos.map(function (l) { return l.s ? Promise.resolve(true) : loadFirst(logoCandidates(l)); });
    var patLoad = patUrl ? loadImg(patUrl).catch(function () { return null; }) : Promise.resolve(null);

    return Promise.all([engine(), patLoad, Promise.all(logoLoads)]).then(function (res) {
      var eng = res[0], pat = res[1], logoImgs = res[2];
      var base = scaledData('base', eng[0], Wt, Ht, CROP).data;
      var m1 = scaledData('m1', eng[1], Wt, Ht, CROP).data;
      var m2 = scaledData('m2', eng[2], Wt, Ht, CROP).data;
      // the pattern PNG covers the same 1254x1254 area as the helmet, whatever pixel size it was saved at
      var pk = pat ? pat.naturalWidth / 1254 : 1;
      var pd = pat ? scaledData('pat:' + recipe.d, pat, Wt, Ht, { x: CROP.x * pk, y: CROP.y * pk, w: CROP.w * pk, h: CROP.h * pk }).data : null;

      var cB = hexRgb(recipe.b[0]), cA1 = hexRgb(recipe.a1[0]), cA2 = hexRgb(recipe.a2[0]);
      var kB = recipe.b[1], kA1 = recipe.a1[1], kA2 = recipe.a2[1];
      var sB = SPEC_K[kB], sA1 = SPEC_K[kA1], sA2 = SPEC_K[kA2];
      var vis = findVisor(recipe.v), v1 = hexRgb(vis.c1), v2 = hexRgb(vis.c2);

      var N = Wt * Ht;
      var out = new Float32Array(N * 4);
      var specK = new Float32Array(N);
      var cOut = [0, 0, 0];

      for (var py = 0; py < Ht; py++) {
        var sy = CROP.y + (py + 0.5) / scale;
        for (var px = 0; px < Wt; px++) {
          var i = py * Wt + px, o = i * 4;
          var sx = CROP.x + (px + 0.5) / scale;
          var bR = base[o], bG = base[o + 1], bB = base[o + 2];
          var sm = m1[o] / 255, gl = m1[o + 1] / 255, SH = m1[o + 2] / 200, HL = m2[o + 1] / 255;
          var r = bR, g = bG, b = bB;

          if (sm > 0.001) {
            // pattern weights: lime (#9BF20C) or the older pure red = accent 2, blue = accent 1, transparent / pink (magenta) = base
            var wS = 0, wA = 0;
            if (pd) {
              var al = pd[o + 3] / 255;
              if (al > 0.004) {
                var pw = patternWeights(pd[o] / 255, pd[o + 1] / 255, pd[o + 2] / 255, al);
                wS = pw[0]; wA = pw[1];
              }
            }
            wS = wS > 1 ? 1 : wS; wA = wA > 1 ? 1 : wA; wA *= (1 - wS);
            var wB = 1 - wS - wA; if (wB < 0) wB = 0;
            var pr_ = 0, pg_ = 0, pb_ = 0, sk = 0;
            if (wB > 0.002) { finishPx(kB, cB, SH, HL, sx, sy, scale); pr_ += T[0] * wB; pg_ += T[1] * wB; pb_ += T[2] * wB; sk += sB * wB; }
            if (wA > 0.002) { finishPx(kA1, cA1, SH, HL, sx, sy, scale); pr_ += T[0] * wA; pg_ += T[1] * wA; pb_ += T[2] * wA; sk += sA1 * wA; }
            if (wS > 0.002) { finishPx(kA2, cA2, SH, HL, sx, sy, scale); pr_ += T[0] * wS; pg_ += T[1] * wS; pb_ += T[2] * wS; sk += sA2 * wS; }
            r = r * (1 - sm) + clamp(pr_, 0, 255) * sm;
            g = g * (1 - sm) + clamp(pg_, 0, 255) * sm;
            b = b * (1 - sm) + clamp(pb_, 0, 255) * sm;
            specK[i] = sk;
          }
          if (gl > 0.001) {
            var t2 = clamp(((sx - 80) + (sy - 420) * 0.6) / 700, 0, 1);
            var vr = v1[0] * (1 - t2) + v2[0] * t2, vg = v1[1] * (1 - t2) + v2[1] * t2, vb = v1[2] * (1 - t2) + v2[2] * t2;
            var gdx = sx - (230 + (sy - 420) * -0.30), gdx2 = sx - (330 + (sy - 420) * -0.30);
            var glint = (Math.exp(-(gdx / 38) * (gdx / 38)) * 0.55 + Math.exp(-(gdx2 / 10) * (gdx2 / 10)) * 0.5) * 0.8;
            glint = glint > 1 ? 1 : glint;
            vr += (255 - vr) * glint; vg += (255 - vg) * glint; vb += (255 - vb) * glint;
            var lm = 0.75 + 0.35 * ((bR + bG + bB) / 765);
            vr *= lm; vg *= lm; vb *= lm;
            r = r * (1 - gl) + vr * gl; g = g * (1 - gl) + vg * gl; b = b * (1 - gl) + vb * gl;
          }
          out[o] = clamp(r, 0, 255); out[o + 1] = clamp(g, 0, 255); out[o + 2] = clamp(b, 0, 255); out[o + 3] = m2[o] ;
        }
      }
      if (scale >= 0.45) sharpen(out, Wt, Ht, 1.2 * scale / 1.0, 0.9, 3);

      // logos (clipped to the shell so they never float off the helmet)
      var hasLogo = false, li;
      for (li = 0; li < logoImgs.length; li++) if (logoImgs[li]) hasLogo = true;
      if (hasLogo) {
        var lc = document.createElement('canvas'); lc.width = Wt; lc.height = Ht;
        var lx = lc.getContext('2d', { willReadFrequently: true });
        recipe.logos.forEach(function (l, idx) {
          var im = logoImgs[idx]; if (!im) return;
          lx.save();
          lx.translate((l.x - CROP.x) * scale, (l.y - CROP.y) * scale);
          lx.rotate(-l.r * Math.PI / 180);
          if (l.sh) { lx.shadowColor = 'rgba(0,0,0,0.45)'; lx.shadowBlur = Math.max(2, 7 * scale); lx.shadowOffsetX = 0; lx.shadowOffsetY = Math.max(1, 2 * scale); }
          if (l.s) {
            lx.fillStyle = hexOf(l.c);
            shapeById(l.s).draw(lx, l.w * scale, l.h * scale);
          } else {
            var nw = im.naturalWidth || 300, nh = im.naturalHeight || 300;
            var fit = Math.min(l.w / nw, l.h / nh);
            var dw = nw * fit * scale, dh = nh * fit * scale;
            lx.drawImage(im, -dw / 2, -dh / 2, dw, dh);
          }
          lx.restore();
        });
        var ld = lx.getImageData(0, 0, Wt, Ht).data;
        for (var q = 0; q < N; q++) {
          var la = ld[q * 4 + 3] / 255; if (la <= 0) continue;
          la *= m1[q * 4] / 255;
          var oo = q * 4;
          out[oo] = out[oo] * (1 - la) + ld[oo] * la;
          out[oo + 1] = out[oo + 1] * (1 - la) + ld[oo + 1] * la;
          out[oo + 2] = out[oo + 2] * (1 - la) + ld[oo + 2] * la;
        }
      }
      // shared highlight layer (same for everyone, sits on top of paint and logos)
      for (var z = 0; z < N; z++) {
        var s = m2[z * 4 + 2] / 255 * specK[z]; if (s <= 0) continue;
        s = s > 1 ? 1 : s; var oz = z * 4;
        out[oz] += (255 - out[oz]) * s; out[oz + 1] += (255 - out[oz + 1]) * s; out[oz + 2] += (255 - out[oz + 2]) * s;
      }
      var cv = document.createElement('canvas'); cv.width = Wt; cv.height = Ht;
      var cx = cv.getContext('2d'); var id = cx.createImageData(Wt, Ht);
      for (var f = 0; f < out.length; f++) id.data[f] = out[f];
      cx.putImageData(id, 0, 0);
      cv.className = 'rc-helmet';
      cv.missingLogos = recipe.logos.map(function (l, i) { return logoImgs[i] ? null : (l.m || l.f); });
      return cv;
    });
  }

  function mount(el, recipe, opts) {
    return render(recipe, opts).then(function (cv) {
      el.innerHTML = ''; el.appendChild(cv); return cv;
    });
  }

  window.RCHelmet = {
    PALETTE: PALETTE, SHAPES: SHAPES, FINISHES: FINISHES, VISORS: VISORS, CROP: CROP,
    configure: configure, pruneDesigns: pruneDesigns, defaultRecipe: defaultRecipe, randomRecipe: randomRecipe, normalizeRecipe: normalizeRecipe,
    hexOf: hexOf, render: render, mount: mount, getConfig: function () { return cfg; }, visibleDesigns: visibleDesigns
  };
})();
