// Race Club -- js/profile-page.js. The lower rows of profile.html (Career Stats, Form Guide,
// Season Stats, Story Mentions, Rivalries, Team History). League racing only. Data comes from three
// public Apps Script ops (DriverProfilePage.gs): getDriverProfilePage, getDriverProfileRivals and
// getDriverProfileRound. Each response is saved in this browser and redrawn instantly next visit,
// then quietly refreshed (same idea as profile.js). The top-left driver card is profile.js.
(function () {
  var params = new URLSearchParams(window.location.search);
  var profileId = (params.get('id') || '').trim();
  if (!/^RC-\d+$/.test(profileId)) return;

  // ---- small helpers ----------------------------------------------------------------------------
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function tx(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; e.textContent = text == null ? '' : String(text); return e; }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function num(v, d) { return v === null || v === undefined || isNaN(v) ? '--' : (d === undefined ? String(v) : Number(v).toFixed(d)); }
  function saveLocal(key, obj) { try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) { /* storage blocked: fine */ } }
  function readLocal(key) { try { var s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function ord(n) { n = Number(n); if (!n) return '--'; var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

  // championship-report.js was written for the Championship page and calls these four helpers, which
  // live in championship.js. They are copied here (same behavior) so the report can be drawn.
  if (typeof window._rccEl !== 'function') window._rccEl = el;
  if (typeof window._rccText !== 'function') window._rccText = tx;
  if (typeof window._rccEsc !== 'function') window._rccEsc = esc;
  if (typeof window._rccLapTime !== 'function') {
    window._rccLapTime = function (raw) {
      var t = Number(raw);
      if (raw === null || raw === undefined || raw === '' || isNaN(t) || t <= 0) return '--';
      var ms = Math.round(t * 1000), m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), r = ms % 1000;
      return m + ':' + (s < 10 ? '0' : '') + s + '.' + ('00' + r).slice(-3);
    };
  }
  if (typeof window._rccEventTime !== 'function') {
    window._rccEventTime = function (seconds) {
      if (seconds === null || seconds === undefined || isNaN(seconds)) return '';
      var total = Math.max(0, Math.floor(seconds)), h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
      return (h ? h + ':' + ('0' + m).slice(-2) : m) + ':' + ('0' + s).slice(-2);
    };
  }

  // One shared hover tooltip for the Form Guide squares.
  var tip = el('div', 'rdp-tip');
  document.body.appendChild(tip);
  function showTip(target, html) {
    tip.innerHTML = html;
    tip.style.display = 'block';
    var r = target.getBoundingClientRect();
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
    var top = r.top - h - 8;
    if (top < 8) top = r.bottom + 8;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  function showTipXY(x, bottomY, html) {
    tip.innerHTML = html;
    tip.style.display = 'block';
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = Math.min(Math.max(8, x - w / 2), window.innerWidth - w - 8);
    var top = bottomY - h - 6;
    if (top < 8) top = 8;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  function hideTip() { tip.style.display = 'none'; }

  var NO_ENTRY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/></svg>';
  function emptyBlock(title, sub) {
    var w = el('div', 'rdp-empty');
    w.innerHTML = NO_ENTRY_SVG;
    w.appendChild(tx('div', 'rdp-empty-title', title));
    w.appendChild(tx('div', 'rdp-empty-sub', sub));
    return w;
  }

  // ---- Row 1: seat line + achievements ---------------------------------------------------------
  // Car picture, "TEAM NAME #85" and the maker logo + car name + class pill line. One builder for the
  // driver card (top left) and the Team History cards so they always match.
  function seatCarImg(seat) {
    var full = typeof rcCarImageSrc === 'function' ? rcCarImageSrc(seat.carYear, seat.carNumber, seat.carSeries) : '';
    if (!full) return null;
    var img = el('img', 'rdp-team-car');
    img.alt = '';
    var triedFull = false;
    img.onerror = function () { if (!triedFull) { triedFull = true; img.src = full; return; } img.style.display = 'none'; };
    img.src = full.replace('assets/cars/', 'assets/cars/small/');
    return img;
  }
  function seatNameEl(seat) {
    return tx('div', 'rdp-team-name', (seat.team || 'Team') + (seat.carNumber ? ' #' + seat.carNumber : ''));
  }
  function seatModelEl(seat) {
    var model = el('div', 'rdp-team-model');
    if (seat.manufacturer && typeof manufacturerLogoSrc === 'function') {
      var logo = el('img', 'rdp-team-logo');
      logo.alt = seat.manufacturer;
      logo.src = manufacturerLogoSrc(seat.manufacturer, 'white');
      manufacturerLogoFallback(logo, seat.manufacturer, function () { logo.style.display = 'none'; });
      model.appendChild(logo);
    }
    model.appendChild(tx('span', 'rdp-team-model-name', seat.carModel || ''));
    if (seat.carClass) {
      var pillColors = { LMGTE: 'rc-badge-lmgte', LMGT3: 'rc-badge-lmgt3', LMP3: 'rc-badge-lmp3', LMP2: 'rc-badge-lmp2', Hypercar: 'rc-badge-hypercar' };
      model.appendChild(tx('span', 'rc-badge-chip rc-badge-chip-abbrev' + (pillColors[seat.carClass] ? ' ' + pillColors[seat.carClass] : ''), seat.carClass === 'Hypercar' ? 'HY' : seat.carClass));
    }
    return model;
  }
  function renderSeat(data) {
    var box = $('rdp-seat');
    var latest = (data.seasons || [])[0];
    var seat = latest ? latest.seat : null;
    box.innerHTML = '';
    box.appendChild(tx('div', 'rdp-seat-label', 'Current Seat'));
    if (!seat || (!seat.team && !seat.carNumber)) {
      box.appendChild(tx('div', 'rdp-team-name', 'NONE'));
      box.hidden = false;
      return;
    }
    box.appendChild(seatNameEl(seat));
    box.appendChild(seatModelEl(seat));
    box.hidden = false;
  }
  function renderAchievements(data) {
    var a = data.achievements || {};
    var items = [['Races Entered', a.racesEntered], ['Wins', a.wins], ['Podiums', a.podiums], ['Avg. Finish', a.avgFinish === null || a.avgFinish === undefined ? '--' : Number(a.avgFinish).toFixed(1)], ['Pole Positions', a.poles], ['Fastest Laps', a.fastestLaps]];
    var grid = $('rdp-ach-grid');
    grid.innerHTML = '';
    items.forEach(function (it) {
      var box = el('div', 'rdp-ach');
      box.appendChild(tx('div', 'rdp-ach-value', it[1] === null || it[1] === undefined ? 0 : it[1]));
      box.appendChild(tx('div', 'rdp-ach-label', it[0]));
      grid.appendChild(box);
    });
    $('rdp-achievements').hidden = false;
  }

  // ---- Row 2: Form Guide ----------------------------------------------------------------------
  // Form guide: 20, 10 or 5 squares on ONE line, spread evenly across the card, whichever fits the page
  // width (never fewer than 5 unless the driver has raced fewer). It never wraps into rows.
  var formList = [];
  function fitForm() {
    var wrap = $('rdp-form-squares');
    if (!formList.length || !wrap) return;
    var body = wrap.parentNode;
    var cs = window.getComputedStyle(body);
    var avail = body.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    var first = wrap.firstChild;
    var sqW = first ? first.getBoundingClientRect().width || 42 : 42;
    var minGap = 8;
    var fit = Math.floor((avail + minGap) / (sqW + minGap));
    var n = formList.length;
    var steps = [20, 10, 5];
    var pick = 0;
    for (var i = 0; i < steps.length; i++) { if (steps[i] <= formList.length && steps[i] <= fit) { pick = steps[i]; break; } }
    n = pick || Math.min(formList.length, Math.max(1, fit));
    var start = formList.length - n;
    Array.prototype.forEach.call(wrap.children, function (sq, i) { sq.style.display = i < start ? 'none' : ''; });
    wrap.classList.toggle('rdp-form-spread', n >= 5);
  }
  function renderForm(data) {
    var panel = $('rdp-form');
    var list = (data.form || []).slice(-20);
    if (!list.length) { panel.hidden = true; return; }
    formList = list;
    var wrap = $('rdp-form-squares');
    wrap.innerHTML = '';
    list.forEach(function (r) {
      var cls = 'rdp-form-sq' + (r.finish === 1 ? ' rdp-form-p1' : r.finish === 2 ? ' rdp-form-p2' : r.finish === 3 ? ' rdp-form-p3' : '');
      var sq = tx('div', cls, r.finish === null || r.finish === undefined ? '--' : r.finish);
      var place = (r.track || '') + (r.layout ? ': ' + r.layout : '');
      var html = '<div><b>' + esc(r.seasonName) + '</b></div><div class="rdp-tip-line"><b>' + esc(r.eventName || ('Round ' + r.roundNum)) + '</b>' + (place ? ' ' + esc(place) : '') + '</div>';
      sq.addEventListener('mouseenter', function () { showTip(sq, html); });
      sq.addEventListener('mouseleave', hideTip);
      sq.addEventListener('click', function () { showTip(sq, html); setTimeout(hideTip, 2200); });
      wrap.appendChild(sq);
    });
    panel.hidden = false;
    fitForm();
  }
  window.addEventListener('resize', fitForm);

  // ---- Row 3: Season Stats --------------------------------------------------------------------
  var SVGNS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs, text) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function chartBox(title, sub) {
    var box = el('div', 'rdp-chart');
    box.appendChild(tx('div', 'rcl-standings-class-header rdp-chart-bar', String(title).toUpperCase()));
    return box;
  }
  function noChartData(box, msg) { box.appendChild(tx('div', 'rdp-chart-sub', msg)); return box; }

  // Points trend: cumulative championship points after each scored round.
  function pointsChart(season) {
    var box = chartBox('Points Trend');
    var t = season.trend || [];
    if (t.length < 1) return noChartData(box, 'No scored rounds yet.');
    var W = 300, H = 170, L = 30, R = 10, T = 12, B = 24;
    var maxV = Math.max.apply(null, t.map(function (p) { return p.points; })) || 1;
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'rdp-svg' });
    [0, 0.5, 1].forEach(function (f) {
      var y = T + (H - T - B) * (1 - f);
      svg.appendChild(sv('line', { x1: L, x2: W - R, y1: y, y2: y, 'class': 'rdp-grid-line' }));
      svg.appendChild(sv('text', { x: L - 4, y: y + 3, 'text-anchor': 'end', 'class': 'rdp-axis' }, String(Math.round(maxV * f))));
    });
    var pts = t.map(function (p, i) {
      var x = t.length === 1 ? (L + W - R) / 2 : L + (W - L - R) * i / (t.length - 1);
      var y = T + (H - T - B) * (1 - p.points / maxV);
      return { x: x, y: y, p: p };
    });
    svg.appendChild(sv('polyline', { points: pts.map(function (q) { return q.x + ',' + q.y; }).join(' '), fill: 'none', stroke: '#d7261e', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
    pts.forEach(function (q, i) {
      var c = sv('circle', { cx: q.x, cy: q.y, r: 3.6, fill: '#d7261e', stroke: '#17181a', 'stroke-width': 1.5, 'class': 'rdp-dot' });
      var rd = (season.rounds || []).filter(function (r) { return r.roundId === q.p.roundId; })[0];
      var fin = rd && rd.finish ? ', P' + rd.finish : '';
      var tipHtml = '<div><b>Round ' + esc(q.p.roundNum) + '</b> ' + esc(q.p.track || q.p.eventName || '') + ': ' + esc(q.p.points) + ' pts' + fin + '</div>' + (q.p.pos ? '<div class="rdp-tip-line">Championship: P' + esc(q.p.pos) + '</div>' : '');
      c.addEventListener('mouseenter', function () { showTip(c, tipHtml); });
      c.addEventListener('mouseleave', hideTip);
      svg.appendChild(c);
      if (t.length <= 12 || i % 2 === 0 || i === t.length - 1) svg.appendChild(sv('text', { x: q.x, y: H - 8, 'text-anchor': 'middle', 'class': 'rdp-axis' }, q.p.label));
    });
    box.appendChild(svg);
    return box;
  }

  // Finish vs start: two bars per round (gray = start, colour = finish). A taller bar is a better place.
  function startFinishChart(season) {
    var box = chartBox('Finish vs. Start');
    var rs = (season.rounds || []).filter(function (r) { return !r.dnp && r.finish !== null && r.finish !== undefined; });
    if (!rs.length) return noChartData(box, 'No finished races yet.');
    var W = 300, H = 170, L = 30, R = 10, T = 12, B = 24;
    var maxP = 2;
    rs.forEach(function (r) { maxP = Math.max(maxP, r.finish, r.grid || 0); });
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'rdp-svg' });
    var plotH = H - T - B, base = H - B;
    var hOf = function (p) { return plotH * (maxP - p + 1) / maxP; };
    [1, Math.ceil((maxP + 1) / 2), maxP].filter(function (v, i, a) { return a.indexOf(v) === i; }).forEach(function (p) {
      var y = base - hOf(p);
      svg.appendChild(sv('line', { x1: L, x2: W - R, y1: y, y2: y, 'class': 'rdp-grid-line' }));
      svg.appendChild(sv('text', { x: L - 4, y: y + 3, 'text-anchor': 'end', 'class': 'rdp-axis' }, 'P' + p));
    });
    var topY = base;
    rs.forEach(function (r) { var hh = Math.max(hOf(r.finish), r.grid !== null && r.grid !== undefined ? hOf(r.grid) : 0); topY = Math.min(topY, base - hh); });
    var slot = (W - L - R) / rs.length;
    var bw = Math.max(3, Math.min(14, slot * 0.36));
    rs.forEach(function (r, i) {
      var cx = L + slot * (i + 0.5);
      var hasGrid = r.grid !== null && r.grid !== undefined;
      var color = !hasGrid ? '#9aa0a6' : r.finish < r.grid ? '#3fae6b' : r.finish > r.grid ? '#d7261e' : '#9aa0a6';
      var tipHtml = '<div><b>Round ' + esc(r.roundNum) + '</b> ' + esc(r.track || r.eventName || '') + '</div><div class="rdp-tip-line">Started ' + (hasGrid ? 'P' + esc(r.grid) : '--') + ', finished P' + esc(r.finish) + '</div>';
      var g = sv('g', { 'class': 'rdp-bar-pair' });
      if (hasGrid) g.appendChild(sv('rect', { x: cx - bw - 1, y: base - hOf(r.grid), width: bw, height: hOf(r.grid), rx: 1.5, fill: '#5b6470' }));
      g.appendChild(sv('rect', { x: hasGrid ? cx + 1 : cx - bw / 2, y: base - hOf(r.finish), width: bw, height: hOf(r.finish), rx: 1.5, fill: color }));
      g.appendChild(sv('rect', { x: cx - slot / 2, y: T, width: slot, height: plotH, fill: 'transparent' }));
      g.addEventListener('mouseenter', function () {
        var box = svg.getBoundingClientRect(), k = box.width / W;
        showTipXY(box.left + cx * k, box.top + topY * k, tipHtml);
      });
      g.addEventListener('mouseleave', hideTip);
      svg.appendChild(g);
      if (rs.length <= 12 || i % 2 === 0 || i === rs.length - 1) svg.appendChild(sv('text', { x: cx, y: H - 8, 'text-anchor': 'middle', 'class': 'rdp-axis' }, 'R' + r.roundNum));
    });
    box.appendChild(svg);
    return box;
  }

  function tile(label, value, sub) {
    var t = el('div', 'rdp-tile');
    t.appendChild(tx('div', 'rdp-tile-label', label));
    t.appendChild(tx('div', 'rdp-tile-value', value));
    if (sub) t.appendChild(tx('div', 'rdp-tile-sub', sub));
    return t;
  }

  var roundCache = {};
  function loadRound(roundId) {
    if (roundCache[roundId]) return Promise.resolve(roundCache[roundId]);
    return fetchApi('getDriverProfileRound', { params: { profileId: profileId, roundId: roundId }, timeoutMs: 60000 }).then(function (res) {
      if (res && res.success) roundCache[roundId] = res;
      return res;
    });
  }

  // My Laps: same table the Championship race recap shows, drawn on the dark card.
  function drawMyLaps(sessions, host) {
    host.innerHTML = '';
    if (!sessions || !sessions.length) { host.appendChild(tx('div', 'rdp-empty-sub', 'None of your laps were imported for this round.')); return; }
    sessions.forEach(function (s) {
      var w = el('div', 'rcl-race-class');
      var title = (s.kind === 'race' ? 'Race' : 'Qualifying') + ' · P' + (s.classPosition || '-') + ' in class · Best ' + window._rccLapTime(s.bestLapTime) + (s.kind === 'race' ? ' · ' + s.pitstops + ' stop' + (s.pitstops === 1 ? '' : 's') : '');
      w.appendChild(tx('div', 'rcl-standings-class-header', title.toUpperCase()));
      var table = el('div', 'rcc-laps-table');
      var head = el('div', 'rcc-laps-row rcc-laps-head');
      ['Lap', 'Pos', 'Lap Time', 'S1', 'S2', 'S3', 'Top Speed', 'Fuel', 'Tires (FL FR RL RR)', 'Compound'].forEach(function (t) { head.appendChild(tx('div', null, t)); });
      table.appendChild(head);
      var best = Infinity;
      s.laps.forEach(function (l) { var t = Number(l.lapTime); if (t > 0 && t < best) best = t; });
      s.laps.forEach(function (l) {
        var r = el('div', 'rcc-laps-row' + (Number(l.lapTime) === best ? ' rcc-laps-best' : '') + (l.pit ? ' rcc-laps-pit' : ''));
        var lt = window._rccLapTime;
        r.appendChild(tx('div', null, String(l.lapNum) + (l.pit ? ' PIT' : '')));
        r.appendChild(tx('div', null, l.positionAtLap ? 'P' + l.positionAtLap : '--'));
        r.appendChild(tx('div', null, lt(l.lapTime)));
        r.appendChild(tx('div', null, lt(l.sector1)));
        r.appendChild(tx('div', null, lt(l.sector2)));
        r.appendChild(tx('div', null, lt(l.sector3)));
        r.appendChild(tx('div', null, l.topSpeed ? Number(l.topSpeed).toFixed(1) : '--'));
        r.appendChild(tx('div', null, l.fuel !== '' && l.fuel !== null ? Math.round(Number(l.fuel) * 100) + '%' : '--'));
        r.appendChild(tx('div', null, [l.tireWearFL, l.tireWearFR, l.tireWearRL, l.tireWearRR].map(function (v) { return v === '' || v === null ? '--' : Math.round(Number(v) * 100); }).join(' ')));
        r.appendChild(tx('div', null, String(l.frontCompound || '').replace(/^\d+,/, '')));
        table.appendChild(r);
      });
      w.appendChild(table);
      if ((s.events || []).length) {
        var evs = el('div', 'rcc-laps-events');
        evs.appendChild(tx('div', 'rcl-race-class-name', 'Your Events'));
        s.events.forEach(function (ev) {
          var line = el('p', 'rcl-report-line');
          var et = Number(ev.elapsedTime);
          if (!isNaN(et)) line.appendChild(tx('span', 'rcl-report-timestamp', window._rccEventTime(et - (s.greenFlagEt || 0))));
          line.appendChild(document.createTextNode(' ' + eventText(ev)));
          evs.appendChild(line);
        });
        w.appendChild(evs);
      }
      host.appendChild(w);
    });
  }
  function eventText(ev) {
    var d = ev.detail || {}, who = d.DriverName || '', pen = d.PenaltyType || 'a';
    if (ev.eventType === 'SimPenaltyIssued') return (who + ' received ' + pen + ' penalty').trim();
    if (ev.eventType === 'SimPenaltyServed') {
      var lost = ev.lostSeconds;
      return (who + ' served ' + pen + ' penalty' + (lost !== null && lost !== undefined ? ' and lost ' + lost + (lost === 1 ? ' second' : ' seconds') : '')).trim();
    }
    if (ev.eventType === 'TrackLimit') {
      var pts = Number(d.WarningPoints);
      if (pts > 0) return 'Track Limit Warning: ' + pts + ' track cut penalty issued.';
      return 'Track Limit Warning: ' + String(d.Outcome || ev.rawText || 'No Further Action').trim().replace(/\.$/, '') + '.';
    }
    return ev.rawText || ev.eventType;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function seasonLabel(s) {
    var a = fmtDate(s.startUtc), b = fmtDate(s.endUtc);
    var range = a && b ? (a === b ? a : a + ' - ' + b) : (a || b);
    return (s.seasonNumber ? 'Season ' + s.seasonNumber + ' - ' : '') + s.name + (range ? ' (' + range + ')' : '');
  }
  // Race Details boxes: the season's race rules plus this round's length and weather.
  function drawDetails(host, season, round) {
    host.innerHTML = '';
    var rs = season.raceSettings || {};
    var weather = '';
    if (round) {
      var bits = [];
      if (round.weather) bits.push(round.weather);
      if (round.temperatureC !== null && round.temperatureC !== undefined && round.temperatureC !== '') bits.push(round.temperatureC + '\u00b0C');
      weather = bits.join(', ');
    }
    var items = [
      ['Length', round && round.raceLengthMinutes ? round.raceLengthMinutes + ' min' : ''],
      ['Weather', weather],
      ['Rain %', round && round.chanceOfRain !== null && round.chanceOfRain !== undefined && round.chanceOfRain !== '' ? round.chanceOfRain + '%' : ''],
      ['Setups', rs.setupRules || ''],
      ['Tire Wear', rs.tireWearMultiplier || ''],
      ['Tires Allowed', rs.tireCount ? String(rs.tireCount) : ''],
      ['Fuel Multiplier', rs.fuelMultiplier || ''],
      ['Pitstop Requirements', rs.pitStopReq || ''],
      ['Track Limits', season.trackLimitsPreset || ''],
      ['Limit Points', rs.trackLimitPoints ? String(rs.trackLimitPoints) : '']
    ].filter(function (it) { return it[1]; });
    if (!items.length) { host.hidden = true; return; }
    host.hidden = false;
    var grid = el('div', 'rdp-tiles rdp-details');
    items.forEach(function (it) { grid.appendChild(tile(it[0], it[1], '')); });
    host.appendChild(grid);
  }

  function renderSeasonStats(data) {
    var panel = $('rdp-season'), body = $('rdp-season-body');
    var seasons = data.seasons || [];
    body.innerHTML = '';
    panel.hidden = false;
    var anyRaces = seasons.some(function (s) { return (s.rounds || []).length > 0; });
    if (!seasons.length || !anyRaces) {
      body.appendChild(emptyBlock('No Races Yet', 'This driver has not completed a league race. Season stats will appear after their first finalized round.'));
      return;
    }
    var seasonSel = el('select', 'rdp-select rdp-select-full');
    seasonSel.setAttribute('aria-label', 'Season');
    seasons.forEach(function (s, i) { seasonSel.appendChild(new Option(seasonLabel(s), String(i))); });
    var raceSel = el('select', 'rdp-select rdp-select-full');
    raceSel.setAttribute('aria-label', 'Round');
    function catLine(text) {
      var line = el('div', 'rdp-catline');
      line.appendChild(tx('span', 'rdp-catline-text', text));
      return line;
    }
    body.appendChild(seasonSel);
    body.appendChild(catLine('Season Stats'));
    var summary = el('div');
    body.appendChild(summary);
    body.appendChild(raceSel);
    body.appendChild(catLine('Race Details'));
    var detailsHost = el('div');
    body.appendChild(detailsHost);
    body.appendChild(catLine('Race Report'));
    var raceHost = el('div');
    body.appendChild(raceHost);
    var token = 0;

    function drawSeason() {
      var s = seasons[Number(seasonSel.value)];
      summary.innerHTML = '';
      var tiles = el('div', 'rdp-tiles');
      tiles.appendChild(tile('Races', num(s.races), ''));
      tiles.appendChild(tile('Rank', s.position ? ord(s.position) : '--', s.classSize ? 'of ' + s.classSize + ' in class' : ''));
      tiles.appendChild(tile('Points', num(s.points), ''));
      tiles.appendChild(tile('Wins', num(s.wins), ''));
      tiles.appendChild(tile('Podiums', num(s.podiums), ''));
      tiles.appendChild(tile('Best Finish', s.bestFinish ? 'P' + s.bestFinish : '--', ''));
      tiles.appendChild(tile('Avg. Finish', num(s.avgFinish, 1), ''));
      tiles.appendChild(tile('Poles', num(s.poles), ''));
      tiles.appendChild(tile('Fastest Laps', num(s.fastestLaps), ''));
      tiles.appendChild(tile('Consistency', s.consistency === null || s.consistency === undefined ? '--' : '±' + Number(s.consistency).toFixed(1), 'spread of finishes'));
      summary.appendChild(tiles);
      var charts = el('div', 'rdp-charts');
      charts.appendChild(pointsChart(s));
      charts.appendChild(startFinishChart(s));
      summary.appendChild(charts);

      raceSel.innerHTML = '';
      var rounds = (s.rounds || []).slice().sort(function (a, b) { return b.roundNum - a.roundNum; });
      if (!rounds.length) {
        raceSel.disabled = true;
        raceSel.appendChild(new Option('No races this season', ''));
        raceHost.innerHTML = '';
        detailsHost.innerHTML = '';
        raceHost.appendChild(emptyBlock('No Races Yet', 'No finalized races for this driver in this season.'));
        return;
      }
      raceSel.disabled = false;
      rounds.forEach(function (r) {
        raceSel.appendChild(new Option('Round ' + r.roundNum + ' - ' + (r.eventName || 'Race') + (r.track ? ': ' + r.track : '') + (r.dnp ? ' (did not start)' : '') + (fmtDate(r.startUtc) ? ' (' + fmtDate(r.startUtc) + ')' : ''), r.roundId));
      });
      drawRace();
    }

    function drawRace() {
      var my = ++token;
      raceHost.innerHTML = '';
      if (!raceSel.value) return;
      var curSeason = seasons[Number(seasonSel.value)];
      var curRound = (curSeason.rounds || []).filter(function (r) { return r.roundId === raceSel.value; })[0];
      drawDetails(detailsHost, curSeason, curRound);
      raceHost.appendChild(tx('div', 'rdp-loading', 'Loading race...'));
      loadRound(raceSel.value).then(function (res) {
        if (my !== token) return;
        raceHost.innerHTML = '';
        if (!res || !res.success) { raceHost.appendChild(emptyBlock('Race Unavailable', (res && res.message) || 'Could not load this race right now.')); return; }
        if (!res.hasData) { raceHost.appendChild(emptyBlock('Did Not Race', 'This driver has no laps or results for this round.')); return; }
        var split = el('div', 'rdp-race-split');
        var left = el('div', 'rdp-race-col');
        var lapsHost = el('div', 'rdp-laps');
        left.appendChild(lapsHost);
        drawMyLaps((res.myLaps || {}).sessions, lapsHost);
        var right = el('div', 'rdp-race-col');
        var light = el('div', 'rdp-light');
        var rep = null;
        try { rep = res.driverReport ? window._rccDriverReport(res.driverReport) : null; } catch (err) { rep = null; }
        if (rep) {
          light.appendChild(rep);
          if (res.driverReport.pitNote) light.appendChild(tx('div', 'rdp-chart-sub', res.driverReport.pitNote));
        } else {
          light.appendChild(tx('div', 'rdp-chart-sub', 'No driver report for this round.'));
        }
        right.appendChild(light);
        split.appendChild(left);
        split.appendChild(catLine('Driver Report'));
        split.appendChild(right);
        raceHost.appendChild(split);
      }).catch(function () {
        if (my !== token) return;
        raceHost.innerHTML = '';
        raceHost.appendChild(emptyBlock('Race Unavailable', 'Could not load this race right now.'));
      });
    }

    seasonSel.addEventListener('change', drawSeason);
    raceSel.addEventListener('change', drawRace);
    seasonSel.value = '0';
    drawSeason();
  }

  // ---- Row 4: Story Mentions + Rivalries ------------------------------------------------------
  function storyMeta(s) {
    var bits = [];
    if (s.seasonName) bits.push(s.seasonName);
    bits.push(s.kind === 'preview' ? 'Season Preview' : s.roundNum ? 'Round ' + s.roundNum : 'Story');
    return bits.join(' · ');
  }
  // The visited driver's own name in bold wherever a story mentions it.
  var meName = '';
  function boldMe(text) {
    var safe = esc(text);
    if (!meName || meName.length < 3) return safe;
    var re = new RegExp('(^|[^A-Za-z0-9])(' + esc(meName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![A-Za-z0-9])', 'gi');
    return safe.replace(re, function (m, pre, nm) { return pre + '<strong class="rdp-me">' + nm + '</strong>'; });
  }
  function plainPreview(body) {
    var t = String(body || '').replace(/^#+\s.*$/gm, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    return t.length > 240 ? t.slice(0, 240).replace(/\s+\S*$/, '') + '...' : t;
  }
  function renderBody(box, body) {
    String(body || '').split(/\n{2,}/).forEach(function (para) {
      var p = para.trim();
      if (!p) return;
      var h = p.match(/^##+\s+(.*)$/);
      if (h) { box.appendChild(tx('h3', '', h[1].replace(/\*\*/g, ''))); return; }
      var node = el('p');
      node.innerHTML = boldMe(p).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
      box.appendChild(node);
    });
  }
  function openStory(s) {
    var bg = el('div', 'rdp-modal-bg');
    var modal = el('div', 'rdp-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    var head = el('div', 'rdp-modal-head');
    head.appendChild(tx('div', 'rdp-modal-title', s.title || 'Story'));
    var x = tx('button', 'rdp-modal-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    head.appendChild(x);
    var bodyBox = el('div', 'rdp-modal-body');
    bodyBox.appendChild(tx('div', 'rdp-story-meta', storyMeta(s)));
    if (s.standfirst) { var sfEl = el('p'); sfEl.innerHTML = boldMe(s.standfirst); bodyBox.appendChild(sfEl); }
    renderBody(bodyBox, s.body);
    modal.appendChild(head);
    modal.appendChild(bodyBox);
    bg.appendChild(modal);
    function close() { document.removeEventListener('keydown', onKey); bg.remove(); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    x.addEventListener('click', close);
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(bg);
  }
  function renderStories(data) {
    meName = String(data.name || '');
    var host = $('rdp-stories');
    host.innerHTML = '';
    var list = data.stories || [];
    if (!list.length) { host.appendChild(emptyBlock('No Story Mentions', 'No league stories have mentioned this driver yet.')); return; }
    var scroll = el('div', 'rdp-stories-scroll');
    list.forEach(function (s) {
      var card = el('div', 'rdp-story');
      card.appendChild(tx('div', 'rdp-story-meta', storyMeta(s)));
      card.appendChild(tx('div', 'rdp-story-title', s.title));
      var prev = el('div', 'rdp-story-text');
      prev.innerHTML = boldMe(s.standfirst || plainPreview(s.body));
      card.appendChild(prev);
      var more = tx('button', 'rdp-story-more', 'Continue reading');
      more.type = 'button';
      more.addEventListener('click', function () { openStory(s); });
      card.appendChild(more);
      scroll.appendChild(card);
    });
    host.appendChild(scroll);
  }

  function drawRivals(res) {
    var host = $('rdp-rivals');
    host.innerHTML = '';
    var list = (res && res.rivals) || [];
    if (!list.length) { host.appendChild(emptyBlock('No Rivalries Yet', 'Rivalries build up after a few races against the same drivers.')); return; }
    list.forEach(function (r, i) {
      var row = el('div', 'rdp-rival');
      row.appendChild(tx('div', 'rdp-rival-rank', i + 1));
      var mid = el('div');
      var name = el('a', 'rdp-rival-name');
      name.href = 'profile.html?id=' + encodeURIComponent(r.profileId);
      name.appendChild(document.createTextNode(r.name));
      var flagSrc = r.country && typeof countryFlagSrc === 'function' ? countryFlagSrc(r.country) : '';
      if (flagSrc) { var f = el('img', 'rdp-rival-flag'); f.alt = ''; f.src = flagSrc; f.onerror = function () { f.remove(); }; name.appendChild(f); }
      mid.appendChild(name);
      var tags = (r.tags || []).slice();
      tags.unshift(r.shared + ' race' + (r.shared === 1 ? '' : 's') + ' together');
      mid.appendChild(tx('div', 'rdp-rival-tags', tags.join(' · ')));
      row.appendChild(mid);
      var h2h = el('div', 'rdp-rival-h2h');
      h2h.appendChild(document.createTextNode(r.ahead + '-' + r.behind));
      h2h.appendChild(tx('small', '', 'Head to head'));
      row.appendChild(h2h);
      host.appendChild(row);
    });
  }
  function loadRivals() {
    var key = 'rc_profile_rivals_v1_' + profileId;
    var saved = readLocal(key);
    if (saved) drawRivals(saved);
    else { $('rdp-rivals').innerHTML = ''; $('rdp-rivals').appendChild(tx('div', 'rdp-loading', 'Loading rivalries...')); }
    fetchApi('getDriverProfileRivals', { params: { profileId: profileId }, timeoutMs: 60000 }).then(function (res) {
      if (res && res.success) { saveLocal(key, res); drawRivals(res); }
      else if (!saved) drawRivals(null);
    }).catch(function () { if (!saved) drawRivals(null); });
  }

  // ---- Row 5: Team History --------------------------------------------------------------------
  function renderTeams(data) {
    var panel = $('rdp-teams'), body = $('rdp-teams-body');
    var list = (data.teamHistory || []).slice(0, 3);
    if (!list.length) { panel.hidden = true; return; }
    body.innerHTML = '';
    var grid = el('div', 'rdp-teams');
    list.forEach(function (t) {
      var seat = t.seat || {};
      var card = el('div', 'rdp-team');
      var top = el('div', 'rdp-team-top');
      var sn = String(t.seasonId || '').match(/(\d+)\s*$/);
      top.appendChild(tx('div', 'rdp-team-season', (sn ? 'Season ' + parseInt(sn[1], 10) + ': ' : '') + t.seasonName));
      card.appendChild(top);
      var cardImg = seatCarImg(seat);
      if (cardImg) card.appendChild(cardImg);
      card.appendChild(seatNameEl(seat));
      card.appendChild(seatModelEl(seat));
      var stats = el('div', 'rdp-team-stats');
      [[t.position ? ord(t.position) : '--', 'Champ.'], [num(t.wins), 'Wins'], [num(t.podiums), 'Podiums']].forEach(function (p) {
        var s = el('div', 'rdp-team-stat');
        s.appendChild(tx('b', '', p[0]));
        s.appendChild(tx('span', '', p[1]));
        stats.appendChild(s);
      });
      card.appendChild(stats);
      grid.appendChild(card);
    });
    body.appendChild(grid);
    panel.hidden = false;
  }

  // ---- boot -----------------------------------------------------------------------------------
  var shownSig = null;
  function renderAll(data) {
    var sig = JSON.stringify(data);
    if (sig === shownSig) return;
    shownSig = sig;
    renderSeat(data);
    renderAchievements(data);
    renderForm(data);
    renderSeasonStats(data);
    renderStories(data);
    renderTeams(data);
    $('rdp-row-mid').hidden = false;
  }
  var pageKey = 'rc_profile_page_v1_' + profileId;
  var savedPage = readLocal(pageKey);
  var rivalsStarted = false;
  function startRivals() { if (!rivalsStarted) { rivalsStarted = true; loadRivals(); } }
  if (savedPage && savedPage.success) { renderAll(savedPage); startRivals(); }
  fetchApi('getDriverProfilePage', { params: { profileId: profileId }, timeoutMs: 60000 }).then(function (res) {
    if (res && res.success) { saveLocal(pageKey, res); renderAll(res); startRivals(); }
  }).catch(function () { /* the top card (profile.js) already explains a missing profile */ });
})();
