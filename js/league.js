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

// Standard "starting grid lights" loading state (2026-09-24) -- same
// .rc-inline-spinner-wrap > .rc-startlights (5x .rc-startlight) +
// .rc-loading-text markup as the full-page loader (league.html's
// #rcl-page-loader) and the Edit Profile popup's loading state
// (rcOpenEditProfileModalInPlace, edit-profile.js), factored out here so
// any other in-modal loading state on this page can reuse it instead of
// rebuilding the same five nodes by hand.
function _rclBuildInlineSpinner_(message) {
  var wrap = _rclEl('div', 'rc-inline-spinner-wrap');
  var lightsRow = _rclEl('div', 'rc-startlights');
  for (var i = 0; i < 5; i++) lightsRow.appendChild(_rclEl('span', 'rc-startlight'));
  wrap.appendChild(lightsRow);
  wrap.appendChild(_rclEl('div', 'rc-loading-text', message));
  return wrap;
}

function _rclEscapeHtml(str) {
  var d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

// Class pill (2026-09-24) -- same rounded-rectangle, white-on-color chip
// every other class badge on the site uses (.rc-badge-chip + its color
// class, style.css, which league.html already loads alongside
// css/league.css -- see the file header comment above), just built by
// hand here since Account.html's shared _rcClassAbbrevPill helper isn't
// in scope on this page. Label matches _rcClassPillLabel's convention
// (Account.html): Hypercar -> "HY", every other class name shown as-is
// (LMGT3/LMGTE/LMP2/LMP3 are all already short enough to read fine in a
// pill) -- Matt's own list for this ask was exactly those five labels.
var RCL_CLASS_PILL_COLOR_ = { LMGTE: 'rc-badge-lmgte', LMGT3: 'rc-badge-lmgt3', LMP3: 'rc-badge-lmp3', LMP2: 'rc-badge-lmp2', Hypercar: 'rc-badge-hypercar' };
// Wrapped in a fixed-width, right-aligned column (.rcl-report-pill-col,
// 2026-09-26 rework, twice the same day -- see that class's own comment,
// css/league.css, for the full history) so every pill keeps the exact
// same padding around its own text (a 2-letter "HY" pill and a 5-letter
// "LMGT3"/"LMGTE" pill are each their own natural width, via
// .rc-badge-chip-abbrev's fixed 2px 6px padding, style.css) while still
// lining up against one shared right edge column to column, using
// flexbox's justify-content:flex-end (not text-align on a plain
// inline-block, which turned out not to reliably right-justify an
// overflowing pill -- Matt's catch: "LMGT3 pills... are now centered in a
// column... the LMGT3 pill overlaps the timestamp since it's wider than
// the HY pill").
function _rclClassPill_(cls) {
  var key = String(cls || '').trim();
  var colorClass = RCL_CLASS_PILL_COLOR_[key] || '';
  var label = key === 'Hypercar' ? 'HY' : key;
  var col = document.createElement('span');
  col.className = 'rcl-report-pill-col';
  var pill = document.createElement('span');
  pill.className = 'rc-badge-chip rc-badge-chip-abbrev' + (colorClass ? ' ' + colorClass : '');
  pill.textContent = label || '?';
  col.appendChild(pill);
  return col;
}

// _rclTickerClassPill_ removed (2026-09-30, Matt's ask: "remove class pills
// from highlights ticker") -- it built the small per-driver class pill
// buildDriverEntry used to append after each car number; that call site is
// gone (see buildDriverEntry's own comment further below), and each class
// group's "TOP TEN CLASS RESULTS:" tag now carries that information
// instead. .rcl-ticker-class-pill (css/league.css) is left in place in case
// a future ticker item wants a small inline pill again, but nothing
// currently references it.

// mm:ss (or h:mm:ss past the hour mark) for a race report event's
// elapsed-time stamp (2026-09-24, Matt's ask) -- races run anywhere from
// a sprint to several hours, so the hour digit only shows once it's
// actually needed rather than padding every timestamp with a leading
// "0:".
function _rclFormatEventTime_(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '';
  var total = Math.max(0, Math.floor(seconds));
  var h = Math.floor(total / 3600);
  var m = Math.floor((total % 3600) / 60);
  var s = total % 60;
  var ss = s < 10 ? '0' + s : String(s);
  if (h > 0) return h + ':' + (m < 10 ? '0' + m : String(m)) + ':' + ss;
  return m + ':' + ss;
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
// Live-ticking countdown timers the race carousel starts (one per
// not-yet-happened entry's hero, see _rclBuildCountdown_/
// _rclRenderRaceCarousel below) -- tracked at module scope so a hub
// refresh re-render can clear every interval from the PREVIOUS render
// before building new ones, rather than leaking one setInterval per
// refresh forever.
var _rclCarouselCountdownTimers_ = [];

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

// Same as _rclFormatDateTime above but with the month spelled out in full
// (2026-10-03, race carousel redesign, Matt's exact example: "SEPTEMBER
// 28, 2026, 8:00 PM EDT" -- carousel-only, every other date on this page
// keeps the abbreviated "Sep 28" form _rclFormatDateTime already gives).
function _rclFormatDateTimeLong_(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}

// Morning/Afternoon/Evening/Night label from a race's own local start hour
// (2026-10-03, race carousel redesign, Matt's exact example: "EVENING
// RACE..."). Browser-local hour, same "no per-viewer timezone on this
// public page" posture every other date/time helper here already has.
function _rclTimeOfDayLabel_(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  var h = d.getHours();
  if (h >= 5 && h < 12) return 'Morning';
  if (h >= 12 && h < 17) return 'Afternoon';
  if (h >= 17 && h < 21) return 'Evening';
  return 'Night';
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

// IANA zone name (e.g. "America/New_York", what the admin actually picks
// in the Season Creation Wizard and what hub.enteredTimeZone carries) ->
// its short abbreviation for right now (EST/EDT/etc -- 2026-10-01, Matt's
// ask: "Instead of writing the literal timezone location, use EST, EDT,
// etc labels behind event time"). Uses today's date rather than the
// season's own start date since this is just a display label, not a
// precise instant -- a zone's abbreviation only ever flips between its
// standard/daylight forms, and getting that exactly right for a date
// months in the future isn't worth the added complexity here. Falls back
// to the raw zone string on any failure (an unrecognized/empty zone, or a
// browser without full Intl timezone support) so this never throws.
function _rclTzAbbrev_(tz) {
  if (!tz) return '';
  try {
    var parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date());
    var part = parts.filter(function (p) { return p.type === 'timeZoneName'; })[0];
    return part ? part.value : tz;
  } catch (e) {
    return tz;
  }
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
// Ordinal suffix helper (2026-09-23, Matt's ask: "1st, 2nd, 3rd, 4th and
// 5th before the names in bold white" on the ticker's TOP 5 rows). n is
// always 1-5 here, but written generically.
function _rclOrdinal_(n) {
  var suffixes = ['th', 'st', 'nd', 'rd'];
  var v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

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
    // Split into nameText/datesText (2026-09-23, Matt's ask: "make the
    // season dates a reduced weight compared to the season name") rather
    // than one joined string -- lets buildRun() below give the dates
    // span its own lighter weight (.rcl-ticker-season-dates,
    // css/league.css) while the season number/name stays at the item's
    // normal weight. See the driverRows items just below for the same
    // "structured data in, differently-weighted spans out" pattern.
    // Season number moved INTO the gold tag itself (2026-09-27, Matt's
    // ask) -- was a plain "SEASON" tag followed by "Season N: <name>" in
    // the item's own text, which read as "SEASON: Season N: <name>" once
    // buildRun() appended the tag's trailing colon (a genuine redundancy,
    // not what Matt wanted). Tag is now "SEASON N" (colon still appended
    // by buildRun, same as every other item), and nameText is just the
    // season name on its own -- dates keep their existing lighter-weight
    // styling untouched.
    items.push({
      tag: 'SEASON ' + _rclEscapeHtml(String(hub.seasonNumber)),
      nameText: hub.seasonName ? _rclEscapeHtml(hub.seasonName) : '',
      datesText: seasonDates ? ' (' + _rclEscapeHtml(seasonDates) + ')' : ''
    });
  }

  // Next race -- same "first non-bye, unfinished" pick the Calendar
  // section's own "UP NEXT" pill uses (see _rclRenderCalendar above).
  // Built here but NOT pushed yet (2026-09-26, Matt's ask: "move the NEXT
  // RACE part of the ticker until after all the results sections") --
  // pushed at the very end of this function instead, after every
  // class-results/roster item below, so it always reads last no matter
  // which of the two results branches (pre-season roster vs in-season top
  // 5) actually ran.
  var nextRaceItem = null;
  var nextEntry = null;
  (hub.calendar || []).forEach(function (entry) {
    if (!nextEntry && entry.kind !== 'bye' && !entry.finished) nextEntry = entry;
  });
  if (nextEntry) {
    // Same prefixBoldText/prefixDimText/prefixDatesText shape as the
    // ROUND n results item below (2026-09-26, Matt's ask: "make the NEXT
    // RACE event the same exact style/weight/format as the ROUND N race
    // in the highlight") -- bold event name, normal-weight " at
    // track: layout", gray " (date)", same field names and the same
    // ': ' (space after the colon) join between track and layout
    // ROUND n's own raceTrackLayout below uses.
    // Exact spacing spelled out literally (2026-09-27, Matt's ask, giving
    // "(space)" markers for every single-space gap): "<event title>
    // (space)at(space)<track>:(space)<track layout>(space)(<date>)" --
    // one space before/after "at", one space after the track's colon
    // (not before it), one space before the parenthesized date. That's
    // exactly what prefixBoldText + " at " + track + ": " + layout +
    // " (" + date + ")" produces below and in the ROUND n item.
    var nextTrackLayout = nextEntry.track ? (nextEntry.track + (nextEntry.layout ? (': ' + nextEntry.layout) : '')) : '';
    nextRaceItem = {
      tag: 'NEXT RACE',
      prefixBoldText: nextEntry.eventName || 'Race',
      prefixDimText: nextTrackLayout ? (' at ' + nextTrackLayout) : '',
      prefixDatesText: nextEntry.startUtc ? (' (' + _rclFormatDate(nextEntry.startUtc) + ')') : ''
    };
  }

  // Driver rows (both branches below) are kept as STRUCTURED data --
  // {name, carNumber, manufacturer} -- rather than one pre-joined string
  // (2026-09-23 rewrite, Matt's ask: "add the manufacturer logo in front
  // of each driver name, take some weight off the driver name and keep
  // the number weight the same"). _rclRenderTicker's buildRun() is what
  // actually turns each row into a logo image + differently-weighted
  // name/number spans -- see driverRows there. Escaping is left to that
  // render step (real text nodes, not innerHTML), not done here.
  if (!hasResults) {
    var classLists = _rclSortByTickerClassOrder_(hub.standings || [], function (cls) { return cls.className; });
    classLists.forEach(function (cls) {
      var standings = cls.standings || [];
      if (!standings.length) return;
      var rows = standings.filter(function (row) { return row.name; }).map(function (row) {
        // carClass (2026-09-27, Matt's ask: "add class pills behind driver
        // names in the ticker when there aren't any seasons active") --
        // same field the in-season TOP 10 branch below already sets, just
        // added here too so buildDriverEntry's existing "if (row.carClass)"
        // pill render (see its own comment there) picks it up on the
        // pre-season roster list as well. Every row in one cls group is the
        // same class, so this is just cls.className repeated per row.
        // country (2026-09-30, Matt's ask: "add flags to all driver names
        // in ticker") -- same field buildDriverEntry now reads to render a
        // nationality flag between the name and car number.
        return { name: row.name, carNumber: row.carNumber, manufacturer: row.manufacturer, carClass: cls.className, country: row.country };
      });
      if (!rows.length) return;
      items.push({ tag: (cls.className || 'CLASS').toUpperCase() + ' DRIVERS', driverRows: rows });
    });
    if (nextRaceItem) items.push(nextRaceItem);
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
    // Format changed 2026-09-26 (Matt's ask, second pass) -- ONE combined
    // ticker item now covers the whole round's results, instead of a
    // separate item per class each re-stating "Round n EventName at
    // Track:Layout (date)" (that was itself only a few messages old, see
    // the 2026-09-26/first-pass history this replaces). "Round n" moved
    // out of the prefix text entirely and into the item's own gold TAG
    // slot (same tag slot SEASON/NEXT RACE/etc. all use, .rcl-ticker-
    // item-tag) -- Matt's ask: "have it say 'ROUND n:' instead of
    // '<class> TOP 5:'". The event title itself no longer repeats "Round
    // n" in front of it (prefixBoldText is just the event name now).
    // Track name and layout still share one normal-weight span
    // (prefixDimText), and the raced-on date still closes it out in the
    // ticker's gray date style (prefixDatesText) -- both unchanged from
    // the first pass. Every class's own top 10 (was top 5) runs in
    // Hypercar-to-LMGTE order as one classGroups array -- see buildRun's
    // item.classGroups branch below -- separated from the next class by
    // a wider 15-space gap instead of a whole new tag+prefix repeating
    // (Matt: "instead of relabeling the next class"). EACH group carries
    // its own gold "TOP TEN RESULTS:" tag (2026-09-26 follow-up, Matt's
    // ask: "Add a TOP TEN RESULTS: label in front of all classes that
    // have results being scored") -- not one shared tag before the whole
    // combined list like the first pass had.
    var raceTag = lastRace.roundNum ? ('ROUND ' + lastRace.roundNum) : 'ROUND RESULTS';
    var raceLabelBold = lastRace.eventName || 'Race';
    var raceTrackLayout = lastRace.track ? (lastRace.track + (lastRace.layout ? (': ' + lastRace.layout) : '')) : '';
    var raceLabelDim = raceTrackLayout ? (' at ' + raceTrackLayout) : '';
    var raceLabelDates = lastRace.startUtc ? (' (' + _rclFormatDate(lastRace.startUtc) + ')') : '';
    var resultClasses = _rclSortByTickerClassOrder_(lastRace.classes || [], function (cls) { return cls.className; });
    var classGroups = [];
    resultClasses.forEach(function (cls) {
      // TOP 10, was TOP 5 (2026-09-26, Matt's ask: "make it a top 10 list
      // instead of a top 5 list").
      var standings = (cls.standings || []).slice(0, 10);
      if (!standings.length) return;
      var rows = standings.filter(function (row) { return row.name; }).map(function (row) {
        // carClass (2026-09-26, Matt's ask: "behind every number on every
        // driver will be the class pill they belong to") -- every row in
        // this one group is the same class, so this is just cls.className
        // repeated per row for buildDriverEntry to key its pill color off
        // of, not something read off the row's own raw data.
        // country (2026-09-30, Matt's ask: "add flags to all driver names
        // in ticker") -- same field buildDriverEntry now reads to render a
        // nationality flag between the name and car number.
        return { name: row.name, carNumber: row.carNumber, manufacturer: row.manufacturer, carClass: cls.className, country: row.country };
      });
      if (!rows.length) return;
      // Tag now names the class itself -- "TOP TEN <CLASS> RESULTS"
      // (2026-09-30 follow-up, Matt's ask: "It should say TOP TEN <CLASS>
      // RESULTS: so that each class is represented in the ticker") --
      // was the generic "TOP TEN CLASS RESULTS" for every group, which
      // read identically no matter which class it was; same
      // cls.className.toUpperCase() the pre-season roster's own
      // "<CLASS> DRIVERS" tag already uses above, so Hypercar/LMP2/LMP3/
      // LMGT3/LMGTE all read out in full, not abbreviated.
      classGroups.push({ driverRows: rows, tag: 'TOP TEN ' + (cls.className || 'CLASS').toUpperCase() + ' RESULTS' });
    });
    // showRank (2026-09-23, Matt's ask: "use 1st, 2nd, 3rd, 4th and 5th
    // place before drivers in the ticker") -- ranked TOP 10 rows only;
    // the pre-results roster list above has no finishing order to show,
    // so it's left without a rank prefix.
    if (classGroups.length) {
      items.push({
        tag: raceTag,
        prefixBoldText: raceLabelBold, prefixDimText: raceLabelDim, prefixDatesText: raceLabelDates,
        classGroups: classGroups, showRank: true
      });
    }
  }

  // NEXT RACE, last (2026-09-26, Matt's ask -- see this item's own build
  // comment above).
  if (nextRaceItem) items.push(nextRaceItem);

  return items;
}

function _rclRenderTicker(hub) {
  var track = document.getElementById('rcl-ticker-track');
  if (!track) return;
  var items = _rclBuildTickerItems(hub);

  if (!items.length) {
    track.innerHTML = '';
    track.style.animation = 'none';
    track.appendChild(_rclEl('div', 'rcl-ticker-empty', 'Highlights fill in once a season is underway.'));
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
  // Renders one driver's {name, carNumber, manufacturer} as a small inline
  // group -- manufacturer logo (2026-09-23, Matt's ask: "add the
  // manufacturer logo in front of each driver name" -- a driver-heavy
  // ticker line read as "a wall of text" without one) + the name itself
  // (lighter weight now, see .rcl-ticker-driver-name in css/league.css)
  // + the car number (kept at the SAME weight the whole line used to be,
  // per Matt's explicit "keep the number weight the same as it is" --
  // it's what a viewer actually scans the ticker for, so it stays the
  // loudest part of each entry now that the name around it is quieter).
  // Same onerror-hide convention as every other manufacturer logo on the
  // site (e.g. _rclBuildStandingsColumns_ above) for a car whose logo
  // asset hasn't been uploaded yet.
  function buildDriverEntry(row) {
    var entry = _rclEl('span', 'rcl-ticker-driver-entry');
    if (row.manufacturer && typeof manufacturerLogoSrc === 'function') {
      var logo = document.createElement('img');
      logo.className = 'rcl-ticker-driver-logo';
      logo.src = manufacturerLogoSrc(row.manufacturer);
      logo.alt = '';
      manufacturerLogoFallback(logo, row.manufacturer, function () { logo.style.display = 'none'; });
      entry.appendChild(logo);
    }
    var nameSpan = _rclEl('span', 'rcl-ticker-driver-name');
    nameSpan.textContent = row.name;
    entry.appendChild(nameSpan);
    // Nationality flag, between the name and car number (2026-09-30, Matt's
    // ask: "add flags to all driver names in ticker- between name and
    // number") -- same countryFlagSrc lookup + .rcl-standings-flag styling
    // (16x12, rounded corners, thin border) the Leaderboard/Recent Results/
    // View All Results identity block already uses for its own flag
    // (_rclBuildDriverIdentity_ above); onerror-hide follows that same
    // convention for a country with no flag asset uploaded yet.
    if (row.country && typeof countryFlagSrc === 'function') {
      var flagSrc = countryFlagSrc(row.country);
      if (flagSrc) {
        var flagImg = document.createElement('img');
        flagImg.className = 'rcl-standings-flag';
        flagImg.src = flagSrc;
        flagImg.alt = '';
        flagImg.title = row.country;
        flagImg.onerror = function () { flagImg.style.display = 'none'; };
        entry.appendChild(flagImg);
      }
    }
    if (row.carNumber) {
      var numSpan = _rclEl('span', 'rcl-ticker-driver-num');
      numSpan.textContent = ' #' + row.carNumber;
      entry.appendChild(numSpan);
    }
    // Class pill removed (2026-09-30, Matt's ask: "remove class pills from
    // highlights ticker") -- each class's own "TOP TEN CLASS RESULTS:" tag
    // (see the classGroups.tag change in _rclBuildTickerItems below) now
    // carries that information instead, so a pill on every single driver
    // row was redundant. row.carClass is still set on each row (used only
    // by this removed pill previously) but is otherwise harmless to leave
    // in place.
    return entry;
  }

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
      // Shared prefix rendering (2026-09-26 follow-up, Matt's ask: "make
      // the NEXT RACE event the same exact style/weight/format as the
      // ROUND N race in the highlight") -- bold event name + normal-
      // weight "at track:layout" + gray raced-on date, applies to ANY
      // item carrying these fields, not just ones with a driver list
      // below (NEXT RACE has none) -- both items now share this one code
      // path instead of NEXT RACE using its own separate plain-text
      // branch. The pre-results roster item still uses the older plain
      // prefixText (no bold/track split -- there's no race/track to name
      // yet).
      if (item.prefixBoldText !== undefined) {
        if (item.prefixNormalText) el.appendChild(document.createTextNode(item.prefixNormalText));
        el.appendChild(_rclEl('span', 'rcl-ticker-prefix-bold', item.prefixBoldText));
        if (item.prefixDimText) el.appendChild(_rclEl('span', 'rcl-ticker-prefix-dim', item.prefixDimText));
        if (item.prefixDatesText) el.appendChild(_rclEl('span', 'rcl-ticker-season-dates', item.prefixDatesText));
        // 5-space gap before the driver list starts (Matt's ask: "insert
        // 5 spaces before beginning the top [5]") -- only when there's a
        // driver list following; NEXT RACE has nothing after its prefix.
        if (item.driverRows || item.classGroups) el.appendChild(document.createTextNode('     '));
      } else if (item.prefixText) {
        el.appendChild(document.createTextNode(item.prefixText));
      }
      if (item.driverRows || item.classGroups) {
        // Driver-list items (2026-09-23 rewrite, extended 2026-09-26 for
        // classGroups) -- structured rows instead of one joined string,
        // so each name gets its own logo + differently-weighted spans
        // (see buildDriverEntry above) rather than reading as a flat wall
        // of text. Separator between entries within one class is 10
        // non-breaking spaces (2026-09-24, was 7 -- Matt's ask for "3
        // more spaces in between all drivers"; before that, 5, see the
        // 2026-09-23 history above), not a comma (2026-09-23 follow-up,
        // Matt's ask). Plain U+0020 spaces collapse to one in HTML, so
        // this uses   (non-breaking space) throughout to actually render
        // as real gaps instead of silently collapsing.
        var list = _rclEl('span', 'rcl-ticker-driver-list');
        function appendRankedRow(targetList, row, idxInClass) {
          // Bold white rank prefix (2026-09-23, Matt's ask: "Please
          // put 1st, 2nd, 3rd, 4th and 5th before the names in bold
          // white") -- ranked rows only (item.showRank), see
          // _rclBuildTickerItems; the pre-results roster has no
          // finishing order so it never sets showRank. Rank resets per
          // class group (idxInClass), not across the whole combined
          // list, since each class's top 10 is its own standalone
          // ranking. Takes an explicit targetList (2026-09-26 follow-up)
          // since rows now land either in the shared list or in a
          // per-class group's own rowsWrap (see classGroups branch
          // below).
          if (item.showRank) {
            // 2 spaces between the rank and the manufacturer logo
            // (2026-09-23, Matt's ask), not just the 1 the trailing space
            // in the rank text used to give it.
            targetList.appendChild(_rclEl('span', 'rcl-ticker-driver-rank', _rclOrdinal_(idxInClass + 1)));
            targetList.appendChild(document.createTextNode('  '));
          }
          targetList.appendChild(buildDriverEntry(row));
        }
        if (item.classGroups) {
          // Combined round-results item (2026-09-26 rewrite, extended
          // 2026-09-26 follow-up, Matt's ask: "Add a TOP TEN RESULTS:
          // label in front of all classes that have results being
          // scored") -- every class's top 10 runs one after another in
          // this ONE item, separated from the next class by a wider 15
          // non-breaking-space gap (Matt: "instead of relabeling the
          // next class"). Each group now carries its OWN gold
          // "TOP TEN RESULTS:" tag (group.tag) instead of one shared
          // tag before the whole combined list, wrapped together with
          // its rows in a small flex span (.rcl-ticker-class-section)
          // that uses the same 8px gap as .rcl-ticker-item's own
          // tag-to-content spacing (Matt: "make the space between this
          // label and the drivers the same as every other category")
          // instead of a manual nbsp count.
          item.classGroups.forEach(function (group, gIdx) {
            if (gIdx > 0) list.appendChild(document.createTextNode('               '));
            if (group.tag) {
              var section = _rclEl('span', 'rcl-ticker-class-section');
              section.appendChild(_rclEl('span', 'rcl-ticker-item-tag', group.tag + ':'));
              var rowsWrap = _rclEl('span', 'rcl-ticker-driver-list');
              group.driverRows.forEach(function (row, idx) {
                if (idx > 0) rowsWrap.appendChild(document.createTextNode('          '));
                appendRankedRow(rowsWrap, row, idx);
              });
              section.appendChild(rowsWrap);
              list.appendChild(section);
            } else {
              group.driverRows.forEach(function (row, idx) {
                if (idx > 0) list.appendChild(document.createTextNode('          '));
                appendRankedRow(list, row, idx);
              });
            }
          });
        } else {
          item.driverRows.forEach(function (row, idx) {
            if (idx > 0) list.appendChild(document.createTextNode('          '));
            appendRankedRow(list, row, idx);
          });
        }
        el.appendChild(list);
      } else if (item.nameText !== undefined) {
        // SEASON item (2026-09-23) -- name at the line's normal weight,
        // dates in their own lighter span right after it.
        el.appendChild(document.createTextNode(item.nameText));
        if (item.datesText) {
          el.appendChild(_rclEl('span', 'rcl-ticker-season-dates', item.datesText));
        }
      } else if (item.prefixBoldText === undefined && item.text !== undefined) {
        // Any remaining plain text + optional date item -- same
        // gray/lighter treatment as SEASON's own date span (2026-09-23,
        // Matt's ask: "any date that's listed in the ticker should be
        // gray like the season duration date is"). Guarded against
        // prefixBoldText items (like NEXT RACE) which already rendered
        // everything they need above and have no separate item.text.
        el.appendChild(document.createTextNode(item.text));
        if (item.datesText) {
          el.appendChild(_rclEl('span', 'rcl-ticker-season-dates', item.datesText));
        }
      }
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
    var PX_PER_SEC = 64; // 2026-09-26, Matt's ask: "slow the ticker down ever so slightly" (was 70)
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
// Builds the whole "one column per class" grid for the ranked Standings
// panel (hasResults true, real points) -- 2026-09-21 refactor, originally
// shared with the "View All Drivers" popup's plain roster (hasResults
// false), which was removed 2026-10-01 (Matt's call: redundant with the
// ticker/this panel). The hasResults-false path (empty position slot, no
// points column) is unused now but left in place rather than stripped,
// in case a future roster view wants it again -- see the per-arg comments
// below for why each piece looks the way it does.
// Shared row-building pieces (2026-09-23 refactor, Matt's ask: "Make the
// weight and color of all the drivers in RECENT RESULTS the same as
// color and weight as the CURRENT STANDINGS list" / "make the driver
// styling and format in the [View All Results] list look identical to
// the CURRENT STANDINGS list") -- pulled out of the loop below so Recent
// Results and the View All Results popup can build IDENTICAL identity
// blocks and position badges instead of a second, drifting copy of this
// markup (see _rclRenderResults/_rclBuildAllResultsBody_ further down).
var RCL_POS_METAL_CLASS_ = ['rcl-standings-row-p1', 'rcl-standings-row-p2', 'rcl-standings-row-p3'];

// idx is 0-based finish position (0 = P1/gold, 1 = P2/silver, 2 = P3/
// bronze, everything else the default graphite). textOverride lets a
// caller show "DSQ" instead of a number (Recent Results/View All Results
// only -- Current Standings' season totals have no per-row DSQ concept).
function _rclBuildPosBadge_(idx, textOverride) {
  var metalClass = (idx !== null && idx !== undefined && RCL_POS_METAL_CLASS_[idx]) ? ' ' + RCL_POS_METAL_CLASS_[idx] : '';
  var text = textOverride !== undefined ? textOverride : String((idx !== null && idx !== undefined) ? (idx + 1) : '');
  return _rclEl('div', 'rcl-standings-pos' + metalClass, text);
}

// DNF detection (2026-09-23, Matt's ask: "Make sure DNFs are displayed on
// leaderboard in bold letters") -- a DSQ'd driver (row.disqualified,
// already tracked), a suspended driver's synthetic row (row.suspended,
// 2026-10-01 -- All Results popup only, see _rclBuildPosBadge_ call site),
// or a raw FinishStatus containing "DNF" (mechanical failure, crash, etc.
// -- not disqualified, just didn't finish) all count. Only meaningful on a
// round-result row (Recent Results/View All Results); a Current Standings
// season-total row has neither field, so this always returns false there.
function _rclIsDnf_(row) {
  return !!(row && (row.disqualified || row.suspended || /dnf/i.test(row.finishStatus || '')));
}

// logo, name, country flag, car number, team -- one identical identity
// block wherever a driver row appears on this page. No longer takes a
// `dnf` flag (2026-09-24, Matt's ask to drop the bold DNF/DSQ name
// treatment) -- see _rclIsDnf_/the position badge for how DNF/DSQ still
// shows on a row.
// dnf (2026-09-26, Matt's ask: "any DNF drivers in the list should have a
// light gray name and number style") -- optional, only Recent Results/
// View All Results pass it (Current Standings' season-total rows have no
// per-row DNF concept, same as _rclIsDnf_ above already notes).
function _rclBuildDriverIdentity_(row, dnf) {
  var identity = _rclEl('div', 'rcl-standings-identity' + (dnf ? ' rcl-standings-identity-dnf' : ''));
  var logoSlot = _rclEl('div', 'rcl-standings-mfr-logo-slot');
  if (row.manufacturer && typeof manufacturerLogoSrc === 'function') {
    var logoImg = document.createElement('img');
    logoImg.className = 'rcl-standings-mfr-logo';
    logoImg.src = manufacturerLogoSrc(row.manufacturer);
    logoImg.alt = '';
    manufacturerLogoFallback(logoImg, row.manufacturer, function () { logoSlot.style.display = 'none'; });
    logoSlot.appendChild(logoImg);
  } else {
    logoSlot.style.display = 'none';
  }
  identity.appendChild(logoSlot);

  var nameRow = _rclEl('div', 'rcl-standings-name-row');
  // No extra-bold DNF/DSQ name any more (2026-09-24, Matt's ask: "do not
  // BOLD the name of anyone who DNF's, leave it the same weight as all
  // the rest in the list") -- the position badge already shows DNF/DSQ
  // in the finish-position slot (_rclBuildPosBadge_), so the name itself
  // no longer needs its own bold treatment to flag it.
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
  return identity;
}

function _rclBuildStandingsColumns_(standings, hasResults) {
  // One column per class (2026-09-19, Matt's call) -- .rcl-standings-
  // columns is the grid wrapper (css/league.css), auto-fitting however
  // many classes the season actually has.
  var columns = _rclEl('div', 'rcl-standings-columns');
  standings.forEach(function (cls) {
    var wrap = _rclEl('div', 'rcl-standings-class');
    // Graphite header bar (2026-09-23, Matt's ask: "instead of it just
    // having the class name off to the top left of the columns, add an
    // additional row with a graphite background that has <CLASS>
    // LEADERBOARD centered above each column"). Always "<CLASS> DRIVERS"
    // now (2026-10-02, Matt's ask: "Make the CHAMPIONSHIP STANDINGS table
    // headers say <CLASS> DRIVERS instead of <CLASS> LEADERBOARD" --
    // this function's only live caller is Championship Standings, which
    // always passes hasResults:true, so this used to always read
    // "LEADERBOARD" in practice; the hasResults param still gates the
    // Pos/Driver/Pts column labels just below, unchanged).
    var headerText = (cls.className || 'CLASS').toUpperCase() + ' DRIVERS';
    wrap.appendChild(_rclEl('div', 'rcl-standings-class-header', headerText));
    var clsStandings = cls.standings || [];
    if (!clsStandings.length) {
      wrap.appendChild(_rclEl('div', 'rcl-empty-state-subtitle', 'No drivers registered in this class yet.'));
    } else {
      // Column labels, same exact style as Recent Results/View All Results
      // (2026-09-23, Matt's ask: "Make a catagory labels in the same
      // exact style for the CURRENT LEADERBOARD") -- only when hasResults
      // is true (the Drivers roster popup has no ranking/points to label).
      // Same 40px/1fr/auto grid .rcl-standings-row already uses.
      if (hasResults) {
        var standingsHeadRow = _rclEl('div', 'rcl-race-col-head rcl-race-grid-3');
        standingsHeadRow.appendChild(_rclEl('div', null, 'Pos'));
        standingsHeadRow.appendChild(_rclEl('div', null, 'Driver'));
        standingsHeadRow.appendChild(_rclEl('div', null, 'Pts'));
        wrap.appendChild(standingsHeadRow);
      }
      // Metal-color modifier by finish position (2026-09-19, Matt's call:
      // "Make 1st gold, 2nd silver, and 3rd bronze and the rest can be a
      // titanium metal color") -- replaces the old red "lead" tint, since
      // gold/silver/bronze already reads as rank on its own. Now shared
      // module-level constant (RCL_POS_METAL_CLASS_, 2026-09-23) so Recent
      // Results/View All Results use the exact same metal thresholds.
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
        // Position badge + identity block now built by the shared helpers
        // (_rclBuildPosBadge_/_rclBuildDriverIdentity_, 2026-09-23) so
        // Recent Results and View All Results render identically to this,
        // the original source of this markup. Current Standings' season
        // totals have no per-row DNF concept, so dnf is always false here.
        var rowEl = _rclEl('div', 'rcl-standings-row' + (hasResults && RCL_POS_METAL_CLASS_[idx] ? ' ' + RCL_POS_METAL_CLASS_[idx] : '') + (!hasResults ? ' rcl-standings-row-simple' : ''));
        if (hasResults) {
          rowEl.appendChild(_rclBuildPosBadge_(idx));
        }
        rowEl.appendChild(_rclBuildDriverIdentity_(row));

        if (hasResults) {
          // Points total only, no "-N PTS" gap-to-leader line underneath
          // (2026-09-23, Matt's ask: "I'd rather the total points ONLY be
          // posted on the current standings... this will allow the rows
          // to be the same height as P1") -- P1 never had a gap line (idx
          // === 0 skipped it), so every other row's extra line was what
          // made them taller than P1's row. Dropping it entirely makes
          // every row in the grid the same height.
          var ptsCol = _rclEl('div', 'rcl-standings-pts');
          ptsCol.appendChild(_rclEl('div', 'rcl-standings-pts-num', String(row.championshipPoints)));
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

  var hasStandings = hub.hasSeason && hub.standings && hub.standings.length;
  // Before any race has actually been run, there's nothing to rank yet
  // (2026-09-19 follow-up, Matt's call: "if there hasn't been a race
  // posted yet, there shouldn't be a ranked list -- just the graphic
  // container, no number, and no points") -- same hasResults gate the
  // ticker already uses (roundsCompleted > 0). CURRENT STANDINGS shows the
  // same circle-slash "no data" empty state RECENT RESULTS uses whenever
  // there's nothing ranked to show yet. The separate "View All Drivers"
  // popup this panel used to link to (2026-09-21-2026-10-01) was removed
  // 2026-10-01 (Matt's call: redundant -- the ticker already lists every
  // driver before a season has results, and once it does, that same
  // roster IS this panel).
  var hasResults = (hub.roundsCompleted || 0) > 0;

  if (!hasStandings || !hasResults) {
    var emptyMsg = !hasStandings
      ? 'Standings fill in once a season is underway.'
      : 'Standings fill in once a race has been scored.';
    body.appendChild(_rclEmptyState('No Data To Display', emptyMsg));
  } else {
    // Standings status note MOVED (2026-09-26, Matt's ask: "erase the
    // notifications that pop up at the top of CURRENT STANDINGS") -- the
    // old top-of-panel "Preliminary Results Pending League Review"/
    // "Official Results" note (2026-09-19/2026-09-23) is gone; the same
    // idea now shows at the BOTTOM of this panel instead, as
    // "*PRELIMINARY RESULTS (date)"/"*OFFICIAL RESULTS (date)" -- see the
    // shared _rclBuildResultsStatusNotice_ call below.
    body.appendChild(_rclBuildStandingsColumns_(hub.standings, true));
  }

  // Bottom notice, same as Recent Results' (2026-09-26) -- reports the
  // most recently completed round's own preliminary/official status and
  // posting date, since the season total these standings represent is
  // only ever as "official" as its most recent contributor. Wrapped as a
  // bordered footer (2026-10-02) -- see _rclAppendResultsStatusFooter_'s
  // own comment above.
  if (hasResults && hub.lastRace) {
    _rclAppendResultsStatusFooter_(body, hub.lastRace);
  }

  // "View All Drivers" link (2026-09-21) and its popup (_rclOpenDriversModal)
  // removed 2026-10-01 (Matt's call: redundant -- the ticker already lists
  // every driver before a season has results, and once it does, this
  // panel's own ranked list already shows every registered driver). The
  // "View Points Tables" link that used to sit beside it was removed the
  // same day for a similar reason (folded into "View Season Details").
}

// ---------------------------------------------------------------------
// RECENT RESULTS (last completed race)
// ---------------------------------------------------------------------
// Shared headline builder (2026-09-23, pulled out of _rclRenderResults and
// _rclBuildAllResultsBody_, which used to each build an identical copy of
// this) -- Event on its own line, Winner/Pole/Fastest Lap together on the
// row underneath (Matt's ask: "The Event should be on one line, Winner
// Pole and Fastest Lap should be on the next row"). Winner uses the
// accent color, now gold (.rcl-race-headline-value-accent, css/league.css
// -- was red) per Matt's ask, here and in the View All Results popup
// below, which reuses this same builder so the two can never drift apart.
//
// Shared "Round <n>   <EventName> at <Track>: <Layout>" title line builder
// (2026-09-26 rework, Matt's ask: "in the event title in the ALL RESULTS
// popup, remove the round number before the event name, but keep the
// event name as it is" -- Recent Results keeps its round number, the All
// Results popup and Qualifying tab both hide it via hideRoundNum -- "make
// the track name a normal weight... and make the track layout gray" --
// same three-piece styling the Calendar's own event line already uses,
// .rcl-cal-event/-event-name/-event-track/-event-layout, css/league.css --
// so this reads with the exact same heading treatment sitewide instead of
// one flat-weight string). Shared by _rclBuildRaceHeadline_ (Race
// headline, below) and _rclBuildQualifyingBody_ (Qualifying tab) so the
// two never drift apart.
// "EVENT" label (2026-09-30, Matt's ask: "add 'EVENT' (in the same all
// caps, gray font as the bonus catagories.) above the event/track title
// in ALL RESULTS") -- removed again 2026-10-01 (Matt's ask: "eliminate
// EVENT label above it and move the event title up"), once the ALL
// RESULTS popup went back to showing its own "Round n" prefix right on
// the title line (see _rclBuildEventTitleLine_'s roundSep param below) --
// the label's job (flagging this as the event title) is redundant with
// that prefix, and dropping it lets the title sit right at the top of
// the popup/tab the way Recent Results' own event line always has.
// _rclBuildEventLabel_ itself and its .rcl-race-event-label CSS rule were
// removed along with its two call sites (_rclBuildRaceHeadline_'s former
// opts.showEventLabel branch, and _rclBuildQualifyingBody_ below).

// roundSep (2026-10-01, Matt's ask: "add 'Round <round n>' before the
// Event Name in the title [of the ALL RESULTS popup]... leave a space
// after Round n") -- defaults to the three-space gap Recent Results has
// always used ("Round n   EventName"), but the ALL RESULTS popup/
// Qualifying tab (which un-hide the round number here for the first time,
// see their own call sites below) pass a single plain space instead, per
// Matt's literal ask. The "Round n" text itself is a bare text node with
// no class of its own (same as it's always been) -- it inherits
// .rcl-race-headline-eventname's own color/weight (var(--rcl-ink), a
// near-white #f2f2f0, and no bold -- only the event NAME span below gets
// font-weight 800), which already reads as "white, normal weight" with no
// extra CSS needed.
function _rclBuildEventTitleLine_(entry, hideRoundNum, roundSep) {
  var eventLine = _rclEl('div', 'rcl-race-headline-eventname');
  if (!hideRoundNum && entry.roundNum) {
    eventLine.appendChild(document.createTextNode('Round ' + entry.roundNum + (roundSep || '   ')));
  }
  eventLine.appendChild(_rclEl('span', 'rcl-race-headline-event-name', _rclEscapeHtml(entry.eventName || '')));
  if (entry.track) {
    eventLine.appendChild(document.createTextNode(' at '));
    eventLine.appendChild(_rclEl('span', 'rcl-race-headline-event-track', _rclEscapeHtml(entry.track)));
  }
  if (entry.layout) {
    eventLine.appendChild(document.createTextNode(': '));
    eventLine.appendChild(_rclEl('span', 'rcl-race-headline-event-layout', _rclEscapeHtml(entry.layout)));
  }
  return eventLine;
}

// opts.hideRoundNum (2026-09-26) -- the All Results popup passes this true
// (see _rclBuildAllResultsBody_ below); Recent Results calls this with no
// opts at all, so its round number keeps showing.
// opts.hideStatRow (2026-09-27, Matt's ask: "in the RECENT RESULTS
// container, remove the header that says the winner/pole/fastest lap") --
// Recent Results now passes this true, dropping the whole Winner/Pole/
// Fastest Lap stat row and keeping only the event title line. The All
// Results popup is untouched (still gets the full stat row here) -- it's
// being replaced by its own richer per-class Winner/Most Laps Led/Pole/
// Fastest Lap breakdown instead, see _rclBuildAllResultsBody_ below, which
// no longer calls this function's stat row at all.
function _rclBuildRaceHeadline_(r, opts) {
  opts = opts || {};
  var headlineClass = 'rcl-race-headline' + (opts.hideStatRow ? ' rcl-race-headline-notabs' : '') +
    // Started Recent Results only (2026-09-27, Matt's ask: "move the topmost
    // class results header bar to where the gray line is below the event
    // title... and deleted the gray line"), then extended to the All Results
    // popup too the same day ("remove the line above the header in between
    // the bonus points winners and the event name") -- closes the headline's
    // own bottom border+gap entirely so whatever comes right after it (the
    // first .rcl-standings-class-header graphite bar in Recent Results, or
    // the category breakdown in All Results) sits right where that line
    // used to be, with just a small breathing-room margin in its place. Kept
    // as its own modifier (rather than editing .rcl-race-headline-notabs
    // directly) purely so a future caller can still opt out.
    (opts.closeGapNoLine ? ' rcl-race-headline-closegap' : '');
  var headline = _rclEl('div', headlineClass);
  // variant: 'accent' (gold, Winner) or 'fastestlap' (purple, Fastest Lap
  // -- 2026-09-26, Matt's ask: "make sure the FASTEST LAP winner in the
  // header has their name purple, in the header only" -- distinct from
  // Winner's gold and from the metal gold/silver/bronze position colors).
  function stat(label, value, variant) {
    var s = _rclEl('div', 'rcl-race-headline-stat');
    s.appendChild(_rclEl('div', 'rcl-race-headline-label', label));
    s.appendChild(_rclEl('div', 'rcl-race-headline-value' + (variant ? ' rcl-race-headline-value-' + variant : ''), _rclEscapeHtml(value || '--')));
    return s;
  }
  // opts.roundNumSep (2026-10-01) -- passed straight through to
  // _rclBuildEventTitleLine_; see that function's own comment above.
  headline.appendChild(_rclBuildEventTitleLine_(r, opts.hideRoundNum, opts.roundNumSep));

  if (!opts.hideStatRow) {
    var detailRow = _rclEl('div', 'rcl-race-headline-row');
    detailRow.appendChild(stat('Winner', r.overallWinner, 'accent'));
    detailRow.appendChild(stat('Pole', r.overallPoleSitter));
    detailRow.appendChild(stat('Fastest Lap', r.overallFastestLapDriver ? (r.overallFastestLapDriver + (r.overallFastestLapTime ? ' (' + _rclFormatLapTime_(r.overallFastestLapTime) + ')' : '')) : '', r.overallFastestLapDriver ? 'fastestlap' : null));
    headline.appendChild(detailRow);
  }
  return headline;
}

// Icons for the All Results popup's per-class category breakdown
// (2026-09-27, Matt's ask: "add icons in front of winner, most laps led,
// pole and fastest lap catagory titles"). Same 16x16/viewBox 24/stroke-
// 1.8 convention as _RCL_ICON_FLAG above and Account.html's own ICON_*
// constants -- kept as their own consts here since this page doesn't load
// Account.html (see this file's own header comment on why nothing there
// is shared).
var _RCL_ICON_TROPHY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8v5a4 4 0 0 1-8 0V3z"></path><path d="M8 4H4a3 3 0 0 0 3 5"></path><path d="M16 4h4a3 3 0 0 1-3 5"></path><path d="M12 12v4"></path><path d="M9 20h6"></path><path d="M10 20v-2.5"></path><path d="M14 20v-2.5"></path></svg>';
var _RCL_ICON_LAPS_LED = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path><path d="M3 21v-5h5"></path></svg>';
var _RCL_ICON_POLE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="21" x2="6" y2="3"></line><path d="M6 4l12 4-12 4"></path></svg>';
var _RCL_ICON_STOPWATCH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l3 2"></path><path d="M9 2h6"></path><path d="M12 2v3"></path></svg>';

// Per-class Winner/Most Laps Led/Pole/Fastest Lap breakdown for the All
// Results popup. Originally (2026-09-27) one combined block at the TOP of
// the popup with every class's row stacked under each category, a class
// pill on the end of each row to tell them apart. Reworked 2026-10-01
// (Matt's ask: "move the bonus point sections to underneath their
// respective class section. So each section will get the catagories with
// the icons and a list of 1 name under each catagory") -- now called ONCE
// PER CLASS, from inside that class's own .rcl-race-class block (see the
// call site in _rclBuildAllResultsBody_ below), so each category only
// ever has the one row for THIS class. The class pill is gone with it --
// no longer needed now that the whole breakdown already sits inside that
// class's own section -- replaced with the driver's country flag instead
// (same .rcl-standings-flag look/lookup every other driver row on this
// page already uses, Matt's ask: "eliminate the class pill behind the
// driver name but let's add their country flag"). The Fastest Lap row's
// purple name color is also gone (Matt's ask: "remove the purple style to
// the fastest lap winners and make it bold white like the others") -- no
// 'fastestLap' rowKind is passed any more, so it falls through to the
// same plain bold-ink styling Most Laps Led/Pole Sitter already use;
// Winner's gold rowKind is untouched (not part of that ask).
function _rclBuildClassCategoryBreakdown_(cls) {
  // rcl-race-categories-inclass (css/league.css) restyles the shared
  // .rcl-race-categories block for sitting right under a class's own
  // header and above its standings table (2026-10-01 follow-up, Matt's
  // ask: "I want it to live under the header and above the table in each
  // class" -- briefly sat underneath the standings table instead, same
  // day, before this).
  var wrap = _rclEl('div', 'rcl-race-categories rcl-race-categories-inclass');

  // rowKind (2026-09-27, Matt's ask: "make the winner name gold... in ALL
  // RESULTS") -- 'winner' still adds a color modifier class so the name
  // AND car number pick up the gold accent together (see
  // .rcl-race-category-row-winner, css/league.css); every other category
  // stays the plain bold-ink color.
  function buildRow(name, carNumber, country, rowKind) {
    var row = _rclEl('div', 'rcl-race-category-row' + (rowKind ? ' rcl-race-category-row-' + rowKind : ''));
    row.appendChild(_rclEl('span', 'rcl-race-category-name', _rclEscapeHtml(name)));
    // Flag sits between the name and the car number (2026-10-02, Matt's
    // ask) -- was name, number, flag; now name, flag, number.
    if (country && typeof countryFlagSrc === 'function') {
      var flagSrc = countryFlagSrc(country);
      if (flagSrc) {
        var flagImg = document.createElement('img');
        flagImg.className = 'rcl-standings-flag rcl-race-category-flag';
        flagImg.src = flagSrc;
        flagImg.alt = '';
        flagImg.title = country;
        flagImg.onerror = function () { flagImg.style.display = 'none'; };
        row.appendChild(flagImg);
      }
    }
    if (carNumber) row.appendChild(_rclEl('span', 'rcl-race-category-number', '#' + _rclEscapeHtml(carNumber)));
    return row;
  }

  function buildCategory(icon, title, rows) {
    if (!rows.length) return;
    var cat = _rclEl('div', 'rcl-race-category');
    var head = _rclEl('div', 'rcl-race-category-title');
    var iconSpan = _rclEl('span', 'rcl-race-category-icon', icon);
    head.appendChild(iconSpan);
    head.appendChild(document.createTextNode(title));
    cat.appendChild(head);
    rows.forEach(function (r) { cat.appendChild(r); });
    wrap.appendChild(cat);
  }

  var winnerRows = [], lapsLedRows = [], poleRows = [], fastestRows = [];
  if (cls.classWinner) winnerRows.push(buildRow(cls.classWinner, cls.classWinnerCarNumber, cls.classWinnerCountry, 'winner'));
  if (cls.classMostLapsLedDriver && cls.classMostLapsLedCount) {
    lapsLedRows.push(buildRow(cls.classMostLapsLedDriver, cls.classMostLapsLedCarNumber, cls.classMostLapsLedCountry));
  }
  if (cls.classPoleSitter) poleRows.push(buildRow(cls.classPoleSitter, cls.classPoleSitterCarNumber, cls.classPoleSitterCountry));
  if (cls.classFastestLapDriver) {
    fastestRows.push(buildRow(cls.classFastestLapDriver, cls.classFastestLapCarNumber, cls.classFastestLapDriverCountry));
  }

  buildCategory(_RCL_ICON_TROPHY, 'Winner', winnerRows);
  buildCategory(_RCL_ICON_LAPS_LED, 'Most Laps Led', lapsLedRows);
  buildCategory(_RCL_ICON_POLE, 'Pole Sitter', poleRows);
  buildCategory(_RCL_ICON_STOPWATCH, 'Fastest Lap', fastestRows);

  return wrap;
}

function _rclRenderResults(hub) {
  var body = document.getElementById('rcl-results-body');
  if (!body) return;
  body.innerHTML = '';

  if (!hub.hasSeason || !hub.lastRace) {
    body.appendChild(_rclEmptyState('No Data To Display', 'Results fill in once a season is underway.'));
    // The status notice still gets a chance to appear even when the
    // abbreviated lastRace panel has nothing to show -- see the shared
    // helper call at the end of this function.
    _rclAppendResultsStatusNotice_(body, hub);
    return;
  }

  var r = hub.lastRace;
  body.appendChild(_rclBuildRaceHeadline_(r, { hideStatRow: true, closeGapNoLine: true }));

  // Classes arrive pre-sorted Hypercar -> LMP2 -> LMP3 -> LMGT3 -> LMGTE
  // (CAR_CLASS_CANONICAL_ORDER_, Results.gs -- 2026-09-23, Matt's rule:
  // "the displayed order of results always needs to be Hypercar, LMP2,
  // LMP3, LMGT3 and then LMGTE").
  (r.classes || []).forEach(function (cls) {
    var clsWrap = _rclEl('div', 'rcl-race-class');
    // Graphite "<CLASS> STANDINGS" header (2026-09-23, Matt's ask) -- same
    // shared graphite bar the Current Standings panel uses (see
    // .rcl-standings-class-header, css/league.css), just different text.
    clsWrap.appendChild(_rclEl('div', 'rcl-standings-class-header', (cls.className || 'CLASS').toUpperCase() + ' STANDINGS'));

    // Divider + POS/DRIVER/PTS column labels (2026-09-23, Matt's ask: "add
    // a line above the top row and add catagory headers. POS, DRIVER, and
    // PTS"), same 3-column grid as the rows below so everything lines up.
    var headRow = _rclEl('div', 'rcl-race-col-head rcl-race-grid-3');
    headRow.appendChild(_rclEl('div', null, 'Pos'));
    headRow.appendChild(_rclEl('div', null, 'Driver'));
    headRow.appendChild(_rclEl('div', null, 'Pts'));
    clsWrap.appendChild(headRow);

    // Top 5 + points gained this race (2026-09-23, Matt's ask: "The
    // standings tables should have the top 5 drivers and how many points
    // they gained from the race" -- was best lap time). hub.lastRace is
    // already capped to 5 per class server-side (see
    // _rcBuildLeagueHubPayload_, Website.gs), but slice defensively here
    // too in case that ever changes.
    (cls.standings || []).slice(0, 5).forEach(function (row, idx) {
      // Pos badge + driver identity now the exact same shared markup as
      // Current Standings (2026-09-23, Matt's ask) -- gold/silver/bronze
      // metal coloring, manufacturer logo, flag, car number and team all
      // come along for free from _rclBuildPosBadge_/_rclBuildDriverIdentity_.
      var dnf = _rclIsDnf_(row);
      // Fastest-lap driver's name in this list is NOT purple any more
      // (2026-09-26, Matt's follow-up correction -- purple was tried here
      // the same day it shipped and reverted: "I don't want the fastest
      // lap driver in the standings list to be purple, only the driver
      // that is mentioned in the header should be purple" -- see
      // _rclBuildRaceHeadline_'s Fastest Lap stat above, which now carries
      // that purple instead). row.wonFastestLap is still computed
      // server-side (Results.gs) but no longer consumed here.
      var rowEl = _rclEl('div', 'rcl-race-row rcl-race-grid-3' + (RCL_POS_METAL_CLASS_[idx] ? ' ' + RCL_POS_METAL_CLASS_[idx] : ''));
      // Same DSQ-over-DNF precedence as the All Results popup (2026-09-24,
      // Matt's ask) -- a top-5-by-points DNF is rare but not impossible in
      // a small field.
      rowEl.appendChild(_rclBuildPosBadge_(idx, row.disqualified ? 'DSQ' : (dnf ? 'DNF' : undefined)));
      rowEl.appendChild(_rclBuildDriverIdentity_(row, dnf));
      // "+" prefix (2026-09-27, Matt's ask) -- makes clear these are points
      // GAINED from this particular race, not a running total. Same
      // treatment the All Results popup's own Pts column already uses
      // (_rclBuildAllResultsBody_ below).
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-points', (row.points !== null && row.points !== undefined) ? ('+' + row.points) : '--'));
      clsWrap.appendChild(rowEl);
    });
    body.appendChild(clsWrap);
  });
  // "View Full Race Details" link removed from this panel (2026-10-02,
  // Matt's ask) -- Recent Results is getting replaced by a dedicated "Last
  // Race" section, so this panel no longer links out to the Race Details
  // popup at all. See _rclRenderCalendar's own "VIEW RESULTS" link below
  // for the new way into that popup. The status notice + mobile nudge that
  // used to sit above that link stay put.
  _rclAppendResultsStatusNotice_(body, hub);
}

// "*PRELIMINARY RESULTS (date)"/"*OFFICIAL RESULTS (date)" notice (2026-09-26
// rework, Matt's ask) -- moved off the top of Current Standings (was
// "Preliminary Results Pending League Review"/"Official Results", no date,
// two different colors) down to the bottom of Recent Results/Current
// Standings/the All Results popup, always in the same gold accent color
// now ("Both should be the same gold color as the current preliminary
// standings message" -- .rcl-standings-status-preliminary, #e0b64c) with a
// "date of posting" appended: finalizedAt once a round's results are
// official, otherwise the race session's own importedAt (when the results
// were first posted, still preliminary). Takes a single round result
// object (hub.lastRace for Recent Results/Current Standings -- both are
// "as of the most recently completed round" -- or the currently-selected
// round's own result for the All Results popup); null/no round yet
// returns null so a caller can skip appending anything.
// ---------------------------------------------------------------------
// MANUFACTURERS' STANDINGS -- added 2026-10-02, Matt's ask: a plain (no
// panel/card) podium between Recent Results and Championship Standings
// showing the top 3 Hypercar-class manufacturers by championship points.
// Entirely derived from hub.standings, which already carries each
// Hypercar driver's `manufacturer` and `championshipPoints` (no new
// server data) -- see _rcBuildSeasonStandings_, Results.gs.
// ---------------------------------------------------------------------

// Sums each driver's championshipPoints into their manufacturer within
// the Hypercar class only (not every class -- Matt's ask was specifically
// "the top 3 manufacturers for the hypercar catagory"), then returns the
// top 3 manufacturers by that total, highest first. A manufacturer with
// no cars/points yet (blank string) is skipped rather than showing as a
// blank podium tile.
function _rclComputeManufacturerStandings_(hub) {
  var clsEntry = (hub.standings || []).filter(function (c) { return c.className === 'Hypercar'; })[0];
  if (!clsEntry || !clsEntry.standings || !clsEntry.standings.length) return [];

  var totalsByManufacturer = {};
  clsEntry.standings.forEach(function (row) {
    var mfr = row.manufacturer || '';
    if (!mfr) return;
    totalsByManufacturer[mfr] = (totalsByManufacturer[mfr] || 0) + (Number(row.championshipPoints) || 0);
  });

  var ranked = Object.keys(totalsByManufacturer).map(function (mfr) {
    return { manufacturer: mfr, points: totalsByManufacturer[mfr] };
  });
  ranked.sort(function (a, b) { return b.points - a.points; });
  return ranked.slice(0, 3);
}

// Full Hypercar manufacturer standings, every manufacturer with points,
// highest first -- same totals as _rclComputeManufacturerStandings_ above
// (duplicated rather than sliced out of it so that function's own "top 3"
// contract stays obviously unchanged), used by the ranks-4-and-on list
// added below the top-3 podium (2026-10-03, Matt's ask: a "Manufacturers'
// Standings" list under the existing boxes, left-to-right two-column,
// starting from "1. TOYOTA... 2. FERRARI..."). His example numbered from
// 1, but the podium above it already covers ranks 1-3 -- showing those
// three again in a second list directly underneath them would just be
// duplicate information, so this picks up where the podium leaves off
// (rank 4 on) and keeps numbering continuous with it instead. Worth a
// second look from Matt if that's not actually what he pictured.
function _rclComputeManufacturerStandingsFull_(hub) {
  var clsEntry = (hub.standings || []).filter(function (c) { return c.className === 'Hypercar'; })[0];
  if (!clsEntry || !clsEntry.standings || !clsEntry.standings.length) return [];

  var totalsByManufacturer = {};
  clsEntry.standings.forEach(function (row) {
    var mfr = row.manufacturer || '';
    if (!mfr) return;
    totalsByManufacturer[mfr] = (totalsByManufacturer[mfr] || 0) + (Number(row.championshipPoints) || 0);
  });

  var ranked = Object.keys(totalsByManufacturer).map(function (mfr) {
    return { manufacturer: mfr, points: totalsByManufacturer[mfr] };
  });
  ranked.sort(function (a, b) { return b.points - a.points; });
  return ranked;
}

function _rclRenderManufacturerStandings(hub) {
  var body = document.getElementById('rcl-manufacturer-standings');
  if (!body) return;
  body.innerHTML = '';

  // No season, or no Hypercar entrants with points yet -- section is
  // silently hidden entirely (2026-10-02, Matt's ask: "If Hypercars
  // aren't in the season, this section is silently hidden and the
  // containers below shift up") rather than just left empty -- an empty
  // .rcl-row-full still carries its own margin-top (css/league.css),
  // which would leave a stray gap above Championship Standings instead
  // of actually closing it up. display:none collapses that margin along
  // with everything else; the else branch below resets it back to
  // visible for the next render once a Hypercar class does have points
  // (no full page reload needed for this to reappear).
  var top3 = hub.hasSeason ? _rclComputeManufacturerStandings_(hub) : [];
  if (!top3.length) {
    body.style.display = 'none';
    return;
  }
  body.style.display = '';

  // "Manufacturers' Standings" / "Hypercar Class" (2026-10-02, Matt's
  // asks: "Get rid of the 2026 and leave it to just Manufacturers'
  // Standings" for the title -- his reference mockup had a "2026" year
  // line under it -- then "Make it say HYPERCAR CLASS underneath" as a
  // follow-up, since this podium is Hypercar-only and that wasn't
  // labeled anywhere on the page itself).
  body.appendChild(_rclEl('div', 'rcl-mfr-title', "Manufacturers' Standings"));
  body.appendChild(_rclEl('div', 'rcl-mfr-subtitle', 'Hypercar Class'));

  var podium = _rclEl('div', 'rcl-mfr-podium');
  // Classic podium order left-to-right: P2, P1 (center, tallest), P3.
  // rankIdx is 0-based (0 = P1/gold) -- falls back to plain rank order
  // (P1, P2, ...) if fewer than 3 manufacturers have points yet, since
  // there's no "center" to build around with only 1 or 2 tiles.
  var displayOrder = (top3.length === 3) ? [1, 0, 2] : top3.map(function (_, i) { return i; });
  displayOrder.forEach(function (rankIdx) {
    var entry = top3[rankIdx];
    if (!entry) return;
    var tile = _rclEl('div', 'rcl-mfr-tile rcl-mfr-tile-p' + (rankIdx + 1));
    // Square-at-all-costs box (2026-10-02, Matt's follow-up: "the
    // containers around the logos are still missshaped. I want them
    // square at all costs") -- a plain width:100% + aspect-ratio:1/1 box
    // wasn't holding square reliably here, so this switches to the old
    // reliable padding-bottom:100% trick instead: percentage padding is
    // always computed off the containing block's WIDTH (even
    // padding-top/bottom), so a box with no declared height and
    // padding-bottom:100% is forced to exactly match its own width, no
    // matter what. .rcl-mfr-tile-box is now just that sizing shell
    // (height:0, padding-bottom:100%); everything actually visible --
    // border, background, the logo -- lives in the absolutely-positioned
    // .rcl-mfr-tile-box-inner that fills it.
    var box = _rclEl('div', 'rcl-mfr-tile-box');
    var boxInner = _rclEl('div', 'rcl-mfr-tile-box-inner');
    var img = document.createElement('img');
    img.className = 'rcl-mfr-tile-logo';
    img.src = manufacturerLogoSrc(entry.manufacturer);
    img.alt = entry.manufacturer;
    // Same onerror-hide convention as every other manufacturer logo on
    // this page (manufacturerLogoFallback -- tries a .svg before giving
    // up and hiding the <img> entirely).
    manufacturerLogoFallback(img, entry.manufacturer, function () { img.style.display = 'none'; });
    boxInner.appendChild(img);
    box.appendChild(boxInner);
    tile.appendChild(box);
    // Position swapped above the name/points line (2026-10-03, Matt's
    // ask: "swap the position and the team/points locations in the
    // podium") -- was name/points above, rank number below; now the rank
    // number sits right under the logo (its own border-top still the one
    // divider line in the tile) and the name+points line sits under that.
    var rankWrap = _rclEl('div', 'rcl-mfr-tile-rankline');
    rankWrap.appendChild(_rclEl('span', 'rcl-mfr-tile-rank', String(rankIdx + 1)));
    tile.appendChild(rankWrap);
    // Points added next to the manufacturer name (2026-10-03, Matt's ask:
    // "add points next to the MANUFACTURERS on the podium section with a
    // 5-space gap... manufacturer and N PTS should be the same style") --
    // one text run, one class, so both halves render in the exact same
    // style with no separate element to keep in sync. 5 literal
    // non-breaking spaces for the gap, since plain spaces collapse in
    // HTML and this is meant to read as a fixed gap, not a flexible one.
    var nameLine = _rclEl('div', 'rcl-mfr-tile-name',
      _rclEscapeHtml(entry.manufacturer.toUpperCase()) + '     ' + Math.round(entry.points) + ' PTS');
    tile.appendChild(nameLine);
    podium.appendChild(tile);
  });
  body.appendChild(podium);

  // Rest-of-field list, ranks 4 and on, two columns -- top-to-bottom rank
  // order within each column (2026-10-03 follow-up, Matt's ask: "I don't
  // like the left to right listing so let's keep the two column layout
  // but make it top to down rank" -- was left-to-right/row-major, e.g.
  // rank 4 top-left, rank 5 top-right, rank 6 second row left; now rank 4
  // fills the whole left column top-to-bottom before rank continues at
  // the top of the right column, like a results sheet). See
  // _rclComputeManufacturerStandingsFull_'s own comment for why this
  // starts at rank 4 instead of repeating the top 3 the podium above
  // already shows. Silently omitted when there's nothing beyond the top
  // 3 yet.
  //
  // CSS alone (grid-auto-flow: column) only fills column-major if it
  // already knows how many ROWS each column holds -- an implicit column
  // count has no such limit, so it would just put everything in one tall
  // column instead of wrapping to a second. rowCount here is that
  // explicit height, set as an inline custom property .rcl-mfr-rest reads
  // (css/league.css) rather than a fixed CSS constant, since it depends
  // on how many manufacturers actually have points this season.
  var fullField = _rclComputeManufacturerStandingsFull_(hub);
  var rest = fullField.slice(3);
  if (rest.length) {
    var restList = _rclEl('div', 'rcl-mfr-rest');
    var rowCount = Math.ceil(rest.length / 2);
    restList.style.setProperty('--rcl-mfr-rest-rows', String(rowCount));
    rest.forEach(function (entry, i) {
      var row = _rclEl('div', 'rcl-mfr-rest-item');
      row.appendChild(_rclEl('span', 'rcl-mfr-rest-rank', String(i + 4) + '.'));
      row.appendChild(_rclEl('span', 'rcl-mfr-rest-name', _rclEscapeHtml(entry.manufacturer.toUpperCase())));
      row.appendChild(_rclEl('span', 'rcl-mfr-rest-pts', Math.round(entry.points) + ' PTS'));
      restList.appendChild(row);
    });
    body.appendChild(restList);
  }
}

function _rclBuildResultsStatusNotice_(round) {
  if (!round) return null;
  var finalized = !!round.resultsFinalized;
  var dateSource = finalized ? round.finalizedAt : (round.importedAt || round.startUtc);
  var dateText = dateSource ? _rclFormatDate(dateSource) : '';
  // "(POSTED ON <date>)" (2026-09-26 follow-up, Matt's ask) -- was just
  // "(<date>)" with no label.
  var label = (finalized ? '*OFFICIAL RESULTS' : '*PRELIMINARY RESULTS') + (dateText ? ' (POSTED ON ' + dateText + ')' : '');
  return _rclEl('div', 'rcl-standings-status-note rcl-standings-status-preliminary', label);
}

// Mobile-only "view on PC" nudge -- was All Results-only (2026-09-27,
// Matt's ask: "add another notation under the *RESULTS STATUS at the
// bottom of the tables" -- the exact text "**FOR FULL RESULTS, VIEW ON PC
// BROWSER"), extended (2026-09-30, Matt's ask: "'**For detailed results,
// view on PC browser' should be under the ALL RESULTS leaderboard note,
// the recent results note and current standings", clarified mobile-only)
// to sit under the same *PRELIMINARY/*OFFICIAL RESULTS notice everywhere
// it appears, not just the All Results popup -- Recent Results and
// Current Standings both collapse columns/hide team names at the mobile
// breakpoint too (league.css), so a phone visitor gets the same nudge
// there. Pulled into its own shared builder so the exact wording/classes
// stay identical at all three call sites instead of drifting. Text kept
// as the site's established all-caps status-note convention (matches
// *PRELIMINARY RESULTS/*OFFICIAL RESULTS next to it) rather than the
// mixed-case phrasing in Matt's ask, which read as a paraphrase of the
// existing note rather than a wording change.
// rcl-standings-status-mobile-note is display:none by default and only
// shown back in at the mobile breakpoint (league.css) -- desktop/tablet
// already see everything this note would be pointing them to, so it
// would be redundant there.
function _rclBuildMobileViewOnPcNote_() {
  return _rclEl('div', 'rcl-standings-status-note rcl-standings-status-preliminary rcl-standings-status-mobile-note', '**FOR FULL RESULTS, VIEW ON PC BROWSER');
}

// Shared by both branches of _rclRenderResults above (the normal render
// and its "no lastRace yet" empty-state fallback) so the link still shows
// up whenever the season actually has any completed rounds on record,
// even in the rare case the abbreviated lastRace payload itself came back
// empty for some reason. The status notice above only shows when there's
// an actual lastRace to report a date for.
// rcl-results-bottom-row (2026-09-26, Matt's ask: "add a line above VIEW
// ALL RESULTS in a similar way that there is a line above the links at the
// bottom of CURRENT STANDINGS") -- same border-top treatment
// .rcl-standings-points-row already uses, added here as an extra modifier
// class so Calendar's own "View Season Details" link (which shares
// .rcl-cal-details-row but deliberately has no line above it, per that
// section's own comment) stays untouched.
// Was _rclAppendViewAllResultsLink_ -- renamed and trimmed 2026-10-02
// (Matt's ask: "Remove 'VIEW FULL RACE DETAILS' from RECENT RESULTS...
// this section will be getting revamped anyways"). The link/button into
// the Race Details popup is gone from this panel; the status
// notice + mobile "view on PC" nudge it used to sit above are kept exactly
// as before, since those weren't part of that ask.
// Footer wrapper (2026-10-02, Matt's ask: "In any container that has a
// notification on the status of the results... make it live at the
// bottom of the container and add a gray line above it to signal that
// it's the 'footer' section of the container") -- wraps the status
// notice + mobile "view on PC" nudge in the same bordered
// .rcl-results-bottom-row treatment VIEW ALL RESULTS used to sit under
// (see the comment above this function), so it reads as a deliberate
// footer instead of just the last two lines of text in the panel. Shared
// by Recent Results and Current Standings, the two places this notice is
// genuinely the last thing in the container -- the All Results popup
// (_rclBuildAllResultsBody_ below) deliberately keeps its own plain
// (line-less) placement, since Race Report/Penalties Assessed already
// follow it there with their own border-top dividers; wrapping it there
// too would be a line immediately followed by another line.
function _rclAppendResultsStatusFooter_(body, round) {
  var notice = _rclBuildResultsStatusNotice_(round);
  if (!notice) return;
  var footer = _rclEl('div', 'rcl-results-bottom-row rcl-results-status-footer');
  footer.appendChild(notice);
  // Mobile-only "view on PC" nudge (2026-09-30, Matt's ask -- see
  // _rclBuildMobileViewOnPcNote_ for the full history) -- Recent Results/
  // Current Standings both hide team names on phone width same as All
  // Results (league.css), so it gets the same nudge under its status
  // notice.
  footer.appendChild(_rclBuildMobileViewOnPcNote_());
  body.appendChild(footer);
}

function _rclAppendResultsStatusNotice_(body, hub) {
  if (!hub.resultsRounds || !hub.resultsRounds.length) return;
  _rclAppendResultsStatusFooter_(body, hub.lastRace);
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
// _rcBuildRoundResultData_'s penaltiesThisRound, Results.gs). Only Tier 1
// never produces a penalty row in the first place (see
// PENALTY_TIER_EFFECTS_, Protests.gs / PENALTY_TIERS, reference-data.js);
// Tier 7 (Suspension) got its own 'Suspension' effect row 2026-10-01.
function _rclDescribePenaltyEffect_(effectType, effectSeconds) {
  if (effectType === 'Time') return '+' + (Number(effectSeconds) || 0) + 's';
  if (effectType === 'DSQ') return 'Disqualified';
  if (effectType === 'Suspension') return 'Suspended';
  return 'Logged';
}

// GAP (to class leader), the View All Results table's one gap column
// (2026-09-26, Matt's ask -- the separate INTERVAL-to-the-car-ahead column
// this table used to also show is removed; see _rclBuildAllResultsBody_'s
// PTS column comment for what replaced it). Derived client-side from
// finishTimeSeconds -- standings arrive sorted by adjusted class position,
// so index 0 is always the class leader. A DSQ'd driver or one missing a
// finish time shows a dash/DSQ instead of a bogus gap.
// A car that's one or more laps down has a SHORTER raw finishTimeSeconds
// than the leader (its FinishTime is stamped when the checkered flag falls
// for everyone, after fewer laps of running than the leader put in), so
// naively subtracting finish times made a lapped car's "gap" negative and
// the "gap <= 0" check below then displayed it as "Leader" (2026-09-24,
// Matt's bug report -- confirmed the fix by checking each row's own `laps`
// count rather than trusting the raw time delta). Real timing towers show
// "+N Lap(s)" instead of a time gap once lap counts differ -- comparing
// elapsed time across different lap counts isn't meaningful -- so that
// takes priority over the time-based gap whenever the compared car is
// behind on laps.
// rowPenSeconds/leaderPenSeconds (2026-09-27, Matt's report: "the total
// time in the ALL RESULTS popup did not update for a driver after a
// penalty of +5 seconds was applied... I'd like to see the total time
// updated so it shows the corrected time") -- finishTimeSeconds off the
// XML import is always the raw, un-penalized time (Results.gs never
// writes a penalty into it), so once the Total Time column below starts
// adding a driver's own Time-effect penalty seconds before displaying it,
// Gap has to add the same correction on both sides of its subtraction or
// it goes stale relative to the Total Time column right next to it (a
// penalized driver's Total Time would grow but their Gap wouldn't move to
// match). Optional/defaults to 0 since this is the only caller today.
function _rclFormatGap_(row, leaderRow, rowPenSeconds, leaderPenSeconds) {
  // Suspended-this-round (2026-10-01) checked before DSQ -- a Tier 7
  // ruling now removes the driver from THIS race's own classification
  // the same way a DSQ does, so the same "no real gap" short-circuit
  // applies, just with its own SUS text instead of DSQ.
  if (row.suspended) return 'SUS';
  if (row.disqualified) return 'DSQ';
  if (row.finishTimeSeconds === null || row.finishTimeSeconds === undefined || !leaderRow || leaderRow.finishTimeSeconds === null || leaderRow.finishTimeSeconds === undefined) return '--';
  var lapsDown = (leaderRow.laps || 0) - (row.laps || 0);
  if (lapsDown > 0) return '+' + lapsDown + ' Lap' + (lapsDown === 1 ? '' : 's');
  var gap = (row.finishTimeSeconds + (rowPenSeconds || 0)) - (leaderRow.finishTimeSeconds + (leaderPenSeconds || 0));
  if (gap <= 0) return 'Leader';
  return '+' + gap.toFixed(3);
}

// INTERVAL (to the car directly ahead), back in the All Results table
// (2026-10-01, Matt's ask: "Remove the penalty column and put Interval
// stats back in there instead. We already have a Penalties Assessed
// section" -- the PEN column it's replacing sat in this exact slot, right
// after Total Time). Same shape as _rclFormatGap_ just above, just
// measured against the row immediately ahead in this class's standings
// (prevRow) instead of the class leader -- the leader/first row has no
// car ahead of it, so that row always shows '--'. Same lap-down override
// and same-penalty-correction reasoning as GAP (see that function's own
// comment) applies here too: prevRow's own Time-effect penalty seconds
// have to be added on both sides of the subtraction, or Interval goes
// stale next to the (already-corrected) Total Time column right next to
// it.
function _rclFormatInterval_(row, prevRow, rowPenSeconds, prevPenSeconds) {
  if (row.suspended) return 'SUS';
  if (row.disqualified) return 'DSQ';
  if (!prevRow) return '--';
  if (row.finishTimeSeconds === null || row.finishTimeSeconds === undefined || prevRow.finishTimeSeconds === null || prevRow.finishTimeSeconds === undefined) return '--';
  var lapsDown = (prevRow.laps || 0) - (row.laps || 0);
  if (lapsDown > 0) return '+' + lapsDown + ' Lap' + (lapsDown === 1 ? '' : 's');
  var interval = (row.finishTimeSeconds + (rowPenSeconds || 0)) - (prevRow.finishTimeSeconds + (prevPenSeconds || 0));
  if (interval <= 0) return '--';
  return '+' + interval.toFixed(3);
}

// TOTAL TIME as h:mm:ss.mmm (2026-09-23, Matt's exact format example:
// "6:00:07.219"). No leading zero on the hours digit, but minutes/seconds
// are always 2 digits and milliseconds always 3, matching that example.
function _rclFormatTotalTime_(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '--';
  var totalMs = Math.round(seconds * 1000);
  var ms = totalMs % 1000;
  var totalSec = Math.floor(totalMs / 1000);
  var s = totalSec % 60;
  var totalMin = Math.floor(totalSec / 60);
  var m = totalMin % 60;
  var h = Math.floor(totalMin / 60);
  function pad(n, len) { var str = String(n); while (str.length < len) str = '0' + str; return str; }
  return h + ':' + pad(m, 2) + ':' + pad(s, 2) + '.' + pad(ms, 3);
}

// Fastest/best lap time, M:SS:mmm (2026-09-26, Matt's follow-up ask: "make
// the fastest lap and best lap time in the leaderboards formatted ->
// M:SS:Milliseconds" -- single-digit minutes, no leading zero, was
// zero-padded MM:SS:mmm earlier the same day). BestLapTime comes off the
// XML import, and out of Results.gs, as a raw decimal-seconds string like
// "92.3456". No hour component -- unlike _rclFormatTotalTime_ above (a
// full race time), a single lap is never going to run an hour. A
// non-numeric value (already-formatted or genuinely missing) falls back
// to '--' rather than showing "NaN:NaN:NaN".
function _rclFormatLapTime_(raw) {
  var totalSeconds = Number(raw);
  if (raw === null || raw === undefined || raw === '' || isNaN(totalSeconds)) return '--';
  var totalMs = Math.round(totalSeconds * 1000);
  var ms = totalMs % 1000;
  var totalSec = Math.floor(totalMs / 1000);
  var s = totalSec % 60;
  var m = Math.floor(totalSec / 60);
  function pad(n, len) { var str = String(n); while (str.length < len) str = '0' + str; return str; }
  return m + ':' + pad(s, 2) + ':' + pad(ms, 3);
}

// AVG (KM/H) -- not a stored field, derived from trackLengthMeters (on the
// round result payload, Results.gs) times laps completed, over finish time
// (2026-09-23, Matt's ask). A DSQ'd/DNF driver with no usable finish time
// shows a dash rather than a bogus speed.
function _rclFormatAvgSpeed_(row, trackLengthMeters) {
  if (row.suspended) return 'SUS';
  if (row.disqualified) return 'DSQ';
  if (!trackLengthMeters || !row.laps || row.finishTimeSeconds === null || row.finishTimeSeconds === undefined || row.finishTimeSeconds <= 0) return '--';
  var kmh = (trackLengthMeters * row.laps / 1000) / (row.finishTimeSeconds / 3600);
  return kmh.toFixed(1);
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

  // The headline (event title + "Round n" prefix) is gone entirely as of
  // 2026-10-01 (Matt's ask: "having the title of the event above the
  // leaderboards is redundant since it lives in the drop down box which is
  // also viewable" -- the round select above already reads "Round n -
  // EventName: Track (Date)", same info this used to repeat). This line
  // went through several earlier passes the same day (round number hidden,
  // then shown again with a single-space separator, "EVENT" label added
  // then removed) before Matt's call to drop the whole thing -- see
  // _rclBuildRaceHeadline_/_rclBuildEventTitleLine_ above, both still used
  // by Recent Results (_rclRenderResults), which is unaffected by this.
  // .rcl-allresults-select-row's own margin-bottom (css/league.css)
  // supplies the breathing room before the first class section now.

  // A bold "+Ns" badge next to Total Time was tried 2026-09-25 and
  // reverted the same day (Matt's call: "I don't want the +10s penalty
  // showing up in the all results leaderboard. I'll have to figure out a
  // better way to display penalties on the board. For now, keep the
  // penalties at the bottom of the page"). A dedicated PEN column (below,
  // penSecondsByProfileId) is a distinct, later ask (2026-09-26, Matt: "add
  // a PEN column after the Total Time column") -- a real grid column, not
  // a badge glued onto Total Time, so it does not undo that revert. The
  // full "Penalties Assessed" list at the bottom of the popup still stays,
  // unchanged, as the only place a penalty's full detail (infraction type,
  // tier, lap) is spelled out.

  // profileId -> display name, built off this round's own full standings
  // -- penalties (below) only carry a profileId (see the `against` field
  // on _rcBuildRoundResultData_'s penaltiesThisRound, Results.gs), so this
  // is how the popup resolves a name to show next to each one.
  var namesByProfileId = {};
  // profileId -> total seconds of Time-effect penalties this round, summed
  // (2026-09-26, for the new PEN column below). A driver can be hit with
  // more than one time penalty in a round, so this sums every Time-effect
  // adjustment against them rather than showing only the first.
  var penSecondsByProfileId = {};
  (result.penalties || []).forEach(function (p) {
    if (p.effectType !== 'Time' || !p.against) return;
    penSecondsByProfileId[p.against] = (penSecondsByProfileId[p.against] || 0) + (Number(p.effectSeconds) || 0);
  });
  // Classes arrive pre-sorted Hypercar -> LMP2 -> LMP3 -> LMGT3 -> LMGTE
  // (CAR_CLASS_CANONICAL_ORDER_, Results.gs -- 2026-09-23, Matt's rule).
  (result.classes || []).forEach(function (cls) {
    var clsWrap = _rclEl('div', 'rcl-race-class');
    // "<CLASS> STANDINGS" -- no "(n)" count (2026-09-23, Matt's ask:
    // "Have it only say <CLASS> STANDINGS and remove the (n) in the title
    // of the leaderboards"). Same shared graphite bar Recent Results and
    // Current Standings both use.
    clsWrap.appendChild(_rclEl('div', 'rcl-standings-class-header', (cls.className || 'CLASS').toUpperCase() + ' STANDINGS'));

    // Winner/Most Laps Led/Pole Sitter/Fastest Lap breakdown for THIS
    // class only, right under its own header and above its standings
    // table (2026-10-01 follow-up, Matt's ask: "I want it to live under
    // the header and above the table in each class" -- supersedes the
    // same-day change that put this underneath the table instead; see
    // _rclBuildClassCategoryBreakdown_'s own comment above for the fuller
    // history).
    clsWrap.appendChild(_rclBuildClassCategoryBreakdown_(cls));

    // Column labels, divider line BELOW them (2026-09-23 follow-up,
    // Matt's ask: "move the line BELOW the catagory labels" -- was above)
    // -- POS, DRIVER, LAPS, TOTAL TIME, INTERVAL, GAP, AVG (KM/H), BEST
    // LAP, PTS. PEN removed and INTERVAL put back in its slot (2026-10-01,
    // Matt's ask: "Remove the penalty column and put Interval stats back
    // in there instead. We already have a Penalties Assessed section" --
    // that section, further down this popup, is now the only place a
    // round's penalties show). ON removed entirely (2026-09-23 follow-up,
    // Matt's ask). Same grid as the data rows below it so every label
    // lines up with its column.
    var headRow = _rclEl('div', 'rcl-race-col-head rcl-race-grid-allresults');
    headRow.appendChild(_rclEl('div', null, 'Pos'));
    headRow.appendChild(_rclEl('div', null, 'Driver'));
    headRow.appendChild(_rclEl('div', null, 'Laps'));
    headRow.appendChild(_rclEl('div', null, 'Total Time'));
    headRow.appendChild(_rclEl('div', null, 'Interval'));
    headRow.appendChild(_rclEl('div', null, 'Gap'));
    headRow.appendChild(_rclEl('div', null, 'Avg (KM/H)'));
    headRow.appendChild(_rclEl('div', null, 'Best Lap'));
    headRow.appendChild(_rclEl('div', null, 'Pts'));
    clsWrap.appendChild(headRow);

    var standings = cls.standings || [];
    // Class leader's finish time, for GAP -- standings arrive sorted by
    // adjusted class position, so index 0 is always P1 (or the first
    // non-DSQ'd entry in practice; _rcRecomputeStandingsCacheFromRound_
    // already sorts DSQ'd drivers to the back, Results.gs).
    var leaderRow = standings.length ? standings[0] : null;

    standings.forEach(function (row, idx) {
      if (row.profileId) namesByProfileId[row.profileId] = row.name;
      var dnf = _rclIsDnf_(row);
      // Pos badge + driver identity, identical markup to Current Standings
      // (2026-09-23, Matt's ask), same metal coloring by finish position.
      // DSQ still wins over DNF when both are true (a disqualified driver
      // shows DSQ, not DNF) -- otherwise a driver who didn't finish shows
      // DNF in the position slot instead of a numeric finish position
      // that never actually happened (2026-09-24, Matt's ask: "make sure
      // drivers who DNF during a race has DNF on the all results board").
      var rowEl = _rclEl('div', 'rcl-race-row rcl-race-grid-allresults' + (RCL_POS_METAL_CLASS_[idx] ? ' ' + RCL_POS_METAL_CLASS_[idx] : ''));
      // Suspended (SUS) takes precedence over DSQ/DNF -- synthetic row
      // injected server-side (Results.gs) for every round on/after a Tier 7
      // ruling's effective round, All Results popup only (2026-10-01, Matt's
      // ask: "SUS shows up on every race POS container on AND after the
      // penalty... SUS drivers show up underneath DSQ drivers").
      rowEl.appendChild(_rclBuildPosBadge_(idx, row.suspended ? 'SUS' : (row.disqualified ? 'DSQ' : (dnf ? 'DNF' : undefined))));
      rowEl.appendChild(_rclBuildDriverIdentity_(row, dnf));
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-num', String(row.laps || 0)));
      var penSeconds = row.profileId ? (penSecondsByProfileId[row.profileId] || 0) : 0;
      // Total Time still shows the CORRECTED time (2026-09-27, Matt's
      // report above) -- raw finishTimeSeconds plus this driver's own
      // Time-effect penalty seconds, so a +5s penalty still moves the
      // number shown here even with the PEN column itself gone; Gap and
      // Interval (right below) both need this same correction kept too,
      // or they'd go stale next to Total Time's own corrected number.
      var correctedFinishTimeSeconds = (row.finishTimeSeconds === null || row.finishTimeSeconds === undefined)
        ? row.finishTimeSeconds
        : (row.finishTimeSeconds + penSeconds);
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-num', _rclFormatTotalTime_(correctedFinishTimeSeconds)));
      var prevRow = idx > 0 ? standings[idx - 1] : null;
      var prevPenSeconds = (prevRow && prevRow.profileId) ? (penSecondsByProfileId[prevRow.profileId] || 0) : 0;
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-gap', _rclFormatInterval_(row, prevRow, penSeconds, prevPenSeconds)));
      var leaderPenSeconds = (leaderRow && leaderRow.profileId) ? (penSecondsByProfileId[leaderRow.profileId] || 0) : 0;
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-gap', _rclFormatGap_(row, leaderRow, penSeconds, leaderPenSeconds)));
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-avg', _rclFormatAvgSpeed_(row, result.trackLengthMeters)));
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-bestlap', _rclFormatLapTime_(row.bestLapTime)));
      // PTS (2026-09-26, Matt's ask) -- points earned THIS race, already
      // includes any bonus points (pole/fastest lap/most laps led) --
      // row.points is the same adjusted-per-round total
      // _rcRecomputeStandingsCacheFromRound_ writes to StandingsCache
      // (Results.gs), which already folds bonus points into the total
      // before it's ever stored, same field Recent Results' own Pts
      // column (_rclRenderResults above) reads.
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-pts', (row.points !== null && row.points !== undefined) ? ('+' + row.points) : '--'));
      clsWrap.appendChild(rowEl);
    });
    bodyEl.appendChild(clsWrap);
  });

  // "*PRELIMINARY RESULTS (date)"/"*OFFICIAL RESULTS (date)" notice
  // (2026-09-26, Matt's ask: "add the same *PRELIMINARY and *OFFICIAL
  // RESULTS notifications below the bottom table and above the gray
  // line") -- sits right here, after the last class table and before
  // Race Report/Penalties Assessed below, both of which already draw
  // their own border-top divider line (.rcl-report-section/
  // .rcl-penalties-section) -- whichever renders next (Race Report, or
  // straight to Penalties Assessed on a round with no report) already
  // supplies "the gray line" this notice needs to sit above.
  var allResultsNotice = _rclBuildResultsStatusNotice_(result);
  if (allResultsNotice) bodyEl.appendChild(allResultsNotice);
  // Mobile-only "view on PC" nudge (see _rclBuildMobileViewOnPcNote_ above
  // for the full history) -- the standings grid above collapses down to
  // just Pos/Driver/Pts on phone widths (see .rcl-race-grid-allresults'
  // mobile override, league.css), so a phone visitor is told there's more
  // detail (Laps/Total Time/Pen/Gap/Avg/Best Lap) on a bigger screen.
  bodyEl.appendChild(_rclBuildMobileViewOnPcNote_());

  // Race Report -- lap-by-lap highlights (2026-09-24, Matt's ask: "a
  // lap-by-lap race report to post under the ALL RESULTS standings").
  // Built once at import time from the XML's own lap/event data
  // (_rcBuildRaceReportForSession_, Ingestion.gs) and just rendered here,
  // grouped by lap number for readability. Empty for a round imported
  // before this feature existed (blank RaceReportJson), or for a Qualify-
  // only round -- either way, the section is simply skipped rather than
  // showing an empty state, since "no report" isn't something to flag the
  // same way "no penalties" is.
  var report = result.raceReport || [];
  if (report.length) {
    var reportSection = _rclEl('div', 'rcl-report-section');
    reportSection.appendChild(_rclEl('div', 'rcl-race-class-name', 'Race Report'));
    var byLap = {};
    var lapOrder = [];
    report.forEach(function (entry) {
      if (!byLap[entry.lapNum]) { byLap[entry.lapNum] = []; lapOrder.push(entry.lapNum); }
      byLap[entry.lapNum].push(entry);
    });
    // Clause kind -> the CSS class that colors it (2026-09-24, Matt's
    // ask). "penalty" stays the line's default dim-gray on purpose --
    // everything else called out gets its own color.
    var CLAUSE_CLASS = {
      wall: 'rcl-report-clause-wall',
      car: 'rcl-report-clause-car',
      damage: 'rcl-report-clause-damage',
      pit: 'rcl-report-clause-pit',
      position_gain: 'rcl-report-clause-gain',
      position_loss: 'rcl-report-clause-loss',
      retirement: 'rcl-report-clause-retirement',
      fastest_lap: 'rcl-report-clause-fastest'
    };
    lapOrder.forEach(function (lapNum) {
      var lapRow = _rclEl('div', 'rcl-report-lap');
      lapRow.appendChild(_rclEl('div', 'rcl-report-lap-num', 'Lap ' + lapNum));
      var textWrap = _rclEl('div', 'rcl-report-lap-text');
      byLap[lapNum].forEach(function (entry) {
        var lineEl = _rclEl('p', 'rcl-report-line');
        if (entry.clauses) {
          // Structured entry (2026-09-24+) -- render each clause as its
          // own span so wall/car/damage/pit/position clauses can be
          // colored independently of the rest of the line.
          //
          // Driver names always render white (2026-09-24, Matt's follow-up
          // ask: "make all names white, even when in the middle of a
          // contact report with another driver" -- an earlier version kept
          // a wall-hit line's name gray to read as deemphasized, but that
          // made names inconsistent line to line, which read worse than it
          // helped).
          // Class pill (2026-09-24, Matt's ask: "put class pill
          // information HY, LMGT3, LMGTE, LMP2 and LMP3 in front of the
          // records") -- same colored-chip convention as every other class
          // pill on the site (rc-badge-chip + its color class, style.css),
          // just built by hand here since only Account.html/index.html
          // have the shared _rcClassAbbrevPill helper in scope.
          if (entry.carClass) lineEl.appendChild(_rclClassPill_(entry.carClass));
          // Timestamp (2026-09-24, Matt's ask: "give timestamp information
          // for the event") -- the earliest underlying event's elapsed
          // race time, mm:ss (or h:mm:ss past the hour mark).
          if (entry.et !== null && entry.et !== undefined) {
            lineEl.appendChild(_rclEl('span', 'rcl-report-timestamp', _rclFormatEventTime_(entry.et)));
          }
          var nameEl = document.createElement('span');
          nameEl.className = 'rcl-report-name';
          nameEl.textContent = entry.name;
          lineEl.appendChild(nameEl);
          var allClauses = entry.positionClause ? entry.clauses.concat([entry.positionClause]) : entry.clauses;
          allClauses.forEach(function (clause, i) {
            lineEl.appendChild(document.createTextNode(i === 0 ? ' ' : ', '));
            var cls = CLAUSE_CLASS[clause.kind];
            if (cls) {
              // Built by hand rather than via _rclEl -- that helper sets
              // innerHTML, and clause.text (driver-supplied names can
              // flow into it via "contact with X") must never be parsed
              // as markup.
              var span = document.createElement('span');
              span.className = cls;
              span.textContent = clause.text;
              lineEl.appendChild(span);
            } else {
              lineEl.appendChild(document.createTextNode(clause.text));
            }
          });
          lineEl.appendChild(document.createTextNode('.'));
        } else {
          // A round imported before clause tagging shipped -- entry only
          // has a flat `text` string. Fall back to the old plain render.
          lineEl.textContent = entry.text;
        }
        textWrap.appendChild(lineEl);
      });
      lapRow.appendChild(textWrap);
      reportSection.appendChild(lapRow);
    });
    bodyEl.appendChild(reportSection);
  }

  // Penalties Assessed -- this round's Adjustments, resolved to driver
  // names. This is the one and only place a round's penalties render on
  // the League Hub (Matt's placement call, see this section's header
  // comment above).
  //
  // Redesigned 2026-09-26 (Matt's ask, item 20) to read like a Race Report
  // line instead of its own plain name/detail row: a lap-number-style
  // label in the position slot ("Pre"/"Post"/"Lap N"), then a class pill,
  // the driver's name bold white (same .rcl-report-name treatment a Race
  // Report line uses), the infraction described in that same plain dim
  // line style ("hits a wall or track object"'s own font treatment, no
  // extra color), and the penalty itself in bold red.
  var penSection = _rclEl('div', 'rcl-penalties-section');
  penSection.appendChild(_rclEl('div', 'rcl-race-class-name', 'Penalties Assessed'));
  var penalties = result.penalties || [];
  if (!penalties.length) {
    penSection.appendChild(_rclEl('div', 'rcl-empty-state-subtitle', 'No penalties were assessed for this round.'));
  } else {
    penalties.forEach(function (p) {
      var row = _rclEl('div', 'rcl-report-lap');
      // "Pre"/"Post" (2026-09-26, Matt's ask -- not the full "Pre-race"/
      // "Post-race" the lap dropdown itself shows, just the short form in
      // this position slot) or "Lap N" for a normal numeric lap; "-" for a
      // pre-existing Adjustments row from before LapNumber was tracked.
      var lapVal = p.lapNumber;
      var posLabel = (lapVal === 'Pre-race') ? 'Pre' : (lapVal === 'Post-race') ? 'Post' :
        (lapVal ? ('Lap ' + lapVal) : '-');
      row.appendChild(_rclEl('div', 'rcl-report-lap-num', posLabel));
      var textWrap = _rclEl('div', 'rcl-report-lap-text');
      var lineEl = _rclEl('p', 'rcl-report-line');
      if (p.carClass) lineEl.appendChild(_rclClassPill_(p.carClass));
      var name = (p.against && namesByProfileId[p.against]) || 'Unknown Driver';
      var nameEl = document.createElement('span');
      nameEl.className = 'rcl-report-name';
      nameEl.textContent = name;
      lineEl.appendChild(nameEl);
      // Format fixed 2026-09-26 (Matt's ask -- the tier label already
      // spells out its own seconds, e.g. "Tier 3: Time Penalty (10s)", so
      // pairing that as-is with the effect span produced a redundant
      // "Time Penalty (10s) (+10s)". Strip that "(Ns)" suffix off the tier
      // phrase (it's the same number the red effect span already shows)
      // and turn "Tier 3: Time Penalty" into "Tier 3 Time Penalty" so the
      // whole line reads "Intentional Wrecking: Tier 3 Time Penalty
      // (+10s)".
      var tierInfo = (typeof penaltyTierByNumber === 'function') ? penaltyTierByNumber(p.penaltyTier) : null;
      var tierPhrase = tierInfo
        ? tierInfo.label.replace(/^Tier (\d+): /, 'Tier $1 ').replace(/\s*\([^)]*\)\s*$/, '')
        : ('Tier ' + (p.penaltyTier || '?'));
      // Self-report wording (2026-09-26, Matt's ask: "mimic this on the
      // penalties assessed list" -- same self-report phrasing Account.html's
      // Dashboard/Protests popup and the League Management ruling popup all
      // use now) -- "self-reported an incident" in place of the raw
      // infraction-type label. The name above is already the FILER's own
      // (Protests.gs's handleAdminRuleOnProtest always docks the filer
      // themselves for this infraction type, never the other driver they
      // named as involved), so this line reads "<filer> self-reported an
      // incident: Tier N Time Penalty (+Ns)" end to end.
      var infractionPhrase = (p.infractionType === 'Avoidable Contact (Self Report)')
        ? 'self-reported an incident'
        : (p.infractionType || 'Infraction');
      lineEl.appendChild(document.createTextNode(' ' + infractionPhrase + ': ' + tierPhrase + ' '));
      var effectSpan = document.createElement('span');
      effectSpan.className = 'rcl-penalty-effect';
      effectSpan.textContent = '(' + _rclDescribePenaltyEffect_(p.effectType, p.effectSeconds) + ')';
      lineEl.appendChild(effectSpan);
      textWrap.appendChild(lineEl);
      row.appendChild(textWrap);
      penSection.appendChild(row);
    });
  }
  bodyEl.appendChild(penSection);
}

// Qualifying tab of "All Results" (2026-09-26, Matt's ask: "the results
// that show are every driver's best qualifying lap time, their sector
// times from that lap and avg km/h" -- times in MM:SS:milliseconds, same
// _rclFormatLapTime_ every other lap time on this page already uses).
// Consumes handleGetPublicRoundQualifying's result shape (Website.gs):
// { roundId, roundNum, eventName, track, hasQualifying, classes: [{
// className, standings: [{ profileId, name, carNumber, teamName, carClass,
// qualifyingPos, bestLapTime, sector1, sector2, sector3, avgKmh }] }] }.
// A qualifying row has no country/manufacturer fields the way a race
// result row does -- _rclBuildDriverIdentity_ already handles either being
// absent (it only renders the flag/logo when the field is present), so no
// changes were needed there.
function _rclBuildQualifyingBody_(result, bodyEl) {
  bodyEl.innerHTML = '';
  if (!result) {
    bodyEl.appendChild(_rclEmptyState('No Data To Display', 'No posted results for that round.'));
    return;
  }

  // The event title line (and its Winner/Pole/Fastest Lap headline on the
  // Race tab) is gone entirely as of 2026-10-01 (Matt's ask: "having the
  // title of the event above the leaderboards is redundant since it lives
  // in the drop down box which is also viewable" -- the round select
  // above already reads "Round n - EventName: Track (Date)", same info
  // this line used to repeat). .rcl-allresults-select-row's own
  // margin-bottom (css/league.css) is what supplies the breathing room
  // before the standings start now; .rcl-qualifying-title-divider (which
  // used to do that job) is removed along with this.

  if (!result.hasQualifying || !(result.classes || []).length) {
    bodyEl.appendChild(_rclEmptyState('No Qualifying Data', 'No qualifying session was imported for this round.'));
    return;
  }

  // Classes arrive pre-sorted Hypercar -> LMP2 -> LMP3 -> LMGT3 -> LMGTE
  // (CAR_CLASS_CANONICAL_ORDER_, Website.gs), same convention as the Race
  // view above.
  result.classes.forEach(function (cls) {
    var clsWrap = _rclEl('div', 'rcl-race-class');
    clsWrap.appendChild(_rclEl('div', 'rcl-standings-class-header', (cls.className || 'CLASS').toUpperCase() + ' QUALIFYING'));

    var headRow = _rclEl('div', 'rcl-race-col-head rcl-race-grid-qualifying');
    headRow.appendChild(_rclEl('div', null, 'Pos'));
    headRow.appendChild(_rclEl('div', null, 'Driver'));
    headRow.appendChild(_rclEl('div', null, 'Best Lap'));
    headRow.appendChild(_rclEl('div', null, 'Sector 1'));
    headRow.appendChild(_rclEl('div', null, 'Sector 2'));
    headRow.appendChild(_rclEl('div', null, 'Sector 3'));
    headRow.appendChild(_rclEl('div', null, 'Avg (KM/H)'));
    clsWrap.appendChild(headRow);

    var standings = cls.standings || [];
    if (!standings.length) {
      clsWrap.appendChild(_rclEl('div', 'rcl-empty-state-subtitle', 'No qualifying times posted for this class.'));
    }
    standings.forEach(function (row, idx) {
      var rowEl = _rclEl('div', 'rcl-race-row rcl-race-grid-qualifying' + (RCL_POS_METAL_CLASS_[idx] ? ' ' + RCL_POS_METAL_CLASS_[idx] : ''));
      rowEl.appendChild(_rclBuildPosBadge_(idx));
      rowEl.appendChild(_rclBuildDriverIdentity_(row));
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-bestlap', _rclFormatLapTime_(row.bestLapTime)));
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-num', _rclFormatLapTime_(row.sector1)));
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-num', _rclFormatLapTime_(row.sector2)));
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-num', _rclFormatLapTime_(row.sector3)));
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-avg', (row.avgKmh !== null && row.avgKmh !== undefined) ? String(row.avgKmh) : '--'));
      clsWrap.appendChild(rowEl);
    });
    bodyEl.appendChild(clsWrap);
  });
}

// preselectRoundId (added 2026-10-02, optional) -- when a caller already
// knows which round the viewer wants (the Calendar's own "VIEW RESULTS"
// link on a specific completed round, see _rclRenderCalendar below), that
// round loads first instead of this popup's old default of always starting
// on the most recently completed round (rounds[0]). Omitted/unmatched
// falls back to that same original behavior unchanged.
function _rclOpenAllResultsModal(hub, preselectRoundId) {
  var rounds = hub.resultsRounds || [];
  if (!rounds.length) return;

  var overlay = _rclEl('div', 'rcl-modal-overlay');
  // rcl-modal-dialog-allresults (2026-09-27) -- a scoping class just for
  // this popup's own mobile overrides (hiding team names, trimming the
  // standings grid down to Pos/Driver/Pts) so they don't also apply to
  // every OTHER popup that reuses .rcl-modal-dialog-wide or
  // _rclBuildDriverIdentity_'s shared .rcl-standings-team markup (Drivers
  // roster, Points Tables -- both of which Matt confirmed "look good,
  // don't change").
  var dialog = _rclEl('div', 'rcl-modal-dialog rcl-modal-dialog-wide rcl-modal-dialog-allresults');
  var head = _rclEl('div', 'rcl-modal-head');
  // "Race Details" (2026-10-02, Matt's ask -- was "All Results"). Purely a
  // label change: still the exact same popup, same dropdown, same
  // Qualifying/Race toggle, same underlying data/endpoints.
  head.appendChild(_rclEl('div', 'rcl-modal-title', 'Race Details'));
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
    // "<Round n> - <EventName>: <track> (Date)" (2026-09-23 correction,
    // Matt's exact format; spacer changed from 3 plain spaces to " - "
    // 2026-09-26, Matt's ask: "add a hyphen in between round and event
    // name so it looks like this: Round 1 - Ten10 Motorsports Sprint...").
    var label = (r.roundNum ? 'Round ' + r.roundNum + ' - ' : '') + (r.eventName || r.roundId);
    if (r.track) label += ': ' + r.track;
    if (r.startUtc) label += ' (' + _rclFormatDate(r.startUtc) + ')';
    opt.textContent = label;
    select.appendChild(opt);
  });
  selectRow.appendChild(select);

  // Qualifying/Race toggle (2026-09-26, Matt's ask: "to the right of that
  // box, make a dropdown box that says Qualifying and Race. Have it
  // default on race.") -- sits beside the round select in the same row
  // (.rcl-allresults-select-row is now a flex row, see league.css).
  // Switching either dropdown re-loads via the shared load() below.
  var sessionSelect = document.createElement('select');
  sessionSelect.className = 'rcl-allresults-session-select';
  sessionSelect.appendChild(new Option('Race', 'race'));
  sessionSelect.appendChild(new Option('Qualifying', 'qualifying'));
  sessionSelect.value = 'race';
  selectRow.appendChild(sessionSelect);
  body.appendChild(selectRow);

  var resultsWrap = _rclEl('div', 'rcl-allresults-body');
  body.appendChild(resultsWrap);
  dialog.appendChild(body);
  overlay.appendChild(dialog);

  // In-memory cache, this popup instance only (2026-09-26, Matt's ask:
  // "once results are loaded, don't make it have to load again switching
  // from race to qualifying and qualifying to race -- it should already
  // have been loaded"). Keyed by "<roundId>:<sessionKind>" so each
  // round/session combination is fetched at most once per time this popup
  // is opened; a fresh open of the popup (_rclOpenAllResultsModal called
  // again) starts with an empty cache, so a result finalized/edited since
  // the driver last opened this popup is never shown stale.
  var resultCache = {};

  function loadRound(roundId, sessionKind) {
    var cacheKey = roundId + ':' + sessionKind;
    var isQualifying = sessionKind === 'qualifying';
    var builder = isQualifying ? _rclBuildQualifyingBody_ : _rclBuildAllResultsBody_;
    if (Object.prototype.hasOwnProperty.call(resultCache, cacheKey)) {
      builder(resultCache[cacheKey], resultsWrap);
      return;
    }
    resultsWrap.innerHTML = '';
    // Standard site loading animation (2026-09-24, Matt's ask) -- the same
    // "starting grid lights" markup as the full-page loader
    // (.rcl-page-loader in league.html) and the Edit Profile popup on this
    // same page (rcOpenEditProfileModalInPlace, edit-profile.js), not the
    // plain "Loading..." text this popup used before. .rcl-modal-dialog's
    // own dark-theme override of .rc-inline-spinner-wrap/.rc-startlights/
    // .rc-loading-text (league.css) already covers this markup, so no new
    // CSS is needed here.
    resultsWrap.appendChild(_rclBuildInlineSpinner_(isQualifying ? 'Loading qualifying results...' : 'Loading round results...'));
    if (isQualifying) {
      // getPublicRoundQualifying (2026-09-26) -- a separate endpoint from
      // getPublicRoundResults below, since a Qualify session's data (best
      // lap + sectors, no finish position/gap/interval) has almost
      // nothing in common with a Race session's row shape.
      fetchApi('getPublicRoundQualifying', { params: { roundId: roundId }, timeoutMs: RC_FETCH_TIMEOUT_MS_LONG }).then(function (res) {
        var result = (res && res.success) ? res.result : null;
        resultCache[cacheKey] = result;
        _rclBuildQualifyingBody_(result, resultsWrap);
      }).catch(function () {
        _rclBuildQualifyingBody_(null, resultsWrap);
      });
      return;
    }
    // BUG FIX (2026-09-23 audit): roundId was passed as a bare options
    // field instead of inside options.params, so fetchApi never actually
    // put it on the URL -- the server always saw a missing roundId and
    // returned MISSING_ROUND_ID, meaning "View All Results" on
    // league.html could never actually show a round's results. Same
    // class of bug as the getCareerSeasonRaceDetail fix in Account.html.
    fetchApi('getPublicRoundResults', { params: { roundId: roundId }, timeoutMs: RC_FETCH_TIMEOUT_MS_LONG }).then(function (res) {
      var result = (res && res.success) ? res.result : null;
      resultCache[cacheKey] = result;
      _rclBuildAllResultsBody_(result, resultsWrap);
    }).catch(function () {
      _rclBuildAllResultsBody_(null, resultsWrap);
    });
  }

  select.addEventListener('change', function () { loadRound(select.value, sessionSelect.value); });
  sessionSelect.addEventListener('change', function () { loadRound(select.value, sessionSelect.value); });

  // Only honor preselectRoundId if it's actually one of this popup's own
  // round options -- a stale/unknown id just falls through to the original
  // "most recent round" default below.
  var initialRoundId = (preselectRoundId && rounds.some(function (r) { return r.roundId === preselectRoundId; }))
    ? preselectRoundId
    : rounds[0].roundId;
  select.value = initialRoundId;
  loadRound(initialRoundId, sessionSelect.value);

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
// RACE CAROUSEL -- replaces the Calendar panel entirely (2026-10-02,
// Matt's ask: "build a better calendar section... on the fiawec.com
// website, the calendar there is pretty sweet. It looks like it's a
// carousal... clicking on one of the races off to the side centers it and
// opens it up to see results or race information" -- reference images of
// fiawec.com's own race strip supplied). Renders into #rcl-race-carousel
// (league.html), which is deliberately NOT a .rcl-panel and is allowed to
// bleed past .rcl-main's max-width (see .rcl-carousel-outer's breakout
// rule, css/league.css) so the strip can run the full width of the
// viewport, exactly like the reference.
//
// Resolved via AskUserQuestion before building (Matt's exact answers):
// - Scope: replaces the Calendar panel outright, not an addition next to
//   it.
// - No Replay/video button -- RACE INFO and RACE RECAP only.
// - RACE INFO opens a popup with track + season format/rules info
//   (_rclOpenRaceInfoModal below, reusing _rclBuildSeasonFormatBlocks_'s
//   Season Format + Season Rules sections -- NOT Championship Points,
//   which isn't "format and rules"). RACE RECAP reuses the existing Race
//   Details results popup (_rclOpenAllResultsModal), preselected to that
//   round.
// - Stays a touch-swipeable carousel on mobile (plain horizontal
//   overflow-x scroll already is).
//
// Bye weeks are left out of the strip entirely -- there's no race to
// show for a week off, and FIAWEC's own calendar doesn't carry blank
// weeks either. The round nearest "now" that hasn't happened yet opens as
// the initially-centered/expanded item, same "UP NEXT" convention the old
// calendar used.
// Live DAYS:HOURS:MIN:SEC countdown block (2026-10-02 follow-up, Matt's
// ask, fiawec.com reference image supplied: "add a countdown timer like
// the one here, but instead of 'PRACTICE 1' it would say EVENT" -- same
// "COUNTDOWN TO <thing>" caption + four boxed unit/label pairs the
// reference uses, just counting down to the round's own start time
// (entry.startUtc) instead of a practice session Race Club doesn't track
// separately here). Ticks every second via setInterval; the caller is
// responsible for clearing it (see _rclCarouselCountdownTimers_ above) --
// this function only ever starts one.
// Live DAYS:HOURS:MIN:SEC countdown block. `onComplete`, when given, fires
// ONCE the instant the countdown reaches zero (2026-10-03 follow-up,
// Matt's ask: "once a race's timer hits zero, a disabled RACE RECAP
// button appears" -- this has to happen live, the moment the ticking
// countdown itself hits 0:00:00:00, not just on the carousel's next full
// re-render from a hub refresh). Stops its own interval right after
// firing onComplete -- there's nothing left to count down.
function _rclBuildCountdown_(startUtc, onComplete) {
  var wrap = _rclEl('div', 'rcl-carousel-countdown');
  wrap.appendChild(_rclEl('div', 'rcl-carousel-countdown-label', 'Countdown to <strong>Event</strong>'));
  var unitsRow = _rclEl('div', 'rcl-carousel-countdown-units');
  wrap.appendChild(unitsRow);

  var UNITS = [
    { key: 'd', label: 'Days' },
    { key: 'h', label: 'Hours' },
    { key: 'm', label: 'Min' },
    { key: 's', label: 'Sec' }
  ];
  var numEls = {};
  UNITS.forEach(function (u, i) {
    if (i > 0) unitsRow.appendChild(_rclEl('span', 'rcl-carousel-countdown-sep', ':'));
    var unitEl = _rclEl('div', 'rcl-carousel-countdown-unit');
    var numEl = _rclEl('div', 'rcl-carousel-countdown-num', '00');
    unitEl.appendChild(numEl);
    unitEl.appendChild(_rclEl('div', 'rcl-carousel-countdown-unitlabel', u.label));
    unitsRow.appendChild(unitEl);
    numEls[u.key] = numEl;
  });

  var targetMs = new Date(startUtc).getTime();
  var timerId = null;
  function tick() {
    var remaining = targetMs - Date.now();
    var done = remaining <= 0;
    if (done) remaining = 0;
    var days = Math.floor(remaining / 86400000);
    var hours = Math.floor((remaining % 86400000) / 3600000);
    var mins = Math.floor((remaining % 3600000) / 60000);
    var secs = Math.floor((remaining % 60000) / 1000);
    numEls.d.textContent = String(days);
    numEls.h.textContent = ('0' + hours).slice(-2);
    numEls.m.textContent = ('0' + mins).slice(-2);
    numEls.s.textContent = ('0' + secs).slice(-2);
    if (done) {
      if (timerId !== null) {
        clearInterval(timerId);
        var pos = _rclCarouselCountdownTimers_.indexOf(timerId);
        if (pos !== -1) _rclCarouselCountdownTimers_.splice(pos, 1);
        timerId = null;
      }
      if (onComplete) onComplete();
    }
  }
  tick();
  if (timerId === null && targetMs - Date.now() > 0) {
    // Only actually schedule ticking if tick() above didn't already fire
    // onComplete synchronously (a race whose start time is already in the
    // past the instant this renders).
    timerId = setInterval(tick, 1000);
    _rclCarouselCountdownTimers_.push(timerId);
  }

  return wrap;
}

// Builds the RACE RECAP slot for a finished race: a disabled (unclickable,
// dimmed) button once the race has happened but results aren't imported
// yet, or the normal active button once they are (2026-10-03 follow-up,
// Matt's exact spec: "once a race's timer hits zero, a disabled RACE
// RECAP button appears. After the results get's uploaded, the button
// becomes active.").
function _rclBuildRecapButton_(hub, entry) {
  var hasResults = !!(entry.hasResults && entry.roundId);
  var btn = _rclEl('button', 'rcl-carousel-hero-btn' + (hasResults ? '' : ' rcl-carousel-hero-btn-disabled'), 'RACE RECAP');
  btn.type = 'button';
  if (!hasResults) {
    btn.disabled = true;
  } else {
    btn.addEventListener('click', function (evt) {
      evt.stopPropagation();
      _rclOpenAllResultsModal(hub, entry.roundId);
    });
  }
  return btn;
}

function _rclRenderRaceCarousel(hub) {
  var outer = document.getElementById('rcl-race-carousel');
  if (!outer) return;
  outer.innerHTML = '';

  // Clear every countdown interval the PREVIOUS render of this carousel
  // started -- outer.innerHTML='' above already removed their DOM, but an
  // interval keeps firing against detached elements forever otherwise.
  _rclCarouselCountdownTimers_.forEach(function (id) { clearInterval(id); });
  _rclCarouselCountdownTimers_.length = 0;

  var raceEntries = (hub.hasSeason && hub.calendar) ? hub.calendar.filter(function (e) { return e.kind !== 'bye'; }) : [];
  if (!raceEntries.length) {
    outer.appendChild(_rclEmptyState('No Data To Display', 'The season schedule shows up here once it is set.'));
    return;
  }

  var nextIdx = -1;
  raceEntries.forEach(function (entry, idx) { if (nextIdx === -1 && !entry.finished) nextIdx = idx; });
  var activeIdx = nextIdx === -1 ? (raceEntries.length - 1) : nextIdx;

  var track = _rclEl('div', 'rcl-carousel-track');
  outer.appendChild(track);

  var itemEls = [];

  function setActive(idx) {
    activeIdx = idx;
    itemEls.forEach(function (itemEl, i) {
      itemEl.classList.toggle('rcl-carousel-item-active', i === idx);
    });
    itemEls[idx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  // Redesigned 2026-10-03 (Matt's exact spec, with a worked example):
  // flag, then three always-visible header lines -- event name (medium
  // weight, white, slightly smaller than the track name), track name
  // (extra heavy weight, white, larger), date/time (extra light weight,
  // red, same size as the event name) -- then, active-item-only, two
  // lightest-weight small light-gray all-caps "race details" lines (time
  // of day + session length, then weather) and finally the button slot.
  // The header lines used to split across a compact "stub" (flag/name/
  // round+date) and only the active item's "hero" got the full track
  // name + full date -- now every item shows the full flag/name/track/
  // date header at all times (just smaller when compact), and only the
  // race-details-and-button section is active-item-only, per Matt's
  // worked example showing that header content unconditionally.
  raceEntries.forEach(function (entry, idx) {
    var isSpecial = entry.kind === 'special';
    var isActive = idx === activeIdx;
    var item = _rclEl('div', 'rcl-carousel-item' +
      (isActive ? ' rcl-carousel-item-active' : '') +
      (isSpecial ? ' rcl-carousel-item-special' : '') +
      (entry.finished ? ' rcl-carousel-item-finished' : ''));
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');

    var header = _rclEl('div', 'rcl-carousel-header');
    if (entry.country && typeof countryFlagSrc === 'function') {
      var flagSrc = countryFlagSrc(entry.country);
      if (flagSrc) {
        var flagImg = document.createElement('img');
        flagImg.className = 'rcl-carousel-flag';
        flagImg.src = flagSrc;
        flagImg.alt = entry.country;
        flagImg.onerror = function () { flagImg.style.display = 'none'; };
        header.appendChild(flagImg);
      }
    }
    header.appendChild(_rclEl('div', 'rcl-carousel-eventname', _rclEscapeHtml(entry.eventName || 'Race')));
    if (entry.track) header.appendChild(_rclEl('div', 'rcl-carousel-trackname', _rclEscapeHtml(entry.track)));
    if (entry.startUtc) header.appendChild(_rclEl('div', 'rcl-carousel-datetime', _rclEscapeHtml(_rclFormatDateTimeLong_(entry.startUtc))));
    item.appendChild(header);

    // Race details + button -- active-item-only (CSS reveals
    // .rcl-carousel-hero only under .rcl-carousel-item-active). Built
    // every time, not just for the active item, so clicking a side item
    // to make it active never needs a second render pass.
    var hero = _rclEl('div', 'rcl-carousel-hero');

    var detailLines = [];
    var timeOfDay = _rclTimeOfDayLabel_(entry.startUtc);
    var lengthMin = _rclEntryLengthMinutes(entry, hub);
    var sessionBits = [];
    if (entry.raceLengthTier) sessionBits.push(entry.raceLengthTier);
    if (lengthMin) sessionBits.push(lengthMin + ' Mins Long');
    var sessionLine = (timeOfDay ? (timeOfDay + ' Race') : '') + (sessionBits.length ? ((timeOfDay ? ', ' : '') + sessionBits.join(' ')) : '');
    if (sessionLine) detailLines.push(sessionLine);
    if (entry.weather) {
      var weatherLine = entry.weather;
      if (entry.temperatureC !== null && entry.temperatureC !== undefined) weatherLine += ' & ' + entry.temperatureC + '°';
      weatherLine += ' with ' + (entry.chanceOfRain || 0) + '% chance of rain';
      detailLines.push(weatherLine);
    }
    if (detailLines.length) {
      var detailsWrap = _rclEl('div', 'rcl-carousel-details');
      detailLines.forEach(function (line) { detailsWrap.appendChild(_rclEl('div', 'rcl-carousel-details-line', _rclEscapeHtml(line))); });
      hero.appendChild(detailsWrap);
    }

    // RACE INFO button removed from the carousel (2026-10-03 follow-up,
    // Matt's ask: "Remove race info button. I'll find a place for the
    // season details to live. For now, keep the popup and format and I'll
    // reference it later"). _rclOpenRaceInfoModal below is intentionally
    // left in place, unreferenced from here, for Matt to wire up to
    // wherever he decides this content should live next -- do not delete
    // it as dead code.
    var btnRow = _rclEl('div', 'rcl-carousel-hero-btns');

    // The RACE RECAP slot -- three states (2026-10-03, Matt's exact spec):
    // a live countdown while the race hasn't happened yet; a disabled
    // RACE RECAP button the instant that countdown hits zero (whether
    // that's because the page loaded after the race already started, or
    // because the countdown ticked down to it live -- see
    // _rclBuildCountdown_'s onComplete above); the normal clickable RACE
    // RECAP button once results are actually in.
    if (!entry.finished && entry.startUtc) {
      var recapSlot = _rclEl('div', 'rcl-carousel-recap-slot');
      recapSlot.appendChild(_rclBuildCountdown_(entry.startUtc, function () {
        recapSlot.innerHTML = '';
        recapSlot.appendChild(_rclBuildRecapButton_(hub, entry));
      }));
      btnRow.appendChild(recapSlot);
    } else {
      btnRow.appendChild(_rclBuildRecapButton_(hub, entry));
    }
    hero.appendChild(btnRow);
    item.appendChild(hero);

    item.addEventListener('click', function () { if (idx !== activeIdx) setActive(idx); });
    item.addEventListener('keydown', function (evt) {
      if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); setActive(idx); }
    });

    itemEls.push(item);
    track.appendChild(item);
  });

  // Center the initially-active item without an animated scroll (an
  // animated auto-scroll firing the instant the page loads would be
  // jarring) -- rAF so layout/widths (the active item is wider than the
  // rest) have settled first.
  requestAnimationFrame(function () {
    if (itemEls[activeIdx]) itemEls[activeIdx].scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
  });
}

// RACE INFO popup (2026-10-02, opened from a carousel item's own RACE INFO
// button above) -- this specific round's own track/session details up
// top ("This Race"), then the season's Season Format + Season Rules
// sections reused as-is from _rclBuildSeasonFormatBlocks_. Deliberately
// excludes that function's "Championship Points" section -- Matt's own
// answer to what RACE INFO should show was "information about the track,
// the format and rules," which Championship Points isn't; that's still
// reachable from the separate "View Season Details" link/popup.
function _rclOpenRaceInfoModal(hub, entry) {
  var overlay = _rclEl('div', 'rcl-modal-overlay');
  var dialog = _rclEl('div', 'rcl-modal-dialog');
  var head = _rclEl('div', 'rcl-modal-head');
  head.appendChild(_rclEl('div', 'rcl-modal-title', 'Race Info'));
  var closeBtn = _rclEl('button', 'rcl-modal-close', '&times;');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  head.appendChild(closeBtn);
  dialog.appendChild(head);

  var body = _rclEl('div', 'rcl-modal-body');

  // Same plain "Category: Value" row shape _rclOpenSeasonDetailsModal uses
  // (see that function's own comment for why) -- duplicated here rather
  // than shared since it's a few lines and each popup builds its own body
  // independently.
  function buildRow(stat) {
    var html = '<span class="rcl-seasonfmt-row-label">' + _rclEscapeHtml(stat.label) + ':</span> ' +
      '<span class="rcl-seasonfmt-row-value">' + _rclEscapeHtml(stat.value) + '</span>';
    return _rclEl('div', 'rcl-seasonfmt-row', html);
  }

  var roundRows = [];
  roundRows.push({ label: 'Event', value: entry.eventName || 'Race' });
  if (entry.track) roundRows.push({ label: 'Track', value: entry.track + (entry.layout ? (': ' + entry.layout) : '') });
  if (entry.startUtc) roundRows.push({ label: 'Date', value: _rclFormatDateTime(entry.startUtc) });
  if (entry.raceLengthTier) {
    roundRows.push({ label: 'Race Length', value: entry.raceLengthTier + (entry.raceLengthMinutes ? (' (' + entry.raceLengthMinutes + ' mins)') : '') });
  }
  if (entry.igRaceStart) roundRows.push({ label: 'In-Game Event Time', value: _rclFormat12h(entry.igRaceStart) });
  if (entry.weather) {
    var weatherText = (entry.chanceOfRain || 0) + '% Rain';
    if (entry.temperatureC !== null && entry.temperatureC !== undefined) weatherText += ' · ' + entry.temperatureC + '°C';
    roundRows.push({ label: 'Weather', value: weatherText });
  }
  var roundGroup = _rclEl('div', 'rcl-hero-stats-group');
  roundGroup.appendChild(_rclEl('div', 'rcl-hero-stats-label', 'This Race'));
  var roundList = _rclEl('div', 'rcl-seasonfmt-list');
  var roundBlock = _rclEl('div', 'rcl-seasonfmt-block');
  roundRows.forEach(function (stat) { roundBlock.appendChild(buildRow(stat)); });
  roundList.appendChild(roundBlock);
  roundGroup.appendChild(roundList);
  body.appendChild(roundGroup);

  var sections = _rclBuildSeasonFormatBlocks_(hub).filter(function (s) { return s.pill === 'Season Format' || s.pill === 'Season Rules'; });
  sections.forEach(function (section) {
    var group = _rclEl('div', 'rcl-hero-stats-group');
    group.appendChild(_rclEl('div', 'rcl-hero-stats-label', section.pill));
    var list = _rclEl('div', 'rcl-seasonfmt-list');
    (section.blocks || []).forEach(function (rows) {
      var blockEl = _rclEl('div', 'rcl-seasonfmt-block');
      rows.forEach(function (stat) { blockEl.appendChild(buildRow(stat)); });
      list.appendChild(blockEl);
    });
    group.appendChild(list);
    body.appendChild(group);
  });

  if (!roundRows.length && !sections.length) {
    body.appendChild(_rclEmptyState('No Data To Display', 'Race info shows up here once it is set.'));
  }

  dialog.appendChild(body);
  overlay.appendChild(dialog);

  // Closable only via the X button -- same posture every other popup on
  // this page uses.
  function close() { document.body.removeChild(overlay); _rclUnlockBodyScroll(); }
  closeBtn.addEventListener('click', close);

  document.body.appendChild(overlay);
  _rclLockBodyScroll();
}

// POINTS -- race-length-tier point tables + bonus points (added
// 2026-09-19, moved into their own "Points Tables" popup off the
// Leaderboard panel same day). Removed 2026-10-01 (Matt's ask) in favor of
// folding Championship Points/Bonus Points straight into the "View Season
// Details" popup's list instead -- see _rclBuildSeasonFormatBlocks_'s
// points block and _rclOpenSeasonDetailsModal above, which read the exact
// same hub.pointsTables/hub.bonusPoints fields this used to.

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
// Rebuilt 2026-10-01 (Matt's ask) from two "bubble" tile groups into one
// single vertical list, under one "Season Format" header -- also folds in
// Championship Points/Bonus Points, previously their own separate "Points
// Tables" popup (now removed, see _rclRenderStandings' old "View Points
// Tables" link). Returns an array of BLOCKS, each rendered with a little
// extra margin-top between blocks (the "blank line" separation in Matt's
// spec) -- a plain block is just { rows: [{label, value}, ...] }; the one
// points block carries its own tiers/bonus shape instead, since it needs
// its own nested tree-sub-rows (Championship Points) and flat rows (Bonus
// Points) rather than one flat run of label/value rows. A row with
// nothing to show is simply skipped, same as the old bubble builders did.
//
// Returns an array of SECTIONS, each its own pill-headed group (2026-10-01
// follow-up, Matt's ask: "Make CHAMPIONSHIP POINTS into a pill that's
// similar to the SEASON FORMAT pill above" / "add a SEASON RULES pill in
// the same style as SEASON FORMAT") -- { pill, blocks: [[{label,value},...]
// ,...] } for a plain section, or { pill, tiers, bonus } for the
// Championship Points section specifically.
function _rclBuildSeasonFormatBlocks_(hub) {
  var rs = hub.raceSettings || {};
  var sections = [];

  // --- Block 1: season snapshot -------------------------------------
  var blocks = [];
  var block1 = [];
  if (hub.seasonStartUtc && hub.seasonEndUtc) {
    var startLabel = _rclFormatDate(hub.seasonStartUtc);
    var endLabel = _rclFormatDate(hub.seasonEndUtc);
    if (startLabel && endLabel) {
      block1.push({ label: 'Season Dates', value: startLabel + (endLabel !== startLabel ? (' - ' + endLabel) : '') });
    }
  }
  if (hub.frequency) block1.push({ label: 'Schedule Frequency', value: hub.frequency });
  // Event Time (added 2026-10-01, was "Race Time" in Matt's first draft of
  // this spec, renamed to "Event Time" mid-build) -- the one recurring
  // local race time + zone the admin set in the Season Creation Wizard
  // (hub.seasonStartTime/hub.enteredTimeZone, see Website.gs), NOT any
  // individual round's own startUtc (those vary round to round and already
  // show on the Calendar below).
  if (hub.seasonStartTime) {
    block1.push({ label: 'Event Time', value: _rclFormat12h(hub.seasonStartTime) + (hub.enteredTimeZone ? (' ' + _rclTzAbbrev_(hub.enteredTimeZone)) : '') });
  }
  if (hub.totalRounds) block1.push({ label: 'Championship Rounds', value: String(hub.totalRounds) });
  // Special Events -- a count of hub.calendar entries of kind 'special'
  // (see _rcBuildSeasonEntries_, Seasons.gs), never surfaced as its own
  // figure before this redesign.
  var specialEventCount = (hub.calendar || []).filter(function (entry) { return entry.kind === 'special'; }).length;
  if (specialEventCount) block1.push({ label: 'Special Events', value: String(specialEventCount) });
  if (hub.dropWeeks) block1.push({ label: hub.dropWeeks === 1 ? 'Drop Week' : 'Drop Weeks', value: String(hub.dropWeeks) });
  if (hub.byeWeeks) block1.push({ label: hub.byeWeeks === 1 ? 'Bye Week' : 'Bye Weeks', value: String(hub.byeWeeks) });
  var classNames = (hub.standings || []).map(function (cls) { return cls.className; }).filter(Boolean);
  if (classNames.length) block1.push({ label: classNames.length === 1 ? 'Class' : 'Classes', value: classNames.join(', ') });
  // "<class> Seats" (2026-10-03, was "<class> Drivers" -- Matt's ask:
  // show how many seats are still OPEN to race, not how many drivers are
  // already signed up) -- hub.availableSeatsByClass is computed
  // server-side (_rcComputeAvailableSeatsByClass_, Website.gs) since it
  // needs Teams/Cars/Registrations data this page never otherwise reads.
  // undefined (not just 0) means this class has no Teams at all for the
  // season (nothing to show); 0 itself is shown -- "0 seats" (full) is
  // meaningful information, unlike the old Drivers row, which hid a class
  // entirely once it had a non-zero count only.
  (hub.standings || []).forEach(function (cls) {
    var available = (hub.availableSeatsByClass || {})[cls.className];
    if (available !== undefined) block1.push({ label: (cls.className || 'Class') + ' Seats', value: String(available) });
  });
  if (block1.length) blocks.push(block1);

  // tables/tierNames computed here (not just inside the Championship
  // Points section below) because block2's own Race Durations row
  // (2026-10-01 follow-up, Matt's ask: "instead of Varies, have it list
  // out the race durations... Sprint MM mins, Medium MM mins, Long MM
  // mins") also reads each tier's duration.
  var tables = hub.pointsTables || {};
  var tierNames = Object.keys(tables).filter(function (name) { return (tables[name].points || []).length; });

  // --- Block 2: session format ---------------------------------------
  var block2 = [];
  if (rs.practiceLengthMin) block2.push({ label: 'Practice Duration', value: rs.practiceLengthMin + ' min' });
  if (rs.qualifyLengthMin) block2.push({ label: 'Qualify Duration', value: rs.qualifyLengthMin + ' min' });
  if (hub.privateQualifying) block2.push({ label: 'Qualifying Type', value: hub.privateQualifying === 'Yes' ? 'Private' : 'Public' });
  // Race Durations -- was a static "Varies" row; now lists each tier's own
  // duration (2026-10-01 follow-up), since that's exactly what "varies"
  // meant -- the tiers' durations themselves live in hub.pointsTables.
  var tiersWithDuration = tierNames.filter(function (name) { return tables[name].duration; });
  if (tiersWithDuration.length) {
    block2.push({
      label: 'Race Durations',
      value: tiersWithDuration.map(function (name) { return name + ' ' + tables[name].duration + ' mins'; }).join(', ')
    });
  } else {
    block2.push({ label: 'Race Duration', value: 'Varies' });
  }
  if (block2.length) blocks.push(block2);
  if (blocks.length) sections.push({ pill: 'Season Format', blocks: blocks });

  // --- Championship Points / Bonus Points ------------------------------
  // Folded in from the old, now-removed standalone "Points Tables" popup
  // (_rclBuildPointsBody) -- same hub.pointsTables/hub.bonusPoints fields.
  // Its own "Championship Points" pill (2026-10-01 follow-up); the tiers
  // render as plain flat rows, bonus categories too, with no "Bonus
  // Points" header of their own -- just a blank gap above them (same
  // follow-up, Matt's ask). Tier rows carry a raw `points` array rather
  // than a pre-joined string (2026-10-01 follow-up, Matt's ask: "make the
  // points... normal weight and keep the positions in front, bold") since
  // the renderer needs each position/value pair separately to bold only
  // the "Pn" part of each one.
  var bonusLabels = { pole: 'Pole Position', fastestLap: 'Fastest Lap', mostLapsLed: 'Most Laps Led' };
  var bonus = hub.bonusPoints || {};
  var bonusKeys = Object.keys(bonusLabels).filter(function (key) { return Number(bonus[key]) > 0; });
  if (tierNames.length || bonusKeys.length) {
    var tiers = tierNames.map(function (tierName) {
      var tier = tables[tierName] || {};
      return { label: tierName, points: tier.points || [] };
    });
    var bonusRows = bonusKeys.map(function (key) {
      return { label: bonusLabels[key], value: '+' + Number(bonus[key]) + ' pts' };
    });
    sections.push({ pill: 'Championship Points', tiers: tiers, bonus: bonusRows });
  }

  // --- Season Rules -----------------------------------------------------
  // Own "Season Rules" pill (2026-10-01 follow-up, Matt's ask), same style
  // as "Season Format"/"Championship Points" above it. "Setups" (was
  // "Setup Rules", same follow-up).
  var block4 = [];
  if (rs.setupRules) block4.push({ label: 'Setups', value: rs.setupRules });
  if (rs.tireWearMultiplier) block4.push({ label: 'Tire Wear', value: rs.tireWearMultiplier });
  if (rs.tireCount) block4.push({ label: 'Tires Allowed', value: String(rs.tireCount) });
  if (rs.fuelMultiplier) block4.push({ label: 'Fuel Multiplier', value: rs.fuelMultiplier });
  if (rs.pitStopReq) block4.push({ label: 'Pitstop Requirements', value: rs.pitStopReq });
  if (hub.trackLimitsPreset) block4.push({ label: 'Track Limits', value: hub.trackLimitsPreset });
  // "Infractions until Drive-Thru" (was "Points until DT", 2026-10-01
  // follow-up, Matt's ask) -- rs.trackLimitPoints, how many track-limit
  // points are allowed before the sim auto-issues a Drive Through penalty
  // (same field this popup used to label just "Pts" next to "Track Limit").
  if (rs.trackLimitPoints) block4.push({ label: 'Infractions until Drive-Thru', value: rs.trackLimitPoints + ' pts' });
  if (block4.length) sections.push({ pill: 'Season Rules', blocks: [block4] });

  return sections;
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
  // (2026-09-19, Matt's call) -- see _rclOpenSeasonDetailsModal below,
  // restored 2026-10-03 as the popup the new SEASON FORMAT tile opens
  // (_rclRenderWebsiteContainers). rcl-hero-sub stays as the plain-text
  // "no season" fallback only.
  var subEl = document.getElementById('rcl-hero-sub');

  if (!hub.hasSeason) {
    // Left blank on purpose (2026-09-27, Matt's call) -- no fallback
    // copy here anymore, the hero band just shows nothing below the
    // logo/title until a season is underway.
    if (subEl) { subEl.textContent = ''; subEl.style.display = 'none'; }
    return;
  }

  if (subEl) subEl.style.display = 'none';
}

// Opens the season snapshot + league format stats in a popup, same
// .rcl-modal-* shell the news story popup uses. Briefly removed entirely
// on 2026-10-02 (Matt's ask: "get rid of view season details", its one
// entry point at the time being a "View Season Details" link at the
// bottom of the race carousel), then restored 2026-10-03 once the new
// SEASON FORMAT tile (_rclRenderWebsiteContainers) needed exactly this
// content back -- the function itself is unchanged from before its
// removal; only its entry point is different now (the tile, not a text
// link on the carousel).
function _rclOpenSeasonDetailsModal(hub) {
  var overlay = _rclEl('div', 'rcl-modal-overlay');
  var dialog = _rclEl('div', 'rcl-modal-dialog');
  var head = _rclEl('div', 'rcl-modal-head');
  // "SEASON FORMAT" (2026-10-03, was "Season Details" -- Matt's ask: the
  // tile that opens this popup is itself labeled SEASON FORMAT, so the
  // popup's own title should match it instead of carrying its old name
  // forward). The inner pill that used to be called "Season Format" is
  // relabeled "Season Details" below (pillDisplayLabel_) so that name
  // isn't lost, just moved -- this is a pure display-text swap, not a
  // rename of the underlying section.pill identifiers themselves (those
  // stay 'Season Format'/'Season Rules' so _rclOpenRaceInfoModal's own
  // filter by that exact string, and _rclBuildSeasonFormatBlocks_ itself,
  // are both untouched).
  head.appendChild(_rclEl('div', 'rcl-modal-title', 'Season Format'));
  var closeBtn = _rclEl('button', 'rcl-modal-close', '&times;');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  head.appendChild(closeBtn);
  dialog.appendChild(head);

  // rcl-seasonfmt-modal-body (2026-10-03) -- scopes the red-header/
  // light-gray-line section styling below (css/league.css) to just this
  // popup, leaving the plain gray-pill .rcl-hero-stats-label look
  // untouched everywhere else it's used (the RACE INFO popup, further up
  // this file).
  var body = _rclEl('div', 'rcl-modal-body rcl-seasonfmt-modal-body');

  // Rebuilt 2026-10-01 (Matt's ask: "remove the bubble data blocks in
  // favor of this more traditional list format") then revised twice more
  // the same day:
  // - Rows are plain "Category: Value" text, left-aligned (Matt's catch:
  //   "I don't want the values to be on one side and the catagory on the
  //   other... category then a colon, then a space and then the value"),
  //   not a two-column layout.
  // - "Championship Points" and "Season Rules" are now each their own
  //   pill-headed section (.rcl-hero-stats-group/-label), same style as
  //   "Season Format" above them, instead of a plain text sub-header
  //   (Matt's ask: "Make CHAMPIONSHIP POINTS into a pill... add a SEASON
  //   RULES pill in the same style"). _rclBuildSeasonFormatBlocks_ returns
  //   one such SECTION per pill now, not a flat list of blocks.
  // - Championship Points' own tier rows (Sprint/Medium/Long) are plain
  //   flat rows too now, no tree indent (2026-10-01 follow-up, Matt's ask:
  //   "get rid of the tree indentation and just make it like the rest --
  //   Sprint: P1 n, P2 n, etc" -- supersedes an even earlier version of
  //   this same day that gave them a tree sub-row). Each tier row bolds
  //   only its "Pn" position markers, leaving the point values themselves
  //   normal weight (2026-10-01 follow-up, Matt's ask: "make the points...
  //   normal weight and keep the positions in front, bold") -- see
  //   buildTierRow below, the one row type that doesn't use the shared
  //   bold-value styling every other row here gets.
  // - "Bonus Points" has no header of its own at all -- just a blank gap
  //   above its own flat rows (Matt's ask: "get rid of that and leave a
  //   space... just list the bonus point catagories and their values").
  function buildRow(stat) {
    var html = '<span class="rcl-seasonfmt-row-label">' + _rclEscapeHtml(stat.label) + ':</span> ' +
      '<span class="rcl-seasonfmt-row-value">' + _rclEscapeHtml(stat.value) + '</span>';
    return _rclEl('div', 'rcl-seasonfmt-row', html);
  }
  function buildTierRow(stat) {
    var pts = (stat.points || []).map(function (val, idx) {
      return '<span class="rcl-seasonfmt-pos">P' + (idx + 1) + '</span> ' + _rclEscapeHtml(String(val));
    }).join(', ');
    var html = '<span class="rcl-seasonfmt-row-label">' + _rclEscapeHtml(stat.label) + ':</span> ' + pts;
    return _rclEl('div', 'rcl-seasonfmt-row', html);
  }

  // Display-only relabeling (2026-10-03, Matt's ask -- see the modal
  // title's own comment above for why this is display text only, not a
  // rename of section.pill itself): "Season Format" -> "Season Details",
  // "Season Rules" -> "Race Rules". Championship Points is unchanged.
  var pillDisplayLabel_ = { 'Season Format': 'Season Details', 'Season Rules': 'Race Rules' };

  var sections = _rclBuildSeasonFormatBlocks_(hub);
  if (sections.length) {
    sections.forEach(function (section) {
      var group = _rclEl('div', 'rcl-hero-stats-group');
      group.appendChild(_rclEl('div', 'rcl-hero-stats-label', pillDisplayLabel_[section.pill] || section.pill));
      var list = _rclEl('div', 'rcl-seasonfmt-list');
      if (section.blocks) {
        section.blocks.forEach(function (rows) {
          var blockEl = _rclEl('div', 'rcl-seasonfmt-block');
          rows.forEach(function (stat) { blockEl.appendChild(buildRow(stat)); });
          list.appendChild(blockEl);
        });
      } else {
        if (section.tiers.length) {
          var tierBlock = _rclEl('div', 'rcl-seasonfmt-block');
          section.tiers.forEach(function (stat) { tierBlock.appendChild(buildTierRow(stat)); });
          list.appendChild(tierBlock);
        }
        if (section.bonus.length) {
          var bonusBlock = _rclEl('div', 'rcl-seasonfmt-block');
          section.bonus.forEach(function (stat) { bonusBlock.appendChild(buildRow(stat)); });
          list.appendChild(bonusBlock);
        }
      }
      group.appendChild(list);
      body.appendChild(group);
    });
  } else {
    body.appendChild(_rclEmptyState('No Data To Display', 'Season details show up here once they are set.'));
  }

  dialog.appendChild(body);
  overlay.appendChild(dialog);

  function close() { document.body.removeChild(overlay); _rclUnlockBodyScroll(); }
  closeBtn.addEventListener('click', close);

  document.body.appendChild(overlay);
  _rclLockBodyScroll();
}

// LEAGUE RULES popup (2026-10-03, LEAGUE RULES tile, _rclRenderWebsiteContainers
// below) -- same RULEBOOK_SECTIONS data Account.html's Rules and
// Regulations card reads (js/rulebook-content.js, now also loaded on this
// page, see league.html), rendered with the exact same markup/classes
// (.rc-rulebook-nav/.rc-rulebook-section/etc. -- style.css, also already
// loaded here) so the content itself never drifts between the two pages.
// Only the colors differ: .rcl-rules-modal-body (css/league.css) overrides
// those shared classes' light-theme colors for this page's dark shell,
// same "reuse the structure, override the palette" approach the Edit
// Profile/Change Avatar popups already take on this page (edit-profile.js).
function _rclOpenLeagueRulesModal() {
  var overlay = _rclEl('div', 'rcl-modal-overlay');
  var dialog = _rclEl('div', 'rcl-modal-dialog');
  var head = _rclEl('div', 'rcl-modal-head');
  head.appendChild(_rclEl('div', 'rcl-modal-title', 'League Rules'));
  var closeBtn = _rclEl('button', 'rcl-modal-close', '&times;');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  head.appendChild(closeBtn);
  dialog.appendChild(head);

  var body = _rclEl('div', 'rcl-modal-body rcl-rules-modal-body');

  var rbNav = _rclEl('div', 'rc-rulebook-nav');
  rbNav.appendChild(_rclEl('div', 'rc-rulebook-nav-title', 'Jump To A Section'));
  var rbNavGrid = _rclEl('div', 'rc-rulebook-nav-grid');
  var rbSections = _rclEl('div');
  if (typeof RULEBOOK_SECTIONS !== 'undefined') {
    RULEBOOK_SECTIONS.forEach(function (sec) {
      var link = document.createElement('a');
      link.href = '#rcl-rulebook-sec-' + sec.id;
      link.className = 'rc-rulebook-nav-link' + (sec.draft ? ' rc-rulebook-draft' : '');
      link.textContent = sec.num + '. ' + sec.title;
      rbNavGrid.appendChild(link);

      var secWrap = _rclEl('div', 'rc-rulebook-section');
      secWrap.id = 'rcl-rulebook-sec-' + sec.id;
      secWrap.appendChild(_rclEl('h3', null, sec.num + '. ' + sec.title));
      if (sec.draft) {
        secWrap.appendChild(_rclEl('p', 'rc-rulebook-draft-note', sec.draftNote ? ('Not yet drafted. ' + sec.draftNote) : 'Not yet drafted.'));
      } else {
        // Safe to use innerHTML here -- RULEBOOK_SECTIONS' html strings are
        // hand-authored by us, not sourced from user input (see that
        // file's own header comment).
        var secBody = document.createElement('div');
        secBody.innerHTML = sec.html || '';
        secWrap.appendChild(secBody);
      }
      rbSections.appendChild(secWrap);
    });
  }
  rbNav.appendChild(rbNavGrid);
  body.appendChild(rbNav);
  body.appendChild(rbSections);

  dialog.appendChild(body);
  overlay.appendChild(dialog);

  function close() { document.body.removeChild(overlay); _rclUnlockBodyScroll(); }
  closeBtn.addEventListener('click', close);

  document.body.appendChild(overlay);
  _rclLockBodyScroll();
}

// MEMBER LIST popup (2026-10-03, MEMBER LIST tile, _rclRenderWebsiteContainers
// below) -- fetches handleGetMemberList (Website.gs) fresh on every open
// (small, public, no-token payload -- not worth folding into the cached
// League Hub bundle). Grouped by role tier, Admin highest/Driver lowest
// (same order the server already sorts in, VALID_ROLES/Auth.gs), each row
// a bold white name + a gray "Joined on <date>" subline, per Matt's exact
// spec. Static for now (no click handler on a row) but keeps profileId on
// each entry so a future per-row link to an individual profile page has
// what it needs without a second fetch then.
var RCL_ROLE_TIERS_ = ['Admin', 'Organizer', 'Steward', 'Driver'];
// No fetch of its own, no loading state (2026-10-03, Matt's ask: "make the
// member list popup as responsive as the season format popup... have the
// information readily accessible so there's no waiting") -- hub.members
// is already sitting in the same cached League Hub payload this page
// loaded once up front (see _rcBuildMemberList_, Website.gs), so this
// reads it directly, exactly the same "no fetch, just render what's
// already in memory" shape _rclOpenSeasonDetailsModal above has always
// had. The standalone getMemberList route still exists server-side for
// anything else that might want just this list on its own, but
// league.html itself no longer calls it.
function _rclOpenMemberListModal(hub) {
  var overlay = _rclEl('div', 'rcl-modal-overlay');
  var dialog = _rclEl('div', 'rcl-modal-dialog');
  var head = _rclEl('div', 'rcl-modal-head');
  head.appendChild(_rclEl('div', 'rcl-modal-title', 'Member List'));
  var closeBtn = _rclEl('button', 'rcl-modal-close', '&times;');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  head.appendChild(closeBtn);
  dialog.appendChild(head);

  var body = _rclEl('div', 'rcl-modal-body');

  var members = (hub && hub.members) ? hub.members : [];
  if (!members.length) {
    body.appendChild(_rclEmptyState('No Members Yet', 'Members show up here once accounts are created.'));
  } else {
    RCL_ROLE_TIERS_.forEach(function (tier) {
      var tierMembers = members.filter(function (m) { return (m.role || 'Driver') === tier; });
      if (!tierMembers.length) return;
      var group = _rclEl('div', 'rcl-memberlist-group');
      group.appendChild(_rclEl('div', 'rcl-memberlist-tier', tier === 'Admin' ? 'Admins' : tier + 's'));
      tierMembers.forEach(function (m) {
        var row = _rclEl('div', 'rcl-memberlist-row');
        row.appendChild(_rclEl('div', 'rcl-memberlist-name', _rclEscapeHtml(m.displayName || 'Unknown Driver')));
        row.appendChild(_rclEl('div', 'rcl-memberlist-joined', 'Joined on ' + (_rclFormatDate(m.joinedAt) || 'an unknown date')));
        group.appendChild(row);
      });
      body.appendChild(group);
    });
  }

  dialog.appendChild(body);
  overlay.appendChild(dialog);

  function close() { document.body.removeChild(overlay); _rclUnlockBodyScroll(); }
  closeBtn.addEventListener('click', close);

  document.body.appendChild(overlay);
  _rclLockBodyScroll();
}

// WEBSITE-SPECIFIC CONTAINERS -- 4 square image tiles under the race
// carousel (2026-10-03, Matt's ask): SEASON FORMAT, LEAGUE RULES, MEMBER
// LIST, JOIN RACE CLUB. Each tile's background image lives in
// assets/images/<name>.jpg; a tile whose image 404s falls back to the
// same --rcl-bg-raised every other container on this page uses (the
// onerror handler below just clears the inline background-image, letting
// .rcl-wc-tile's own CSS background color show through -- see
// css/league.css). Always rendered regardless of hasSeason (unlike the
// podium/carousel above it) -- these are static site-navigation tiles,
// not season data.
var RCL_WEBSITE_CONTAINERS_ = [
  { label: 'Season Format', image: 'season_format.jpg' },
  { label: 'League Rules', image: 'league_rules.jpg' },
  { label: 'Member List', image: 'member_list.jpg' },
  { label: 'Join Race Club', image: 'join_race_club.jpg' }
];
function _rclRenderWebsiteContainers(hub) {
  var wrap = document.getElementById('rcl-website-containers');
  if (!wrap) return;
  wrap.innerHTML = '';

  RCL_WEBSITE_CONTAINERS_.forEach(function (def) {
    var tile = _rclEl('div', 'rcl-wc-tile');
    tile.style.backgroundImage = "url('assets/images/" + def.image + "')";
    var img = new Image();
    img.onerror = function () { tile.style.backgroundImage = 'none'; };
    img.src = 'assets/images/' + def.image;

    tile.appendChild(_rclEl('div', 'rcl-wc-tile-label', _rclEscapeHtml(def.label.toUpperCase())));

    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');
    function activate() {
      if (def.label === 'Season Format') {
        _rclOpenSeasonDetailsModal(hub);
      } else if (def.label === 'League Rules') {
        _rclOpenLeagueRulesModal();
      } else if (def.label === 'Member List') {
        _rclOpenMemberListModal(hub);
      } else if (def.label === 'Join Race Club') {
        window.location.href = 'register.html';
      }
    }
    tile.addEventListener('click', activate);
    tile.addEventListener('keydown', function (evt) {
      if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); activate(); }
    });
    wrap.appendChild(tile);
  });
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

// _rclPatchTimeDerivedFields_(hub) -- client-side port of
// _rcRefreshTimeDerivedLeagueHubFields_ (Website.gs). Only needed on the
// published-CSV path (2026-09-26): a CacheService/getLeagueHub read always
// goes through that server-side function first, so it never serves a stale
// "UPCOMING" entry whose scheduled start has already passed (see that
// function's own long comment for the original bug report). A published
// CSV has no such gate -- it's a flat file that only changes when
// _rcPublishJsonToSheet_ rewrites it (an import, a season action, a news
// post, etc.), same as the CacheService copy's write side, but nothing
// re-derives these fields on every READ the way handleGetLeagueHub does.
// Without this, a round could sit showing UPCOMING on a CSV-fed page for
// up to the gap between real writes, even though the round's start time
// has already passed. Keep this in exact lockstep with the server-side
// function if that one ever changes.
function _rclPatchTimeDerivedFields_(hub) {
  if (!hub || !hub.hasSeason || !Array.isArray(hub.calendar)) return hub;
  var nowMs = Date.now();

  hub.calendar.forEach(function (entry) {
    entry.finished = !!(entry.startUtc && new Date(entry.startUtc).getTime() < nowMs);
  });

  var completedEntries = hub.calendar.filter(function (entry) {
    return entry.kind === 'round' && entry.finished && entry.hasResults;
  });
  hub.roundsCompleted = completedEntries.length;
  hub.hasUnofficialResults = completedEntries.some(function (entry) { return !entry.resultsFinalized; });

  var nextEntry = hub.calendar.filter(function (entry) {
    return entry.kind !== 'bye' && !entry.finished;
  })[0];
  hub.nextRace = nextEntry ? {
    kind: nextEntry.kind,
    eventName: nextEntry.eventName || '',
    track: nextEntry.track || '',
    layout: nextEntry.layout || '',
    startUtc: nextEntry.startUtc || '',
    raceLengthTier: nextEntry.raceLengthTier || '',
    roundNum: nextEntry.roundNum || 0,
    totalRounds: hub.totalRounds
  } : null;

  return hub;
}

// _rclFetchLeagueHub_() -- tries the published CSV first (2026-09-26,
// Matt's ask: "publishing the league hub itself as a CSV will eliminate
// the use of apps scripts altogether for loading the league hub"), which
// hits Google's own static-file servers with zero Apps Script execution,
// and falls back to the normal fetchApi('getLeagueHub', ...) call --
// unchanged from before this feature existed -- on ANY failure: the CSV
// URL hasn't been configured yet (RC_LEAGUE_HUB_CSV_URL left blank in
// api.js), the fetch itself failed, or the reassembled text didn't parse.
// This is a pure performance path, never the only way to load the page.
function _rclFetchLeagueHub_() {
  return fetchPublishedJson(RC_LEAGUE_HUB_CSV_URL).then(function (hub) {
    return _rclPatchTimeDerivedFields_(hub);
  }).catch(function () {
    return fetchApi('getLeagueHub', { timeoutMs: RC_FETCH_TIMEOUT_MS_LONG });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('rcl-page-loader')) _rclLockBodyScroll();

  var RENDERERS = [_rclRenderStandings, _rclRenderResults, _rclRenderManufacturerStandings, _rclRenderRaceCarousel, _rclRenderNews, _rclRenderWebsiteContainers];

  function showHub(hub) {
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
  }

  // BUG FIX (2026-09-23 audit -- Matt's report: league.html times out and
  // shows no season after a long wait). The fetchApi fallback call inside
  // _rclFetchLeagueHub_ still uses RC_FETCH_TIMEOUT_MS_LONG rather than
  // the 20s default meant for small dashboard reads, since the League Hub
  // payload scales with the whole season's standings/results/news and a
  // cache MISS server-side can still take a real full rebuild.
  _rclFetchLeagueHub_().then(showHub).catch(function () {
    _rclRenderTicker({ lastRace: null, standings: [] });
    RENDERERS.forEach(function (fn) { fn({ hasSeason: false }); });
    _rclRenderHero({ hasSeason: false });
    _rclHidePageLoader();
  });
});
