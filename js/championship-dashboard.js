// Race Club -- js/championship-dashboard.js
// SINGLE PLAYER CHAMPIONSHIP container on the Account dashboard (ECO chat, 2026-11-01, the Championship and ECO chats were
// merged). It carries the championship season tools (Create / Edit / End / Delete Season, Upload / Erase Results, Season Preview,
// Choose Your Team, Help) so a member can run their own offline championship from the dashboard.
//
// It does not copy those tools: it loads js/championship.js (the same file championship.html uses) in "embedded" mode and calls
// its popups (rccOpenSeasonWizard, rccOpenEndSeason, ...). Embedded mode (window.RCC_EMBEDDED) switches off championship.js's own
// page start-up and sends every "reload after save" back to this dashboard instead of the Championship page.
//
// Usage (Account.html): rcBuildChampionshipDashboard({ token, profile, withTooltip, showToast, reload }) -> the container element.
// Colors: the Championship page's gray-blue accent (blue-gray replaces the site red), not the red of the league containers.

(function () {
  var STYLE_ID = 'rcd-style';
  var CSS_FILES = ['css/league.css', 'css/championship.css'];
  var JS_FILES = ['js/championship-help.js', 'js/championship.js'];
  var loading = null;

  function mk(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      // The Championship page's accent: the site red becomes blue-gray inside this container and inside the championship popups.
      '.rcd-panel, .rcd-help, .rcc-modal-overlay { --rc-red: #5f7d99; --rc-red-dark: #4b6680; }' +
      // Color tokens the popups read (league.css and championship.css set these on the page body, which this page does not have).
      '.rcc-modal-overlay { --rcl-bg: #0a0a0b; --rcl-bg-raised: #141416; --rcl-bg-raised-2: #1b1c1f; --rcl-line: #2c2d31; --rcl-line-bright: #45474d; --rcl-ink: #f2f2f0; --rcl-ink-dim: #b4b7bd; --rcl-ink-faint: #7d8088;' +
      ' --rcc-navy: var(--rc-balanced); --rcc-accent-light: #9db6cc; --rcc-true-red: #F21B0C;' +
      ' --rcl-gold: #e0b64c; --rcl-badge-news: #2f6f9f; --rcl-report-damage: #f5923b; --rcl-report-collision: #e8c547; --rcl-report-gain: #4fbf72; --rcl-report-fastest: #b07ce8; --rcl-bonus: #7fa8d4; color: var(--rcl-ink); }' +
      '.rcd-help { --rcc-navy: #34495c; --rcc-accent-light: #9db6cc; } .rcd-help-tab { --rc-red: #5f7d99; --rc-red-dark: #4b6680; }' +
      '.rcd-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; justify-content: flex-end; margin-bottom: 14px; }' +
      '.rcd-row-group { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }' +
      '.rcd-spacer { flex: 1 1 20px; }' +
      '.rcd-season { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 2px; border-top: 1px solid var(--rc-silver); }' +
      '.rcd-season:first-child { border-top: 0; }' +
      '.rcd-season-name { flex: 1 1 200px; min-width: 0; font-weight: 700; font-size: 14px; color: var(--rc-carbon); }' +
      '.rcd-pill { font-size: 10.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; background: var(--rc-silver); color: var(--rc-carbon); }' +
      '.rcd-pill.rcd-active { background: var(--rc-red); color: #fff; }' +
      '.rcd-note { margin: 0 0 12px; font-size: 13.5px; line-height: 1.55; color: var(--rc-steel); }' +
      '.rcd-season a.rc-btn-secondary { text-decoration: none; display: inline-block; }';
    document.head.appendChild(s);
  }

  function loadCss(href) {
    if (document.querySelector('link[data-rcd-css="' + href + '"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-rcd-css', href);
    document.head.appendChild(l);
  }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }
  // The championship code is fetched once per page view, then reused.
  function ensureLoaded(opts) {
    window.RCC_EMBEDDED = true;
    window.RCC_EMBEDDED_RELOAD = function () {
      // popups of the championship code are plain overlays on the page: take them away before the dashboard redraws
      Array.prototype.forEach.call(document.querySelectorAll('.rcc-modal-overlay'), function (o) { if (o.parentNode) o.parentNode.removeChild(o); });
      try { if (typeof _rccUnlockScroll === 'function') _rccUnlockScroll(); } catch (e) { /* ignore */ }
      if (opts.reload) opts.reload();
    };
    // championship.js shows its messages through a global showToast; Account.html keeps its own inside the page, so hand it over
    if (typeof window.showToast !== 'function' && opts.showToast) window.showToast = opts.showToast;
    if (loading) return loading;
    CSS_FILES.forEach(loadCss);
    loading = JS_FILES.reduce(function (p, src) { return p.then(function () { return loadScript(src); }); }, Promise.resolve());
    loading.catch(function () { loading = null; });
    return loading;
  }

  function statusOf(s) {
    if (s.status === 'Completed') return { label: s.unfinished ? 'Ended early' : 'Finished', active: false };
    return { label: s.status === 'Registration' ? 'Setting up' : 'Active', active: true };
  }

  function draw(panel, page, opts) {
    var tip = opts.withTooltip || function (e) { return e; };
    var hasSeason = !!(page && page.hasSeason);
    var active = hasSeason && !page.seasonEnded;
    var running = !!(page && page.hasActiveSeason);
    var cal = (page && page.calendar) || [];
    var anyEmpty = cal.some(function (c) { return !c.hasResults; });
    var anyResults = cal.some(function (c) { return c.hasQualifyResults || c.hasRaceResults; });

    function btn(label, enabled, onClick, why, cls) {
      var b = mk('button', cls || 'rc-btn-secondary rc-btn-sm', label);
      b.type = 'button';
      if (!enabled) { b.disabled = true; if (why) tip(b, why); }
      else b.addEventListener('click', onClick);
      return b;
    }

    // Same layout as the League Tools Seasons panel (Account.html buildSeasonsPanel / buildSeasonRow / buildSeasonRaceRow):
    // a right-aligned row with Create / End / Delete Season, then the list in its own box, grouped under year pills. Each season
    // is a .rc-group-row (name, gray meta line, its buttons underneath, a chevron) and its rounds open under it, indented.
    var CHEVRON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    var row = mk('div', 'rcd-row');
    row.appendChild(btn('Create a Season', !running, function () { rccOpenSeasonWizard(null); }, 'End the current season before creating a new one.', 'rc-btn-primary rc-btn-sm'));
    row.appendChild(btn('End Season', active, function () { rccOpenEndSeason(); }, 'No season is currently eligible to end.'));
    row.appendChild(btn('Delete Season', hasSeason, function () { rccOpenDeleteSeason(); }, 'No season is currently eligible to delete.'));
    panel.appendChild(row);

    function rowBtn(label, enabled, onClick, why) { return btn(label, enabled, onClick, why, 'rc-btn-secondary rc-btn-row'); }

    // One round of the running season (same shape as buildSeasonRaceRow).
    var firstEmpty = cal.filter(function (x) { return !x.hasResults; })[0];
    var doneRounds = cal.filter(function (x) { return x.hasQualifyResults || x.hasRaceResults; });
    var lastDone = doneRounds[doneRounds.length - 1];
    function roundRow(c) {
      var r = mk('div', 'rc-group-row');
      var info = mk('div', 'rc-dm-row-info');
      var col = mk('div', '');
      col.appendChild(mk('span', 'rc-dm-row-label', 'Round ' + c.roundNum + ': ' + (c.eventName || c.track || '')));
      var bits = [];
      if (c.track) bits.push(c.track + (c.layout ? ': ' + c.layout : ''));
      col.appendChild(mk('div', 'rc-hint', bits.join(' · ') || 'Track not set'));
      var st = mk('div', 'rc-round-status');
      var text, icon;
      if (c.hasResults) { text = 'Results uploaded. Standings updated.'; icon = mk('span', 'rc-protest-dash-icon rc-statuscircle-green', '✓'); }
      else if (c.hasQualifyResults || c.hasRaceResults) { text = c.hasRaceResults ? 'Race results uploaded, awaiting qualifying results.' : 'Qualifying results uploaded, awaiting race results.'; icon = mk('span', 'rc-protest-dash-icon rc-statuscircle-yellow', '~'); }
      else { text = 'Awaiting results.'; icon = mk('span', 'rc-protest-dash-icon rc-protest-dash-icon-pending'); }
      st.appendChild(icon);
      st.appendChild(mk('span', 'rc-round-status-text', text));
      col.appendChild(st);
      var bg = mk('div', '');
      bg.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;';
      if (active) {
        var canUp = !!page.registration && firstEmpty && firstEmpty.roundId === c.roundId;
        bg.appendChild(rowBtn('Upload Results', canUp, function () { rccOpenUpload(c.roundId, true); },
          c.hasResults ? 'Results already uploaded for this round. Erase them first to upload again.' : (!page.registration ? 'Choose your team first.' : 'Upload the earlier rounds first.')));
        bg.appendChild(rowBtn('Erase Results', !!lastDone && lastDone.roundId === c.roundId, function () { rccOpenErase(); },
          (c.hasQualifyResults || c.hasRaceResults) ? 'Only the latest round with results can be erased.' : 'No results uploaded for this round.'));
      }
      col.appendChild(bg);
      info.appendChild(col);
      r.appendChild(info);
      return r;
    }

    var box = mk('div', 'rc-panel');
    var seasons = (page && page.seasons) || [];
    if (!seasons.length) {
      box.appendChild(mk('div', 'rc-dm-empty', 'No seasons yet.'));
    } else {
      var lastYear = null;
      seasons.forEach(function (s, idx) {
        var year = s.createdAt ? String(s.createdAt).slice(0, 4) : 'Seasons';
        if (year !== lastYear) {
          var head = mk('div', 'rc-group-head');
          head.appendChild(mk('span', 'rc-badge-chip rc-badge-graphite', year));
          box.appendChild(head);
          lastYear = year;
        }
        var isCurrent = s.seasonId === page.seasonId;
        var ended = s.status === 'Completed';
        var container = mk('div', '');
        var line = mk('div', 'rc-group-row');
        var info = mk('div', 'rc-dm-row-info');
        var textCol = mk('div', '');
        textCol.appendChild(mk('span', 'rc-dm-row-label', (s.seasonNumber ? 'Season ' + s.seasonNumber : 'Season') + (s.name ? ': ' + s.name : '')));
        var meta = [statusOf(s).label];
        if (isCurrent && cal.length) meta.push(cal.length + ' race' + (cal.length === 1 ? '' : 's'));
        else if (s.raceCount != null) meta.push(s.raceCount + ' race' + (s.raceCount === 1 ? '' : 's'));
        if (s.createdAt) meta.push('Created ' + String(s.createdAt).slice(0, 10));
        textCol.appendChild(mk('div', 'rc-hint', meta.join(' · ')));
        var bg = mk('div', '');
        bg.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;';
        if (isCurrent) {
          bg.appendChild(rowBtn('Edit Season', active, function () { rccOpenSeasonWizard(page.seasonId); }, 'This season has ended, so its details can no longer be edited.'));
          bg.appendChild(rowBtn(hasSeason ? 'Season Preview' : 'Welcome', true, hasSeason ? rccOpenSeasonPreview : rccOpenWelcomeTip));
          bg.appendChild(rowBtn('Choose Your Team', active, function () { rccOpenRegistration(); }, 'The season has ended.'));
        }
        var open = mk('a', 'rc-btn-secondary rc-btn-row', 'Open');
        open.href = 'championship.html?id=' + encodeURIComponent(opts.profile.profileId) + '&season=' + encodeURIComponent(s.seasonId);
        open.style.textDecoration = 'none';
        bg.appendChild(open);
        var racesBox = null;
        if (isCurrent && cal.length) {
          racesBox = mk('div', '');
          racesBox.style.cssText = 'padding-left:20px;';
          cal.forEach(function (c) { racesBox.appendChild(roundRow(c)); });
          var tg = mk('button', 'rc-disclosure-btn rc-disclosure-open');
          tg.innerHTML = CHEVRON; tg.type = 'button';
          tg.setAttribute('aria-expanded', 'true'); tg.setAttribute('aria-label', 'Hide races');
          tg.addEventListener('click', function () {
            var isOpen = racesBox.style.display !== 'none';
            racesBox.style.display = isOpen ? 'none' : '';
            tg.classList.toggle('rc-disclosure-open', !isOpen);
            tg.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
            tg.setAttribute('aria-label', isOpen ? 'Show races' : 'Hide races');
          });
          bg.appendChild(tg);
        }
        textCol.appendChild(bg);
        info.appendChild(textCol);
        line.appendChild(info);
        container.appendChild(line);
        if (racesBox) container.appendChild(racesBox);
        box.appendChild(container);
      });
    }
    panel.appendChild(box);
  }

  // HELP (Account.html Help page, "Single Player Championship" tab): the championship help text, in the Championship's blue-gray.
  // Returns an element at once and fills it as soon as css/championship.css and js/championship-help.js have loaded.
  var helpLoading = null;
  window.rcBuildChampionshipHelp = function () {
    addStyle();
    var wrap = mk('div', 'rcd-help rcc-help-body');
    wrap.appendChild(mk('p', 'rcd-note', 'Loading help...'));
    if (!helpLoading) {
      ['css/league.css', 'css/championship.css'].forEach(loadCss);
      helpLoading = loadScript('js/championship-help.js');
      helpLoading.catch(function () { helpLoading = null; });
    }
    helpLoading.then(function () {
      wrap.innerHTML = '';
      var sections = typeof RCC_HELP_SECTIONS !== 'undefined' ? RCC_HELP_SECTIONS : [];
      if (typeof RCC_HELP_QUICKSTART !== 'undefined') {
        var qs = mk('div', 'rcc-quick');
        qs.innerHTML = RCC_HELP_QUICKSTART;
        wrap.appendChild(qs);
      }
      var card = mk('div', 'rc-panel rc-dash-card');
      card.appendChild(mk('h3', 'rc-dash-card-title', 'Single Player Championship'));
      var nav = mk('div', 'rc-rulebook-nav');
      nav.appendChild(mk('div', 'rc-rulebook-nav-title', 'Jump To A Section'));
      var grid = mk('div', 'rc-rulebook-nav-grid');
      nav.appendChild(grid);
      card.appendChild(nav);
      sections.forEach(function (sec) {
        var sw = mk('div', 'rc-rulebook-section');
        sw.appendChild(mk('h3', null, sec.num + '. ' + sec.title));
        var body = document.createElement('div');
        body.innerHTML = sec.html || '';
        sw.appendChild(body);
        var link = mk('a', 'rc-rulebook-nav-link', sec.num + '. ' + sec.title);
        link.href = '#';
        link.addEventListener('click', function (evt) { evt.preventDefault(); sw.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
        grid.appendChild(link);
        card.appendChild(sw);
      });
      wrap.appendChild(card);
    }).catch(function () {
      wrap.innerHTML = '';
      wrap.appendChild(mk('p', 'rcd-note', 'Could not load the championship help right now. Refresh the page to try again.'));
    });
    return wrap;
  };

  window.rcBuildChampionshipDashboard = function (opts) {
    addStyle();
    var panel = mk('div', 'rc-panel rc-dash-card rcd-panel');
    panel.appendChild(mk('h3', 'rc-dash-card-title', 'Seasons'));
    var body = mk('div', '');
    panel.appendChild(body);
    var spin = opts.spinner ? opts.spinner('Loading your championship...') : mk('p', 'rcd-note', 'Loading your championship...');
    body.appendChild(spin);
    function fail(msg) {
      body.innerHTML = '';
      body.appendChild(mk('p', 'rcd-note', msg || 'Could not load your championship right now. Refresh the page to try again.'));
    }
    var profile = opts.profile || {};
    if (!opts.token || !profile.profileId) { fail('Sign in to use the championship tools.'); return panel; }
    // panel.rcdReady settles once the championship data is drawn (or failed), so the page can show it together with the league cards.
    panel.rcdReady = ensureLoaded(opts).then(function () {
      RCC.token = opts.token;
      RCC.ownerId = profile.profileId;
      return _rccGetPage('');
    }).then(function (page) {
      if (!page || !page.success) { fail(); return; }
      RCC.page = page;
      body.innerHTML = '';
      draw(body, page, opts);
    }).catch(function () { fail(); });
    return panel;
  };
})();
