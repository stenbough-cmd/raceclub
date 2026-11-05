// Race Club -- js/car-picker.js
// ONE car picker for both the League (Account dashboard "Register for Season") and the Single Player Championship
// (dashboard "Choose Your Team"): class screen, team cards, manufacturer filter, the signing sequence (suspense, welcome image,
// CONGRATULATIONS), and the season notice. Matt (2026-11-02): "identical, only the wording distinguishes league from
// championship". Never copy this into another file; change it here and both pages change.
//
// Usage:
//   rcOpenCarPicker({
//     mode: 'league' | 'championship',          // picks the wording below
//     openModal: function (title, opts) { ... },  // returns { body, close(force), setTitle(text, pillNode), hideClose() }
//     loadTeams: function (carClass) { ... },     // returns a Promise of { success, teams: [...], message }; carClass '' = every class
//     join: function (team) { ... },              // returns a Promise of the save response { success, message, error }
//     carImage: function (team) { ... },          // optional: { year, series } for the car picture (default: team.carYear / team.series)
//     reload: function () { ... },                // redraws the dashboard after a registration
//     toast: function (message, type) { ... },
//     onAuthError: function (res) { ... },        // optional: returns true when the response was an expired login (already handled)
//     onClose: function () { ... }                // optional: the picker popup was closed
//   });
// A team looks like { teamId, teamName, teamDesc, carClass, manufacturer, carModel, carNumber, taken, carYear, series,
//   factory, realCrew }. Fields a page does not send are simply not shown.

