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
