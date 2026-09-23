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

// Background-scroll lock for every popup on this page (2026-09-19, Matt's
// call: "anytime there is a popup ANYWHERE on the website -- I should not
// be able to scroll in the background when a popup is active") -- same
// iOS-Safari-safe pattern Account.html's own showModal() already uses
// (position:fixed instead of plain overflow:hidden, which doesn't
// reliably stop touch scrolling; the scroll position is remembered so it
// can be restored without a jump on close), reusing that exact same
// .rc-modal-scroll-locked class/CSS rule (css/style.css) rather than a
// page-specific copy -- league.html already loads style.css alongside
// css/league.css (see the file header comment), so no new CSS is needed
// here at all. league.js is otherwise self-contained from Account.html
// (no shared JS include), so this is its own small copy of the JS side
// of that pattern only.
var _rclScrollLockY = 0;
function _rclLockBodyScroll() {
  _rclScrollLockY = window.scrollY || window.pageYOffset || 0;
  document.body.style.top = '-' + _rclScrollLockY + 'px';
  document.body.classList.add('rc-modal-scroll-locked');
}
function _rclUnlockBodyScroll() {
  document.body.classList.remove('rc-modal-scroll-locked');
  document.body.style.top = '';
  window.scrollTo(0, _rclScrollLockY);
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
// as every other date this page already formats. timeZoneName: 'short'
// (added same day, Matt's ask: "put the timezone behind the race time")
// puts the abbreviation (EDT/PST/etc.) right after the time itself,
// same option Account.html's own formatRaceDateTime already uses.
function _rclFormatDateTime(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}

// A sim-clock "HH:MM" string (24-hour, as the admin typed it into the
// wizard's in-game time fields) into a 12-hour "H:MM AM/PM" label, purely
// cosmetic -- matches the 12-hour clock every other time on this page
// already reads in (2026-09-19, Calendar redesign polish pass).
function _rclFormat12h(hhmm) {
  if (!hhmm) return '';
  var parts = String(hhmm).split(':');
  if (parts.length < 2) return hhmm;
  var h = parseInt(parts[0], 10);
  if (isNaN(h)) return hhmm;
  var ampm = h >= 12 ? 'PM' : 'AM';
  var h12 = h % 12; if (h12 === 0) h12 = 12;
  return h12 + ':' + parts[1] + ' ' + ampm;
}

// A calendar entry's race length in actual minutes rather than its
// Sprint/Medium/Long tier name (2026-09-19, Matt's ask: "instead of
// saying the tier, say the minutes"). A Special Event entry already
// carries a raw raceLengthMinutes figure (see Website.gs's
// handleGetLeagueHub); a regular round only carries its tier NAME, so its
// actual minutes are looked up off that same season's own points tables
// (hub.pointsTables[tierName].duration) -- the one place that duration
// actually lives, and the same number Points Tables below shows for that
// tier, so this can never disagree with it.
function _rclEntryLengthMinutes(entry, hub) {
  if (entry.raceLengthMinutes) return Number(entry.raceLengthMinutes) || 0;
  var tier = (hub.pointsTables || {})[entry.raceLengthTier];
  return (tier && tier.duration) ? Number(tier.duration) : 0;
}

// Same 5-tier icon-by-rain-chance logic as Account.html's own
// weatherIcon() (Calendar page) -- duplicated locally rather than shared
// since league.html doesn't load Account.html (see file header comment).
function _rclWeatherIcon(entry) {
  var rc = entry.chanceOfRain || 0;
  if (rc <= 0) return (entry.weather === 'Cloudy') ? _RCL_ICON_CLOUD_PARTLY : _RCL_ICON_SUN;
  if (rc <= 25) return _RCL_ICON_CLOUD;
  if (rc <= 75) return _RCL_ICON_RAIN;
  return _RCL_ICON_RAIN_HEAVY;
}

// Builds one .rcl-chip-light pill (icon + text) -- shared by the Calendar
// meta row and the Points Tables tier duration (2026-09-19, Matt's ask:
// "use icons when possible for maximum aesthetics"). `text` is inserted
// as a real text node, never HTML, so nothing here needs escaping.
function _rclChip(iconSvg, text, outline) {
  var chip = _rclEl('span', 'rcl-chip-light' + (outline ? ' rcl-chip-outline' : ''));
  var iconSpan = _rclEl('span', 'rcl-chip-icon');
  iconSpan.innerHTML = iconSvg;
  chip.appendChild(iconSpan);
  chip.appendChild(document.createTextNode(text));
  return chip;
}

// Local copies of a handful of Account.html's ICON_* constants (same
// viewBox/stroke-width/cap/join convention -- see the
// race-club-ui-consistency skill's icon section) -- league.html doesn't
// load Account.html, so these can't be shared directly.
var _RCL_ICON_CLOCK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 16 14"></polyline></svg>';
var _RCL_ICON_SUN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><line x1="12" y1="2" x2="12" y2="4"></line><line x1="12" y1="20" x2="12" y2="22"></line><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"></line><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"></line><line x1="2" y1="12" x2="4" y2="12"></line><line x1="20" y1="12" x2="22" y2="12"></line><line x1="4.2" y1="19.8" x2="5.6" y2="18.4"></line><line x1="18.4" y1="5.6" x2="19.8" y2="4.2"></line></svg>';
var _RCL_ICON_CLOUD = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.7-1.6A4.5 4.5 0 0 0 7 18z"></path></svg>';
var _RCL_ICON_CLOUD_PARTLY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="17" cy="7" r="3"></circle><path d="M4 17h9a3.5 3.5 0 0 0 0-7 4.8 4.8 0 0 0-8.6 2.1A3.2 3.2 0 0 0 4 17z"></path></svg>';
var _RCL_ICON_RAIN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 15h9a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.4-1.4A4 4 0 0 0 6.5 15z"></path><line x1="8" y1="18" x2="7" y2="21"></line><line x1="12" y1="18" x2="11" y2="21"></line><line x1="16" y1="18" x2="15" y2="21"></line></svg>';
var _RCL_ICON_RAIN_HEAVY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 13h9a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.4-1.2A4 4 0 0 0 6 13z"></path><line x1="6" y1="16" x2="5" y2="19"></line><line x1="9.5" y1="16" x2="8.5" y2="19"></line><line x1="13" y1="16" x2="12" y2="19"></line><line x1="16.5" y1="16" x2="15.5" y2="19"></line><line x1="7.5" y1="19" x2="6.5" y2="22"></line><line x1="14.5" y1="19" x2="13.5" y2="22"></line></svg>';
// Game controller -- no equivalent in Account.html's icon set (its
// in-game times are plain text there), drawn fresh in the same style for
// the Calendar's original "In-Game" chip. Superseded by _RCL_ICON_FLAG
// below (2026-09-21, Matt's ask: "make the in-game pill show a flag for
// the icon") but left defined in case anything else on this page still
// wants a gamepad glyph later.
var _RCL_ICON_GAMEPAD = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="8" width="20" height="10" rx="5"></rect><line x1="7" y1="11" x2="7" y2="15"></line><line x1="5" y1="13" x2="9" y2="13"></line><circle cx="16" cy="11" r="1"></circle><circle cx="18" cy="14" r="1"></circle></svg>';
// Checkered/race flag -- same glyph as Account.html's own ICON_FLAG
// (its in-game race start chip already uses this), duplicated here since
// league.html doesn't load Account.html (see the file header comment
// above). 2026-09-21, Matt's ask: "make the in-game pill show a flag for
// the icon" -- replaces the gamepad glyph above on the Calendar's
// In-Game chip.
var _RCL_ICON_FLAG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="22" x2="4" y2="3"></line><path d="M4 4h14l-3 4 3 4H4"></path></svg>';

// ---------------------------------------------------------------------
// TICKER
// ---------------------------------------------------------------------
// Ticker-only class order (2026-09-23, Matt's ask: "driver list starting
// with hypercar, then LMP2, LMP3, LMGT3 and LMGTE in that order" -- same
// order for the in-season top-5-per-class results). Deliberately the
// REVERSE of the site's usual CAR_CLASS_LIST/CAR_CLASS_CANONICAL_ORDER_
// ladder (LMGTE up to Hypercar, used everywhere else -- class picker,
// standings, results pages) -- this is a presentation order for the
// ticker specifically, top class leads, nothing else on the site follows
// it, so it's kept local here rather than touching that shared constant.
var _RCL_TICKER_CLASS_ORDER_ = ['Hypercar', 'LMP2', 'LMP3', 'LMGT3', 'LMGTE'];
function _rclSortByTickerClassOrder_(list, classNameOf) {
  return list.slice().sort(function (a, b) {
    var ai = _RCL_TICKER_CLASS_ORDER_.indexOf(classNameOf(a));
    var bi = _RCL_TICKER_CLASS_ORDER_.indexOf(classNameOf(b));
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

// Builds the scrolling item list from season/calendar/standings/
// tickerLastRace. Rendered twice back-to-back in the DOM so the CSS
// animation (translateX(-50%)) loops seamlessly -- see .rcl-ticker-track
// in css/league.css.
//
// Same "Season" + "Next Race" framing whether or not the season has any
// results yet (2026-09-23 rewrite, Matt's ask: "I want the same format
// except instead of a driver list, I want the top 5 from the recent
// results") -- only the per-class rows underneath differ: a plain driver
// roster before any race has been run, or that class's top 5 from the
// most recently posted race once results exist. Both class-row sections
// use the ticker's own Hypercar-to-LMGTE order above, not the site's
// usual LMGTE-to-Hypercar ladder. Penalties are deliberately never
// included here (Matt's rule) -- they only ever show in the full Results
// popup (_rclOpenAllResultsModal).
function _rclBuildTickerItems(hub) {
  var items = [];
  var hasResults = (hub.roundsCompleted || 0) > 0;

  if (hub.seasonNumber) {
    // Season dates appended after the name (2026-09-19 follow-up, Matt's
    // ask) -- same start/end fields and _rclFormatDate() the "This
    // Season" snapshot stat above already uses.
    var seasonDates = '';
    if (hub.seasonStartUtc && hub.seasonEndUtc) {
      var seasonStartLabel = _rclFormatDate(hub.seasonStartUtc);
      var seasonEndLabel = _rclFormatDate(hub.seasonEndUtc);
      if (seasonStartLabel && seasonEndLabel) {
        seasonDates = seasonStartLabel + (seasonEndLabel !== seasonStartLabel ? (' - ' + seasonEndLabel) : '');
      }
    }
    items.push({
      tag: 'SEASON',
      text: 'Season ' + _rclEscapeHtml(String(hub.seasonNumber)) + (hub.seasonName ? ': ' + _rclEscapeHtml(hub.seasonName) : '') +
        (seasonDates ? ' (' + _rclEscapeHtml(seasonDates) + ')' : '')
    });
  }

  // Next race -- same "first non-bye, unfinished" pick the Calendar
  // section's own "UP NEXT" pill uses (see _rclRenderCalendar above).
  var nextEntry = null;
  (hub.calendar || []).forEach(function (entry) {
    if (!nextEntry && entry.kind !== 'bye' && !entry.finished) nextEntry = entry;
  });
  if (nextEntry) {
    var nextTrackText = nextEntry.track ? (nextEntry.track + (nextEntry.layout ? ' -- ' + nextEntry.layout : '')) : '';
    var nextDateText = nextEntry.startUtc ? _rclFormatDate(nextEntry.startUtc) : '';
    items.push({
      tag: 'NEXT RACE',
      text: _rclEscapeHtml(nextEntry.eventName || 'Race') +
        (nextTrackText ? ' at ' + _rclEscapeHtml(nextTrackText) : '') +
        (nextDateText ? ' (' + _rclEscapeHtml(nextDateText) + ')' : '')
    });
  }

  if (!hasResults) {
    var classLists = _rclSortByTickerClassOrder_(hub.standings || [], function (cls) { return cls.className; });
    classLists.forEach(function (cls) {
      var standings = cls.standings || [];
      if (!standings.length) return;
      // Car number appended after each name (2026-09-20, Matt's ask) --
      // "#n" straight after the name, same shorthand the Leaderboard
      // panel's own row markup already uses (.rcl-standings-carnum).
      var names = standings.map(function (row) {
        if (!row.name) return null;
        return _rclEscapeHtml(row.name) + (row.carNumber ? ' #' + _rclEscapeHtml(row.carNumber) : '');
      }).filter(Boolean).join(', ');
      items.push({ tag: (cls.className || 'CLASS').toUpperCase() + ' DRIVERS', text: names });
    });
    return items;
  }

  // In-season: top 5 from the most recently posted race, per class, in
  // the ticker's Hypercar-to-LMGTE order -- hub.tickerLastRace is the
  // SAME round as hub.lastRace (the abbreviated Recent Results panel's
  // own data) but capped per-class only, not per-class-COUNT, so every
  // class the round actually has shows here even though Recent Results
  // itself only has room to show 3 (see handleGetLeagueHub, Website.gs).
  var lastRace = hub.tickerLastRace;
  if (lastRace) {
    var raceLabel = _rclEscapeHtml(lastRace.eventName || 'Race') + (lastRace.roundNum ? (' (Round ' + lastRace.roundNum + ')') : '');
    var resultClasses = _rclSortByTickerClassOrder_(lastRace.classes || [], function (cls) { return cls.className; });
    resultClasses.forEach(function (cls) {
      var standings = (cls.standings || []).slice(0, 5);
      if (!standings.length) return;
      var names = standings.map(function (row) {
        if (!row.name) return null;
        return _rclEscapeHtml(row.name) + (row.carNumber ? ' #' + _rclEscapeHtml(row.carNumber) : '');
      }).filter(Boolean).join(', ');
      items.push({ tag: (cls.className || 'CLASS').toUpperCase() + ' TOP 5', text: raceLabel + ': ' + names });
    });
  }

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

  // A trailing dot closes out every run (2026-09-19, Matt's ask: "just
  // repeat the same line after the first one automatically... a dot in
  // between the repeated line would be a nice touch") -- since each run
  // is identical and both carry the same trailing dot, the seam where the
  // second run picks back up right after the first reads as "...item •
  // item..." the same way a real news ticker separates its loop point,
  // rather than the runs just butting up against each other. Kept INSIDE
  // buildRun (not appended once after the loop below) so every run stays
  // exactly equal-width, which is what makes the translateX loop seamless
  // in the first place.
  function buildRun() {
    var frag = document.createDocumentFragment();
    items.forEach(function (item) {
      var el = _rclEl('div', 'rcl-ticker-item');
      // Tag now matches the rest of the line's font (2026-09-19 follow-up,
      // Matt: "make the red category labels just a regular font... I want
      // the text to look the same as it scrolls") -- a plain colon marks
      // where the label ends and the data starts instead of a color/weight
      // change. See .rcl-ticker-item-tag in css/league.css.
      el.appendChild(_rclEl('span', 'rcl-ticker-item-tag', item.tag + ':'));
      el.appendChild(document.createTextNode(item.text));
      frag.appendChild(el);
    });
    frag.appendChild(_rclEl('div', 'rcl-ticker-loop-dot', '&bull;'));
    return frag;
  }

  // Back to 2 runs (2026-09-19 follow-up, Matt: with season dates + next
  // race now added to the no-results ticker content, "I think the ticker
  // will only ever need to display two at a time to make sure there
  // aren't gaps -- not 3").
  var RUN_COUNT = 2; // number of concatenated copies of the item list -- see the
  // animation comment above; must stay in sync with the -50% end value on
  // rcl-ticker-scroll in css/league.css (translateX moves exactly one run's
  // width per loop, i.e. -100/RUN_COUNT %)
  track.innerHTML = '';
  for (var runIdx = 0; runIdx < RUN_COUNT; runIdx++) {
    track.appendChild(buildRun());
  }

  // Roll in from off-screen right ONCE on first paint, then hand off to
  // the normal seamless infinite loop (2026-09-19 follow-up, Matt's
  // catch: "the ticker only shows a maximum of 2 entries and right as
  // the second entry makes it to the left side... it all disappears and
  // starts over" -- the earlier fix for the original "text just appears,
  // doesn't roll in" report used a single infinite keyframe whose OWN
  // `from` was off-screen-right, which meant it restarted off-screen on
  // *every* loop, not just the first -- the ticker never reached the
  // seamless part at all, just an endless one-item-at-a-time intro).
  //
  // Two separate animations avoid that: a one-shot "intro" (measured
  // off-screen start -> translateX(0), via a JS-measured CSS custom
  // property, since a plain keyframe can't express "one viewport-width
  // further right than a plain reset"), immediately followed (via
  // animation-delay, not overlapping it) by the ORIGINAL always-worked
  // infinite loop starting fresh from exactly where the intro left off.
  // The intro runs at a short, fixed duration (see introDurationSec
  // below) rather than one derived from the main loop's speed -- see
  // that comment for why.
  //
  // Skipped entirely under prefers-reduced-motion -- setting this inline
  // would otherwise override that media query's own `animation: none`
  // (an inline style always beats an external stylesheet rule), silently
  // reintroducing motion for someone who asked not to see it.
  var reduceMotion = (typeof window.matchMedia === 'function') && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  // requestAnimationFrame, not immediate -- scrollWidth needs the two
  // freshly-appended runs to have actually been laid out first.
  requestAnimationFrame(function () {
    var viewport = track.parentElement;
    if (!viewport) return;
    // Constant scroll SPEED, not constant duration (2026-09-23, Matt's
    // catch: "the ticker speed is crazy fast... not sure if the speed is
    // in relation to how much is written so the speed is scaled"). It
    // was -- the old code fixed this duration at a flat 19s no matter how
    // wide the track actually was, so a content-heavy day (more classes/
    // standings rows in the item list) had to cover much more ground in
    // that same 19s and visibly raced by, while a short ticker crawled.
    // Duration is now derived from the real measured width of one run
    // (track.scrollWidth covers both concatenated runs, see RUN_COUNT
    // above, so divide by it to get one run's width) against a fixed
    // px/sec rate, so the strip always moves at the same visual pace no
    // matter how much text it's carrying.
    var PX_PER_SEC = 70; // tuned to read as a steady, easy-to-follow news-ticker crawl
    var MIN_DURATION_SEC = 12; // floor so a very short ticker (e.g. no results yet) doesn't zip past
    var runWidth = track.scrollWidth / RUN_COUNT;
    var mainDurationSec = Math.max(runWidth / PX_PER_SEC, MIN_DURATION_SEC);
    // The intro is just a quick "slide the strip on screen" reveal, so it runs
    // at a fixed pace regardless of viewport width -- deriving it proportionally
    // from the main loop's (slow, by design) px/sec rate made the very first
    // roll-in sluggish on wide screens.
    var introDurationSec = 1.1;
    track.style.setProperty('--rcl-ticker-start', viewport.clientWidth + 'px');
    // Restart cleanly (a plain property/animation-shorthand change alone
    // doesn't rewind an already-running animation) -- toggle animation
    // off, force a reflow, then set the real intro+loop pair.
    track.style.animation = 'none';
    void track.offsetWidth;
    track.style.animation = 'rcl-ticker-intro ' + introDurationSec.toFixed(2) + 's linear forwards, ' +
      'rcl-ticker-scroll ' + mainDurationSec.toFixed(2) + 's linear ' + introDurationSec.toFixed(2) + 's infinite';
  });
}

// ---------------------------------------------------------------------
// LEADERBOARD (standings)
// ---------------------------------------------------------------------
// Holds the full fetched hub so the "View Points Tables" link's popup
// (opened well after this render finishes) can build its tables without
// a second server round trip -- same pattern _rclNewsList already uses
// for the story popup.
var _rclHubForPoints = null;

// Builds the whole "one column per class" grid -- shared by the ranked
// Standings panel (hasResults true, real points) and the Drivers popup
// below (hasResults always false, a plain roster) -- 2026-09-21 refactor,
// pulled out of _rclRenderStandings so both places render an identical
// row for identical data instead of two copies of this markup drifting
// apart over time. hasResults being false renders exactly what the
// Standings panel used to show itself before its first race was scored
// (empty position slot, no points column) -- see the per-arg comments
// below for why each piece looks the way it does.
function _rclBuildStandingsColumns_(standings, hasResults) {
  // One column per class (2026-09-19, Matt's call) -- .rcl-standings-
  // columns is the grid wrapper (css/league.css), auto-fitting however
  // many classes the season actually has.
  var columns = _rclEl('div', 'rcl-standings-columns');
  standings.forEach(function (cls) {
    var wrap = _rclEl('div', 'rcl-standings-class');
    // Driver list (hasResults false -- this is the ONLY caller that ever
    // passes false, see _rclOpenDriversModal below) gets a colored class
    // pill instead of the plain text label the ranked Standings panel
    // uses (2026-09-23, Matt's ask: "at the top, use the designated
    // class color and create a class pill for each class column") --
    // color comes from CAR_CLASS_BADGE_COLOR_VAR (reference-data.js), the
    // same per-class CSS variable tokens (--rc-class-hypercar, etc.,
    // defined in style.css) every other class badge on the site already
    // pulls from, so this can never show a color that disagrees with the
    // class picker/car badges elsewhere. Falls back to a plain neutral
    // pill if the class name isn't one of the five known ones.
    if (!hasResults) {
      var pill = _rclEl('div', 'rcl-standings-class-pill', _rclEscapeHtml(cls.className || 'Class'));
      var pillColorVar = (typeof CAR_CLASS_BADGE_COLOR_VAR !== 'undefined') ? CAR_CLASS_BADGE_COLOR_VAR[cls.className] : null;
      if (pillColorVar) pill.style.background = 'var(' + pillColorVar + ')';
      wrap.appendChild(pill);
    } else {
      wrap.appendChild(_rclEl('div', 'rcl-standings-class-name', _rclEscapeHtml(cls.className || 'Class')));
    }
    var clsStandings = cls.standings || [];
    if (!clsStandings.length) {
      wrap.appendChild(_rclEl('div', 'rcl-empty-state-subtitle', 'No drivers registered in this class yet.'));
    } else {
      var leaderPts = clsStandings[0].championshipPoints;
      // Metal-color modifier by finish position (2026-09-19, Matt's call:
      // "Make 1st gold, 2nd silver, and 3rd bronze and the rest can be a
      // titanium metal color") -- replaces the old red "lead" tint, since
      // gold/silver/bronze already reads as rank on its own.
      var POS_METAL_CLASS = ['rcl-standings-row-p1', 'rcl-standings-row-p2', 'rcl-standings-row-p3'];
      clsStandings.forEach(function (row, idx) {
        // No points column while hasResults is false, but the position
        // container itself STAYS (2026-09-19 follow-up, Matt's
        // clarification: "still show the same number containers, just
        // without the numbers and keeping the same width but using the
        // titanium colored backgrounds") -- empty text, no p1/p2/p3 metal
        // class (so it falls back to .rcl-standings-pos's own default
        // titanium gradient, the same one non-podium rows already use),
        // same 40px slot and grid-template-columns as a normal row. This
        // is also exactly the mode the Drivers popup always renders in
        // (2026-09-21) -- a driver roster, not a ranking.
        // Driver list rows (hasResults false) drop the big colored number
        // container entirely in favor of a simple left line (2026-09-23,
        // Matt's ask: "add a simple left line to each row instead of the
        // larger 'number container'") -- there's no rank to show in this
        // roster view anyway (see the empty-text version this used to
        // render), so the badge-sized box was pure visual weight with
        // nothing in it. .rcl-standings-row-simple (css/league.css)
        // swaps the row's grid to a single column and adds the thin
        // accent line in its place.
        var rowEl = _rclEl('div', 'rcl-standings-row' + (hasResults && POS_METAL_CLASS[idx] ? ' ' + POS_METAL_CLASS[idx] : '') + (!hasResults ? ' rcl-standings-row-simple' : ''));
        if (hasResults) {
          rowEl.appendChild(_rclEl('div', 'rcl-standings-pos', String(idx + 1)));
        }

        // Identity block, all on one line now (2026-09-19 follow-up,
        // Matt's call: "reduce the size of the manufacturer logo, place
        // it next to the name, then show the nationality flag... then
        // show the team number... then place the team after it -- all of
        // this in the same size font as the driver name"): logo, driver
        // name, country flag, car number, team name, left to right in a
        // single row instead of name+flag on one line and team on its
        // own line below. Logo/flag are optional images that hide
        // themselves via onerror if the asset hasn't been uploaded yet
        // (see countryFlagSrc's own comment in reference-data.js -- no
        // assets/flags/ folder exists on disk yet, which is why the flag
        // has never actually shown up), or if reference-data.js's
        // helpers aren't available for some reason.
        var identity = _rclEl('div', 'rcl-standings-identity');
        var logoSlot = _rclEl('div', 'rcl-standings-mfr-logo-slot');
        if (row.manufacturer && typeof manufacturerLogoSrc === 'function') {
          var logoImg = document.createElement('img');
          logoImg.className = 'rcl-standings-mfr-logo';
          logoImg.src = manufacturerLogoSrc(row.manufacturer);
          logoImg.alt = '';
          logoImg.onerror = function () { logoSlot.style.display = 'none'; };
          logoSlot.appendChild(logoImg);
        } else {
          logoSlot.style.display = 'none';
        }
        identity.appendChild(logoSlot);

        var nameRow = _rclEl('div', 'rcl-standings-name-row');
        nameRow.appendChild(_rclEl('span', 'rcl-standings-name', _rclEscapeHtml(row.name)));
        if (row.country && typeof countryFlagSrc === 'function') {
          var flagSrc = countryFlagSrc(row.country);
          if (flagSrc) {
            var flagImg = document.createElement('img');
            flagImg.className = 'rcl-standings-flag';
            flagImg.src = flagSrc;
            flagImg.alt = '';
            flagImg.title = row.country;
            flagImg.onerror = function () { flagImg.style.display = 'none'; };
            nameRow.appendChild(flagImg);
          }
        }
        if (row.carNumber) nameRow.appendChild(_rclEl('span', 'rcl-standings-carnum', '#' + _rclEscapeHtml(row.carNumber)));
        if (row.teamName) nameRow.appendChild(_rclEl('span', 'rcl-standings-team', _rclEscapeHtml(row.teamName)));
        identity.appendChild(nameRow);
        rowEl.appendChild(identity);

        if (hasResults) {
          var ptsCol = _rclEl('div', 'rcl-standings-pts');
          ptsCol.appendChild(_rclEl('div', 'rcl-standings-pts-num', String(row.championshipPoints)));
          if (idx !== 0) {
            var gap = '-' + (leaderPts - row.championshipPoints) + ' PTS';
            ptsCol.appendChild(_rclEl('div', 'rcl-standings-pts-gap', gap));
          }
          rowEl.appendChild(ptsCol);
        }
        wrap.appendChild(rowEl);
      });
    }
    columns.appendChild(wrap);
  });
  return columns;
}

function _rclRenderStandings(hub) {
  var body = document.getElementById('rcl-standings-body');
  if (!body) return;
  body.innerHTML = '';
  _rclHubForPoints = hub;

  var hasStandings = hub.hasSeason && hub.standings && hub.standings.length;
  // Before any race has actually been run, there's nothing to rank yet
  // (2026-09-19 follow-up, Matt's call: "if there hasn't been a race
  // posted yet, there shouldn't be a ranked list -- just the graphic
  // container, no number, and no points") -- same hasResults gate the
  // ticker already uses (roundsCompleted > 0).
  // 2026-09-21 follow-up (Matt's catch): that pre-results state used to
  // show the plain driver roster right here, which meant a driver could
  // ONLY ever be found by scrolling this panel. Roster browsing moved out
  // to its own "View All Drivers" popup (_rclOpenDriversModal below,
  // reachable anytime a season has registrations), and CURRENT STANDINGS
  // itself now shows the same circle-slash "no data" empty state RECENT
  // RESULTS uses whenever there's nothing ranked to show yet -- Standings
  // is purely about ranked results now, not a roster fallback.
  var hasResults = (hub.roundsCompleted || 0) > 0;

  if (!hasStandings || !hasResults) {
    var emptyMsg = !hasStandings
      ? 'Standings fill in once a season is underway.'
      : 'Standings fill in once a race has been scored.';
    body.appendChild(_rclEmptyState('No Data To Display', emptyMsg));
  } else {
    // "Unofficial Results" note (2026-09-19 follow-up, Matt's
    // clarification: standings should still update the moment results
    // are imported -- that already happens server-side -- but need a
    // visual cue that they aren't official until an organizer finalizes
    // them) -- hub.hasUnofficialResults is true the moment ANY completed
    // round hasn't been finalized yet (see handleGetLeagueHub in
    // Website.gs), since the season total is a sum across every round.
    if (hub.hasUnofficialResults) {
      body.appendChild(_rclEl('div', 'rcl-standings-unofficial-note', 'Unofficial Results -- pending organizer finalization'));
    }
    body.appendChild(_rclBuildStandingsColumns_(hub.standings, true));
  }

  // "View Points Tables" / "View All Drivers" links (2026-09-19 /
  // 2026-09-21) -- shown whenever the season actually has registered
  // drivers to show, whether or not any race has been scored yet, so the
  // Drivers popup stays reachable even during the empty-state above.
  if (hasStandings) {
    var linkRow = _rclEl('div', 'rcl-standings-points-row');
    var pointsLink = _rclEl('button', 'rcl-standings-points-link', 'View Points Tables');
    pointsLink.type = 'button';
    pointsLink.addEventListener('click', function () { _rclOpenPointsModal(_rclHubForPoints); });
    linkRow.appendChild(pointsLink);
    // "View All Drivers" (2026-09-21, Matt's ask: "a link next to the
    // points tables link... that opens up a drivers list popup") -- same
    // link styling, second in the row.
    var driversLink = _rclEl('button', 'rcl-standings-points-link', 'View All Drivers');
    driversLink.type = 'button';
    driversLink.addEventListener('click', function () { _rclOpenDriversModal(_rclHubForPoints); });
    linkRow.appendChild(driversLink);
    body.appendChild(linkRow);
  }
}

// Drivers popup (2026-09-21, Matt's ask): a season's full roster, always
// in the same "no rank, no points" mode the Standings panel itself shows
// before its first race is scored (see _rclBuildStandingsColumns_ above)
// -- reachable any time a season has registrations, not gated on results
// existing, so a driver isn't ONLY ever discoverable through the ranked
// Standings list. Same .rcl-modal-overlay/dialog shell every other League
// Hub popup uses (_rclOpenPointsModal/_rclOpenSeasonDetailsModal), styled
// to match a .rcl-panel exactly.
function _rclOpenDriversModal(hub) {
  var overlay = _rclEl('div', 'rcl-modal-overlay');
  // rcl-modal-dialog-wide (2026-09-21, Matt's ask: "increase the width of
  // the drivers list popup") -- a scoped modifier on the shared dialog
  // shell (see .rcl-modal-dialog-wide, league.css) rather than widening
  // .rcl-modal-dialog itself, since News/Points Table/Season Details all
  // share that base class and were never asked to get wider too. The
  // full driver roster (identity block + car/team columns) is the widest
  // content any of these modals shows, so it's the one that benefits.
  var dialog = _rclEl('div', 'rcl-modal-dialog rcl-modal-dialog-wide');
  var head = _rclEl('div', 'rcl-modal-head');
  head.appendChild(_rclEl('div', 'rcl-modal-title', 'Drivers'));
  var closeBtn = _rclEl('button', 'rcl-modal-close', '&times;');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  head.appendChild(closeBtn);
  dialog.appendChild(head);

  var body = _rclEl('div', 'rcl-modal-body');
  if (!hub || !hub.hasSeason || !hub.standings || !hub.standings.length) {
    body.appendChild(_rclEmptyState('No Data To Display', 'Drivers fill in once a season is underway.'));
  } else {
    body.appendChild(_rclBuildStandingsColumns_(hub.standings, false));
  }
  dialog.appendChild(body);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  _rclLockBodyScroll();
  function close() {
    overlay.remove();
    _rclUnlockBodyScroll();
  }
  closeBtn.addEventListener('click', close);
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
    // "View All Results" (2026-09-23) still gets a chance to appear even
    // when the abbreviated lastRace panel has nothing to show -- see the
    // shared block at the end of this function.
    _rclAppendViewAllResultsLink_(body, hub);
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

  // "View All Results" (2026-09-23, Matt's ask) -- opens the full,
  // uncapped results for any completed round in a popup, WITH that
  // round's penalties list. Penalties are deliberately NOT rendered here
  // inline at the bottom of Recent Results -- Matt's explicit placement
  // call -- they only ever show inside that popup (_rclOpenAllResultsModal
  // below), which is what this link opens.
  _rclAppendViewAllResultsLink_(body, hub);
}

// Shared by both branches of _rclRenderResults above (the normal render
// and its "no lastRace yet" empty-state fallback) so the link still shows
// up whenever the season actually has any completed rounds on record,
// even in the rare case the abbreviated lastRace payload itself came back
// empty for some reason.
function _rclAppendViewAllResultsLink_(body, hub) {
  if (!hub.resultsRounds || !hub.resultsRounds.length) return;
  var linkRow = _rclEl('div', 'rcl-cal-details-row');
  var link = _rclEl('button', 'rcl-cal-details-link', 'View All Results');
  link.type = 'button';
  link.addEventListener('click', function () { _rclOpenAllResultsModal(hub); });
  linkRow.appendChild(link);
  body.appendChild(linkRow);
}

// ---------------------------------------------------------------------
// ALL RESULTS POPUP (added 2026-09-23) -- the FULL, uncapped result set
// for any completed round in the current season, picked from a dropdown
// (hub.resultsRounds, most recent first), plus that round's "Penalties
// Assessed" list. This is where a round's penalties actually show up on
// the League Hub -- Matt's explicit placement call was "in the View All
// Results popup on the Recent Results container, not the bottom of the
// Recent Results container" -- so unlike everything else in Recent
// Results (which is the abbreviated top-5-per-class/3-class hub.lastRace
// payload), this popup always fetches the specific round's full data
// fresh from handleGetPublicRoundResults (Website.gs) rather than reusing
// the already-fetched hub.
// ---------------------------------------------------------------------

// Tier effect text for one penalty entry -- effectType/effectSeconds come
// straight off the Adjustments row this penalty was built from (see
// _rcBuildRoundResultData_'s penaltiesThisRound, Results.gs). Tier 1/7
// never produce a penalty row in the first place (see PENALTY_TIER_EFFECTS_,
// Protests.gs / PENALTY_TIERS, reference-data.js), so this only ever needs
// to describe a Time or DSQ effect.
function _rclDescribePenaltyEffect_(effectType, effectSeconds) {
  if (effectType === 'Time') return '+' + (Number(effectSeconds) || 0) + 's';
  if (effectType === 'DSQ') return 'Disqualified';
  return 'Logged';
}

// Renders one round's full result data (from handleGetPublicRoundResults)
// into `bodyEl` -- the popup's own content area, rebuilt fresh every time
// the round dropdown changes.
function _rclBuildAllResultsBody_(result, bodyEl) {
  bodyEl.innerHTML = '';
  if (!result) {
    bodyEl.appendChild(_rclEmptyState('No Data To Display', 'No posted results for that round.'));
    return;
  }

  var headline = _rclEl('div', 'rcl-race-headline');
  function stat(label, value, accent) {
    var s = _rclEl('div', 'rcl-race-headline-stat');
    s.appendChild(_rclEl('div', 'rcl-race-headline-label', label));
    s.appendChild(_rclEl('div', 'rcl-race-headline-value' + (accent ? ' rcl-race-headline-value-accent' : ''), _rclEscapeHtml(value || '--')));
    return s;
  }
  headline.appendChild(stat('Event', (result.eventName || '') + (result.track ? ' -- ' + result.track : '')));
  headline.appendChild(stat('Winner', result.overallWinner, true));
  headline.appendChild(stat('Pole', result.overallPoleSitter));
  headline.appendChild(stat('Fastest Lap', result.overallFastestLapDriver ? (result.overallFastestLapDriver + (result.overallFastestLapTime ? ' (' + result.overallFastestLapTime + ')' : '')) : ''));
  bodyEl.appendChild(headline);

  // profileId -> display name, built off this round's own full standings
  // -- penalties (below) only carry a profileId (see the `against` field
  // on _rcBuildRoundResultData_'s penaltiesThisRound, Results.gs), so this
  // is how the popup resolves a name to show next to each one.
  var namesByProfileId = {};
  (result.classes || []).forEach(function (cls) {
    var clsWrap = _rclEl('div', 'rcl-race-class');
    var countLabel = cls.className ? (cls.className + (cls.totalInClass ? ' (' + cls.totalInClass + ')' : '')) : 'Class';
    clsWrap.appendChild(_rclEl('div', 'rcl-race-class-name', _rclEscapeHtml(countLabel)));
    (cls.standings || []).forEach(function (row) {
      if (row.profileId) namesByProfileId[row.profileId] = row.name;
      var rowEl = _rclEl('div', 'rcl-race-row');
      var posText = row.disqualified ? 'DSQ' : String(row.classPosition || row.position || '');
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-pos', posText));
      var nameCol = _rclEl('div');
      nameCol.appendChild(_rclEl('span', 'rcl-race-row-name', _rclEscapeHtml(row.name)));
      if (row.carNumber) nameCol.appendChild(_rclEl('span', 'rcl-race-row-num', ' #' + _rclEscapeHtml(row.carNumber)));
      rowEl.appendChild(nameCol);
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-time', _rclEscapeHtml(row.bestLapTime || '')));
      clsWrap.appendChild(rowEl);
    });
    bodyEl.appendChild(clsWrap);
  });

  // Penalties Assessed -- this round's Adjustments, resolved to driver
  // names. This is the one and only place a round's penalties render on
  // the League Hub (Matt's placement call, see this section's header
  // comment above).
  var penSection = _rclEl('div', 'rcl-penalties-section');
  penSection.appendChild(_rclEl('div', 'rcl-race-class-name', 'Penalties Assessed'));
  var penalties = result.penalties || [];
  if (!penalties.length) {
    penSection.appendChild(_rclEl('div', 'rcl-empty-state-subtitle', 'No penalties were assessed for this round.'));
  } else {
    penalties.forEach(function (p) {
      var row = _rclEl('div', 'rcl-penalty-row');
      var name = (p.against && namesByProfileId[p.against]) || 'Unknown Driver';
      row.appendChild(_rclEl('div', 'rcl-penalty-name', _rclEscapeHtml(name)));
      var tierInfo = (typeof penaltyTierByNumber === 'function') ? penaltyTierByNumber(p.penaltyTier) : null;
      var tierLabel = tierInfo ? tierInfo.label.replace(/^Tier \d+ -- /, '') : ('Tier ' + (p.penaltyTier || '?'));
      var detailText = (p.infractionType || 'Infraction') + ' -- ' + tierLabel +
        ' (' + _rclDescribePenaltyEffect_(p.effectType, p.effectSeconds) + ')';
      row.appendChild(_rclEl('div', 'rcl-penalty-detail', _rclEscapeHtml(detailText)));
      penSection.appendChild(row);
    });
  }
  bodyEl.appendChild(penSection);
}

function _rclOpenAllResultsModal(hub) {
  var rounds = hub.resultsRounds || [];
  if (!rounds.length) return;

  var overlay = _rclEl('div', 'rcl-modal-overlay');
  var dialog = _rclEl('div', 'rcl-modal-dialog rcl-modal-dialog-wide');
  var head = _rclEl('div', 'rcl-modal-head');
  head.appendChild(_rclEl('div', 'rcl-modal-title', 'All Results'));
  var closeBtn = _rclEl('button', 'rcl-modal-close', '&times;');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  head.appendChild(closeBtn);
  dialog.appendChild(head);

  var body = _rclEl('div', 'rcl-modal-body');

  var selectRow = _rclEl('div', 'rcl-allresults-select-row');
  var select = document.createElement('select');
  select.className = 'rcl-allresults-select';
  rounds.forEach(function (r) {
    var opt = document.createElement('option');
    opt.value = r.roundId;
    var label = (r.roundNum ? 'R' + r.roundNum + ' -- ' : '') + (r.eventName || r.track || r.roundId);
    if (r.startUtc) label += ' (' + _rclFormatDate(r.startUtc) + ')';
    opt.textContent = label;
    select.appendChild(opt);
  });
  selectRow.appendChild(select);
  body.appendChild(selectRow);

  var resultsWrap = _rclEl('div', 'rcl-allresults-body');
  body.appendChild(resultsWrap);
  dialog.appendChild(body);
  overlay.appendChild(dialog);

  function loadRound(roundId) {
    resultsWrap.innerHTML = '';
    resultsWrap.appendChild(_rclEl('div', 'rcl-empty-state-subtitle', 'Loading...'));
    fetchApi('getPublicRoundResults', { roundId: roundId }).then(function (res) {
      _rclBuildAllResultsBody_((res && res.success) ? res.result : null, resultsWrap);
    }).catch(function () {
      _rclBuildAllResultsBody_(null, resultsWrap);
    });
  }

  select.addEventListener('change', function () { loadRound(select.value); });
  loadRound(rounds[0].roundId);

  // Closable ONLY via the X button -- same posture every other popup on
  // this page uses.
  function close() {
    document.body.removeChild(overlay);
    _rclUnlockBodyScroll();
  }
  closeBtn.addEventListener('click', close);

  document.body.appendChild(overlay);
  _rclLockBodyScroll();
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

    // Redesigned 2026-09-19 (Matt's call, two passes): the round label
    // owns the row's left edge (bright, large, solid red or gold for a
    // special -- see .rcl-cal-round), event name is now the bold primary
    // line at the top with the track underneath it in a lighter weight
    // ("move the event to above the track name" -- previously the other
    // way around), and a meta chip row below adds time+length, in-game
    // start, and weather -- all public-safe fields handleGetLeagueHub now
    // sends (see its own comment in Website.gs).
    var isSpecial = entry.kind === 'special';
    // rcl-cal-row-finished (2026-09-21, Matt's ask: "make both calendars
    // have the race faded out with a COMPLETED notification") -- fades
    // the round bar/event/track/meta chips once a round's start time has
    // passed (see .rcl-cal-row-finished in css/league.css), while the
    // status badge itself (appended below) stays at full opacity so the
    // COMPLETED/results notification stays legible against the faded row.
    var row = _rclEl('div', 'rcl-cal-row' + (idx === nextIdx ? ' rcl-cal-row-next' : '') + (isSpecial ? ' rcl-cal-row-special' : '') + (entry.finished ? ' rcl-cal-row-finished' : ''));
    var roundLabel = entry.roundNum ? ('R' + entry.roundNum) : (isSpecial ? 'SP' : '');
    // Special-event rounds get a gold accent instead of the standard
    // brand red (2026-09-19, Matt's ask, refined same day to also color
    // the event/track text -- see .rcl-cal-row-special in css/league.css)
    // -- makes a special round visually distinct at a glance in the
    // schedule.
    var roundClass = 'rcl-cal-round' + (isSpecial ? ' rcl-cal-round-special' : '');
    row.appendChild(_rclEl('div', roundClass, _rclEscapeHtml(roundLabel)));

    var rowBody = _rclEl('div', 'rcl-cal-row-body');
    var topLine = _rclEl('div', 'rcl-cal-row-top');
    topLine.appendChild(_rclEl('div', 'rcl-cal-event', '<strong>' + _rclEscapeHtml(entry.eventName || 'Race') + '</strong>'));
    // COMPLETED, with a results phrase appended once there's something to
    // report (2026-09-21 rewrite, Matt's ask: "have the race faded out
    // with a COMPLETED notification, if it hasn't been finalized yet,
    // have it also say PRELIMINARY RESULTS POSTED and if it's finalized
    // OFFICIAL RESULTS POSTED" -- was "AWAITING RESULTS"/"UNOFFICIAL
    // RESULTS"/"OFFICIAL RESULTS" on their own, 2026-09-19). Same
    // resultsFinalized field Account.html's driver-facing Calendar
    // already reads this way (see its own "Completed"/"Preliminary
    // Results Posted"/"Official Results Posted" badges, raceCard()), now
    // public here too.
    var statusText, statusClass;
    if (idx === nextIdx) {
      statusText = 'UP NEXT'; statusClass = 'up';
    } else if (!entry.finished) {
      statusText = 'UPCOMING'; statusClass = 'upcoming';
    } else if (!entry.hasResults) {
      statusText = 'COMPLETED'; statusClass = 'complete';
    } else if (entry.resultsFinalized) {
      statusText = 'COMPLETED · OFFICIAL RESULTS POSTED'; statusClass = 'official';
    } else {
      statusText = 'COMPLETED · PRELIMINARY RESULTS POSTED'; statusClass = 'preliminary';
    }
    topLine.appendChild(_rclEl('div', 'rcl-cal-status rcl-cal-status-' + statusClass, statusText));
    rowBody.appendChild(topLine);

    rowBody.appendChild(_rclEl('div', 'rcl-cal-track',
      _rclEscapeHtml(entry.track || '(no track)') +
      (entry.layout ? ' <span class="rcl-cal-layout">-- ' + _rclEscapeHtml(entry.layout) + '</span>' : '')));

    var metaRow = _rclEl('div', 'rcl-cal-meta');
    // Time + length -- now the same gray outline pill as In-Game/Weather
    // below (2026-09-19, Matt's call: "make the date time and length pill
    // less prominent. It overshadows the rest of the race details by a
    // lot") -- was the one solid light-fill chip in this row, which read
    // much louder against the dark page than the plain track/event text
    // next to it. The `true` third arg is the same outline switch In-
    // Game/Weather already use (see _rclChip above).
    var timeTierParts = [];
    if (entry.startUtc) timeTierParts.push(_rclFormatDateTime(entry.startUtc));
    var lengthMin = _rclEntryLengthMinutes(entry, hub);
    if (lengthMin) timeTierParts.push(lengthMin + ' Min');
    if (timeTierParts.length) {
      metaRow.appendChild(_rclChip(_RCL_ICON_CLOCK, timeTierParts.join(' · '), true));
    }
    // In-game time: spelled out ("In-Game Event Time" -- was "In-Game",
    // 2026-09-21, Matt's follow-up ask), race time only -- practice/
    // qualify in-game times dropped from this line (2026-09-19, Matt's
    // ask: "spell out In-game and only put the race time for in-game").
    // Flag icon (2026-09-21, Matt's ask), not the gamepad glyph this
    // chip used before -- see _RCL_ICON_FLAG above. In-Game and Weather
    // are both gray outline pills, not solid (2026-09-19, Matt's call)
    // -- the `true` third arg to _rclChip.
    if (entry.igRaceStart) {
      metaRow.appendChild(_rclChip(_RCL_ICON_FLAG, 'In-Game Event Time ' + _rclFormat12h(entry.igRaceStart), true));
    }
    // Weather + chance of precipitation (2026-09-19, Matt's ask), same
    // "N% Rain" convention and 5-tier icon Account.html's own Calendar
    // page already uses for this (weatherIcon() + "N% Rain") -- only
    // shows once a weather value has actually been set for this entry.
    // Temperature appended after the rain chance (2026-09-21, Matt's ask:
    // "add temperature info after the rain chance on the calendar") --
    // same "N% Rain · N°C" convention Account.html's own Calendar already
    // uses (see its calStat(weatherIcon(...), ...) call), only shown when
    // Website.gs's getLeagueHub actually sent a temperature for this round.
    if (entry.weather) {
      var weatherText = (entry.chanceOfRain || 0) + '% Rain';
      if (entry.temperatureC !== null && entry.temperatureC !== undefined) {
        weatherText += ' · ' + entry.temperatureC + '°C';
      }
      metaRow.appendChild(_rclChip(_rclWeatherIcon(entry), weatherText, true));
    }
    rowBody.appendChild(metaRow);

    row.appendChild(rowBody);
    body.appendChild(row);
  });

  // "View Season Details" link (2026-09-19, Matt's call: season details
  // move out of the hero band into a popup opened from here instead --
  // see _rclOpenSeasonDetailsModal below). Closes over the local `hub`
  // param directly since this function already has it, same pattern as
  // the Leaderboard's "View Points Tables" link uses _rclHubForPoints for
  // (that one needs a stashed global since it's a different function).
  var detailsRow = _rclEl('div', 'rcl-cal-details-row');
  var detailsLink = _rclEl('button', 'rcl-cal-details-link', 'View Season Details');
  detailsLink.type = 'button';
  detailsLink.addEventListener('click', function () { _rclOpenSeasonDetailsModal(hub); });
  detailsRow.appendChild(detailsLink);
  body.appendChild(detailsRow);
}

// ---------------------------------------------------------------------
// POINTS -- race-length-tier point tables + bonus points (added
// 2026-09-19, moved into a popup off the Leaderboard panel same day --
// see _rclOpenPointsModal below). Straight passthrough of Seasons.
// SeasonDetails.pointsTables/bonusPoints (same shape the Season Creation
// Wizard writes and handleGetSeasonCalendar already hands a logged-in
// driver), just public here. Table order follows the tiers as they come
// back from the server object (Sprint/Medium/Long, the only tiers the
// wizard creates) rather than a hardcoded list, so a renamed or added
// tier still shows up without a frontend change.
// ---------------------------------------------------------------------
function _rclBuildPointsBody(hub, body) {
  var tables = (hub && hub.pointsTables) || {};
  var tierNames = Object.keys(tables);
  if (!hub || !hub.hasSeason || !tierNames.length) {
    body.appendChild(_rclEmptyState('No Data To Display', 'Points tables fill in once a season is underway.'));
    return;
  }

  tierNames.forEach(function (tierName) {
    var tier = tables[tierName] || {};
    var points = tier.points || [];
    if (!points.length) return;
    var wrap = _rclEl('div', 'rcl-points-tier');
    var head = _rclEl('div', 'rcl-points-tier-head');
    // Duration as a .rcl-chip-light pill with a clock icon (2026-09-19,
    // Matt's ask: "make the tier length and time more aesthetic") --
    // same shared chip the Calendar's own time+length pill uses. Merged
    // with the tier name into one two-halved pill (2026-09-21, Matt's
    // ask: "extend a border around the length tier coming off of the
    // time pill so it looks like one pill, half of it rounded bordered
    // and half of it the time in mins") via .rcl-points-tier-pill (css/
    // league.css) -- only when there's actually a duration to pair it
    // with; a tier with no duration falls back to the plain text label.
    if (tier.duration) {
      var tierPill = _rclEl('div', 'rcl-points-tier-pill');
      tierPill.appendChild(_rclEl('div', 'rcl-points-tier-pill-label', _rclEscapeHtml(tierName)));
      tierPill.appendChild(_rclChip(_RCL_ICON_CLOCK, tier.duration + ' Min'));
      head.appendChild(tierPill);
    } else {
      head.appendChild(_rclEl('div', 'rcl-points-tier-name', _rclEscapeHtml(tierName)));
    }
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
    // "Bonus Points" (shortened from "Bonus Points This Season",
    // 2026-09-19, Matt's ask). Same type style as a tier name above
    // (.rcl-points-tier-name) -- .rcl-points-bonus-label carries this
    // row's own layout (margin-bottom) -- see css/league.css.
    bonusRow.appendChild(_rclEl('div', 'rcl-points-bonus-label rcl-points-tier-name', 'Bonus Points'));
    // Each bonus category now renders as a .rcl-points-pos box, same
    // shape as a tier table's P1/P2/etc. boxes, inside its own
    // .rcl-points-table -- mirrors a tier block's head+table structure
    // exactly (2026-09-19, Matt's ask: "style it more closely to the
    // tier points tables so it looks like it's consistent").
    var bonusTable = _rclEl('div', 'rcl-points-table');
    bonusChips.forEach(function (key) {
      var chip = _rclEl('div', 'rcl-points-pos rcl-points-pos-wide');
      chip.appendChild(_rclEl('div', 'rcl-points-pos-num', _rclEscapeHtml(bonusLabels[key])));
      chip.appendChild(_rclEl('div', 'rcl-points-pos-val rcl-points-pos-val-accent', '+' + Number(bonus[key])));
      bonusTable.appendChild(chip);
    });
    bonusRow.appendChild(bonusTable);
    body.appendChild(bonusRow);
  } else if (tierNames.length) {
    body.appendChild(_rclEl('div', 'rcl-points-bonus-row',
      '<div class="rcl-points-bonus-chip">No bonus points are awarded this season.</div>'));
  }
}

// Opens the points tables in a popup, same .rcl-modal-overlay/dialog shell
// the story popup uses (styled to match a .rcl-panel exactly, 2026-09-19)
// -- reachable from the "View Points Tables" link at the bottom of the
// Leaderboard panel (_rclRenderStandings above).
function _rclOpenPointsModal(hub) {
  var overlay = _rclEl('div', 'rcl-modal-overlay');
  var dialog = _rclEl('div', 'rcl-modal-dialog');
  var head = _rclEl('div', 'rcl-modal-head');
  head.appendChild(_rclEl('div', 'rcl-modal-title', 'Points Tables'));
  var closeBtn = _rclEl('button', 'rcl-modal-close', '&times;');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  head.appendChild(closeBtn);
  dialog.appendChild(head);
  var body = _rclEl('div', 'rcl-modal-body');
  dialog.appendChild(body);
  overlay.appendChild(dialog);

  _rclBuildPointsBody(hub, body);

  // Same "closable only via the X button" posture as the news story
  // popup -- no backdrop click, no Escape key.
  function close() { document.body.removeChild(overlay); _rclUnlockBodyScroll(); }
  closeBtn.addEventListener('click', close);

  document.body.appendChild(overlay);
  _rclLockBodyScroll();
}

// Drivers section removed 2026-09-19 (Matt's call: "drivers can be seen
// by viewing the leaderboard") -- _rclRenderDrivers/#rcl-drivers-body
// removed; the roster it built was a plain, unranked duplicate of what
// the Leaderboard panel already shows per class.

// ---------------------------------------------------------------------
// NEWS FEED -- admin-authored, Body is plain text with a small set of
// hand-rolled formatting markers the New/Edit Post popup's toolbar
// inserts (Account.html): **bold**, *italic*, ++underline++, lines
// starting with "> " become a blockquote, and (2026-09-19 follow-up)
// [Link Text](mailto:someone@example.com) becomes a real mailto link.
// Escaped first, THEN those markers are turned into real tags -- the
// markers themselves (*, +, >, [, ], (, )) are never touched by HTML-
// escaping, so this order is safe: nothing a poster types can inject a
// real tag, only these five specific patterns ever turn into one. The
// mailto pattern only matches an actual mailto: URL (never an arbitrary
// href) -- Account.html's toolbar button is the only thing meant to
// produce this marker, and it always writes a mailto: prefix.
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
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Email link, added 2026-09-19 -- [Link Text](mailto:someone@x.com).
    // Run last, and its own capture groups are matched against the
    // ALREADY-escaped text, so this can't be tricked into matching across
    // an entity like &amp; the way an earlier, greedier pass might.
    .replace(/\[([^\]]+)\]\(mailto:([^)]+)\)/g, '<a class="rcl-news-link" href="mailto:$2">$1</a>');
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
    body.appendChild(_rclEmptyState('No News Yet', 'League news will show up here.'));
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
    _rclUnlockBodyScroll();
  }
  closeBtn.addEventListener('click', close);

  document.body.appendChild(overlay);
  _rclLockBodyScroll();
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
  // per-class list the Leaderboard section below already uses, so this
  // can never name a class that isn't actually fielding cars.
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
  // "Practice"/"Qualifying" (dropped "Length", 2026-09-19, Matt's ask) --
  // the value itself already reads as a duration ("30 min"), so the word
  // was redundant on the label.
  if (rs.practiceLengthMin) stats.push({ value: rs.practiceLengthMin + ' min', label: 'Practice' });
  if (rs.qualifyLengthMin) stats.push({ value: rs.qualifyLengthMin + ' min', label: 'Qualifying' });
  if (rs.setupRules) stats.push({ value: rs.setupRules, label: 'Setup Rules' });
  if (rs.pitStopReq) stats.push({ value: rs.pitStopReq, label: 'Pit Stop Rule' });
  if (rs.fuelMultiplier) stats.push({ value: rs.fuelMultiplier, label: 'Fuel Consumption' });
  if (rs.tireWearMultiplier) stats.push({ value: rs.tireWearMultiplier, label: 'Tire Wear' });
  if (rs.trackLimitPoints) stats.push({ value: String(rs.trackLimitPoints), label: 'Track Limit Pts' });
  return stats;
}