(function () {
  var WORDING = {
    league: {
      classIntro: function (classesLabel) { return 'This season features ' + classesLabel + '. Pick the class you’ll compete in this season.'; },
      seatsLabel: function (open, total) { return open + ' of ' + total + ' seat' + (total === 1 ? '' : 's') + ' open'; },
      totalsLine: function (open, total) {
        return total ? (open + ' of ' + total + ' total seat' + (total === 1 ? '' : 's') + ' open this season') : 'No cars are set up for this season yet.';
      },
      registered: 'You’re registered!',
      noticeTitle: 'Season Commitment',
      noticeRule: 'You may only drive in the <strong>class</strong>, <strong>car</strong> and <strong>car number</strong> you registered with for the <em>entire season</em>, without exception.',
      noticePenalty: 'Severe penalties will apply when this rule is broken, up to disqualification and suspension from the league.'
    },
    championship: {
      classIntro: function () { return 'Pick the class you will race in this season. Your AI rivals fill every other seat.'; },
      seatsLabel: function (open, total) { return total + ' car' + (total === 1 ? '' : 's'); },
      totalsLine: null,
      registered: 'You’re registered!',
      noticeTitle: 'Season Commitment',
      noticeRule: 'Your <strong>class</strong>, <strong>car</strong> and <strong>car number</strong> are locked in for the <em>entire season</em> of your Single Player Championship.',
      noticePenalty: ''
    }
  };

  var CLASS_BADGE = { LMGTE: 'rc-badge-lmgte', LMGT3: 'rc-badge-lmgt3', LMP3: 'rc-badge-lmp3', LMP2: 'rc-badge-lmp2', Hypercar: 'rc-badge-hypercar' };

  var LOCK_ICON = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="5.5" y1="18.5" x2="18.5" y2="5.5"></line></svg>';

  function esc(v) { return rcEscapeHtml(v); }
  function mk(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined && html !== null) e.innerHTML = html;
    return e;
  }
  function spinner(message) {
    var wrap = mk('div', 'rc-inline-spinner-wrap');
    var lights = mk('div', 'rc-startlights');
    for (var i = 0; i < 5; i++) lights.appendChild(mk('span', 'rc-startlight'));
    wrap.appendChild(lights);
    wrap.appendChild(mk('div', 'rc-loading-text', esc(message)));
    return wrap;
  }
  function classLabel(cls) { return cls === 'Hypercar' ? 'HY' : cls; }
  function classPill(cls) {
    return mk('span', 'rc-badge-chip' + (CLASS_BADGE[cls] ? ' ' + CLASS_BADGE[cls] : ''), esc(classLabel(cls) || 'Unclassified'));
  }
  function logoImg(manufacturer, className, onFail) {
    var img = document.createElement('img');
    if (className) img.className = className;
    img.alt = manufacturer || '';
    if (!manufacturer || typeof manufacturerLogoSrc !== 'function') { img.style.display = 'none'; return img; }
    img.src = manufacturerLogoSrc(manufacturer, 'black');
    manufacturerLogoFallback(img, manufacturer, onFail || function () { img.style.display = 'none'; });
    return img;
  }
  function teamTitle(team) { return (team.teamName || 'Unnamed Team') + (team.carNumber ? ' #' + team.carNumber : ''); }

  // ---------------------------------------------------------------------
  // THE PICKER
  // ---------------------------------------------------------------------
  window.rcOpenCarPicker = function (cfg) {
    var W = WORDING[cfg.mode] || WORDING.league;
    var joined = false;
    var modal = cfg.openModal('Choose Your Class', { wide: true, onClose: function () { if (!joined && cfg.onClose) cfg.onClose(); } });
    var cache = null;   // every team, loaded once with the class screen

    function note(text, isError) {
      var p = mk('p', null, esc(text));
      p.style.cssText = 'margin:0;color:' + (isError ? 'var(--rc-red)' : 'var(--rc-steel)') + ';';
      return p;
    }

    function showClassScreen() {
      modal.setTitle('Choose Your Class');
      var body = modal.body;
      body.innerHTML = '';
      body.appendChild(spinner('Loading classes...'));
      cfg.loadTeams('').then(function (data) {
        body.innerHTML = '';
        if (cfg.onAuthError && cfg.onAuthError(data)) return;
        if (!data || !data.success) { body.appendChild(note((data && data.message) || 'Could not load classes.', true)); return; }
        cache = data.teams || [];
        renderClassScreen(cache);
      }).catch(function () {
        body.innerHTML = '';
        body.appendChild(note('Could not reach the server. Try again in a moment.', true));
      });
    }

    // All five classes always show; a class with no cars (or no free seats) is locked.
    function renderClassScreen(allTeams) {
      var body = modal.body;
      var present = [];
      allTeams.forEach(function (t) { if (t.carClass && present.indexOf(t.carClass) === -1) present.push(t.carClass); });
      var ladder = (typeof CAR_CLASS_LIST !== 'undefined') ? CAR_CLASS_LIST : present;
      var inOrder = ladder.filter(function (c) { return present.indexOf(c) !== -1; });
      var label;
      if (inOrder.length <= 1) label = inOrder[0] || 'no classes yet';
      else if (inOrder.length === 2) label = inOrder[0] + ' and ' + inOrder[1];
      else label = inOrder.slice(0, -1).join(', ') + ', and ' + inOrder[inOrder.length - 1];
      var intro = mk('p', null, esc(W.classIntro(label)));
      intro.style.cssText = 'color:var(--rc-steel);font-size:13px;margin:0 0 14px;';
      body.appendChild(intro);

      var grid = mk('div', 'rc-class-pick-grid');
      var totalOpen = 0, totalSeats = 0;
      ladder.forEach(function (cls) {
        var isPresent = present.indexOf(cls) !== -1;
        var inClass = allTeams.filter(function (t) { return t.carClass === cls; });
        var open = inClass.filter(function (t) { return !t.taken; });
        totalOpen += open.length;
        totalSeats += inClass.length;
        var colorVar = (typeof CAR_CLASS_BADGE_COLOR_VAR !== 'undefined' && CAR_CLASS_BADGE_COLOR_VAR[cls]) || '--rc-steel';
        var canPick = isPresent && open.length > 0;
        var btn = mk('button', 'rc-class-pick-btn' + (canPick ? '' : ' rc-class-pick-btn-locked') + (isPresent ? '' : ' rc-class-pick-btn-inactive'));
        btn.type = 'button';
        btn.style.setProperty('--rc-class-pick-color', 'var(' + colorVar + ')');
        btn.disabled = !canPick;
        var content = mk('div', 'rc-class-pick-btn-content');
        content.appendChild(mk('div', 'rc-class-pick-btn-name', esc(classLabel(cls))));
        content.appendChild(mk('div', 'rc-class-pick-btn-seats', esc(isPresent ? W.seatsLabel(open.length, inClass.length) : 'Inactive')));
        btn.appendChild(content);
        btn.appendChild(mk('div', 'rc-class-pick-btn-lock', LOCK_ICON));
        if (canPick) btn.addEventListener('click', function () { showTeamScreen(cls); });
        grid.appendChild(btn);
      });
      body.appendChild(grid);
      if (W.totalsLine) body.appendChild(mk('div', 'rc-class-pick-totals', esc(W.totalsLine(totalOpen, totalSeats))));
    }

    function showTeamScreen(cls) {
      modal.setTitle('Choose Your Team', classPill(cls));
      var body = modal.body;
      body.innerHTML = '';
      var back = mk('button', 'rc-link-btn', '← Choose a different class');
      back.type = 'button';
      back.style.cssText = 'display:block;margin-bottom:10px;';
      back.addEventListener('click', showClassScreen);
      body.appendChild(back);
      var slot = mk('div');
      body.appendChild(slot);
      var teams = (cache || []).filter(function (t) { return t.carClass === cls; });
      if (!teams.length) { slot.appendChild(note('No cars are set up for ' + cls + ' yet.')); return; }
      renderTeams(slot, teams, cls);
    }

    function renderTeams(slot, teams, cls) {
      var listSlot = mk('div');
      function renderList(manu) {
        listSlot.innerHTML = '';
        var shown = manu ? teams.filter(function (t) { return t.manufacturer === manu; }) : teams;
        if (!shown.length) { listSlot.appendChild(note('No ' + manu + ' teams in ' + cls + '.')); return; }
        shown.forEach(function (t) { listSlot.appendChild(buildCard(t, cls)); });
      }
      var manus = [];
      teams.forEach(function (t) { if (t.manufacturer && manus.indexOf(t.manufacturer) === -1) manus.push(t.manufacturer); });
      manus.sort(function (a, b) { return String(a).localeCompare(String(b)); });
      if (manus.length > 1) {
        var row = mk('div', 'rc-team-manu-filter-row');
        var all = mk('button', 'rc-team-manu-filter-all', 'ALL');
        all.type = 'button';
        row.appendChild(all);
        var entries = [{ manu: null, btn: all }];
        manus.forEach(function (m) {
          var b = mk('button', 'rc-team-manu-filter-logo');
          b.type = 'button';
          b.title = m;
          b.appendChild(logoImg(m, '', function () { b.style.display = 'none'; }));
          row.appendChild(b);
          entries.push({ manu: m, btn: b });
        });
        entries.forEach(function (en) {
          en.btn.addEventListener('click', function () {
            entries.forEach(function (x) { x.btn.classList.toggle('rc-team-manu-filter-dim', en.manu !== null && x.manu !== en.manu); });
            renderList(en.manu);
          });
        });
        slot.appendChild(row);
      }
      slot.appendChild(listSlot);
      renderList(null);
    }

    // One team card: car picture on top, manufacturer logo in front of the team name, car model under it, everything centered.
    function buildCard(team, cls) {
      var card = mk('div', 'rc-team-card' + (team.taken ? ' rc-team-card-taken' : ''));

      var img = cfg.carImage ? cfg.carImage(team) : { year: team.carYear, series: team.series };
      var src = img && typeof rcCarImageSrc === 'function' ? rcCarImageSrc(img.year, team.carNumber, img.series) : '';
      if (src) {
        var pic = mk('div', 'rc-team-car-pic');
        var carImg = document.createElement('img');
        carImg.alt = '';
        var triedFull = false;
        carImg.onerror = function () {
          if (!triedFull) { triedFull = true; carImg.src = src; return; }
          pic.style.display = 'none';
        };
        carImg.src = src.replace('assets/cars/', 'assets/cars/small/');
        pic.appendChild(carImg);
        card.appendChild(pic);
      }

      card.appendChild(mk('div', 'rc-team-name', esc(teamTitle(team))));

      // Same look as the Current Seat / Season Details car line: maker logo in front of the car model.
      var model = team.carModel ? esc(team.carModel) : '';
      if (model && cls === 'Hypercar' && typeof team.factory === 'boolean') model += team.factory ? ' · Factory' : ' · Privateer';
      if (model || team.manufacturer) {
        var carLine = mk('div', 'rc-team-subtitle rc-team-carline');
        if (team.manufacturer) carLine.appendChild(logoImg(team.manufacturer, 'rc-team-logo'));
        if (model) carLine.appendChild(mk('span', null, model));
        card.appendChild(carLine);
      }

      if (team.teamDesc) card.appendChild(mk('p', 'rc-team-desc', esc(team.teamDesc)));
      if (team.realCrew && team.realCrew.length) card.appendChild(mk('div', 'rc-team-replace', 'You replace: ' + esc(team.realCrew.join(', '))));

      var footer = mk('div', 'rc-team-card-footer');
      var btn = mk('button', 'rc-btn-dark', team.taken ? 'This Seat Is Taken' : 'Join This Team');
      btn.type = 'button';
      if (team.taken) {
        btn.disabled = true;
        footer.appendChild(btn);
      } else {
        var err = mk('div', 'rc-team-card-error');
        btn.addEventListener('click', function () { joinTeam(team, cls, btn, err); });
        footer.appendChild(btn);
        footer.appendChild(err);
      }
      card.appendChild(footer);
      return card;
    }

    // The save goes out the moment Join is clicked, while the signing sequence plays. With cfg.refresh (the League), the dashboard
    // is redrawn in place the moment the save is confirmed (behind the signing screen, no page reload), and Continue goes straight to the
    // season notice without waiting for anything. Without cfg.refresh (Championship) it works as before: after Continue the
    // answer is read, the page is reloaded, then the notice shows.
    function joinTeam(team, cls, btn, err) {
      btn.disabled = true;
      err.textContent = '';
      joined = true;
      var joinPromise = cfg.join(team);
      var quick = typeof cfg.refresh === 'function';
      var outcome = null;        // null = still waiting, 'ok', 'fail'
      var failText = '';
      var noticeModal = null;
      var continued = false;

      function failed(message) {
        outcome = 'fail';
        failText = message;
        if (continued) {
          if (noticeModal && noticeModal.close) noticeModal.close(true);
          cfg.toast(failText, 'error');
          cfg.reload();
        }
      }
      if (quick) {
        joinPromise.then(function (res) {
          if (cfg.onAuthError && cfg.onAuthError(res)) { outcome = 'auth'; return; }
          if (res && res.success) {
            outcome = 'ok';
            cfg.toast(W.registered, 'success');
            cfg.refresh(team, cls);
            return;
          }
          failed((res && res.message) || (res && res.error === 'TEAM_TAKEN'
            ? 'That seat was just taken -- reloading to show what’s still open.'
            : 'Could not confirm this registration -- reloading to check.'));
        }).catch(function () { failed('Could not confirm this registration -- reloading to check.'); });
      }

      openSigningSequence(team, cls, function () {
        modal.close(true);
        if (quick) {
          continued = true;
          if (outcome === 'fail') { cfg.toast(failText, 'error'); cfg.reload(); return; }
          if (outcome === 'auth') return;
          noticeModal = openNotice(team, cls);   // right away; a late failure closes it again (see failed above)
          return;
        }
        joinPromise.then(function (res) {
          if (cfg.onAuthError && cfg.onAuthError(res)) return;
          if (res && res.success) {
            cfg.toast(W.registered, 'success');
            cfg.reload();
            openNotice(team, cls);
            return;
          }
          cfg.toast((res && res.message) || (res && res.error === 'TEAM_TAKEN'
            ? 'That seat was just taken -- reloading to show what’s still open.'
            : 'Could not confirm this registration -- reloading to check.'), 'error');
          cfg.reload();
        }).catch(function () {
          cfg.toast('Reloading to confirm your registration...', 'success');
          cfg.reload();
        });
      });
    }

    // Shown once after registering. The X is hidden on purpose: the only way out is "I UNDERSTAND".
    function openNotice(team, cls) {
      var mfr = String(team.manufacturer || '').trim();
      var model = String(team.carModel || '').trim();
      var carText = (mfr && model.toLowerCase().indexOf(mfr.toLowerCase()) !== 0) ? [mfr, model].filter(Boolean).join(' ') : (model || mfr);
      var m = cfg.openModal(W.noticeTitle, {});
      if (m.hideClose) m.hideClose();
      var body = m.body;
      var rule = mk('p', null, W.noticeRule);
      rule.style.cssText = 'color:var(--rc-carbon);font-size:14px;margin-top:0;';
      body.appendChild(rule);
      // The car they registered, above the team / car name line (hidden when there is no picture for it).
      var noticeImg = cfg.carImage ? cfg.carImage(team) : { year: team.carYear, series: team.series };
      var noticeSrc = noticeImg && typeof rcCarImageSrc === 'function' ? rcCarImageSrc(noticeImg.year, team.carNumber, noticeImg.series) : '';
      if (noticeSrc) {
        var noticePic = mk('div', 'rc-notice-car-pic');
        var noticePicImg = document.createElement('img');
        noticePicImg.alt = '';
        noticePicImg.onerror = function () { noticePic.style.display = 'none'; };
        noticePicImg.src = noticeSrc;
        noticePic.appendChild(noticePicImg);
        body.appendChild(noticePic);
      }
      var reg = mk('div', 'rc-notice-car');
      if (mfr) reg.appendChild(logoImg(mfr, 'rc-notice-logo'));
      var carLabel = [carText, team.carNumber ? '#' + team.carNumber : ''].filter(Boolean).join(' ');
      if (carLabel) reg.appendChild(mk('span', null, esc(carLabel)));
      if (cls) reg.appendChild(classPill(cls));
      body.appendChild(reg);
      if (W.noticePenalty) {
        var pen = mk('p', null, esc(W.noticePenalty));
        pen.style.cssText = 'color:var(--rc-carbon);font-size:14px;font-weight:700;margin:12px 0 0;';
        body.appendChild(pen);
      }
      var row = mk('div');
      row.style.cssText = 'display:flex;justify-content:flex-end;margin-top:18px;';
      var ok = mk('button', 'rc-btn-dark', '5...');
      ok.type = 'button';
      ok.disabled = true;   // 5...4...3...2...1... gives time to read the notice (and the dashboard time to refresh) before it can be dismissed
      var left = 5;
      var tick = setInterval(function () {
        if (!ok.isConnected) { clearInterval(tick); return; }   // the popup was closed another way
        left--;
        if (left > 0) { ok.textContent = left + '...'; return; }
        clearInterval(tick);
        ok.textContent = 'I Understand';
        ok.disabled = false;
      }, 1000);
      ok.addEventListener('click', function () { if (!ok.disabled) m.close(true); });
      row.appendChild(ok);
      body.appendChild(row);
      return m;
    }

    showClassScreen();
    return modal;
  };

  // ---------------------------------------------------------------------
  // SIGNING SEQUENCE: suspense (start lights) -> class welcome image -> CONGRATULATIONS -> Continue
  // ---------------------------------------------------------------------
  var SIGNING_MESSAGES = [
    'Drafting team documents...', 'Confirming your car and number...', 'Notifying the team principal...',
    'Reviewing the season rules...', 'Fitting your race suit...', 'Calibrating the seat...',
    'Finalizing your contract...', 'Bringing the car to pit lane...'
  ];
  var WELCOME_LINES = [
    'Welcome to {team}! We’ve been waiting for a driver like you, and we finally found one. This seat is yours, now let’s go show everyone what we can do!',
    'You earned this, plain and simple! {team} doesn’t hand out seats, we award them. Buckle up, this is going to be a season to remember!',
    'From everyone at {team}: congratulations! You’re not just joining a team, you’re joining a family that believes in you. Let’s get out there and win!',
    'This is the moment every driver dreams about, and it’s yours! {team} is fully behind you, every lap, every race. Now go make us proud!',
    'Welcome aboard, driver! We built this car for someone special, and that someone is you. Let’s make {team} history together!',
    'The whole {team} garage is buzzing about you! You’ve got the talent, we’ve got the car, together we’re unstoppable. Let’s go racing!',
    'You should be incredibly proud of yourself right now! {team} chose you because we believe you can do great things. Now it’s time to prove it!',
    'Congratulations, and welcome to the team! Every great champion started exactly where you are right now. Let’s write your story together!',
    'This seat has your name on it for a reason! {team} sees the potential in you, and we can’t wait to watch it grow. Let’s hit the track!',
    'Welcome to {team}, driver! Today you take the first step toward something incredible. Strap in, the season starts now!'
  ];
  var SUSPENSE_MIN_MS = 3800;
  var IMAGE_FAILSAFE_MS = 8000;
  var IMAGE_FADE_MS = 900;
  var IMAGE_HOLD_MS = 3000;

  function welcomeImageSrc(carClass) {
    if (carClass === 'LMGTE' || carClass === 'LMGT3') return 'assets/images/gt_welcome.jpg';
    if (carClass === 'Hypercar') return 'assets/images/hypercar_welcome.jpg';
    return 'assets/images/prototype_welcome.jpg';
  }

  function openSigningSequence(team, carClass, onFinish) {
    var overlay = mk('div', 'rc-signing-overlay');
    var stage = mk('div', 'rc-signing-stage rc-signing-stage-suspense');
    overlay.appendChild(stage);
    document.body.appendChild(overlay);

    var wordmark = document.createElement('img');
    wordmark.className = 'rc-signing-wordmark-img';
    wordmark.alt = 'Race Club';
    wordmark.src = 'assets/images/Race Club Full White.webp';
    stage.appendChild(wordmark);
    var lights = mk('div', 'rc-startlights');
    for (var i = 0; i < 5; i++) lights.appendChild(mk('div', 'rc-startlight'));
    stage.appendChild(lights);
    var msgLine = mk('div', 'rc-signing-message', SIGNING_MESSAGES[0]);
    stage.appendChild(msgLine);
    var msgIndex = 0;
    var msgTimer = setInterval(function () {
      msgIndex = (msgIndex + 1) % SIGNING_MESSAGES.length;
      msgLine.textContent = SIGNING_MESSAGES[msgIndex];
    }, 1400);

    var welcomeImg = document.createElement('img');
    welcomeImg.className = 'rc-signing-welcome-img';
    welcomeImg.alt = '';
    var startedAt = Date.now();
    var imageReady = false, advanced = false, revealStarted = false, finished = false;
    var failsafe = setTimeout(function () { imageReady = true; tryAdvance(); }, IMAGE_FAILSAFE_MS);
    welcomeImg.addEventListener('load', function () { imageReady = true; tryAdvance(); });
    welcomeImg.addEventListener('error', function () { imageReady = true; tryAdvance(); });
    welcomeImg.src = welcomeImageSrc(carClass);

    function tryAdvance() {
      if (advanced) return;
      setTimeout(function () {
        if (advanced || !imageReady) return;
        advanced = true;
        clearInterval(msgTimer);
        clearTimeout(failsafe);
        showWelcome();
      }, Math.max(0, SUSPENSE_MIN_MS - (Date.now() - startedAt)));
    }

    function showWelcome() {
      stage.className = 'rc-signing-stage rc-signing-stage-welcome';
      stage.innerHTML = '';
      stage.appendChild(welcomeImg);
      void welcomeImg.offsetHeight;
      welcomeImg.classList.add('rc-signing-welcome-img-visible');
      setTimeout(dimAndReveal, IMAGE_FADE_MS + IMAGE_HOLD_MS);
    }

    function dimAndReveal() {
      if (revealStarted) return;
      revealStarted = true;
      welcomeImg.classList.add('rc-signing-welcome-img-dim');
      var content = mk('div', 'rc-signing-welcome-overlay');
      var wm = document.createElement('img');
      wm.className = 'rc-signing-wordmark-img rc-signing-wordmark-img-lg';
      wm.alt = 'Race Club';
      wm.src = 'assets/images/Race Club Full White.webp';
      content.appendChild(wm);
      content.appendChild(mk('div', 'rc-signing-congrats', 'CONGRATULATIONS'));
      var hypeWrap = mk('div', 'rc-signing-hype-wrap');
      var hype = mk('div', 'rc-signing-hype');
      hype.appendChild(mk('span', 'rc-signing-hype-mark rc-signing-hype-mark-open', '“'));
      var line = WELCOME_LINES[Math.floor(Math.random() * WELCOME_LINES.length)].split('{team}').join(esc(team.teamName || 'the team'));
      hype.appendChild(mk('span', 'rc-signing-hype-text', line));
      hype.appendChild(mk('span', 'rc-signing-hype-mark rc-signing-hype-mark-close', '”'));
      hypeWrap.appendChild(hype);
      hypeWrap.appendChild(mk('div', 'rc-signing-hype-attribution', '· Team Principal'));
      content.appendChild(hypeWrap);

      var identity = mk('div', 'rc-signing-reveal-identity');
      if (team.manufacturer) identity.appendChild(logoImg(team.manufacturer, 'rc-signing-reveal-logo'));
      identity.appendChild(mk('div', 'rc-signing-reveal-team', esc(teamTitle(team))));
      content.appendChild(identity);

      var btnRow = mk('div', 'rc-signing-reveal-btn-row');
      btnRow.style.opacity = '0';
      var cont = mk('button', 'rc-btn-primary rc-signing-continue', 'Continue');
      cont.type = 'button';
      cont.addEventListener('click', function () {
        if (finished) return;
        finished = true;
        overlay.remove();
        onFinish();
      });
      btnRow.appendChild(cont);
      content.appendChild(btnRow);
      stage.appendChild(content);
      void content.offsetHeight;
      content.classList.add('rc-signing-welcome-overlay-visible');
      setTimeout(function () { btnRow.style.opacity = '1'; }, 1400);
    }
  }
})();
