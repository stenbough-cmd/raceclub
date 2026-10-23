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
    // The member's own customized helmet is remembered inside the saved team helmet (field k). If they later lose access to the
    // team's manufacturer helmet (new season with a team of a different manufacturer) the site puts k back, and with no k the
    // Race Club default helmet is used.
    var lastCustom = (own && own.t) ? (own.k || null) : null;

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
    // The member's own saved custom design (listed as "Your Design"), if they have one: either what is saved now, or what was
    // remembered inside a saved team helmet (own.k).
    var customRec = null;
    if (own && !own.t && !own.p) customRec = own;
    else if (own && own.t && own.k && !own.k.p) customRec = { d: own.k.d, b: own.k.b, a1: own.k.a1, a2: own.k.a2, v: own.k.v, logos: own.k.l || [] };
    var wdRec = ctx.websiteDefault ? ctx.websiteDefault : null;
    var webOn = !own && !!wdRec;                      // the website default is the selected design (saving it clears the member's own helmet)
    var ownOn = !!(own && !own.t && !own.p);          // "Your Design" is the selected design
    function presetOf(id) { return awarded.filter(function (a) { return a.presetId === id; })[0] || null; }
    var init = { R: copy(R), presetId: presetId, teamOn: teamOn };

    // dirty = anything differs from how the popup opened
    function dirty() { return JSON.stringify(R) !== JSON.stringify(init.R) || presetId !== init.presetId; }
    // what is actually drawn / saved
    function effective() {
      var o = effective0(), hasBox = (o.logos || []).some(function (l) { return l && l.s === 'player'; });
      if (hasBox && ctx.player) o.pl = { n: ctx.player.n, c: ctx.player.c };   // the Player Name and Flag box: this member's name and country, saved into their helmet once
      else delete o.pl;
      return o;
    }
    function effective0() {
      var o;
      if (teamOn) { o = copy(teamRecipe); o.t = 1; if (info && info.manufacturer) o.m = info.manufacturer; if (lastCustom) o.k = copy(lastCustom); return o; }
      if (presetId) { o = H.normalizeRecipe(presetOf(presetId).recipe); o.p = presetId; return o; }   // used exactly as designed
      if (webOn && wdRec) return H.normalizeRecipe(wdRec.recipe);
      if (ownOn && customRec) return H.normalizeRecipe(customRec);
      o = copy(R);
      o.logos = dirty() ? [] : copy(baseLogos);
      return o;
    }
    // the member's current own design, kept small, to be restored later (null = they had nothing of their own: default helmet)
    function customSlim() {
      if (!own && !dirty() && !presetId) return null;
      var e = effective(), k = { d: e.d, b: e.b, a1: e.a1, a2: e.a2, v: e.v };
      if (e.logos && e.logos.length) k.l = e.logos.slice(0, 25);
      if (e.p) k.p = e.p;
      if (e.pl) k.pl = e.pl;
      return k;
    }

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
    var wrap = mk('div', 'rch-stagewrap');
    var onLeague = document.body.classList.contains('rc-league-page') && !document.body.classList.contains('rcc-page');   // League Hub: dark theme, grey backdrop to start
    var stage = mk('div', 'rch-stage ' + (onLeague ? 'grey' : 'light'));
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
    function leaveTeam() { if (teamOn) { R = clean(teamRecipe); teamOn = false; } webOn = false; ownOn = false; }

    /* ---- design (Generic + Awards groups) + randomize ---- */
    var style = mk('div', 'rch-section');
    var dRow = mk('div', 'rch-dstack');
    var dWrap = mk('div'); dWrap.style.position = 'relative'; dWrap.style.zIndex = '3'; dWrap.appendChild(mk('div', 'rch-label', 'Design'));
    var dSel = mk('select', 'rch-select-wide');
    var gGen = mk('optgroup'); gGen.label = 'Basic';
    var plainO = mk('option'); plainO.value = 'd:0'; plainO.textContent = 'Plain'; gGen.appendChild(plainO);
    H.visibleDesigns().forEach(function (d) { var o = mk('option'); o.value = 'd:' + d.slot; o.textContent = d.name; gGen.appendChild(o); });
    dSel.appendChild(gGen);
    // The team's manufacturer helmet, unlocked while the member has a seat (and kept after the season ends)
    if (teamRecipe) {
      var gTeam = mk('optgroup'); gTeam.label = 'Team';
      var to = mk('option'); to.value = 't:team'; to.textContent = ((info && info.manufacturer) ? info.manufacturer : 'Team helmet') + ' (current seat)'; gTeam.appendChild(to);
      dSel.appendChild(gTeam);
    }
    // "Website": the website's default helmet, and the member's own saved custom design ("Your Design")
    if (wdRec || customRec) {
      var gWeb = mk('optgroup'); gWeb.label = 'Website';
      if (wdRec) { var wo = mk('option'); wo.value = 'w:default'; wo.textContent = wdRec.name + ' (default)'; gWeb.appendChild(wo); }
      if (customRec) { var yo = mk('option'); yo.value = 'y:own'; yo.textContent = 'Your Design'; gWeb.appendChild(yo); }
      dSel.appendChild(gWeb);
    }
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
      if (v === 't:team') {
        if (!teamOn) lastCustom = customSlim();      // null when they had no helmet of their own
        presetId = ''; stash = null; teamOn = true; draw(); return;
      }
      leaveTeam();
      if (v === 'w:default') {
        presetId = ''; stash = null; R = clean(wdRec.recipe); webOn = true; ownOn = false;
      } else if (v === 'y:own') {
        presetId = ''; stash = null; R = clean(customRec); webOn = false; ownOn = true;
      } else if (v.indexOf('p:') === 0) {
        var a = presetOf(v.slice(2)); if (!a) return;
        if (!presetId) stash = copy(R);
        presetId = a.presetId; webOn = false; ownOn = false;
      } else {
        if (presetId && stash) R = stash;
        presetId = ''; R.d = parseInt(v.slice(2), 10); webOn = false; ownOn = false;
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
    var clearB = mk('button', 'rc-btn-secondary rc-btn-sm', 'Clear Design'); clearB.type = 'button';
    clearB.title = 'Clear to a plain white helmet with no design';
    var cancelB = mk('button', 'rc-btn-secondary rc-btn-sm', 'Cancel'); cancelB.type = 'button';
    btns.appendChild(saveB); btns.appendChild(clearB); btns.appendChild(cancelB);
    right.appendChild(btns);
    // Saving the website default clears the member's own helmet (they get the default again)
    saveB.onclick = function () { var useDefault = webOn && !teamOn && !presetId; var out = effective(); modal.close(); ctx.onSave(useDefault ? null : out); };
    clearB.onclick = function () { R = blank(); presetId = ''; stash = null; teamOn = false; webOn = false; ownOn = false; draw(); };
    cancelB.onclick = function () { modal.close(); };

    /* ---- drawing ---- */
    function syncControls() {
      var V = teamOn ? clean(teamRecipe) : R;      // what the controls show
      if (!teamOn && !webOn && !ownOn && !presetId && R.d !== 0 && !H.visibleDesigns().some(function (d) { return d.slot === R.d; }) && H.visibleDesigns().length) R.d = H.visibleDesigns()[0].slot;
      dSel.value = teamOn ? 't:team' : presetId ? 'p:' + presetId : (webOn ? 'w:default' : (ownOn ? 'y:own' : 'd:' + R.d));
      SLOTS.forEach(function (s) {
        rows[s[0]].fs.value = V[s[0]][1];
        Array.prototype.forEach.call(rows[s[0]].sw.children, function (b) { b.classList.toggle('sel', b.dataset.id === V[s[0]][0]); });
      });
      Array.prototype.forEach.call(vs.children, function (b) { b.classList.toggle('sel', b.dataset.id === V.v); });
      // a locked design (award / special / premium helmet, or the team's manufacturer helmet) is used as is: everything but the Design list is grayed out
      var fixed = teamOn || webOn || !!presetId;
      [tools, visorLabel, vs].concat(Object.keys(rows).map(function (k) { return rows[k].row; })).forEach(function (n) { n.classList.toggle('rch-grayed', fixed); });
      Array.prototype.forEach.call(rows ? Object.keys(rows) : [], function (k) { rows[k].fs.disabled = fixed; Array.prototype.forEach.call(rows[k].sw.children, function (b) { b.disabled = fixed; }); });
      Array.prototype.forEach.call(vs.children, function (b) { b.disabled = fixed; });
      rb.disabled = fixed; rs.disabled = fixed;
      // Plain white (no design) has no accent areas: both accent rows, their swatches and finish lists are grayed out and disabled
      var plain = !presetId && V.d === 0;
      ['a1', 'a2'].forEach(function (k) {
        rows[k].row.classList.toggle('rch-dim', !fixed && plain);
        rows[k].fs.disabled = plain || fixed;
        Array.prototype.forEach.call(rows[k].sw.children, function (b) { b.disabled = plain || fixed; });
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