// _rclRenderStatsRow removed 2026-09-19 -- its two call sites both moved
// into _rclOpenSeasonDetailsModal below, which builds the stat tiles
// inline (into the popup's own body element) instead of a getElementById-
// targeted hero container.

function _rclRenderHero(hub) {
  // Eyebrow is static "Race Club" (set directly in league.html) --
  // nothing to fill in here anymore.
  // "Season N / Name" -- the "/" reads in the brand red, the season name
  // itself in bright white, "Season N" now reads gold (2026-09-19 follow-
  // up, Matt's ask -- was the line's base dim color before). Built as
  // real spans rather than one text string so each piece can carry its
  // own color.
  var seasonEl = document.getElementById('rcl-hero-season');
  if (seasonEl) {
    seasonEl.innerHTML = '';
    if (hub.hasSeason && hub.seasonNumber) {
      var numSpan = _rclEl('span', 'rcl-hero-season-num');
      numSpan.textContent = 'Season ' + hub.seasonNumber;
      seasonEl.appendChild(numSpan);
      if (hub.seasonName) {
        var sep = _rclEl('span', 'rcl-hero-season-sep');
        sep.textContent = ' / ';
        seasonEl.appendChild(sep);
        var nameSpan = _rclEl('span', 'rcl-hero-season-name');
        nameSpan.textContent = hub.seasonName;
        seasonEl.appendChild(nameSpan);
      }
    }
  }

  // Snapshot/format stat strips moved out of the hero band entirely
  // (2026-09-19, Matt's call: "Instead of the season details at the top
  // of the league hub, make it show up in a container themed popup when
  // VIEW SEASON DETAILS link at the bottom of the calendar is clicked")
  // -- see _rclOpenSeasonDetailsModal below, opened from
  // _rclRenderCalendar instead. rcl-hero-sub stays as the plain-text
  // "no season" fallback only.
  var subEl = document.getElementById('rcl-hero-sub');

  if (!hub.hasSeason) {
    if (subEl) { subEl.textContent = 'No season is currently underway. Check back once the next one opens.'; subEl.style.display = ''; }
    return;
  }

  if (subEl) subEl.style.display = 'none';
}

