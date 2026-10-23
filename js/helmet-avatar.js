/* =====================================================================
   Race Club -- helmet avatars  (js/helmet-avatar.js)
   ---------------------------------------------------------------------
   A driver's helmet is stored in their existing profile field (avatarFilename) as the text
   "helmet:" followed by a small JSON recipe. Anything else in that field (empty, an old
   avatar file name) just means "no helmet designed yet": the default helmet is shown.

   js/header.js (loaded on every page) defines rcHelmetHtml_(value,width,cls), rcHelmetHydrate_(root)
   and rcHelmetCustomize_(opts); they load THIS file on demand and call its ...Now_ functions.
     rcHelmetRecipeOf_(value) -> recipe object, or null     rcHelmetValue_(recipe) -> text to store
   ===================================================================== */
(function () {
  'use strict';
  var PREFIX = 'helmet:';

  // Stored text: {d,b,a1,a2,v} plus optional  l = logos carried by the default / team helmet (players cannot edit them)
  // p = the award helmet's id (used exactly as designed), and  t = 1 when "Match my helmet to my current team" is ticked.
  function recipeOf(v) {
    if (typeof v !== 'string' || v.indexOf(PREFIX) !== 0) return null;
    try {
      var r = JSON.parse(v.slice(PREFIX.length));
      if (!r || typeof r !== 'object') return null;
      if (r.l && r.l.length) r.logos = r.l;
      return r;
    } catch (e) { return null; }
  }
  function valueOf(r) {
    if (!r) return '';
    var o = { d: r.d, b: r.b, a1: r.a1, a2: r.a2, v: r.v };
    if (r.logos && r.logos.length) o.l = r.logos.slice(0, 20);
    if (r.t) { o.t = 1; if (r.m) o.m = r.m; }
    if (r.p) o.p = r.p;                       // an award / special helmet design the member was given
    if (r.t && r.k && typeof r.k === 'object') o.k = r.k;   // their own customized helmet, restored if they lose the team helmet
    return PREFIX + JSON.stringify(o);
  }

  /* ---- loading ---- */
  var loading = {};
  function loadScript(src) {
    if (!loading[src]) {
      loading[src] = new Promise(function (res, rej) {
        var s = document.createElement('script'); s.src = src; s.async = true;
        s.onload = function () { res(); };
        s.onerror = function () { delete loading[src]; rej(new Error('Could not load ' + src)); };
        document.head.appendChild(s);
      });
    }
    return loading[src];
  }
  function loadCss(href) {
    if (document.querySelector('link[data-rch-css]')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-rch-css', '1');
    document.head.appendChild(l);
  }

  // ---- design list + default helmet (from the HelmetAssets / HelmetPresets sheet tabs) ----
  var assets = null;   // { designs, logos, manufacturers, def }  def = the saved "Website Default" helmet, or null
  function slimOf(res) { return { designs: res.designs || [], logos: res.logos || [], manufacturers: res.manufacturers || [], def: res.defaultRecipe || null, defName: res.defaultName || '', ver: res.helmetVersion || '', byId: res.presetsById || {}, byMaker: res.presetsByMaker || {} }; }
  function sigOf(a) { return JSON.stringify([a.ver, a.designs, a.def, (a.logos || []).map(function (l) { return [l.id || l.file, l.active, (l.data || '').length]; })]); }
  function hash(str) { var h = 0, i; for (i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0; return String(h); }
  function apply(a) {
    assets = a;
    window.RCHelmet.configure({ designs: a.designs, logos: a.logos, manufacturers: a.manufacturers });
    try { localStorage.setItem('rcHelmetDefSig', hash(sigOf(a))); localStorage.setItem('rcHelmetVer', a.ver || ''); } catch (e) {}
  }
  function store(a) { try { localStorage.setItem('rcHelmetAssets', JSON.stringify(a)); } catch (e) {} }
  function fetchAssets() {
    if (typeof fetchApi !== 'function') return Promise.reject(new Error('no fetchApi'));
    return fetchApi('getHelmetAssets', {}).then(function (res) {
      if (!res || !res.success) throw new Error('no assets');
      return slimOf(res);
    });
  }
  // An award or team helmet saved on a member keeps the design it had when chosen. If that helmet has since been edited, draw the
  // newest design instead (the member's saved text is not touched).
  function liveRecipe(r) {
    if (!r || !assets) return r;
    var cur = null;
    if (r.p && assets.byId) cur = assets.byId[r.p];
    else if (r.t && r.m && assets.byMaker) cur = assets.byMaker[r.m];
    if (!cur) return r;
    var o = {}, k;
    for (k in cur) if (Object.prototype.hasOwnProperty.call(cur, k)) o[k] = cur[k];
    if (r.l && !o.logos) o.logos = r.l;
    return window.RCHelmet && window.RCHelmet.normalizeRecipe ? window.RCHelmet.normalizeRecipe(o) : o;
  }
  function defaultRecipe() { return (assets && assets.def) ? assets.def : window.RCHelmet.defaultRecipe(); }

  // Throws away every drawn helmet and draws them again (used when the design list or default helmet changed).
  function redrawAll() {
    try { Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf('rch') === 0) sessionStorage.removeItem(k); }); } catch (e) {}
    Array.prototype.forEach.call(document.querySelectorAll('[data-rc-helmet]'), function (n) { n.removeAttribute('data-rc-done'); n.innerHTML = ''; });
    hydrate(document);
  }

  function assetsPromise() {
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem('rcHelmetAssets') || 'null'); } catch (e) { cached = null; }
    var haveCache = !!(cached && cached.designs && cached.designs.length);
    var fresh = fetchAssets().then(function (a) {
      store(a);
      if (haveCache && sigOf(a) !== sigOf(cached) && window.RCHelmet) { apply(a); redrawAll(); }   // the saved copy was out of date
      return a;
    });
    if (haveCache) { fresh.catch(function () {}); return Promise.resolve(cached); }   // paint now, refresh in the background
    return fresh;
  }

  function freshAssets() {
    return fetchAssets().then(function (a) { store(a); apply(a); return a; });
  }

  var readyP = null;
  function ensure() {
    if (!readyP) {
      readyP = (window.RCHelmet ? Promise.resolve() : loadScript('js/helmet.js?v=17')).then(assetsPromise).then(function (a) {
        apply(a);
        return window.RCHelmet;
      });
      readyP.catch(function () { readyP = null; });
    }
    return readyP;
  }

  /* ---- placeholders (rcHelmetHtml_ / rcHelmetCacheKey_ live in js/header.js so the header can use them at once) ---- */
  function hydrate(root) {
    var nodes = Array.prototype.slice.call((root || document).querySelectorAll('[data-rc-helmet]:not([data-rc-done])'));
    if (!nodes.length) return Promise.resolve();
    nodes.forEach(function (n) { n.setAttribute('data-rc-done', '1'); });
    return ensure().then(function (H) {
      return Promise.all(nodes.map(function (n) {
        var value = n.getAttribute('data-rc-helmet'), w = parseInt(n.getAttribute('data-w'), 10) || 60;
        var rec = liveRecipe(recipeOf(value)) || defaultRecipe();
        return H.render(rec, { width: w * 2 }).then(function (cv) {
          cv.style.width = w + 'px'; cv.style.height = 'auto';
          n.innerHTML = ''; n.appendChild(cv);
          try { sessionStorage.setItem(rcHelmetCacheKey_(value, w), cv.toDataURL('image/png')); } catch (e) {}
        });
      }));
    }).catch(function () { nodes.forEach(function (n) { n.removeAttribute('data-rc-done'); }); });
  }

  /* ---- Customize Helmet: open the popup, save the result ---- */
  function customize(o, shell) {
    var profile = o.profile, token = o.token, showModal = o.showModal, toast = o.showToast || window.showToast || function () {};
    var tried = [], teamInfo = null;
    return ensure().then(function (H) {
      return loadScript('js/helmet-player.js?v=20').then(function () { return H; });
    }).then(function (H) {
      // The popup always asks the server for the current design list (the saved copy used for the
      // header can be out of date, for example after a design file or sheet row changes).
      var teamP = fetchApi('getMyTeamHelmet', { token: token }).then(function (res) { teamInfo = (res && res.success) ? res : null; }).catch(function () {});
      return Promise.all([freshAssets().catch(function () {}), teamP]).then(function () { H.configure({ showLocked: profile && profile.role === 'Admin' }); tried = H.getConfig().designs.slice(); return H.pruneDesigns(); }).then(function () {
        var own = recipeOf(profile.avatarFilename), base = own || defaultRecipe();
        window.RCHelmetPlayer.open({
          recipe: base,
          logos: (base.logos && base.logos.length) ? base.logos : [],   // shown only while the design is the one they belong to
          logoD: base.d,
          own: own,
          awarded: (teamInfo && teamInfo.awarded) || [],
          websiteDefault: (assets && assets.def) ? { name: assets.defName || 'Website helmet', recipe: assets.def } : null,   // listed under Website while the member has not saved their own helmet
          teamInfo: teamInfo,
          teamOn: !!(own && own.t),
          tried: tried,
          showModal: showModal,
          shell: shell,
          showToast: toast,
          onSave: function (recipe) { save(recipe ? valueOf(recipe) : ''); }
        });
      });
    }).catch(function () {
      if (shell && shell.body) { shell.body.innerHTML = ''; var p = document.createElement('p'); p.className = 'rch-hint'; p.textContent = 'Could not open the helmet customizer. Close this and try again.'; shell.body.appendChild(p); }
      else toast('Could not open the helmet customizer. Check your connection and try again.', 'error');
    });

    function save(newValue) {
      var previous = profile.avatarFilename;
      profile.avatarFilename = newValue;
      // instant on screen; the sheet write happens quietly in the background (reverts if it fails)
      if (o.onChange) o.onChange(profile);
      if (typeof setProfileCache === 'function') setProfileCache(profile);
      if (typeof renderHeader === 'function') renderHeader();
      fetchApi('updateOwnProfile', {
        method: 'POST', token: token,
        body: {
          username: profile.username, firstName: profile.firstName, lastName: profile.lastName,
          suffix: profile.suffix || '', email: profile.email, location: profile.location || '',
          timeZone: profile.timeZone || '', avatarFilename: newValue
        }
      }).then(function (data) {
        if (!data || !data.success) { revert((data && data.message) || 'Could not save your helmet -- reverted.'); return; }
        if (typeof setProfileCache === 'function') setProfileCache(data.profile);
        if (typeof renderHeader === 'function') renderHeader();
        toast('Helmet saved.', 'success');
      }).catch(function () { revert('Could not reach the server -- helmet change reverted.'); });

      function revert(msg) {
        profile.avatarFilename = previous;
        if (o.onChange) o.onChange(profile);
        if (typeof setProfileCache === 'function') setProfileCache(profile);
        if (typeof renderHeader === 'function') renderHeader();
        toast(msg, 'error');
      }
    }
  }

  window.rcHelmetRecipeOf_ = recipeOf;
  window.rcHelmetValue_ = valueOf;
  window.rcHelmetHydrateNow_ = hydrate;
  window.rcHelmetCustomizeNow_ = customize;
})();
