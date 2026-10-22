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
   Randomize, a Clear button (plain white helmet) and a circle-arrow Reset
   button (back to the helmet the window opened with). Logos cannot be moved or edited.
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
  // a plain white helmet with no design at all: the whole shell takes the Base Color
  var RESET_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 3.5 3 8.5 8 8.5"/></svg>';
  function blank() { var r = H.normalizeRecipe(H.defaultRecipe()); r.d = 0; r.logos = []; return clean(r); }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }


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

    /* ---- preview ---- */
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

    // Editing anything while the team helmet is showing starts from the team helmet's colors and design.
    function leaveTeam() { if (teamOn) { R = clean(teamRecipe); teamOn = false; } }

    /* ---- design (Generic + Awards groups) + randomize ---- */
    var style = mk('div', 'rch-section');
    var dRow = mk('div', 'rch-dstack');
    var dWrap = mk('div'); dWrap.appendChild(mk('div', 'rch-label', 'Design'));
    var dSel = mk('select', 'rch-select-wide');
    var gGen = mk('optgroup'); gGen.label = 'Default';
    var plainO = mk('option'); plainO.value = 'd:0'; plainO.textContent = 'Plain'; gGen.appendChild(plainO);
    H.visibleDesigns().forEach(function (d) { var o = mk('option'); o.value = 'd:' + d.slot; o.textContent = d.name; gGen.appendChild(o); });
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
      leaveTeam();
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
    rb.onclick = function () { leaveTeam(); R = clean(H.randomRecipe()); draw(); };
    var rs = mk('button', 'rc-btn-secondary rc-btn-row', 'Reset colors'); rs.type = 'button';
    rs.onclick = function () {
      leaveTeam();
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
      fs.onchange = function () { leaveTeam(); R[s[0]][1] = fs.value; draw(); };
      head.appendChild(fs); row.appendChild(head);
      var sw = mk('div', 'rch-swatches rch-swatches16');
      H.PALETTE.forEach(function (p) {
        var b = mk('button', 'rch-sw'); b.type = 'button'; b.style.background = p.hex; b.title = p.name; b.dataset.id = p.id;
        b.onclick = function () { leaveTeam(); R[s[0]][0] = p.id; draw(); };
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
      b.onclick = function () { leaveTeam(); R.v = v.id; draw(); };
      vs.appendChild(b);
    });
    style.appendChild(vs);
    right.appendChild(style);

    /* ---- buttons ---- */
    var btns = mk('div', 'rch-btns rch-pbtns');
    var saveB = mk('button', 'rc-btn-primary rc-btn-sm', 'Save'); saveB.type = 'button';
    var defB = mk('button', 'rc-btn-secondary rc-btn-sm', 'Use Default'); defB.type = 'button';
    var clearB = mk('button', 'rc-btn-secondary rc-btn-sm', 'Clear'); clearB.type = 'button';
    clearB.title = 'Clear to a plain white helmet with no design';
    var resetB = mk('button', 'rc-btn-secondary rch-iconbtn', RESET_ICON); resetB.type = 'button';
    resetB.title = 'Reset to the helmet you opened this window with'; resetB.setAttribute('aria-label', 'Reset');
    btns.appendChild(saveB); btns.appendChild(defB); btns.appendChild(clearB); btns.appendChild(resetB);
    right.appendChild(btns);
    saveB.onclick = function () { var out = effective(); modal.close(); ctx.onSave(out); };
    defB.onclick = function () { modal.close(); ctx.onSave(null); };
    clearB.onclick = function () { R = blank(); presetId = ''; stash = null; teamOn = false; draw(); };
    resetB.onclick = function () { R = copy(init.R); presetId = init.presetId; stash = null; teamOn = init.teamOn; draw(); };

    /* ---- drawing ---- */
    function syncControls() {
      if (!presetId && R.d !== 0 && !H.visibleDesigns().some(function (d) { return d.slot === R.d; }) && H.visibleDesigns().length) R.d = H.visibleDesigns()[0].slot;
      dSel.value = presetId ? 'p:' + presetId : 'd:' + R.d;
      SLOTS.forEach(function (s) {
        rows[s[0]].fs.value = R[s[0]][1];
        Array.prototype.forEach.call(rows[s[0]].sw.children, function (b) { b.classList.toggle('sel', b.dataset.id === R[s[0]][0]); });
      });
      Array.prototype.forEach.call(vs.children, function (b) { b.classList.toggle('sel', b.dataset.id === R.v); });
      // award helmets are used as is: the colors, visor, Randomize and Reset are locked (the Design list stays open)
      var fixed = !!presetId && !teamOn;
      [tools, visorLabel, vs].concat(Object.keys(rows).map(function (k) { return rows[k].row; })).forEach(function (n) { n.classList.toggle('rch-dim', fixed); });
      awardNote.style.display = fixed ? '' : 'none';
      // Plain white (no design) has no accent areas: both accent rows, their swatches and finish lists are grayed out and disabled
      var plain = !presetId && R.d === 0;
      ['a1', 'a2'].forEach(function (k) {
        rows[k].row.classList.toggle('rch-dim', fixed || plain);
        rows[k].fs.disabled = plain;
        Array.prototype.forEach.call(rows[k].sw.children, function (b) { b.disabled = plain; });
      });
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
