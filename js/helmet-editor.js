/* =====================================================================
   Race Club helmet editor pieces  (js/helmet-editor.js)
   ---------------------------------------------------------------------
   RCHelmetEditor.openDesigner(ctx)  -- the large admin "Helmet Designer" popup
     ctx = { token, fetchApi, showModal, showToast }   (all supplied by Account.html)
   Needs js/helmet.js and css/helmet.css.
   Award helmets are complete designs: members use them exactly as designed.
   Also holds: Manage Helmet Designs (edit / archive / delete / give to members), Give Helmet (groups and members),
   and the Logo Manager (upload, edit, archive, delete logos).
   ===================================================================== */
(function () {
  'use strict';
  var H = window.RCHelmet;
  var KINDS = ['Website Default', 'Manufacturer', 'Special Event', 'Premium', 'Awards'];
  var KIND_HINTS = {
    'Website Default': 'The helmet drivers start with before they design their own. Only one exists: saving replaces the old one.',
    'Manufacturer': 'The team helmet drivers get when they use "Team Helmet". One per manufacturer.',
    'Special Event': 'A helmet to give to members for a special event. Members find it under "Special Event" in their Design list.',
    'Premium': 'A premium helmet to give to members. Members find it under "Premium" in their Design list.',
    'Awards': 'An award helmet, for example a season winner design. Members find it under "Awards" in their Design list.'
  };

  function mk(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // Championship first, then a blank row, then the rest (a null entry is the blank row).
  var GROUPS = [['Championship', 'Championship (single player members with a +)'], null, ['Drivers', 'All Members'], ['Organizers', 'Organizers only'], ['Stewards', 'Stewards only'], ['Admins', 'Admins only']];
  function spin(msg) { return window.rcHelmetSpinner_ ? window.rcHelmetSpinner_(msg) : mk('p', 'rch-hint', msg || 'Loading...'); }
  var SLOTS = [['b', 'Base Color'], ['a1', 'Accent Color 1'], ['a2', 'Accent Color 2']];
  // Slider directions (Matt): Left / right slides right = right. Up / down slides right = UP (the stored y counts down, so the slider shows 1254 - y).
  // Tilt: sliding right turns the layer clockwise. r (the stored angle) counts counter-clockwise, so the slider shows the opposite sign,
  // and only the part of r left over after whole 90 degree turns (the rotate buttons make those).
  var ROT_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 3.5 3 8.5 8 8.5"/></svg>';
  var LINK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  function turnBase(r) { return Math.round((Number(r) || 0) / 90) * 90; }
  function wrapAngle(r) { r = ((r % 360) + 360) % 360; return r > 180 ? r - 360 : r; }


  // The slider block shared by the layer editor and the Logo Manager form.
  // o.keys names the stored fields {x,y,w,h,r}; o.obj() returns the object that holds them; o.changed() redraws;
  // o.layer() returns a layer-like {f,m,v,s} so the picture's real proportions can be looked up.
  // Each slider has a typed number box on its right. The link button (between Max width and Max height) keeps the
  // picture's proportions while either one changes.
  var linkOn = true;     // remembered for the session
  function makeGrid(o) {
    var K = o.keys, g = mk('div', 'rch-sliders'), rows = {}, nat = null, fixedRatio = 0;
    function obj() { return o.obj(); }
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function fmt(d) { return String(Math.round(d * 10) / 10); }
    function ratio() { if (nat) return nat; if (!fixedRatio) { var oo = obj(); fixedRatio = (Number(oo[K.w]) || 1) / (Number(oo[K.h]) || 1); } return fixedRatio; }
    function sizeFrom(field) {
      if (!linkOn) return;
      var oo = obj(), r = ratio(), w = Number(oo[K.w]), h = Number(oo[K.h]);
      if (field === 'w') { h = w / r; if (h < 20) { h = 20; w = h * r; } if (h > 700) { h = 700; w = h * r; } }
      else { w = h * r; if (w < 20) { w = 20; h = w / r; } if (w > 700) { w = 700; h = w / r; } }
      oo[K.w] = Math.round(clamp(w, 20, 700)); oo[K.h] = Math.round(clamp(h, 20, 700));
      rows.w.sync(); rows.h.sync();
    }
    function addRow(field, label, min, max, step, toDisp, fromDisp) {
      var lab = mk('span', '', label); g.appendChild(lab);
      var rng = mk('input'); rng.type = 'range'; rng.min = min; rng.max = max; rng.step = step;
      var num = mk('input', 'rch-num'); num.type = 'number'; num.min = min; num.max = max; num.step = step; num.setAttribute('aria-label', label);
      var row = { lab: lab, sync: function () { var d = toDisp(obj()[K[field]]); rng.value = d; num.value = fmt(d); } };
      function apply(d) {
        obj()[K[field]] = fromDisp(clamp(d, min, max));
        if (field === 'w' || field === 'h') sizeFrom(field);
        o.changed();
      }
      rng.oninput = function () { var d = parseFloat(rng.value); num.value = fmt(d); apply(d); };
      num.oninput = function () { var d = parseFloat(num.value); if (!isFinite(d) || d < min || d > max) return; rng.value = d; apply(d); };   // live while typing, as long as the number is in range
      num.onchange = function () { var d = parseFloat(num.value); if (!isFinite(d)) { row.sync(); return; } d = clamp(d, min, max); apply(d); row.sync(); };
      g.appendChild(rng); g.appendChild(num);
      rows[field] = row; row.sync();
      return row;
    }
    addRow('x', 'Left / right', 0, 1254, 1, function (v) { return Number(v) || 0; }, function (d) { return d; });
    addRow('y', 'Up / down', 0, 1254, 1, function (v) { return 1254 - (Number(v) || 0); }, function (d) { return 1254 - d; });
    addRow('w', 'Max width', 20, 700, 1, function (v) { return Number(v) || 0; }, function (d) { return d; });
    var hr = addRow('h', 'Max height', 20, 700, 1, function (v) { return Number(v) || 0; }, function (d) { return d; });
    addRow('r', 'Tilt (deg)', -45, 45, 0.5,
      function (v) { v = Number(v) || 0; return -(v - turnBase(v)) || 0; },
      function (d) { return wrapAngle(turnBase(obj()[K.r]) - d); });
    // link button, centered between the Max width and Max height labels
    var lk = mk('button', 'rch-link', LINK_ICON); lk.type = 'button';
    function lkState() { lk.className = 'rch-link' + (linkOn ? ' on' : ''); lk.setAttribute('aria-pressed', linkOn ? 'true' : 'false'); lk.title = linkOn ? 'Linked: width and height keep the picture\'s proportions. Click to unlink.' : 'Unlinked. Click to keep the picture\'s proportions.'; lk.setAttribute('aria-label', lk.title); }
    lkState();
    lk.onclick = function () {
      linkOn = !linkOn; lkState();
      if (linkOn) { fixedRatio = 0; if (nat) { sizeFrom('w'); o.changed(); } }
    };
    hr.lab.appendChild(lk);
    return {
      el: g,
      sync: function () { for (var k in rows) rows[k].sync(); },
      loadAspect: function () {
        nat = null; fixedRatio = 0;
        if (!o.layer || !H.imageAspect) return;
        H.imageAspect(o.layer()).then(function (a) { nat = a; });
      }
    };
  }

  // "Rotate Left" and "Rotate Right" buttons: quarter turns of the layer (r counts counter-clockwise, so left = +90, right = -90).
  // The object's own width and height turn with it, so nothing is stretched. after() redraws and refreshes the sliders.
  function makeRotateButtons(getObj, key, after) {
    function one(label, dir) {
      var b = mk('button', 'rc-btn-secondary rch-rotbtn', ROT_ICON + '<span>' + label + '</span>'); b.type = 'button';
      b.title = 'Rotate ' + label.toLowerCase() + ' 90 degrees'; b.setAttribute('aria-label', 'Rotate ' + label.toLowerCase() + ' 90 degrees');
      if (dir < 0) b.firstChild.style.transform = 'scaleX(-1)';
      b.onclick = function () { var oo = getObj(); oo[key] = wrapAngle((Number(oo[key]) || 0) + dir * 90); after(); };
      return b;
    }
    return [one('Left', 1), one('Right', -1)];
  }

  var COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';

  function openDesigner(ctx) {
    var fetchApi = ctx.fetchApi, token = ctx.token, toast = ctx.showToast;
    // the Player Name and Flag box shows the admin's own name and country in the preview (members get theirs when they pick the helmet)
    var me = (typeof getProfileCache === 'function') ? (getProfileCache() || {}) : {};
    var previewPlayer = { n: me.displayName || me.username || 'Driver Name', c: me.location || 'United States', u: '12' };
    var body = mk('div', 'rch-designer');
    var modal = ctx.showModal('Helmet Designer', { bodyEl: body, wide: true, accentHead: true });
    modal.el.classList.add('rch-modal');
    // the loading lights sit in the middle of the popup
    var loadBox = mk('div'); loadBox.style.cssText = 'display:flex;align-items:center;justify-content:center;min-height:62vh';
    loadBox.appendChild(window.rcHelmetSpinner_ ? window.rcHelmetSpinner_('Loading the helmet designer...') : mk('p', 'rch-hint', 'Loading the helmet designer...'));
    body.appendChild(loadBox);
    try { localStorage.removeItem('rcHelmetVerChecked'); } catch (e0) {}   // helmets may change here: every page checks for the new version next time

    fetchApi('getHelmetAssets', {}).then(function (res) {
      if (!res || !res.success) { body.innerHTML = ''; body.appendChild(mk('p', 'rch-hint', 'Could not load the helmet designer: ' + esc((res && res.message) || 'no answer from the server.'))); return; }
      H.configure({ designs: res.designs || [], logos: res.logos || [], manufacturers: res.manufacturers || [], showLocked: true });
      return H.pruneDesigns().then(function () { build(res); });
    }).catch(function (err) {
      if (window.console) console.error('Helmet designer:', err);
      body.innerHTML = ''; body.appendChild(mk('p', 'rch-hint', 'No answer from the server. Close this and try again.'));
    });

    function build(assets) {
      body.innerHTML = '';
      var cfg = H.getConfig();
      // a plain white helmet with no design (the way the designer opens and what Reset returns to)
      function blankRecipe() { var b = H.normalizeRecipe(H.defaultRecipe()); b.d = 0; b.logos = []; return b; }
      var R = blankRecipe();
      var baseline = JSON.parse(JSON.stringify(R));   // what Reset returns to: the helmet as last loaded or saved
      var cur = { id: '', name: '', kind: 'Awards', mfr: '' };
      var mfrDesigns = {};          // manufacturer -> its saved helmet (shown as * in the Manufacturer list)
      var sel = null;               // the selected logo object (by reference, so reordering keeps it)
      var dragFrom = -1;

      var grid = mk('div', 'rch-grid');
      var left = mk('div', 'rch-left'), right = mk('div', 'rch-right');
      grid.appendChild(left); grid.appendChild(right); body.appendChild(grid);

      /* ---------------- left: preview ---------------- */
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
      // Size: shows the helmet at the avatar sizes used around the site (40, 72, 144 px) or full size.
      var prevSize = 0;   // 0 = Full
      var sizeRow = mk('div', 'rch-btns rch-bgrow');
      sizeRow.appendChild(mk('span', 'rch-label', 'Size'));
      [[40, '40px'], [72, '72px'], [144, '144px'], [0, 'Full']].forEach(function (z) {
        var x = mk('button', 'rc-btn-secondary rc-btn-row' + (z[0] === 0 ? ' rch-on' : ''), z[1]); x.type = 'button';
        x.onclick = function () {
          prevSize = z[0];
          [].forEach.call(sizeRow.querySelectorAll('button'), function (n) { n.classList.toggle('rch-on', n === x); });
          draw();
        };
        sizeRow.appendChild(x);
      });
      left.appendChild(sizeRow);

      /* ---------------- right: save bar ---------------- */
      var bar = mk('div', 'rch-section');
      var nameWrap = mk('div'); nameWrap.appendChild(mk('div', 'rch-label', 'Helmet name'));
      var nameIn = mk('input', 'rch-input'); nameIn.type = 'text'; nameIn.maxLength = 60; nameIn.placeholder = 'e.g. Season 1 Champion';
      nameIn.oninput = function () { cur.name = nameIn.value; };
      nameWrap.appendChild(nameIn);
      var kindWrap = mk('div'); kindWrap.appendChild(mk('div', 'rch-label', 'Kind'));
      var kindSel = mk('select', 'rch-select-wide'); KINDS.forEach(function (k) { var o = mk('option'); o.value = k; o.textContent = k; kindSel.appendChild(o); });
      kindWrap.appendChild(kindSel);
      var nkRow = mk('div', 'rch-row-nk'); nkRow.appendChild(nameWrap); nkRow.appendChild(kindWrap);
      bar.appendChild(nkRow);
      var mfrWrap = mk('div'); mfrWrap.appendChild(mk('div', 'rch-label', 'Manufacturer'));
      var mfrSel = mk('select', 'rch-select-wide'); mfrSel.appendChild(mk('option', '', '')); mfrSel.firstChild.value = ''; mfrSel.firstChild.textContent = 'Choose...';
      function fillMfrs() {
        var keep = mfrSel.value;
        while (mfrSel.options.length > 1) mfrSel.remove(1);
        (assets.manufacturers || []).forEach(function (m) { var o = mk('option'); o.value = m; o.textContent = m + (mfrDesigns[m] ? ' *' : ''); mfrSel.appendChild(o); });   // * = this manufacturer already has a helmet
        mfrSel.value = keep;
      }
      fillMfrs();
      mfrWrap.appendChild(mfrSel);
      var mcRow = mk('div', 'rch-row-mc'); mcRow.appendChild(mfrWrap);
      bar.appendChild(mcRow);
      var kindHint = mk('p', 'rch-hint'); bar.appendChild(kindHint);
      kindSel.onchange = function () { cur.kind = kindSel.value; syncMeta(); };
      mfrSel.onchange = function () { cur.mfr = mfrSel.value; if (cur.kind === 'Manufacturer') { cur.name = cur.mfr; } syncMeta(); };
      var status = mk('p', 'rch-status'); bar.appendChild(status);
      var btns = mk('div', 'rch-btns');
      var saveBtn = mk('button', 'rc-btn-primary rc-btn-sm', 'Save'); saveBtn.type = 'button';
      var saveNewBtn = mk('button', 'rc-btn-secondary rc-btn-sm', 'Save as New'); saveNewBtn.type = 'button'; saveNewBtn.style.display = 'none';
      saveNewBtn.title = 'Keep the helmet you opened as it is and save this design as a separate helmet';
      var manageBtn = mk('button', 'rc-btn-secondary rc-btn-sm', 'Manage Designs'); manageBtn.type = 'button';
      var clearBtn = mk('button', 'rc-btn-secondary rc-btn-sm', 'Clear'); clearBtn.type = 'button';
      clearBtn.title = 'Clear to a plain white helmet with no design and no logos';
      clearBtn.onclick = function () { R = blankRecipe(); sel = null; draw(); };
      var cancelBtn = mk('button', 'rc-btn-secondary rc-btn-sm', 'Cancel'); cancelBtn.type = 'button';
      cancelBtn.onclick = function () { modal.close(); };
      btns.appendChild(saveBtn); btns.appendChild(saveNewBtn); btns.appendChild(clearBtn); btns.appendChild(cancelBtn);
      bar.appendChild(btns);
      var btns2 = mk('div', 'rch-btns rch-btns-second'); btns2.appendChild(manageBtn); bar.appendChild(btns2);   // Manage Designs sits on its own row under the others
      var logosBtn = mk('button', 'rc-btn-secondary rc-btn-sm', 'Manage Logos'); logosBtn.type = 'button';
      var addLogoBtn = mk('button', 'rc-btn-secondary rc-btn-sm', 'Add Logo'); addLogoBtn.type = 'button';
      right.appendChild(bar);

      /* ---------------- right: style ---------------- */
      var style = mk('div', 'rch-section');
      var dRow = mk('div', 'rch-dstack');
      var dWrap = mk('div'); dWrap.appendChild(mk('div', 'rch-label', 'Design'));
      var dSel = mk('select', 'rch-select-wide');
      var plainO = mk('option'); plainO.value = 0; plainO.textContent = 'Plain';
      // Grouped like the layer picker below: unlocked designs under "Basic", locked ones under "Admin" (HelmetAssets.Locked)
      var gDef = mk('optgroup'); gDef.label = 'Basic'; var gAdm = mk('optgroup'); gAdm.label = 'Admin';
      cfg.designs.forEach(function (d) { var o = mk('option'); o.value = d.slot; o.textContent = String(d.slot).padStart(2, '0') + '  ' + d.name; (d.locked ? gAdm : gDef).appendChild(o); });
      gDef.insertBefore(plainO, gDef.firstChild);   // Plain is a Default design, open to every member
      dSel.appendChild(gDef);
      if (gAdm.children.length) dSel.appendChild(gAdm);
      dSel.onchange = function () { R.d = parseInt(dSel.value, 10); draw(); };
      dWrap.appendChild(dSel); dRow.appendChild(dWrap);
      var tools = mk('div', 'rch-btns rch-tools');
      var rb = mk('button', 'rc-btn-secondary rc-btn-row', 'Randomize'); rb.type = 'button';
      rb.onclick = function () { var lg = R.logos; var n = H.randomRecipe(R.d); n.logos = lg; R = H.normalizeRecipe(n); draw(); };
      var rs = mk('button', 'rc-btn-secondary rc-btn-row', 'Reset colors'); rs.type = 'button';
      rs.onclick = function () { var lg = R.logos, d = R.d; R = H.normalizeRecipe(H.defaultRecipe()); R.d = d; R.logos = lg; draw(); };
      tools.appendChild(rb); tools.appendChild(rs); dRow.appendChild(tools);
      style.appendChild(dRow);

      var slotRows = {};
      SLOTS.forEach(function (s) {
        var row = mk('div', 'rch-slot');
        var head = mk('div', 'rch-slot-head');
        head.appendChild(mk('span', 'rch-label', s[1]));
        var fs = mk('select', 'rch-finish');
        H.FINISHES.forEach(function (f) { var o = mk('option'); o.value = f.id; o.textContent = f.name; fs.appendChild(o); });
        fs.onchange = function () { R[s[0]][1] = fs.value; draw(); };
        head.appendChild(fs); row.appendChild(head);
        var sw = mk('div', 'rch-swatches');
        H.PALETTE.forEach(function (p) {
          var b = mk('button', 'rch-sw'); b.type = 'button'; b.style.background = p.hex; b.title = p.name; b.dataset.id = p.id;
          b.onclick = function () { R[s[0]][0] = p.id; draw(); };
          sw.appendChild(b);
        });
        var cpw = mk('label', 'rch-sw-custom'); cpw.title = 'Exact color (admin only)';
        var cp = mk('input'); cp.type = 'color';
        cp.oninput = function () { R[s[0]][0] = cp.value; draw(true); };
        cpw.appendChild(cp); sw.appendChild(cpw);
        row.appendChild(sw); style.appendChild(row);
        slotRows[s[0]] = { fs: fs, sw: sw, cp: cp, cpw: cpw };
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

      /* ---------------- right: logos (layer list) ---------------- */
      var lg = mk('div', 'rch-section');
      lg.appendChild(mk('div', 'rch-label', 'Logos and shapes (layers)'));
      var lmRow = mk('div', 'rch-btns rch-lmrow'); lmRow.appendChild(addLogoBtn); lmRow.appendChild(logosBtn);
      var layers = mk('div', 'rch-layers'); lg.appendChild(layers);
      var addRow = mk('div', 'rch-btns rch-addrow');
      var lpick = mk('select', 'rch-select-wide');
      function buildPicker() {
        var keep = lpick.value;
        lpick.innerHTML = '';
        var gS = mk('optgroup'); gS.label = 'Basic shapes';
        H.SHAPES.forEach(function (sh) { if (sh.premium || sh.gradient || sh.weathering || sh.player || sh.pattern) return; var o = mk('option'); o.value = 's:' + sh.id; o.textContent = sh.name; gS.appendChild(o); });
        lpick.appendChild(gS);
        var gP = mk('optgroup'); gP.label = 'Premium shapes';
        H.SHAPES.forEach(function (sh) { if (!sh.premium) return; var o = mk('option'); o.value = 's:' + sh.id; o.textContent = sh.name; gP.appendChild(o); });
        lpick.appendChild(gP);
        var gG = mk('optgroup'); gG.label = 'Gradients';
        H.SHAPES.forEach(function (sh) { if (!sh.gradient) return; var o = mk('option'); o.value = 's:' + sh.id; o.textContent = sh.name; gG.appendChild(o); });
        lpick.appendChild(gG);
        var gW = mk('optgroup'); gW.label = 'Weathering';
        H.SHAPES.forEach(function (sh) { if (!sh.weathering) return; var o = mk('option'); o.value = 's:' + sh.id; o.textContent = sh.name; gW.appendChild(o); });
        lpick.appendChild(gW);
        var gT = mk('optgroup'); gT.label = 'Patterns';
        H.SHAPES.forEach(function (sh) { if (!sh.pattern) return; var o = mk('option'); o.value = 's:' + sh.id; o.textContent = sh.name; gT.appendChild(o); });
        lpick.appendChild(gT);
        var gD = mk('optgroup'); gD.label = 'Dynamic';
        ['player_name', 'player_number', 'player', 'player_num'].forEach(function (id) { var oD = mk('option'); oD.value = 's:' + id; oD.textContent = shapeName(id); gD.appendChild(oD); });
        lpick.appendChild(gD);
        // custom logos, grouped by their Category (blank = "Custom logos"); archived logos are not offered
        var cats = {}, catOrder = [];
        H.getConfig().logos.forEach(function (l) {
          if (l.active === false) return;
          var c = String(l.category || '').trim() || 'Custom logos';
          if (!cats[c]) { cats[c] = []; catOrder.push(c); }
          cats[c].push(l);
        });
        catOrder.sort(function (x, y) { return x === 'Custom logos' ? -1 : (y === 'Custom logos' ? 1 : x.localeCompare(y)); });
        catOrder.forEach(function (c) {
          var g = mk('optgroup'); g.label = c;
          cats[c].forEach(function (l) { var o = mk('option'); o.value = 'f:' + l.file; o.textContent = l.name; g.appendChild(o); });
          lpick.appendChild(g);
        });
        var gM = mk('optgroup'); gM.label = 'Manufacturers';
        H.getConfig().manufacturers.forEach(function (n) { var o = mk('option'); o.value = 'm:' + n; o.textContent = n; gM.appendChild(o); });
        lpick.appendChild(gM);
        if (keep) lpick.value = keep;
      }
      buildPicker();
      var addB = mk('button', 'rc-btn-secondary rc-btn-sm', 'Add layer'); addB.type = 'button';
      addB.onclick = function () {
        if (R.logos.length >= MAX_LAYERS) { toast('A helmet can have 25 layers at most.', 'error'); return; }
        var kind = lpick.value.charAt(0), isM = kind === 'm', val = lpick.value.substr(2);
        var def = (kind === 'f') ? (H.getConfig().logos.filter(function (l) { return l.file === val; })[0] || {}) : {};
        var isGrad = kind === 's' && (H.SHAPES.filter(function (x) { return x.id === val; })[0] || {}).gradient;
        var isWeather = kind === 's' && (H.SHAPES.filter(function (x) { return x.id === val; })[0] || {}).weathering;
        var n = (kind === 's' && /^player/.test(val)) ? { s: val, c: 'black', m: '', v: 'std', f: '', x: 640, y: 770, w: (val === 'player_number' ? 120 : 320), h: 56, r: 0, sh: 1 } : isWeather ? { s: val, c: 'black', m: '', v: 'std', f: '', x: 640, y: 770, w: 360, h: 260, r: 0, sh: 0 } : isGrad ? { s: val, c: 'red', c2: 'black', m: '', v: 'std', f: '', x: 640, y: 770, w: 320, h: 200, r: 0, sh: 0 } : kind === 's'
          ? { s: val, c: 'red', m: '', v: 'std', f: '', x: 640, y: 770, w: 220, h: (val === 'stripe' || val === 'pill' || val === 'checker') ? 80 : 220, r: 0, sh: 0 }
          : { m: isM ? val : '', v: 'std', f: isM ? '' : val, x: def.defX != null ? def.defX : 640, y: def.defY != null ? def.defY : 770, w: def.defW != null ? def.defW : 240, h: def.defH != null ? def.defH : 170, r: def.defR != null ? def.defR : 3, sh: def.shadow === 0 ? 0 : 1 };
        R.logos.push(n); sel = n; draw();
      };
      addRow.appendChild(lpick); addRow.appendChild(addB);
      lg.appendChild(addRow);
      var detail = mk('div', 'rch-detail'); lg.appendChild(detail);
      lg.appendChild(lmRow);   // the Add Logo / Manage Logos buttons sit at the bottom of this section, under a divider line
      right.appendChild(lg);

      /* ---------------- right: recipe text ---------------- */
      var rec = mk('details', 'rch-section rch-details');
      rec.appendChild(mk('summary', '', 'Recipe text (copy or paste a helmet)'));
      var ta = mk('textarea', 'rch-text'); ta.spellcheck = false; rec.appendChild(ta);
      var rbtns = mk('div', 'rch-btns');
      var cpB = mk('button', 'rc-btn-secondary rc-btn-row', 'Copy Recipe'); cpB.type = 'button';
      var ldB = mk('button', 'rc-btn-secondary rc-btn-row', 'Use recipe from box'); ldB.type = 'button';
      cpB.onclick = function () {
        ta.select();
        var done = function () { toast('Recipe copied.', 'success'); };
        if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(done, function () { try { document.execCommand('copy'); } catch (e) {} done(); }); else { try { document.execCommand('copy'); } catch (e2) {} done(); }
      };
      ldB.onclick = function () {
        try { R = H.normalizeRecipe(JSON.parse(ta.value)); sel = null; draw(); toast('Recipe loaded.', 'success'); } catch (e) { toast('That is not a valid recipe.', 'error'); }
      };
      rbtns.appendChild(cpB); rbtns.appendChild(ldB); rec.appendChild(rbtns);
      right.appendChild(rec);

      /* ---------------- behaviour ---------------- */
      function shapeName(id) { var f = H.SHAPES.filter(function (x) { return x.id === id; })[0]; return f ? f.name : id; }
      function logoName(l) {
        if (l.s) return shapeName(l.s) + ' (' + (String(l.c).charAt(0) === '#' ? l.c : ((H.PALETTE.filter(function (p) { return p.id === l.c; })[0] || {}).name || l.c)) + ')';
        if (l.m) return l.m + (l.v === 'std' ? '' : ' (' + l.v + ')');
        // an uploaded logo is stored as u:<id> (or by file name): show the name it was given in the Logo Manager
        var f = String(l.f || ''), uid = f.indexOf('u:') === 0 ? f.slice(2) : null, all = H.getConfig().logos || [];
        for (var i = 0; i < all.length; i++) if ((uid !== null && all[i].id === uid) || (uid === null && f && all[i].file === f)) return all[i].name || f;
        return f || 'logo';
      }

      var MAX_LAYERS = 25;
      function edgeLine(label, extra) { var e = mk('div', 'rch-edge' + (extra ? ' ' + extra : '')); e.appendChild(mk('span', 'rch-edge-line')); e.appendChild(mk('span', 'rch-edge-label', label)); e.appendChild(mk('span', 'rch-edge-line')); return e; }
      function renderLayers(missing) {
        layers.innerHTML = '';
        var ac = Math.max(0, Math.min(R.logos.length, Math.floor(+R.ac) || 0));   // layers under the accent paint
        // display list, front to back: layers above the Accents line, the Accents line, layers under it
        var items = [], accIn = false, accItem = { acc: true };
        for (var i = R.logos.length - 1; i >= 0; i--) {
          if (!accIn && i < ac) { items.push(accItem); accIn = true; }
          items.push({ idx: i });
        }
        if (!accIn) items.push(accItem);
        function applyOrder() {
          var ai = items.indexOf(accItem), below = 0, k;
          for (k = ai + 1; k < items.length; k++) if (!items[k].acc) below++;
          R.logos = items.filter(function (it) { return !it.acc; }).map(function (it) { return R.logos[it.idx]; }).reverse();
          if (below > 0) R.ac = below; else delete R.ac;
          dragFrom = -1; draw();
        }
        function moveItem(from, to) {
          if (from < 0 || from === to || to < 0 || to > items.length) return;
          var moved = items.splice(from, 1)[0];
          items.splice(Math.max(0, Math.min(items.length, to)), 0, moved);
          applyOrder();
        }
        function dropOn(el, pos) {
          el.addEventListener('dragover', function (e) { e.preventDefault(); el.classList.add('over'); });
          el.addEventListener('dragleave', function () { el.classList.remove('over'); });
          el.addEventListener('drop', function (e) { e.preventDefault(); el.classList.remove('over'); moveItem(dragFrom, pos); });
        }
        function dragStart(el, pos) {
          el.draggable = true;
          el.addEventListener('dragstart', function (e) { dragFrom = pos; el.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', String(pos)); e.dataTransfer.effectAllowed = 'move'; } catch (x) {} });
          el.addEventListener('dragend', function () { el.classList.remove('dragging'); layers.querySelectorAll('.over').forEach(function (n) { n.classList.remove('over'); }); });
        }
        var topEdge = edgeLine('Outer Shell'); dropOn(topEdge, 0); layers.appendChild(topEdge);
        if (!R.logos.length) layers.appendChild(mk('p', 'rch-hint', 'No logos or shapes yet. Pick one below and press Add layer.'));
        items.forEach(function (it, pos) {
          if (it.acc) {
            var ar = edgeLine('Accents', 'rch-edge-acc'); dragStart(ar, pos); dropOn(ar, pos);
            ar.title = 'Drag this line, or move layers above and below it, to choose which layers sit under the accent paint.';
            layers.appendChild(ar);
            return;
          }
          var idx = it.idx, l = R.logos[idx];
          var row = mk('div', 'rch-layer' + (l === sel ? ' sel' : '')); row.dataset.pos = pos;
          row.appendChild(mk('span', 'rch-layer-no', String(idx + 1)));   // layer number: 1 is the back layer, the highest number is in front
          row.appendChild(mk('span', 'rch-grip', '&#8942;&#8942;'));
          var nm = mk('span', 'rch-layer-name'); nm.textContent = logoName(l);
          if (missing && missing[idx]) { var miss = mk('span', 'rch-miss', 'FILE NOT FOUND'); nm.appendChild(miss); }
          row.appendChild(nm);
          var up = mk('button', 'rch-icon', '&#9650;'); up.type = 'button'; up.title = 'Bring forward';
          var dn = mk('button', 'rch-icon', '&#9660;'); dn.type = 'button'; dn.title = 'Send back';
          var cp = mk('button', 'rch-icon', COPY_ICON); cp.type = 'button'; cp.title = 'Copy this layer (the copy goes directly above it)';
          var rm = mk('button', 'rch-icon', '&times;'); rm.type = 'button'; rm.title = 'Remove layer';
          // the arrows move a layer one step in the list, across the Accents line when it is next to it
          up.onclick = function (e) { e.stopPropagation(); moveItem(pos, pos - 1); };
          dn.onclick = function (e) { e.stopPropagation(); moveItem(pos, pos + 1); };
          rm.onclick = function (e) { e.stopPropagation(); R.logos.splice(idx, 1); if (idx < ac) { if (ac - 1 > 0) R.ac = ac - 1; else delete R.ac; } if (sel === l) sel = null; draw(); };
          cp.onclick = function (e) {
            e.stopPropagation();
            if (R.logos.length >= MAX_LAYERS) { toast('A helmet can have 25 layers at most.', 'error'); return; }
            var dup = JSON.parse(JSON.stringify(l)); dup.x = (+dup.x || 0) + 20; dup.y = (+dup.y || 0) - 20;
            R.logos.splice(idx + 1, 0, dup); if (idx < ac) R.ac = ac + 1; sel = dup; draw();
          };
          row.appendChild(up); row.appendChild(dn); row.appendChild(cp); row.appendChild(rm);
          row.onclick = function () { sel = l; renderLayers(missing); renderDetail(); updateSelBox(); };
          dragStart(row, pos); dropOn(row, pos);
          layers.appendChild(row);
        });
        var baseEdge = edgeLine('Base'); dropOn(baseEdge, items.length); layers.appendChild(baseEdge);
      }

      var curGrid = null;           // the slider block of the selected layer (the preview drag keeps it in step)
      function renderDetail() {
        detail.innerHTML = ''; curGrid = null;
        if (!sel || R.logos.indexOf(sel) < 0) return;
        var grid = curGrid = makeGrid({ keys: { x: 'x', y: 'y', w: 'w', h: 'h', r: 'r' }, obj: function () { return sel; }, layer: function () { return sel; }, changed: function () { draw(true); } });
        grid.loadAspect();
        detail.appendChild(mk('div', 'rch-label rch-subhead', 'Layer manipulation'));
        detail.appendChild(grid.el);
        var opts = mk('div', 'rch-btns');
        // Soft shadow and Strong shadow: one or the other or none (sh: 0 none, 1 soft, 2 strong)
        var shl = mk('label', 'rch-check rch-plain'); var shc = mk('input'); shc.type = 'checkbox'; shc.checked = sel.sh === 1 || sel.sh === true;
        var sgl = mk('label', 'rch-check rch-plain'); var sgc = mk('input'); sgc.type = 'checkbox'; sgc.checked = sel.sh === 2;
        shc.onchange = function () { sel.sh = shc.checked ? 1 : 0; sgc.checked = false; draw(true); };
        sgc.onchange = function () { sel.sh = sgc.checked ? 2 : 0; shc.checked = false; draw(true); };
        shl.appendChild(shc); shl.appendChild(document.createTextNode(' Soft shadow')); opts.appendChild(shl);
        sgl.appendChild(sgc); sgl.appendChild(document.createTextNode(' Strong shadow')); opts.appendChild(sgl);
        makeRotateButtons(function () { return sel; }, 'r', function () { grid.sync(); draw(true); }).forEach(function (bn) { opts.appendChild(bn); });
        if (sel.s) {
          var tailHint = '';
          var gdef = H.SHAPES.filter(function (x) { return x.id === sel.s; })[0] || {};
          var pickColor = function (key, label, hint, withNone) {
            var cw = mk('div', 'rch-shapecolor');
            cw.appendChild(mk('div', 'rch-label', label));
            var sw2 = mk('div', 'rch-swatches');
            var isHexC = String(sel[key]).charAt(0) === '#';
            H.PALETTE.forEach(function (p) {
              var b = mk('button', 'rch-sw' + (!isHexC && sel[key] === p.id ? ' sel' : '')); b.type = 'button'; b.style.background = p.hex; b.title = p.name;
              b.onclick = function () { sel[key] = p.id; draw(); };
              sw2.appendChild(b);
            });
            if (withNone) {
              // the last option is "no background" (see-through) instead of the exact-color picker
              var nb = mk('button', 'rch-sw rch-sw-none' + (!sel[key] ? ' sel' : '')); nb.type = 'button'; nb.title = 'No background (transparent)';
              nb.onclick = function () { delete sel[key]; draw(); };
              sw2.appendChild(nb);
            } else {
            var cpw2 = mk('label', 'rch-sw-custom' + (isHexC ? ' sel' : '')); cpw2.title = 'Exact color';
            if (isHexC) cpw2.style.background = sel[key];
            var cp2 = mk('input'); cp2.type = 'color'; cp2.value = H.hexOf(sel[key]);
            cp2.oninput = function () { sel[key] = cp2.value; draw(true); };
            cp2.onchange = function () { draw(); };
            cpw2.appendChild(cp2); sw2.appendChild(cpw2);
            }
            cw.appendChild(sw2);
            if (hint) cw.appendChild(mk('p', 'rch-hint', hint));
            detail.appendChild(cw);
          };
          if (gdef.gradient) {
            if (gdef.colors === 2) { if (!sel.c2) sel.c2 = 'black'; pickColor('c', 'Gradient color 1'); pickColor('c2', 'Gradient color 2'); }
            else { pickColor('c', 'Gradient color'); tailHint = 'This one fades from the color to see-through.'; }
          } else if (gdef.player) {
            pickColor('c', 'Name color');
            pickColor('bg', 'Name background color', '', true);
          } else { pickColor('c', gdef.weathering ? 'Mark color' : (gdef.pattern ? 'Pattern color' : (gdef.player ? 'Name color' : 'Shape color'))); if (sel.s === 'checker') tailHint = 'The checkered strip uses this color and white.';  if (gdef.pattern) tailHint = 'A pattern tile. Copy the layer and set the copy right beside it, with the same width and height, and the pattern carries on with no seam.'; }
          // Transparency slider (between the colors and any note): 0 = solid, up to 90 = nearly see-through. Stored as o = percent visible.
          var tw = mk('div', 'rch-shapecolor');
          tw.appendChild(mk('div', 'rch-label', 'Transparency'));
          var tg = mk('div', 'rch-sliders rch-sliders-one');
          var tr = mk('input'); tr.type = 'range'; tr.min = 0; tr.max = 90; tr.step = 1;
          var tn = mk('input', 'rch-num'); tn.type = 'number'; tn.min = 0; tn.max = 90; tn.step = 1; tn.setAttribute('aria-label', 'Transparency percent');
          function curT() { var ov = Number(sel.o); return (ov > 0 && ov < 100) ? Math.round(100 - ov) : 0; }
          function setT(t) { t = Math.max(0, Math.min(90, Math.round(t))); if (t === 0) delete sel.o; else sel.o = 100 - t; tr.value = t; draw(true); }
          tr.value = curT(); tn.value = curT();
          tr.oninput = function () { tn.value = tr.value; setT(parseFloat(tr.value)); };
          tn.oninput = function () { var d = parseFloat(tn.value); if (isFinite(d) && d >= 0 && d <= 90) setT(d); };
          tn.onchange = function () { var d = parseFloat(tn.value); setT(isFinite(d) ? d : 0); tn.value = curT(); };
          tg.appendChild(tr); tg.appendChild(tn); tw.appendChild(tg); detail.appendChild(tw);
          if (tailHint) detail.appendChild(mk('p', 'rch-hint', tailHint));
        }
        detail.appendChild(opts);
      }

      function syncMeta() {
        var isMfr = cur.kind === 'Manufacturer';
        kindSel.value = cur.kind; mfrSel.value = cur.mfr || '';
        mcRow.style.display = isMfr ? '' : 'none';
        kindHint.textContent = KIND_HINTS[cur.kind] || '';
        // a manufacturer helmet is named after its manufacturer, so the name box is switched off
        if (isMfr) { cur.name = cur.mfr || ''; }
        nameIn.disabled = isMfr;
        nameIn.placeholder = isMfr ? 'Named after the manufacturer' : 'e.g. Season 1 Champion';
        if (document.activeElement !== nameIn) nameIn.value = cur.name;
        status.innerHTML = cur.id ? '' : 'This helmet has not been saved yet.';
        saveNewBtn.style.display = cur.id ? '' : 'none';
      }

      function syncControls() {
        dSel.value = R.d;
        SLOTS.forEach(function (s) {
          var r = slotRows[s[0]];
          r.fs.value = R[s[0]][1];
          var isHex = String(R[s[0]][0]).charAt(0) === '#';
          [].forEach.call(r.sw.querySelectorAll('.rch-sw'), function (b) { b.classList.toggle('sel', !isHex && b.dataset.id === R[s[0]][0]); });
          r.cp.value = H.hexOf(R[s[0]][0]);
          r.cpw.classList.toggle('sel', isHex);
          r.cpw.style.background = isHex ? H.hexOf(R[s[0]][0]) : '';
        });
        [].forEach.call(vs.querySelectorAll('.rch-visor'), function (b) { b.classList.toggle('sel', b.dataset.id === R.v); });
        if (document.activeElement !== ta) ta.value = JSON.stringify(R);
      }

      var busy = false, again = false, lastQuick = false;
      function put(el, cv) { el.innerHTML = ''; el.appendChild(cv); }
      function draw(quick) {
        syncControls();
        if (!quick) { renderLayers(); renderDetail(); }
        if (busy) { again = true; lastQuick = !!quick; return; }
        busy = true;
        // A small size is drawn at twice its size and shown at its size, the way the avatars around the site are.
        var rw = prevSize ? prevSize * 2 : (quick ? 560 : 760);
        var jobs = [H.render(R, { width: rw, player: previewPlayer }).then(function (cv) { if (prevSize) { cv.style.width = prevSize + 'px'; cv.style.height = 'auto'; } put(stage, cv); updateSelBox(); if (!quick) renderLayers(cv.missingLogos); })];
        Promise.all(jobs).then(function () {}).catch(function (e) { toast('Render problem: ' + e.message, 'error'); }).then(function () { busy = false; if (again) { again = false; draw(lastQuick); } });
      }

      // A red outline on the helmet around the layer that is selected, so you can see which one you are moving.
      var aspectCache = {};
      function updateSelBox() {
        var old = stage.querySelector('.rch-selbox'); if (old) old.remove();
        if (!sel || R.logos.indexOf(sel) < 0) return;
        var cv = stage.querySelector('canvas'); if (!cv) return;
        var C = H.CROP, k = cv.clientWidth / C.w;
        var bw = Number(sel.w) || 0, bh = Number(sel.h) || 0;
        var box = mk('div', 'rch-selbox'); box.style.pointerEvents = 'none';
        function place(w, h) {
          box.style.width = (w * k) + 'px'; box.style.height = (h * k) + 'px';
          box.style.left = (cv.offsetLeft + (sel.x - C.x) * k) + 'px'; box.style.top = (cv.offsetTop + (sel.y - C.y) * k) + 'px';
          box.style.transform = 'translate(-50%, -50%) rotate(' + (-(Number(sel.r) || 0)) + 'deg)';
        }
        if (!sel.s) {                       // a picture is drawn "contained" in its box: outline the picture itself
          var key = (sel.m || '') + '|' + (sel.v || '') + '|' + (sel.f || ''), asp = aspectCache[key], layer = sel;
          if (asp) { var fit = Math.min(bw / asp, bh); place(fit * asp, fit); }
          else {
            place(bw, bh);
            H.imageAspect(layer).then(function (a) { if (a) { aspectCache[key] = a; if (sel === layer) updateSelBox(); } });
          }
        } else place(bw, bh);
        stage.appendChild(box);
      }

      // click / drag on the preview moves the selected logo
      var dragging = false;
      function moveTo(ev) {
        if (!sel) return; var cv = stage.querySelector('canvas'); if (!cv) return;
        var rc = cv.getBoundingClientRect(), C = H.CROP;
        sel.x = Math.round(C.x + (ev.clientX - rc.left) / rc.width * C.w); sel.y = Math.round(C.y + (ev.clientY - rc.top) / rc.height * C.h);
        if (curGrid) curGrid.sync();
        draw(true);
      }
      stage.addEventListener('pointerdown', function (e) { dragging = true; moveTo(e); });
      var onMove = function (e) { if (dragging) moveTo(e); }, onUp = function () { dragging = false; };
      window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
      modal.closeBtn.addEventListener('click', function () { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); });

      /* ---------------- save / load ---------------- */
      // The saved helmets (active ones) decide which manufacturers get a * and whether a save would replace one.
      function refreshPresets() {
        return fetchApi('adminListHelmetPresets', { token: token }).then(function (res) {
          if (!res || !res.success) return null;
          mfrDesigns = {};
          (res.presets || []).forEach(function (p) { if (p.kind === 'Manufacturer' && p.active && p.manufacturer) mfrDesigns[p.manufacturer] = p; });
          fillMfrs();
          return res.presets || [];
        }).catch(function () { return null; });
      }
      // Popup: ask before a save replaces the helmet that is already there. onYes runs the save.
      function askReplace(title, msg, onYes) {
        var cb = mk('div', 'rch-assign');
        cb.appendChild(mk('p', 'rch-hint', msg));
        var row = mk('div', 'rch-btns');
        var yes = mk('button', 'rc-btn-primary rc-btn-sm', 'Save over it'); yes.type = 'button';
        var no = mk('button', 'rc-btn-secondary rc-btn-sm', 'Cancel'); no.type = 'button';
        row.appendChild(yes); row.appendChild(no); cb.appendChild(row);
        var cm = ctx.showModal(title, { bodyEl: cb, accentHead: true });
        yes.onclick = function () { cm.close(); onYes(); };
        no.onclick = function () { cm.close(); };
      }
      // while a save is running the button reads Saving... and the X in the corner is switched off
      function setSaving(on) {
        saveBtn.disabled = on; saveNewBtn.disabled = on; cancelBtn.disabled = on; saveBtn.textContent = on ? 'Saving...' : 'Save';
        modal.closeBtn.disabled = on; modal.closeBtn.style.opacity = on ? '0.35' : ''; modal.closeBtn.style.pointerEvents = on ? 'none' : '';
      }
      // Save / Save as New. forceNew = save this as a separate helmet and leave the one that was loaded alone.
      function doSave(skipAsk, forceNew, skipChange) {
        var pid = forceNew ? '' : cur.id;
        var name = (cur.kind === 'Manufacturer' ? cur.mfr : (cur.name || '')).trim();
        if (cur.kind === 'Manufacturer' && !cur.mfr) { toast('Choose a manufacturer for a Manufacturer helmet.', 'error'); return; }
        if (!name) { toast('Give the helmet a name first.', 'error'); nameIn.focus(); return; }
        // the helmet that was loaded or saved is being changed into something different: ask whether this is a new helmet or an edit of that one
        if (!skipChange && !forceNew && cur.id && cur.saved && (cur.saved.kind !== cur.kind || cur.saved.mfr !== (cur.kind === 'Manufacturer' ? cur.mfr : '') || cur.saved.name !== name)) {
          var qb = mk('div', 'rch-assign');
          qb.appendChild(mk('p', 'rch-hint', 'You changed the name or kind of "' + cur.saved.name + '". Is this a brand new helmet, or do you want to change the one you opened? A new helmet leaves the old one exactly as it was.'));
          var qr = mk('div', 'rch-btns');
          var qNew = mk('button', 'rc-btn-primary rc-btn-sm', 'Save as new helmet'); qNew.type = 'button';
          var qOld = mk('button', 'rc-btn-secondary rc-btn-sm', 'Change the old one'); qOld.type = 'button';
          var qNo = mk('button', 'rc-btn-secondary rc-btn-sm', 'Cancel'); qNo.type = 'button';
          qr.appendChild(qNew); qr.appendChild(qOld); qr.appendChild(qNo); qb.appendChild(qr);
          var qm = ctx.showModal('Save as a new helmet?', { bodyEl: qb, accentHead: true });
          qNew.onclick = function () { qm.close(); doSave(false, true, true); };
          qOld.onclick = function () { qm.close(); doSave(false, false, true); };
          qNo.onclick = function () { qm.close(); };
          return;
        }
        if (!skipAsk && (cur.kind === 'Website Default' || cur.kind === 'Manufacturer')) {
          saveBtn.disabled = true;
          refreshPresets().then(function (list) {
            saveBtn.disabled = false;
            var old = (list || []).filter(function (p) {
              return p.active && p.kind === cur.kind && p.presetId !== pid && (cur.kind === 'Website Default' || p.manufacturer === cur.mfr);
            })[0];
            if (!old) { doSave(true, forceNew, true); return; }
            askReplace(cur.kind === 'Website Default' ? 'Replace the Website Default?' : 'Replace the ' + cur.mfr + ' helmet?',
              (cur.kind === 'Website Default' ? 'A Website Default helmet ("' + old.name + '") already exists.' : 'The ' + cur.mfr + ' helmet already exists.') + ' Do you want to save over the previous design? The older one will be archived.',
              function () { doSave(true, forceNew, true); });
          });
          return;
        }
        setSaving(true);
        fetchApi('adminSaveHelmetPreset', {
          method: 'POST', token: token,
          body: { presetId: pid, name: name, kind: cur.kind, manufacturer: cur.kind === 'Manufacturer' ? cur.mfr : '', recipe: JSON.stringify(R) }
        }).then(function (res) {
          setSaving(false);
          if (!res || !res.success) { toast((res && res.message) || 'Could not save the helmet.', 'error'); return; }
          cur.id = res.presetId; cur.name = name; cur.saved = { name: name, kind: cur.kind, mfr: cur.kind === 'Manufacturer' ? cur.mfr : '' };
          baseline = JSON.parse(JSON.stringify(R));
          syncMeta(); refreshPresets();
          try { localStorage.removeItem('rcHelmetVerChecked'); } catch (e1) {}
          toast(res.replaced ? ('Saved. It replaced the older helmet "' + res.replaced + '".') : 'Helmet saved.', 'success');
        }).catch(function () { setSaving(false); toast('No answer from the server. Try again.', 'error'); });
      }
      saveBtn.onclick = function () { doSave(false); };
      saveNewBtn.onclick = function () { doSave(false, true, true); };
      function loadPreset(p) {
        R = H.normalizeRecipe(p.recipe); sel = null; baseline = JSON.parse(JSON.stringify(R));
        cur = { id: p.presetId, name: p.name, kind: (KINDS.indexOf(p.kind) >= 0 ? p.kind : 'Awards'), mfr: p.manufacturer || '' };
        cur.saved = { name: p.name, kind: cur.kind, mfr: cur.kind === 'Manufacturer' ? cur.mfr : '' };
        syncMeta(); draw(); toast('Loaded "' + p.name + '".', 'success');
      }
      /* ---------------- shared bits for the manager popups ---------------- */
      function btn(label, cls) { var b = mk('button', cls || 'rc-btn-secondary rc-btn-row', label); b.type = 'button'; return b; }
      function renderThumb(host, recipe, w) { H.render(recipe, { width: w || 140, player: previewPlayer }).then(function (cv) { host.appendChild(cv); }).catch(function () {}); }
      // a category select with "+ New category..." (used by the logo form)
      function catPicker(list, chosen) {
        var wrap = mk('div'); var sel2 = mk('select', 'rch-select-wide'); var nw = mk('input', 'rch-input'); nw.type = 'text'; nw.maxLength = 40; nw.placeholder = 'New category name'; nw.style.display = 'none'; nw.style.marginTop = '6px';
        var items = list.filter(function (c, i, a) { return c && a.indexOf(c) === i; }).sort();
        if (chosen && items.indexOf(chosen) < 0) items.push(chosen);
        var none = mk('option'); none.value = ''; none.textContent = 'Custom logos (no category)'; sel2.appendChild(none);
        items.forEach(function (c) { var o = mk('option'); o.value = c; o.textContent = c; sel2.appendChild(o); });
        var on = mk('option'); on.value = '__new__'; on.textContent = '+ New category...'; sel2.appendChild(on);
        sel2.value = chosen || '';
        sel2.onchange = function () { nw.style.display = sel2.value === '__new__' ? '' : 'none'; if (sel2.value === '__new__') nw.focus(); };
        wrap.appendChild(sel2); wrap.appendChild(nw);
        return { el: wrap, get: function () { return sel2.value === '__new__' ? nw.value.trim() : sel2.value; } };
      }
      function reloadLogoAssets() {
        return fetchApi('getHelmetAssets', {}).then(function (res) {
          if (res && res.success) { H.configure({ logos: res.logos || [] }); try { localStorage.removeItem('rcHelmetAssets'); } catch (e) {} buildPicker(); }
        }).catch(function () {});
      }

      /* ---------------- Manage Helmet Designs ---------------- */
      function openManage() {
        var mb = mk('div', 'rch-loadbody');
        var mm = ctx.showModal('Manage Helmet Designs', { bodyEl: mb, wide: true, accentHead: true });
        function load() {
          mb.innerHTML = ''; mb.appendChild(spin('Loading...'));
          fetchApi('adminListHelmetPresets', { token: token, params: { includeArchived: '1' } }).then(function (res) {
            mb.innerHTML = '';
            if (!res || !res.success) { mb.appendChild(mk('p', 'rch-hint', 'Could not load: ' + esc((res && res.message) || 'no answer.'))); return; }
            var list = res.presets || [];
                        mb.appendChild(mk('p', 'rch-hint', 'Edit opens the helmet in the designer. Give to members chooses who can use it. Archive hides it from new use without losing it. A helmet that has ever been given to members cannot be deleted, only edited or archived.'));
            if (!list.length) { mb.appendChild(mk('p', 'rch-hint', 'Nothing saved yet. Design a helmet and press Save.')); return; }
            KINDS.forEach(function (k) {
              var rows = list.filter(function (p) { return p.kind === k; });
              if (!rows.length) return;
              mb.appendChild(mk('div', 'rch-label rch-mt', esc(k)));
              rows.forEach(function (p) {
                var row = mk('div', 'rch-loadrow' + (p.active ? '' : ' rch-archived'));
                var th = mk('div', 'rch-thumb'); row.appendChild(th); renderThumb(th, p.recipe, 140);
                var info = mk('div', 'rch-info');
                info.appendChild(mk('div', 'rch-pname', esc(p.name) + (p.active ? '' : ' (archived)')));
                var bits = [];
                if (p.kind === 'Manufacturer') bits.push(p.manufacturer);
                if (p.kind !== 'Website Default' && p.kind !== 'Manufacturer') { bits.push('Category: ' + (p.category || 'Awards')); bits.push(p.grantCount ? ('given to ' + p.grantCount + (p.grantCount === 1 ? ' group or member' : ' groups and members')) : (p.everGiven ? 'access taken back' : 'not given to anyone yet')); }
                info.appendChild(mk('div', 'rch-psub', esc(bits.filter(Boolean).join(' - '))));
                row.appendChild(info);
                var act = mk('div', 'rch-btns');
                function home() {
                  act.innerHTML = '';
                  var ed = btn('Edit'); ed.onclick = function () { loadPreset(p); mm.close(); };
                  act.appendChild(ed);
                  var givable = p.kind !== 'Website Default' && p.kind !== 'Manufacturer';
                  if (givable) { var gv = btn('Give to...'); gv.onclick = function () { openAssign(p, load); }; act.appendChild(gv); }
                  if (p.active) {
                    var ar = btn('Archive'); ar.onclick = function () { confirmRow('Archive it?', 'Yes, archive', function (done) {
                      fetchApi('adminSetHelmetPresetActive', { method: 'POST', token: token, body: { presetId: p.presetId, active: 'Inactive' } }).then(function (r2) { done(r2 && r2.success, r2 && r2.message); load(); }).catch(function () { done(false); });
                    }); };
                    act.appendChild(ar);
                  } else {
                    var rs2 = btn('Restore', 'rc-btn-primary rc-btn-sm rc-btn-row');
                    rs2.onclick = function () { rs2.disabled = true; fetchApi('adminSetHelmetPresetActive', { method: 'POST', token: token, body: { presetId: p.presetId, active: 'Active' } }).then(function (r2) { if (r2 && r2.success) { toast('Restored.', 'success'); load(); } else { rs2.disabled = false; toast((r2 && r2.message) || 'Could not restore it.', 'error'); } }).catch(function () { rs2.disabled = false; toast('No answer from the server.', 'error'); }); };
                    act.appendChild(rs2);
                  }
                  var dl = btn('Delete');
                  if (p.everGiven) { dl.disabled = true; dl.title = 'This helmet has been given to members, so it can only be edited or archived.'; }
                  else dl.onclick = function () { confirmRow('Delete it for good?', 'Yes, delete', function (done) {
                    fetchApi('adminDeleteHelmetPreset', { method: 'POST', token: token, body: { presetId: p.presetId } }).then(function (r2) { done(r2 && r2.success, r2 && r2.message); if (r2 && r2.success) { if (cur.id === p.presetId) { cur.id = ''; syncMeta(); } load(); } }).catch(function () { done(false); });
                  }); };
                  act.appendChild(dl);
                }
                function confirmRow(question, yesLabel, run) {
                  act.innerHTML = ''; act.appendChild(mk('span', 'rch-psub', question));
                  var yes = btn(yesLabel, 'rc-btn-primary rc-btn-sm rc-btn-row'), no = btn('Keep');
                  yes.onclick = function () { yes.disabled = true; run(function (ok, msg) { if (!ok) { yes.disabled = false; toast(msg || 'That did not work.', 'error'); } else toast('Done.', 'success'); }); };
                  no.onclick = home;
                  act.appendChild(yes); act.appendChild(no);
                }
                home(); row.appendChild(act); mb.appendChild(row);
              });
            });
          }).catch(function () { mb.innerHTML = ''; mb.appendChild(mk('p', 'rch-hint', 'No answer from the server.')); });
        }
        load();
      }
      manageBtn.onclick = openManage;

      /* ---------------- Give a helmet to groups and members ---------------- */
      function openAssign(p, after) {
        var ab = mk('div', 'rch-assign');
        ab.appendChild(spin('Loading...'));
        var am = ctx.showModal('Give Helmet', { bodyEl: ab, accentHead: true });
        Promise.all([fetchApi('adminListHelmetMembers', { token: token }), fetchApi('adminListHelmetGrants', { token: token, params: { presetId: p.presetId } })]).then(function (rr) {
          ab.innerHTML = '';
          var mres = rr[0], gres = rr[1];
          if (!mres || !mres.success || !gres || !gres.success) { ab.appendChild(mk('p', 'rch-hint', 'Could not load: ' + esc(((mres && !mres.success && mres.message) || (gres && gres.message)) || 'no answer.'))); return; }
          var groupsOn = {}; (gres.groups || []).forEach(function (g) { groupsOn[g] = true; });
          var profOn = {}; (gres.profiles || []).forEach(function (x) { profOn[x] = true; });
          ab.appendChild(mk('p', 'rch-hint', 'Members who have this helmet will find it in their Design list under the category "' + esc(p.category || 'Awards') + '".'));
          ab.appendChild(mk('div', 'rch-label', 'Groups'));
          GROUPS.forEach(function (g) {
            if (!g) { ab.appendChild(mk('div', 'rch-gap')); return; }
            var lab = mk('label', 'rch-check'); var cb = mk('input'); cb.type = 'checkbox'; cb.checked = !!groupsOn[g[0]];
            cb.onchange = function () { groupsOn[g[0]] = cb.checked; };
            lab.appendChild(cb); lab.appendChild(mk('span', null, esc(g[1]))); ab.appendChild(lab);
          });
          ab.appendChild(mk('div', 'rch-label rch-mt', 'Individual members'));
          var q = mk('input', 'rch-input'); q.type = 'text'; q.placeholder = 'Search by name or username'; ab.appendChild(q);
          var listEl = mk('div', 'rch-memberlist'); ab.appendChild(listEl);
          function renderMembers() {
            var term = q.value.trim().toLowerCase(); listEl.innerHTML = '';
            (mres.members || []).filter(function (m) { return !term || (m.name + ' ' + m.username).toLowerCase().indexOf(term) >= 0; }).forEach(function (m) {
              var lab = mk('label', 'rch-check'); var cb = mk('input'); cb.type = 'checkbox'; cb.checked = !!profOn[m.profileId];
              cb.onchange = function () { profOn[m.profileId] = cb.checked; };
              lab.appendChild(cb); lab.appendChild(mk('span', null, esc(m.name) + ' <span class="rch-psub">' + esc(m.role) + (m.username ? ' - ' + esc(m.username) : '') + '</span>')); listEl.appendChild(lab);
            });
            if (!listEl.children.length) listEl.appendChild(mk('p', 'rch-hint', 'No members match.'));
          }
          q.oninput = renderMembers; renderMembers();
          var bt = mk('div', 'rch-btns rch-mt');
          var sv = btn('Save Access', 'rc-btn-primary rc-btn-sm'), cn = btn('Cancel', 'rc-btn-secondary rc-btn-sm');
          sv.onclick = function () {
            sv.disabled = true;
            fetchApi('adminSaveHelmetGrants', { method: 'POST', token: token, body: {
              presetId: p.presetId,
              groups: JSON.stringify(GROUPS.filter(Boolean).map(function (g) { return g[0]; }).filter(function (g) { return groupsOn[g]; })),
              profiles: JSON.stringify(Object.keys(profOn).filter(function (k) { return profOn[k]; }))
            } }).then(function (r) {
              if (r && r.success) { toast('Saved who has "' + p.name + '".', 'success'); am.close(); if (after) after(); }
              else { sv.disabled = false; toast((r && r.message) || 'Could not save.', 'error'); }
            }).catch(function () { sv.disabled = false; toast('No answer from the server.', 'error'); });
          };
          cn.onclick = function () { am.close(); };
          bt.appendChild(sv); bt.appendChild(cn); ab.appendChild(bt);
        }).catch(function () { ab.innerHTML = ''; ab.appendChild(mk('p', 'rch-hint', 'No answer from the server.')); });
      }

      /* ---------------- Logo Manager ---------------- */
      function openLogoManager() {
        var lb = mk('div', 'rch-loadbody');
        var lm = ctx.showModal('Logo Manager', { bodyEl: lb, wide: true, accentHead: true });
        var all = [];
        function load() {
          lb.innerHTML = ''; lb.appendChild(spin('Loading...'));
          fetchApi('adminListHelmetLogos', { token: token }).then(function (res) {
            lb.innerHTML = '';
            if (!res || !res.success) { lb.appendChild(mk('p', 'rch-hint', 'Could not load: ' + esc((res && res.message) || 'no answer.'))); return; }
            all = res.logos || [];
            var top = mk('div', 'rch-btns');
            var up = btn('Upload New Logo'); up.onclick = function () { openLogoForm(null, all, function () { load(); reloadLogoAssets(); }); };
            top.appendChild(up); lb.appendChild(top);
            lb.appendChild(mk('p', 'rch-hint', 'Archive hides a logo from the designer but keeps it working on helmets that already use it. A logo that a saved helmet uses cannot be deleted.'));
            if (!all.length) { lb.appendChild(mk('p', 'rch-hint', 'No logos yet. Press Upload New Logo.')); return; }
            var cats = {}, order = [];
            all.forEach(function (l) { var c = l.category || 'Custom logos'; if (!cats[c]) { cats[c] = []; order.push(c); } cats[c].push(l); });
            order.sort(function (x, y) { return x === 'Custom logos' ? -1 : (y === 'Custom logos' ? 1 : x.localeCompare(y)); });
            order.forEach(function (c) {
              lb.appendChild(mk('div', 'rch-label rch-mt', esc(c)));
              cats[c].forEach(function (l) {
                var row = mk('div', 'rch-loadrow' + (l.active ? '' : ' rch-archived'));
                var th = mk('div', 'rch-thumb rch-logothumb'); var im = new Image(); im.__rcSetting = true; im.src = l.data || ('assets/helmets/images/' + l.file); im.alt = ''; th.appendChild(im); row.appendChild(th);
                var info = mk('div', 'rch-info');
                info.appendChild(mk('div', 'rch-pname', esc(l.name) + (l.active ? '' : ' (archived)')));
                info.appendChild(mk('div', 'rch-psub', esc((l.uploaded ? 'Uploaded' : 'File: ' + l.file) + ' - size ' + l.defW + ' x ' + l.defH + ' - tilt ' + l.defR + (l.shadow ? ' - shadow' : '') + (l.used ? ' - used by a saved helmet' : ''))));
                row.appendChild(info);
                var act = mk('div', 'rch-btns');
                function home() {
                  act.innerHTML = '';
                  var ed = btn('Edit'); ed.onclick = function () { openLogoForm(l, all, function () { load(); reloadLogoAssets(); }); }; act.appendChild(ed);
                  if (l.active) {
                    var ar = btn('Archive'); ar.onclick = function () { ask('Archive it?', 'Yes, archive', function (d) { fetchApi('adminSetHelmetLogoActive', { method: 'POST', token: token, body: { logoId: l.id, active: 'Inactive' } }).then(function (r) { d(r && r.success, r && r.message); if (r && r.success) { load(); reloadLogoAssets(); } }).catch(function () { d(false); }); }); }; act.appendChild(ar);
                  } else {
                    var rs3 = btn('Restore', 'rc-btn-primary rc-btn-sm rc-btn-row');
                    rs3.onclick = function () { rs3.disabled = true; fetchApi('adminSetHelmetLogoActive', { method: 'POST', token: token, body: { logoId: l.id, active: 'Active' } }).then(function (r) { if (r && r.success) { load(); reloadLogoAssets(); } else { rs3.disabled = false; toast((r && r.message) || 'Could not restore it.', 'error'); } }).catch(function () { rs3.disabled = false; }); };
                    act.appendChild(rs3);
                  }
                  var dl = btn('Delete');
                  if (l.used) { dl.disabled = true; dl.title = 'A saved helmet uses this logo. Archive it instead.'; }
                  else dl.onclick = function () { ask('Delete it for good?', 'Yes, delete', function (d) { fetchApi('adminDeleteHelmetLogo', { method: 'POST', token: token, body: { logoId: l.id } }).then(function (r) { d(r && r.success, r && r.message); if (r && r.success) { load(); reloadLogoAssets(); } }).catch(function () { d(false); }); }); };
                  act.appendChild(dl);
                }
                function ask(q2, yesLabel, run) {
                  act.innerHTML = ''; act.appendChild(mk('span', 'rch-psub', q2));
                  var yes = btn(yesLabel, 'rc-btn-primary rc-btn-sm rc-btn-row'), no = btn('Keep');
                  yes.onclick = function () { yes.disabled = true; run(function (ok, msg) { if (!ok) { yes.disabled = false; toast(msg || 'That did not work.', 'error'); } }); };
                  no.onclick = home; act.appendChild(yes); act.appendChild(no);
                }
                home(); row.appendChild(act); lb.appendChild(row);
              });
            });
          }).catch(function () { lb.innerHTML = ''; lb.appendChild(mk('p', 'rch-hint', 'No answer from the server.')); });
        }
        load();
      }
      logosBtn.onclick = openLogoManager;
      // Add Logo goes straight to the upload form; when the logo is saved the form closes and the designer is right there again
      addLogoBtn.onclick = function () { openLogoForm(null, H.getConfig().logos || [], function () { reloadLogoAssets(); }); };

      // Shrinks a picked picture to a small WebP (or PNG) text string that fits in one sheet cell.
      function processImage(file) {
        return new Promise(function (resolve, reject) {
          var rd = new FileReader();
          rd.onerror = function () { reject(new Error('Could not read that file.')); };
          rd.onload = function () {
            var im = new Image();
            im.onerror = function () { reject(new Error('That file is not a picture the browser can open.')); };
            im.onload = function () {
              var sizes = [480, 400, 320, 256, 200, 160, 128], quals = [0.92, 0.85, 0.75, 0.65, 0.5];
              for (var si = 0; si < sizes.length; si++) {
                var k = Math.min(1, sizes[si] / Math.max(im.naturalWidth, im.naturalHeight));
                var cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.naturalWidth * k)); cv.height = Math.max(1, Math.round(im.naturalHeight * k));
                cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
                for (var qi = 0; qi < quals.length; qi++) {
                  var out = cv.toDataURL('image/webp', quals[qi]);
                  if (out.indexOf('data:image/webp') !== 0) out = cv.toDataURL('image/png');
                  if (out.length <= 46000) { resolve(out); return; }
                  if (out.indexOf('data:image/png') === 0) break;   // quality does not apply to PNG
                }
              }
              reject(new Error('That picture is too detailed to shrink small enough. Try a simpler or smaller image.'));
            };
            im.src = rd.result;
          };
          rd.readAsDataURL(file);
        });
      }

      // Upload / edit one logo, with every attribute: name, category, default position, size, tilt and shadow.
      function openLogoForm(logo, existing, done) {
        var isNew = !logo;
        var d = logo ? { name: logo.name, category: logo.category || '', defX: logo.defX, defY: logo.defY, defW: logo.defW, defH: logo.defH, defR: logo.defR, shadow: logo.shadow === 0 ? 0 : 1 }
                     : { name: '', category: '', defX: 640, defY: 770, defW: 240, defH: 170, defR: 0, shadow: 1 };
        var data = '';                          // a newly picked picture
        var fb = mk('div', 'rch-logoform');
        var fm = ctx.showModal(isNew ? 'Upload New Logo' : 'Edit Logo', { bodyEl: fb, wide: true, accentHead: true });
        var g = mk('div', 'rch-grid'); var gl = mk('div', 'rch-left'), gr = mk('div', 'rch-right'); g.appendChild(gl); g.appendChild(gr); fb.appendChild(g);
        var prev = mk('div', 'rch-stage light'); gl.appendChild(prev);
        gl.appendChild(mk('p', 'rch-hint', 'The helmet shows where this logo will land when you add it in the designer.'));

        var sec = mk('div', 'rch-section'); gr.appendChild(sec);
        sec.appendChild(mk('div', 'rch-label', isNew ? 'Picture (PNG, WebP or JPEG; transparent PNG works best)' : 'Replace picture (optional)'));
        var fi = mk('input'); fi.type = 'file'; fi.accept = 'image/png,image/webp,image/jpeg'; sec.appendChild(fi);
        var fstat = mk('p', 'rch-hint'); sec.appendChild(fstat);
        sec.appendChild(mk('div', 'rch-label rch-mt', 'Name'));
        var nm = mk('input', 'rch-input'); nm.type = 'text'; nm.maxLength = 60; nm.value = d.name; nm.placeholder = 'e.g. Race Club logo'; nm.oninput = function () { d.name = nm.value; };
        sec.appendChild(nm);
        sec.appendChild(mk('div', 'rch-label rch-mt', 'Category (the group it is listed under in the designer)'));
        var cp = catPicker((existing || []).map(function (l) { return l.category; }), d.category); sec.appendChild(cp.el);

        var sec2 = mk('div', 'rch-section'); gr.appendChild(sec2);
        sec2.appendChild(mk('div', 'rch-label', 'Starting position and size when added to a helmet'));
        var lgrid = makeGrid({ keys: { x: 'defX', y: 'defY', w: 'defW', h: 'defH', r: 'defR' }, obj: function () { return d; },
          layer: function () { return { m: '', v: 'std', f: data ? 'u:__tmp__' : (logo ? logo.file : '') }; }, changed: function () { drawPrev(); } });
        sec2.appendChild(lgrid.el);
        var shl = mk('label', 'rch-check rch-plain'); var shc = mk('input'); shc.type = 'checkbox'; shc.checked = !!d.shadow; shc.onchange = function () { d.shadow = shc.checked ? 1 : 0; drawPrev(); };
        shl.appendChild(shc); shl.appendChild(document.createTextNode(' Soft shadow'));
        var lopts = mk('div', 'rch-btns'); lopts.appendChild(shl);
        makeRotateButtons(function () { return d; }, 'defR', function () { lgrid.sync(); drawPrev(); }).forEach(function (bn) { lopts.appendChild(bn); });
        sec2.appendChild(lopts);

        var bt = mk('div', 'rch-btns');
        var sv = btn('Save Logo', 'rc-btn-primary rc-btn-sm'), cn = btn('Cancel', 'rc-btn-secondary rc-btn-sm');
        bt.appendChild(sv); bt.appendChild(cn); gr.appendChild(bt);

        var TMP = { id: '__tmp__', data: '', active: true };
        var logosCfg = H.getConfig().logos;
        function dropTmp() { var i = logosCfg.indexOf(TMP); if (i >= 0) logosCfg.splice(i, 1); }
        var pbusy = false, pagain = false;
        function drawPrev() {
          var f = data ? 'u:__tmp__' : (logo ? logo.file : '');
          if (!f) { prev.innerHTML = ''; prev.appendChild(mk('p', 'rch-hint', 'Choose a picture to see it on a helmet.')); return; }
          if (data) { TMP.data = data; if (logosCfg.indexOf(TMP) < 0) logosCfg.push(TMP); }
          if (pbusy) { pagain = true; return; }
          pbusy = true;
          var rec = H.normalizeRecipe(H.defaultRecipe());
          rec.logos = [{ m: '', v: 'std', f: f, x: d.defX, y: d.defY, w: d.defW, h: d.defH, r: d.defR, sh: d.shadow }];
          H.render(rec, { width: 420 }).then(function (cv) { prev.innerHTML = ''; cv.style.maxWidth = '100%'; cv.style.height = 'auto'; prev.appendChild(cv); }).catch(function () {}).then(function () { pbusy = false; if (pagain) { pagain = false; drawPrev(); } });
        }
        fm.closeBtn.addEventListener('click', dropTmp);
        cn.onclick = function () { dropTmp(); fm.close(); };
        fi.onchange = function () {
          var f = fi.files && fi.files[0]; if (!f) return;
          fstat.textContent = 'Shrinking the picture...';
          processImage(f).then(function (out) {
            data = out; fstat.textContent = 'Ready (' + Math.round(out.length / 1024) + ' KB after shrinking).';
            if (!d.name) { d.name = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '); nm.value = d.name; }
            drawPrev(); lgrid.loadAspect();
          }).catch(function (e) { data = ''; fstat.textContent = e.message; });
        };
        sv.onclick = function () {
          if (!d.name.trim()) { toast('Give the logo a name.', 'error'); nm.focus(); return; }
          if (isNew && !data) { toast('Choose a picture first.', 'error'); return; }
          var cat = cp.get();
          function setBusy(on) { sv.disabled = on; sv.textContent = on ? 'Saving...' : 'Save Logo'; cn.disabled = on; fm.closeBtn.disabled = on; fm.closeBtn.style.opacity = on ? '0.35' : ''; fm.closeBtn.style.pointerEvents = on ? 'none' : ''; }
          setBusy(true);
          fetchApi('adminSaveHelmetLogo', { method: 'POST', token: token, body: {
            logoId: logo ? logo.id : '', name: d.name.trim(), category: cat, data: data,
            defX: String(d.defX), defY: String(d.defY), defW: String(d.defW), defH: String(d.defH), defR: String(d.defR), shadow: String(d.shadow)
          } }).then(function (r) {
            if (r && r.success) { dropTmp(); toast('Logo saved.', 'success'); fm.close(); if (done) done(); }
            else { setBusy(false); toast((r && r.message) || 'Could not save the logo.', 'error'); }
          }).catch(function () { setBusy(false); toast('No answer from the server.', 'error'); });
        };
        drawPrev(); lgrid.loadAspect();
      }

      refreshPresets();
      syncMeta(); draw();
    }
  }

  window.RCHelmetEditor = { openDesigner: openDesigner };
})();
