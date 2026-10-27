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
    'Special Event': 'A helmet to give to members for a special event.',
    'Premium': 'A premium helmet to give to members.',
    'Awards': 'An award helmet, for example a season winner design.'
  };

  function mk(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function spin(msg) { return window.rcHelmetSpinner_ ? window.rcHelmetSpinner_(msg) : mk('p', 'rch-hint', msg || 'Loading...'); }
  var SLOTS = [['b', 'Base Color'], ['a1', 'Accent Color 1'], ['a2', 'Accent Color 2']];
  // Slider directions (Matt): Left / right slides right = right. Up / down slides right = UP (the stored y counts down, so the slider shows 1254 - y).
  // Tilt: sliding right turns the layer clockwise. r (the stored angle) counts counter-clockwise, so the slider shows the opposite sign,
  // and only the part of r left over after whole 90 degree turns (the rotate buttons make those).
  var ROT_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 3.5 3 8.5 8 8.5"/></svg>';
  var LINK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  function turnBase(r) { return Math.round((Number(r) || 0) / 90) * 90; }
  function wrapAngle(r) { r = ((r % 360) + 360) % 360; return r > 180 ? r - 360 : r; }


  // The Category box for Special Event, Premium and Awards helmets: pick one already used or type a new one (Season 1, Limited Edition...).
  // onChange(value) runs when the choice changes; fill(list, chosen) rebuilds the choices.
  var COLL_KINDS = ['Special Event', 'Premium', 'Awards'];
  // Prestige tier (admin classification only; members never see it). Shown next to Category, same kinds only.
  var TIERS = ['Legendary', 'Rare', 'Uncommon', 'Common'];
  function makeTierSel() {
    var t = mk('select', 'rch-select-wide');
    TIERS.forEach(function (x) { var o = mk('option'); o.value = x; o.textContent = x; t.appendChild(o); });
    t.value = 'Common';
    return t;
  }
  function makeCollPicker(onChange) {
    var wrap = mk('div'), sel2 = mk('select', 'rch-select-wide'), nw = mk('input', 'rch-input');
    nw.type = 'text'; nw.maxLength = 40; nw.placeholder = 'New category name, e.g. Season 1'; nw.style.display = 'none'; nw.style.marginTop = '6px';
    wrap.appendChild(sel2); wrap.appendChild(nw);
    var api = { el: wrap, get: function () { return sel2.value === '__new__' ? nw.value.trim() : sel2.value; } };
    api.fill = function (list, chosen) {
      chosen = chosen || '';
      if (sel2.value === '__new__' && nw.value.trim() === chosen) return;       // typing a brand new name: leave it alone
      var items = list.filter(function (c, i, a) { return c && a.indexOf(c) === i; }).sort(function (x, y) { return x.localeCompare(y); });
      if (chosen && items.indexOf(chosen) < 0) items.push(chosen);
      sel2.innerHTML = '';
      var none = mk('option'); none.value = ''; none.textContent = 'No category'; sel2.appendChild(none);
      items.forEach(function (c) { var o = mk('option'); o.value = c; o.textContent = c; sel2.appendChild(o); });
      var on = mk('option'); on.value = '__new__'; on.textContent = '+ New category...'; sel2.appendChild(on);
      sel2.value = chosen; nw.style.display = 'none';
    };
    sel2.onchange = function () { nw.style.display = sel2.value === '__new__' ? '' : 'none'; if (sel2.value === '__new__') nw.focus(); if (onChange) onChange(api.get()); };
    nw.oninput = function () { if (onChange) onChange(api.get()); };
    api.fill([], '');
    return api;
  }
  // Groups saved helmets of one kind by their Category (no category first), for the Load and Manage popups.
  // build(label, rows) is called once per group; label is '' for the no category group when it is the only one.
  function eachGroup(rows, build) {
    var cats = {}, order = [];
    rows.forEach(function (p) { var c = String(p.collection || ''); if (!cats[c]) { cats[c] = []; order.push(c); } cats[c].push(p); });
    order.sort(function (x, y) { return x === '' ? -1 : (y === '' ? 1 : x.localeCompare(y)); });
    order.forEach(function (c) { build(c === '' ? (order.length > 1 ? 'No category' : '') : c, cats[c]); });
  }

  // The slider block shared by the layer editor and the Logo Manager form.
  // o.keys names the stored fields {x,y,w,h,r}; o.obj() returns the object that holds them; o.changed() redraws;
  // o.layer() returns a layer-like {f,m,v,s} so the picture's real proportions can be looked up.
  // Each slider has a typed number box on its right. The link button (between Max width and Max height) keeps the
  // picture's proportions while either one changes.
  var linkOn = true;     // remembered for the session
  function makeGrid(o) {
    var K = o.keys, g = mk('div', 'rch-sliders'), g2 = mk('div', 'rch-sliders'), g3 = mk('div', 'rch-sliders'), g4 = mk('div', 'rch-sliders'), g5 = mk('div', 'rch-sliders'), rows = {}, nat = null, fixedRatio = 0;   // g = position sliders, g2 = tilt and skew
    function obj() { return o.obj(); }
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function fmt(d) { return String(Math.round(d * 10) / 10); }
    function ratio() { if (nat) return nat; if (!fixedRatio) { var oo = obj(); fixedRatio = (Number(oo[K.w]) || 1) / (Number(oo[K.h]) || 1); } return fixedRatio; }
    function sizeFrom(field) {
      if (!linkOn) return;
      var oo = obj(), r = ratio(), w = Number(oo[K.w]), h = Number(oo[K.h]);
      if (field === 'w') { h = w / r; if (h < 5) { h = 5; w = h * r; } if (h > 1000) { h = 1000; w = h * r; } }
      else { w = h * r; if (w < 5) { w = 5; h = w / r; } if (w > 1000) { w = 1000; h = w / r; } }
      oo[K.w] = Math.round(clamp(w, 5, 1000)); oo[K.h] = Math.round(clamp(h, 5, 1000));
      rows.w.sync(); rows.h.sync();
    }
    function addRow(field, label, min, max, step, toDisp, fromDisp, host) {
      host = host || g;
      var lab = mk('span', '', label); host.appendChild(lab);
      var rng = mk('input'); rng.type = 'range'; rng.min = min; rng.max = max; rng.step = step;
      var num = mk('input', 'rch-num'); num.type = 'number'; num.min = min; num.max = max; num.step = step; num.setAttribute('aria-label', label);
      var row = { lab: lab, sync: function () { var d = toDisp(obj()[K[field]]); rng.value = d; num.value = fmt(d); } };
      function apply(d) {
        obj()[K[field]] = fromDisp(clamp(d, min, max));
        if (field === 'sk' && !obj()[K[field]]) delete obj()[K[field]];
        if ((field === 'bu' || field === 'bl') && !obj()[K[field]]) delete obj()[K[field]];
        if (field === 'pa' && !obj()[K[field]]) { delete obj()[K[field]]; if (K.pp) delete obj()[K.pp]; }   // no pinch: nothing is saved
        if (field === 'w' || field === 'h') {
          // unlinked: the picture is stretched to the box (width and height move on their own); linked: back to its own proportions
          if (o.stretchKey) { if (linkOn) delete obj()[o.stretchKey]; else obj()[o.stretchKey] = 1; }
          sizeFrom(field);
        }
        o.changed();
      }
      rng.oninput = function () { var d = parseFloat(rng.value); num.value = fmt(d); apply(d); };
      num.oninput = function () { var d = parseFloat(num.value); if (!isFinite(d) || d < min || d > max) return; rng.value = d; apply(d); };   // live while typing, as long as the number is in range
      num.onchange = function () { var d = parseFloat(num.value); if (!isFinite(d)) { row.sync(); return; } d = clamp(d, min, max); apply(d); row.sync(); };
      host.appendChild(rng); host.appendChild(num);
      rows[field] = row; row.sync();
      return row;
    }
    addRow('y', 'Up / down', 0, 1254, 1, function (v) { return 1254 - (Number(v) || 0); }, function (d) { return 1254 - d; });
    addRow('x', 'Left / right', 0, 1254, 1, function (v) { return Number(v) || 0; }, function (d) { return d; });
    addRow('w', 'Max width', 5, 1000, 1, function (v) { return Number(v) || 0; }, function (d) { return d; }, g3);
    var hr = addRow('h', 'Max height', 5, 1000, 1, function (v) { return Number(v) || 0; }, function (d) { return d; }, g3);
    addRow('r', 'Tilt (deg)', -45, 45, 0.5,
      function (v) { v = Number(v) || 0; return -(v - turnBase(v)) || 0; },
      function (d) { return wrapAngle(turnBase(obj()[K.r]) - d); }, g2);
    // Skew: slide left and the top leans left while the bottom leans right; slide right for the opposite
    if (K.sk) addRow('sk', 'Skew (deg)', -45, 45, 0.5, function (v) { return Number(v) || 0; }, function (d) { return d; }, g2);
    // Stretch (pulls the picture wider sideways only): Position = where along the width (0 = left edge, 100 = right edge), Amount = how strong
    // (negative squeezes instead of stretching)
    if (K.pa) {
      addRow('pp', 'Position', 0, 100, 1, function (v) { return (v === undefined || v === null || v === '') ? 50 : (Number(v) || 0); }, function (d) { return d; }, g4);
      addRow('pa', 'Amount', -100, 100, 1, function (v) { return Number(v) || 0; }, function (d) { return d; }, g4);
    }
    // Bow: bends the layer, middle moves while the edges stay put (Up / down arches it, Left / right slides the middle sideways)
    if (K.bu) {
      addRow('bu', 'Up / down', -100, 100, 1, function (v) { return Number(v) || 0; }, function (d) { return d; }, g5);
      addRow('bl', 'Left / right', -100, 100, 1, function (v) { return Number(v) || 0; }, function (d) { return d; }, g5);
    }
    // link button, centered between the Max width and Max height labels
    var lk = mk('button', 'rch-link', LINK_ICON); lk.type = 'button';
    function lkState() { lk.className = 'rch-link' + (linkOn ? ' on' : ''); lk.setAttribute('aria-pressed', linkOn ? 'true' : 'false'); lk.title = linkOn ? 'Linked: width and height keep the picture\'s proportions. Click to unlink.' : 'Unlinked. Click to keep the picture\'s proportions.'; lk.setAttribute('aria-label', lk.title); }
    lkState();
    lk.onclick = function () {
      linkOn = !linkOn; lkState();
      var oo = obj();
      if (linkOn) {
        fixedRatio = 0;
        if (o.stretchKey) delete oo[o.stretchKey];
        if (nat) { sizeFrom('w'); rows.w.sync(); rows.h.sync(); o.changed(); }
      } else if (o.stretchKey && nat && !oo[o.stretchKey]) {
        // the box becomes exactly the size the picture is drawn at now, so nothing jumps when it starts to stretch
        var bw = Number(oo[K.w]) || 1, bh = Number(oo[K.h]) || 1, fit = Math.min(bw / nat, bh);
        oo[K.w] = Math.round(fit * nat); oo[K.h] = Math.round(fit); rows.w.sync(); rows.h.sync(); o.changed();
      }
    };
    hr.lab.appendChild(lk);
    return {
      el: g, el2: g2, el3: g3, el4: g4, el5: g5,
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
  function makeRotateButtons(getObj, key, after, mirrorKeys) {
    function one(label, dir) {
      // Left reads "Left" then its arrow, Right reads its arrow then "Right", so the two mirror each other around the Mirror button
      var b = mk('button', 'rc-btn-secondary rch-rotbtn', dir > 0 ? '<span>' + label + '</span>' + ROT_ICON : ROT_ICON + '<span>' + label + '</span>'); b.type = 'button';
      b.title = 'Rotate ' + label.toLowerCase() + ' 90 degrees'; b.setAttribute('aria-label', 'Rotate ' + label.toLowerCase() + ' 90 degrees');
      if (dir < 0) b.firstChild.style.transform = 'scaleX(-1)';
      b.onclick = function () { var oo = getObj(); oo[key] = wrapAngle((Number(oo[key]) || 0) + dir * 90); after(); };
      return b;
    }
    var out = [one('Rotate Left', 1)];
    (mirrorKeys || []).forEach(function (mk2) {
      // Mirror buttons (icon only) between the two rotate buttons: fx flips left to right, fy flips top to bottom
      var mb = mk('button', 'rc-btn-secondary rch-rotbtn rch-mirror', mk2[1]); mb.type = 'button';
      mb.title = mk2[2]; mb.setAttribute('aria-label', mk2[2]);
      function mstate() { mb.classList.toggle('rch-on', !!getObj()[mk2[0]]); }
      mb.onclick = function () { var oo = getObj(); if (oo[mk2[0]]) delete oo[mk2[0]]; else oo[mk2[0]] = 1; mstate(); after(); };
      mstate(); out.push(mb);
    });
    out.push(one('Rotate Right', -1));
    return out;
  }
  var MIRROR_V_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h18" stroke-dasharray="2 3"/><path d="M7 9 17 3v6z" transform="translate(0 0)"/><path d="M7 15h10l-5 6z"/></svg>';
  var MIRROR_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18" stroke-dasharray="2 3"/><path d="M9 7 3 17h6z"/><path d="M15 7l6 10h-6z"/></svg>';

  var TRASH_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';   // garbage can: the Remove layer button
  var EYE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';   // layer shown
  var EYE_OFF_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="3" y1="21" x2="21" y2="3" stroke-width="2.6"/></svg>';   // layer hidden: the eye with a line through it
  var COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';

  function openDesigner(ctx, opts) {
    opts = opts || {};
    var only = opts.only || '';   // 'manage' or 'logos': open just that manager (from the admin page), no designer window
    var fetchApi = ctx.fetchApi, token = ctx.token, toast = ctx.showToast, toast_ = ctx.showToast;
    // the Player Name and Flag box shows the admin's own name and country in the preview (members get theirs when they pick the helmet)
    var me = (typeof getProfileCache === 'function') ? (getProfileCache() || {}) : {};
    var previewPlayer = { n: me.displayName || me.username || 'Driver Name', c: me.location || 'United States', u: '12' };
    var body = mk('div', 'rch-designer');
    var inline = !!opts.host, dirtyFn = null;
    var modal = (only || inline) ? { el: mk('div'), closeBtn: mk('button'), close: function () {} } : ctx.showModal('Helmet Designer', { bodyEl: body, wide: true, accentHead: true });
    if (inline) { body.classList.add('rch-studio'); opts.host.appendChild(body); window.addEventListener('beforeunload', function (e) { if (dirtyFn && dirtyFn()) { e.preventDefault(); e.returnValue = ''; } }); }
    modal.el.classList.add('rch-modal');
    var stub = null;
    if (only) {   // the manager popup opens straight away with its own loading lights; the real one replaces it once the designer data is ready
      var sb = mk('div', 'rch-loadbody'); sb.appendChild(spin('Loading...'));
      stub = ctx.showModal(only === 'logos' ? 'Logo Manager' : 'Manage Helmet Designs', { bodyEl: sb, wide: true, accentHead: true });
    }
    // the loading lights sit in the middle of the popup
    var loadBox = mk('div'); loadBox.style.cssText = 'display:flex;align-items:center;justify-content:center;min-height:62vh';
    loadBox.appendChild(window.rcHelmetSpinner_ ? window.rcHelmetSpinner_('Loading the helmet designer...') : mk('p', 'rch-hint', 'Loading the helmet designer...'));
    body.appendChild(loadBox);
    try { localStorage.removeItem('rcHelmetVerChecked'); } catch (e0) {}   // helmets may change here: every page checks for the new version next time

    fetchApi('getHelmetAssets', {}).then(function (res) {
      if (!res || !res.success) { if (only) { if (stub) stub.close(); toast_('Could not load: ' + ((res && res.message) || 'no answer.'), 'error'); } body.innerHTML = ''; body.appendChild(mk('p', 'rch-hint', 'Could not load the helmet designer: ' + esc((res && res.message) || 'no answer from the server.'))); return; }
      H.configure({ designs: res.designs || [], logos: res.logos || [], manufacturers: res.manufacturers || [], showLocked: true });
      return H.pruneDesigns().then(function () { build(res); });
    }).catch(function (err) {
      if (window.console) console.error('Helmet designer:', err);
      if (only) { if (stub) stub.close(); toast_('No answer from the server. Try again.', 'error'); }
      body.innerHTML = ''; body.appendChild(mk('p', 'rch-hint', 'No answer from the server. Close this and try again.'));
    });

    function build(assets) {
      body.innerHTML = '';
      var cfg = H.getConfig();
      // a plain white helmet with no design (the way the designer opens and what Reset returns to)
      function blankRecipe() { var b = H.normalizeRecipe(H.defaultRecipe()); b.d = 0; b.logos = []; return b; }
      var R = blankRecipe();
      var baseline = JSON.parse(JSON.stringify(R));   // what Reset returns to: the helmet as last loaded or saved
      var cur = { id: '', name: '', kind: 'Awards', mfr: '', desc: '', coll: '', tier: 'Common' };
      var collList = [];   // every Category already used, for the Category box
      var afterOk = null;                                      // runs once after the next successful save (Save changes, then New)
      // The file tab above the Save box: the loaded helmet as "Name (ID)", an asterisk when it has unsaved changes, or "New".
      var FILE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
      var tab = mk('div', 'rch-tab'); tab.appendChild(mk('span', 'rch-tab-icon', FILE_ICON));
      var fnBox = mk('input', 'rch-filename'); fnBox.type = 'text'; fnBox.readOnly = true; fnBox.tabIndex = -1; fnBox.setAttribute('aria-label', 'File name'); fnBox.value = 'Untitled';
      var tabLabel = mk('span', 'rch-tab-label'); tabLabel.appendChild(fnBox); var tabNote = mk('em', 'rch-tab-unsaved'); tab.appendChild(tabLabel); tab.appendChild(tabNote);
      function isDirty() {
        if (JSON.stringify(R) !== JSON.stringify(baseline)) return true;
        if (!cur.id) return !!String(cur.name || '').trim() || !!String(cur.desc || '').trim() || !!String(cur.coll || '').trim();
        if (cur.saved && String(cur.saved.desc || '') !== String(cur.desc || '')) return true;
        if (cur.saved && String(cur.saved.coll || '') !== String(COLL_KINDS.indexOf(cur.kind) >= 0 ? (cur.coll || '') : '')) return true;
        if (cur.saved && String(cur.saved.tier || 'Common') !== String(COLL_KINDS.indexOf(cur.kind) >= 0 ? (cur.tier || 'Common') : 'Common')) return true;
        return !!cur.saved && (cur.saved.kind !== cur.kind || cur.saved.mfr !== (cur.kind === 'Manufacturer' ? cur.mfr : '') || cur.saved.name !== (cur.kind === 'Manufacturer' ? cur.mfr : String(cur.name || '').trim()));
      }
      dirtyFn = isDirty;
      function updateTab() {
        var t = cur.id ? ((cur.saved && cur.saved.name) || cur.name || 'Helmet') + ' (' + cur.id + ')' : 'Untitled';
        var dirty = isDirty();
        tabNote.textContent = dirty ? 'unsaved changes' : '';
        fnBox.style.width = Math.max(8, t.length + 1) + 'ch';
        tab.title = t + (dirty ? ' - unsaved changes' : '');
        fnBox.value = t;
      }
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
      nameIn.oninput = function () { cur.name = nameIn.value; updateTab(); };
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
      // Category (Season 1, Limited Edition...): only for Special Event, Premium and Awards helmets; groups them in the Load and Manage lists
      var collWrap = mk('div', 'rch-collwrap'); collWrap.appendChild(mk('div', 'rch-label', 'Category'));
      var collPick = makeCollPicker(function (v) { cur.coll = v; updateTab(); });
      collWrap.appendChild(collPick.el);
      collWrap.appendChild(mk('div', 'rch-label rch-mt', 'Tier'));
      var tierSel = makeTierSel(); tierSel.onchange = function () { cur.tier = tierSel.value; updateTab(); };
      collWrap.appendChild(tierSel); bar.appendChild(collWrap);
      // optional description (200 characters at most); the note about the chosen Kind sits under it
      var descWrap = mk('div', 'rch-descwrap'); descWrap.appendChild(mk('div', 'rch-label', 'Helmet description'));
      var descIn = mk('textarea', 'rch-desc'); descIn.maxLength = 200; descIn.rows = 3; descIn.placeholder = 'Optional. A short note about this helmet (200 characters at most).';
      descIn.oninput = function () { cur.desc = descIn.value; updateTab(); };
      descWrap.appendChild(descIn); bar.appendChild(descWrap);
      var kindHint = mk('p', 'rch-hint'); bar.appendChild(kindHint);
      kindSel.onchange = function () { cur.kind = kindSel.value; syncMeta(); };
      mfrSel.onchange = function () { cur.mfr = mfrSel.value; if (cur.kind === 'Manufacturer') { cur.name = cur.mfr; } syncMeta(); };
      var status = mk('p', 'rch-status'); bar.appendChild(status);
      var btns = mk('div', 'rch-btns');
      var ICO = {'NEW': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/></svg>', 'OPEN': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>', 'SAVE': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>', 'SAVENEW': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/><line x1="15" y1="12" x2="15" y2="18"/><line x1="12" y1="15" x2="18" y2="15"/></svg>'};
      function withIcon(b, key, label) { b.innerHTML = ICO[key] + '<span class="rch-btnlabel">' + label + '</span>'; b.classList.add('rch-iconlabel'); }
      var saveBtn = mk('button', 'rc-btn-secondary rc-btn-sm', 'Save'); saveBtn.type = 'button';
      var saveNewBtn = mk('button', 'rc-btn-secondary rc-btn-sm', 'Save as New'); saveNewBtn.type = 'button'; saveNewBtn.style.display = 'none';
      withIcon(saveBtn, 'SAVE', 'Save'); withIcon(saveNewBtn, 'SAVENEW', 'Save as New');
      saveNewBtn.title = 'Keep the helmet you opened as it is and save this design as a separate helmet';
      var loadBtn = mk('button', 'rc-btn-secondary rc-btn-sm', 'Open'); loadBtn.type = 'button';
      loadBtn.title = 'Open a saved helmet design (and manage the saved designs)';
      var newBtn = mk('button', 'rc-btn-secondary rc-btn-sm rch-blackbtn', 'New'); newBtn.type = 'button';
      withIcon(loadBtn, 'OPEN', 'Open'); withIcon(newBtn, 'NEW', 'New');
      newBtn.title = 'Start a new helmet: a plain white helmet with no design and no logos';
      function startNew() {
        R = blankRecipe(); sel = null; cur = { id: '', name: '', kind: 'Awards', mfr: '', desc: '', coll: '', tier: 'Common' }; baseline = JSON.parse(JSON.stringify(R));
        nameIn.value = ''; syncMeta(); draw();
      }
      newBtn.onclick = function () {
        afterOk = null;
        if (!isDirty()) { startNew(); return; }
        confirmBox('Save changes first?', 'This helmet has changes that have not been saved. Do you want to save them before you start a new helmet?', [
          { label: 'Save changes', primary: true, fn: function () { afterOk = startNew; doSave(false); } },
          { label: 'Don\'t save', fn: startNew },
          { label: 'Cancel' }]);
      };
      btns.appendChild(newBtn); btns.appendChild(loadBtn); btns.appendChild(saveBtn); btns.appendChild(saveNewBtn);
      bar.appendChild(mk('div', 'rch-label rch-subhead rch-mt', 'File options'));
      bar.appendChild(btns);
      var logosBtn = mk('button', 'rc-btn-secondary rc-btn-sm', 'Manage'); logosBtn.title = 'Manage logos'; logosBtn.type = 'button';
      var addLogoBtn = mk('button', 'rc-btn-secondary rc-btn-sm', 'Upload'); addLogoBtn.title = 'Upload a logo'; addLogoBtn.type = 'button';
      right.appendChild(tab);
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
        b.innerHTML = '<i style="background:' + (v.stops ? 'linear-gradient(180deg,' + v.stops.join(',') + ')' : 'linear-gradient(135deg,' + v.c1 + ',' + v.c2 + ')') + '"></i>' + v.name;
        b.onclick = function () { R.v = v.id; draw(); };
        vs.appendChild(b);
      });
      style.appendChild(vs);
      right.appendChild(style);

      /* ---------------- right: logos (layer list) ---------------- */
      var lg = mk('div', 'rch-section');
      lg.appendChild(mk('div', 'rch-label', 'Logos and shapes'));
      var layers = mk('div', 'rch-layers'); lg.appendChild(layers);
      var addRow = mk('div', 'rch-btns rch-addrow');
      var lpick = mk('select', 'rch-select-wide');
      function buildPicker() {
        var keep = lpick.value;
        lpick.innerHTML = '';
        var gS = mk('optgroup'); gS.setAttribute('data-cat', 'shapes'); gS.label = 'Basic shapes';
        H.SHAPES.forEach(function (sh) { if (sh.premium || sh.gradient || sh.light || sh.weathering || sh.player || sh.pattern) return; var o = mk('option'); o.value = 's:' + sh.id; o.textContent = sh.name; gS.appendChild(o); });
        lpick.appendChild(gS);
        var gP = mk('optgroup'); gP.setAttribute('data-cat', 'shapes'); gP.label = 'Advanced shapes';
        H.SHAPES.forEach(function (sh) { if (!sh.premium) return; var o = mk('option'); o.value = 's:' + sh.id; o.textContent = sh.name; gP.appendChild(o); });
        lpick.appendChild(gP);
        var gG = mk('optgroup'); gG.setAttribute('data-cat', 'shapes'); gG.label = 'Gradients';
        H.SHAPES.forEach(function (sh) { if (!sh.gradient || sh.hidden) return; var o = mk('option'); o.value = 's:' + sh.id; o.textContent = sh.name; gG.appendChild(o); });
        lpick.appendChild(gG);
        var gL = mk('optgroup'); gL.setAttribute('data-cat', 'effects'); gL.label = 'Light effects';
        H.SHAPES.forEach(function (sh) { if (!sh.light) return; var o = mk('option'); o.value = 's:' + sh.id; o.textContent = sh.name; gL.appendChild(o); });
        lpick.appendChild(gL);
        var gW = mk('optgroup'); gW.setAttribute('data-cat', 'effects'); gW.label = 'Weathering';
        H.SHAPES.forEach(function (sh) { if (!sh.weathering) return; var o = mk('option'); o.value = 's:' + sh.id; o.textContent = sh.name; gW.appendChild(o); });
        lpick.appendChild(gW);
        var gT = mk('optgroup'); gT.setAttribute('data-cat', 'shapes'); gT.label = 'Patterns';
        H.SHAPES.forEach(function (sh) { if (!sh.pattern) return; var o = mk('option'); o.value = 's:' + sh.id; o.textContent = sh.name; gT.appendChild(o); });
        lpick.appendChild(gT);
        var gD = mk('optgroup'); gD.setAttribute('data-cat', 'text'); gD.label = 'Dynamic';
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
          var g = mk('optgroup'); g.setAttribute('data-cat', 'logos'); g.label = c;
          cats[c].forEach(function (l) { var o = mk('option'); o.value = 'f:' + l.file; o.textContent = l.name; g.appendChild(o); });
          lpick.appendChild(g);
        });
        var gM = mk('optgroup'); gM.setAttribute('data-cat', 'logos'); gM.label = 'Manufacturers';
        H.getConfig().manufacturers.forEach(function (n) { var o = mk('option'); o.value = 'm:' + n; o.textContent = n; gM.appendChild(o); });
        lpick.appendChild(gM);
        // the Filter checkboxes above the list hide the groups that are not wanted
        var kids = Array.prototype.slice.call(lpick.children);
        kids.forEach(function (g) { var c = g.getAttribute('data-cat'); if (!filt.all && !filt[c]) lpick.removeChild(g); });
        if (keep) lpick.value = keep;
        if (!lpick.value && lpick.options.length) lpick.selectedIndex = 0;
      }
      // Filter: All (default) or any mix of Shapes, Effects, Text and Logos
      var filt = { all: true, shapes: false, effects: false, text: false, logos: false };
      var filterRow = mk('div', 'rch-filterrow'); filterRow.appendChild(mk('span', 'rch-filterlabel', 'Filter'));
      var filterBoxes = {};
      [['all', 'All'], ['shapes', 'Shapes'], ['effects', 'Effects'], ['text', 'Text'], ['logos', 'Logos']].forEach(function (f) {
        var lb = mk('label', 'rch-check rch-plain'); var cb = mk('input'); cb.type = 'checkbox'; cb.checked = !!filt[f[0]]; filterBoxes[f[0]] = cb;
        cb.onchange = function () {
          if (f[0] === 'all') { filt.all = true; ['shapes', 'effects', 'text', 'logos'].forEach(function (k) { filt[k] = false; }); }
          else { filt[f[0]] = cb.checked; filt.all = !(filt.shapes || filt.effects || filt.text || filt.logos); }
          Object.keys(filterBoxes).forEach(function (k) { filterBoxes[k].checked = !!filt[k]; });
          buildPicker();
        };
        lb.appendChild(cb); lb.appendChild(document.createTextNode(' ' + f[1])); filterRow.appendChild(lb);
      });
      buildPicker();
      var addB = mk('button', 'rc-btn-secondary rc-btn-sm rch-blackbtn', 'Add layer'); addB.type = 'button';
      addB.onclick = function () {
        if (R.logos.length >= MAX_LAYERS) { toast('A helmet can have 25 layers at most.', 'error'); return; }
        var kind = lpick.value.charAt(0), isM = kind === 'm', val = lpick.value.substr(2);
        var isGrad = kind === 's' && (H.SHAPES.filter(function (x) { return x.id === val; })[0] || {}).gradient;
        var isLight = kind === 's' && (H.SHAPES.filter(function (x) { return x.id === val; })[0] || {}).light;
        var isWeather = kind === 's' && (H.SHAPES.filter(function (x) { return x.id === val; })[0] || {}).weathering;
        var n = (kind === 's' && /^player/.test(val)) ? { s: val, c: 'black', m: '', v: 'std', f: '', x: 640, y: 770, w: (val === 'player_number' ? 120 : 320), h: 56, r: 0, sh: 1 } : isLight ? { s: val, c: 'white', m: '', v: 'std', f: '', x: 640, y: 770, w: 320, h: 220, r: 0, sh: 0 } : isWeather ? { s: val, c: 'black', m: '', v: 'std', f: '', x: 640, y: 770, w: 360, h: 260, r: 0, sh: 0 } : isGrad ? { s: val, c: 'red', c2: 'black', m: '', v: 'std', f: '', x: 640, y: 770, w: 320, h: 200, r: 0, sh: 0 } : kind === 's'
          ? { s: val, c: 'red', m: '', v: 'std', f: '', x: 640, y: 770, w: 220, h: (val === 'stripe' || val === 'pill' || val === 'checker') ? 80 : (val === 'g_checker' ? 160 : 220), r: 0, sh: 0 }
          : isM ? { m: val, v: 'std', f: '', x: 640, y: 770, w: 240, h: 170, r: 3, sh: 0 }
          : { m: '', v: 'std', f: val, x: 640, y: 770, w: 220, h: 220, r: 0, sh: 0 };   // an uploaded logo always starts the same way a shape does
        origSize.set(n, { w: n.w, h: n.h, r: n.r });
        var selIdx = sel ? R.logos.indexOf(sel) : -1;
        if (selIdx >= 0) {   // a layer is selected: the new one goes directly above it (and under the accents when the selected one is)
          var acN = Math.max(0, Math.min(R.logos.length, Math.floor(+R.ac) || 0));
          R.logos.splice(selIdx + 1, 0, n); if (selIdx < acN) R.ac = acN + 1;
        } else R.logos.push(n);
        sel = n; draw();
      };
      addRow.appendChild(lpick); addRow.appendChild(addB); addRow.appendChild(addLogoBtn); addRow.appendChild(logosBtn);
      lg.insertBefore(addRow, layers); lg.insertBefore(filterRow, addRow);
      lg.insertBefore(mk('div', 'rch-label rch-subhead rch-layerlist-head', 'Layer list'), layers);   // the shape picker and Add layer sit above the list, over the Outer Shell line
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
        if (l.s) return shapeName(l.s) + ' (' + (String(l.c).charAt(0) === '#' ? l.c : ((H.PALETTE.filter(function (p) { return p.id === l.c; })[0] || {}).name || l.c)) + (+l.bw >= 1 && l.bc ? ', ' + H.hexOf(l.bc) : '') + ')';
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
        function stepItem(from, to) {   // arrow buttons: one step up or down the list
          if (from < 0 || from === to || to < 0 || to > items.length) return;
          var moved = items.splice(from, 1)[0];
          items.splice(Math.max(0, Math.min(items.length, to)), 0, moved);
          applyOrder();
        }
        function moveItem(from, to) {   // drag and drop: the dragged item always lands directly above the one it is dropped on
          if (from < 0 || from === to || to < 0 || to > items.length) return;
          var moved = items[from], target = items[to];
          items.splice(from, 1);
          var ti = target ? items.indexOf(target) : items.length;
          items.splice(ti, 0, moved);
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
        items.forEach(function (it, pos) {
          if (it.acc) {
            var ar = edgeLine('Accents', 'rch-edge-acc'); dragStart(ar, pos); dropOn(ar, pos);
            ar.title = 'Drag this line, or move layers above and below it, to choose which layers sit under the accent paint.';
            layers.appendChild(ar);
            return;
          }
          var idx = it.idx, l = R.logos[idx];
          var row = mk('div', 'rch-layer' + (l === sel ? ' sel' : '') + (l.hd ? ' rch-layer-off' : '')); row.dataset.pos = pos;
          row.appendChild(mk('span', 'rch-layer-no', String(idx + 1)));   // layer number: 1 is the back layer, the highest number is in front
          row.appendChild(mk('span', 'rch-grip', '&#8942;&#8942;'));
          var nm = mk('span', 'rch-layer-name'); nm.textContent = logoName(l);
          if (missing && missing[idx]) { var miss = mk('span', 'rch-miss', 'FILE NOT FOUND'); nm.appendChild(miss); }
          row.appendChild(nm);
          var up = mk('button', 'rch-icon', '&#9650;'); up.type = 'button'; up.title = 'Bring forward';
          var dn = mk('button', 'rch-icon', '&#9660;'); dn.type = 'button'; dn.title = 'Send back';
          var cp = mk('button', 'rch-icon', COPY_ICON); cp.type = 'button'; cp.title = 'Copy this layer (the copy goes directly above it)';
          var hv = mk('button', 'rch-icon', l.hd ? EYE_OFF_ICON : EYE_ICON); hv.type = 'button'; hv.title = l.hd ? 'Show this layer' : 'Hide this layer';
          var rm = mk('button', 'rch-icon', TRASH_ICON); rm.type = 'button'; rm.title = 'Remove layer';
          // the arrows move a layer one step in the list, across the Accents line when it is next to it
          up.onclick = function (e) { e.stopPropagation(); stepItem(pos, pos - 1); };
          dn.onclick = function (e) { e.stopPropagation(); stepItem(pos, pos + 1); };
          rm.onclick = function (e) { e.stopPropagation(); R.logos.splice(idx, 1); if (idx < ac) { if (ac - 1 > 0) R.ac = ac - 1; else delete R.ac; } if (sel === l) sel = null; draw(); };
          hv.onclick = function (e) { e.stopPropagation(); if (l.hd) delete l.hd; else l.hd = 1; draw(); };
          cp.onclick = function (e) {
            e.stopPropagation();
            if (R.logos.length >= MAX_LAYERS) { toast('A helmet can have 25 layers at most.', 'error'); return; }
            var dup = JSON.parse(JSON.stringify(l)); dup.x = (+dup.x || 0) + 20; dup.y = (+dup.y || 0) - 20;
            R.logos.splice(idx + 1, 0, dup); if (idx < ac) R.ac = ac + 1; sel = dup; draw();
          };
          row.appendChild(up); row.appendChild(dn); row.appendChild(cp); row.appendChild(hv); row.appendChild(rm);
          row.onclick = function () { sel = l; renderLayers(missing); renderDetail(); updateSelBox(); };
          dragStart(row, pos); dropOn(row, pos);
          layers.appendChild(row);
        });
        var baseEdge = edgeLine('Base'); dropOn(baseEdge, items.length); layers.appendChild(baseEdge);
      }

      var origSize = new WeakMap();   // the width and height a layer started with, for Reset
      var curGrid = null;           // the slider block of the selected layer (the preview drag keeps it in step)
      function renderDetail() {
        detail.innerHTML = ''; curGrid = null;
        if (!sel || R.logos.indexOf(sel) < 0) return;
        if (!origSize.has(sel)) origSize.set(sel, { w: sel.w, h: sel.h, r: 0 });
        var grid = curGrid = makeGrid({ keys: { x: 'x', y: 'y', w: 'w', h: 'h', r: 'r', sk: 'sk', pp: 'pp', pa: 'pa', bu: 'bu', bl: 'bl' }, stretchKey: 'st', obj: function () { return sel; }, layer: function () { return sel; }, changed: function () { draw(true); } });
        grid.loadAspect();
        detail.appendChild(mk('div', 'rch-label rch-subhead', 'Layer position'));
        detail.appendChild(grid.el);
        detail.appendChild(mk('div', 'rch-label rch-subhead rch-mt', 'Layer transform'));
        var rotRow = mk('div', 'rch-btns rch-rotrow'); detail.appendChild(rotRow);   // Rotate Left, the two mirrors, Rotate Right
        var tbtns = makeRotateButtons(function () { return sel; }, 'r', function () { grid.sync(); draw(true); }, [['fx', MIRROR_ICON, 'Mirror left to right'], ['fy', MIRROR_V_ICON, 'Mirror top to bottom']]);
        // order: Rotate Left, Rotate Right, mirror left to right, mirror top to bottom, Reset
        [tbtns[0], tbtns[3], tbtns[1], tbtns[2]].forEach(function (bn) { rotRow.appendChild(bn); });
        var resetT = mk('button', 'rc-btn-secondary rch-rotbtn', 'Reset'); resetT.type = 'button';
        resetT.title = 'Put width, height, tilt, skew, stretch, bow, rotation and mirroring back to normal (position stays)';
        resetT.onclick = function () { var d0 = origSize.get(sel); if (d0) { sel.w = d0.w; sel.h = d0.h; delete sel.st; } sel.r = (sel.m && !sel.s) ? (d0 && d0.r != null ? d0.r : 0) : 0; delete sel.sk; delete sel.pp; delete sel.pa; delete sel.bu; delete sel.bl; delete sel.fx; delete sel.fy; renderDetail(); draw(true); };
        rotRow.appendChild(resetT);
        grid.el3.style.marginTop = '10px'; detail.appendChild(grid.el3);   // Max width and Max height sit between the buttons and the tilt slider
        grid.el2.style.marginTop = '4px'; detail.appendChild(grid.el2);
        detail.appendChild(mk('div', 'rch-label rch-subhead rch-mt', 'Stretch'));
        detail.appendChild(grid.el4);
        detail.appendChild(mk('div', 'rch-label rch-subhead rch-mt', 'Bow'));
        detail.appendChild(grid.el5);   // Up / down and Left / right: bends the layer so its middle moves while the edges stay put
        void 0;   // Position and Amount: squeezes the picture sideways only, as if it wraps round the helmet
        detail.appendChild(mk('div', 'rch-label rch-subhead rch-mt', 'Colors and effects'));
        var opts = mk('div', 'rch-btns');
        // Soft shadow and Strong shadow: one or the other or none (sh: 0 none, 1 soft, 2 strong)
        var nsl = mk('label', 'rch-check rch-plain'); var nsc = mk('input'); nsc.type = 'checkbox'; nsc.checked = !(sel.sh === 1 || sel.sh === true || sel.sh === 2);
        var shl = mk('label', 'rch-check rch-plain'); var shc = mk('input'); shc.type = 'checkbox'; shc.checked = sel.sh === 1 || sel.sh === true;
        var sgl = mk('label', 'rch-check rch-plain'); var sgc = mk('input'); sgc.type = 'checkbox'; sgc.checked = sel.sh === 2;
        function shadowSet(v) { sel.sh = v; nsc.checked = v === 0; shc.checked = v === 1; sgc.checked = v === 2; draw(true); }
        nsc.onchange = function () { shadowSet(0); };                          // No shadow: always one of the three is on
        shc.onchange = function () { shadowSet(shc.checked ? 1 : 0); };
        sgc.onchange = function () { shadowSet(sgc.checked ? 2 : 0); };
        nsl.appendChild(nsc); nsl.appendChild(document.createTextNode(' No shadow')); opts.appendChild(nsl);
        shl.appendChild(shc); shl.appendChild(document.createTextNode(' Soft shadow')); opts.appendChild(shl);
        sgl.appendChild(sgc); sgl.appendChild(document.createTextNode(' Strong shadow')); opts.appendChild(sgl);
        if (sel.s) {
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
            else { pickColor('c', 'Gradient color'); }
          } else if (gdef.player) {
            pickColor('c', 'Text color');
            pickColor('bg', 'Text background color', '', true);
          } else { pickColor('c', gdef.light ? 'Light color' : gdef.weathering ? 'Mark color' : (gdef.pattern ? 'Pattern color' : (gdef.player ? 'Text color' : 'Shape'))); }
          // Border (basic and advanced shapes and the player number): a color picker under the shape color, then a 0 to 20 px size slider
          if (!gdef.gradient && !gdef.light && !gdef.weathering && !gdef.pattern && (!gdef.player || sel.s === 'player_number')) {
            if (!sel.bc) sel.bc = 'black';
            pickColor('bc', 'Border');
            var bwr = mk('div', 'rch-shapecolor');
            bwr.appendChild(mk('div', 'rch-label', 'Border size'));
            var bg2 = mk('div', 'rch-sliders rch-sliders-one');
            var br = mk('input'); br.type = 'range'; br.min = 0; br.max = 20; br.step = 1;
            var bn = mk('input', 'rch-num'); bn.type = 'number'; bn.min = 0; bn.max = 20; bn.step = 1; bn.setAttribute('aria-label', 'Border size in pixels');
            function curB() { return Math.max(0, Math.min(20, Math.round(Number(sel.bw) || 0))); }
            function setB(v) { v = Math.max(0, Math.min(20, Math.round(v))); if (v === 0) delete sel.bw; else sel.bw = v; br.value = v; draw(true); renderLayers(); }
            br.value = curB(); bn.value = curB();
            br.oninput = function () { bn.value = br.value; setB(parseFloat(br.value)); };
            bn.oninput = function () { var d = parseFloat(bn.value); if (isFinite(d) && d >= 0 && d <= 20) setB(d); };
            bn.onchange = function () { var d = parseFloat(bn.value); setB(isFinite(d) ? d : 0); bn.value = curB(); };
            bg2.appendChild(br); bg2.appendChild(bn); bwr.appendChild(bg2); detail.appendChild(bwr);
          }
        }
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
        detail.appendChild(opts);
      }

      function syncMeta() {
        var isMfr = cur.kind === 'Manufacturer';
        kindSel.value = cur.kind; mfrSel.value = cur.mfr || '';
        mcRow.style.display = isMfr ? '' : 'none';
        collWrap.style.display = COLL_KINDS.indexOf(cur.kind) >= 0 ? '' : 'none';
        collPick.fill(collList, cur.coll || '');
        tierSel.value = cur.tier || 'Common';
        kindHint.textContent = KIND_HINTS[cur.kind] || '';
        // a manufacturer helmet is named after its manufacturer, so the name box is switched off
        if (isMfr) { cur.name = cur.mfr || ''; }
        nameIn.disabled = isMfr;
        nameIn.placeholder = isMfr ? 'Named after the manufacturer' : 'e.g. Season 1 Champion';
        if (document.activeElement !== nameIn) nameIn.value = cur.name;
        status.innerHTML = '';
        if (document.activeElement !== descIn) descIn.value = cur.desc || '';
        saveNewBtn.style.display = cur.id ? '' : 'none';
        updateTab();
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
        syncControls(); updateTab();
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
          box.style.transform = 'translate(-50%, -50%) rotate(' + (-(Number(sel.r) || 0)) + 'deg)' + (Number(sel.sk) ? ' skewX(' + (-Number(sel.sk)) + 'deg)' : '');
        }
        if (!sel.s) {                       // a picture is drawn "contained" in its box: outline the picture itself
          var key = (sel.m || '') + '|' + (sel.v || '') + '|' + (sel.f || ''), asp = aspectCache[key], layer = sel;
          if (asp && sel.st) place(bw, bh);   // stretched on purpose: the box is the picture
          else if (asp) { var fit = Math.min(bw / asp, bh); place(fit * asp, fit); }
          else {
            place(bw, bh);
            H.imageAspect(layer).then(function (a) { if (a) { aspectCache[key] = a; if (sel === layer) updateSelBox(); } });
          }
        } else place(bw, bh);
        stage.appendChild(box);
      }

      // Clicking on a blank part of the popup (not a button, field, layer row, layer settings or the preview) lets go of the selected layer
      body.addEventListener('click', function (e) {
        if (!sel) return;
        var t = e.target;
        if (t.closest && t.closest('button, input, select, textarea, label, a, summary, .rch-layer, .rch-detail, .rch-stage, .rch-edge')) return;
        sel = null; renderLayers(); renderDetail(); updateSelBox();
      });

      // click / drag on the preview moves the selected logo
      var dragging = false;
      function moveTo(ev) {
        if (!sel) return; var cv = stage.querySelector('canvas'); if (!cv) return;
        var rc = cv.getBoundingClientRect(), C = H.CROP;
        sel.x = Math.round(C.x + (ev.clientX - rc.left) / rc.width * C.w); sel.y = Math.round(C.y + (ev.clientY - rc.top) / rc.height * C.h);
        if (curGrid) curGrid.sync();
        draw(true);
      }
      // While a layer is being dragged on the preview, text selection is switched off (so slipping the pointer off the picture never
      // highlights the page). Only the preview drag does this: the layer list's own drag and drop is untouched.
      function noSelect(e) { if (dragging) e.preventDefault(); }
      document.addEventListener('selectstart', noSelect);
      stage.addEventListener('pointerdown', function (e) { dragging = true; body.classList.add('rch-nosel'); try { window.getSelection().removeAllRanges(); } catch (x) {} moveTo(e); });
      var onMove = function (e) { if (dragging) moveTo(e); }, onUp = function () { dragging = false; body.classList.remove('rch-nosel'); };
      window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
      modal.closeBtn.addEventListener('click', function () { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); document.removeEventListener('selectstart', noSelect); });
      // Closing the designer with unsaved changes asks first (the same question the New button asks)
      if (!only && !inline) modal.closeBtn.addEventListener('click', function (ev) {
        if (!isDirty()) return;
        ev.stopImmediatePropagation();
        function closeNow() { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); document.removeEventListener('selectstart', noSelect); modal.close(); }
        confirmBox('Save changes first?', 'This helmet has changes that have not been saved. Do you want to save them before you close the designer?', [
          { label: 'Save changes', primary: true, fn: function () { afterOk = closeNow; doSave(false); } },
          { label: 'Don\'t save', fn: closeNow },
          { label: 'Cancel' }]);
      }, true);

      /* ---------------- save / load ---------------- */
      // The saved helmets (active ones) decide which manufacturers get a * and whether a save would replace one.
      function refreshPresets() {
        return fetchApi('adminListHelmetPresets', { token: token, params: { includeArchived: '1' } }).then(function (res) {
          if (!res || !res.success) return null;
          mfrDesigns = {}; collList = [];
          (res.presets || []).forEach(function (p) { if (p.collection && collList.indexOf(p.collection) < 0) collList.push(p.collection); });
          (res.presets || []).forEach(function (p) { if (p.kind === 'Manufacturer' && p.active && p.manufacturer) mfrDesigns[p.manufacturer] = p; });
          fillMfrs(); syncMeta();
          return (res.presets || []).filter(function (p) { return p.active; });
        }).catch(function () { return null; });
      }
      // One look for every "are you sure" popup in the designer: centered message, centered buttons.
      // buttons = [{ label, primary, fn }]  (a button always closes the popup, then runs fn)
      function confirmBox(title, msg, buttons) {
        var cb = mk('div', 'rch-confirm');
        cb.appendChild(mk('p', 'rch-confirm-msg')); cb.firstChild.textContent = msg;
        var row = mk('div', 'rch-btns'); cb.appendChild(row);
        var cm = ctx.showModal(title, { bodyEl: cb, accentHead: true });
        buttons.forEach(function (bd) {
          var bt = mk('button', bd.primary ? 'rc-btn-primary rc-btn-sm' : 'rc-btn-secondary rc-btn-sm', bd.label); bt.type = 'button';
          bt.onclick = function () { cm.close(); if (bd.fn) bd.fn(); };
          row.appendChild(bt);
        });
      }
      // Popup: ask before a save replaces the helmet that is already there. onYes runs the save.
      function askReplace(title, msg, onYes) {
        confirmBox(title, msg, [{ label: 'Save over it', primary: true, fn: onYes }, { label: 'Cancel' }]);
      }
      // while a save is running the button reads Saving... and the X in the corner is switched off
      function setSaving(on) {
        saveBtn.disabled = on; saveNewBtn.disabled = on; newBtn.disabled = on; loadBtn.disabled = on; saveBtn.querySelector('.rch-btnlabel').textContent = on ? 'Saving...' : 'Save';
        modal.closeBtn.disabled = on; modal.closeBtn.style.opacity = on ? '0.35' : ''; modal.closeBtn.style.pointerEvents = on ? 'none' : '';
      }
      // Save / Save as New. forceNew = save this as a separate helmet and leave the one that was loaded alone.
      // skipAsk = the "already exists" checks were answered; skipChange = the new-or-old question was answered; confirmed = overwrite confirmed.
      function doSave(skipAsk, forceNew, skipChange, confirmed) {
        var pid = forceNew ? '' : cur.id;
        var name = (cur.kind === 'Manufacturer' ? cur.mfr : (cur.name || '')).trim();
        if (cur.kind === 'Manufacturer' && !cur.mfr) { toast('Choose a manufacturer for a Manufacturer helmet.', 'error'); return; }
        if (!name) { toast('Give the helmet a name first.', 'error'); nameIn.focus(); return; }
        // 1. the helmet that was loaded or saved is being changed into something different: new helmet, or change the old one?
        if (!skipChange && !forceNew && cur.id && cur.saved && (cur.saved.kind !== cur.kind || cur.saved.mfr !== (cur.kind === 'Manufacturer' ? cur.mfr : '') || cur.saved.name !== name)) {
          confirmBox('Save as a new helmet?', 'You changed the name or kind of "' + cur.saved.name + '". Is this a brand new helmet, or do you want to change the one you opened? A new helmet leaves the old one exactly as it was.', [
            { label: 'Save as new helmet', primary: true, fn: function () { doSave(false, true, true); } },
            { label: 'Change the old one', fn: function () { doSave(false, false, true, true); } },
            { label: 'Cancel' }]);
          return;
        }
        // 2. saving onto a helmet that already exists always asks first
        if (pid && !confirmed) {
          confirmBox('Save over this helmet?', 'The ' + name + ' helmet already exists. Do you want to save over the previous design? The older one will be overwritten.', [
            { label: 'Save over it', primary: true, fn: function () { doSave(skipAsk, forceNew, true, true); } },
            { label: 'Cancel' }]);
          return;
        }
        // 3. a different helmet would be replaced (Website Default / one per manufacturer), or the name is already taken
        if (!skipAsk) {
          saveBtn.disabled = true; saveNewBtn.disabled = true;
          refreshPresets().then(function (list) {
            saveBtn.disabled = false; saveNewBtn.disabled = false;
            if (!list) { toast('Could not check the saved helmets. Try again.', 'error'); return; }
            list = list.filter(function (p) { return p.active && p.presetId !== pid; });
            var old = list.filter(function (p) {
              return p.kind === cur.kind && (cur.kind === 'Website Default' || (cur.kind === 'Manufacturer' && p.manufacturer === cur.mfr));
            })[0];
            if (old) {
              askReplace(cur.kind === 'Website Default' ? 'Replace the Website Default?' : 'Replace the ' + cur.mfr + ' helmet?',
                (cur.kind === 'Website Default' ? 'A Website Default helmet ("' + old.name + '") already exists.' : 'The ' + cur.mfr + ' helmet already exists.') + ' Do you want to save over the previous design? The older one will be archived.',
                function () { doSave(true, forceNew, true, true); });
              return;
            }
            var same = cur.kind !== 'Website Default' && cur.kind !== 'Manufacturer' && list.filter(function (p) { return String(p.name || '').trim().toLowerCase() === name.toLowerCase(); })[0];
            if (same) {
              confirmBox('Name already used', 'A helmet named "' + name + '" already exists. Save this as another helmet with the same name? The existing one is not changed.', [
                { label: 'Save as another', primary: true, fn: function () { doSave(true, forceNew, true, true); } },
                { label: 'Cancel' }]);
              return;
            }
            doSave(true, forceNew, true, true);
          });
          return;
        }
        setSaving(true);
        fetchApi('adminSaveHelmetPreset', {
          method: 'POST', token: token,
          body: { presetId: pid, collection: COLL_KINDS.indexOf(cur.kind) >= 0 ? String(cur.coll || '') : '', tier: COLL_KINDS.indexOf(cur.kind) >= 0 ? String(cur.tier || 'Common') : 'Common', description: String(cur.desc || '').slice(0, 200), name: name, kind: cur.kind, manufacturer: cur.kind === 'Manufacturer' ? cur.mfr : '', recipe: JSON.stringify(R) }
        }).then(function (res) {
          setSaving(false);
          if (!res || !res.success) { toast((res && res.message) || 'Could not save the helmet.', 'error'); return; }
          cur.id = res.presetId; cur.name = name; cur.saved = { name: name, kind: cur.kind, mfr: cur.kind === 'Manufacturer' ? cur.mfr : '', desc: String(cur.desc || ''), coll: COLL_KINDS.indexOf(cur.kind) >= 0 ? String(cur.coll || '') : '', tier: COLL_KINDS.indexOf(cur.kind) >= 0 ? String(cur.tier || 'Common') : 'Common' };
          baseline = JSON.parse(JSON.stringify(R));
          syncMeta(); refreshPresets();
          try { localStorage.removeItem('rcHelmetVerChecked'); } catch (e1) {}
          toast(res.replaced ? ('Saved. It replaced the older helmet "' + res.replaced + '".') : 'Helmet saved.', 'success');
          var nextStep = afterOk; afterOk = null; if (nextStep) nextStep();
        }).catch(function () { setSaving(false); toast('No answer from the server. Try again.', 'error'); });
      }
      saveBtn.onclick = function () { afterOk = null; doSave(false); };
      saveNewBtn.onclick = function () { afterOk = null; doSave(false, true, true); };
      function loadPreset(p) {
        R = H.normalizeRecipe(p.recipe); sel = null; baseline = JSON.parse(JSON.stringify(R));
        cur = { id: p.presetId, name: p.name, kind: (KINDS.indexOf(p.kind) >= 0 ? p.kind : 'Awards'), mfr: p.manufacturer || '', desc: p.description || '', coll: p.collection || '', tier: p.tier || 'Common' };
        cur.saved = { name: p.name, kind: cur.kind, mfr: cur.kind === 'Manufacturer' ? cur.mfr : '', desc: p.description || '', coll: COLL_KINDS.indexOf(cur.kind) >= 0 ? (p.collection || '') : '', tier: COLL_KINDS.indexOf(cur.kind) >= 0 ? (p.tier || 'Common') : 'Common' };
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

      /* ---------------- Open: loading a design into the studio, plus managing the library (details, access, archive, delete) ---------------- */
      function loadWithCheck(p, closeFn) {
        function go() { if (closeFn) closeFn(); loadPreset(p); }
        if (!isDirty()) { go(); return; }
        confirmBox('Save changes first?', 'The helmet in the studio has changes that have not been saved. Do you want to save them before you open "' + p.name + '"?', [
          { label: 'Save changes', primary: true, fn: function () { if (closeFn) closeFn(); afterOk = function () { loadPreset(p); }; doSave(false); } },
          { label: 'Don\'t save', fn: go },
          { label: 'Cancel' }]);
      }

      /* ---------------- Edit details: name, kind, manufacturer, category, description, and who it is given to (never the design itself) ---------------- */
      function openDetails(p, list, after) {
        var db = mk('div', 'rch-logoform');
        var dm = ctx.showModal('Edit Helmet Details', { bodyEl: db, accentHead: true });
        db.appendChild(mk('div', 'rch-label', 'Helmet name'));
        var n = mk('input', 'rch-input'); n.type = 'text'; n.maxLength = 60; n.value = p.name || ''; db.appendChild(n);
        db.appendChild(mk('div', 'rch-label rch-mt', 'Kind'));
        var k = mk('select', 'rch-select-wide'); KINDS.forEach(function (x) { var o = mk('option'); o.value = x; o.textContent = x; k.appendChild(o); });
        k.value = KINDS.indexOf(p.kind) >= 0 ? p.kind : 'Awards'; db.appendChild(k);
        var mw = mk('div'); mw.appendChild(mk('div', 'rch-label rch-mt', 'Manufacturer'));
        var m = mk('select', 'rch-select-wide'); var m0 = mk('option'); m0.value = ''; m0.textContent = 'Choose...'; m.appendChild(m0);
        (assets.manufacturers || []).forEach(function (x) { var o = mk('option'); o.value = x; o.textContent = x; m.appendChild(o); });
        m.value = p.manufacturer || ''; mw.appendChild(m); db.appendChild(mw);
        var cw = mk('div'); cw.appendChild(mk('div', 'rch-label rch-mt', 'Category'));
        var cpk = makeCollPicker(null); cpk.fill(collList, p.collection || ''); cw.appendChild(cpk.el);
        cw.appendChild(mk('div', 'rch-label rch-mt', 'Tier'));
        var tsel = makeTierSel(); tsel.value = p.tier || 'Common'; cw.appendChild(tsel); db.appendChild(cw);
        db.appendChild(mk('div', 'rch-label rch-mt', 'Helmet description'));
        var ds = mk('textarea', 'rch-desc'); ds.maxLength = 200; ds.rows = 3; ds.value = p.description || ''; ds.placeholder = 'Optional. A short note about this helmet (200 characters at most).'; db.appendChild(ds);
        var kh = mk('p', 'rch-hint'); db.appendChild(kh);
        // Give to: every member with a checkbox (special event, premium and award helmets only). Group access that is already set is kept as it is.
        var gw = mk('div'); gw.appendChild(mk('div', 'rch-label rch-mt', 'Give to'));
        var gbody = mk('div'); gbody.appendChild(spin('Loading...')); gw.appendChild(gbody); db.appendChild(gw);
        var groupsKeep = [], profOn = {}, grantsLoaded = false;
        Promise.all([fetchApi('adminListHelmetMembers', { token: token }), fetchApi('adminListHelmetGrants', { token: token, params: { presetId: p.presetId } })]).then(function (rr) {
          gbody.innerHTML = '';
          var mres = rr[0], gres = rr[1];
          if (!mres || !mres.success || !gres || !gres.success) { gbody.appendChild(mk('p', 'rch-hint', 'Could not load the member list, so access will not be changed.')); return; }
          groupsKeep = gres.groups || [];
          (gres.profiles || []).forEach(function (x) { profOn[x] = true; });
          var listEl = mk('div', 'rch-memberlist'); gbody.appendChild(listEl);
          (mres.members || []).forEach(function (mem) {
            var lab = mk('label', 'rch-check'); var cb = mk('input'); cb.type = 'checkbox'; cb.checked = !!profOn[mem.profileId];
            cb.onchange = function () { profOn[mem.profileId] = cb.checked; };
            lab.appendChild(cb); lab.appendChild(mk('span', null, esc(mem.name) + ' <span class="rch-psub">' + esc(mem.role) + (mem.username ? ' - ' + esc(mem.username) : '') + '</span>')); listEl.appendChild(lab);
          });
          if (!listEl.children.length) listEl.appendChild(mk('p', 'rch-hint', 'No members yet.'));
          grantsLoaded = true;
        }).catch(function () { gbody.innerHTML = ''; gbody.appendChild(mk('p', 'rch-hint', 'No answer from the server, so access will not be changed.')); });
        function sync() { cw.style.display = COLL_KINDS.indexOf(k.value) >= 0 ? '' : 'none'; gw.style.display = COLL_KINDS.indexOf(k.value) >= 0 ? '' : 'none'; var isM = k.value === 'Manufacturer'; mw.style.display = isM ? '' : 'none'; n.disabled = isM; if (isM) n.value = m.value; kh.textContent = KIND_HINTS[k.value] || ''; }
        k.onchange = sync; m.onchange = sync; sync();
        var bt2 = mk('div', 'rch-btns rch-mt');
        var sv2 = btn('Save', 'rc-btn-primary rc-btn-sm'), cn2 = btn('Cancel', 'rc-btn-secondary rc-btn-sm');
        bt2.appendChild(sv2); bt2.appendChild(cn2); db.appendChild(bt2);
        cn2.onclick = function () { dm.close(); };
        function busy(on) { sv2.disabled = on; cn2.disabled = on; sv2.textContent = on ? 'Saving...' : 'Save'; dm.closeBtn.disabled = on; dm.closeBtn.style.opacity = on ? '0.35' : ''; dm.closeBtn.style.pointerEvents = on ? 'none' : ''; }
        sv2.onclick = function () {
          var kind = k.value, mfr = kind === 'Manufacturer' ? m.value : '', name = kind === 'Manufacturer' ? mfr : n.value.trim(), desc = ds.value.slice(0, 200), coll = COLL_KINDS.indexOf(kind) >= 0 ? cpk.get() : '', tier = COLL_KINDS.indexOf(kind) >= 0 ? tsel.value : 'Common';
          if (kind === 'Manufacturer' && !mfr) { toast('Choose a manufacturer for a Manufacturer helmet.', 'error'); return; }
          if (!name) { toast('Give the helmet a name first.', 'error'); n.focus(); return; }
          var slotChanged = (kind === 'Website Default' || kind === 'Manufacturer') && (kind !== p.kind || mfr !== (p.manufacturer || ''));
          var old = slotChanged ? (list || []).filter(function (x) { return x.active && x.presetId !== p.presetId && x.kind === kind && (kind === 'Website Default' || x.manufacturer === mfr); })[0] : null;
          function run() {
            busy(true);
            fetchApi('adminSaveHelmetPreset', { method: 'POST', token: token, body: { presetId: p.presetId, collection: coll, tier: tier, description: desc, name: name, kind: kind, manufacturer: mfr, recipe: JSON.stringify(H.normalizeRecipe(p.recipe)) } }).then(function (r) {
              if (!r || !r.success) { busy(false); toast((r && r.message) || 'Could not save.', 'error'); return; }
              if (cur.id === p.presetId) { cur.name = name; cur.kind = kind; cur.mfr = mfr; cur.desc = desc; cur.coll = coll; cur.tier = tier; cur.saved = { name: name, kind: kind, mfr: mfr, desc: desc, coll: coll, tier: tier }; syncMeta(); }
              refreshPresets();
              function finish() { toast('Saved.', 'success'); dm.close(); if (after) after(); }
              if (!(grantsLoaded && COLL_KINDS.indexOf(kind) >= 0)) { finish(); return; }
              fetchApi('adminSaveHelmetGrants', { method: 'POST', token: token, body: {
                presetId: p.presetId, groups: JSON.stringify(groupsKeep),
                profiles: JSON.stringify(Object.keys(profOn).filter(function (x) { return profOn[x]; }))
              } }).then(function (g) {
                if (g && g.success) finish();
                else { busy(false); toast('The details were saved, but access could not be saved: ' + ((g && g.message) || 'try again.'), 'error'); }
              }).catch(function () { busy(false); toast('The details were saved, but access could not be saved (no answer from the server).', 'error'); });
            }).catch(function () { busy(false); toast('No answer from the server.', 'error'); });
          }
          if (old) confirmBox(kind === 'Website Default' ? 'Replace the Website Default?' : 'Replace the ' + mfr + ' helmet?',
            (kind === 'Website Default' ? 'A Website Default helmet ("' + old.name + '") already exists.' : 'The ' + mfr + ' helmet already exists.') + ' Do you want to make this one the replacement? The older one will be archived.',
            [{ label: 'Replace it', primary: true, fn: run }, { label: 'Cancel' }]);
          else run();
        };
      }

      /* ---------------- Open popup: every saved design, with Open, Edit Details, Archive (and Restore, Delete Forever for archived ones) ---------------- */
      function openManage() {
        var mb = mk('div', 'rch-loadbody');
        var mm = ctx.showModal(only ? 'Manage Helmet Designs' : 'Open Helmet Design', { bodyEl: mb, wide: true, accentHead: true });
        function load() {
          mb.innerHTML = ''; mb.appendChild(spin('Loading...'));
          fetchApi('adminListHelmetPresets', { token: token, params: { includeArchived: '1' } }).then(function (res) {
            mb.innerHTML = '';
            if (!res || !res.success) { mb.appendChild(mk('p', 'rch-hint', 'Could not load: ' + esc((res && res.message) || 'no answer.'))); return; }
            var list = res.presets || [];
            mb.appendChild(mk('p', 'rch-hint', 'Open loads a design into the studio. Edit Details changes its name, category, description and who it is given to (not the design). Archive hides it from new use, and members who already have it keep it. Delete Forever removes it everywhere, including from member profiles.'));
            if (!list.length) { mb.appendChild(mk('p', 'rch-hint', 'Nothing saved yet. Design a helmet and press Save.')); return; }
            KINDS.forEach(function (k) {
              var rows = list.filter(function (p) { return p.kind === k; });
              if (!rows.length) return;
              mb.appendChild(mk('div', 'rch-label rch-mt', esc(k)));
              eachGroup(rows, function (gl, grp) { if (gl) mb.appendChild(mk('div', 'rch-psub rch-collhead', esc(gl))); grp.forEach(function (p) {
                var row = mk('div', 'rch-loadrow' + (p.active ? '' : ' rch-archived'));
                var th = mk('div', 'rch-thumb'); row.appendChild(th); renderThumb(th, p.recipe, 140);
                var info = mk('div', 'rch-info');
                info.appendChild(mk('div', 'rch-pname', esc(p.name) + (p.active ? '' : ' (archived)')));
                var bits = [];
                if (p.kind === 'Manufacturer') bits.push(p.manufacturer);
                if (p.kind !== 'Website Default' && p.kind !== 'Manufacturer') { bits.push(p.grantCount ? ('given to ' + p.grantCount + (p.grantCount === 1 ? ' group or member' : ' groups and members')) : (p.everGiven ? 'access taken back' : 'not given to anyone yet')); }
                info.appendChild(mk('div', 'rch-psub', esc(bits.filter(Boolean).join(' - '))));
                row.appendChild(info);
                var act = mk('div', 'rch-btns');
                function home() {
                  act.innerHTML = '';
                  if (p.active) {
                    if (!only) { var op = btn('Open'); op.onclick = function () { loadWithCheck(p, function () { mm.close(); }); }; act.appendChild(op); }
                    var ed = btn('Edit Details'); ed.onclick = function () { openDetails(p, list, load); };
                    act.appendChild(ed);
                    var ar = btn('Archive'); ar.onclick = function () { confirmRow('Archive it?', 'Yes, archive', function (done) {
                      fetchApi('adminSetHelmetPresetActive', { method: 'POST', token: token, body: { presetId: p.presetId, active: 'Inactive' } }).then(function (r2) { done(r2 && r2.success, r2 && r2.message); load(); }).catch(function () { done(false); });
                    }); };
                    act.appendChild(ar);
                  } else {
                    // archived: Restore or Delete Forever (both fully usable)
                    var rs2 = btn('Restore', 'rc-btn-primary rc-btn-sm rc-btn-row');
                    rs2.onclick = function () { rs2.disabled = true; fetchApi('adminSetHelmetPresetActive', { method: 'POST', token: token, body: { presetId: p.presetId, active: 'Active' } }).then(function (r2) { if (r2 && r2.success) { toast('Restored.', 'success'); load(); } else { rs2.disabled = false; toast((r2 && r2.message) || 'Could not restore it.', 'error'); } }).catch(function () { rs2.disabled = false; toast('No answer from the server.', 'error'); }); };
                    act.appendChild(rs2);
                    var dl = btn('Delete Forever');
                    dl.onclick = function () { confirmRow('Delete it forever? It will disappear from every profile.', 'Yes, delete forever', function (done) {
                      fetchApi('adminDeleteHelmetPreset', { method: 'POST', token: token, body: { presetId: p.presetId } }).then(function (r2) { done(r2 && r2.success, r2 && r2.message); if (r2 && r2.success) { if (cur.id === p.presetId) { cur.id = ''; cur.saved = null; syncMeta(); } try { localStorage.removeItem('rcHelmetVerChecked'); } catch (e3) {} load(); } }).catch(function () { done(false); });
                    }); };
                    act.appendChild(dl);
                  }
                }
                function confirmRow(question, yesLabel, run) {
                  act.innerHTML = ''; act.appendChild(mk('span', 'rch-psub', question));
                  var yes = btn(yesLabel, 'rc-btn-primary rc-btn-sm rc-btn-row'), no = btn('Keep');
                  yes.onclick = function () { yes.disabled = true; run(function (ok, msg) { if (!ok) { yes.disabled = false; toast(msg || 'That did not work.', 'error'); } else toast('Done.', 'success'); }); };
                  no.onclick = home;
                  act.appendChild(yes); act.appendChild(no);
                }
                home(); row.appendChild(act); mb.appendChild(row);
              }); });
            });
          }).catch(function () { mb.innerHTML = ''; mb.appendChild(mk('p', 'rch-hint', 'No answer from the server.')); });
        }
        load();
      }
      loadBtn.onclick = openManage;

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
            var up = btn('Upload Logo'); up.onclick = function () { openLogoForm(null, all, function () { load(); reloadLogoAssets(); }); };
            top.style.justifyContent = 'flex-end'; top.appendChild(up); lb.appendChild(top);
            if (!all.length) { lb.appendChild(mk('p', 'rch-hint', 'No logos yet. Press Upload Logo.')); return; }
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
                info.appendChild(mk('div', 'rch-psub', esc((l.uploaded ? 'Uploaded' : 'File: ' + l.file))));
                row.appendChild(info);
                var act = mk('div', 'rch-btns');
                function home() {
                  act.innerHTML = '';
                  if (l.active) {
                    var ed = btn('Edit'); ed.onclick = function () { openLogoForm(l, all, function () { load(); reloadLogoAssets(); }); }; act.appendChild(ed);
                    var ar = btn('Archive'); ar.onclick = function () { ask('Archive it?', 'Yes, archive', function (d) { fetchApi('adminSetHelmetLogoActive', { method: 'POST', token: token, body: { logoId: l.id, active: 'Inactive' } }).then(function (r) { d(r && r.success, r && r.message); if (r && r.success) { load(); reloadLogoAssets(); } }).catch(function () { d(false); }); }); }; act.appendChild(ar);
                  } else {
                    var rs3 = btn('Restore', 'rc-btn-primary rc-btn-sm rc-btn-row');
                    rs3.onclick = function () { rs3.disabled = true; fetchApi('adminSetHelmetLogoActive', { method: 'POST', token: token, body: { logoId: l.id, active: 'Active' } }).then(function (r) { if (r && r.success) { load(); reloadLogoAssets(); } else { rs3.disabled = false; toast((r && r.message) || 'Could not restore it.', 'error'); } }).catch(function () { rs3.disabled = false; }); };
                    act.appendChild(rs3);
                    var dl = btn('Delete Forever');
                    dl.onclick = function () { ask('Delete it forever? It will disappear from every helmet.', 'Yes, delete forever', function (d) { fetchApi('adminDeleteHelmetLogo', { method: 'POST', token: token, body: { logoId: l.id } }).then(function (r) { d(r && r.success, r && r.message); if (r && r.success) { try { localStorage.removeItem('rcHelmetVerChecked'); } catch (e4) {} load(); reloadLogoAssets(); } }).catch(function () { d(false); }); }); };
                    act.appendChild(dl);
                  }
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

      // Add / edit one logo: picture, name and category. A logo always lands on a helmet the same way a shape does.
      function openLogoForm(logo, existing, done) {
        var isNew = !logo;
        var d = { name: logo ? logo.name : '', category: logo ? (logo.category || '') : '' };
        var data = '';                          // a newly picked picture
        var fb = mk('div', 'rch-logoform');
        var fm = ctx.showModal(isNew ? 'Upload Logo' : 'Edit Logo', { bodyEl: fb, accentHead: true });
        fb.appendChild(mk('div', 'rch-label', isNew ? 'Picture (PNG, WebP or JPEG; transparent PNG works best)' : 'Replace picture (optional)'));
        var fi = mk('input'); fi.type = 'file'; fi.accept = 'image/png,image/webp,image/jpeg'; fb.appendChild(fi);
        var fstat = mk('p', 'rch-hint'); fb.appendChild(fstat);
        var pvBox = mk('div', 'rch-logopreview'); var pvImg = new Image(); pvImg.alt = ''; pvBox.appendChild(pvImg); fb.appendChild(pvBox);   // the picture, between the file box and the Name
        if (logo) { pvImg.src = logo.data || ('assets/helmets/images/' + logo.file); } else pvBox.style.display = 'none';
        fb.appendChild(mk('div', 'rch-label rch-mt', 'Name'));
        var nm = mk('input', 'rch-input'); nm.type = 'text'; nm.maxLength = 60; nm.value = d.name; nm.placeholder = 'e.g. Race Club logo'; nm.oninput = function () { d.name = nm.value; };
        fb.appendChild(nm);
        fb.appendChild(mk('div', 'rch-label rch-mt', 'Category (the group it is listed under in the designer)'));
        var cp = catPicker((existing || []).map(function (l) { return l.category; }), d.category); fb.appendChild(cp.el);

        var bt = mk('div', 'rch-btns rch-mt');
        var sv = btn('Save Logo', 'rc-btn-primary rc-btn-sm'), cn = btn('Cancel', 'rc-btn-secondary rc-btn-sm');
        var arB = (!isNew && logo.active) ? btn('Archive', 'rc-btn-secondary rc-btn-sm') : null;
        bt.appendChild(sv); if (arB) bt.appendChild(arB); bt.appendChild(cn); fb.appendChild(bt);
        function setBusy(on, label) { sv.disabled = on; sv.textContent = on ? (label || 'Saving...') : 'Save Logo'; cn.disabled = on; if (arB) arB.disabled = on; fm.closeBtn.disabled = on; fm.closeBtn.style.opacity = on ? '0.35' : ''; fm.closeBtn.style.pointerEvents = on ? 'none' : ''; }
        cn.onclick = function () { fm.close(); };
        fi.onchange = function () {
          var f = fi.files && fi.files[0]; if (!f) return;
          fstat.textContent = 'Shrinking the picture...';
          processImage(f).then(function (out) {
            data = out; pvImg.src = out; pvBox.style.display = ''; fstat.textContent = 'Ready (' + Math.round(out.length / 1024) + ' KB after shrinking).';
            if (!d.name) { d.name = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '); nm.value = d.name; }
          }).catch(function (e) { data = ''; fstat.textContent = e.message; });
        };
        if (arB) arB.onclick = function () {
          confirmBox('Archive this logo?', 'It will no longer be offered in the designer, but helmets that already use it keep it. You can restore it later in Manage Logos.', [
            { label: 'Archive', primary: true, fn: function () {
              setBusy(true, 'Archiving...');
              fetchApi('adminSetHelmetLogoActive', { method: 'POST', token: token, body: { logoId: logo.id, active: 'Inactive' } }).then(function (r) {
                if (r && r.success) { toast('Logo archived.', 'success'); fm.close(); if (done) done(); }
                else { setBusy(false); toast((r && r.message) || 'Could not archive it.', 'error'); }
              }).catch(function () { setBusy(false); toast('No answer from the server.', 'error'); });
            } },
            { label: 'Cancel' }]);
        };
        sv.onclick = function () {
          if (!d.name.trim()) { toast('Give the logo a name.', 'error'); nm.focus(); return; }
          if (isNew && !data) { toast('Choose a picture first.', 'error'); return; }
          setBusy(true);
          fetchApi('adminSaveHelmetLogo', { method: 'POST', token: token, body: {
            logoId: logo ? logo.id : '', name: d.name.trim(), category: cp.get(), data: data,
            defX: '640', defY: '770', defW: '220', defH: '220', defR: '0', shadow: '0'
          } }).then(function (r) {
            if (r && r.success) { toast('Logo saved.', 'success'); fm.close(); if (done) done(); }
            else { setBusy(false); toast((r && r.message) || 'Could not save the logo.', 'error'); }
          }).catch(function () { setBusy(false); toast('No answer from the server.', 'error'); });
        };
      }

      refreshPresets();
      syncMeta(); draw();
      if (stub) stub.close();
      if (only === 'manage') openManage(); else if (only === 'logos') openLogoManager();
    }
  }

  window.RCHelmetEditor = { openDesigner: openDesigner };
})();