// Opens the season snapshot + league format stats (previously rendered
// straight into the hero band) in a popup instead, same .rcl-modal-*
// shell the news story and points tables popups use -- reachable from the
// "View Season Details" link at the bottom of the Calendar panel
// (_rclRenderCalendar above).
function _rclOpenSeasonDetailsModal(hub) {
  var overlay = _rclEl('div', 'rcl-modal-overlay');
  var dialog = _rclEl('div', 'rcl-modal-dialog');
  var head = _rclEl('div', 'rcl-modal-head');
  head.appendChild(_rclEl('div', 'rcl-modal-title', 'Season Details'));
  var closeBtn = _rclEl('button', 'rcl-modal-close', '&times;');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  head.appendChild(closeBtn);
  dialog.appendChild(head);

  var body = _rclEl('div', 'rcl-modal-body');

  var snapshotStats = _rclBuildSnapshotStats(hub);
  if (snapshotStats.length) {
    var snapshotGroup = _rclEl('div', 'rcl-hero-stats-group');
    snapshotGroup.appendChild(_rclEl('div', 'rcl-hero-stats-label', 'This Season'));
    var snapshotRow = _rclEl('div', 'rcl-hero-stats-row');
    snapshotStats.forEach(function (s) {
      var tile = _rclEl('div', 'rcl-hero-stat');
      tile.appendChild(_rclEl('div', 'rcl-hero-stat-value', _rclEscapeHtml(s.value)));
      tile.appendChild(_rclEl('div', 'rcl-hero-stat-label', _rclEscapeHtml(s.label)));
      snapshotRow.appendChild(tile);
    });
    snapshotGroup.appendChild(snapshotRow);
    body.appendChild(snapshotGroup);
  }

  var formatStats = _rclBuildFormatStats(hub);
  if (formatStats.length) {
    var formatGroup = _rclEl('div', 'rcl-hero-stats-group');
    formatGroup.appendChild(_rclEl('div', 'rcl-hero-stats-label', 'League Format'));
    var formatRow = _rclEl('div', 'rcl-hero-stats-row');
    formatStats.forEach(function (s) {
      var tile = _rclEl('div', 'rcl-hero-stat');
      tile.appendChild(_rclEl('div', 'rcl-hero-stat-value', _rclEscapeHtml(s.value)));
      tile.appendChild(_rclEl('div', 'rcl-hero-stat-label', _rclEscapeHtml(s.label)));
      formatRow.appendChild(tile);
    });
    formatGroup.appendChild(formatRow);
    body.appendChild(formatGroup);
  }

  if (!snapshotStats.length && !formatStats.length) {
    body.appendChild(_rclEmptyState('No Data To Display', 'Season details show up here once they are set.'));
  }

  dialog.appendChild(body);
  overlay.appendChild(dialog);

  function close() { document.body.removeChild(overlay); _rclUnlockBodyScroll(); }
  closeBtn.addEventListener('click', close);

  document.body.appendChild(overlay);
  _rclLockBodyScroll();
}

