/* =====================================================================
   Race Club -- player helmet customizer  (js/helmet-player.js)
   ---------------------------------------------------------------------
   RCHelmetPlayer.open(ctx)
     ctx = { recipe, own, logos, awarded, teamInfo, teamOn, showModal, showToast, onSave(recipeOrNull) }
       recipe     the helmet to start from (the member's saved helmet, else the Website Default)
       own        the member's saved helmet (with .p / .t), or null when they never designed one
       logos      layers that come with the starting helmet (default-helmet logos); shown read-only
       awarded    award / special helmets this member was given: [{presetId, name, category, recipe}]
       onSave     called with a recipe {d,b,a1,a2,v,logos?,t?,p?} (Save Helmet) or null (Use Default)
   Needs js/helmet.js (configured) and css/helmet.css.
   Members get: a design (Generic ones, plus any Awards they were given), 3 colors + finishes, a visor,
   "Match my team", Randomize, and a restore arrow that puts
   everything back to how it was when the popup opened. Logos cannot be moved or edited.
   An award helmet is a complete design: picking one shows it exactly as designed and every control except the
   Design list is locked. Only admins can change an award helmet (in the admin Helmet Designer).
   The default helmet's logos disappear the moment anything is changed.
   ===================================================================== */
(function () {
  'use strict';
  var H = window.RCHelmet;
  var SLOTS = [['b', 'Base Color'], ['a1', 'Accent Color 1'], ['a2', 'Accent Color 2']];

  function mk(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  // keeps colors to the palette (an exact "#rrggbb" that came with an award helmet is allowed) and removes layers
  function clean(r) {
    r = H.normalizeRecipe(r || H.defaultRecipe());
    var ids = {}; H.PALETTE.forEach(function (p) { ids[p.id] = 1; });
    SLOTS.forEach(function (s) { var c = r[s[0]][0]; if (!ids[c] && String(c).charAt(0) !== '#') r[s[0]][0] = H.defaultRecipe()[s[0]][0]; });
    r.logos = [];
    return r;
  }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  var UNDO_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9"/><polyline points="4 3.5 4 8.5 9 8.5"/></svg>';

  function open(ctx) {
    var toast = ctx.showToast || function () {};
    var own = ctx.own || null;
    var cfg = H.getConfig();
    var awarded = (ctx.awarded || []).slice();
    var info = ctx.teamInfo || null;
    var teamRecipe = (info && info.recipe) ? H.normalizeRecipe(info.recipe) : null;
    var teamOn = !!(ctx.teamOn && teamRecipe);

    // ---- where the helmet starts ----
    var R = clean(ctx.recipe);
    var presetId = '', stash = null;               // stash = the member's own colors, kept while an award helmet is shown
    var baseLogos = ctx.logos || [];                 // the default helmet's own logos: visible only until something is changed
    if (own && own.p) {
      var found = awarded.filter(function (a) { return a.presetId === own.p; })[0];
      if (!found) {                                  // no longer offered (archived or taken back): keep what they had
        found = { presetId: own.p, name: 'My awarded helmet', category: 'Awards', recipe: { d: own.d, b: own.b, a1: own.a1, a2: own.a2, v: own.v, logos: own.logos || [] } };
        awarded.push(found);
      }
      presetId = found.presetId;
    }
    function presetOf(id) { return awarded.filter(function (a) { return a.presetId === id; })[0] || null; }
    var init = { R: copy(R), presetId: presetId, teamOn: teamOn };

    // dirty = anything differs from how the popup opened
    function dirty() { return JSON.stringify(R) !== JSON.stringify(init.R) || presetId !== init.presetId; }
    // what is actually drawn / saved
    function effective() {
      var o;
      if (teamOn) { o = copy(teamRecipe); o.t = 1; return o; }
      if (presetId) { o = H.normalizeRecipe(presetOf(presetId).recipe); o.p = presetId; return o; }   // used exactly as designed
      o = copy(R);
      o.logos = dirty() ? [] : copy(baseLogos);
      return o;
    }

    // The popup is already open showing the loading lights (js/header.js rcHelmetCustomize_); fill it.
    var body, modal;
    if (ctx.shell) { body = ctx.shell.body; modal = ctx.shell.modal; body.innerHTML = ''; }
    else { body = mk('div', 'rch-designer rch-player'); modal = ctx.showModal('Helmet Designer', { bodyEl: body, wide: true }); }
    if (modal && modal.el) modal.el.classList.add('rch-pmodal');

    if (!cfg.designs.length) {
      var t = ctx.tried || [];
      body.appendChild(mk('p', 'rch-hint', 'No helmet designs are available yet. Ask an admin to check the design files and the HelmetAssets sheet tab.'));
      body.appendChild(mk('p', 'rch-hint', t.length
        ? 'Admin details: the sheet listed ' + t.length + ' design(s), but these picture files could not be loaded: ' + t.map(function (d) { return 'assets/helmets/images/' + d.file; }).join(', ')
        : 'Admin details: the server sent no designs. Each design row in HelmetAssets needs Type = Design, a Slot from 1 to 10, and Active = Active (or blank).'));
      return;
    }
    var grid = mk('div', 'rch-grid');
    var left = mk('div', 'rch-left'), right = mk('div', 'rch-right');
    grid.appendChild(left); grid.appendChild(right); body.appendChild(grid);

    /* ---- preview (the restore arrow sits above it, on the right) ---- */
    var undoBar = mk('div', 'rch-prevbar');
    var undoB = mk('button', 'rch-undo', UNDO_SVG); undoB.type = 'button';
    undoB.title = 'Restore my helmet to how it was when I opened this window'; undoB.setAttribute('aria-label', undoB.title);
    undoBar.appendChild(undoB);
    left.appendChild(undoBar);
    var wrap = mk('div', 'rch-stagewrap');
    var stage = mk('div', 'rch-stage light');
    wrap.appendChild(stage);
    left.appendChild(wrap);
    var bgRow = mk('div', 'rch-btns rch-bgrow');
    bgRow.appendChild(mk('span', 'rch-label', 'Backdrop'));
    ['light', 'grey', 'dark'].forEach(function (b) {
      var x = mk('button', 'rc-btn-secondary rc-btn-row', b === 'light' ? 'White' : (b === 'grey' ? 'Grey' : 'Dark')); x.type = 'button';
      x.onclick = function () { stage.className = 'rch-stage ' + b; };
      bgRow.appendChild(x);
    });
    left.appendChild(bgRow);

    /* ---- design (Generic + Awards groups) + randomize ---- */
    var style = mk('div', 'rch-section');
    var dRow = mk('div', 'rch-dstack');
    var dWrap = mk('div'); dWrap.appendChild(mk('div', 'rch-label', 'Design'));
    var dSel = mk('select', 'rch-select-wide');
    var gGen = mk('optgroup'); gGen.label = 'Generic';
    cfg.designs.forEach(function (d) { var o = mk('option'); o.value = 'd:' + d.slot; o.textContent = d.name; gGen.appendChild(o); });
    dSel.appendChild(gGen);
    var cats = {}, catOrder = [];
    awarded.forEach(function (a) { var c = a.category || 'Awards'; if (!cats[c]) { cats[c] = []; catOrder.push(c); } cats[c].push(a); });
    catOrder.sort(function (x, y) { return x === 'Awards' ? -1 : (y === 'Awards' ? 1 : x.localeCompare(y)); });
    catOrder.forEach(function (c) {
      var g = mk('optgroup'); g.label = c;
      cats[c].forEach(function (a) { var o = mk('option'); o.value = 'p:' + a.presetId; o.textContent = a.name; g.appendChild(o); });
      dSel.appendChild(g);
    });
    dSel.onchange = function () {
      var v = dSel.value;
      if (v.indexOf('p:') === 0) {
        var a = presetOf(v.slice(2)); if (!a) return;
        if (!presetId) stash = copy(R);
        presetId = a.presetId;
      } else {
        if (presetId && stash) R = stash;
        presetId = ''; R.d = parseInt(v.slice(2), 10);
      }
      draw();
    };
    dWrap.appendChild(dSel); dRow.appendChild(dWrap);
    var tools = mk('div', 'rch-btns rch-tools');
    var rb = mk('button', 'rc-btn-secondary rc-btn-row', 'Randomize'); rb.type = 'button';
    rb.onclick = function () { R = clean(H.randomRecipe()); draw(); };
    var rs = mk('button', 'rc-btn-secondary rc-btn-row', 'Reset colors'); rs.type = 'button';
    rs.onclick = function () {
      var d = R.d;
      R = clean(H.defaultRecipe());
      R.d = d; draw();
    };
    tools.appendChild(rb); tools.appendChild(rs); dRow.appendChild(tools);
    style.appendChild(dRow);
    var awardNote = mk('p', 'rch-hint', 'This is an award helmet. It is used exactly as designed and cannot be changed.'); awardNote.style.display = 'none'; style.appendChild(awardNote);

    /* ---- colors ---- */
    var rows = {};
    SLOTS.forEach(function (s) {
      var row = mk('div', 'rch-slot');
      var head = mk('div', 'rch-slot-head');
      head.appendChild(mk('span', 'rch-label', s[1]));
      var fs = mk('select', 'rch-finish');
      H.FINISHES.forEach(function (f) { var o = mk('option'); o.value = f.id; o.textContent = f.name; fs.appendChild(o); });
      fs.onchange = function () { R[s[0]][1] = fs.value; draw(); };
      head.appendChild(fs); row.appendChild(head);
      var sw = mk('div', 'rch-swatches rch-swatches16');
      H.PALETTE.forEach(function (p) {
        var b = mk('button', 'rch-sw'); b.type = 'button'; b.style.background = p.hex; b.title = p.name; b.dataset.id = p.id;
        b.onclick = function () { R[s[0]][0] = p.id; draw(); };
        sw.appendChild(b);
      });
      row.appendChild(sw); style.appendChild(row);
      rows[s[0]] = { fs: fs, sw: sw, row: row };
    });

    var visorLabel = mk('div', 'rch-label rch-mt', 'Visor'); style.appendChild(visorLabel);
    var vs = mk('div', 'rch-visors');
    H.VISORS.forEach(function (v) {
      var b = mk('button', 'rch-visor'); b.type = 'button'; b.dataset.id = v.id;
      b.innerHTML = '<i style="background:linear-gradient(135deg,' + v.c1 + ',' + v.c2 + ')"></i>' + v.name;
      b.onclick = function () { R.v = v.id; draw(); };
      vs.appendChild(b);
    });
    style.appendChild(vs);
    right.appendChild(style);

    /* ---- helmet options (checkboxes) ---- */
    var opts = mk('div', 'rch-options');
    opts.appendChild(mk('div', 'rch-label', 'Helmet Options'));
    var teamLab = mk('label', 'rch-check');
    var teamBox = mk('input'); teamBox.type = 'checkbox';
    teamLab.appendChild(teamBox);
    teamLab.appendChild(mk('span', null, 'Match my helmet to my current team' + ((info && info.team) ? ' (' + esc(info.team) + ')' : '')));
    opts.appendChild(teamLab);
    if (!teamRecipe) {
      teamBox.disabled = true; teamLab.classList.add('off');
      // The reason shows as a tooltip while hovering the checkbox line (normal weight text).
      teamLab.classList.add('rch-tipped');
      teamLab.setAttribute('data-tip', (info && info.hasTeam === false) ? 'Join a team this season to turn this on.' : 'No team helmet has been set up for your car yet.');
      teamLab.tabIndex = 0;
    }
    teamBox.checked = teamOn;
    teamBox.onchange = function () { teamOn = teamBox.checked && !!teamRecipe; draw(); };
    right.appendChild(opts);

    /* ---- buttons ---- */
    var btns = mk('div', 'rch-btns rch-pbtns');
    var saveB = mk('button', 'rc-btn-primary rc-btn-sm', 'Save Helmet'); saveB.type = 'button';
    var defB = mk('button', 'rc-btn-secondary rc-btn-sm', 'Use Default'); defB.type = 'button';
    var canB = mk('button', 'rc-btn-secondary rc-btn-sm', 'Cancel'); canB.type = 'button';
    btns.appendChild(saveB); btns.appendChild(defB); btns.appendChild(canB);
    right.appendChild(btns);
    saveB.onclick = function () { var out = effective(); modal.close(); ctx.onSave(out); };
    defB.onclick = function () { modal.close(); ctx.onSave(null); };
    canB.onclick = function () { modal.close(); };
    undoB.onclick = function () {
      R = copy(init.R); presetId = init.presetId; teamOn = init.teamOn; stash = null;
      draw();
    };

    /* ---- drawing ---- */
    function syncControls() {
      if (!presetId && !cfg.designs.some(function (d) { return d.slot === R.d; }) && cfg.designs.length) R.d = cfg.designs[0].slot;
      dSel.value = presetId ? 'p:' + presetId : 'd:' + R.d;
      SLOTS.forEach(function (s) {
        rows[s[0]].fs.value = R[s[0]][1];
        Array.prototype.forEach.call(rows[s[0]].sw.children, function (b) { b.classList.toggle('sel', b.dataset.id === R[s[0]][0]); });
      });
      Array.prototype.forEach.call(vs.children, function (b) { b.classList.toggle('sel', b.dataset.id === R.v); });
      body.classList.toggle('rch-locked', teamOn);
      teamBox.checked = teamOn;
      // award helmets are used as is: the colors, visor, Randomize and Reset are locked (the Design list stays open)
      var fixed = !!presetId && !teamOn;
      [tools, visorLabel, vs].concat(Object.keys(rows).map(function (k) { return rows[k].row; })).forEach(function (n) { n.classList.toggle('rch-dim', fixed); });
      awardNote.style.display = fixed ? '' : 'none';
      var changed = dirty() || teamOn !== init.teamOn;
      undoB.disabled = !changed;
    }
    var busy = false, again = false;
    function draw() {
      syncControls();
      if (busy) { again = true; return; }
      busy = true;
      H.render(effective(), { width: 640 }).then(function (cv) {
        stage.innerHTML = ''; cv.style.maxWidth = '100%'; cv.style.height = 'auto'; stage.appendChild(cv);
      }).catch(function (e) { toast('Could not draw the helmet: ' + e.message, 'error'); })
        .then(function () { busy = false; if (again) { again = false; draw(); } });
    }
    draw();
  }

  window.RCHelmetPlayer = { open: open };
})();
