/* =====================================================================
   Race Club helmet editor pieces  (js/helmet-editor.js)
   ---------------------------------------------------------------------
   RCHelmetEditor.openDesigner(ctx)  -- the large admin "Helmet Designer" popup
     ctx = { token, fetchApi, showModal, showToast }   (all supplied by Account.html)
   Needs js/helmet.js and css/helmet.css.
   ===================================================================== */
(function () {
  'use strict';
  var H = window.RCHelmet;
  var KINDS = ['Website Default', 'Manufacturer', 'Special Event', 'Label', 'Other'];
  var KIND_HINTS = {
    'Website Default': 'The helmet drivers start with before they design their own. Only one exists: saving replaces the old one.',
    'Manufacturer': 'The team helmet drivers get when they use "Team Helmet". One per manufacturer and class: saving replaces the old one.',
    'Special Event': 'A helmet to give to drivers who take part in a special event.',
    'Label': 'A helmet a driver can earn as a label, such as a nickname or achievement.',
    'Other': 'Any other helmet you want to keep for later.'
  };

  function mk(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var SLOTS = [['b', 'Base Color'], ['a1', 'Accent Color 1'], ['a2', 'Accent Color 2']];
  var SLIDERS = [['x', 'Left / right', 0, 1254, 1], ['y', 'Up / down', 0, 1254, 1], ['w', 'Max width', 20, 700, 1], ['h', 'Max height', 20, 700, 1], ['r', 'Tilt (deg)', -30, 30, 0.5]];

  function openDesigner(ctx) {
    var fetchApi = ctx.fetchApi, token = ctx.token, toast = ctx.showToast;
    var body = mk('div', 'rch-designer');
    var modal = ctx.showModal('Helmet Designer', { bodyEl: body, wide: true, accentHead: true });
    modal.el.classList.add('rch-modal');
    body.appendChild(mk('p', 'rch-hint', 'Loading the helmet designer...'));

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
      var cur = { id: '', name: '', kind: 'Other', mfr: '', cls: '' };
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
        x.onclick = function () { stage.className = 'rch-stage ' + b; sizes.className = 'rch-sizes ' + b; };
        bgRow.appendChild(x);
      });
      left.appendChild(bgRow);
      var sizes = mk('div', 'rch-sizes light'); left.appendChild(sizes);
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
      kindSel.onchange = function () { cur.kind = kindSel.value; syncMeta(); };
      mfrSel.onchange = function () { cur.mfr = mfrSel.value; };
      clsSel.onchange = function () { cur.cls = clsSel.value; };
      var status = mk('p', 'rch-status'); bar.appendChild(status);
      var btns = mk('div', 'rch-btns');
      var saveBtn = mk('button', 'rc-btn-primary rc-btn-sm', 'Save'); saveBtn.type = 'button';
      var saveNewBtn = mk('button', 'rc-btn-secondary rc-btn-sm', 'Save as New'); saveNewBtn.type = 'button';
      var loadBtn = mk('button', 'rc-btn-secondary rc-btn-sm', 'Load...'); loadBtn.type = 'button';
      var newBtn = mk('button', 'rc-btn-secondary rc-btn-sm', 'Start New'); newBtn.type = 'button';
      btns.appendChild(saveBtn); btns.appendChild(saveNewBtn); btns.appendChild(loadBtn); btns.appendChild(newBtn);
      bar.appendChild(btns);
      right.appendChild(bar);

      /* ---------------- right: style ---------------- */
      var style = mk('div', 'rch-section');
      var dRow = mk('div', 'rch-row2');
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
      lg.appendChild(mk('p', 'rch-hint', 'The top of the list sits in front. Drag a row up or down, or use the arrows, to change which layer is on top.'));
      var layers = mk('div', 'rch-layers'); lg.appendChild(layers);
      var addRow = mk('div', 'rch-btns rch-addrow');
      var lpick = mk('select', 'rch-select-wide');
      var gS = mk('optgroup'); gS.label = 'Basic shapes';
      H.SHAPES.forEach(function (sh) { var o = mk('option'); o.value = 's:' + sh.id; o.textContent = sh.name; gS.appendChild(o); });
      lpick.appendChild(gS);
      // custom logos, grouped by the Category column of the HelmetAssets tab (blank = "Custom logos")
      var cats = {}, catOrder = [];
      cfg.logos.forEach(function (l) {
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
      cfg.manufacturers.forEach(function (n) { var o = mk('option'); o.value = 'm:' + n; o.textContent = n; gM.appendChild(o); });
      lpick.appendChild(gM);
      var lvar = mk('select', 'rch-select-wide');
      [['std', 'Standard logo'], ['black', 'Black version'], ['white', 'White version']].forEach(function (v) { var o = mk('option'); o.value = v[0]; o.textContent = v[1]; lvar.appendChild(o); });
      var addB = mk('button', 'rc-btn-secondary rc-btn-sm', 'Add layer'); addB.type = 'button';
      addB.onclick = function () {
        var kind = lpick.value.charAt(0), isM = kind === 'm', val = lpick.value.substr(2);
        var n = kind === 's'
          ? { s: val, c: 'red', m: '', v: 'std', f: '', x: 640, y: 770, w: 220, h: (val === 'stripe' || val === 'pill' || val === 'checker') ? 80 : 220, r: 0, sh: 0 }
          : { m: isM ? val : '', v: isM ? lvar.value : 'std', f: isM ? '' : val, x: 640, y: 770, w: 240, h: 170, r: 3, sh: 1 };
        R.logos.push(n); sel = n; draw();
      };
      addRow.appendChild(lpick); addRow.appendChild(lvar); addRow.appendChild(addB);
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
        if (sel.m) {
          var vsel = mk('select', 'rch-select-wide'); [['std', 'Standard logo'], ['black', 'Black version'], ['white', 'White version']].forEach(function (v) { var o = mk('option'); o.value = v[0]; o.textContent = v[1]; vsel.appendChild(o); });
          vsel.value = sel.v || 'std'; vsel.onchange = function () { sel.v = vsel.value; draw(); }; opts.appendChild(vsel);
        }
        detail.appendChild(opts);
      }

      function syncMeta() {
        kindSel.value = cur.kind; mfrSel.value = cur.mfr || ''; clsSel.value = cur.cls || '';
        mfrWrap.style.visibility = clsWrap.style.visibility = (cur.kind === 'Manufacturer') ? 'visible' : 'hidden';
        kindHint.textContent = KIND_HINTS[cur.kind] || '';
        if (document.activeElement !== nameIn) nameIn.value = cur.name;
        status.innerHTML = cur.id ? ('Editing the saved helmet <strong>' + esc(cur.name) + '</strong>. Save updates it, Save as New makes a copy.') : 'This helmet has not been saved yet.';
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
        var jobs = [H.render(R, { width: quick ? 560 : 760 }).then(function (cv) { put(stage, cv); if (!quick) renderLayers(cv.missingLogos); })];
        var sz = [[40, '40'], [72, '72'], [144, '144']];
        if (!quick) sz.forEach(function (s) { jobs.push(H.render(R, { width: s[0] * 2 })); });
        Promise.all(jobs).then(function (res) {
          if (!quick) {
            sizes.innerHTML = '';
            sz.forEach(function (s, i) {
              var c = res[1 + i]; c.style.width = s[0] + 'px'; c.style.height = 'auto';
              var w = mk('div'); w.appendChild(c); w.appendChild(mk('div', 'rch-lbl', s[1] + ' px')); sizes.appendChild(w);
            });
          }
        }).catch(function (e) { toast('Render problem: ' + e.message, 'error'); }).then(function () { busy = false; if (again) { again = false; draw(lastQuick); } });
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
      function doSave(asNew) {
        var name = (cur.name || '').trim();
        if (!name) { toast('Give the helmet a name first.', 'error'); nameIn.focus(); return; }
        if (cur.kind === 'Manufacturer' && (!cur.mfr || !cur.cls)) { toast('Choose a manufacturer and a class for a Manufacturer helmet.', 'error'); return; }
        saveBtn.disabled = saveNewBtn.disabled = true;
        fetchApi('adminSaveHelmetPreset', {
          method: 'POST', token: token,
          body: { presetId: asNew ? '' : cur.id, name: name, kind: cur.kind, manufacturer: cur.kind === 'Manufacturer' ? cur.mfr : '', carClass: cur.kind === 'Manufacturer' ? cur.cls : '', recipe: JSON.stringify(R) }
        }).then(function (res) {
          saveBtn.disabled = saveNewBtn.disabled = false;
          if (!res || !res.success) { toast((res && res.message) || 'Could not save the helmet.', 'error'); return; }
          cur.id = res.presetId; cur.name = name; syncMeta();
          toast(res.replaced ? ('Saved. It replaced the older helmet "' + res.replaced + '".') : 'Helmet saved.', 'success');
        }).catch(function () { saveBtn.disabled = saveNewBtn.disabled = false; toast('No answer from the server. Try again.', 'error'); });
      }
      saveBtn.onclick = function () { doSave(false); };
      saveNewBtn.onclick = function () { doSave(true); };
      newBtn.onclick = function () { cur = { id: '', name: '', kind: 'Other', mfr: '', cls: '' }; R = H.normalizeRecipe(H.defaultRecipe()); sel = null; syncMeta(); draw(); };

      loadBtn.onclick = function () {
        var lb = mk('div', 'rch-loadbody');
        lb.appendChild(mk('p', 'rch-hint', 'Loading saved helmets...'));
        var lm = ctx.showModal('Load Helmet', { bodyEl: lb, accentHead: true });
        fetchApi('adminListHelmetPresets', { token: token }).then(function (res) {
          lb.innerHTML = '';
          if (!res || !res.success) { lb.appendChild(mk('p', 'rch-hint', 'Could not load: ' + esc((res && res.message) || 'no answer.'))); return; }
          var list = res.presets || [];
          if (!list.length) { lb.appendChild(mk('p', 'rch-hint', 'Nothing saved yet. Design a helmet and press Save.')); return; }
          KINDS.forEach(function (k) {
            var rows = list.filter(function (p) { return p.kind === k; });
            if (!rows.length) return;
            lb.appendChild(mk('div', 'rch-label rch-mt', esc(k)));
            rows.forEach(function (p) {
              var row = mk('div', 'rch-loadrow');
              var th = mk('div', 'rch-thumb'); row.appendChild(th);
              H.render(p.recipe, { width: 140 }).then(function (cv) { th.appendChild(cv); }).catch(function () {});
              var info = mk('div', 'rch-info');
              info.appendChild(mk('div', 'rch-pname', esc(p.name)));
              var sub = [p.manufacturer, p.carClass].filter(Boolean).join(' / ');
              info.appendChild(mk('div', 'rch-psub', esc((sub ? sub + ' - ' : '') + (p.updatedAt ? 'saved ' + String(p.updatedAt).slice(0, 10) : ''))));
              row.appendChild(info);
              var act = mk('div', 'rch-btns');
              var lo = mk('button', 'rc-btn-secondary rc-btn-row', 'Load'); lo.type = 'button';
              lo.onclick = function () {
                R = H.normalizeRecipe(p.recipe); sel = null;
                cur = { id: p.presetId, name: p.name, kind: p.kind, mfr: p.manufacturer || '', cls: p.carClass || '' };
                syncMeta(); draw(); lm.close(); toast('Loaded "' + p.name + '".', 'success');
              };
              var rm = mk('button', 'rc-btn-secondary rc-btn-row', 'Remove'); rm.type = 'button';
              rm.onclick = function () {
                act.innerHTML = '';
                act.appendChild(mk('span', 'rch-psub', 'Remove it?'));
                var yes = mk('button', 'rc-btn-primary rc-btn-sm rc-btn-row', 'Yes, remove'); yes.type = 'button';
                var no = mk('button', 'rc-btn-secondary rc-btn-row', 'Keep'); no.type = 'button';
                yes.onclick = function () {
                  yes.disabled = true;
                  fetchApi('adminSetHelmetPresetActive', { method: 'POST', token: token, body: { presetId: p.presetId, active: 'Inactive' } }).then(function (r2) {
                    if (r2 && r2.success) { row.remove(); toast('Removed. It is hidden, not deleted, so it can be restored in the sheet.', 'success'); if (cur.id === p.presetId) { cur.id = ''; syncMeta(); } }
                    else { yes.disabled = false; toast((r2 && r2.message) || 'Could not remove it.', 'error'); }
                  }).catch(function () { yes.disabled = false; toast('No answer from the server.', 'error'); });
                };
                no.onclick = function () { act.innerHTML = ''; act.appendChild(lo); act.appendChild(rm); };
                act.appendChild(yes); act.appendChild(no);
              };
              act.appendChild(lo); act.appendChild(rm); row.appendChild(act);
              lb.appendChild(row);
            });
          });
        }).catch(function () { lb.innerHTML = ''; lb.appendChild(mk('p', 'rch-hint', 'No answer from the server.')); });
      };

      syncMeta(); draw();
    }
  }

  window.RCHelmetEditor = { openDesigner: openDesigner };
})();
