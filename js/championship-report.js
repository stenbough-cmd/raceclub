// Race Club -- Championship Driver Report (js/championship-report.js)
// The DRIVER REPORT section of the Race Recap popup (above the Race Report). Built from
// result.driverReport (Championship.gs _champDriverReport_): the player's laps, fuel, tyres, pit
// stops, pace, contacts and qualifying, compared with the whole class or with the nearest rivals.
// Charts are hand-drawn SVG and plain HTML, no libraries. Uses championship.js helpers (_rccEl,
// _rccText, _rccLapTime, _rccEventTime). Owned by the CHAMP chat.
//
// Colours (validated with the dataviz palette checker, light surface): you, then up to four
// rivals in a fixed order. The class average uses the first rival slot's blue. Tread uses status
// colours and always shows its percentage, so colour is never the only cue.
var RCR_YOU = '#d7261e';
var RCR_SERIES = ['#2f6fb5', '#a86f12', '#8150c0', '#24855a'];
var RCR_FIELD = '#c3c9d2';
var RCR_FAST = '#2f6fb5';
var RCR_SLOW = '#a86f12';

// Charts are drawn at roughly their on-screen width so their text stays the same size on any
// screen (the popup is about the window width minus its margins, up to 1000px).
function _rcrWidth(share) {
  var w = Math.max(320, Math.min(1000, (window.innerWidth || 1000) - 90));
  return Math.round(share && w > 760 ? w * share : w);
}
function _rcrPct(v) { return v === null || v === undefined || isNaN(v) ? '--' : Math.round(v * 100) + '%'; }
function _rcrNum(v, d) { return v === null || v === undefined || isNaN(v) ? '--' : Number(v).toFixed(d === undefined ? 1 : d); }
function _rcrSigned(v, d, unit) {
  if (v === null || v === undefined || isNaN(v)) return '--';
  return (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(d === undefined ? 2 : d) + (unit || '');
}
function _rcrAvg(arr) {
  var a = arr.filter(function (v) { return v !== null && v !== undefined && !isNaN(v); });
  return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null;
}
function _rcrShort(name) { var p = String(name || '').split(' '); return p.length > 1 ? p[p.length - 1] : name; }
function _rcrTread(v) { return v === null || v === undefined ? '#c3c9d2' : v >= 0.6 ? '#2e9e5b' : v >= 0.35 ? '#d4a017' : '#d7261e'; }
function _rcrSvg(tag, attrs) {
  var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
  return e;
}

// One shared tooltip per chart wrapper.
function _rcrTip(wrap) {
  var tip = _rccEl('div', 'rcr-tip');
  wrap.appendChild(tip);
  return {
    show: function (html, x, y) {
      tip.innerHTML = html;
      tip.style.display = 'block';
      var w = wrap.clientWidth, tw = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(w - tw, x + 12)) + 'px';
      tip.style.top = Math.max(0, y - tip.offsetHeight - 8) + 'px';
    },
    hide: function () { tip.style.display = 'none'; }
  };
}

function _rcrLegend(items) {
  var lg = _rccEl('div', 'rcr-legend');
  items.forEach(function (it) {
    var li = _rccEl('span', 'rcr-legend-item');
    var sw = _rccEl('span', 'rcr-legend-swatch' + (it.dash ? ' rcr-legend-dash' : ''));
    sw.style.background = it.dash ? 'transparent' : it.color;
    sw.style.borderColor = it.color;
    li.appendChild(sw);
    li.appendChild(_rccText('span', null, it.name));
    lg.appendChild(li);
  });
  return lg;
}

