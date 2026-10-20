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
  var KINDS = ['Website Default', 'Manufacturer', 'Special Event', 'Label', 'Other'];
  var KIND_HINTS = {
    'Website Default': 'The helmet drivers start with before they design their own. Only one exists: saving replaces the old one.',
    'Manufacturer': 'The team helmet drivers get when they use "Team Helmet". One per manufacturer and class.',
    'Special Event': 'A helmet to give to members for a special event.',
    'Label': 'A helmet a member can earn as a label, such as a nickname or achievement.',
    'Other': 'Any other helmet, for example a season winner design. Give it to members from Manage Helmet Designs.'
  };

  function mk(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  var UNDO_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9"/><polyline points="4 3.5 4 8.5 9 8.5"/></svg>';
  function esc(s) { var d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // Championship first, then a blank row, then the rest (a null entry is the blank row).
  var GROUPS = [['Championship', 'Championship (single player members with a +)'], null, ['Drivers', 'All Members'], ['Organizers', 'Organizers only'], ['Stewards', 'Stewards only'], ['Admins', 'Admins only']];
  function spin(msg) { return window.rcHelmetSpinner_ ? window.rcHelmetSpinner_(msg) : mk('p', 'rch-hint', msg || 'Loading...'); }
  var SLOTS = [['b', 'Base Color'], ['a1', 'Accent Color 1'], ['a2', 'Accent Color 2']];
  var SLIDERS = [['x', 'Left / right', 0, 1254, 1], ['y', 'Up / down', 0, 1254, 1], ['w', 'Max width', 20, 700, 1], ['h', 'Max height', 20, 700, 1], ['r', 'Tilt (deg)', -30, 30, 0.5]];

  function openDesigner(ctx) {
    var fetchApi = ctx.fetchApi, token = ctx.token, toast = ctx.showToast;
    var body = mk('div', 'rch-designer');
    var modal = ctx.showModal('Helmet Designer', { bodyEl: body, wide: true, accentHead: true });
    modal.el.classList.add('rch-modal');
    body.appendChild(window.rcHelmetSpinner_ ? window.rcHelmetSpinner_('Loading the helmet designer...') : mk('p', 'rch-hint', 'Loading the helmet designer...'));

    fetchApi('getHelmetAssets', {}).then(function (res) {
      if (!res || !res.success) { body.innerHTML = ''; body.appendChild(mk('p', 'rch-hint', 'Could not load the helmet designer: ' + esc((res && res.message) || 'no answer from the server.'))); return; }
      H.configure({ designs: res.designs || [], logos: res.logos || [], manufacturers: res.manufacturers || [] });
      return H.pruneDesigns().then(function () { build(res); });
    }).catch(function (err) {
      if (window.console) console.error('Helmet designer:', err);
      body.innerHTML = ''; body.appendChild(mk('p', 'rch-hint', 'No answer from the server. Close this and try again.'));
    });

    function build(assets) {
      body.innerHTML = '';
      var cfg = H.getConfig();
      var R = H.normalizeRecipe(H.defaultRecipe());
      var cur = { id: '', name: '', kind: 'Other', mfr: '', cls: '', category: 'Awards' };
      var knownCats = ['Awards'];
      var sel = null;               // the selected logo object (by reference, so reordering keeps it)
      var dragFrom = -1;

      var grid = mk('div', 'rch-grid');
      var left = mk('div', 'rch-left'), right = mk('div', 'rch-right');
      grid.appendChild(left); grid.appendChild(right); body.appendChild(grid);

      /* ---------------- left: preview ---------------- */
      var undoBar = mk('div', 'rch-prevbar');
      var undoB = mk('button', 'rch-undo', UNDO_SVG); undoB.type = 'button';
      undoB.title = 'Restore the helmet to how it was when it was opened'; undoB.setAttribute('aria-label', undoB.title);
      undoBar.appendChild(undoB); left.appendChild(undoBar);
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
      left.appendChild(mk('p', 'rch-hint', 'With a logo selected, click or drag on the helmet to move it.'));

      /* ---------------- right: save bar ---------------- */
      var bar = mk('div', 'rch-section');
      bar.appendChild(mk('div', 'rch-label', 'Helmet name'));
      var nameIn = mk('input', 'rch-input'); nameIn.type = 'text'; nameIn.maxLength = 60; nameIn.placeholder = 'e.g. Ford Hypercar';
      nameIn.oninput = function () { cur.name = nameIn.value; };
      bar.appendChild(nameIn);
      var kindRow = mk('div', 'rch-row3');
      var kindWrap = mk('div'); kindWrap.appendChild(mk('div', 'rch-label', 'Kind'));
      var kindSel = mk('select', 'rch-select-wide'); KINDS.forEach(function (k) { var o = mk('option'); o.value = k; o.textContent = k; kindSel.appendChild(o); });
      kindWrap.appendChild(kindSel);
      var mfrWrap = mk('div'); mfrWrap.appendChild(mk('div', 'rch-label', 'Manufacturer'));
      var mfrSel = mk('select', 'rch-select-wide'); mfrSel.appendChild(mk('option', '', '')); mfrSel.firstChild.value = ''; mfrSel.firstChild.textContent = 'Choose...';
      (assets.manufacturers || []).forEach(function (m) { var o = mk('option'); o.value = m; o.textContent = m; mfrSel.appendChild(o); });
      mfrWrap.appendChild(mfrSel);
      var clsWrap = mk('div'); clsWrap.appendChild(mk('div', 'rch-label', 'Class'));
      var clsSel = mk('select', 'rch-select-wide'); clsSel.appendChild(mk('option')); clsSel.firstChild.value = ''; clsSel.firstChild.textContent = 'Choose...';
      (assets.classes || []).forEach(function (c) { var o = mk('option'); o.value = c; o.textContent = c; clsSel.appendChild(o); });
      clsWrap.appendChild(clsSel);
      kindRow.appendChild(kindWrap); kindRow.appendChild(mfrWrap); kindRow.appendChild(clsWrap);
      bar.appendChild(kindRow);
      var kindHint = mk('p', 'rch-hint'); bar.appendChild(kindHint);
      // category: where members find an award helmet in their design list (pick one or make a new one)
      var catRow = mk('div', 'rch-catrow');
      catRow.appendChild(mk('div', 'rch-label', 'Category (the group this helmet is listed under for members)'));
      var catSel = mk('select', 'rch-select-wide');
      var catNew = mk('input', 'rch-input'); catNew.type = 'text'; catNew.maxLength = 40; catNew.placeholder = 'New category name, e.g. Season Champions'; catNew.style.display = 'none'; catNew.style.marginTop = '6px';
      catRow.appendChild(catSel); catRow.appendChild(catNew);
      bar.appendChild(catRow);
      function fillCats(chosen) {
        var list = knownCats.slice(); if (chosen && list.indexOf(chosen) < 0) list.push(chosen);
        list.sort(function (a, b) { return a === 'Awards' ? -1 : (b === 'Awards' ? 1 : a.localeCompare(b)); });
        catSel.innerHTML = '';
        list.forEach(function (c) { var o = mk('option'); o.value = c; o.textContent = c; catSel.appendChild(o); });
        var on = mk('option'); on.value = '__new__'; on.textContent = '+ New category...'; catSel.appendChild(on);
        catSel.value = chosen || 'Awards'; catNew.style.display = 'none';
      }
      catSel.onchange = function () {
        if (catSel.value === '__new__') { catNew.style.display = ''; catNew.focus(); cur.category = catNew.value.trim(); }
        else { catNew.style.display = 'none'; cur.category = catSel.value; }
      };
      catNew.oninput = function () { cur.category = catNew.value.trim(); };
      kindSel.onchange = function () { cur.kind = kindSel.value; syncMeta(); };
      mfrSel.onchange = function () { cur.mfr = mfrSel.value; };
      clsSel.onchange = function () { cur.cls = clsSel.value; };
      var status = mk('p', 'rch-status'); bar.appendChild(status);
      var btns = mk('div', 'rch-btns');
      var saveBtn = mk('button', 'rc-btn-primary rc-btn-sm', 'Save'); saveBtn.type = 'button';
      var manageBtn = mk('button', 'rc-btn-secondary rc-btn-sm', 'Manage Designs'); manageBtn.type = 'button';
      btns.appendChild(saveBtn); btns.appendChild(manageBtn);
      bar.appendChild(btns);
      var logosBtn = mk('button', 'rc-btn-secondary rc-btn-sm', 'Logo Manager'); logosBtn.type = 'button';
      right.appendChild(bar);

      /* ---------------- right: style ---------------- */
      var style = mk('div', 'rch-section');
      var dRow = mk('div', 'rch-dstack');
      var dWrap = mk('div'); dWrap.appendChild(mk('div', 'rch-label', 'Design'));
      var dSel = mk('select', 'rch-select-wide');
      cfg.designs.forEach(function (d) { var o = mk('option'); o.value = d.slot; o.textContent = String(d.slot).padStart(2, '0') + '  ' + d.name; dSel.appendChild(o); });
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
      var lmRow = mk('div', 'rch-btns rch-lmrow'); lmRow.appendChild(logosBtn); lg.appendChild(lmRow);
      var layers = mk('div', 'rch-layers'); lg.appendChild(layers);
      var addRow = mk('div', 'rch-btns rch-addrow');
      var lpick = mk('select', 'rch-select-wide');
      function buildPicker() {
        var keep = lpick.value;
        lpick.innerHTML = '';
        var gS = mk('optgroup'); gS.label = 'Basic shapes';
        H.SHAPES.forEach(function (sh) { var o = mk('option'); o.value = 's:' + sh.id; o.textContent = sh.name; gS.appendChild(o); });
        lpick.appendChild(gS);
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
        var kind = lpick.value.charAt(0), isM = kind === 'm', val = lpick.value.substr(2);
        var def = (kind === 'f') ? (H.getConfig().logos.filter(function (l) { return l.file === val; })[0] || {}) : {};
        var n = kind === 's'
          ? { s: val, c: 'red', m: '', v: 'std', f: '', x: 640, y: 770, w: 220, h: (val === 'stripe' || val === 'pill' || val === 'checker') ? 80 : 220, r: 0, sh: 0 }
          : { m: isM ? val : '', v: 'std', f: isM ? '' : val, x: def.defX != null ? def.defX : 640, y: def.defY != null ? def.defY : 770, w: def.defW != null ? def.defW : 240, h: def.defH != null ? def.defH : 170, r: def.defR != null ? def.defR : 3, sh: def.shadow === 0 ? 0 : 1 };
        R.logos.push(n); sel = n; draw();
      };
      addRow.appendChild(lpick); addRow.appendChild(addB);
      lg.appendChild(addRow);
      var detail = mk('div', 'rch-detail'); lg.appendChild(detail);
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
        return l.m ? (l.m + (l.v === 'std' ? '' : ' (' + l.v + ')')) : (l.f || 'logo');
      }

      function renderLayers(missing) {
        layers.innerHTML = '';
        if (!R.logos.length) layers.appendChild(mk('p', 'rch-hint', 'No logos or shapes yet. Pick one below and press Add layer.'));
        var order = []; for (var i = R.logos.length - 1; i >= 0; i--) order.push(i);   // top of list = front
        order.forEach(function (idx, pos) {
          var l = R.logos[idx];
          var row = mk('div', 'rch-layer' + (l === sel ? ' sel' : '')); row.draggable = true; row.dataset.pos = pos;
          row.appendChild(mk('span', 'rch-grip', '&#8942;&#8942;'));
          var nm = mk('span', 'rch-layer-name'); nm.textContent = logoName(l);
          if (missing && missing[idx]) { var miss = mk('span', 'rch-miss', 'FILE NOT FOUND'); nm.appendChild(miss); }
          row.appendChild(nm);
          var up = mk('button', 'rch-icon', '&#9650;'); up.type = 'button'; up.title = 'Bring forward';
          var dn = mk('button', 'rch-icon', '&#9660;'); dn.type = 'button'; dn.title = 'Send back';
          var rm = mk('button', 'rch-icon', '&times;'); rm.type = 'button'; rm.title = 'Remove layer';
          up.onclick = function (e) { e.stopPropagation(); if (idx < R.logos.length - 1) { var t = R.logos[idx]; R.logos[idx] = R.logos[idx + 1]; R.logos[idx + 1] = t; draw(); } };
          dn.onclick = function (e) { e.stopPropagation(); if (idx > 0) { var t = R.logos[idx]; R.logos[idx] = R.logos[idx - 1]; R.logos[idx - 1] = t; draw(); } };
          rm.onclick = function (e) { e.stopPropagation(); R.logos.splice(idx, 1); if (sel === l) sel = null; draw(); };
          row.appendChild(up); row.appendChild(dn); row.appendChild(rm);
          row.onclick = function () { sel = l; renderLayers(missing); renderDetail(); };
          row.addEventListener('dragstart', function (e) { dragFrom = pos; row.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', String(pos)); e.dataTransfer.effectAllowed = 'move'; } catch (x) {} });
          row.addEventListener('dragend', function () { row.classList.remove('dragging'); layers.querySelectorAll('.over').forEach(function (n) { n.classList.remove('over'); }); });
          row.addEventListener('dragover', function (e) { e.preventDefault(); row.classList.add('over'); });
          row.addEventListener('dragleave', function () { row.classList.remove('over'); });
          row.addEventListener('drop', function (e) {
            e.preventDefault(); row.classList.remove('over');
            if (dragFrom < 0 || dragFrom === pos) return;
            var disp = order.map(function (k) { return R.logos[k]; });      // front-to-back
            var moved = disp.splice(dragFrom, 1)[0];
            disp.splice(pos, 0, moved);
            R.logos = disp.slice().reverse();                                  // back to array order (last = front)
            dragFrom = -1; draw();
          });
          layers.appendChild(row);
        });
      }

      function renderDetail() {
        detail.innerHTML = '';
        if (!sel || R.logos.indexOf(sel) < 0) return;
        var g = mk('div', 'rch-sliders');
        SLIDERS.forEach(function (s) {
          g.appendChild(mk('span', '', s[1]));
          var inp = mk('input'); inp.type = 'range'; inp.min = s[2]; inp.max = s[3]; inp.step = s[4]; inp.value = sel[s[0]];
          var v = mk('span', 'rch-sv'); v.textContent = inp.value;
          inp.oninput = function () { sel[s[0]] = parseFloat(inp.value); v.textContent = inp.value; draw(true); };
          g.appendChild(inp); g.appendChild(v);
        });
        detail.appendChild(g);
        var opts = mk('div', 'rch-btns');
        var shl = mk('label', 'rch-check'); var shc = mk('input'); shc.type = 'checkbox'; shc.checked = !!sel.sh;
        shc.onchange = function () { sel.sh = shc.checked ? 1 : 0; draw(true); };
        shl.appendChild(shc); shl.appendChild(document.createTextNode(' Soft shadow')); opts.appendChild(shl);
        if (sel.s) {
          var cw = mk('div', 'rch-shapecolor');
          cw.appendChild(mk('div', 'rch-label', 'Shape color'));
          var sw2 = mk('div', 'rch-swatches');
          var isHexC = String(sel.c).charAt(0) === '#';
          H.PALETTE.forEach(function (p) {
            var b = mk('button', 'rch-sw' + (!isHexC && sel.c === p.id ? ' sel' : '')); b.type = 'button'; b.style.background = p.hex; b.title = p.name;
            b.onclick = function () { sel.c = p.id; draw(); };
            sw2.appendChild(b);
          });
          var cpw2 = mk('label', 'rch-sw-custom' + (isHexC ? ' sel' : '')); cpw2.title = 'Exact color';
          if (isHexC) cpw2.style.background = sel.c;
          var cp2 = mk('input'); cp2.type = 'color'; cp2.value = H.hexOf(sel.c);
          cp2.oninput = function () { sel.c = cp2.value; draw(true); };
          cp2.onchange = function () { draw(); };
          cpw2.appendChild(cp2); sw2.appendChild(cpw2);
          cw.appendChild(sw2);
          detail.appendChild(cw);
          if (sel.s === 'checker') cw.appendChild(mk('p', 'rch-hint', 'The checkered strip uses this color and white.'));
        }
        detail.appendChild(opts);
      }

      function syncMeta() {
        kindSel.value = cur.kind; mfrSel.value = cur.mfr || ''; clsSel.value = cur.cls || '';
        mfrWrap.style.visibility = clsWrap.style.visibility = (cur.kind === 'Manufacturer') ? 'visible' : 'hidden';
        kindHint.textContent = KIND_HINTS[cur.kind] || '';
        var givable = (cur.kind !== 'Website Default' && cur.kind !== 'Manufacturer');
        catRow.style.display = givable ? '' : 'none';
        if (givable && cur.category !== undefined && catSel.value !== '__new__') fillCats(cur.category || 'Awards');
        if (document.activeElement !== nameIn) nameIn.value = cur.name;
        status.innerHTML = cur.id ? '' : 'This helmet has not been saved yet.';
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
        undoB.disabled = snapshot() === baseline;
        if (!quick) { renderLayers(); renderDetail(); }
        if (busy) { again = true; lastQuick = !!quick; return; }
        busy = true;
        // A small size is drawn at twice its size and shown at its size, the way the avatars around the site are.
        var rw = prevSize ? prevSize * 2 : (quick ? 560 : 760);
        var jobs = [H.render(R, { width: rw }).then(function (cv) { if (prevSize) { cv.style.width = prevSize + 'px'; cv.style.height = 'auto'; } put(stage, cv); if (!quick) renderLayers(cv.missingLogos); })];
        Promise.all(jobs).then(function () {}).catch(function (e) { toast('Render problem: ' + e.message, 'error'); }).then(function () { busy = false; if (again) { again = false; draw(lastQuick); } });
      }

      // click / drag on the preview moves the selected logo
      var dragging = false;
      function moveTo(ev) {
        if (!sel) return; var cv = stage.querySelector('canvas'); if (!cv) return;
        var rc = cv.getBoundingClientRect(), C = H.CROP;
        sel.x = Math.round(C.x + (ev.clientX - rc.left) / rc.width * C.w); sel.y = Math.round(C.y + (ev.clientY - rc.top) / rc.height * C.h);
        var xs = detail.querySelectorAll('input[type=range]'); if (xs.length >= 2) { xs[0].value = sel.x; xs[1].value = sel.y; var sv = detail.querySelectorAll('.rch-sv'); sv[0].textContent = sel.x; sv[1].textContent = sel.y; }
        draw(true);
      }
      stage.addEventListener('pointerdown', function (e) { dragging = true; moveTo(e); });
      var onMove = function (e) { if (dragging) moveTo(e); }, onUp = function () { dragging = false; };
      window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
      modal.closeBtn.addEventListener('click', function () { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); });

      /* ---------------- save / load ---------------- */
      function doSave() {
        var name = (cur.name || '').trim();
        if (!name) { toast('Give the helmet a name first.', 'error'); nameIn.focus(); return; }
        if (cur.kind === 'Manufacturer' && (!cur.mfr || !cur.cls)) { toast('Choose a manufacturer and a class for a Manufacturer helmet.', 'error'); return; }
        var givable = (cur.kind !== 'Website Default' && cur.kind !== 'Manufacturer');
        var category = givable ? (catSel.value === '__new__' ? catNew.value.trim() : (catSel.value || 'Awards')) : '';
        if (givable && !category) { toast('Type a name for the new category, or pick an existing one.', 'error'); catNew.focus(); return; }
        saveBtn.disabled = true;
        fetchApi('adminSaveHelmetPreset', {
          method: 'POST', token: token,
          body: { presetId: cur.id, name: name, kind: cur.kind, manufacturer: cur.kind === 'Manufacturer' ? cur.mfr : '', carClass: cur.kind === 'Manufacturer' ? cur.cls : '', category: category, recipe: JSON.stringify(R) }
        }).then(function (res) {
          saveBtn.disabled = false;
          if (!res || !res.success) { toast((res && res.message) || 'Could not save the helmet.', 'error'); return; }
          cur.id = res.presetId; cur.name = name; cur.category = category;
          if (category && knownCats.indexOf(category) < 0) knownCats.push(category);
          fillCats(category || 'Awards'); syncMeta(); baseline = snapshot(); undoB.disabled = true;
          toast(res.replaced ? ('Saved. It replaced the older helmet "' + res.replaced + '".') : 'Helmet saved.', 'success');
        }).catch(function () { saveBtn.disabled = false; toast('No answer from the server. Try again.', 'error'); });
      }
      saveBtn.onclick = function () { doSave(); };
      // Restore arrow: puts the helmet back to how it was when it was opened (a blank helmet in a new
      // designer, or the saved design as it was loaded).
      var baseline = '';
      function snapshot() { return JSON.stringify({ R: R, cur: { id: cur.id, name: cur.name, kind: cur.kind, mfr: cur.mfr, cls: cur.cls, category: cur.category } }); }
      var baseState = null;
      function setBase() { baseState = JSON.parse(snapshot()); baseline = snapshot(); }
      undoB.onclick = function () {
        R = H.normalizeRecipe(clone(baseState.R)); cur = clone(baseState.cur); sel = null;
        nameIn.value = cur.name; fillCats(cur.category || 'Awards'); syncMeta(); draw();
      };

      function loadPreset(p) {
        R = H.normalizeRecipe(p.recipe); sel = null;
        cur = { id: p.presetId, name: p.name, kind: p.kind, mfr: p.manufacturer || '', cls: p.carClass || '', category: p.category || 'Awards' };
        if (cur.category && knownCats.indexOf(cur.category) < 0) knownCats.push(cur.category);
        fillCats(cur.category);
        syncMeta(); draw(); setBase(); undoB.disabled = true; toast('Loaded "' + p.name + '".', 'success');
      }
      /* ---------------- shared bits for the manager popups ---------------- */
      function btn(label, cls) { var b = mk('button', cls || 'rc-btn-secondary rc-btn-row', label); b.type = 'button'; return b; }
      function renderThumb(host, recipe, w) { H.render(recipe, { width: w || 140 }).then(function (cv) { host.appendChild(cv); }).catch(function () {}); }
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
            list.forEach(function (p) { if (p.category && knownCats.indexOf(p.category) < 0) knownCats.push(p.category); });
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
                if (p.kind === 'Manufacturer') bits.push([p.manufacturer, p.carClass].filter(Boolean).join(' / '));
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
        var sl = mk('div', 'rch-sliders');
        var map = [['defX', 'Left / right', 0, 1254, 1], ['defY', 'Up / down', 0, 1254, 1], ['defW', 'Max width', 20, 700, 1], ['defH', 'Max height', 20, 700, 1], ['defR', 'Tilt (deg)', -30, 30, 0.5]];
        map.forEach(function (s2) {
          sl.appendChild(mk('span', '', s2[1]));
          var inp = mk('input'); inp.type = 'range'; inp.min = s2[2]; inp.max = s2[3]; inp.step = s2[4]; inp.value = d[s2[0]];
          var v = mk('span', 'rch-sv'); v.textContent = inp.value;
          inp.oninput = function () { d[s2[0]] = parseFloat(inp.value); v.textContent = inp.value; drawPrev(); };
          sl.appendChild(inp); sl.appendChild(v);
        });
        sec2.appendChild(sl);
        var shl = mk('label', 'rch-check'); var shc = mk('input'); shc.type = 'checkbox'; shc.checked = !!d.shadow; shc.onchange = function () { d.shadow = shc.checked ? 1 : 0; drawPrev(); };
        shl.appendChild(shc); shl.appendChild(document.createTextNode(' Soft shadow')); sec2.appendChild(shl);

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
            drawPrev();
          }).catch(function (e) { data = ''; fstat.textContent = e.message; });
        };
        sv.onclick = function () {
          if (!d.name.trim()) { toast('Give the logo a name.', 'error'); nm.focus(); return; }
          if (isNew && !data) { toast('Choose a picture first.', 'error'); return; }
          var cat = cp.get();
          sv.disabled = true;
          fetchApi('adminSaveHelmetLogo', { method: 'POST', token: token, body: {
            logoId: logo ? logo.id : '', name: d.name.trim(), category: cat, data: data,
            defX: String(d.defX), defY: String(d.defY), defW: String(d.defW), defH: String(d.defH), defR: String(d.defR), shadow: String(d.shadow)
          } }).then(function (r) {
            if (r && r.success) { dropTmp(); toast('Logo saved.', 'success'); fm.close(); if (done) done(); }
            else { sv.disabled = false; toast((r && r.message) || 'Could not save the logo.', 'error'); }
          }).catch(function () { sv.disabled = false; toast('No answer from the server.', 'error'); });
        };
        drawPrev();
      }

      // categories already used by saved helmets (so the Category list is full from the start)
      fetchApi('adminListHelmetPresets', { token: token, params: { includeArchived: '1' } }).then(function (res) {
        if (res && res.success) { (res.presets || []).forEach(function (p) { if (p.category && knownCats.indexOf(p.category) < 0) knownCats.push(p.category); }); fillCats(cur.category || 'Awards'); }
      }).catch(function () {});

      fillCats('Awards');
      syncMeta(); setBase(); draw();
    }
  }

  window.RCHelmetEditor = { openDesigner: openDesigner };
})();
