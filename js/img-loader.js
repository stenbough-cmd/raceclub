// Race Club image loader -- loads the lightest picture format that exists, on every page.
//
// Order for any local picture (png / jpg / jpeg / webp): .webp first, then .jpg, then .jpeg, then
// .png. Example: code asks for assets/cars/2026-85.png -> the browser first asks for 2026-85.webp;
// if that file does not exist it asks for 2026-85.jpg, then 2026-85.jpeg, then 2026-85.png. Only
// when none of them exist does the picture's own error handling run (for example a hidden
// picture or a text fallback), exactly as before.
//
// How it works, so nothing else on the site has to change:
//  1. Setting img.src (or setAttribute('src')) to a local .png / .jpg / .jpeg / .webp path is
//     rewritten to the .webp version first.
//  2. Pictures that come from HTML text (innerHTML or the page itself) are caught by a
//     MutationObserver and switched the same way.
//  3. A page-wide error listener walks to the next format when a file is missing, and stops the
//     picture's own onerror from firing until every format has been tried.
//  4. What was found for each picture is remembered for the visit, so a picture that only exists
//     as .png is not re-tried through the missing formats every time it is shown.
// SVG files, https:// links (for example a pasted avatar link), data: and blob: sources are left
// alone. CSS background images cannot fall back this way; css files use image-set() instead.
(function () {
  if (window.__rcImgLoader) return;
  window.__rcImgLoader = true;

  var ORDER = ['webp', 'jpg', 'jpeg', 'png'];
  var RASTER = /\.(png|jpe?g|webp)(\?[^#]*)?(#.*)?$/i;
  var known = {};   // base path (no extension) -> the extension that worked
  var origSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  var origSetAttr = Element.prototype.setAttribute;
  if (!origSrc || !origSrc.set) return;

  function isLocal(u) {
    if (!u) return false;
    if (/^(data:|blob:|javascript:|\/\/)/i.test(u)) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) {
      try { return new URL(u, location.href).origin === location.origin; } catch (e) { return false; }
    }
    return true;
  }
  function split(u) {
    var m = RASTER.exec(u);
    if (!m) return null;
    return { base: u.slice(0, m.index), ext: m[1].toLowerCase().replace('jpeg', 'jpeg'), tail: (m[2] || '') + (m[3] || '') };
  }
  function build(parts, ext) { return parts.base + '.' + ext + parts.tail; }

  // Which extension to ask for first for this path.
  function firstExt(parts) { return known[parts.base] || 'webp'; }

  function setSrc(img, value) { origSrc.set.call(img, value); }

  // Called with the url the page asked for. Returns the url to actually load.
  function pick(img, u) {
    if (!isLocal(u)) return u;
    var p = split(u);
    if (!p) return u;
    img.__rcBase = p;
    img.__rcTried = {};
    var ext = firstExt(p);
    img.__rcTried[ext] = true;
    return build(p, ext);
  }

  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    enumerable: origSrc.enumerable,
    get: origSrc.get,
    set: function (v) {
      var s = String(v);
      // Re-assigning the url we are already working through (our own fallback step) goes straight in.
      if (this.__rcSetting) { origSrc.set.call(this, s); return; }
      origSrc.set.call(this, pick(this, s));
    }
  });
  Element.prototype.setAttribute = function (name, value) {
    if (this instanceof HTMLImageElement && String(name).toLowerCase() === 'src') {
      this.src = value;
      return;
    }
    return origSetAttr.call(this, name, value);
  };

  // Remember which format worked.
  document.addEventListener('load', function (e) {
    var img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.__rcBase) return;
    var cur = split(img.currentSrc || img.src || '');
    if (cur) known[img.__rcBase.base] = cur.ext;
  }, true);

  // Missing file: try the next format in the order; only when all are gone let the real error through.
  window.addEventListener('error', function (e) {
    var img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    if (!img.__rcBase) {
      // A picture that came from HTML text and has not been seen yet: start its chain from the url
      // that just failed.
      var raw = img.getAttribute('src') || '';
      if (!isLocal(raw)) return;
      var p0 = split(raw);
      if (!p0) return;
      img.__rcBase = p0;
      img.__rcTried = {};
      img.__rcTried[p0.ext === 'jpg' || p0.ext === 'jpeg' ? p0.ext : p0.ext] = true;
    }
    var parts = img.__rcBase, tried = img.__rcTried || (img.__rcTried = {});
    // Forget a remembered format that turned out to be missing now.
    if (known[parts.base]) {
      var failed = split(img.currentSrc || img.src || '');
      if (failed && known[parts.base] === failed.ext) delete known[parts.base];
    }
    for (var i = 0; i < ORDER.length; i++) {
      var ext = ORDER[i];
      if (tried[ext]) continue;
      tried[ext] = true;
      e.stopImmediatePropagation();
      img.__rcSetting = true;
      try { setSrc(img, build(parts, ext)); } finally { img.__rcSetting = false; }
      return;
    }
    // Every format failed: fall through so the picture's own onerror / fallback runs as before.
  }, true);

  // Pictures written as HTML text (innerHTML, or the page itself): switch them to webp-first.
  function fix(img) {
    if (!(img instanceof HTMLImageElement) || img.__rcBase) return;
    var raw = img.getAttribute('src');
    if (!raw || !isLocal(raw)) return;
    var p = split(raw);
    if (!p) return;
    var next = pick(img, raw);
    if (next !== raw) { img.__rcSetting = true; try { setSrc(img, next); } finally { img.__rcSetting = false; } }
  }
  function scan(node) {
    if (node.nodeType !== 1) return;
    if (node.tagName === 'IMG') fix(node);
    else if (node.querySelectorAll) {
      var list = node.querySelectorAll('img[src]');
      for (var i = 0; i < list.length; i++) fix(list[i]);
    }
  }
  try {
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        for (var j = 0; j < muts[i].addedNodes.length; j++) scan(muts[i].addedNodes[j]);
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (err) { /* very old browser: the setter and error steps still work */ }
})();