// Line chart. opts: { series: [{ name, color, values, faint, dash, marks: [index...] }], labels,
// yInvert, yMin, yMax, yFmt, yTicks, height, legend }
function _rcrLineChart(opts) {
  var W = _rcrWidth(opts.share), H = opts.height || 240, L = 44, R = 14, T = 12, B = 28;
  var wrap = _rccEl('div', 'rcr-chart');
  var n = Math.max.apply(null, opts.series.map(function (s) { return s.values.length; }).concat([1]));
  var all = [];
  opts.series.forEach(function (s) { s.values.forEach(function (v) { if (v !== null && v !== undefined && !isNaN(v)) all.push(v); }); });
  var yMin = opts.yMin !== undefined ? opts.yMin : Math.min.apply(null, all.concat([0]));
  var yMax = opts.yMax !== undefined ? opts.yMax : Math.max.apply(null, all.concat([1]));
  if (yMax === yMin) yMax = yMin + 1;
  var x = function (i) { return L + (n <= 1 ? 0 : i * (W - L - R) / (n - 1)); };
  var y = function (v) { var f = (v - yMin) / (yMax - yMin); return opts.yInvert ? T + f * (H - T - B) : H - B - f * (H - T - B); };
  var svg = _rcrSvg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'rcr-svg', role: 'img', 'aria-label': opts.title || 'Chart' });
  var ticks = opts.yTicks || 4;
  var tickVals = [];
  if (opts.yStep) { for (var tv = yMin; tv <= yMax + 1e-9; tv += opts.yStep) tickVals.push(tv); }
  else { for (var k0 = 0; k0 <= ticks; k0++) tickVals.push(yMin + k0 * (yMax - yMin) / ticks); }
  for (var k = 0; k < tickVals.length; k++) {
    var v = tickVals[k];
    var yy = y(v);
    svg.appendChild(_rcrSvg('line', { x1: L, x2: W - R, y1: yy, y2: yy, class: 'rcr-grid' }));
    var tl = _rcrSvg('text', { x: L - 6, y: yy + 4, class: 'rcr-axis', 'text-anchor': 'end' });
    tl.textContent = opts.yFmt ? opts.yFmt(v) : Math.round(v);
    svg.appendChild(tl);
  }
  var step = Math.max(1, Math.ceil(n / 12));
  for (var i = 0; i < n; i += step) {
    var xl = _rcrSvg('text', { x: x(i), y: H - 8, class: 'rcr-axis', 'text-anchor': 'middle' });
    xl.textContent = (opts.labels && opts.labels[i] !== undefined) ? opts.labels[i] : (i + 1);
    svg.appendChild(xl);
  }
  // Faint series first, then the coloured ones, the player last (on top).
  var order = opts.series.slice().sort(function (a, b) { return (a.faint ? 0 : a.isYou ? 2 : 1) - (b.faint ? 0 : b.isYou ? 2 : 1); });
  order.forEach(function (s) {
    var d = '', pen = false;
    s.values.forEach(function (v, j) {
      if (v === null || v === undefined || isNaN(v)) { pen = false; return; }
      d += (pen ? 'L' : 'M') + x(j).toFixed(1) + ' ' + y(v).toFixed(1) + ' ';
      pen = true;
    });
    if (!d) return;
    svg.appendChild(_rcrSvg('path', { d: d, fill: 'none', stroke: s.faint ? RCR_FIELD : s.color, 'stroke-width': s.isYou ? 3 : (s.faint ? 1.25 : 2),
      'stroke-dasharray': s.dash ? '6 4' : 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    (s.marks || []).forEach(function (j) {
      var v = s.values[j];
      if (v === null || v === undefined) return;
      svg.appendChild(_rcrSvg('circle', { cx: x(j), cy: y(v), r: 5, fill: '#fff', stroke: s.color, 'stroke-width': 2.5 }));
    });
  });
  // Hover: crosshair + tooltip with every named series at that lap.
  var cross = _rcrSvg('line', { x1: 0, x2: 0, y1: T, y2: H - B, class: 'rcr-cross' });
  cross.style.display = 'none';
  svg.appendChild(cross);
  var hit = _rcrSvg('rect', { x: L, y: T, width: W - L - R, height: H - T - B, fill: 'transparent' });
  svg.appendChild(hit);
  wrap.appendChild(svg);
  var tip = _rcrTip(wrap);
  hit.addEventListener('mousemove', function (ev) {
    var box = svg.getBoundingClientRect();
    var px = (ev.clientX - box.left) * W / box.width;
    var j = Math.max(0, Math.min(n - 1, Math.round((px - L) / ((W - L - R) / Math.max(1, n - 1)))));
    cross.setAttribute('x1', x(j)); cross.setAttribute('x2', x(j)); cross.style.display = '';
    var rows = opts.series.filter(function (s) { return !s.faint; }).map(function (s) {
      var v = s.values[j];
      return '<div><span class="rcr-tip-dot" style="background:' + s.color + '"></span>' + _rccEsc(s.name) + ' <b>' +
        (v === null || v === undefined ? '--' : (opts.yFmt ? opts.yFmt(v) : v)) + '</b></div>';
    }).join('');
    tip.show('<div class="rcr-tip-head">' + (opts.xName || 'Lap') + ' ' + ((opts.labels && opts.labels[j]) || (j + 1)) + '</div>' + rows,
      (ev.clientX - box.left), (ev.clientY - box.top));
  });
  hit.addEventListener('mouseleave', function () { cross.style.display = 'none'; tip.hide(); });
  if (opts.legend !== false) {
    var named = opts.series.filter(function (s) { return !s.faint; });
    if (named.length > 1 || opts.faintName) {
      var items = named.map(function (s) { return { name: s.name, color: s.color, dash: s.dash }; });
      if (opts.faintName) items.push({ name: opts.faintName, color: RCR_FIELD });
      wrap.appendChild(_rcrLegend(items));
    }
  }
  return wrap;
}

// Horizontal bars, one row per entry: [{ name, value, color, isYou, note }]. Longer bar = bigger value.
function _rcrBars(rows, fmt, opts) {
  opts = opts || {};
  var box = _rccEl('div', 'rcr-bars');
  var vals = rows.map(function (r) { return r.value; }).filter(function (v) { return v !== null && v !== undefined && !isNaN(v); });
  var max = opts.max || Math.max.apply(null, vals.concat([0.0001]));
  var min = opts.min !== undefined ? opts.min : 0;
  rows.forEach(function (r) {
    var row = _rccEl('div', 'rcr-bar-row' + (r.isYou ? ' rcr-bar-you' : ''));
    row.appendChild(_rccText('div', 'rcr-bar-name', r.name));
    var track = _rccEl('div', 'rcr-bar-track');
    var fill = _rccEl('div', 'rcr-bar-fill');
    var f = r.value === null || r.value === undefined ? 0 : Math.max(0.02, (r.value - min) / (max - min));
    fill.style.width = Math.min(100, f * 100) + '%';
    fill.style.background = r.color || (r.isYou ? RCR_YOU : RCR_FIELD);
    track.appendChild(fill);
    row.appendChild(track);
    row.appendChild(_rccText('div', 'rcr-bar-val', fmt(r.value)));
    row.title = r.name + ': ' + fmt(r.value) + (r.note ? ' (' + r.note + ')' : '');
    box.appendChild(row);
  });
  return box;
}

// Diverging bars around zero: [{ name, delta }]; negative = you were quicker (or used less).
function _rcrDiverging(rows, fmt, words) {
  var box = _rccEl('div', 'rcr-div');
  var maxAbs = Math.max.apply(null, rows.map(function (r) { return Math.abs(r.delta || 0); }).concat([0.0001]));
  rows.forEach(function (r) {
    var row = _rccEl('div', 'rcr-div-row');
    row.appendChild(_rccText('div', 'rcr-bar-name', r.name));
    var track = _rccEl('div', 'rcr-div-track');
    track.appendChild(_rccEl('div', 'rcr-div-mid'));
    if (r.delta !== null && r.delta !== undefined && !isNaN(r.delta)) {
      var fill = _rccEl('div', 'rcr-div-fill ' + (r.delta < 0 ? 'rcr-div-good' : 'rcr-div-bad'));
      var w = Math.max(1.5, Math.abs(r.delta) / maxAbs * 50);
      fill.style.width = w + '%';
      fill.style.left = r.delta < 0 ? (50 - w) + '%' : '50%';
      track.appendChild(fill);
    }
    row.appendChild(track);
    var txt = r.delta === null || r.delta === undefined || isNaN(r.delta) ? '--' : fmt(Math.abs(r.delta)) + ' ' + (r.delta < 0 ? words[0] : r.delta > 0 ? words[1] : '');
    row.appendChild(_rccText('div', 'rcr-bar-val', txt));
    box.appendChild(row);
  });
  var key = _rccEl('div', 'rcr-div-key');
  key.appendChild(_rccText('span', 'rcr-div-key-good', '◀ ' + words[0]));
  key.appendChild(_rccText('span', 'rcr-div-key-bad', words[1] + ' ▶'));
  box.appendChild(key);
  return box;
}

function _rcrTile(label, value, sub, cls) {
  var t = _rccEl('div', 'rcr-tile' + (cls ? ' ' + cls : ''));
  t.appendChild(_rccText('div', 'rcr-tile-label', label));
  t.appendChild(_rccText('div', 'rcr-tile-value', value));
  if (sub) t.appendChild(_rccText('div', 'rcr-tile-sub', sub));
  return t;
}

function _rcrBlock(title, sub) {
  var b = _rccEl('div', 'rcr-block');
  var h = _rccEl('div', 'rcr-block-head');
  h.appendChild(_rccText('div', 'rcr-block-title', title));
  if (sub) h.appendChild(_rccText('div', 'rcr-block-sub', sub));
  b.appendChild(h);
  return b;
}

// Top-down car outline with four tyres, all closed-wheel (LMU races sports cars only). The tyres
// are drawn on top of the bodywork, inside the wheel arches, like an x-ray. shape: gt | prototype |
// hypercar. tread: [FL, FR, RL, RR].
var RCR_CARS = {
  // GT (GTE / GT3): a road-car shape. Long bonnet, glasshouse in the middle, fenders over the
  // wheels, mirrors, and a rear wing on stands.
  gt: {
    body: 'M58 26 Q80 18 102 26 Q128 32 134 52 L138 108 Q139 120 132 130 L132 190 Q139 200 138 212 L136 258 Q134 274 116 278 L44 278 Q26 274 24 258 L22 212 Q21 200 28 190 L28 130 Q21 120 22 108 L26 52 Q32 32 58 26 Z',
    glass: [
      { d: 'M40 110 Q80 96 120 110 L116 134 Q80 127 44 134 Z', cls: 'rcr-car-glass' },
      { d: 'M44 136 Q80 129 116 136 L116 180 Q80 185 44 180 Z', cls: 'rcr-car-roof' },
      { d: 'M44 182 Q80 187 116 182 L110 204 Q80 209 50 204 Z', cls: 'rcr-car-glass' }
    ],
    lines: ['M60 40 Q80 34 100 40', 'M64 60 L64 98', 'M96 60 L96 98', 'M46 222 L114 222'],
    extras: [
      { tag: 'rect', a: { x: 16, y: 118, width: 14, height: 6, rx: 3 } }, { tag: 'rect', a: { x: 130, y: 118, width: 14, height: 6, rx: 3 } },
      { tag: 'rect', a: { x: 28, y: 262, width: 104, height: 12, rx: 3 }, cls: 'rcr-car-wing' },
      { tag: 'rect', a: { x: 58, y: 250, width: 4, height: 14 }, cls: 'rcr-car-wing' }, { tag: 'rect', a: { x: 98, y: 250, width: 4, height: 14 }, cls: 'rcr-car-wing' }
    ],
    tyres: [[30, 58], [110, 58], [30, 206], [110, 206]], tw: 20, th: 44
  },
  // LMP2 / LMP3: a narrow tub and bubble canopy between pronounced wheel pods, a shark fin and a
  // full-width rear wing.
  prototype: {
    body: 'M24 64 Q22 34 40 29 Q57 25 62 38 Q80 45 98 38 Q103 25 120 29 Q138 34 136 64 L138 116 Q137 126 128 134 L126 184 Q136 190 138 204 L138 258 Q136 274 120 278 L40 278 Q24 274 22 258 L22 204 Q24 190 34 184 L32 134 Q23 126 22 116 Z',
    glass: [
      { d: 'M68 92 Q80 78 92 92 L94 150 Q80 160 66 150 Z', cls: 'rcr-car-glass' }
    ],
    lines: ['M80 160 L80 262', 'M62 40 Q61 90 56 132', 'M98 40 Q99 90 104 132', 'M50 138 L50 182', 'M110 138 L110 182'],
    extras: [
      { tag: 'rect', a: { x: 20, y: 264, width: 120, height: 12, rx: 3 }, cls: 'rcr-car-wing' }
    ],
    // Front splitter (floor), square and a little past the rounded nose.
    under: [{ tag: 'rect', a: { x: 22, y: 26, width: 116, height: 40, rx: 2 }, cls: 'rcr-car-splitter' }],
    tyres: [[28, 66], [112, 66], [28, 208], [112, 208]], tw: 20, th: 46
  },
  // Hypercar (LMH / LMDh): bigger and wider, with a long sculpted nose, tall front fenders, a
  // central canopy, wide rear haunches, a shark fin and a full-width wing.
  hypercar: {
    body: 'M46 30 Q80 20 114 30 Q138 38 142 64 L144 120 Q143 132 134 140 L132 182 Q142 188 144 202 L146 262 Q144 280 124 284 L36 284 Q16 280 14 262 L16 202 Q18 188 28 182 L26 140 Q17 132 16 120 L18 64 Q22 38 46 30 Z',
    glass: [
      { d: 'M66 90 Q80 74 94 90 L96 152 Q80 164 64 152 Z', cls: 'rcr-car-glass' }
    ],
    lines: ['M80 164 L80 268', 'M56 44 Q80 36 104 44', 'M60 52 L50 112', 'M100 52 L110 112', 'M46 144 L46 180', 'M114 144 L114 180', 'M50 200 L58 262', 'M110 200 L102 262'],
    extras: [
      { tag: 'rect', a: { x: 12, y: 270, width: 136, height: 12, rx: 3 }, cls: 'rcr-car-wing' }
    ],
    under: [{ tag: 'rect', a: { x: 16, y: 21, width: 128, height: 40, rx: 2 }, cls: 'rcr-car-splitter' }],
    tyres: [[22, 66], [118, 66], [22, 210], [118, 210]], tw: 20, th: 48
  }
};

function _rcrCar(shape, tread) {
  var def = RCR_CARS[shape] || RCR_CARS.gt;
  var svg = _rcrSvg('svg', { viewBox: '0 0 160 300', class: 'rcr-car rcr-car-' + (RCR_CARS[shape] ? shape : 'gt'), role: 'img', 'aria-label': 'Tyre tread on each corner' });
  (def.under || []).forEach(function (x) { svg.appendChild(_rcrSvg(x.tag, Object.assign({ class: x.cls }, x.a))); });
  svg.appendChild(_rcrSvg('path', { d: def.body, class: 'rcr-car-body' }));
  def.lines.forEach(function (d) { svg.appendChild(_rcrSvg('path', { d: d, class: 'rcr-car-line' })); });
  def.glass.forEach(function (g) { svg.appendChild(_rcrSvg('path', { d: g.d, class: g.cls })); });
  def.extras.forEach(function (x) { svg.appendChild(_rcrSvg(x.tag, Object.assign({ class: x.cls || 'rcr-car-mirror' }, x.a))); });
  ['FL', 'FR', 'RL', 'RR'].forEach(function (c, i) {
    var v = tread[i];
    var g = _rcrSvg('g', {});
    g.appendChild(_rcrSvg('rect', { x: def.tyres[i][0], y: def.tyres[i][1], width: def.tw, height: def.th, rx: 6, fill: _rcrTread(v), class: 'rcr-car-tyre' }));
    var t = _rcrSvg('title', {});
    t.textContent = c + ': ' + _rcrPct(v) + ' tread left';
    g.appendChild(t);
    svg.appendChild(g);
  });
  return svg;
}

// ---------------------------------------------------------------------------
// The section itself.
// ---------------------------------------------------------------------------
function _rccDriverReport(dr) {
  var sec = _rccEl('div', 'rcr-report');
  if (!dr) return null;
  var head = _rccEl('div', 'rcr-head');
  head.appendChild(_rccText('div', 'rcl-race-class-name', 'Driver Report'));
  var mode = 'class';
  var sw = null;
  if (dr.hasField && dr.rivals && dr.rivals.length) {
    sw = _rccEl('div', 'rcr-seg');
    [['class', 'Whole Class'], ['rivals', 'Nearest Rivals']].forEach(function (p) {
      var b = _rccText('button', 'rcr-seg-btn' + (p[0] === mode ? ' rcr-seg-on' : ''), p[1]);
      b.type = 'button';
      b.setAttribute('aria-pressed', p[0] === mode ? 'true' : 'false');
      b.addEventListener('click', function () {
        mode = p[0];
        Array.prototype.forEach.call(sw.children, function (x) { var on = x === b; x.classList.toggle('rcr-seg-on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        draw();
      });
      sw.appendChild(b);
    });
    head.appendChild(sw);
  }
  sec.appendChild(head);
  var body = _rccEl('div', 'rcr-body');
  sec.appendChild(body);
  function draw() { body.innerHTML = ''; _rcrDraw(body, dr, mode); }
  draw();
  return sec;
}

function _rcrDraw(body, dr, mode) {
  var you = dr.you || {};
  var cls = dr.classAvg || null;
  var rivals = dr.rivals || [];
  var lapLabels = (dr.laps || []).map(function (l) { return l.n; });
  var rivalSeries = function (key) {
    return rivals.map(function (r, i) {
      return { name: '#' + r.carNumber + ' ' + _rcrShort(r.name), color: RCR_SERIES[i % 4], values: (r.stats || {})[key] || [], marks: ((r.stats || {}).pits || []).map(function (p) { return p.lap - 1; }) };
    });
  };
  var youMarks = (you.pits || []).map(function (p) { return p.lap - 1; });
  var compName = mode === 'rivals' ? 'nearest rivals' : 'the class';
  var compStat = function (key) {
    if (mode === 'rivals') return _rcrAvg(rivals.map(function (r) { return (r.stats || {})[key]; }));
    return cls ? cls[key] : null;
  };
  var compArr = function (key, k) {
    if (mode === 'rivals') return _rcrAvg(rivals.map(function (r) { return ((r.stats || {})[key] || [])[k]; }));
    return cls ? (cls[key] || [])[k] : null;
  };

  if (!dr.hasField) {
    body.appendChild(_rccText('p', 'rcr-note', 'This round was uploaded before the Driver Report existed, so only your own numbers are shown. Erase this round and upload the same file again to compare yourself with the class and your nearest rivals.'));
  }

  // 1. Race at a glance.
  var g = dr.glance || {};
  var tiles = _rccEl('div', 'rcr-tiles');
  var gained = g.grid && g.finish ? g.grid - g.finish : null;
  tiles.appendChild(_rcrTile('Start to Finish', (g.grid ? 'P' + g.grid : '--') + ' → ' + (g.finish ? 'P' + g.finish : '--'),
    gained === null ? '' : (gained > 0 ? 'Gained ' + gained + (gained === 1 ? ' place' : ' places') : gained < 0 ? 'Lost ' + (-gained) + (gained === -1 ? ' place' : ' places') : 'Held position'),
    'rcr-tile-hero' + (gained > 0 ? ' rcr-up' : gained < 0 ? ' rcr-down' : '')));
  tiles.appendChild(_rcrTile('Best Lap', _rccLapTime(g.bestLap), 'Fastest possible ' + _rccLapTime(g.theoBest)));
  tiles.appendChild(_rcrTile('Laps', g.laps === null || g.laps === undefined ? '--' : String(g.laps), (g.classSize ? g.classSize + ' cars in ' + dr.carClass : '')));
  tiles.appendChild(_rcrTile('Pit Stops', String(g.pits || 0), (you.pits || []).map(function (p) { return 'Lap ' + p.lap + (p.tires ? ', fuel and tyres' : ', fuel only'); }).join(' · ')));
  tiles.appendChild(_rcrTile('Contacts', String(g.contacts || 0), g.trackLimitPoints ? 'Track limit points ' + g.trackLimitPoints : 'No track limit points'));
  body.appendChild(tiles);

  // 2. Position chart.
  if ((you.cp || []).length) {
    var pb = _rcrBlock('Race Position', 'Class position at the end of every lap. Circles mark pit stops.');
    var series = [];
    if (mode === 'class') {
      (dr.field || []).forEach(function (f) { if (!f.isPlayer && (f.cp || []).length) series.push({ name: f.name, faint: true, values: f.cp }); });
    } else {
      series = series.concat(rivalSeries('cp'));
    }
    series.push({ name: 'You', color: RCR_YOU, values: you.cp, marks: youMarks, isYou: true });
    pb.appendChild(_rcrLineChart({ title: 'Race position', series: series, labels: lapLabels, yInvert: true, yMin: 1, yMax: Math.max(g.classSize || 1, 2),
      yStep: (g.classSize || 2) <= 10 ? 1 : 2, yFmt: function (v) { return 'P' + Math.round(v); }, faintName: mode === 'class' ? 'Every other car' : null }));
    body.appendChild(pb);
  }

  // 3. Tyres.
  var laps = dr.laps || [];
  if (laps.length && laps.some(function (l) { return (l.w || []).some(function (v) { return v !== null; }); })) {
    var tb = _rcrBlock('Tyre Report', (laps[0].comp ? laps[0].comp + ' compound. ' : '') + 'Tread left on each corner.');
    var grid = _rccEl('div', 'rcr-tyre-grid');
    var snaps = [['Lap 1', laps[0]]];
    (you.pits || []).forEach(function (p) { var b = laps.filter(function (l) { return l.n === p.lap - 1; })[0]; if (b) snaps.push(['Pit In, Lap ' + p.lap, b]); });
    snaps.push(['Finish', laps[laps.length - 1]]);
    var carBox = _rccEl('div', 'rcr-car-box');
    var snapSel = _rccEl('div', 'rcr-seg rcr-seg-sm');
    var carHolder = _rccEl('div', 'rcr-car-holder');
    var cur = snaps.length - 1;
    function drawCar() {
      carHolder.innerHTML = '';
      var w = snaps[cur][1].w || [];
      var lab = function (c, i, side) {
        var d = _rccEl('div', 'rcr-corner rcr-corner-' + side);
        d.appendChild(_rccText('div', 'rcr-corner-name', c));
        var pc = _rccText('div', 'rcr-corner-pct', _rcrPct(w[i]));
        pc.style.color = w[i] !== null && w[i] < 0.35 ? '#b3261e' : '';
        d.appendChild(pc);
        var rate = (you.wpl || [])[i];
        var comp = compArr('wpl', i);
        d.appendChild(_rccText('div', 'rcr-corner-sub', rate ? (rate * 100).toFixed(1) + '% per lap' : ''));
        if (rate && comp) {
          var diff = (comp - rate) / comp;
          d.appendChild(_rccText('div', 'rcr-corner-cmp ' + (diff >= 0 ? 'rcr-good' : 'rcr-bad'), Math.abs(Math.round(diff * 100)) + '% ' + (diff >= 0 ? 'gentler' : 'harder') + ' than ' + compName));
        }
        return d;
      };
      var left = _rccEl('div', 'rcr-corners');
      left.appendChild(lab('Front Left', 0, 'l')); left.appendChild(lab('Rear Left', 2, 'l'));
      var right = _rccEl('div', 'rcr-corners');
      right.appendChild(lab('Front Right', 1, 'r')); right.appendChild(lab('Rear Right', 3, 'r'));
      carHolder.appendChild(left);
      carHolder.appendChild(_rcrCar(dr.carShape, w));
      carHolder.appendChild(right);
    }
    snaps.forEach(function (sn, i) {
      var b = _rccText('button', 'rcr-seg-btn' + (i === cur ? ' rcr-seg-on' : ''), sn[0]);
      b.type = 'button';
      b.addEventListener('click', function () {
        cur = i;
        Array.prototype.forEach.call(snapSel.children, function (x) { x.classList.toggle('rcr-seg-on', x === b); });
        drawCar();
      });
      snapSel.appendChild(b);
    });
    carBox.appendChild(snapSel);
    carBox.appendChild(carHolder);
    drawCar();
    grid.appendChild(carBox);
    // Tread over the race: your most-worn tyre against the comparison.
    var right2 = _rccEl('div', 'rcr-tyre-side');
    right2.appendChild(_rccText('div', 'rcr-mini-title', 'Most-worn tyre, lap by lap'));
    var tseries = [];
    if (mode === 'class' && cls) tseries.push({ name: 'Class average', color: RCR_SERIES[0], values: cls.tw || [], dash: true });
    if (mode === 'rivals') tseries = tseries.concat(rivalSeries('tw'));
    tseries.push({ name: 'You', color: RCR_YOU, values: you.tw || laps.map(function (l) { return Math.min.apply(null, (l.w || []).filter(function (v) { return v !== null; }).concat([1])); }), marks: youMarks, isYou: true });
    right2.appendChild(_rcrLineChart({ title: 'Tread left', series: tseries, labels: lapLabels, yMin: 0, yMax: 1, yFmt: function (v) { return Math.round(v * 100) + '%'; }, height: 230, share: 0.52 }));
    grid.appendChild(right2);
    tb.appendChild(grid);
    // Tread used per lap across the field.
    if (dr.hasField) {
      tb.appendChild(_rccText('div', 'rcr-mini-title', 'Tread used per lap (front left), lower is gentler'));
      var wrows = (mode === 'class' ? (dr.field || []) : (dr.field || []).filter(function (f) { return f.isPlayer || rivals.some(function (r) { return r.carNumber === f.carNumber; }); }))
        .filter(function (f) { return f.wpl && f.wpl[0]; })
        .map(function (f) { return { name: '#' + f.carNumber + ' ' + _rcrShort(f.name), value: f.wpl[0], isYou: f.isPlayer, color: f.isPlayer ? RCR_YOU : (mode === 'rivals' ? RCR_SERIES[rivals.map(function (r) { return r.carNumber; }).indexOf(f.carNumber) % 4] : RCR_FIELD) }; })
        .sort(function (a, b) { return a.value - b.value; });
      tb.appendChild(_rcrBars(wrows, function (v) { return (v * 100).toFixed(1) + '%'; }));
    }
    body.appendChild(tb);
  }

  // 4. Fuel.
  if (laps.some(function (l) { return l.fuel !== null; })) {
    var fb = _rcrBlock('Fuel Report', 'Fuel in the tank, as a share of a full tank.');
    var ft = _rccEl('div', 'rcr-tiles');
    var endFuel = laps[laps.length - 1].fuel;
    var compSf = compStat('sf'), compFpl = compStat('fpl');
    ft.appendChild(_rcrTile('Started With', _rcrPct(you.sf), compSf ? (mode === 'rivals' ? 'Rivals' : 'Class') + ' average ' + _rcrPct(compSf) : ''));
    ft.appendChild(_rcrTile('Fuel Per Lap', you.fpl ? (you.fpl * 100).toFixed(1) + '%' : '--',
      compFpl && you.fpl ? Math.abs(Math.round((compFpl - you.fpl) / compFpl * 100)) + '% ' + (you.fpl <= compFpl ? 'less' : 'more') + ' than ' + compName : ''));
    ft.appendChild(_rcrTile('Finished With', _rcrPct(endFuel), you.fpl && endFuel !== null ? (endFuel / you.fpl).toFixed(1) + ' laps to spare' : ''));
    var added = (you.pits || []).reduce(function (a, p) { return a + Math.max(0, (p.fuelOut || 0) - (p.fuelIn || 0)); }, 0);
    ft.appendChild(_rcrTile('Fuel Added', (you.pits || []).length ? _rcrPct(added) : 'None', (you.pits || []).length ? 'Across ' + you.pits.length + (you.pits.length === 1 ? ' stop' : ' stops') : 'No stop'));
    fb.appendChild(ft);
    var fseries = [];
    if (mode === 'class' && cls) fseries.push({ name: 'Class average', color: RCR_SERIES[0], values: cls.fl || [], dash: true });
    if (mode === 'rivals') fseries = fseries.concat(rivalSeries('fl'));
    fseries.push({ name: 'You', color: RCR_YOU, values: laps.map(function (l) { return l.fuel; }), marks: youMarks, isYou: true });
    fb.appendChild(_rcrLineChart({ title: 'Fuel left', series: fseries, labels: lapLabels, yMin: 0, yMax: 1, yFmt: function (v) { return Math.round(v * 100) + '%'; }, height: 220 }));
    if (dr.hasField) {
      fb.appendChild(_rccText('div', 'rcr-mini-title', 'Fuel per lap, lower is more efficient'));
      var frows = (mode === 'class' ? (dr.field || []) : (dr.field || []).filter(function (f) { return f.isPlayer || rivals.some(function (r) { return r.carNumber === f.carNumber; }); }))
        .filter(function (f) { return f.fpl; })
        .map(function (f) { return { name: '#' + f.carNumber + ' ' + _rcrShort(f.name), value: f.fpl, isYou: f.isPlayer, color: f.isPlayer ? RCR_YOU : (mode === 'rivals' ? RCR_SERIES[rivals.map(function (r) { return r.carNumber; }).indexOf(f.carNumber) % 4] : RCR_FIELD) }; })
        .sort(function (a, b) { return a.value - b.value; });
      fb.appendChild(_rcrBars(frows, function (v) { return (v * 100).toFixed(1) + '%'; }));
    }
    if (you.vpl) fb.appendChild(_rccText('p', 'rcr-note', 'Virtual energy per lap: ' + (you.vpl * 100).toFixed(1) + '%' + (compStat('vpl') ? ' (' + compName + ' ' + (compStat('vpl') * 100).toFixed(1) + '%)' : '') + '.'));
    body.appendChild(fb);
  }

  // 5. Pit strategy.
  if (dr.hasField) {
    var sb = _rcrBlock('Pit Strategy', 'Each bar is one car’s race. Markers show the lap of each stop and what it took.');
    var rows = mode === 'class' ? (dr.field || []) : (dr.field || []).filter(function (f) { return f.isPlayer || rivals.some(function (r) { return r.carNumber === f.carNumber; }); });
    var maxLaps = Math.max.apply(null, rows.map(function (f) { return f.laps || 0; }).concat([1]));
    var tl = _rccEl('div', 'rcr-strat');
    rows.forEach(function (f) {
      var row = _rccEl('div', 'rcr-strat-row' + (f.isPlayer ? ' rcr-strat-you' : ''));
      row.appendChild(_rccText('div', 'rcr-strat-name', (f.finish ? 'P' + f.finish + ' ' : '') + '#' + f.carNumber + ' ' + _rcrShort(f.name)));
      var track = _rccEl('div', 'rcr-strat-track');
      var bar = _rccEl('div', 'rcr-strat-bar');
      bar.style.width = ((f.laps || 0) / maxLaps * 100) + '%';
      if (f.isPlayer) bar.style.background = RCR_YOU;
      else if (mode === 'rivals') bar.style.background = RCR_SERIES[rivals.map(function (r) { return r.carNumber; }).indexOf(f.carNumber) % 4];
      track.appendChild(bar);
      (f.pits || []).forEach(function (p) {
        var m = _rccEl('div', 'rcr-strat-pit' + (p.tires ? ' rcr-strat-tyres' : ''));
        m.style.left = ((p.lap - 0.5) / maxLaps * 100) + '%';
        m.appendChild(_rccText('span', 'rcr-strat-icon', p.tires ? 'F+T' : 'F'));
        m.title = 'Lap ' + p.lap + ': ' + (p.tires ? 'fuel and four tyres' : 'fuel only') + (p.lost ? ', about ' + Math.round(p.lost) + ' s lost' : '') +
          (p.wearIn ? ', tyres at ' + _rcrPct(Math.min.apply(null, p.wearIn.filter(function (v) { return v !== null; }).concat([1]))) : '');
        track.appendChild(m);
      });
      row.appendChild(track);
      var stops = f.pits || [];
      row.appendChild(_rccText('div', 'rcr-strat-sum', stops.length ? stops.map(function (p) { return p.lost ? Math.round(p.lost) + ' s' : '--'; }).join(', ') : 'No stop'));
      tl.appendChild(row);
    });
    var axis = _rccEl('div', 'rcr-strat-row rcr-strat-axis');
    axis.appendChild(_rccEl('div', 'rcr-strat-name'));
    var at = _rccEl('div', 'rcr-strat-track rcr-strat-ticks');
    for (var lp = 5; lp <= maxLaps; lp += 5) { var tk = _rccText('span', null, 'Lap ' + lp); tk.style.left = (lp / maxLaps * 100) + '%'; at.appendChild(tk); }
    axis.appendChild(at);
    axis.appendChild(_rccEl('div', 'rcr-strat-sum'));
    tl.appendChild(axis);
    sb.appendChild(tl);
    sb.appendChild(_rcrLegend([{ name: 'F = fuel only', color: '#5b6573' }, { name: 'F+T = fuel and four tyres', color: '#1f2937' }]));
    // Your stop against theirs.
    if ((you.pits || []).length) {
      var mine = you.pits[0];
      var others = mode === 'class' ? (cls ? { lost: cls.pitLost, wear: cls.wearAtStop, tires: cls.stops ? cls.tireStops + ' of ' + cls.stops : '--' } : null)
        : (function () {
          var ps = [].concat.apply([], rivals.map(function (r) { return (r.stats || {}).pits || []; }));
          return { lost: _rcrAvg(ps.map(function (p) { return p.lost; })), wear: _rcrAvg(ps.map(function (p) { return Math.min.apply(null, (p.wearIn || []).filter(function (v) { return v !== null; }).concat([1])); })), tires: ps.filter(function (p) { return p.tires; }).length + ' of ' + ps.length };
        })();
      var st = _rccEl('div', 'rcr-tiles');
      st.appendChild(_rcrTile('Your Stop', mine.lost ? Math.round(mine.lost) + ' s' : '--', others && others.lost ? (mode === 'rivals' ? 'Rivals' : 'Class') + ' average ' + Math.round(others.lost) + ' s' : ''));
      st.appendChild(_rcrTile('Tyres At Your Stop', _rcrPct(Math.min.apply(null, (mine.wearIn || []).filter(function (v) { return v !== null; }).concat([1]))), others && others.wear ? 'Others stopped at ' + _rcrPct(others.wear) : ''));
      st.appendChild(_rcrTile('Changed Tyres', mine.tires ? 'Yes' : 'No', others ? 'Others: ' + others.tires + ' stops' : ''));
      st.appendChild(_rcrTile('Fuel At The Stop', _rcrPct(mine.fuelIn), 'Left with ' + _rcrPct(mine.fuelOut)));
      sb.appendChild(st);
    }
    body.appendChild(sb);
  }

  // 6. Pace.
  var timed = laps.filter(function (l) { return l.t; });
  if (timed.length) {
    var vb = _rcrBlock('Pace', 'Every lap you drove. Your best lap is purple, the laps in and out of the pits are gray and deleted laps are striped.');
    var best = Math.min.apply(null, timed.map(function (l) { return l.t; }));
    var med = you.ml || best;
    var cap = med + Math.max(4, (med - best) * 3);
    var W = _rcrWidth(), H = 200, Lm = 44, Rm = 10, Tm = 10, Bm = 26;
    var lo = Math.floor(best - 1.5), hi = Math.ceil(cap);
    var bw = (W - Lm - Rm) / Math.max(1, laps.length);
    var wrap = _rccEl('div', 'rcr-chart');
    var svg = _rcrSvg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'rcr-svg', role: 'img', 'aria-label': 'Lap times' });
    var yv = function (v) { return H - Bm - (Math.min(v, hi) - lo) / (hi - lo) * (H - Tm - Bm); };
    for (var k2 = 0; k2 <= 4; k2++) {
      var v2 = lo + k2 * (hi - lo) / 4;
      svg.appendChild(_rcrSvg('line', { x1: Lm, x2: W - Rm, y1: yv(v2), y2: yv(v2), class: 'rcr-grid' }));
      var tx = _rcrSvg('text', { x: Lm - 6, y: yv(v2) + 4, class: 'rcr-axis', 'text-anchor': 'end' });
      tx.textContent = _rccLapTime(v2).replace(/\.\d+$/, '');
      svg.appendChild(tx);
    }
    var defs = _rcrSvg('defs', {});
    var pat = _rcrSvg('pattern', { id: 'rcr-stripe', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    pat.appendChild(_rcrSvg('rect', { width: 3, height: 6, fill: '#c3c9d2' }));
    defs.appendChild(pat);
    svg.appendChild(defs);
    var tip2 = null;
    laps.forEach(function (l, i) {
      var x0 = Lm + i * bw + 1;
      var isBest = l.t === best;
      var h0 = l.t ? yv(l.t) : yv(lo + (hi - lo) * 0.5);
      var inOut = l.pit || (i > 0 && laps[i - 1].pit);
      var fill = !l.t ? 'url(#rcr-stripe)' : inOut ? '#9aa3af' : isBest ? '#8150c0' : RCR_YOU;
      var r = _rcrSvg('rect', { x: x0, y: h0, width: Math.max(2, bw - 2), height: Math.max(1, H - Bm - h0), rx: 2, fill: fill, opacity: l.t && !isBest && !inOut ? 0.82 : 1 });
      r.addEventListener('mousemove', function (ev) {
        var box = svg.getBoundingClientRect();
        tip2.show('<div class="rcr-tip-head">Lap ' + l.n + '</div><div>' + (l.t ? _rccLapTime(l.t) : 'Deleted lap') + (l.pit ? ' (pit)' : '') + '</div>' +
          (l.s ? '<div>Sectors ' + l.s.map(function (s) { return s ? Number(s).toFixed(2) : '--'; }).join(' / ') + '</div>' : '') +
          (l.ts ? '<div>Top speed ' + Math.round(l.ts) + ' km/h</div>' : ''), ev.clientX - box.left, ev.clientY - box.top);
      });
      r.addEventListener('mouseleave', function () { tip2.hide(); });
      svg.appendChild(r);
      if (laps.length <= 30 || i % 2 === 0) {
        var lx = _rcrSvg('text', { x: x0 + bw / 2 - 1, y: H - 8, class: 'rcr-axis', 'text-anchor': 'middle' });
        lx.textContent = l.n;
        svg.appendChild(lx);
      }
    });
    wrap.appendChild(svg);
    tip2 = _rcrTip(wrap);
    vb.appendChild(wrap);
    var pt = _rccEl('div', 'rcr-tiles');
    pt.appendChild(_rcrTile('Typical Lap', _rccLapTime(you.ml), compStat('ml') ? (mode === 'rivals' ? 'Rivals ' : 'Class ') + _rccLapTime(compStat('ml')) : ''));
    pt.appendChild(_rcrTile('Consistency', you.sd ? '±' + you.sd.toFixed(2) + ' s' : '--', compStat('sd') ? (mode === 'rivals' ? 'Rivals ' : 'Class ') + '±' + compStat('sd').toFixed(2) + ' s' : 'Spread of your racing laps'));
    pt.appendChild(_rcrTile('Top Speed', you.tsx ? Math.round(you.tsx) + ' km/h' : '--', compStat('tsx') ? (mode === 'rivals' ? 'Rivals ' : 'Class ') + Math.round(compStat('tsx')) + ' km/h' : ''));
    vb.appendChild(pt);
    if ((you.ms || []).some(function (v) { return v; }) && (cls || rivals.length)) {
      vb.appendChild(_rccText('div', 'rcr-mini-title', 'Typical sector times against ' + compName));
      var drows = [0, 1, 2].map(function (k) {
        var c = compArr('ms', k);
        return { name: 'Sector ' + (k + 1), delta: you.ms[k] && c ? you.ms[k] - c : null };
      });
      var lapC = compStat('ml');
      drows.push({ name: 'Whole lap', delta: you.ml && lapC ? you.ml - lapC : null });
      vb.appendChild(_rcrDiverging(drows, function (v) { return v.toFixed(2) + ' s'; }, ['quicker', 'slower']));
    }
    if (dr.hasField) {
      vb.appendChild(_rccText('div', 'rcr-mini-title', 'Typical top speed'));
      var srows = (mode === 'class' ? (dr.field || []) : (dr.field || []).filter(function (f) { return f.isPlayer || rivals.some(function (r) { return r.carNumber === f.carNumber; }); }))
        .filter(function (f) { return f.tsm; })
        .map(function (f) { return { name: '#' + f.carNumber + ' ' + _rcrShort(f.name), value: f.tsm, isYou: f.isPlayer, color: f.isPlayer ? RCR_YOU : (mode === 'rivals' ? RCR_SERIES[rivals.map(function (r) { return r.carNumber; }).indexOf(f.carNumber) % 4] : RCR_FIELD) }; })
        .sort(function (a, b) { return b.value - a.value; });
      var smin = Math.min.apply(null, srows.map(function (r) { return r.value; })) - 5;
      vb.appendChild(_rcrBars(srows, function (v) { return Math.round(v) + ' km/h'; }, { min: smin }));
    }
    body.appendChild(vb);
  }

  // 7. Contacts and track limits.
  var cb = _rcrBlock('Contacts and Track Limits', (dr.contacts || []).length ? 'Each circle is a contact, sized by how hard it was. Diamonds are track limit warnings.' : 'A clean race, with no contacts.');
  var raceLen = Math.max(1, (laps.length ? laps.length : 1));
  // Place marks by race time (two contacts on lap 1 would otherwise sit on top of each other).
  var raceSecs = laps.reduce(function (a, l) { return a + (l.t || 0); }, 0) || null;
  var at = function (t, lap) { return raceSecs && t !== null && t !== undefined ? Math.max(0, Math.min(100, t / raceSecs * 100)) : ((lap || 1) - 0.5) / raceLen * 100; };
  if ((dr.contacts || []).length || (dr.trackLimits || []).length) {
    var line = _rccEl('div', 'rcr-contact-line');
    var maxImp = Math.max.apply(null, (dr.contacts || []).map(function (c) { return c.impact; }).concat([1]));
    (dr.contacts || []).forEach(function (c) {
      var d = _rccEl('div', 'rcr-contact' + (c.wall ? ' rcr-contact-wall' : ''));
      var size = 10 + Math.sqrt(c.impact / maxImp) * 26;
      d.style.width = size + 'px'; d.style.height = size + 'px';
      d.style.left = at(c.t, c.lap) + '%';
      d.title = 'Lap ' + (c.lap || '--') + ' at ' + _rccEventTime(c.t) + ': ' + c.other + ' (impact ' + Math.round(c.impact) + ')';
      line.appendChild(d);
    });
    (dr.trackLimits || []).forEach(function (t) {
      var d = _rccEl('div', 'rcr-limit');
      d.style.left = at(t.t, t.lap) + '%';
      d.title = 'Lap ' + (t.lap || '--') + ': track limits, ' + (t.outcome || 'warning') + ', ' + t.points + ' points';
      line.appendChild(d);
    });
    cb.appendChild(line);
    var ax = _rccEl('div', 'rcr-contact-axis');
    ax.appendChild(_rccText('span', null, 'Lap 1'));
    ax.appendChild(_rccText('span', null, 'Lap ' + raceLen));
    cb.appendChild(ax);
    var list = _rccEl('div', 'rcr-contact-list');
    (dr.contacts || []).slice().sort(function (a, b) { return b.impact - a.impact; }).forEach(function (c, i) {
      var r = _rccEl('div', 'rcr-contact-item');
      r.appendChild(_rccText('span', 'rcr-contact-lap', 'Lap ' + (c.lap || '--')));
      r.appendChild(_rccText('span', 'rcr-contact-who', c.other));
      var meter = _rccEl('span', 'rcr-contact-meter');
      var mf = _rccEl('span', 'rcr-contact-meter-fill');
      mf.style.width = Math.max(4, c.impact / maxImp * 100) + '%';
      meter.appendChild(mf);
      r.appendChild(meter);
      r.appendChild(_rccText('span', 'rcr-contact-val', Math.round(c.impact) + (i === 0 && (dr.contacts || []).length > 1 ? ' (hardest)' : '')));
      list.appendChild(r);
    });
    cb.appendChild(list);
    cb.appendChild(_rccText('p', 'rcr-note', 'The game’s results file has no damage figures, only how hard each contact was.'));
  }
  body.appendChild(cb);

  // 8. Qualifying.
  var q = dr.qualifying;
  if (q) {
    var qb = _rcrBlock('Qualifying', 'Your qualifying session, against pole and the best sectors in your class.');
    var qt = _rccEl('div', 'rcr-tiles');
    qt.appendChild(_rcrTile('Qualified', q.position ? 'P' + q.position : '--', q.classSize ? 'of ' + q.classSize + ' in ' + dr.carClass : '', 'rcr-tile-hero'));
    qt.appendChild(_rcrTile('Best Lap', _rccLapTime(q.best), q.pole && q.best ? (q.best - q.pole > 0 ? '+' + (q.best - q.pole).toFixed(3) + ' s to pole' : 'Pole position') : ''));
    var theoQ = (q.myBestSectors || []).length === 3 && q.myBestSectors.every(function (v) { return v; }) ? q.myBestSectors[0] + q.myBestSectors[1] + q.myBestSectors[2] : null;
    qt.appendChild(_rcrTile('Fastest Possible', _rccLapTime(theoQ), 'Your best three sectors added up'));
    qt.appendChild(_rcrTile('Top Speed', q.topSpeed ? Math.round(q.topSpeed) + ' km/h' : '--', q.classTopSpeed ? 'Class average ' + Math.round(q.classTopSpeed) + ' km/h' : ''));
    qb.appendChild(qt);
    if ((q.mySectors || []).some(function (v) { return v; })) {
      qb.appendChild(_rccText('div', 'rcr-mini-title', 'Your best lap’s sectors against pole (' + (q.poleName || 'pole') + ')'));
      qb.appendChild(_rcrDiverging([0, 1, 2].map(function (k) {
        return { name: 'Sector ' + (k + 1), delta: q.mySectors[k] && q.poleSectors[k] ? q.mySectors[k] - q.poleSectors[k] : null };
      }), function (v) { return v.toFixed(3) + ' s'; }, ['quicker', 'slower']));
      qb.appendChild(_rccText('div', 'rcr-mini-title', 'Your best sectors against the best in class'));
      qb.appendChild(_rcrDiverging([0, 1, 2].map(function (k) {
        return { name: 'Sector ' + (k + 1), delta: (q.myBestSectors || [])[k] && q.classBestSectors[k] ? q.myBestSectors[k] - q.classBestSectors[k] : null };
      }), function (v) { return v.toFixed(3) + ' s'; }, ['quicker', 'slower']));
    }
    if ((q.field || []).length) {
      qb.appendChild(_rccText('div', 'rcr-mini-title', 'Gap to pole'));
      var qrows = q.field.filter(function (f) { return f.best; }).map(function (f) {
        return { name: '#' + f.carNumber + ' ' + _rcrShort(f.name), value: f.best - q.pole, isYou: f.isPlayer, color: f.isPlayer ? RCR_YOU : RCR_FIELD };
      });
      qb.appendChild(_rcrBars(qrows, function (v) { return v === 0 ? 'Pole' : '+' + v.toFixed(3) + ' s'; }));
    }
    if ((q.laps || []).length) {
      qb.appendChild(_rccText('div', 'rcr-mini-title', 'Your qualifying laps'));
      var qlaps = q.laps.map(function (l) { return { name: 'Lap ' + l.n + (l.pit ? ' (pit)' : ''), value: l.t, isYou: true, color: l.t && l.t === q.best ? '#8150c0' : (l.t ? RCR_YOU : RCR_FIELD) }; });
      var qmin = Math.min.apply(null, q.laps.filter(function (l) { return l.t; }).map(function (l) { return l.t; }).concat([q.best || 0])) - 2;
      qb.appendChild(_rcrBars(qlaps, function (v) { return v ? _rccLapTime(v) : 'No time'; }, { min: qmin }));
    }
    body.appendChild(qb);
  }
}
