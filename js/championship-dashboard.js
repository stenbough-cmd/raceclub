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
      '.rcd-panel, .rcc-modal-overlay { --rc-red: #5f7d99; --rc-red-dark: #4b6680; }' +
      // Color tokens the popups read (league.css and championship.css set these on the page body, which this page does not have).
      '.rcc-modal-overlay { --rcl-bg: var(--rc-offwhite); --rcl-bg-raised: var(--rc-white); --rcl-bg-raised-2: var(--rc-offwhite); --rcl-line: var(--rc-silver);' +
      ' --rcl-line-bright: color-mix(in srgb, var(--rc-steel) 45%, var(--rc-white)); --rcl-ink: var(--rc-carbon); --rcl-ink-dim: var(--rc-steel);' +
      ' --rcl-ink-faint: color-mix(in srgb, var(--rc-steel) 75%, var(--rc-white)); --rcc-navy: var(--rc-balanced); --rcc-accent-light: #9db6cc; --rcc-true-red: #F21B0C;' +
      ' --rcl-gold: #e0b64c; --rcl-badge-news: #2f6f9f; --rcl-report-damage: #f5923b; --rcl-report-collision: #e8c547; --rcl-report-gain: #4fbf72; --rcl-report-fastest: #b07ce8; --rcl-bonus: #7fa8d4; color: var(--rcl-ink); }' +
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

    var row = mk('div', 'rcd-row');
    var left = mk('div', 'rcd-row-group');
    left.appendChild(btn(hasSeason ? 'Season Preview' : 'Welcome', true, hasSeason ? rccOpenSeasonPreview : rccOpenWelcomeTip));
    left.appendChild(btn('Choose Your Team', active, function () { rccOpenRegistration(); }, !hasSeason ? 'Create a season first.' : 'The season has ended.'));
    left.appendChild(btn('Help', true, rccOpenHelp));
    row.appendChild(left);
    row.appendChild(mk('div', 'rcd-spacer'));
    var right = mk('div', 'rcd-row-group');
    right.appendChild(btn('Create Season', !running, function () { rccOpenSeasonWizard(null); }, 'End your current season before creating a new one.', 'rc-btn-primary rc-btn-sm'));
    right.appendChild(btn('Edit Season', active, function () { rccOpenSeasonWizard(page.seasonId); }, 'No active season to edit.'));
    right.appendChild(btn('End Season', active, function () { rccOpenEndSeason(); }, 'No active season to end.'));
    right.appendChild(btn('Delete Season', hasSeason, function () { rccOpenDeleteSeason(); }, 'No season to delete.'));
    right.appendChild(btn('Upload Results', active && !!page.registration && anyEmpty, function () { rccOpenUpload(null, false); },
      !active ? 'No active season.' : (!page.registration ? 'Choose your team first.' : 'Every round already has results.')));
    right.appendChild(btn('Erase Results', active && anyResults, function () { rccOpenErase(); }, !active ? 'No active season.' : 'No results to erase yet.'));
    row.appendChild(right);
    panel.appendChild(row);

    var box = mk('div', 'rc-panel');
    var seasons = (page && page.seasons) || [];
    if (!seasons.length) {
      box.appendChild(mk('p', 'rcd-note', 'No championship seasons yet. Press Create Season to set up your first offline season.'));
    } else {
      seasons.forEach(function (s) {
        var st = statusOf(s);
        var line = mk('div', 'rcd-season');
        var name = mk('div', 'rcd-season-name', (s.seasonNumber ? 'Season ' + s.seasonNumber + ': ' : '') + (s.name || s.seasonId));
        line.appendChild(name);
        line.appendChild(mk('span', 'rcd-pill' + (st.active ? ' rcd-active' : ''), st.label));
        var open = mk('a', 'rc-btn-secondary rc-btn-sm rc-btn-row', 'Open');
        open.href = 'championship.html?id=' + encodeURIComponent(opts.profile.profileId) + '&season=' + encodeURIComponent(s.seasonId);
        line.appendChild(open);
        box.appendChild(line);
      });
    }
    panel.appendChild(box);
  }

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
    ensureLoaded(opts).then(function () {
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
