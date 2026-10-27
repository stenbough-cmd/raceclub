/* Race Club -- index photo showcase (js/index-showcase.js)
   A photo with a caption that changes every 10 seconds. A long pill at the bottom middle of the photo has one dot per photo: the
   dot of the photo on screen is lit, and clicking the pill moves on to the next photo. After the last photo it starts again from the first.
   Add photos to the list below (put the files in assets/images/showcase/). With no photos listed the section stays hidden. */
(function () {
  var PHOTOS = [
    // { src: 'assets/images/showcase/league-hub.webp', alt: 'The League Hub standings', caption: 'Follow every round on the League Hub.' }
  ];
  var INTERVAL_MS = 10000;

  var section = document.getElementById('rc-showcase');
  var stage = document.getElementById('rc-showcase-stage');
  var pill = document.getElementById('rc-showcase-pill');
  var caption = document.getElementById('rc-showcase-caption');
  if (!section || !stage || !pill || !caption || !PHOTOS.length) return;
  section.hidden = false;

  var imgs = [], dots = [], current = 0, timer = null;
  PHOTOS.forEach(function (p, i) {
    var img = document.createElement('img');
    img.className = 'rc-showcase-img' + (i === 0 ? ' rc-showcase-on' : '');
    img.src = p.src; img.alt = p.alt || ''; img.decoding = 'async';
    if (i > 0) img.loading = 'lazy';
    stage.insertBefore(img, pill); imgs.push(img);
    var dot = document.createElement('span');
    dot.className = 'rc-showcase-dot' + (i === 0 ? ' rc-showcase-dot-on' : '');
    pill.appendChild(dot); dots.push(dot);
  });

  function show(n) {
    imgs[current].classList.remove('rc-showcase-on');
    dots[current].classList.remove('rc-showcase-dot-on');
    current = n % PHOTOS.length;
    imgs[current].classList.add('rc-showcase-on');
    dots[current].classList.add('rc-showcase-dot-on');
    caption.textContent = PHOTOS[current].caption || '';
  }
  function restart() { if (timer) clearInterval(timer); timer = setInterval(function () { show(current + 1); }, INTERVAL_MS); }

  caption.textContent = PHOTOS[0].caption || '';
  pill.addEventListener('click', function () { show(current + 1); restart(); });
  if (PHOTOS.length > 1) restart(); else pill.style.display = 'none';
})();
