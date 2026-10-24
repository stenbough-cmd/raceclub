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
    { id: 'clear', name: 'Clear',       c1: '#e4eef5', c2: '#7d93a3', a: 0.42 },   // a = how solid it is: a clear visor lets the dark inside of the helmet show through
    { id: 'gold',  name: 'Gold',        c1: '#fcd34d', c2: '#92400e' },
    { id: 'blue',  name: 'Blue',        c1: '#5b9bff', c2: '#0b2a6b' },
    { id: 'green', name: 'Green',       c1: '#4ade80', c2: '#0f5132' },
    { id: 'red',   name: 'Red',         c1: '#f87171', c2: '#7f1d1d' },
    { id: 'purple', name: 'Purple',     c1: '#c084fc', c2: '#3b0764' },
    // gradient lenses in the style of Oakley bi-color / tri-color visors: stops run from the top of the visor to the bottom
    { id: 'sunset', name: 'Sunset',     c1: '#ffcf6b', c2: '#3d1a78', stops: ['#ffcf6b', '#f0527e', '#3d1a78'] },
    { id: 'ocean',  name: 'Ocean',      c1: '#66f0d6', c2: '#0b2766', stops: ['#66f0d6', '#2a8fe0', '#0b2766'] },
    { id: 'fire',   name: 'Fire',       c1: '#ffe14a', c2: '#d62a1a', stops: ['#ffe14a', '#d62a1a'] }
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
    { id: 'circle', name: 'Circle', draw: function (c, w, h) { c.beginPath(); c.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); c.fill(); } },
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
    { id: 'checker', name: 'Checkered strip', colors: 2, draw: function (c, w, h, a, b2) {
        var cols = 8, rows = 2, cw = w / cols, ch = h / rows, x, y, fillStyle = c.fillStyle;
        for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) { c.fillStyle = ((x + y) % 2) ? (b2 || '#ffffff') : fillStyle; c.fillRect(-w / 2 + x * cw, -h / 2 + y * ch, cw + 0.5, ch + 0.5); }
        c.fillStyle = fillStyle; } }
  ];

  // ---- premium shapes ---------------------------------------------------------------------------
  // Drawn from a list of path commands in a -1..1 box (x right, y down) that is stretched to the layer's w x h.
  //   ['M',x,y] move  ['L',x,y] line  ['Q',cx,cy,x,y] curve  ['C',c1x,c1y,c2x,c2y,x,y] curve  ['Z'] close
  function npath(c, w, h, cmds) {
    var sx = w / 2, sy = h / 2;
    c.beginPath();
    cmds.forEach(function (m) {
      var k = m[0];
      if (k === 'M') c.moveTo(m[1] * sx, m[2] * sy);
      else if (k === 'L') c.lineTo(m[1] * sx, m[2] * sy);
      else if (k === 'Q') c.quadraticCurveTo(m[1] * sx, m[2] * sy, m[3] * sx, m[4] * sy);
      else if (k === 'C') c.bezierCurveTo(m[1] * sx, m[2] * sy, m[3] * sx, m[4] * sy, m[5] * sx, m[6] * sy);
      else c.closePath();
    });
  }
  function pshape(id, name, cmds, evenodd) {
    return { id: id, name: name, premium: true, draw: function (c, w, h) { npath(c, w, h, cmds); if (evenodd) c.fill('evenodd'); else c.fill(); } };
  }
  function ngon(n, rOuter, rInner, rot) {      // regular polygon / star as a command list
    var out = [], i, cnt = rInner ? n * 2 : n;
    for (i = 0; i < cnt; i++) {
      var a = (rot || -Math.PI / 2) + i * Math.PI * 2 / cnt, r = (rInner && i % 2) ? rInner : rOuter;
      out.push([i ? 'L' : 'M', Math.cos(a) * r, Math.sin(a) * r]);
    }
    out.push(['Z']); return out;
  }
  function circ(cx, cy, r) {                    // circle as 4 curves (for holes with even-odd fill)
    var k = 0.5523 * r;
    return [['M', cx + r, cy], ['C', cx + r, cy + k, cx + k, cy + r, cx, cy + r], ['C', cx - k, cy + r, cx - r, cy + k, cx - r, cy], ['C', cx - r, cy - k, cx - k, cy - r, cx, cy - r], ['C', cx + k, cy - r, cx + r, cy - k, cx + r, cy], ['Z']];
  }
  var PREMIUM_SHAPES = [
    pshape('flame', 'Flame', [['M', 0.05, -1], ['C', 0.2, -0.55, 0.85, -0.35, 0.85, 0.25], ['C', 0.85, 0.75, 0.45, 1, 0, 1], ['C', -0.5, 1, -0.9, 0.7, -0.8, 0.15], ['C', -0.75, -0.15, -0.5, -0.3, -0.4, -0.6], ['C', -0.25, -0.45, -0.15, -0.3, -0.15, -0.05], ['C', 0.15, -0.3, -0.05, -0.65, 0.05, -1], ['Z']]),
    pshape('flame_swept', 'Flame streaks', [['M', 1, -0.86], ['C', 0.5, -0.9, 0.1, -0.7, -0.45, -1.02], ['C', -0.05, -0.62, 0.5, -0.3, 1, -0.34], ['Z'], ['M', 1, -0.24], ['C', 0.5, -0.28, 0.1, -0.08, -1, -0.4], ['C', -0.6, 0.0, 0.5, 0.32, 1, 0.28], ['Z'], ['M', 1, 0.36], ['C', 0.5, 0.32, 0.1, 0.52, -0.6, 0.2], ['C', -0.2, 0.6, 0.5, 0.92, 1, 0.88], ['Z']]),
    pshape('flame_trio', 'Triple flame', [['M', -1, 1], ['C', -1, 0.3, -0.75, 0.1, -0.7, -0.35], ['C', -0.6, -0.05, -0.45, 0.05, -0.4, 0.4], ['C', -0.35, -0.2, -0.1, -0.5, -0.05, -1], ['C', 0.15, -0.55, 0.3, -0.3, 0.3, 0.35], ['C', 0.4, 0.15, 0.5, -0.1, 0.5, -0.4], ['C', 0.85, -0.05, 1, 0.4, 1, 1], ['Z']]),
    pshape('lightning', 'Lightning bolt', [['M', 0.2, -1], ['L', -0.7, 0.15], ['L', -0.1, 0.15], ['L', -0.35, 1], ['L', 0.75, -0.2], ['L', 0.1, -0.2], ['Z']]),
    pshape('shield', 'Shield', [['M', 0, -1], ['C', 0.3, -0.8, 0.65, -0.7, 0.9, -0.7], ['C', 0.9, 0.1, 0.7, 0.65, 0, 1], ['C', -0.7, 0.65, -0.9, 0.1, -0.9, -0.7], ['C', -0.65, -0.7, -0.3, -0.8, 0, -1], ['Z']]),
    pshape('crown', 'Crown', [['M', -1, 0.8], ['L', -1, -0.5], ['L', -0.5, 0], ['L', 0, -0.9], ['L', 0.5, 0], ['L', 1, -0.5], ['L', 1, 0.8], ['Z']]),
    pshape('starburst', 'Starburst', ngon(16, 1, 0.62)),
    pshape('arrow', 'Arrow', [['M', -1, -0.3], ['L', 0.2, -0.3], ['L', 0.2, -1], ['L', 1, 0], ['L', 0.2, 1], ['L', 0.2, 0.3], ['L', -1, 0.3], ['Z']]),
    pshape('double_chevron', 'Double chevron', [['M', -1, -1], ['L', -0.5, -1], ['L', 0, 0], ['L', -0.5, 1], ['L', -1, 1], ['L', -0.5, 0], ['Z'], ['M', 0.05, -1], ['L', 0.55, -1], ['L', 1.05, 0], ['L', 0.55, 1], ['L', 0.05, 1], ['L', 0.55, 0], ['Z']]),
    pshape('speed_lines', 'Speed lines', [['M', -0.3, -0.875], ['L', 1.0, -0.875], ['L', 0.9, -0.7250000000000001], ['L', -0.4, -0.7250000000000001], ['Z'], ['M', -1.0, -0.47500000000000003], ['L', 0.7, -0.47500000000000003], ['L', 0.6, -0.325], ['L', -1.1, -0.325], ['Z'], ['M', -0.6, -0.075], ['L', 1.0, -0.075], ['L', 0.9, 0.075], ['L', -0.7, 0.075], ['Z'], ['M', -1.0, 0.325], ['L', 0.55, 0.325], ['L', 0.45, 0.47500000000000003], ['L', -1.1, 0.47500000000000003], ['Z'], ['M', -0.2, 0.7250000000000001], ['L', 1.0, 0.7250000000000001], ['L', 0.9, 0.875], ['L', -0.3, 0.875], ['Z']]),
    pshape('claw', 'Claw marks', [['M', -0.85, -1], ['C', -0.55, -0.4, -0.5, 0.3, -0.7, 1], ['C', -0.95, 0.4, -1, -0.4, -0.85, -1], ['Z'], ['M', -0.15, -1], ['C', 0.2, -0.4, 0.25, 0.3, 0.05, 1], ['C', -0.25, 0.4, -0.3, -0.4, -0.15, -1], ['Z'], ['M', 0.6, -1], ['C', 0.95, -0.4, 1, 0.3, 0.8, 1], ['C', 0.5, 0.4, 0.45, -0.4, 0.6, -1], ['Z']]),
    pshape('swoosh', 'Swoosh', [['M', -1, 0.6], ['C', -0.4, 0.55, 0.3, 0.1, 1, -0.8], ['C', 0.6, -0.2, 0.1, 0.45, -0.35, 0.75], ['C', -0.6, 0.9, -0.85, 0.85, -1, 0.6], ['Z']]),
    pshape('crescent', 'Crescent', [['M', 0.35, -0.95], ['C', -0.55, -0.95, -1, -0.45, -1, 0.05], ['C', -1, 0.6, -0.55, 1, 0.1, 1], ['C', 0.5, 1, 0.8, 0.85, 0.95, 0.65], ['C', 0.2, 0.7, -0.35, 0.3, -0.35, -0.15], ['C', -0.35, -0.5, -0.05, -0.8, 0.35, -0.95], ['Z']]),
    pshape('heart', 'Heart', [['M', 0, 0.95], ['C', -0.5, 0.55, -1, 0.2, -1, -0.35], ['C', -1, -0.8, -0.65, -0.95, -0.4, -0.95], ['C', -0.2, -0.95, -0.05, -0.8, 0, -0.6], ['C', 0.05, -0.8, 0.2, -0.95, 0.4, -0.95], ['C', 0.65, -0.95, 1, -0.8, 1, -0.35], ['C', 1, 0.2, 0.5, 0.55, 0, 0.95], ['Z']]),
    pshape('gear', 'Gear', (function () {
      var out = [], i, n = 10;
      for (i = 0; i < n; i++) {
        var a = i * Math.PI * 2 / n, hw = Math.PI / n * 0.5;
        [[a - hw * 1.1, 0.78], [a - hw * 0.7, 1], [a + hw * 0.7, 1], [a + hw * 1.1, 0.78]].forEach(function (q, j) { out.push([(i || j) ? 'L' : 'M', Math.cos(q[0]) * q[1], Math.sin(q[0]) * q[1]]); });
      }
      out.push(['Z']); return out.concat(circ(0, 0, 0.35));
    })(), true),
    pshape('target', 'Target', circ(0, 0, 1).concat(circ(0, 0, 0.78), circ(0, 0, 0.5), circ(0, 0, 0.24)), true),
    pshape('spikes', 'Spikes', [['M', -1, 1], ['L', -0.85, -0.2], ['L', -0.7, 1], ['L', -0.55, -0.6], ['L', -0.4, 1], ['L', -0.25, -1], ['L', -0.1, 1], ['L', 0.05, -0.6], ['L', 0.2, 1], ['L', 0.35, -0.3], ['L', 0.5, 1], ['L', 0.65, -0.1], ['L', 0.8, 1], ['L', 0.9, 0.2], ['L', 1, 1], ['Z']]),
    pshape('droplet', 'Droplet', [['M', 0, -1], ['C', 0.3, -0.55, 0.9, -0.2, 0.9, 0.1], ['C', 0.9, 0.597, 0.497, 1, 0, 1], ['C', -0.497, 1, -0.9, 0.597, -0.9, 0.1], ['C', -0.9, -0.2, -0.3, -0.55, 0, -1], ['Z']]),
    pshape('paw', 'Paw print', [['M', 0, 0.05], ['C', 0.4, 0.05, 0.75, 0.45, 0.65, 0.8], ['C', 0.55, 1, 0.25, 0.85, 0, 0.85], ['C', -0.25, 0.85, -0.55, 1, -0.65, 0.8], ['C', -0.75, 0.45, -0.4, 0.05, 0, 0.05], ['Z']].concat(circ(-0.72, -0.1, 0.2), circ(-0.28, -0.55, 0.22), circ(0.28, -0.55, 0.22), circ(0.72, -0.1, 0.2))),
  ];
  Array.prototype.push.apply(SHAPES, PREMIUM_SHAPES);
  // Gradient layers: draw(c, w, h, color1, color2). 'colors: 2' shapes use both colors; 'colors: 1' shapes fade the one color out to see-through.
  function grad(c, x0, y0, x1, y1, a, b) { var g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  function clear(hex) { var h = String(hex).replace('#', ''); var n = parseInt(h, 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',0)'; }
  var GRADIENTS = [
    { id: 'g_linear', name: 'Two-color fade', gradient: true, colors: 2, draw: function (c, w, h, a, b) { c.fillStyle = grad(c, -w / 2, 0, w / 2, 0, a, b); c.fillRect(-w / 2, -h / 2, w, h); } },
    { id: 'g_fade', name: 'Fade to clear', gradient: true, colors: 1, draw: function (c, w, h, a) { c.fillStyle = grad(c, -w / 2, 0, w / 2, 0, a, clear(a)); c.fillRect(-w / 2, -h / 2, w, h); } },
    { id: 'g_band', name: 'Soft band', gradient: true, colors: 1, draw: function (c, w, h, a) { var g = c.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, clear(a)); g.addColorStop(0.5, a); g.addColorStop(1, clear(a)); c.fillStyle = g; c.fillRect(-w / 2, -h / 2, w, h); } },
    { id: 'g_radial', name: 'Two-color radial', gradient: true, colors: 2, draw: function (c, w, h, a, b) { c.save(); c.scale(1, h / w); var g = c.createRadialGradient(0, 0, 0, 0, 0, w / 2); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.beginPath(); c.arc(0, 0, w / 2, 0, Math.PI * 2); c.fill(); c.restore(); } },
    { id: 'g_glow', name: 'Glow', gradient: true, colors: 1, draw: function (c, w, h, a) { c.save(); c.scale(1, h / w); var g = c.createRadialGradient(0, 0, 0, 0, 0, w / 2); g.addColorStop(0, a); g.addColorStop(1, clear(a)); c.fillStyle = g; c.beginPath(); c.arc(0, 0, w / 2, 0, Math.PI * 2); c.fill(); c.restore(); } }
  ];
  Array.prototype.push.apply(SHAPES, GRADIENTS);
  // Weathering layers: scratches, scuffs and wear drawn in one color (the same marks every time: they use a fixed seed).
  function rng(seed) { return function () { seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var WEATHERING = [
    { id: 'w_scratches', name: 'Fine scratches', weathering: true, draw: function (c, w, h, col) {
      var R = rng(11), i; c.strokeStyle = col; c.lineCap = 'round';
      for (i = 0; i < 26; i++) {
        var x = (R() - 0.5) * w, y = (R() - 0.5) * h, len = (0.15 + R() * 0.4) * w, a = -0.5 + R() * 0.3 + (i % 5 === 0 ? 0.9 : 0);
        c.globalAlpha = 0.25 + R() * 0.5; c.lineWidth = Math.max(0.5, (0.3 + R() * 0.9) * w / 220);
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (R() - 0.5) * len * 0.1, y + Math.sin(a) * len * 0.5 + (R() - 0.5) * len * 0.1, x + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke();
      }
      c.globalAlpha = 1;
    } },
    { id: 'w_scuffs', name: 'Scuff marks', weathering: true, draw: function (c, w, h, col) {
      var R = rng(23), i; c.fillStyle = col;
      for (i = 0; i < 9; i++) {
        var x = (R() - 0.5) * w * 0.8, y = (R() - 0.5) * h * 0.8, rx = (0.08 + R() * 0.16) * w, ry = rx * (0.12 + R() * 0.18), a = -0.4 + R() * 0.3;
        c.save(); c.translate(x, y); c.rotate(a);
        for (var k = 0; k < 4; k++) { c.globalAlpha = 0.09 + R() * 0.1; c.beginPath(); c.ellipse((R() - 0.5) * rx * 0.4, (R() - 0.5) * ry * 0.6, rx * (1 - k * 0.18), ry * (1 - k * 0.15), 0, 0, Math.PI * 2); c.fill(); }
        c.restore();
      }
      c.globalAlpha = 1;
    } },
    { id: 'w_chips', name: 'Paint chips', weathering: true, draw: function (c, w, h, col) {
      var R = rng(37), i, j; c.fillStyle = col;
      for (i = 0; i < 34; i++) {
        var x = (R() - 0.5) * w, y = (R() - 0.5) * h, r = (0.008 + R() * R() * 0.035) * w, n = 5 + Math.floor(R() * 3);
        c.globalAlpha = 0.55 + R() * 0.4; c.beginPath();
        for (j = 0; j < n; j++) { var ang = j / n * Math.PI * 2, rr = r * (0.55 + R() * 0.7); c[j ? 'lineTo' : 'moveTo'](x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.8); }
        c.closePath(); c.fill();
      }
      c.globalAlpha = 1;
    } },
    { id: 'w_gouge', name: 'Heavy scrape', weathering: true, draw: function (c, w, h, col) {
      var R = rng(51), i; c.fillStyle = col;
      for (i = 0; i < 7; i++) {
        var y0 = (i - 3) * h * 0.09 + (R() - 0.5) * h * 0.03, th = h * (0.012 + R() * 0.03), x = -w / 2 + R() * w * 0.1, end = w / 2 - R() * w * 0.2;
        c.globalAlpha = 0.35 + R() * 0.5; c.beginPath(); c.moveTo(x, y0);
        while (x < end) { x += w * (0.02 + R() * 0.05); c.lineTo(x, y0 + (R() - 0.5) * th * 1.4 - th / 2); }
        for (x = x; x > -w / 2 + w * 0.05; x -= w * (0.02 + R() * 0.05)) c.lineTo(x, y0 + th / 2 + (R() - 0.5) * th * 0.9);
        c.closePath(); c.fill();
      }
      c.globalAlpha = 1;
    } },
    { id: 'w_grime', name: 'Dust and grime', weathering: true, draw: function (c, w, h, col) {
      var R = rng(77), i; c.fillStyle = col;
      for (i = 0; i < 260; i++) {
        var x = (R() - 0.5) * w, y = (R() - 0.5) * h, edge = Math.abs(x) / (w / 2);
        if (R() > 0.25 + edge * 0.6) continue;
        var r = (0.002 + R() * R() * 0.012) * w; c.globalAlpha = 0.12 + R() * 0.4;
        c.beginPath(); c.arc(x, y, Math.max(0.4, r), 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    } }
  ];
  Array.prototype.push.apply(SHAPES, WEATHERING);
  // Patterns: tiles that fit edge to edge. Copy a pattern layer and set the copy next to the first (same width and height) and the
  // pattern carries on without a seam, so several copies cover as large a canvas as you like. Each one repeats a whole number of
  // times inside its box, and is drawn a hair past its edges (same color) so neighbouring tiles never show a hairline.
  function patTile(c, w, h, fn) {
    c.save(); c.beginPath(); c.rect(-w / 2 - 0.75, -h / 2 - 0.75, w + 1.5, h + 1.5); c.clip();
    c.translate(-w / 2, -h / 2); fn(w, h); c.restore();
  }
  var PATTERNS = [
    { id: 'pat_dots', name: 'Dots', pattern: true, draw: function (c, w, h, col) { patTile(c, w, h, function (w, h) {
      var u = w / 4, v = h / 4, i, j; c.fillStyle = col;
      for (i = -1; i < 5; i++) for (j = -1; j < 5; j++) { c.beginPath(); c.ellipse((i + 0.5) * u, (j + 0.5) * v, u * 0.3, v * 0.3, 0, 0, Math.PI * 2); c.fill(); }
    }); } },
    { id: 'pat_diag', name: 'Diagonal stripes', pattern: true, draw: function (c, w, h, col) { patTile(c, w, h, function (w, h) {
      c.fillStyle = col;
      for (var k = -2; k < 5; k++) {
        var a = k * 0.5, b = a + 0.25;
        c.beginPath(); c.moveTo(a * w + 2 * w, -2 * h); c.lineTo(a * w - 3 * w, 3 * h); c.lineTo(b * w - 3 * w, 3 * h); c.lineTo(b * w + 2 * w, -2 * h); c.closePath(); c.fill();
      }
    }); } },
    { id: 'pat_check', name: 'Checkerboard', pattern: true, draw: function (c, w, h, col) { patTile(c, w, h, function (w, h) {
      var u = w / 4, v = h / 4, i, j; c.fillStyle = col;
      for (i = -1; i < 5; i++) for (j = -1; j < 5; j++) if (((i + j) % 2 + 2) % 2 === 0) c.fillRect(i * u, j * v, u, v);
    }); } },
    { id: 'pat_chevron', name: 'Chevrons', pattern: true, draw: function (c, w, h, col) { patTile(c, w, h, function (w, h) {
      var v = h / 4, d = v * 0.45, t = v * 0.3, r, k; c.fillStyle = col;
      for (r = -1; r < 5; r++) {
        var y0 = r * v + v * 0.1;
        c.beginPath(); c.moveTo(0, y0);
        for (k = 1; k <= 4; k++) c.lineTo(k * w / 4, y0 + (k % 2 ? d : 0));
        for (k = 4; k >= 0; k--) c.lineTo(k * w / 4, y0 + t + (k % 2 ? d : 0));
        c.closePath(); c.fill();
      }
    }); } },
    { id: 'pat_hex', name: 'Hexagon mesh', pattern: true, draw: function (c, w, h, col) { patTile(c, w, h, function (w, h) {
      var dx = w / 3, dy = h / 4, W = dx * 0.88, H = dy / 0.75 * 0.88, r, k; c.fillStyle = col;
      for (r = -1; r < 5; r++) for (k = -1; k < 4; k++) {
        var cx = (k + 0.5 + (((r % 2) + 2) % 2) * 0.5) * dx, cy = (r + 0.5) * dy;
        c.beginPath();
        c.moveTo(cx, cy - H / 2); c.lineTo(cx + W / 2, cy - H / 4); c.lineTo(cx + W / 2, cy + H / 4); c.lineTo(cx, cy + H / 2); c.lineTo(cx - W / 2, cy + H / 4); c.lineTo(cx - W / 2, cy - H / 4);
        c.closePath(); c.fill();
      }
    }); } },
    { id: 'pat_waves', name: 'Waves', pattern: true, draw: function (c, w, h, col) { patTile(c, w, h, function (w, h) {
      var v = h / 4, A = v * 0.22, t = v * 0.3, r, x, N = 48; c.fillStyle = col;
      for (r = -1; r < 5; r++) {
        var y0 = (r + 0.35) * v;
        c.beginPath();
        for (x = 0; x <= N; x++) c[x ? 'lineTo' : 'moveTo'](x / N * w, y0 + A * Math.sin(x / N * Math.PI * 4));
        for (x = N; x >= 0; x--) c.lineTo(x / N * w, y0 + t + A * Math.sin(x / N * Math.PI * 4));
        c.closePath(); c.fill();
      }
    }); } },
    { id: 'pat_tri', name: 'Triangles', pattern: true, draw: function (c, w, h, col) { patTile(c, w, h, function (w, h) {
      var u = w / 4, v = h / 4, i, j; c.fillStyle = col;
      for (i = -1; i < 5; i++) for (j = -1; j < 5; j++) { c.beginPath(); c.moveTo(i * u, (j + 1) * v); c.lineTo((i + 0.5) * u, j * v); c.lineTo((i + 1) * u, (j + 1) * v); c.closePath(); c.fill(); }
    }); } },
    { id: 'pat_diamond', name: 'Diamonds', pattern: true, draw: function (c, w, h, col) { patTile(c, w, h, function (w, h) {
      var u = w / 4, v = h / 4, i, j; c.fillStyle = col;
      for (i = -1; i < 5; i++) for (j = -1; j < 5; j++) {
        var cx = (i + 0.5) * u, cy = (j + 0.5) * v;
        c.beginPath(); c.moveTo(cx, cy - v * 0.42); c.lineTo(cx + u * 0.42, cy); c.lineTo(cx, cy + v * 0.42); c.lineTo(cx - u * 0.42, cy); c.closePath(); c.fill();
      }
    }); } },
    { id: 'pat_weave', name: 'Carbon weave', pattern: true, draw: function (c, w, h, col) { patTile(c, w, h, function (w, h) {
      var u = w / 4, v = h / 4, i, j; c.fillStyle = col;
      for (i = -1; i < 5; i++) for (j = -1; j < 5; j++) {
        var horiz = (((i + j) % 2) + 2) % 2 === 0, x = i * u, y = j * v;
        if (horiz) { c.fillRect(x + u * 0.04, y + v * 0.08, u * 0.92, v * 0.38); c.fillRect(x + u * 0.04, y + v * 0.54, u * 0.92, v * 0.38); }
        else { c.fillRect(x + u * 0.08, y + v * 0.04, u * 0.38, v * 0.92); c.fillRect(x + u * 0.54, y + v * 0.04, u * 0.38, v * 0.92); }
      }
    }); } },
    { id: 'pat_scales', name: 'Scales', pattern: true, draw: function (c, w, h, col) { patTile(c, w, h, function (w, h) {
      var rx = w / 8, ry = h / 8, r, k; c.strokeStyle = col; c.lineWidth = Math.max(1, Math.min(rx, ry) * 0.22);
      for (r = -1; r < 9; r++) for (k = -1; k < 5; k++) {
        var cx = (k + (((r % 2) + 2) % 2) * 0.5) * 2 * rx + rx * (((r % 2) + 2) % 2 ? 0 : 0), cy = r * ry;
        c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI); c.stroke();
      }
    }); } }
  ];
  Array.prototype.push.apply(SHAPES, PATTERNS);
  // The dynamic Player Name + Flag box. The text and flag are not part of the design: they come from recipe.pl = { n: name, c: country name }
  // (saved once into the member's helmet when they pick it) or, in the admin preview, from opts.player.
  SHAPES.push({ id: 'player_name', name: 'Player name', player: true, draw: function () {} });
  SHAPES.push({ id: 'player_number', name: 'Player number', player: true, draw: function () {} });
  SHAPES.push({ id: 'player', name: 'Player name and flag', player: true, draw: function () {} });
  SHAPES.push({ id: 'player_num', name: 'Player name, flag and number', player: true, draw: function () {} });
  function isPlayerId(id) { return id === 'player' || id === 'player_name' || id === 'player_num' || id === 'player_number'; }
  function flagUrlOf(country) { return (country && typeof countryFlagSrc === 'function') ? countryFlagSrc(country) : ''; }
  function drawPlayerBox(c, l, w, h, pl, flagImg) {
    var name = String((pl && pl.n) || 'DRIVER NAME').toUpperCase(), hasFlag = !!flagImg && l.s !== 'player_name' && l.s !== 'player_number';
    if (l.s === 'player_number') name = String((pl && pl.u) || '').toUpperCase();   // the car number alone
    if (l.s === 'player_num' && pl && pl.u) name += '  #' + pl.u;
    if (!name) return;
    // the flag is exactly as tall as the capital letters of the name (cap height is about 0.72 of the font size)
    var CAP = 0.72, size = h * 0.8, fh = 0, fw = 0, gap = 0, mw = 0, it;
    for (it = 0; it < 3; it++) {
      fh = size * CAP; fw = fh * 1.5; gap = hasFlag ? Math.max(2, size * 0.18) : 0;
      c.font = 'italic 800 ' + size + 'px "Arial Narrow", Arial, Helvetica, sans-serif';
      mw = c.measureText(name).width;
      var tw = w - (hasFlag ? fw + gap : 0);
      if (mw > tw) size = size * tw / mw; else break;
    }
    fh = size * CAP; fw = fh * 1.5; gap = hasFlag ? Math.max(2, size * 0.18) : 0;
    c.font = 'italic 800 ' + size + 'px "Arial Narrow", Arial, Helvetica, sans-serif';
    mw = c.measureText(name).width;
    var total = (hasFlag ? fw + gap : 0) + mw, x0 = -total / 2;
    if (l.bg) {   // optional background rectangle with a little padding around the flag and name
      var pad = Math.max(2, h * 0.22), bh = size * CAP + pad * 2;
      c.fillStyle = hexOf(l.bg); rrect(c, x0 - pad, -bh / 2, total + pad * 2, bh, Math.max(1, bh * 0.1)); c.fill();
    }
    if (hasFlag) c.drawImage(flagImg, x0, -fh / 2, fw, fh);
    c.fillStyle = hexOf(l.c); c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.fillText(name, x0 + (hasFlag ? fw + gap : 0), fh / 2);   // baseline at the bottom of the flag, so the capitals line up with it
  }
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
  // Reads one pixel of a design's pattern picture. Only two accent colors exist: lime #9BF20C = Accent 2 and pure blue =
  // Accent 1. Everything else (magenta shell color, transparent, and the old pure red) is the base color.
  // Returns [accent2, accent1] weights. Each pixel is split into lime + blue + magenta shares so soft edges blend.
  var LIME_ = [155 / 255, 242 / 255, 12 / 255];
  function patternWeights(pr, pg, pb, al) {
    var wL = pg / LIME_[1]; if (wL > 1) wL = 1;                  // only lime has green
    var wM = pr - LIME_[0] * wL; if (wM < 0) wM = 0;             // magenta (shell) share
    var wB = pb - LIME_[2] * wL - wM; if (wB < 0) wB = 0;        // blue (accent 1) share
    if (wB > 1) wB = 1;
    return [al * wL, al * wB];
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
        var sl = { s: l.s, c: (typeof l.c === 'string' && l.c) ? l.c : 'red', m: '', v: 'std', f: '', x: +l.x || 0, y: +l.y || 0, w: +l.w || 200, h: +l.h || 200, r: +l.r || 0, sh: l.sh === 0 ? 0 : (l.sh === 2 ? 2 : 1) };
        if (isPlayerId(l.s) && typeof l.bg === 'string' && l.bg) sl.bg = l.bg;
        if (l.fx) sl.fx = 1;   // fx = mirrored left to right
        if (+l.bw >= 1 && borderOk(l.s)) { sl.bw = Math.min(20, Math.round(+l.bw)); sl.bc = (typeof l.bc === 'string' && l.bc) ? l.bc : 'black'; }   // border size (px) and color
        if (+l.o >= 5 && +l.o < 100) sl.o = Math.round(+l.o);   // o = percent visible (omitted = solid)
        if (shapeById(l.s).gradient || l.s === 'checker') sl.c2 = (typeof l.c2 === 'string' && l.c2) ? l.c2 : (l.s === 'checker' ? 'white' : 'black');
        out.logos.push(sl);
        return;
      }
      if (!l || !(l.f || l.m)) return;
      var il = { m: l.m ? String(l.m) : '', v: (l.v === 'white' || l.v === 'black') ? l.v : 'std', f: l.f ? String(l.f) : '', x: +l.x || 0, y: +l.y || 0, w: +l.w || 200, h: +l.h || 200, r: +l.r || 0, sh: l.sh === 0 ? 0 : (l.sh === 2 ? 2 : 1) };
      if (l.fx) il.fx = 1;
      if (l.st) il.st = 1;   // width and height set apart: the picture is stretched to the box
      if (+l.o >= 5 && +l.o < 100) il.o = Math.round(+l.o);
      out.logos.push(il);
    });
    var acN = Math.floor(+r.ac); if (acN > 0 && out.logos.length) out.ac = Math.min(acN, out.logos.length);   // ac = how many layers sit UNDER the accent paint (0 = all layers are on top of the accents)
    if (r.pl && typeof r.pl === 'object') out.pl = { n: String(r.pl.n || '').slice(0, 40), c: String(r.pl.c || '').slice(0, 60), u: String(r.pl.u || '').slice(0, 4) };
    return out;
  }
  // shapes that can have a border: basic and advanced shapes and the player number (not gradients, weathering, patterns or the name boxes)
  function borderOk(id) { var sh = shapeById(id); return !!sh && !sh.gradient && !sh.weathering && !sh.pattern && (!isPlayerId(id) || id === 'player_number'); }
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
      var sp = u > 0.992 ? (u - 0.992) / 0.008 : 0;
      k = clamp(SH * 1.12, 0, 1.12) * (0.94 + 0.03 * nz * (scale < 0.4 ? 0.3 : 1));
      r *= k; g *= k; b *= k;
      w = HL * 0.7;
      if (scale >= 0.4 && sp > 0) { r += (255 - r) * sp * 0.4; g += (255 - g) * sp * 0.4; b += (255 - b) * sp * 0.4; }
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
    var plInfo = recipe.pl || opts.player || null;
    var logoLoads = recipe.logos.map(function (l) { if (isPlayerId(l.s)) { if (l.s === 'player_name' || l.s === 'player_number') return Promise.resolve(true); var fu = flagUrlOf(plInfo && plInfo.c); return fu ? loadFirst([fu]).then(function (im) { return im || true; }) : Promise.resolve(true); } return l.s ? Promise.resolve(true) : loadFirst(logoCandidates(l)); });
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
      var vis = findVisor(recipe.v), v1 = hexRgb(vis.c1), v2 = hexRgb(vis.c2), vst = vis.stops ? vis.stops.map(hexRgb) : null;

      var N = Wt * Ht;
      var out = new Float32Array(N * 4);
      var specK = new Float32Array(N);
      var accCov = new Float32Array(N);            // how much of each pixel is accent 1 or 2 paint (drives the soft shadow below the accents)
      var cOut = [0, 0, 0];
      var staged = recipe.ac > 0;                  // some layers sit between the base paint and the accent paint
      var baseOnly = staged ? new Float32Array(N * 3) : null, accC = staged ? new Float32Array(N * 3) : null, accA = staged ? new Float32Array(N) : null;

      for (var py = 0; py < Ht; py++) {
        var sy = CROP.y + (py + 0.5) / scale;
        for (var px = 0; px < Wt; px++) {
          var i = py * Wt + px, o = i * 4;
          var sx = CROP.x + (px + 0.5) / scale;
          var bR = base[o], bG = base[o + 1], bB = base[o + 2];
          var sm = m1[o] / 255, gl = m1[o + 1] / 255, SH = m1[o + 2] / 200, HL = m2[o + 1] / 255;
          var r = bR, g = bG, b = bB;

          if (sm > 0.001) {
            // pattern weights: lime (#9BF20C) = accent 2, blue = accent 1, anything else (magenta, transparent, old red) = base
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
            var pr_ = 0, pg_ = 0, pb_ = 0, sk = 0, fb0 = 0, fb1 = 0, fb2 = 0, fbOk = false, ac0 = 0, ac1 = 0, ac2 = 0;
            if (wB > 0.002) { finishPx(kB, cB, SH, HL, sx, sy, scale); pr_ += T[0] * wB; pg_ += T[1] * wB; pb_ += T[2] * wB; sk += sB * wB; fb0 = T[0]; fb1 = T[1]; fb2 = T[2]; fbOk = true; }
            if (wA > 0.002) { finishPx(kA1, cA1, SH, HL, sx, sy, scale); pr_ += T[0] * wA; pg_ += T[1] * wA; pb_ += T[2] * wA; sk += sA1 * wA; ac0 += T[0] * wA; ac1 += T[1] * wA; ac2 += T[2] * wA; }
            if (wS > 0.002) { finishPx(kA2, cA2, SH, HL, sx, sy, scale); pr_ += T[0] * wS; pg_ += T[1] * wS; pb_ += T[2] * wS; sk += sA2 * wS; ac0 += T[0] * wS; ac1 += T[1] * wS; ac2 += T[2] * wS; }
            if (staged) {
              // what this pixel looks like with base paint only, and the accent paint on its own (so layers can sit in between)
              if (!fbOk) { finishPx(kB, cB, SH, HL, sx, sy, scale); fb0 = T[0]; fb1 = T[1]; fb2 = T[2]; }
              baseOnly[i * 3] = bR * (1 - sm) + clamp(fb0, 0, 255) * sm; baseOnly[i * 3 + 1] = bG * (1 - sm) + clamp(fb1, 0, 255) * sm; baseOnly[i * 3 + 2] = bB * (1 - sm) + clamp(fb2, 0, 255) * sm;
              var wac = wA + wS;
              if (wac > 0.002) { accC[i * 3] = clamp(ac0 / wac, 0, 255); accC[i * 3 + 1] = clamp(ac1 / wac, 0, 255); accC[i * 3 + 2] = clamp(ac2 / wac, 0, 255); accA[i] = wac * sm; }
            }
            r = r * (1 - sm) + clamp(pr_, 0, 255) * sm;
            g = g * (1 - sm) + clamp(pg_, 0, 255) * sm;
            b = b * (1 - sm) + clamp(pb_, 0, 255) * sm;
            specK[i] = sk;
            accCov[i] = (wA + wS) * sm;
          }
          if (gl > 0.001) {
            var t2 = clamp(((sx - 80) + (sy - 420) * 0.6) / 700, 0, 1);
            var vr = v1[0] * (1 - t2) + v2[0] * t2, vg = v1[1] * (1 - t2) + v2[1] * t2, vb = v1[2] * (1 - t2) + v2[2] * t2;
            if (vst) { var tv = clamp((sy - 440) / 250, 0, 1), sp = tv * (vst.length - 1), si = Math.min(vst.length - 2, Math.floor(sp)), sf = sp - si; vr = vst[si][0] * (1 - sf) + vst[si + 1][0] * sf; vg = vst[si][1] * (1 - sf) + vst[si + 1][1] * sf; vb = vst[si][2] * (1 - sf) + vst[si + 1][2] * sf; }
            var gdx = sx - (230 + (sy - 420) * -0.30), gdx2 = sx - (330 + (sy - 420) * -0.30);
            var glint = (Math.exp(-(gdx / 38) * (gdx / 38)) * 0.55 + Math.exp(-(gdx2 / 10) * (gdx2 / 10)) * 0.5) * 0.8;
            glint = glint > 1 ? 1 : glint;
            vr += (255 - vr) * glint; vg += (255 - vg) * glint; vb += (255 - vb) * glint;
            var lm = 0.75 + 0.35 * ((bR + bG + bB) / 765);
            vr *= lm; vg *= lm; vb *= lm;
            var va = vis.a == null ? 1 : vis.a, ga = gl * (va + (1 - va) * glint);   // a see-through visor keeps its glare solid
            r = r * (1 - ga) + vr * ga; g = g * (1 - ga) + vg * ga; b = b * (1 - ga) + vb * ga;
          }
          out[o] = clamp(r, 0, 255); out[o + 1] = clamp(g, 0, 255); out[o + 2] = clamp(b, 0, 255); out[o + 3] = m2[o] ;
        }
      }
      // soft shadow cast by the accent paint onto the base paint below it (same look as the logo shadow)
      function applyAccShadow(buf) {
        var any = false, q0;
        for (q0 = 0; q0 < N; q0++) if (accCov[q0] > 0.01) { any = true; break; }
        if (!any) return;
        var dy = Math.max(1, Math.round(2.5 * scale)), rad = Math.max(1, Math.round(3.5 * scale));
        var tmp = new Float32Array(N), blur = new Float32Array(N), x, y, k, acc2, cnt;
        for (y = 0; y < Ht; y++) {                       // horizontal box blur, two passes
          for (x = 0; x < Wt; x++) {
            acc2 = 0; cnt = 0;
            for (k = -rad; k <= rad; k++) { var xx = x + k; if (xx >= 0 && xx < Wt) { acc2 += accCov[y * Wt + xx]; cnt++; } }
            tmp[y * Wt + x] = acc2 / (2 * rad + 1);
          }
        }
        for (x = 0; x < Wt; x++) {                       // vertical blur, read from dy rows above so the shadow lands below
          for (y = 0; y < Ht; y++) {
            acc2 = 0;
            for (k = -rad; k <= rad; k++) { var yy = y - dy + k; if (yy >= 0 && yy < Ht) acc2 += tmp[yy * Wt + x]; }
            blur[y * Wt + x] = acc2 / (2 * rad + 1);
          }
        }
        for (q0 = 0; q0 < N; q0++) {
          var sa = blur[q0] * (1 - accCov[q0]) * 0.5 * (m1[q0 * 4] / 255);
          if (sa <= 0.003) continue;
          var f = 1 - sa, oq = q0 * 4;
          buf[oq] *= f; buf[oq + 1] *= f; buf[oq + 2] *= f;
        }
      }

      // logos (clipped to the shell so they never float off the helmet)
      function layersPass(lo, hi, target) {
      var hasLogo = false, li;
      for (li = lo; li < hi; li++) if (logoImgs[li]) hasLogo = true;
      if (hasLogo) {
        var lc = document.createElement('canvas'); lc.width = Wt; lc.height = Ht;
        var lx = lc.getContext('2d', { willReadFrequently: true });
        recipe.logos.forEach(function (l, idx) {
          if (idx < lo || idx >= hi) return;
          var im = logoImgs[idx]; if (!im) return;
          var op = (l.o > 0 && l.o < 100) ? l.o / 100 : 1, g = lx, tcv = null;
          if (op < 1) { tcv = document.createElement('canvas'); tcv.width = Wt; tcv.height = Ht; g = tcv.getContext('2d'); }   // draw on a spare canvas, then lay it over at the chosen see-through amount
          g.save();
          g.translate((l.x - CROP.x) * scale, (l.y - CROP.y) * scale);
          g.rotate(-l.r * Math.PI / 180);
          if (l.fx) g.scale(-1, 1);   // mirrored left to right
          if (l.sh === 2) { g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = Math.max(3, 13 * scale); g.shadowOffsetX = 0; g.shadowOffsetY = Math.max(2, 5 * scale); }   // strong shadow
          else if (l.sh) { g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = Math.max(2, 7 * scale); g.shadowOffsetX = 0; g.shadowOffsetY = Math.max(1, 2 * scale); }
          if (l.s) {
            var paintShape = function (gg) {
              if (isPlayerId(l.s)) { drawPlayerBox(gg, l, l.w * scale, l.h * scale, plInfo, im !== true ? im : null); }
              else { gg.fillStyle = hexOf(l.c); shapeById(l.s).draw(gg, l.w * scale, l.h * scale, hexOf(l.c), hexOf(l.c2 || 'black')); }
            };
            var bwPx = (+l.bw >= 1 && borderOk(l.s)) ? Math.min(20, +l.bw) * scale : 0;
            if (bwPx > 0) {
              // border: the shape's outline is flattened to the border color, spread outward all around, then the shape is drawn on top
              var pad = Math.ceil(bwPx) + 4, cw = Math.ceil(l.w * scale) + pad * 2, ch = Math.ceil(l.h * scale) + pad * 2;
              var sil = document.createElement('canvas'); sil.width = cw; sil.height = ch;
              var sg = sil.getContext('2d'); sg.translate(cw / 2, ch / 2); paintShape(sg);
              sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = hexOf(l.bc || 'black'); sg.fillRect(0, 0, cw, ch);
              var comp = document.createElement('canvas'); comp.width = cw; comp.height = ch;
              var cg = comp.getContext('2d'), rings = [1, 0.66, 0.33], ri, ki;
              for (ri = 0; ri < rings.length; ri++) for (ki = 0; ki < 32; ki++) { var an = ki / 32 * Math.PI * 2; cg.drawImage(sil, Math.cos(an) * bwPx * rings[ri], Math.sin(an) * bwPx * rings[ri]); }
              cg.drawImage(sil, 0, 0);
              cg.translate(cw / 2, ch / 2); paintShape(cg);
              g.drawImage(comp, -cw / 2, -ch / 2);
            } else paintShape(g);
          } else {
            var nw = im.naturalWidth || 300, nh = im.naturalHeight || 300;
            var fit = Math.min(l.w / nw, l.h / nh);
            var dw = nw * fit * scale, dh = nh * fit * scale;
            if (l.st) { dw = l.w * scale; dh = l.h * scale; }   // stretched on purpose (width and height set apart)
            g.drawImage(im, -dw / 2, -dh / 2, dw, dh);
          }
          g.restore();
          if (tcv) { lx.globalAlpha = op; lx.drawImage(tcv, 0, 0); lx.globalAlpha = 1; }
        });
        var ld = lx.getImageData(0, 0, Wt, Ht).data;
        for (var q = 0; q < N; q++) {
          var la = ld[q * 4 + 3] / 255; if (la <= 0) continue;
          la *= m1[q * 4] / 255;
          var oo = q * 4;
          target[oo] = target[oo] * (1 - la) + ld[oo] * la;
          target[oo + 1] = target[oo + 1] * (1 - la) + ld[oo + 1] * la;
          target[oo + 2] = target[oo + 2] * (1 - la) + ld[oo + 2] * la;
        }
      }
      }
      if (!staged) {
        applyAccShadow(out);
        if (scale >= 0.45) sharpen(out, Wt, Ht, 1.2 * scale / 1.0, 0.9, 3);
        layersPass(0, recipe.logos.length, out);
      } else {
        // layers under the accents: base paint, then those layers (and the accent shadow falling on them), then the accent paint, then the rest
        var outB = new Float32Array(out), qb;
        for (qb = 0; qb < N; qb++) if (accA[qb] > 0.001) { outB[qb * 4] = baseOnly[qb * 3]; outB[qb * 4 + 1] = baseOnly[qb * 3 + 1]; outB[qb * 4 + 2] = baseOnly[qb * 3 + 2]; }
        layersPass(0, recipe.ac, outB);
        applyAccShadow(outB);
        for (qb = 0; qb < N; qb++) {
          var aa = accA[qb], ob = qb * 4;
          if (aa > 0.001) { out[ob] = outB[ob] * (1 - aa) + accC[qb * 3] * aa; out[ob + 1] = outB[ob + 1] * (1 - aa) + accC[qb * 3 + 1] * aa; out[ob + 2] = outB[ob + 2] * (1 - aa) + accC[qb * 3 + 2] * aa; }
          else { out[ob] = outB[ob]; out[ob + 1] = outB[ob + 1]; out[ob + 2] = outB[ob + 2]; }
        }
        if (scale >= 0.45) sharpen(out, Wt, Ht, 1.2 * scale / 1.0, 0.9, 3);
        layersPass(recipe.ac, recipe.logos.length, out);
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

  // width / height of a logo's picture (null for shapes or a missing picture), so the editor can scale it proportionally
  function imageAspect(l) {
    if (!l || l.s) return Promise.resolve(null);
    return loadFirst(logoCandidates(l)).then(function (im) { return im && im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : null; }).catch(function () { return null; });
  }

  window.RCHelmet = {
    PALETTE: PALETTE, SHAPES: SHAPES, FINISHES: FINISHES, VISORS: VISORS, CROP: CROP,
    configure: configure, pruneDesigns: pruneDesigns, defaultRecipe: defaultRecipe, randomRecipe: randomRecipe, normalizeRecipe: normalizeRecipe,
    hexOf: hexOf, render: render, mount: mount, getConfig: function () { return cfg; }, visibleDesigns: visibleDesigns, imageAspect: imageAspect
  };
})();
