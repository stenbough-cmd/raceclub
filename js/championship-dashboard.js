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

    // Same layout as the League Tools Seasons panel: one right-aligned button row, then the list in its own bordered box,
    // grouped under year pills, one .rc-group-row per season with the name and a gray meta line.
    var row = mk('div', 'rcd-row');
    row.appendChild(btn('Create Season', !running, function () { rccOpenSeasonWizard(null); }, 'End your current season before creating a new one.', 'rc-btn-primary rc-btn-sm'));
    row.appendChild(btn(hasSeason ? 'Season Preview' : 'Welcome', true, hasSeason ? rccOpenSeasonPreview : rccOpenWelcomeTip));
    row.appendChild(btn('Choose Your Team', active, function () { rccOpenRegistration(); }, !hasSeason ? 'Create a season first.' : 'The season has ended.'));
    row.appendChild(btn('Edit Season', active, function () { rccOpenSeasonWizard(page.seasonId); }, 'No active season to edit.'));
    row.appendChild(btn('End Season', active, function () { rccOpenEndSeason(); }, 'No active season to end.'));
    row.appendChild(btn('Delete Season', hasSeason, function () { rccOpenDeleteSeason(); }, 'No season to delete.'));
    row.appendChild(btn('Upload Results', active && !!page.registration && anyEmpty, function () { rccOpenUpload(null, false); },
      !active ? 'No active season.' : (!page.registration ? 'Choose your team first.' : 'Every round already has results.')));
    row.appendChild(btn('Erase Results', active && anyResults, function () { rccOpenErase(); }, !active ? 'No active season.' : 'No results to erase yet.'));
    panel.appendChild(row);

    var box = mk('div', 'rc-panel');
    var seasons = (page && page.seasons) || [];
    if (!seasons.length) {
      box.appendChild(mk('div', 'rc-dm-empty', 'No seasons yet.'));
    } else {
      var lastYear = null;
      seasons.forEach(function (s) {
        var year = s.createdAt ? String(s.createdAt).slice(0, 4) : 'Seasons';
        if (year !== lastYear) {
          var head = mk('div', 'rc-group-head');
          head.appendChild(mk('span', 'rc-badge-chip rc-badge-graphite', year));
          box.appendChild(head);
          lastYear = year;
        }
        var st = statusOf(s);
        var line = mk('div', 'rc-group-row');
        var info = mk('div', 'rc-dm-row-info');
        var textCol = mk('div', '');
        textCol.appendChild(mk('span', 'rc-dm-row-label', (s.seasonNumber ? 'Season ' + s.seasonNumber : 'Season') + (s.name ? ': ' + s.name : '')));
        var meta = [st.label];
        if (s.raceCount != null) meta.push(s.raceCount + ' race' + (s.raceCount === 1 ? '' : 's'));
        if (s.createdAt) meta.push('Created ' + String(s.createdAt).slice(0, 10));
        textCol.appendChild(mk('div', 'rc-hint', meta.join(' \u00B7 ')));
        info.appendChild(textCol);
        line.appendChild(info);
        var open = mk('a', 'rc-btn-secondary rc-btn-row', 'Open');
        open.href = 'championship.html?id=' + encodeURIComponent(opts.profile.profileId) + '&season=' + encodeURIComponent(s.seasonId);
        open.style.cssText = 'flex:none;text-decoration:none;';
        line.appendChild(open);
        box.appendChild(line);
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
