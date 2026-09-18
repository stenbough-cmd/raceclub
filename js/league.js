/*
  Race Club — js/league.js  (added 2026-09-18)

  Backs league.html -- the public ESPN-style league hub. One fetch
  (getLeagueHub, no token) bundles everything the page needs: standings,
  the last completed race's headline result, the next race, and the news
  feed. This file only renders; all computation (standings math, points,
  drops) already happened server-side in handleGetLeagueHub (Website.gs),
  same "server computes, client displays" split every other page on the
  site follows.

  Self-contained on purpose -- league.html does NOT load Account.html, so
  none of that file's helpers (el/escapeHtml/buildEmptyStatePanel/etc.)
  are available here. Small local copies below instead of a shared
  include, since Account.html is a single enormous file not meant to be
  loaded standalone.
*/

function _rclEl(tag, className, html) {
  var e = document.createElement(tag);
  if (className) e.className = className;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function _rclEscapeHtml(str) {
  var d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

// Same large circle-slash "no data" icon the rest of the site uses
// (Account.html's buildEmptyStatePanel), recolored for this page's dark
// background via .rcl-empty-state-icon rather than duplicating the SVG
// per call site.
function _rclEmptyState(title, subtitle) {
  var wrap = _rclEl('div', 'rcl-empty-state');
  wrap.appendChild(_rclEl('div', 'rcl-empty-state-icon',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"></line></svg>'));
  wrap.appendChild(_rclEl('div', 'rcl-empty-state-title', _rclEscapeHtml(title || 'No Data To Display')));
  if (subtitle) wrap.appendChild(_rclEl('div', 'rcl-empty-state-subtitle', _rclEscapeHtml(subtitle)));
  return wrap;
}

function _rclFormatDate(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------
// TICKER
// ---------------------------------------------------------------------
// Builds the scrolling item list from lastRace + standings only (no next-
// race or news items in the ticker -- Matt's explicit call: results and
// standings movement, nothing else scrolling up there). Rendered twice
// back-to-back in the DOM so the CSS animation (translateX(-50%)) loops
// seamlessly -- see .rcl-ticker-track in css/league.css.
function _rclBuildTickerItems(hub) {
  var items = [];

  if (hub.lastRace) {
    var r = hub.lastRace;
    if (r.overallWinner) {
      items.push({ tag: 'RACE WINNER', text: _rclEscapeHtml(r.overallWinner) + ' takes ' + _rclEscapeHtml(r.eventName || 'the race') });
    }
    (r.classes || []).forEach(function (cls) {
      if (cls.classWinner) {
        items.push({ tag: (cls.className || 'CLASS').toUpperCase() + ' WINNER', text: _rclEscapeHtml(cls.classWinner) });
      }
    });
    if (r.overallFastestLapDriver) {
      items.push({ tag: 'FASTEST LAP', text: _rclEscapeHtml(r.overallFastestLapDriver) + (r.overallFastestLapTime ? ' -- ' + _rclEscapeHtml(r.overallFastestLapTime) : '') });
    }
  }

  (hub.standings || []).forEach(function (cls) {
    var standings = cls.standings || [];
    if (!standings.length) return;
    var leader = standings[0];
    var second = standings[1];
    var gapText = second ? ('+' + (leader.championshipPoints - second.championshipPoints) + ' PTS') : 'UNCONTESTED';
    items.push({ tag: (cls.className || 'CLASS').toUpperCase() + ' POINTS LEAD', text: _rclEscapeHtml(leader.name) + ' (' + gapText + ')' });
  });

  return items;
}

function _rclRenderTicker(hub) {
  var track = document.getElementById('rcl-ticker-track');
  if (!track) return;
  var items = _rclBuildTickerItems(hub);

  if (!items.length) {
    track.innerHTML = '';
    track.style.animation = 'none';
    track.appendChild(_rclEl('div', 'rcl-ticker-empty', 'No results or standings yet -- check back once the season gets underway.'));
    return;
  }

  function buildRun() {
    var frag = document.createDocumentFragment();
    items.forEach(function (item) {
      var el = _rclEl('div', 'rcl-ticker-item');
      el.appendChild(_rclEl('span', 'rcl-ticker-item-tag', item.tag));
      el.appendChild(document.createTextNode(item.text));
      frag.appendChild(el);
    });
    return frag;
  }

  track.innerHTML = '';
  track.appendChild(buildRun());
  track.appendChild(buildRun()); // duplicate run -- see the animation comment above
}

// ---------------------------------------------------------------------
// STANDINGS
// ---------------------------------------------------------------------
function _rclRenderStandings(hub) {
  var body = document.getElementById('rcl-standings-body');
  if (!body) return;
  body.innerHTML = '';

  if (!hub.hasSeason || !hub.standings || !hub.standings.length) {
    body.appendChild(_rclEmptyState('No Data To Display', 'Standings fill in once a season is underway.'));
    return;
  }

  hub.standings.forEach(function (cls) {
    var wrap = _rclEl('div', 'rcl-standings-class');
    wrap.appendChild(_rclEl('div', 'rcl-standings-class-name', _rclEscapeHtml(cls.className || 'Class')));
    var standings = cls.standings || [];
    if (!standings.length) {
      wrap.appendChild(_rclEl('div', 'rcl-empty-state-subtitle', 'No drivers registered in this class yet.'));
    } else {
      var leaderPts = standings[0].championshipPoints;
      standings.forEach(function (row, idx) {
        var rowEl = _rclEl('div', 'rcl-standings-row' + (idx === 0 ? ' rcl-standings-row-lead' : ''));
        rowEl.appendChild(_rclEl('div', 'rcl-standings-pos', String(idx + 1)));
        var nameCol = _rclEl('div');
        nameCol.appendChild(_rclEl('div', 'rcl-standings-name', _rclEscapeHtml(row.name)));
        nameCol.appendChild(_rclEl('div', 'rcl-standings-team', _rclEscapeHtml(row.teamName || '')));
        rowEl.appendChild(nameCol);
        var ptsCol = _rclEl('div', 'rcl-standings-pts');
        ptsCol.appendChild(_rclEl('div', 'rcl-standings-pts-num', String(row.championshipPoints)));
        var gap = idx === 0 ? 'LEADER' : ('-' + (leaderPts - row.championshipPoints) + ' PTS');
        ptsCol.appendChild(_rclEl('div', 'rcl-standings-pts-gap', gap));
        rowEl.appendChild(ptsCol);
        wrap.appendChild(rowEl);
      });
    }
    body.appendChild(wrap);
  });
}

// ---------------------------------------------------------------------
// LAST RACE RESULTS
// ---------------------------------------------------------------------
function _rclRenderResults(hub) {
  var body = document.getElementById('rcl-results-body');
  if (!body) return;
  body.innerHTML = '';

  if (!hub.hasSeason || !hub.lastRace) {
    body.appendChild(_rclEmptyState('No Data To Display', 'Results fill in once a race has been run.'));
    return;
  }

  var r = hub.lastRace;
  var headline = _rclEl('div', 'rcl-race-headline');
  function stat(label, value, accent) {
    var s = _rclEl('div', 'rcl-race-headline-stat');
    s.appendChild(_rclEl('div', 'rcl-race-headline-label', label));
    s.appendChild(_rclEl('div', 'rcl-race-headline-value' + (accent ? ' rcl-race-headline-value-accent' : ''), _rclEscapeHtml(value || '--')));
    return s;
  }
  headline.appendChild(stat('Event', (r.eventName || '') + (r.track ? ' -- ' + r.track : '')));
  headline.appendChild(stat('Winner', r.overallWinner, true));
  headline.appendChild(stat('Pole', r.overallPoleSitter));
  headline.appendChild(stat('Fastest Lap', r.overallFastestLapDriver ? (r.overallFastestLapDriver + (r.overallFastestLapTime ? ' (' + r.overallFastestLapTime + ')' : '')) : ''));
  body.appendChild(headline);

  (r.classes || []).forEach(function (cls) {
    var clsWrap = _rclEl('div', 'rcl-race-class');
    clsWrap.appendChild(_rclEl('div', 'rcl-race-class-name', _rclEscapeHtml(cls.className || 'Class')));
    (cls.standings || []).forEach(function (row) {
      var rowEl = _rclEl('div', 'rcl-race-row');
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-pos', String(row.classPosition || row.position || '')));
      var nameCol = _rclEl('div');
      nameCol.appendChild(_rclEl('span', 'rcl-race-row-name', _rclEscapeHtml(row.name)));
      if (row.carNumber) nameCol.appendChild(_rclEl('span', 'rcl-race-row-num', ' #' + _rclEscapeHtml(row.carNumber)));
      rowEl.appendChild(nameCol);
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-time', _rclEscapeHtml(row.bestLapTime || '')));
      clsWrap.appendChild(rowEl);
    });
    body.appendChild(clsWrap);
  });
}

// ---------------------------------------------------------------------
// NEWS FEED -- admin-authored, Body is plain text from a textarea (see
// Account.html's News editor). Escaped, then split on blank lines into
// paragraphs -- basic formatting without trusting/parsing any markup.
// ---------------------------------------------------------------------
function _rclRenderNews(hub) {
  var body = document.getElementById('rcl-news-body');
  if (!body) return;
  body.innerHTML = '';

  if (!hub.news || !hub.news.length) {
    body.appendChild(_rclEmptyState('No News Yet', 'League news and race recaps will show up here.'));
    return;
  }

  hub.news.forEach(function (item) {
    var wrap = _rclEl('div', 'rcl-news-item');
    wrap.appendChild(_rclEl('div', 'rcl-news-title', _rclEscapeHtml(item.title)));
    var metaParts = [];
    if (item.authorName) metaParts.push('By ' + item.authorName);
    var dateLabel = _rclFormatDate(item.publishedAt);
    if (dateLabel) metaParts.push(dateLabel);
    wrap.appendChild(_rclEl('div', 'rcl-news-meta', _rclEscapeHtml(metaParts.join(' · '))));
    var bodyEl = _rclEl('div', 'rcl-news-body');
    String(item.body || '').split(/\n\s*\n/).forEach(function (para) {
      if (!para.trim()) return;
      bodyEl.appendChild(_rclEl('p', null, _rclEscapeHtml(para.trim()).replace(/\n/g, '<br>')));
    });
    wrap.appendChild(bodyEl);
    body.appendChild(wrap);
  });
}

// ---------------------------------------------------------------------
// NEXT RACE (sidebar mini-card)
// ---------------------------------------------------------------------
function _rclRenderNextRace(hub) {
  var body = document.getElementById('rcl-nextrace-body');
  if (!body) return;
  body.innerHTML = '';

  if (!hub.hasSeason || !hub.nextRace) {
    body.appendChild(_rclEmptyState('No Race Scheduled', ''));
    return;
  }

  var n = hub.nextRace;
  body.appendChild(_rclEl('div', 'rcl-nextrace-event', _rclEscapeHtml(n.eventName || ('Round ' + n.roundNum))));
  body.appendChild(_rclEl('div', 'rcl-nextrace-track', _rclEscapeHtml([n.track, n.layout].filter(Boolean).join(' -- '))));
  var dateLabel = _rclFormatDate(n.startUtc);
  if (dateLabel) body.appendChild(_rclEl('div', 'rcl-nextrace-date', dateLabel));
}

// ---------------------------------------------------------------------
// PAGE HERO -- season name
// ---------------------------------------------------------------------
function _rclRenderHero(hub) {
  var titleEl = document.getElementById('rcl-hero-title');
  if (titleEl) titleEl.textContent = hub.hasSeason ? (hub.seasonName || 'Race Club') : 'Race Club';
  var subEl = document.getElementById('rcl-hero-sub');
  if (subEl) {
    subEl.textContent = hub.hasSeason
      ? 'Live standings, race results, and league news -- updated after every round.'
      : 'No season is currently underway. Check back once the next one opens.';
  }
}

document.addEventListener('DOMContentLoaded', function () {
  fetchApi('getLeagueHub', {}).then(function (hub) {
    if (!hub || !hub.success) {
      _rclRenderTicker({ lastRace: null, standings: [] });
      [_rclRenderStandings, _rclRenderResults, _rclRenderNews, _rclRenderNextRace].forEach(function (fn) { fn({ hasSeason: false }); });
      _rclRenderHero({ hasSeason: false });
      return;
    }
    _rclRenderHero(hub);
    _rclRenderTicker(hub);
    _rclRenderStandings(hub);
    _rclRenderResults(hub);
    _rclRenderNews(hub);
    _rclRenderNextRace(hub);
  }).catch(function () {
    _rclRenderTicker({ lastRace: null, standings: [] });
    [_rclRenderStandings, _rclRenderResults, _rclRenderNews, _rclRenderNextRace].forEach(function (fn) { fn({ hasSeason: false }); });
    _rclRenderHero({ hasSeason: false });
  });
});
