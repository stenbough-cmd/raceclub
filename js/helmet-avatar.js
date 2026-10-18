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

  function recipeOf(v) {
    if (typeof v !== 'string' || v.indexOf(PREFIX) !== 0) return null;
    try { var r = JSON.parse(v.slice(PREFIX.length)); return (r && typeof r === 'object') ? r : null; } catch (e) { return null; }
  }
  function valueOf(r) {
    if (!r) return '';
    return PREFIX + JSON.stringify({ d: r.d, b: r.b, a1: r.a1, a2: r.a2, v: r.v });
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

  function assetsPromise() {
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem('rcHelmetAssets') || 'null'); } catch (e) { cached = null; }
    var fresh = (typeof fetchApi === 'function')
      ? fetchApi('getHelmetAssets', {}).then(function (res) {
          if (res && res.success) {
            var slim = { designs: res.designs || [], logos: res.logos || [], manufacturers: res.manufacturers || [] };
            try { localStorage.setItem('rcHelmetAssets', JSON.stringify(slim)); } catch (e2) {}
            return slim;
          }
          throw new Error('no assets');
        })
      : Promise.reject(new Error('no fetchApi'));
    if (cached && cached.designs && cached.designs.length) { fresh.catch(function () {}); return Promise.resolve(cached); }   // paint now, refresh for next time
    return fresh;
  }

  function freshAssets() {
    return fetchApi('getHelmetAssets', {}).then(function (res) {
      if (!res || !res.success) throw new Error('no assets');
      var slim = { designs: res.designs || [], logos: res.logos || [], manufacturers: res.manufacturers || [] };
      try { localStorage.setItem('rcHelmetAssets', JSON.stringify(slim)); } catch (e) {}
      return slim;
    });
  }

  var readyP = null;
  function ensure() {
    if (!readyP) {
      readyP = (window.RCHelmet ? Promise.resolve() : loadScript('js/helmet.js?v=5')).then(assetsPromise).then(function (a) {
        window.RCHelmet.configure({ designs: a.designs, logos: a.logos, manufacturers: a.manufacturers });
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
        var rec = recipeOf(value) || H.defaultRecipe();
        return H.render(rec, { width: w * 2 }).then(function (cv) {
          cv.style.width = w + 'px'; cv.style.height = 'auto';
          n.innerHTML = ''; n.appendChild(cv);
          try { sessionStorage.setItem(rcHelmetCacheKey_(value, w), cv.toDataURL('image/png')); } catch (e) {}
        });
      }));
    }).catch(function () { nodes.forEach(function (n) { n.removeAttribute('data-rc-done'); }); });
  }

  /* ---- Customize Helmet: open the popup, save the result ---- */
  function customize(o) {
    var profile = o.profile, token = o.token, showModal = o.showModal, toast = o.showToast || window.showToast || function () {};
    var tried = [];
    loadCss('css/helmet.css?v=3');
    return Promise.all([ensure(), loadScript('js/helmet-player.js?v=3')]).then(function (res) {
      var H = res[0];
      // The popup always asks the server for the current design list (the saved copy used for the
      // header can be out of date, for example after a design file or sheet row changes).
      return freshAssets().then(function (a) {
        H.configure({ designs: a.designs, logos: a.logos, manufacturers: a.manufacturers });
      }).catch(function () {}).then(function () { tried = H.getConfig().designs.slice(); return H.pruneDesigns(); }).then(function () {
        window.RCHelmetPlayer.open({
          recipe: recipeOf(profile.avatarFilename),
          tried: tried,
          showModal: showModal,
          showToast: toast,
          onSave: function (recipe) { save(recipe ? valueOf(recipe) : ''); }
        });
      });
    }).catch(function () { toast('Could not open the helmet customizer. Check your connection and try again.', 'error'); });

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
