// Race Club -- keeps the site footer at the bottom of the window (Matt, 2026-11-05).
// On a page with little content (a Championship with no running season, a login page...) the footer used to ride up under the content.
// This adds just enough space above the footer to fill the rest of the window, and takes it away again when the page grows. The footer
// is never pulled up above the bottom edge, and nothing is added when the page is already taller than the window.
(function () {
  var footer = null, queued = false;

  // Top of an element measured from the top of the page, whatever is scrolled or positioned.
  function pageTop(node) {
    var y = 0;
    while (node) { y += node.offsetTop || 0; node = node.offsetParent; }
    return y;
  }

  function fit() {
    queued = false;
    if (!footer) return;
    footer.style.marginTop = '';
    // Exact (fractional) position from the page top; while a popup has locked the page scroll, fall back to the whole-pixel measure.
    var locked = document.body.classList.contains('rc-modal-scroll-locked');
    var bottom = locked ? pageTop(footer) + footer.offsetHeight : footer.getBoundingClientRect().bottom + (window.pageYOffset || 0);
    var gap = document.documentElement.clientHeight - bottom;
    if (gap > 0) {
      var current = parseFloat(window.getComputedStyle(footer).marginTop) || 0;
      footer.style.marginTop = (current + gap) + 'px';
    }
  }
  function schedule() {
    if (queued) return;
    queued = true;
    (window.requestAnimationFrame || window.setTimeout)(fit, 0);
  }

  function start() {
    footer = document.querySelector('.rc-site-footer');
    if (!footer) return;
    fit();
    window.addEventListener('resize', schedule);
    window.addEventListener('load', schedule);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(schedule);
      ro.observe(document.body);
      ro.observe(document.documentElement);
    } else if (window.MutationObserver) {
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

// ---- Page centre (Matt, 2026-11-05) ------------------------------------------------------------------------------------------------
// The centre of a page is the band between the bottom of the header / navbar and the top of the footer. This publishes three numbers
// on <html> that the stylesheets use to centre loaders, popups and "nothing here yet" panels inside that band:
//   --rc-band-top     bottom edge of the lowest header / navbar bar, in px from the top of the window
//   --rc-band-bottom  how much of the footer is showing at the bottom of the window (0 when it is off-screen)
//   --rc-footer-h     the footer's full height
(function () {
  var queued = false;
  function barBottom(node) {
    var cs = window.getComputedStyle(node);
    if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
    var r = node.getBoundingClientRect();
    if (!r.height) return 0;
    if (cs.position === 'fixed') return r.bottom;
    if (cs.position === 'sticky') return Math.max(r.bottom, (parseFloat(cs.top) || 0) + r.height);
    return 0;
  }
  function measure() {
    queued = false;
    var top = 0;
    var bars = document.querySelectorAll('#rc-header, .rc-fixed-header, .rc-account-navbar, .rcl-navbar, .rc-profile-navbar');
    for (var i = 0; i < bars.length; i++) top = Math.max(top, barBottom(bars[i]));
    var footer = document.querySelector('.rc-site-footer');
    var bottom = 0, fh = 0;
    if (footer && window.getComputedStyle(footer).display !== 'none') {
      var fr = footer.getBoundingClientRect();
      fh = fr.height;
      var vh = document.documentElement.clientHeight;
      if (fr.top < vh) bottom = vh - Math.max(fr.top, top);
    }
    var root = document.documentElement.style;
    root.setProperty('--rc-band-top', Math.round(top) + 'px');
    root.setProperty('--rc-band-bottom', Math.round(Math.max(0, bottom)) + 'px');
    root.setProperty('--rc-footer-h', Math.round(fh) + 'px');
  }
  function schedule() { if (queued) return; queued = true; (window.requestAnimationFrame || window.setTimeout)(measure, 0); }
  function begin() {
    measure();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('load', schedule);
    if (window.MutationObserver) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin); else begin();
})();
