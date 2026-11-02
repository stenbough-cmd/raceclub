// Race Club -- js/championship-dashboard.js
// SINGLE PLAYER CHAMPIONSHIP container on the Account dashboard (ECO chat, 2026-11-01, the Championship and ECO chats were
// merged). It carries the championship season tools (Create / Edit / End / Delete Season, Upload / Erase Results, Season Preview,
// Choose Your Team) so a member can run their own offline championship from the dashboard.
//
// It does not copy those tools: it loads js/championship.js (the same file championship.html uses) in "embedded" mode and calls
// its popups (rccOpenSeasonWizard, rccOpenEndSeason, ...). Embedded mode (window.RCC_EMBEDDED) switches off championship.js's own
// page start-up and sends every "reload after save" back to this dashboard instead of the Championship page.
//
// Usage (Account.html): rcBuildChampionshipDashboard({ token, profile, withTooltip, showToast, reload }) -> the container element.
// Colors: the Championship page's gray-blue accent (blue-gray replaces the site red), not the red of the league containers.

(function () {
  var STYLE_ID = 'rcd-style';
  var CSS_FILES = ['css/league.css', 'css/driver-report.css', 'css/championship.css'].map(rcAsset);
  var JS_FILES = ['js/championship-help.js', 'js/car-picker.js', 'js/championship.js'].map(rcAsset);
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
      // Popups use the Championship page's own look: the light palette championship.css sets on that page's body
      // (body.rc-league-page.rcc-page), the blue-gray accent and the true-red header slash. The popup overlay carries the rcc-page class.
      '.rcc-modal-overlay { --rcl-bg: var(--rc-offwhite); --rcl-bg-raised: var(--rc-white); --rcl-bg-raised-2: var(--rc-offwhite); --rcl-line: var(--rc-silver);' +
      ' --rcl-line-bright: color-mix(in srgb, var(--rc-steel) 45%, var(--rc-white)); --rcl-ink: var(--rc-carbon); --rcl-ink-dim: var(--rc-steel);' +
      ' --rcl-ink-faint: color-mix(in srgb, var(--rc-steel) 75%, var(--rc-white)); --rcc-navy: var(--rc-balanced); --rcc-accent-light: #9db6cc; --rcc-true-red: #F21B0C;' +
      ' --rcl-gold: #e0b64c; --rcl-badge-news: #2f6f9f; --rcl-report-damage: #f5923b; --rcl-report-collision: #e8c547; --rcl-report-gain: #4fbf72; --rcl-report-fastest: #b07ce8; --rcl-bonus: #7fa8d4; color: var(--rcl-ink); }' +
      '.rcd-help { --rcc-navy: #34495c; --rcc-accent-light: #9db6cc; } .rcd-help-tab { --rc-red: #5f7d99; --rc-red-dark: #4b6680; }' +
      // Loading lights: the site's red lights, drawn straight on the container (no card of their own).
      '.rcd-panel .rc-inline-spinner-wrap { --rc-red: #F21B0C; --rc-red-dark: #c81509; background: none; border: 0; box-shadow: none; padding: 44px 0 40px; max-width: none; width: auto; }' +
      '.rcd-season-row { background: color-mix(in srgb, var(--rc-offwhite) 55%, var(--rc-white)); border-radius: 6px; padding-right: 12px; }' +
      '.rcd-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; justify-content: flex-end; margin-bottom: 14px; }' +
      '.rcd-row-group { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }' +
      '.rcd-spacer { flex: 1 1 20px; }' +
      '.rcd-season { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 2px; border-top: 1px solid var(--rc-silver); }' +
      '.rcd-season:first-child { border-top: 0; }' +
      '.rcd-pill { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; background: var(--rc-silver); color: var(--rc-carbon); }' +
      '.rcd-pill.rcd-active { background: var(--rc-red); color: #fff; }' +
      '.rcd-note { margin: 0 0 12px; font-size: 14px; line-height: 1.55; color: var(--rc-steel); }' +
      // Every button in the container centers its label the same way, whether it is a <button> or a link (View), with the same border
      // box (the primary button had no border, so it ran 2px shorter than its neighbours).
      '.rcd-panel .rc-btn-primary, .rcd-panel .rc-btn-secondary { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; text-align: center; line-height: normal; text-decoration: none; }' +
      '.rcd-panel .rc-btn-primary { border: 1px solid transparent; }' +
      '.rcd-panel .rc-btn-row { min-height: 28px; }' +
      // Popups look like the Account page popups (Edit Season in League Tools): plain white header, thin gray line, small bold title, a plain X,
      // no red slash or red line, and centered over the page body (right of the sidebar), not the whole screen.
      '.rcc-modal-overlay.rcc-page { background: rgba(23, 23, 23, 0.5); align-items: center; padding: 24px; z-index: 2000; }' +
      '@media (orientation: landscape) { .rcc-modal-overlay.rcc-page { padding-left: 244px; } }' +
      '.rcc-modal-overlay.rcc-page .rcl-modal-dialog { background: var(--rc-white); border: 0; border-radius: 10px; box-shadow: var(--rc-shadow-lg); padding: 0; max-width: 820px; max-height: calc(100vh - 48px); margin: 0; }' +
      '.rcc-modal-overlay.rcc-page .rcl-modal-dialog-wide { max-width: 820px; }' +
      '.rcc-modal-overlay.rcc-page .rcl-modal-dialog-narrow { max-width: 460px; }' +
      '.rcc-modal-overlay.rcc-page .rcl-modal-head { margin: 0; padding: 18px 20px; background: var(--rc-white); border-bottom: 1px solid var(--rc-silver); border-radius: 10px 10px 0 0; }' +
      '.rcc-modal-overlay.rcc-page .rcl-modal-body { padding: 20px; }' +
      '@media (orientation: portrait) { .rcc-modal-overlay.rcc-page { padding-left: 24px; } }';
    document.head.appendChild(s);
  }

  function loadCss(href) {
    if (document.querySelector('link[data-rcd-css="' + href + '"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-rcd-css', href);
    document.head.appendChild(l);
  }
  function loadScript(src) { return rcLoadScript(src); }
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

  // opts.page: the championship page the server already sent with the dashboard data. No page: fetch it now (from its data file).
  function fetchPage(opts, profileId) {
    return ensureLoaded(opts).then(function () {
      RCC.token = opts.token;
      RCC.ownerId = profileId;
      var res = opts.page;
      if (res) return res;
      // A page requested ahead of time (rcPrefetchChampionshipPage) is used once; a failed one is simply asked for again.
      var early = prefetched;
      prefetched = null;
      if (early) return early.catch(function () { return _rccGetPage(''); });
      return _rccGetPage('');
    });
  }

  // The dashboard asks for the championship file at the same moment it asks Apps Script for the rest, when this browser
  // last saw the switch ON (hint only). If the server then says OFF, the answer is just never used.
  var prefetched = null;
  window.rcPrefetchChampionshipPage = function (opts, profileId) {
    if (!opts || !opts.token || !profileId) return;
    prefetched = fetchPage({ token: opts.token, spinner: opts.spinner }, profileId);
    prefetched.catch(function () {});
  };

  // ON/OFF is stored per member on the server (Users.ChampEnabled). This browser only keeps a HINT of the last value, so the
  // championship scripts can start downloading early; it never decides what is shown.
  function hintKey(profileId) { return 'rc_champ_hint_' + profileId; }
  window.rcChampHint = function (profileId) {
    try { return !!profileId && localStorage.getItem(hintKey(profileId)) === '1'; } catch (e) { return false; }
  };
  window.rcSetChampHint = function (profileId, on) {
    try { if (on) localStorage.setItem(hintKey(profileId), '1'); else localStorage.removeItem(hintKey(profileId)); } catch (e) { /* ignore */ }
  };
  window.rcPreloadChampionshipScripts = function (opts) { var p = ensureLoaded(opts || {}); p.catch(function () {}); };

  // "Set up" = the season exists but the driver has not chosen a team and car yet; "In progress" = a car is chosen.
  function statusOf(s, hasTeam) {
    if (s.status === 'Completed') return { label: s.unfinished ? 'Ended early' : 'Finished', active: false };
    return { label: hasTeam ? 'In progress' : 'Set up', active: true };
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
    var seasons = (page && page.seasons) || [];

    // "YOUR SEASONS" title with a count pill and a blue-gray rule, then the Create / End / Delete buttons (Matt's redesign, 2026-11-02).
    var sHead = mk('div', 'rcd-seasons-head');
    sHead.appendChild(mk('div', 'rcd-seasons-title', 'Your seasons'));
    sHead.appendChild(mk('div', 'rcd-count-pill', seasons.length + (seasons.length === 1 ? ' season' : ' seasons')));
    panel.appendChild(sHead);
    var row = mk('div', 'rcd-row');
    row.appendChild(btn('+ Create Season', !running, function () { rccOpenSeasonWizard(null); }, 'End the current season before creating a new one.', 'rc-btn-primary rc-btn-sm'));
    row.appendChild(btn('End Season', active, function () { rccOpenEndSeason(); }, 'No season is currently eligible to end.'));
    row.appendChild(btn('Delete Season', hasSeason, function () { rccOpenDeleteSeason(); }, 'No season is currently eligible to delete.'));
    panel.appendChild(row);

    function rowBtn(label, enabled, onClick, why) { return btn(label, enabled, onClick, why, 'rc-btn-secondary rc-btn-row'); }
    var seriesLabel = (page.seasonDetails && page.seasonDetails.series) || '';

    function niceDate(iso) {
      var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
      if (!m) return '';
      try { return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return m[0]; }
    }

    // One round (white row inside the calendar list): number pill, event name, "Track · Series", status line and status circle.
    var firstEmpty = cal.filter(function (x) { return !x.hasResults; })[0];
    var doneRounds = cal.filter(function (x) { return x.hasQualifyResults || x.hasRaceResults; });
    var lastDone = doneRounds[doneRounds.length - 1];
    function roundRow(c, readOnly, forSeries) {
      var r = mk('div', 'rcd-round');
      var top = mk('div', 'rcd-round-top');
      top.appendChild(mk('span', 'rcd-round-num', (c.roundNum < 10 ? '0' : '') + c.roundNum));
      var col = mk('div', 'rcd-round-main');
      col.appendChild(mk('div', 'rcd-round-name', c.eventName || c.track || ('Round ' + c.roundNum)));
      var bits = [];
      if (c.track) bits.push(c.track);
      var sr = forSeries || seriesLabel;
      if (sr) bits.push(sr); else if (c.layout) bits.push(c.layout);
      col.appendChild(mk('div', 'rcd-round-sub', bits.join(' · ') || 'Track not set'));
      top.appendChild(col);
      var icon, text, tone = '';
      if (c.hasResults) { text = 'Results uploaded · Standings updated'; tone = ' rcd-round-status-ok'; icon = mk('span', 'rc-protest-dash-icon rc-statuscircle-green', '✓'); }
      else if (c.hasQualifyResults || c.hasRaceResults) { text = c.hasRaceResults ? 'Race results uploaded · Awaiting qualifying results' : 'Qualifying results uploaded · Awaiting race results'; tone = ' rcd-round-status-part'; icon = mk('span', 'rc-protest-dash-icon rc-statuscircle-yellow'); }
      else { text = 'Awaiting results'; icon = mk('span', 'rc-protest-dash-icon rc-protest-dash-icon-pending'); }
      top.appendChild(icon);
      r.appendChild(top);
      r.appendChild(mk('div', 'rcd-round-status' + tone, text));
      if (active && !readOnly) {
        var bg = mk('div', 'rcd-round-actions');
        var canUp = !!page.registration && firstEmpty && firstEmpty.roundId === c.roundId;
        bg.appendChild(rowBtn('Upload Results', canUp, function () { rccOpenUpload(c.roundId, true); },
          c.hasResults ? 'Results already uploaded for this round. Erase them first to upload again.' : (!page.registration ? 'Choose your team first.' : 'Upload the earlier rounds first.')));
        bg.appendChild(rowBtn('Erase Results', !!lastDone && lastDone.roundId === c.roundId, function () { rccOpenErase(); },
          (c.hasQualifyResults || c.hasRaceResults) ? 'Only the latest round with results can be erased.' : 'No results uploaded for this round.'));
        r.appendChild(bg);
      }
      return r;
    }
    function calendarBlock(rounds, ro, forSeries) {
      var wrap = mk('div', 'rcd-cal');
      var ch = mk('div', 'rcd-cal-head');
      ch.appendChild(mk('div', 'rcd-cal-title', 'Championship calendar'));
      ch.appendChild(mk('div', 'rcd-cal-count', rounds.length + (rounds.length === 1 ? ' round' : ' rounds')));
      wrap.appendChild(ch);
      var list = mk('div', 'rcd-cal-list');
      if (!rounds.length) list.appendChild(mk('div', 'rc-dm-empty', 'No rounds in this season.'));
      rounds.forEach(function (c) { list.appendChild(roundRow(c, ro, forSeries)); });
      wrap.appendChild(list);
      return wrap;
    }

    var box = mk('div', 'rcd-list');
    if (!seasons.length) {
      box.appendChild(mk('div', 'rc-dm-empty', 'No seasons yet. Press Create Season above to start your first one, or open the Help guide for a walkthrough.'));
    } else {
      seasons.forEach(function (s) {
        var year = s.createdAt ? String(s.createdAt).slice(0, 4) : 'Unknown Year';
        var isCurrent = s.seasonId === page.seasonId;
        var st = statusOf(s, isCurrent && !!page.registration);
        var container = mk('div', 'rcd-season-box');
        var top = mk('div', 'rcd-season-top');
        top.appendChild(mk('span', 'rc-badge-chip rc-badge-graphite', year));
        top.appendChild(mk('span', 'rcd-status-pill ' + ((st.label === 'In progress' || st.label === 'Finished') ? 'rcd-status-ok' : 'rcd-status-neutral'), st.label));
        container.appendChild(top);
        container.appendChild(mk('div', 'rcd-season-name', (s.seasonNumber ? 'Season ' + s.seasonNumber : 'Season') + (s.name ? ': ' + s.name : '')));
        var meta = [];
        if (isCurrent && cal.length) meta.push(cal.filter(function (c) { return c.hasResults; }).length + ' rounds completed');
        else if (s.raceCount != null) meta.push(s.raceCount + (s.raceCount === 1 ? ' round' : ' rounds'));
        if (s.createdAt) meta.push('Created ' + niceDate(s.createdAt));
        container.appendChild(mk('div', 'rcd-season-meta', meta.join(' · ')));
        var bg = mk('div', 'rcd-season-actions');
        if (isCurrent) {
          bg.appendChild(rowBtn('Edit Season', active, function () { rccOpenSeasonWizard(page.seasonId); }, 'This season has ended, so its details can no longer be edited.'));
          bg.appendChild(rowBtn(hasSeason ? 'Season Preview' : 'Welcome', true, hasSeason ? rccOpenSeasonPreview : rccOpenWelcomeTip));
          bg.appendChild(rowBtn('Choose Your Team', active && !page.registration, function () { rccOpenRegistration(); }, page.registration ? 'You have already chosen your team for this season.' : 'The season has ended.'));
          // Before the first result is imported, the seat can be given back.
          if (page.registration && page.registration.canDropOut) bg.appendChild(rowBtn('Drop Out', active, function () { rccOpenDropOut(); }, 'This season has ended.'));
        }
        // A past season: its own Season Preview, and its rounds (read only) behind the arrow. Both come from that
        // season's own page, fetched the first time either is used (an ended season is read from its saved file).
        var pastPage = null, pastLoading = null;
        function loadPast() {
          if (pastPage) return Promise.resolve(pastPage);
          if (!pastLoading) {
            pastLoading = _rccGetPage(s.seasonId).then(function (pg) {
              if (!pg || !pg.success) throw new Error('load');
              pastPage = pg;
              return pg;
            });
            pastLoading.catch(function () { pastLoading = null; });
          }
          return pastLoading;
        }
        if (!isCurrent) {
          var pvBtn = rowBtn('Season Preview', true, function () {
            pvBtn.disabled = true;
            loadPast().then(function (pg) {
              pvBtn.disabled = false;
              // rccOpenSeasonPreview reads RCC.page: point it at this season for the moment the popup is built
              var keep = RCC.page;
              RCC.page = pg;
              try { rccOpenSeasonPreview(); } finally { RCC.page = keep; }
            }).catch(function () {
              pvBtn.disabled = false;
              if (typeof showToast === 'function') showToast('Could not load this season right now.', 'error');
            });
          });
          bg.appendChild(pvBtn);
        }
        var open = mk('a', 'rc-btn-primary rc-btn-row rcd-view-btn', 'View Season →');
        open.href = 'championship.html?id=' + encodeURIComponent(opts.profile.profileId) + '&season=' + encodeURIComponent(s.seasonId);
        bg.appendChild(open);
        container.appendChild(bg);
        if (isCurrent && cal.length) {
          container.appendChild(calendarBlock(cal, false, ''));
        }
        if (!isCurrent) {
          var racesBox = mk('div', 'rcd-past-rounds');
          racesBox.style.display = 'none';
          var pastToggle = mk('button', 'rc-disclosure-btn rcd-past-toggle');
          pastToggle.innerHTML = CHEVRON; pastToggle.type = 'button';
          pastToggle.setAttribute('aria-expanded', 'false'); pastToggle.setAttribute('aria-label', 'Show rounds');
          var pastFilled = false;
          pastToggle.addEventListener('click', function () {
            var isOpen = racesBox.style.display !== 'none';
            racesBox.style.display = isOpen ? 'none' : '';
            pastToggle.classList.toggle('rc-disclosure-open', !isOpen);
            pastToggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
            pastToggle.setAttribute('aria-label', isOpen ? 'Show rounds' : 'Hide rounds');
            if (isOpen || pastFilled) return;
            pastFilled = true;
            racesBox.innerHTML = '';
            racesBox.appendChild(mk('div', 'rc-hint', 'Loading rounds...'));
            loadPast().then(function (pg) {
              racesBox.innerHTML = '';
              racesBox.appendChild(calendarBlock(pg.calendar || [], true, (pg.seasonDetails && pg.seasonDetails.series) || ''));
            }).catch(function () {
              pastFilled = false;
              racesBox.innerHTML = '';
              racesBox.appendChild(mk('div', 'rc-hint', 'Could not load the rounds right now. Close and open the arrow to try again.'));
            });
          });
          bg.appendChild(pastToggle);
          container.appendChild(racesBox);
        }
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
      CSS_FILES.forEach(loadCss);
      helpLoading = loadScript(rcAsset('js/championship-help.js'));
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
    var panel = mk('div', 'rcd-panel rc-collapsed');
    var head = mk('div', 'rcd-head');
    var headText = mk('div', 'rcd-head-text');
    headText.appendChild(mk('div', 'rcd-eyebrow', 'Single Player'));
    headText.appendChild(mk('div', 'rcd-title', 'Your championships.'));
    // Loads collapsed (Matt, 2026-11-03): only this header shows until the arrow in front of the subtitle is pressed.
    var subRow = mk('div', 'rc-coll-sub');
    var toggle = mk('button', 'rc-disclosure-btn');
    toggle.type = 'button';
    toggle.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Show your championships');
    toggle.addEventListener('click', function () {
      var collapsed = panel.classList.toggle('rc-collapsed');
      toggle.classList.toggle('rc-disclosure-open', !collapsed);
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    });
    subRow.appendChild(toggle);
    subRow.appendChild(mk('p', 'rcd-sub', 'Create, manage and follow your own racing seasons.'));
    headText.appendChild(subRow);
    head.appendChild(headText);
    var flag = mk('div', 'rcd-flag');
    flag.setAttribute('aria-hidden', 'true');
    flag.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4h12l-2 4 2 4H5"></path></svg>';
    head.appendChild(flag);
    panel.appendChild(head);
    var body = mk('div', 'rc-coll-body');
    panel.appendChild(body);
    // Own loading markup, drawn straight on the container (no card, no popup look): the site's start lights in the site red.
    // The red is set inline on the element so nothing else on the page can recolor it.
    var spin = mk('div', 'rcd-loading');
    spin.style.cssText = '--rc-red:#F21B0C;--rc-red-dark:#c81509;display:flex;flex-direction:column;align-items:center;gap:16px;padding:44px 0 40px;background:none;border:0;box-shadow:none;';
    var spinLights = mk('div', 'rc-startlights');
    for (var li = 0; li < 5; li++) spinLights.appendChild(mk('span', 'rc-startlight'));
    spin.appendChild(spinLights);
    spin.appendChild(mk('div', 'rc-loading-text', 'Loading your championship...'));
    body.appendChild(spin);
    function fail(msg) {
      body.innerHTML = '';
      body.appendChild(mk('p', 'rcd-note', msg || 'Could not load your championship right now. Refresh the page to try again.'));
    }
    var profile = opts.profile || {};
    if (!opts.token || !profile.profileId) { fail('Log in to use the championship tools.'); return panel; }
    // panel.rcdReady settles once the championship data is drawn (or failed), so the page can show it together with the league cards.
    panel.rcdReady = fetchPage(opts, profile.profileId).then(function (page) {
      if (!page || !page.success) { fail(); return; }
      RCC.page = page;
      body.innerHTML = '';
      draw(body, page, opts);
    }).catch(function () { fail(); });
    return panel;
  };
})();
