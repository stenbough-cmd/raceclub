// Race Club -- story preview fitting (js/story-fit.js)
// The newest story on the League Hub and on the Championship page is a preview that ends in "..." and a
// red CONTINUE READING link. It always shows at least the first 1000 characters (the minimum). When the
// Older Stories list beside it is taller than that, the preview grows to the same height, so the two
// columns end together and the story shows more text as the list gets longer. On a narrow window the
// list sits underneath instead, and the preview stays at the minimum.
//
// rcFitStoryPreview({ layout, current, fullLength, minChars, render }):
//   layout      the .rcl-news-layout grid that holds the story and the Older Stories list
//   current     the .rcl-news-current box (heading, text, Continue Reading link)
//   fullLength  the length of the whole story text
//   minChars    the least number of characters the preview shows (1000)
//   render(n)   draws the preview text cut at n characters (word boundary, "..." added by the caller's cutter).
//               n at or above fullLength means the whole story, with no "...".
// It measures, grows the text as far as the list's height allows, and does it again when the window is resized.
var RC_STORY_FIT_ = { timer: 0, jobs: [] };
function rcFitStoryPreview(o) {
  function sideBySide() {
    var cols = String(window.getComputedStyle(o.layout).gridTemplateColumns || '').trim();
    return cols.split(/\s+/).length > 1;
  }
  function fit() {
    if (!o.layout.isConnected) return;
    o.render(o.minChars);
    var prev = o.layout.querySelector('.rcl-news-previous');
    if (!prev || !sideBySide() || o.fullLength <= o.minChars) return;
    var target = Math.max(prev.offsetHeight, o.current.offsetHeight);
    o.render(o.fullLength);
    if (o.current.offsetHeight <= target) return;   // the whole story fits beside the list
    var lo = o.minChars, hi = o.fullLength, guard = 0;
    while (hi - lo > 15 && guard++ < 14) {
      var mid = Math.floor((lo + hi) / 2);
      o.render(mid);
      if (o.current.offsetHeight <= target) lo = mid; else hi = mid;
    }
    o.render(lo);
  }
  // one pending job per layout, replaced when the same page is drawn again
  RC_STORY_FIT_.jobs = RC_STORY_FIT_.jobs.filter(function (j) { return j.layout.isConnected && j.layout !== o.layout; });
  RC_STORY_FIT_.jobs.push({ layout: o.layout, fit: fit });
  if (!RC_STORY_FIT_.bound) {
    RC_STORY_FIT_.bound = true;
    window.addEventListener('resize', function () {
      clearTimeout(RC_STORY_FIT_.timer);
      RC_STORY_FIT_.timer = setTimeout(function () { RC_STORY_FIT_.jobs.forEach(function (j) { if (j.layout.isConnected) j.fit(); }); }, 150);
    });
  }
  o.render(o.minChars);
  // the page has to be in the document, and the fonts loaded, before the heights mean anything
  var run = function () { try { fit(); } catch (e) {} };
  if (window.requestAnimationFrame) window.requestAnimationFrame(run); else setTimeout(run, 0);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
}