// Full-page loading overlay (2026-09-19, Matt's ask: "a loading animation
// in the center of the page... with the page behind very very dim until
// it loads and then displays the page") -- markup/CSS live in league.html
// and css/league.css; this just locks body scroll while it's up (same
// .rc-modal-scroll-locked pattern every popup on this page already uses)
// and fades + removes it once the initial fetch below resolves, success
// or failure either way, so a fetch error still reveals the page's own
// "No Data To Display" states instead of leaving the overlay up forever.
function _rclHidePageLoader() {
  var loader = document.getElementById('rcl-page-loader');
  if (!loader) return;
  loader.classList.add('rcl-page-loader-hidden');
  _rclUnlockBodyScroll();
  setTimeout(function () {
    if (loader.parentNode) loader.parentNode.removeChild(loader);
  }, 450); // matches the 0.4s CSS transition, plus a hair of slack
}

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('rcl-page-loader')) _rclLockBodyScroll();

  // _rclRenderPoints removed from this list (2026-09-19) -- points tables
  // are no longer rendered into the page directly; _rclRenderStandings
  // stashes the fetched hub (_rclHubForPoints) so the "View Points
  // Tables" link can build the popup on demand instead.
  var RENDERERS = [_rclRenderStandings, _rclRenderResults, _rclRenderCalendar, _rclRenderNews];
  fetchApi('getLeagueHub', {}).then(function (hub) {
    if (!hub || !hub.success) {
      _rclRenderTicker({ lastRace: null, standings: [] });
      RENDERERS.forEach(function (fn) { fn({ hasSeason: false }); });
      _rclRenderHero({ hasSeason: false });
      _rclHidePageLoader();
      return;
    }
    _rclRenderHero(hub);
    _rclRenderTicker(hub);
    RENDERERS.forEach(function (fn) { fn(hub); });
    _rclHidePageLoader();
  }).catch(function () {
    _rclRenderTicker({ lastRace: null, standings: [] });
    RENDERERS.forEach(function (fn) { fn({ hasSeason: false }); });
    _rclRenderHero({ hasSeason: false });
    _rclHidePageLoader();
  });
});
