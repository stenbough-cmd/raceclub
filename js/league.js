/*
  Race Club — js/league.js  (added 2026-09-18, reworked 2026-09-19)

  Backs league.html -- the public ESPN-style league hub. One fetch
  (getLeagueHub, no token) bundles everything the page needs: standings,
  the last completed race's headline result, the full season schedule,
  and the news feed. This file only renders; all computation (standings
  math, points, drops, the season's calendar) already happened
  server-side in handleGetLeagueHub (Website.gs), same "server computes,
  client displays" split every other page on the site follows.

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

// Date + time, viewer's own local timezone (added 2026-09-19, Calendar
// redesign) -- league.html is a public, no-token page, so there's no
// driver timezone to read the way Account.html's Calendar does; the
// browser's own locale/timezone is the only thing available here, same
// as every other date this page already formats.
function _rclFormatDateTime(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
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
// LEADERBOARD (standings)
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
// RECENT RESULTS (last completed race)
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
// CALENDAR -- full public season schedule (added 2026-09-19). Replaces
// the old standalone "Next Race" mini-card: the schedule itself now
// carries an "UP NEXT" pill on whichever round/special is first in line,
// so there's no separate widget saying the same thing twice.
// ---------------------------------------------------------------------
function _rclRenderCalendar(hub) {
  var body = document.getElementById('rcl-calendar-body');
  if (!body) return;
  body.innerHTML = '';

  if (!hub.hasSeason || !hub.calendar || !hub.calendar.length) {
    body.appendChild(_rclEmptyState('No Data To Display', 'The season schedule shows up here once it is built.'));
    return;
  }

  // First not-yet-finished round/special (byes never get the pill --
  // there's nothing to point drivers toward on a week off).
  var nextIdx = -1;
  hub.calendar.forEach(function (entry, idx) {
    if (nextIdx === -1 && entry.kind !== 'bye' && !entry.finished) nextIdx = idx;
  });

  hub.calendar.forEach(function (entry, idx) {
    if (entry.kind === 'bye') {
      var byeRow = _rclEl('div', 'rcl-cal-row rcl-cal-row-bye');
      byeRow.appendChild(_rclEl('div', 'rcl-cal-round', 'BYE'));
      var byeBody = _rclEl('div', 'rcl-cal-row-body');
      byeBody.appendChild(_rclEl('div', 'rcl-cal-track', 'Bye Week'));
      byeBody.appendChild(_rclEl('div', 'rcl-cal-meta', '<span class="rcl-cal-meta-item">' + _rclEscapeHtml(_rclFormatDate(entry.startUtc)) + '</span>'));
      byeRow.appendChild(byeBody);
      body.appendChild(byeRow);
      return;
    }

    // Redesigned 2026-09-19 (Matt's call): the round label owns the row's
    // left edge (bright, large, solid red -- see .rcl-cal-round), Track
    // is now the bold primary line with the event name underneath it in a
    // lighter weight (previously the other way around), and a meta chip
    // row adds length tier + in-game session times alongside the
    // date/time -- all public-safe fields handleGetLeagueHub now sends
    // (see its own comment in Website.gs).
    var row = _rclEl('div', 'rcl-cal-row' + (idx === nextIdx ? ' rcl-cal-row-next' : ''));
    var roundLabel = entry.roundNum ? ('R' + entry.roundNum) : (entry.kind === 'special' ? 'SP' : '');
    // Special-event rounds get a platinum background instead of the
    // standard brand red (2026-09-19, Matt's ask) -- makes a special
    // round visually distinct at a glance in the schedule.
    var roundClass = 'rcl-cal-round' + (entry.kind === 'special' ? ' rcl-cal-round-special' : '');
    row.appendChild(_rclEl('div', roundClass, _rclEscapeHtml(roundLabel)));

    var rowBody = _rclEl('div', 'rcl-cal-row-body');
    var topLine = _rclEl('div', 'rcl-cal-row-top');
    topLine.appendChild(_rclEl('div', 'rcl-cal-track',
      '<strong>' + _rclEscapeHtml(entry.track || '(no track)') + '</strong>' +
      (entry.layout ? ' <span class="rcl-cal-layout">-- ' + _rclEscapeHtml(entry.layout) + '</span>' : '')));
    var statusText = idx === nextIdx ? 'UP NEXT' : (entry.finished ? (entry.hasResults ? 'COMPLETE' : 'AWAITING RESULTS') : 'UPCOMING');
    topLine.appendChild(_rclEl('div', 'rcl-cal-status rcl-cal-status-' + statusText.split(' ')[0].toLowerCase(), statusText));
    rowBody.appendChild(topLine);

    rowBody.appendChild(_rclEl('div', 'rcl-cal-event', _rclEscapeHtml(entry.eventName || 'Race')));

    var metaRow = _rclEl('div', 'rcl-cal-meta');
    function metaItem(label, value) {
      var item = _rclEl('span', 'rcl-cal-meta-item');
      if (label) item.innerHTML = '<span class="rcl-cal-meta-item-label">' + _rclEscapeHtml(label) + '</span> ' + _rclEscapeHtml(value);
      else item.textContent = value;
      metaRow.appendChild(item);
    }
    // Time + length tier grouped into one light-gray pill (2026-09-19,
    // Matt's ask: "put the time next to the length tier in a light gray
    // pill") -- previously two separate plain meta items; now one chip so
    // "when" and "how long" read as a single fact at a glance.
    var timeTierParts = [];
    if (entry.startUtc) timeTierParts.push(_rclFormatDateTime(entry.startUtc));
    if (entry.raceLengthTier) timeTierParts.push(entry.raceLengthTier + ' Race');
    if (timeTierParts.length) {
      metaRow.appendChild(_rclEl('span', 'rcl-cal-meta-pill', _rclEscapeHtml(timeTierParts.join(' · '))));
    }
    if (entry.igRaceStart) {
      var igParts = ['IG Race ' + entry.igRaceStart];
      if (entry.igPracticeStart) igParts.push('Practice ' + entry.igPracticeStart);
      if (entry.igQualifyStart) igParts.push('Qualifying ' + entry.igQualifyStart);
      metaItem('', igParts.join(' -- '));
    }
    rowBody.appendChild(metaRow);

    row.appendChild(rowBody);
    body.appendChild(row);
  });
}

// ---------------------------------------------------------------------
// POINTS -- race-length-tier point tables + bonus points (added
// 2026-09-19). Straight passthrough of Seasons.SeasonDetails.
// pointsTables/bonusPoints (same shape the Season Creation Wizard writes
// and handleGetSeasonCalendar already hands a logged-in driver), just
// public here. Table order follows the tiers as they come back from the
// server object (Sprint/Medium/Long, the only tiers the wizard creates)
// rather than a hardcoded list, so a renamed or added tier still shows up
// without a frontend change.
// ---------------------------------------------------------------------
function _rclRenderPoints(hub) {
  var body = document.getElementById('rcl-points-body');
  if (!body) return;
  body.innerHTML = '';

  var tables = hub.pointsTables || {};
  var tierNames = Object.keys(tables);
  if (!hub.hasSeason || !tierNames.length) {
    body.appendChild(_rclEmptyState('No Data To Display', 'Points tables fill in once a season is underway.'));
    return;
  }

  tierNames.forEach(function (tierName) {
    var tier = tables[tierName] || {};
    var points = tier.points || [];
    if (!points.length) return;
    var wrap = _rclEl('div', 'rcl-points-tier');
    var head = _rclEl('div', 'rcl-points-tier-head');
    head.appendChild(_rclEl('div', 'rcl-points-tier-name', _rclEscapeHtml(tierName)));
    if (tier.duration) head.appendChild(_rclEl('div', 'rcl-points-tier-duration', tier.duration + ' min'));
    wrap.appendChild(head);
    var table = _rclEl('div', 'rcl-points-table');
    points.forEach(function (val, idx) {
      var pos = _rclEl('div', 'rcl-points-pos');
      pos.appendChild(_rclEl('div', 'rcl-points-pos-num', 'P' + (idx + 1)));
      pos.appendChild(_rclEl('div', 'rcl-points-pos-val', String(val)));
      table.appendChild(pos);
    });
    wrap.appendChild(table);
    body.appendChild(wrap);
  });

  var bonus = hub.bonusPoints || {};
  var bonusLabels = { pole: 'Pole Position', fastestLap: 'Fastest Lap', mostLapsLed: 'Most Laps Led' };
  var bonusChips = Object.keys(bonusLabels).filter(function (key) { return Number(bonus[key]) > 0; });
  if (bonusChips.length) {
    var bonusRow = _rclEl('div', 'rcl-points-bonus-row');
    // Same type style as a tier name above (.rcl-points-tier-name) --
    // Matt's ask: "make Bonus Points This Season the same style as the
    // tier in the points tables". .rcl-points-bonus-label still carries
    // this row's own layout (full-width, margin-bottom) -- see its rule
    // in css/league.css, which now shares the tier name's font styling.
    bonusRow.appendChild(_rclEl('div', 'rcl-points-bonus-label rcl-points-tier-name', 'Bonus Points This Season'));
    bonusChips.forEach(function (key) {
      bonusRow.appendChild(_rclEl('div', 'rcl-points-bonus-chip', _rclEscapeHtml(bonusLabels[key]) + ' <strong>+' + Number(bonus[key]) + '</strong>'));
    });
    body.appendChild(bonusRow);
  } else if (tierNames.length) {
    body.appendChild(_rclEl('div', 'rcl-points-bonus-row',
      '<div class="rcl-points-bonus-chip">No bonus points are awarded this season.</div>'));
  }
}

// ---------------------------------------------------------------------
// DRIVERS -- full roster, grouped by class (added 2026-09-19). Reuses
// the same per-class driver rows the Leaderboard already computed
// server-side (hub.standings) -- alphabetical here instead of ranked,
// since a roster isn't a leaderboard.
// ---------------------------------------------------------------------
function _rclRenderDrivers(hub) {
  var body = document.getElementById('rcl-drivers-body');
  if (!body) return;
  body.innerHTML = '';

  if (!hub.hasSeason || !hub.standings || !hub.standings.length) {
    body.appendChild(_rclEmptyState('No Data To Display', 'The driver roster fills in once a season is underway.'));
    return;
  }

  hub.standings.forEach(function (cls) {
    var rows = (cls.standings || []).slice().sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    if (!rows.length) return;
    var wrap = _rclEl('div', 'rcl-drivers-class');
    wrap.appendChild(_rclEl('div', 'rcl-standings-class-name', _rclEscapeHtml(cls.className || 'Class')));
    var grid = _rclEl('div', 'rcl-drivers-grid');
    rows.forEach(function (row) {
      var card = _rclEl('div', 'rcl-driver-card');
      card.appendChild(_rclEl('div', 'rcl-driver-name', _rclEscapeHtml(row.name)));
      var metaParts = [];
      if (row.teamName) metaParts.push(row.teamName);
      if (row.carNumber) metaParts.push('#' + row.carNumber);
      if (row.manufacturer) metaParts.push(row.manufacturer);
      card.appendChild(_rclEl('div', 'rcl-driver-meta', _rclEscapeHtml(metaParts.join(' · '))));
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    body.appendChild(wrap);
  });
}

// ---------------------------------------------------------------------
// NEWS FEED -- admin-authored, Body is plain text with a small set of
// hand-rolled formatting markers the New/Edit Post popup's toolbar
// inserts (Account.html): **bold**, *italic*, ++underline++, and lines
// starting with "> " become a blockquote. Escaped first, THEN those
// markers are turned into real tags -- the markers themselves (*, +, >)
// are never touched by HTML-escaping, so this order is safe: nothing a
// poster types can inject a real tag, only these four specific patterns
// ever turn into one.
//
// Redesigned 2026-09-19 (Matt's call): only the single most recent story
// shows in full (clamped to a few lines with a "Continue reading..."
// link); every older story is just a clickable title below it. Clicking
// either opens the same read-story popup (_rclOpenStoryModal), which can
// pull in 3 more stories at a time via its own "Load More News" button --
// see that function below.
// ---------------------------------------------------------------------
function _rclApplyInlineMarkup(escapedText) {
  return escapedText
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\+\+([^+]+)\+\+/g, '<u>$1</u>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

// Renders a story's Body into `container` as real paragraph/blockquote
// elements -- used inside the read-story popup, where the full text
// shows (no clamping).
function _rclRenderStoryBodyBlocks(container, rawBody) {
  var escaped = _rclEscapeHtml(rawBody || '');
  escaped.split(/\n\s*\n/).forEach(function (para) {
    if (!para.trim()) return;
    var lines = para.split('\n');
    var isQuote = lines.length > 0 && lines.every(function (line) { return /^&gt;\s?/.test(line.trim()) || !line.trim(); });
    if (isQuote) {
      var quoteLines = lines.filter(function (l) { return l.trim(); }).map(function (line) {
        return _rclApplyInlineMarkup(line.trim().replace(/^&gt;\s?/, ''));
      });
      var quote = _rclEl('blockquote', 'rcl-news-quote', quoteLines.join('<br>'));
      container.appendChild(quote);
    } else {
      container.appendChild(_rclEl('p', null, _rclApplyInlineMarkup(para.trim()).replace(/\n/g, '<br>')));
    }
  });
}

// Flattened, single-block version for the clamped on-page preview -- CSS
// line-clamp only works cleanly on one box, so paragraph breaks become a
// double line-break inside one div instead of separate <p> elements.
function _rclStoryPreviewHtml(rawBody) {
  var escaped = _rclEscapeHtml(rawBody || '');
  var paragraphs = escaped.split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
  return paragraphs.map(function (p) { return _rclApplyInlineMarkup(p.replace(/\n/g, '<br>')); }).join('<br><br>');
}

function _rclNewsMetaLine(item) {
  var metaParts = [];
  if (item.authorName) metaParts.push('By ' + item.authorName);
  var dateLabel = _rclFormatDate(item.publishedAt);
  if (dateLabel) metaParts.push(dateLabel);
  return metaParts.join(' · ');
}

// Holds the full fetched news list so the read-story popup can page
// through older stories without a second server round trip -- see the
// "cap raised to 30" comment on handleGetLeagueHub (Website.gs).
var _rclNewsList = [];

function _rclRenderNews(hub) {
  var body = document.getElementById('rcl-news-body');
  if (!body) return;
  body.innerHTML = '';
  _rclNewsList = hub.news || [];

  if (!_rclNewsList.length) {
    body.appendChild(_rclEmptyState('No News Yet', 'League news and race recaps will show up here.'));
    return;
  }

  var current = _rclNewsList[0];
  var currentWrap = _rclEl('div', 'rcl-news-item rcl-news-current');
  if (current.heroImageUrl) {
    var heroImg = document.createElement('img');
    heroImg.className = 'rcl-news-hero';
    heroImg.src = current.heroImageUrl;
    heroImg.alt = current.title || '';
    heroImg.loading = 'lazy';
    currentWrap.appendChild(heroImg);
  }
  currentWrap.appendChild(_rclEl('div', 'rcl-news-title', _rclEscapeHtml(current.title)));
  currentWrap.appendChild(_rclEl('div', 'rcl-news-meta', _rclEscapeHtml(_rclNewsMetaLine(current))));
  currentWrap.appendChild(_rclEl('div', 'rcl-news-current-body', _rclStoryPreviewHtml(current.body)));
  var continueLink = _rclEl('a', 'rcl-news-continue', 'Continue reading...');
  continueLink.href = 'javascript:void(0)';
  continueLink.addEventListener('click', function () { _rclOpenStoryModal(0); });
  currentWrap.appendChild(continueLink);
  body.appendChild(currentWrap);

  if (_rclNewsList.length > 1) {
    var prevWrap = _rclEl('div', 'rcl-news-previous');
    prevWrap.appendChild(_rclEl('div', 'rcl-news-previous-head', 'More Stories'));
    // Capped at the next 5 (2026-09-19, Matt's call) -- anything older
    // than that stays reachable only through the read-story popup's own
    // "Load More News" button, not listed out here on the page.
    _rclNewsList.slice(1, 6).forEach(function (item, i) {
      var titleBtn = _rclEl('button', 'rcl-news-previous-title', _rclEscapeHtml(item.title || '(untitled)'));
      titleBtn.type = 'button';
      titleBtn.addEventListener('click', function () { _rclOpenStoryModal(i + 1); });
      prevWrap.appendChild(titleBtn);
    });
    body.appendChild(prevWrap);
  }
}

// Read-story popup: shows the story at `startIndex` in full, plus a
// "Load More News" button that appends the next 3 older stories every
// time it's pressed, straight out of the already-fetched _rclNewsList
// (see that var's comment above for why this needs no new server call).
function _rclOpenStoryModal(startIndex) {
  var list = _rclNewsList;
  if (!list || !list.length) return;
  var shownUpTo = startIndex;

  var overlay = _rclEl('div', 'rcl-modal-overlay');
  var dialog = _rclEl('div', 'rcl-modal-dialog');
  var head = _rclEl('div', 'rcl-modal-head');
  head.appendChild(_rclEl('div', 'rcl-modal-title', 'League News'));
  var closeBtn = _rclEl('button', 'rcl-modal-close', '&times;');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  head.appendChild(closeBtn);
  dialog.appendChild(head);
  var storiesWrap = _rclEl('div', 'rcl-modal-body');
  dialog.appendChild(storiesWrap);
  var loadMoreWrap = _rclEl('div', 'rcl-modal-loadmore-wrap');
  var loadMoreBtn = _rclEl('button', 'rcl-modal-loadmore-btn', 'Load More News');
  loadMoreBtn.type = 'button';
  loadMoreWrap.appendChild(loadMoreBtn);
  dialog.appendChild(loadMoreWrap);
  overlay.appendChild(dialog);

  function renderStoryInto(item) {
    var wrap = _rclEl('div', 'rcl-news-item rcl-modal-story');
    if (item.heroImageUrl) {
      var heroImg = document.createElement('img');
      heroImg.className = 'rcl-news-hero';
      heroImg.src = item.heroImageUrl;
      heroImg.alt = item.title || '';
      heroImg.loading = 'lazy';
      wrap.appendChild(heroImg);
    }
    wrap.appendChild(_rclEl('div', 'rcl-news-title', _rclEscapeHtml(item.title)));
    wrap.appendChild(_rclEl('div', 'rcl-news-meta', _rclEscapeHtml(_rclNewsMetaLine(item))));
    var bodyEl = _rclEl('div', 'rcl-news-body');
    _rclRenderStoryBodyBlocks(bodyEl, item.body);
    wrap.appendChild(bodyEl);
    if (item.editNote) {
      var editLabel = _rclFormatDate(item.editedAt);
      var editText = 'Edited' + (editLabel ? ' ' + editLabel : '') + ' -- ' + item.editNote;
      wrap.appendChild(_rclEl('div', 'rcl-news-editnote', _rclEscapeHtml(editText)));
    }
    storiesWrap.appendChild(wrap);
  }

  function updateLoadMoreVisibility() {
    loadMoreWrap.style.display = (shownUpTo >= list.length - 1) ? 'none' : '';
  }

  renderStoryInto(list[startIndex]);
  updateLoadMoreVisibility();

  loadMoreBtn.addEventListener('click', function () {
    var added = 0;
    while (added < 3 && shownUpTo + 1 < list.length) {
      shownUpTo++;
      renderStoryInto(list[shownUpTo]);
      added++;
    }
    updateLoadMoreVisibility();
  });

  // Closable ONLY via the X button (2026-09-19, Matt's call) -- no
  // backdrop click, no Escape key. Same "avoid an accidental close"
  // posture Account.html's own generic modal already uses.
  function close() {
    document.body.removeChild(overlay);
  }
  closeBtn.addEventListener('click', close);

  document.body.appendChild(overlay);
}

// ---------------------------------------------------------------------
// PAGE HERO -- season number + name, and two stat strips built from real
// data instead of one long pipe-separated sentence (2026-09-19, Matt's
// call: the old sentence was "boring to look at"). "This Season" is
// season-specific (dates, race count, per-class driver counts, drop
// races, rounds completed); "League Format" is the season-wide race
// rules (tires, practice/qualifying length, setup/pit stop rules, fuel
// and tire wear multipliers) pulled from hub.raceSettings, same field
// set the Season Creation Wizard's Race Settings step writes. The title
// itself stays the static "League Hub" (set directly in league.html);
// the eyebrow above it carries "Race Club".
// ---------------------------------------------------------------------
function _rclBuildSnapshotStats(hub) {
  var stats = [];

  if (hub.seasonStartUtc && hub.seasonEndUtc) {
    var startLabel = _rclFormatDate(hub.seasonStartUtc);
    var endLabel = _rclFormatDate(hub.seasonEndUtc);
    if (startLabel && endLabel) {
      stats.push({ value: startLabel + (endLabel !== startLabel ? (' - ' + endLabel) : ''), label: 'Season Dates' });
    }
  }

  // Which car classes are running this season (added 2026-09-19,
  // Matt's ask: "add which cars are participating" between the season
  // dates and race-count stats) -- pulled from hub.standings, the same
  // per-class list the Leaderboard/Drivers sections below already use,
  // so this can never name a class that isn't actually fielding cars.
  var classNames = (hub.standings || []).map(function (cls) { return cls.className; }).filter(Boolean);
  if (classNames.length) {
    stats.push({ value: classNames.join(', '), label: classNames.length === 1 ? 'Class' : 'Classes' });
  }

  if (hub.totalRounds) {
    stats.push({ value: String(hub.totalRounds), label: hub.totalRounds === 1 ? 'Race' : 'Races' });
  }

  (hub.standings || []).forEach(function (cls) {
    var count = (cls.standings || []).length;
    if (count) stats.push({ value: String(count), label: (cls.className || 'Class') + ' Drivers' });
  });

  if (hub.dropWeeks) {
    stats.push({ value: String(hub.dropWeeks), label: hub.dropWeeks === 1 ? 'Drop Race' : 'Drop Races' });
  }

  if (hub.totalRounds) {
    stats.push({ value: (hub.roundsCompleted || 0) + '/' + hub.totalRounds, label: 'Rounds Completed' });
  }

  return stats;
}

// League Format -- season-wide race rules, not season-specific results
// (added 2026-09-19, Matt's ask: "add information about the league like
// tires allowed each event, practice length, qualifying length, etc.").
// Multiplier fields ('Off'/'Realistic'/'2x'/'3x', see
// RACE_SETTINGS_MULTIPLIER_OPTIONS in Account.html) are shown as-is --
// same labels the wizard itself uses, so this page can never say
// something different from what the admin actually picked.
function _rclBuildFormatStats(hub) {
  var rs = hub.raceSettings || {};
  var stats = [];
  if (rs.tireCount) stats.push({ value: String(rs.tireCount), label: 'Tires Per Event' });
  if (rs.practiceLengthMin) stats.push({ value: rs.practiceLengthMin + ' min', label: 'Practice Length' });
  if (rs.qualifyLengthMin) stats.push({ value: rs.qualifyLengthMin + ' min', label: 'Qualifying Length' });
  if (rs.setupRules) stats.push({ value: rs.setupRules, label: 'Setup Rules' });
  if (rs.pitStopReq) stats.push({ value: rs.pitStopReq, label: 'Pit Stop Rule' });
  if (rs.fuelMultiplier) stats.push({ value: rs.fuelMultiplier, label: 'Fuel Consumption' });
  if (rs.tireWearMultiplier) stats.push({ value: rs.tireWearMultiplier, label: 'Tire Wear' });
  if (rs.trackLimitPoints) stats.push({ value: String(rs.trackLimitPoints), label: 'Track Limit Points' });
  return stats;
}

function _rclRenderStatsRow(containerId, stats) {
  var row = document.getElementById(containerId);
  if (!row) return;
  row.innerHTML = '';
  stats.forEach(function (s) {
    var tile = _rclEl('div', 'rcl-hero-stat');
    tile.appendChild(_rclEl('div', 'rcl-hero-stat-value', _rclEscapeHtml(s.value)));
    tile.appendChild(_rclEl('div', 'rcl-hero-stat-label', _rclEscapeHtml(s.label)));
    row.appendChild(tile);
  });
}

function _rclRenderHero(hub) {
  // Eyebrow is static "Race Club" (set directly in league.html) --
  // nothing to fill in here anymore.
  var seasonEl = document.getElementById('rcl-hero-season');
  if (seasonEl) {
    seasonEl.textContent = hub.hasSeason && hub.seasonNumber
      ? ('Season ' + hub.seasonNumber + (hub.seasonName ? ' / ' + hub.seasonName : ''))
      : '';
  }

  var subEl = document.getElementById('rcl-hero-sub');
  var snapshotGroup = document.getElementById('rcl-hero-snapshot-group');
  var formatGroup = document.getElementById('rcl-hero-format-group');

  if (!hub.hasSeason) {
    if (subEl) { subEl.textContent = 'No season is currently underway. Check back once the next one opens.'; subEl.style.display = ''; }
    if (snapshotGroup) snapshotGroup.style.display = 'none';
    if (formatGroup) formatGroup.style.display = 'none';
    return;
  }

  if (subEl) subEl.style.display = 'none';

  var snapshotStats = _rclBuildSnapshotStats(hub);
  if (snapshotGroup) snapshotGroup.style.display = snapshotStats.length ? '' : 'none';
  _rclRenderStatsRow('rcl-hero-snapshot', snapshotStats);

  var formatStats = _rclBuildFormatStats(hub);
  if (formatGroup) formatGroup.style.display = formatStats.length ? '' : 'none';
  _rclRenderStatsRow('rcl-hero-format', formatStats);
}

document.addEventListener('DOMContentLoaded', function () {
  var RENDERERS = [_rclRenderStandings, _rclRenderResults, _rclRenderPoints, _rclRenderCalendar, _rclRenderDrivers, _rclRenderNews];
  fetchApi('getLeagueHub', {}).then(function (hub) {
    if (!hub || !hub.success) {
      _rclRenderTicker({ lastRace: null, standings: [] });
      RENDERERS.forEach(function (fn) { fn({ hasSeason: false }); });
      _rclRenderHero({ hasSeason: false });
      return;
    }
    _rclRenderHero(hub);
    _rclRenderTicker(hub);
    RENDERERS.forEach(function (fn) { fn(hub); });
  }).catch(function () {
    _rclRenderTicker({ lastRace: null, standings: [] });
    RENDERERS.forEach(function (fn) { fn({ hasSeason: false }); });
    _rclRenderHero({ hasSeason: false });
  });
});
