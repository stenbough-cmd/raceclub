/* =====================================================================
   Race Club -- player helmet customizer  (js/helmet-player.js)
   ---------------------------------------------------------------------
   RCHelmetPlayer.open(ctx)
     ctx = { recipe, showModal, showToast, onSave(recipeOrNull) }
       recipe     the driver's current helmet recipe object, or null for the default helmet
       showModal  the page's own popup function: showModal(title, {bodyEl, wide})
       onSave     called with a plain recipe {d,b,a1,a2,v} (Save Helmet) or null (Use Default Helmet)
   Needs js/helmet.js (configured with the design list) and css/helmet.css.
   Players only get: design, 3 colors from the 16-color set, a finish per color, a visor, Randomize.
   No logos and no exact colors (those are admin-only, see js/helmet-editor.js).
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

  // keeps only what a player is allowed to have: palette colors, no logos
  function clean(r) {
    r = H.normalizeRecipe(r || H.defaultRecipe());
    var ids = {}; H.PALETTE.forEach(function (p) { ids[p.id] = 1; });
    SLOTS.forEach(function (s) { if (!ids[r[s[0]][0]]) r[s[0]][0] = H.defaultRecipe()[s[0]][0]; });
    r.logos = [];
    return r;
  }

  function open(ctx) {
    var toast = ctx.showToast || function () {};
    var R = clean(ctx.recipe);
    var cfg = H.getConfig();

    // The popup is already open showing the loading lights (js/header.js rcHelmetCustomize_); fill it.
    var body, modal;
    if (ctx.shell) { body = ctx.shell.body; modal = ctx.shell.modal; body.innerHTML = ''; }
    else { body = mk('div', 'rch-designer rch-player'); modal = ctx.showModal('Customize Helmet', { bodyEl: body, wide: true }); }
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

    /* ---- preview ---- */
    var stage = mk('div', 'rch-stage light');
    left.appendChild(stage);
    var bgRow = mk('div', 'rch-btns rch-bgrow');
    bgRow.appendChild(mk('span', 'rch-label', 'Backdrop'));
    ['light', 'grey', 'dark'].forEach(function (b) {
      var x = mk('button', 'rc-btn-secondary rc-btn-row', b === 'light' ? 'White' : (b === 'grey' ? 'Grey' : 'Dark')); x.type = 'button';
      x.onclick = function () { stage.className = 'rch-stage ' + b; };
      bgRow.appendChild(x);
    });
    left.appendChild(bgRow);

    /* ---- design + randomize ---- */
    var style = mk('div', 'rch-section');
    var dRow = mk('div', 'rch-row2');
    var dWrap = mk('div'); dWrap.appendChild(mk('div', 'rch-label', 'Design'));
    var dSel = mk('select', 'rch-select-wide');
    cfg.designs.forEach(function (d) { var o = mk('option'); o.value = d.slot; o.textContent = d.name; dSel.appendChild(o); });
    dSel.onchange = function () { R.d = parseInt(dSel.value, 10); draw(); };
    dWrap.appendChild(dSel); dRow.appendChild(dWrap);
    var tools = mk('div', 'rch-btns rch-tools');
    var rb = mk('button', 'rc-btn-secondary rc-btn-row', 'Randomize'); rb.type = 'button';
    rb.onclick = function () { R = clean(H.randomRecipe()); draw(); };
    var rs = mk('button', 'rc-btn-secondary rc-btn-row', 'Reset colors'); rs.type = 'button';
    rs.onclick = function () { var d = R.d; R = clean(H.defaultRecipe()); R.d = d; draw(); };
    tools.appendChild(rb); tools.appendChild(rs); dRow.appendChild(tools);
    style.appendChild(dRow);

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
      rows[s[0]] = { fs: fs, sw: sw };
    });

    style.appendChild(mk('div', 'rch-label rch-mt', 'Visor'));
    var vs = mk('div', 'rch-visors');
    H.VISORS.forEach(function (v) {
      var b = mk('button', 'rch-visor'); b.type = 'button'; b.dataset.id = v.id;
      b.innerHTML = '<i style="background:linear-gradient(135deg,' + v.c1 + ',' + v.c2 + ')"></i>' + v.name;
      b.onclick = function () { R.v = v.id; draw(); };
      vs.appendChild(b);
    });
    style.appendChild(vs);
    right.appendChild(style);

    /* ---- buttons ---- */
    var btns = mk('div', 'rch-btns rch-pbtns');
    var saveB = mk('button', 'rc-btn-primary rc-btn-sm', 'Save Helmet'); saveB.type = 'button';
    var defB = mk('button', 'rc-btn-secondary rc-btn-sm', 'Use Default Helmet'); defB.type = 'button';
    var canB = mk('button', 'rc-btn-secondary rc-btn-sm', 'Cancel'); canB.type = 'button';
    btns.appendChild(saveB); btns.appendChild(defB); btns.appendChild(canB);
    right.appendChild(btns);
    saveB.onclick = function () { var out = clean(R); modal.close(); ctx.onSave(out); };
    defB.onclick = function () { modal.close(); ctx.onSave(null); };
    canB.onclick = function () { modal.close(); };

    /* ---- drawing ---- */
    function syncControls() {
      if (!cfg.designs.some(function (d) { return d.slot === R.d; }) && cfg.designs.length) R.d = cfg.designs[0].slot;
      dSel.value = String(R.d);
      SLOTS.forEach(function (s) {
        rows[s[0]].fs.value = R[s[0]][1];
        Array.prototype.forEach.call(rows[s[0]].sw.children, function (b) { b.classList.toggle('sel', b.dataset.id === R[s[0]][0]); });
      });
      Array.prototype.forEach.call(vs.children, function (b) { b.classList.toggle('sel', b.dataset.id === R.v); });
    }
    var busy = false, again = false;
    function draw() {
      syncControls();
      if (busy) { again = true; return; }
      busy = true;
      H.render(R, { width: 640 }).then(function (cv) {
        stage.innerHTML = ''; cv.style.maxWidth = '100%'; cv.style.height = 'auto'; stage.appendChild(cv);
      }).catch(function (e) { toast('Could not draw the helmet: ' + e.message, 'error'); })
        .then(function () { busy = false; if (again) { again = false; draw(); } });
    }
    draw();
  }

  window.RCHelmetPlayer = { open: open };
})();
