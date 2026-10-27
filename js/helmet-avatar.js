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
    if (r.logos && r.logos.length) { o.l = r.logos.slice(0, 25); if (r.ac > 0) o.ac = r.ac; }   // ac = layers that sit under the accent paint
    if (r.t) { o.t = 1; if (r.m) o.m = r.m; if (r.a) o.a = 1; }   // a = "always use my team's helmet" is switched on
    if (r.w) o.w = 1;                         // the website default helmet, chosen while the member also has their own design saved (k)
    if (r.pl && r.pl.n) o.pl = { n: String(r.pl.n).slice(0, 40), c: String(r.pl.c || '').slice(0, 60), u: String(r.pl.u || '').slice(0, 4) };   // name + country for the Player Name and Flag box
    if (r.p) o.p = r.p;                       // an award / special helmet design the member was given
    if ((r.t || r.p || r.w) && r.k && typeof r.k === 'object') o.k = r.k;   // their own customized helmet, restored if they lose the team helmet
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
    else if (r.w && assets.def) cur = assets.def;
    if (!cur && r.sg) return null;   // sg = staged demo driver: no saved team helmet for this manufacturer, so use the website default helmet
    if (!cur) return r;
    var o = {}, k;
    for (k in cur) if (Object.prototype.hasOwnProperty.call(cur, k)) o[k] = cur[k];
    if (r.l && !o.logos) { o.logos = r.l; if (r.ac) o.ac = r.ac; }
    if (r.pl) o.pl = r.pl;
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
      readyP = (window.RCHelmet ? Promise.resolve() : loadScript('js/helmet.js?v=46')).then(assetsPromise).then(function (a) {
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
      return loadScript('js/helmet-player.js?v=28').then(function () { return H; });
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
          player: { n: profile.displayName || profile.username || '', c: profile.location || '', u: (teamInfo && teamInfo.carNumber) || '' },
          awarded: (teamInfo && teamInfo.awarded) || [],
          websiteDefault: (assets && assets.def) ? { name: assets.defName || 'Website helmet', recipe: assets.def } : null,   // listed under Website while the member has not saved their own helmet
          teamInfo: teamInfo,
          teamOn: !!(own && own.t),
          tried: tried,
          showModal: showModal,
          shell: shell,
          showToast: toast,
          onSave: function (recipe) { return save(recipe ? valueOf(recipe) : ''); }   // a promise: true when saved
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
      return fetchApi('updateOwnProfile', {
        method: 'POST', token: token,
        body: {
          username: profile.username, firstName: profile.firstName, lastName: profile.lastName,
          suffix: profile.suffix || '', email: profile.email, location: profile.location || '',
          timeZone: profile.timeZone || '', avatarFilename: newValue
        }
      }).then(function (data) {
        if (!data || !data.success) { revert((data && data.message) || 'Could not save your helmet -- reverted.'); return false; }
        if (typeof setProfileCache === 'function') setProfileCache(data.profile);
        if (typeof renderHeader === 'function') renderHeader();
        toast('Helmet saved.', 'success');
        return true;
      }).catch(function () { revert('Could not reach the server -- helmet change reverted.'); return false; });

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
  // "Always use team helmet" button: on = the member's helmet is their manufacturer's helmet and follows them to a new manufacturer.
  // Resolves to true (now on), false (now off) or null (could not change it). o = { profile, token, toast, onChange }.
  window.rcHelmetToggleTeamNow_ = function (o) {
    var profile = o.profile, token = o.token, toast = o.toast || function () {};
    var cur = recipeOf(profile.avatarFilename), turningOn = !(cur && cur.t && cur.a);
    function put(value) {
      var previous = profile.avatarFilename;
      profile.avatarFilename = value;
      return fetchApi('updateOwnProfile', { method: 'POST', background: true, token: token, body: {
        username: profile.username, firstName: profile.firstName, lastName: profile.lastName, suffix: profile.suffix || '', email: profile.email,
        location: profile.location || '', timeZone: profile.timeZone || '', avatarFilename: value } }).then(function (d) {
        if (!d || !d.success) { profile.avatarFilename = previous; toast((d && d.message) || 'Could not save your helmet.', 'error'); return null; }
        if (typeof setProfileCache === 'function') setProfileCache(d.profile);
        if (typeof renderHeader === 'function') renderHeader();
        if (o.onChange) o.onChange(profile);
        return turningOn;
      }).catch(function () { profile.avatarFilename = previous; toast('Could not reach the server.', 'error'); return null; });
    }
    if (!turningOn) { cur.a = 0; return put(valueOf(cur)); }
    return ensure().then(function (H) {
      return fetchApi('getMyTeamHelmet', { token: token }).then(function (res) {
        if (!res || !res.success || !res.recipe || !res.manufacturer) { toast('You need a team seat with a manufacturer helmet to use this.', 'error'); return null; }
        var rec = H.normalizeRecipe(res.recipe);
        rec.t = 1; rec.m = res.manufacturer; rec.a = 1;
        // keep their own design so it is not lost (it comes back under "Your Design")
        var k = null;
        if (cur && !cur.t && !cur.p && !cur.w) { k = { d: cur.d, b: cur.b, a1: cur.a1, a2: cur.a2, v: cur.v }; if (cur.logos && cur.logos.length) { k.l = cur.logos.slice(0, 25); if (cur.ac > 0) k.ac = cur.ac; } if (cur.pl) k.pl = cur.pl; }
        else if (cur && cur.k) k = cur.k;
        if (k) rec.k = k;
        if ((rec.logos || []).some(function (l) { return l && /^player/.test(l.s || ''); })) rec.pl = { n: profile.displayName || profile.username || '', c: profile.location || '', u: res.carNumber || '' };
        return put(valueOf(rec));
      });
    }).catch(function () { toast('Could not reach the server.', 'error'); return null; });
  };
  // The helmet list changed: fetch the new designs (this also stores the new version number) and draw every helmet again.
  window.rcHelmetRefreshNow_ = function () {
    return (window.RCHelmet ? Promise.resolve() : loadScript('js/helmet.js?v=46')).then(function () { return freshAssets(); }).then(function () { redrawAll(); });
  };
  // Older team-helmet avatars have no manufacturer saved in them, so they cannot pick up later edits to that manufacturer's helmet. Ask the
  // server which manufacturer the member's seat belongs to and save it into the avatar (once).
  window.rcHelmetHealNow_ = function () {
    var prof = (typeof getProfileCache === 'function') ? getProfileCache() : null, token = (typeof getToken === 'function') ? getToken() : null;
    if (!prof || !token) return Promise.resolve();
    var r = recipeOf(prof.avatarFilename);
    if (!r || !r.t || r.m) return Promise.resolve();
    return fetchApi('getMyTeamHelmet', { token: token }).then(function (res) {
      if (!res || !res.success || !res.manufacturer) return;
      r.m = res.manufacturer;
      var nv = valueOf(r);
      return fetchApi('updateOwnProfile', { method: 'POST', token: token, body: {
        username: prof.username, firstName: prof.firstName, lastName: prof.lastName, suffix: prof.suffix || '', email: prof.email,
        location: prof.location || '', timeZone: prof.timeZone || '', avatarFilename: nv } }).then(function (d) {
        if (d && d.success) { if (typeof setProfileCache === 'function') setProfileCache(d.profile); redrawAll(); }
      });
    }).catch(function () {});
  };
  window.rcHelmetCustomizeNow_ = customize;
})();
