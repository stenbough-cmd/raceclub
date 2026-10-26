// Race Club — js/league.js
// Backs league.html -- the public ESPN-style league hub. One fetch (getLeagueHub, no token) bundles
// everything the page needs: standings, the last completed race's headline result, the full season
// schedule, and the news feed.

function _rclEl(tag, className, html) {
  var e = document.createElement(tag);
  if (className) e.className = className;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

// Standard "starting grid lights" loading state -- same .rc-inline-spinner-wrap > .rc-startlights
// (5x .rc-startlight) + .rc-loading-text markup as the full-page loader (league.html's
// #rcl-page-loader) and the Edit Profile popup's loading state (rcOpenEditProfileModalInPlace,
// edit-profile.js), factored out here so any other in-modal loading state on this page can reuse it
// instead of rebuilding the same five nodes by hand.
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

// Class pill -- same rounded-rectangle, white-on-color chip every other class badge on the site
// uses (.rc-badge-chip + its color class, style.css, which league.html already loads alongside
// css/league.css.html's shared _rcClassAbbrevPill helper isn't in scope on this page.
var RCL_CLASS_PILL_COLOR_ = { LMGTE: 'rc-badge-lmgte', LMGT3: 'rc-badge-lmgt3', LMP3: 'rc-badge-lmp3', LMP2: 'rc-badge-lmp2', Hypercar: 'rc-badge-hypercar' };
// Wrapped in a fixed-width, right-aligned column so every pill keeps the exact same padding around
// its own text (a 2-letter "HY" pill and a 5-letter "LMGT3"/"LMGTE" pill are each their own natural
// width, via .rc-badge-chip-abbrev's fixed 2px 6px padding, style.css) while still lining up
// against one shared right edge column to column, using flexbox's justify-content:flex-end.
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

// .rcl-ticker-class-pill (css/league.css) is left in place in case a future ticker item wants a
// small inline pill again, but nothing currently references it.

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

// Background-scroll lock for every popup on this page -- same iOS-Safari-safe pattern
// Account.html's own showModal() already uses (position:fixed instead of plain overflow:hidden,
// which doesn't reliably stop touch scrolling; the scroll position is remembered so it can be
// restored without a jump on close), reusing that exact same .rc-modal-scroll-locked class/CSS rule
// (css/style.css) rather than a page-specific copy -- league.html already loads style.css alongside
// css/league.css (see the file header comment), so no new CSS is needed here at all. league.js is
// otherwise self-contained from Account.html (no shared JS include), so this is its own small copy
// of the JS side of that pattern only.
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

// Date + time, viewer's own local timezone -- league.html is a public, no-token page, so there's no
// driver timezone to read the way Account.html's Calendar does; the browser's own locale/timezone
// is the only thing available here, same as every other date this page already formats.
// timeZoneName: 'short' puts the abbreviation (EDT/PST/etc.) right after the time itself, same
// option Account.html's own formatRaceDateTime already uses.
function _rclFormatDateTime(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}

// Same as _rclFormatDateTime above but with the month spelled out in full.
function _rclFormatDateTimeLong_(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}

function _rclTimeOfDayLabel_(hhmm) {
  if (!hhmm) return '';
  var h = parseInt(String(hhmm).split(':')[0], 10);
  if (isNaN(h)) return '';
  if (h >= 5 && h < 12) return 'Morning';
  if (h >= 12 && h < 17) return 'Midday';
  if (h >= 17 && h < 21) return 'Evening';
  return 'Night';
}

// A sim-clock "HH:MM" string (24-hour, as the admin typed it into the wizard's in-game time fields)
// into a 12-hour "H:MM AM/PM" label, purely cosmetic -- matches the 12-hour clock every other time
// on this page already reads in.
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

// IANA zone name (e.g. "America/New_York", what the admin actually picks in the Season Creation
// Wizard and what hub.enteredTimeZone carries) -> its short abbreviation for right now.
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

// A calendar entry's race length in actual minutes rather than its Sprint/Medium/Long tier name.
function _rclEntryLengthMinutes(entry, hub) {
  if (entry.raceLengthMinutes) return Number(entry.raceLengthMinutes) || 0;
  var tier = (hub.pointsTables || {})[entry.raceLengthTier];
  return (tier && tier.duration) ? Number(tier.duration) : 0;
}

// Local copies of a handful of Account.html's ICON_* constants (same viewBox/stroke-width/cap/join
// convention -- see the race-club-ui-consistency skill's icon section) -- league.html doesn't load
// Account.html, so these can't be shared directly.
var _RCL_ICON_CLOCK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 16 14"></polyline></svg>';
var _RCL_ICON_SUN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><line x1="12" y1="2" x2="12" y2="4"></line><line x1="12" y1="20" x2="12" y2="22"></line><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"></line><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"></line><line x1="2" y1="12" x2="4" y2="12"></line><line x1="20" y1="12" x2="22" y2="12"></line><line x1="4.2" y1="19.8" x2="5.6" y2="18.4"></line><line x1="18.4" y1="5.6" x2="19.8" y2="4.2"></line></svg>';
var _RCL_ICON_CLOUD = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.7-1.6A4.5 4.5 0 0 0 7 18z"></path></svg>';
var _RCL_ICON_CLOUD_PARTLY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="17" cy="7" r="3"></circle><path d="M4 17h9a3.5 3.5 0 0 0 0-7 4.8 4.8 0 0 0-8.6 2.1A3.2 3.2 0 0 0 4 17z"></path></svg>';
var _RCL_ICON_RAIN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 15h9a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.4-1.4A4 4 0 0 0 6.5 15z"></path><line x1="8" y1="18" x2="7" y2="21"></line><line x1="12" y1="18" x2="11" y2="21"></line><line x1="16" y1="18" x2="15" y2="21"></line></svg>';
var _RCL_ICON_RAIN_HEAVY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 13h9a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.4-1.2A4 4 0 0 0 6 13z"></path><line x1="6" y1="16" x2="5" y2="19"></line><line x1="9.5" y1="16" x2="8.5" y2="19"></line><line x1="13" y1="16" x2="12" y2="19"></line><line x1="16.5" y1="16" x2="15.5" y2="19"></line><line x1="7.5" y1="19" x2="6.5" y2="22"></line><line x1="14.5" y1="19" x2="13.5" y2="22"></line></svg>';
// Game controller -- no equivalent in Account.html's icon set (its in-game times are plain text
// there), drawn fresh in the same style for the Calendar's original "In-Game" chip.
var _RCL_ICON_GAMEPAD = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="8" width="20" height="10" rx="5"></rect><line x1="7" y1="11" x2="7" y2="15"></line><line x1="5" y1="13" x2="9" y2="13"></line><circle cx="16" cy="11" r="1"></circle><circle cx="18" cy="14" r="1"></circle></svg>';
var _RCL_ICON_FLAG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="22" x2="4" y2="3"></line><path d="M4 4h14l-3 4 3 4H4"></path></svg>';

// ---------------------------------------------------------------------
// TICKER
// ---------------------------------------------------------------------
// Ticker-only class order.
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

// Builds the scrolling item list from season/calendar/standings/ tickerLastRace. Rendered twice
// back-to-back in the DOM so the CSS animation (translateX(-50%)) loops seamlessly -- see
// .rcl-ticker-track in css/league.css.
// Same "Season" + "Next Race" framing whether or not the season has any results yet -- only the
// per-class rows underneath differ: a plain driver roster before any race has been run, or that
// class's top 5 from the most recently posted race once results exist.
function _rclBuildTickerItems(hub) {
  var items = [];
  var hasResults = (hub.roundsCompleted || 0) > 0;

  if (hub.seasonNumber) {
    // Season dates appended after the name -- same start/end fields and _rclFormatDate() the "This
    // Season" snapshot stat above already uses.
    var seasonDates = '';
    if (hub.seasonStartUtc && hub.seasonEndUtc) {
      var seasonStartLabel = _rclFormatDate(hub.seasonStartUtc);
      var seasonEndLabel = _rclFormatDate(hub.seasonEndUtc);
      if (seasonStartLabel && seasonEndLabel) {
        seasonDates = seasonStartLabel + (seasonEndLabel !== seasonStartLabel ? (' - ' + seasonEndLabel) : '');
      }
    }
    // Split into nameText/datesText rather than one joined string -- lets buildRun() below give the
    // dates span its own lighter weight (.rcl-ticker-season-dates, css/league.css) while the season
    // number/name stays at the item's normal weight.
    items.push({
      tag: 'SEASON ' + _rclEscapeHtml(String(hub.seasonNumber)),
      nameText: hub.seasonName ? _rclEscapeHtml(hub.seasonName) : '',
      datesText: seasonDates ? ' (' + _rclEscapeHtml(seasonDates) + ')' : ''
    });
  }

  // Ended-season ticker content -- branches off completely from the in-season logic below rather
  // than threading seasonEnded checks through it, since nothing else about this state (no next
  // race, final standings instead of last-round results) shares code with the normal flow.
  if (hub.seasonEnded) {
    var finalClassLists = _rclSortByTickerClassOrder_(hub.standings || [], function (cls) { return cls.className; });
    finalClassLists.forEach(function (cls) {
      // No top-10 cap -- every classified driver in the class's final standings, not a slice.
      var standings = cls.standings || [];
      if (!standings.length) return;
      var rows = standings.filter(function (row) { return row.name; }).map(function (row) {
        return { name: row.name, carNumber: row.carNumber, manufacturer: row.manufacturer, carClass: cls.className, country: row.country, profileId: row.profileId };
      });
      if (!rows.length) return;
      items.push({ tag: 'FINAL ' + (cls.className || 'CLASS').toUpperCase() + ' CHAMPIONSHIP RESULTS', driverRows: rows, showRank: true });
    });

    // Every Hypercar-class manufacturer with points, ranked -- same full ranked list the page's own
    // Manufacturers' Standings "rest" list uses (_rclComputeManufacturerStandingsFull_), rendered
    // here as logo + manufacturer name only, no driver names/numbers/flags.
    var mfrFull = _rclComputeManufacturerStandingsFull_(hub);
    if (mfrFull.length) {
      items.push({
        tag: "FINAL MANUFACTURERS' STANDINGS",
        manufacturerRows: mfrFull.map(function (m) { return { manufacturer: m.manufacturer }; }),
        showRank: true
      });
    }

    return items;
  }

  // Next race -- same "first non-bye, unfinished" pick the Calendar section's own "UP NEXT" pill
  // uses (see _rclRenderCalendar above).
  var nextRaceItem = null;
  var nextEntry = null;
  (hub.calendar || []).forEach(function (entry) {
    if (!nextEntry && entry.kind !== 'bye' && !entry.raceOver) nextEntry = entry;
  });
  if (nextEntry) {
    // Same prefixBoldText/prefixDimText/prefixDatesText shape as the ROUND n results item below --
    // bold event name, normal-weight " at track: layout", gray " (date)", same field names and the
    // same ': ' (space after the colon) join between track and layout ROUND n's own raceTrackLayout
    // below uses.
    var nextTrackLayout = nextEntry.track ? (nextEntry.track + (nextEntry.layout ? (': ' + nextEntry.layout) : '')) : '';
    nextRaceItem = {
      tag: 'NEXT RACE',
      prefixBoldText: nextEntry.eventName || 'Race',
      prefixDimText: nextTrackLayout ? (' at ' + nextTrackLayout) : '',
      prefixDatesText: nextEntry.startUtc ? (' (' + _rclFormatDate(nextEntry.startUtc) + ')') : ''
    };
  }

  // Driver rows (both branches below) are kept as STRUCTURED data -- {name, carNumber,
  // manufacturer} -- rather than one pre-joined string. _rclRenderTicker's buildRun() is what
  // actually turns each row into a logo image + differently-weighted name/number spans -- see
  // driverRows there.
  if (!hasResults) {
    var classLists = _rclSortByTickerClassOrder_(hub.standings || [], function (cls) { return cls.className; });
    classLists.forEach(function (cls) {
      var standings = cls.standings || [];
      if (!standings.length) return;
      var rows = standings.filter(function (row) { return row.name; }).map(function (row) {
        // carClass -- same field the in-season TOP 10 branch below already sets, just added here
        // too so buildDriverEntry's existing "if (row.carClass)" pill render (see its own comment
        // there) picks it up on the pre-season roster list as well.
        return { name: row.name, carNumber: row.carNumber, manufacturer: row.manufacturer, carClass: cls.className, country: row.country, profileId: row.profileId };
      });
      if (!rows.length) return;
      items.push({ tag: (cls.className || 'CLASS').toUpperCase() + ' DRIVERS', driverRows: rows });
    });
    if (nextRaceItem) items.push(nextRaceItem);
    return items;
  }

  // In-season: top 5 from the most recently posted race, per class, in the ticker's
  // Hypercar-to-LMGTE order -- hub.tickerLastRace is the SAME round as hub.lastRace (the
  // abbreviated Recent Results panel's own data) but capped per-class only, not per-class-COUNT, so
  // every class the round actually has shows here even though Recent Results itself only has room
  // to show 3 (see handleGetLeagueHub, Website.gs).
  var lastRace = hub.tickerLastRace;
  if (lastRace) {
    // Track name and layout still share one normal-weight span (prefixDimText), and the raced-on
    // date still closes it out in the ticker's gray date style (prefixDatesText) -- both unchanged
    // from the first pass.
    var raceTag = lastRace.roundNum ? ('ROUND ' + lastRace.roundNum) : 'ROUND RESULTS';
    var raceLabelBold = lastRace.eventName || 'Race';
    var raceTrackLayout = lastRace.track ? (lastRace.track + (lastRace.layout ? (': ' + lastRace.layout) : '')) : '';
    var raceLabelDim = raceTrackLayout ? (' at ' + raceTrackLayout) : '';
    var raceLabelDates = lastRace.startUtc ? (' (' + _rclFormatDate(lastRace.startUtc) + ')') : '';
    var resultClasses = _rclSortByTickerClassOrder_(lastRace.classes || [], function (cls) { return cls.className; });
    var classGroups = [];
    resultClasses.forEach(function (cls) {
      var standings = (cls.standings || []).slice(0, 10);
      if (!standings.length) return;
      var rows = standings.filter(function (row) { return row.name; }).map(function (row) {
        // carClass -- every row in this one group is the same class, so this is just cls.className
        // repeated per row for buildDriverEntry to key its pill color off of, not something read
        // off the row's own raw data. country -- same field buildDriverEntry now reads to render a
        // nationality flag between the name and car number.
        return { name: row.name, carNumber: row.carNumber, manufacturer: row.manufacturer, carClass: cls.className, country: row.country, profileId: row.profileId };
      });
      if (!rows.length) return;
      // Tag now names the class itself -- "TOP TEN <CLASS> RESULTS" -- was the generic "TOP TEN
      // CLASS RESULTS" for every group, which read identically no matter which class it was; same
      // cls.className.toUpperCase() the pre-season roster's own "<CLASS> DRIVERS" tag already uses
      // above, so Hypercar/LMP2/LMP3/ LMGT3/LMGTE all read out in full, not abbreviated.
      classGroups.push({ driverRows: rows, tag: 'TOP TEN ' + (cls.className || 'CLASS').toUpperCase() + ' RESULTS' });
    });
    // showRank -- ranked TOP 10 rows only; the pre-results roster list above has no finishing order
    // to show, so it's left without a rank prefix.
    if (classGroups.length) {
      items.push({
        tag: raceTag,
        prefixBoldText: raceLabelBold, prefixDimText: raceLabelDim, prefixDatesText: raceLabelDates,
        classGroups: classGroups, showRank: true
      });

      // TOP 3 MANUFACTURER STANDINGS -- same top-3-Hypercar-manufacturers-by-championship-points
      // totals the plain podium elsewhere on the page already computes
      // (_rclComputeManufacturerStandings_, no new server data), empty when there's no Hypercar
      // class/points yet, which doubles as the "only if Hypercar is represented" gate.
      var mfrTop3InSeason = _rclComputeManufacturerStandings_(hub);
      if (mfrTop3InSeason.length) {
        items.push({
          tag: 'TOP 3 MANUFACTURER STANDINGS',
          manufacturerRows: mfrTop3InSeason.map(function (m) { return { manufacturer: m.manufacturer }; }),
          showRank: true
        });
      }
    }
  }

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
    // Empty-state message removed -- the ticker just stays blank.
    return;
  }

  // A trailing dot closes out every run -- since each run is identical and both carry the same
  // trailing dot, the seam where the second run picks back up right after the first reads as
  // "...item • item..." the same way a real news ticker separates its loop point, rather than the
  // runs just butting up against each other.
  function buildDriverEntry(row) {
    var entry = _rclEl('span', 'rcl-ticker-driver-entry');
    if (row.manufacturer && typeof manufacturerLogoSrc === 'function') {
      var logo = document.createElement('img');
      logo.className = 'rcl-ticker-driver-logo';
      logo.src = manufacturerLogoSrc(row.manufacturer, 'white');
      logo.alt = '';
      manufacturerLogoFallback(logo, row.manufacturer, function () { logo.style.display = 'none'; });
      entry.appendChild(logo);
    }
    // Car number first, then the name (ALL CAPS, bold for the signed-in driver), then the flag.
    if (row.carNumber) {
      var numSpan = _rclEl('span', 'rcl-ticker-driver-num');
      numSpan.textContent = '#' + row.carNumber;
      entry.appendChild(numSpan);
    }
    var nameSpan = _rclEl('span', 'rcl-ticker-driver-name' + (row.profileId && row.profileId === _rclMyProfileId_() ? ' rcl-me' : ''));
    nameSpan.textContent = row.name;
    entry.appendChild(nameSpan);
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
    // Class pill removed -- each class's own "TOP TEN CLASS RESULTS:" tag (see the classGroups.tag
    // change in _rclBuildTickerItems below) now carries that information instead, so a pill on
    // every single driver row was redundant. row.carClass is still set on each row (used only by
    // this removed pill previously) but is otherwise harmless to leave in place.
    return entry;
  }

  // Manufacturer-only entry for the ended-season "TOP 3 MANUFACTURER CHAMPIONSHIP" segment -- logo
  // + manufacturer name only, deliberately none of buildDriverEntry's name/flag/car-number fields.
  function buildManufacturerEntry(row) {
    var entry = _rclEl('span', 'rcl-ticker-driver-entry');
    if (row.manufacturer && typeof manufacturerLogoSrc === 'function') {
      var logo = document.createElement('img');
      logo.className = 'rcl-ticker-driver-logo';
      logo.src = manufacturerLogoSrc(row.manufacturer, 'white');
      logo.alt = '';
      manufacturerLogoFallback(logo, row.manufacturer, function () { logo.style.display = 'none'; });
      entry.appendChild(logo);
    }
    var nameSpan = _rclEl('span', 'rcl-ticker-driver-name');
    nameSpan.textContent = row.manufacturer || '';
    entry.appendChild(nameSpan);
    return entry;
  }

  function buildRun() {
    var frag = document.createDocumentFragment();
    items.forEach(function (item) {
      var el = _rclEl('div', 'rcl-ticker-item');
      // Tag now matches the rest of the line's font -- a plain colon marks where the label ends and
      // the data starts instead of a color/weight change. See .rcl-ticker-item-tag in
      // css/league.css.
      el.appendChild(_rclEl('span', 'rcl-ticker-item-tag', item.tag + ':'));
      // Shared prefix rendering -- bold event name + normal- weight "at track:layout" + gray
      // raced-on date, applies to ANY item carrying these fields, not just ones with a driver list
      // below (NEXT RACE has none) -- both items now share this one code path instead of NEXT RACE
      // using its own separate plain-text branch.
      if (item.prefixBoldText !== undefined) {
        if (item.prefixNormalText) el.appendChild(document.createTextNode(item.prefixNormalText));
        el.appendChild(_rclEl('span', 'rcl-ticker-prefix-bold', item.prefixBoldText));
        if (item.prefixDimText) el.appendChild(_rclEl('span', 'rcl-ticker-prefix-dim', item.prefixDimText));
        if (item.prefixDatesText) el.appendChild(_rclEl('span', 'rcl-ticker-season-dates', item.prefixDatesText));
        // 5-space gap before the driver list starts -- only when there's a driver list following;
        // NEXT RACE has nothing after its prefix.
        if (item.driverRows || item.classGroups) el.appendChild(document.createTextNode('     '));
      } else if (item.prefixText) {
        el.appendChild(document.createTextNode(item.prefixText));
      }
      if (item.driverRows || item.classGroups) {
        // Driver-list items -- structured rows instead of one joined string, so each name gets its
        // own logo + differently-weighted spans (see buildDriverEntry above) rather than reading as
        // a flat wall of text.
        var list = _rclEl('span', 'rcl-ticker-driver-list');
        function appendRankedRow(targetList, row, idxInClass) {
          // Bold white rank prefix -- ranked rows only (item.showRank), see _rclBuildTickerItems;
          // the pre-results roster has no finishing order so it never sets showRank.
          if (item.showRank) {
            targetList.appendChild(_rclEl('span', 'rcl-ticker-driver-rank', _rclOrdinal_(idxInClass + 1)));
            targetList.appendChild(document.createTextNode('  '));
          }
          targetList.appendChild(buildDriverEntry(row));
        }
        if (item.classGroups) {
          // Combined round-results item -- every class's top 10 runs one after another in this ONE
          // item, separated from the next class by a wider 15 non-breaking-space gap.
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
      } else if (item.manufacturerRows) {
        // "FINAL MANUFACTURERS' STANDINGS" -- same podium-style ranked list as a driver group, just
        // manufacturer- only entries (buildManufacturerEntry above), 8 non-breaking spaces between
        // manufacturers instead of driverRows' own 10.
        var mfrList = _rclEl('span', 'rcl-ticker-driver-list');
        item.manufacturerRows.forEach(function (row, idx) {
          if (idx > 0) mfrList.appendChild(document.createTextNode('        '));
          if (item.showRank) {
            mfrList.appendChild(_rclEl('span', 'rcl-ticker-driver-rank', _rclOrdinal_(idx + 1)));
            mfrList.appendChild(document.createTextNode('  '));
          }
          mfrList.appendChild(buildManufacturerEntry(row));
        });
        el.appendChild(mfrList);
      } else if (item.nameText !== undefined) {
        // SEASON item -- name at the line's normal weight, dates in their own lighter span right
        // after it.
        el.appendChild(document.createTextNode(item.nameText));
        if (item.datesText) {
          el.appendChild(_rclEl('span', 'rcl-ticker-season-dates', item.datesText));
        }
      } else if (item.prefixBoldText === undefined && item.text !== undefined) {
        // Any remaining plain text + optional date item -- same gray/lighter treatment as SEASON's
        // own date span. Guarded against prefixBoldText items (like NEXT RACE) which already
        // rendered everything they need above and have no separate item.text.
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

  var RUN_COUNT = 2; // number of concatenated copies of the item list -- see the
  // animation comment above; must stay in sync with the -50% end value on rcl-ticker-scroll in
  // css/league.css (translateX moves exactly one run's width per loop, i.e. -100/RUN_COUNT %)
  track.innerHTML = '';
  for (var runIdx = 0; runIdx < RUN_COUNT; runIdx++) {
    track.appendChild(buildRun());
  }

  // Roll in from off-screen right ONCE on first paint, then hand off to the normal seamless
  // infinite loop.
  // Two separate animations avoid that: a one-shot "intro" (measured off-screen start ->
  // translateX(0), via a JS-measured CSS custom property, since a plain keyframe can't express "one
  // viewport-width further right than a plain reset"), immediately followed (via animation-delay,
  // not overlapping it) by the ORIGINAL always-worked infinite loop starting fresh from exactly
  // where the intro left off.
  var reduceMotion = (typeof window.matchMedia === 'function') && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  // requestAnimationFrame, not immediate -- scrollWidth needs the two
  // freshly-appended runs to have actually been laid out first.
  requestAnimationFrame(function () {
    var viewport = track.parentElement;
    if (!viewport) return;
    // Constant scroll SPEED, not constant duration.
    var PX_PER_SEC = 64;
    var MIN_DURATION_SEC = 12; // floor so a very short ticker (e.g. no results yet) doesn't zip past
    var runWidth = track.scrollWidth / RUN_COUNT;
    var mainDurationSec = Math.max(runWidth / PX_PER_SEC, MIN_DURATION_SEC);
    // The intro is just a quick "slide the strip on screen" reveal, so it runs at a fixed pace
    // regardless of viewport width -- deriving it proportionally from the main loop's (slow, by
    // design) px/sec rate made the very first roll-in sluggish on wide screens.
    var introDurationSec = 1.1;
    track.style.setProperty('--rcl-ticker-start', viewport.clientWidth + 'px');
    // Restart cleanly (a plain property/animation-shorthand change alone doesn't rewind an
    // already-running animation) -- toggle animation off, force a reflow, then set the real
    // intro+loop pair.
    track.style.animation = 'none';
    void track.offsetWidth;
    track.style.animation = 'rcl-ticker-intro ' + introDurationSec.toFixed(2) + 's linear forwards, ' +
      'rcl-ticker-scroll ' + mainDurationSec.toFixed(2) + 's linear ' + introDurationSec.toFixed(2) + 's infinite';
  });
}

// ---------------------------------------------------------------------
// LEADERBOARD (standings)
// ---------------------------------------------------------------------
// The hasResults-false path (empty position slot, no points column) is unused now but left in place
// rather than stripped, in case a future roster view wants it again.
var RCL_POS_METAL_CLASS_ = ['rcl-standings-row-p1', 'rcl-standings-row-p2', 'rcl-standings-row-p3'];

function _rclBuildPosBadge_(idx, textOverride) {
  var metalClass = (idx !== null && idx !== undefined && RCL_POS_METAL_CLASS_[idx]) ? ' ' + RCL_POS_METAL_CLASS_[idx] : '';
  var text = textOverride !== undefined ? textOverride : String((idx !== null && idx !== undefined) ? (idx + 1) : '');
  return _rclEl('div', 'rcl-standings-pos' + metalClass, text);
}

// DNF detection -- a DSQ'd driver (row.disqualified, already tracked), a suspended driver's
// synthetic row, or a raw FinishStatus containing "DNF" (mechanical failure, crash, etc. -- not
// disqualified, just didn't finish) all count.
function _rclIsDnf_(row) {
  return !!(row && (row.disqualified || row.suspended || /dnf/i.test(row.finishStatus || '')));
}

// A driver's name as a link to their public profile (profile.html?id=RC-xxxxx) when a profileId is
// known, otherwise plain text. Built with textContent/encodeURIComponent so a name can never be
// parsed as markup.
// The signed-in driver's profile ID (from the saved login), or '' for visitors. Used to show the
// signed-in driver in bold everywhere their name appears (no red highlights on this page).
function _rclMyProfileId_() {
  // Matt, 2026-10-14: the page looks exactly the same for everyone, so nobody is highlighted.
  return '';
}

function _rclBuildDriverNameEl_(className, name, profileId) {
  var el;
  if (profileId && /^RC-\d+$/.test(String(profileId))) {
    el = document.createElement('a');
    el.href = 'profile.html?id=' + encodeURIComponent(profileId);
    el.className = className + ' rcl-driver-link';
  } else {
    el = document.createElement('span');
    el.className = className;
  }
  el.textContent = name || '';
  if (profileId && profileId === _rclMyProfileId_()) el.className += ' rcl-me';
  return el;
}

// logo, name, country flag, car number, team -- one identical identity block wherever a driver row
// appears on this page.
function _rclBuildDriverIdentity_(row, dnf) {
  var identity = _rclEl('div', 'rcl-standings-identity' + (dnf ? ' rcl-standings-identity-dnf' : ''));
  var logoSlot = _rclEl('div', 'rcl-standings-mfr-logo-slot');
  if (row.manufacturer && typeof manufacturerLogoSrc === 'function') {
    var logoImg = document.createElement('img');
    logoImg.className = 'rcl-standings-mfr-logo';
    logoImg.src = manufacturerLogoSrc(row.manufacturer, 'white');
    logoImg.alt = '';
    manufacturerLogoFallback(logoImg, row.manufacturer, function () { logoSlot.style.display = 'none'; });
    logoSlot.appendChild(logoImg);
  } else {
    logoSlot.style.display = 'none';
  }
  identity.appendChild(logoSlot);

  var nameRow = _rclEl('div', 'rcl-standings-name-row');
  nameRow.appendChild(_rclBuildDriverNameEl_('rcl-standings-name', row.name, row.profileId));
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
  // One column per class -- .rcl-standings- columns is the grid wrapper (css/league.css),
  // auto-fitting however many classes the season actually has.
  var columns = _rclEl('div', 'rcl-standings-columns');
  standings.forEach(function (cls) {
    var wrap = _rclEl('div', 'rcl-standings-class');
    var headerText = (cls.className || 'CLASS').toUpperCase() + ' LEADERBOARD';
    wrap.appendChild(_rclEl('div', 'rcl-standings-class-header', headerText));
    var clsStandings = cls.standings || [];
    if (!clsStandings.length) {
      wrap.appendChild(_rclEl('div', 'rcl-empty-state-subtitle', 'No drivers registered in this class yet.'));
    } else {
      // Column labels, same exact style as Recent Results/View All Results -- only when hasResults
      // is true (the Drivers roster popup has no ranking/points to label). Same 40px/1fr/auto grid
      // .rcl-standings-row already uses.
      if (hasResults) {
        var standingsHeadRow = _rclEl('div', 'rcl-race-col-head rcl-race-grid-3');
        standingsHeadRow.appendChild(_rclEl('div', null, 'Pos'));
        standingsHeadRow.appendChild(_rclEl('div', null, 'Driver'));
        standingsHeadRow.appendChild(_rclEl('div', null, 'Pts'));
        wrap.appendChild(standingsHeadRow);
      }
      // Now shared module-level constant so Recent Results/View All Results use the exact same
      // metal thresholds.
      clsStandings.forEach(function (row, idx) {
        // No points column while hasResults is false, but the position container itself STAYS --
        // empty text, no p1/p2/p3 metal class (so it falls back to .rcl-standings-pos's own default
        // titanium gradient, the same one non-podium rows already use), same 40px slot and
        // grid-template-columns as a normal row.
        var rowEl = _rclEl('div', 'rcl-standings-row' + (hasResults && RCL_POS_METAL_CLASS_[idx] ? ' ' + RCL_POS_METAL_CLASS_[idx] : '') + (!hasResults ? ' rcl-standings-row-simple' : ''));
        if (hasResults) {
          rowEl.appendChild(_rclBuildPosBadge_(idx));
        }
        rowEl.appendChild(_rclBuildDriverIdentity_(row));

        if (hasResults) {
          // Points total only, no "-N PTS" gap-to-leader line underneath -- P1 never had a gap line
          // (idx === 0 skipped it), so every other row's extra line was what made them taller than
          // P1's row.
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

// ---------------------------------------------------------------------
// CHAMPIONSHIP STANDINGS BOARDS (one full-width panel per class)
// ---------------------------------------------------------------------
// Layout/behaviour copied from the single-player championship page's boards, in this page's dark
// colours. Per class: a silver header bar, then Pos | DRIVERS or TEAMS | one 46px column per
// calendar round (track flag header; points scored with the round's bonus as a small superscript) |
// PTS. Every class except Hypercar has a brushed-metal Drivers/Teams switch in the panel header
// (each class remembers its own setting while the page is open); Hypercar shows the drivers'
// championship only. In the league every car has one driver, and each car number is its own entry
// on the Teams board (cars of the same team are NOT combined).
var RCL_BOARD_CLASS_ORDER_ = ['Hypercar', 'LMP2', 'LMP3', 'LMGT3', 'LMGTE'];

function _rclBoardSortClasses_(names) {
  return names.slice().sort(function (a, b) {
    var ai = RCL_BOARD_CLASS_ORDER_.indexOf(a), bi = RCL_BOARD_CLASS_ORDER_.indexOf(b);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

// Returns three grid cells for a row: manufacturer logo | car number | name. The logo slot ALWAYS
// stays (empty space when there is no logo, or it fails to load) so every number and name lines up.
// Drivers board: driver name (a link to their public profile) + nationality flag. Teams board: team
// name. The car number has its own column under the N-degree header.
// Loads the small (300px wide) copy of a car picture, assets/cars/small/<same name>, because the
// originals are ~1180px wide and only shown at about 110x35. If a car has no small copy the original
// is tried; if neither exists onMissing runs (callers hide the picture and keep its slot).
// js/img-loader.js still walks .webp, .jpg, .jpeg, .png for each of the two paths.
function _rclCarImg(img, year, carNumber, series, onMissing) {
  var full = rcCarImageSrc(year, carNumber, series);
  if (!full) { if (onMissing) onMissing(); return; }
  var triedFull = false;
  img.onerror = function () {
    if (!triedFull) { triedFull = true; img.src = full; return; }
    if (onMissing) onMissing();
  };
  img.src = full.replace('assets/cars/', 'assets/cars/small/');
}

// Car profile picture for the CAR column: assets/cars/<season year>-<car number>.png (transparent
// PNG, e.g. 2026-85.png). The year is the class's car year from Season setup. A missing picture
// leaves the slot empty so the columns still line up.
function _rclCarPic_(year, carNumber, series) {
  var slot = _rclEl('div', 'rcl-standings-mfr-logo-slot rcl-board-car-slot');
  if (year && carNumber) {
    var img = document.createElement('img');
    img.className = 'rcl-standings-mfr-logo rcl-board-car';
    img.alt = '';
    _rclCarImg(img, year, carNumber, series, function () { img.style.display = 'none'; });
    slot.appendChild(img);
  }
  return slot;
}

function _rclBoardIdentityCells_(row, kind, carYear, carSeries, showTeam) {
  var slot = _rclEl('div', 'rcl-standings-mfr-logo-slot');
  if (row.manufacturer && typeof manufacturerLogoSrc === 'function') {
    var img = document.createElement('img');
    img.className = 'rcl-standings-mfr-logo';
    img.alt = '';
    img.src = manufacturerLogoSrc(row.manufacturer, 'white');
    manufacturerLogoFallback(img, row.manufacturer, function () { img.style.display = 'none'; });
    slot.appendChild(img);
  }
  var num = _rclEl('div', 'rcl-board-num', row.carNumber ? '#' + _rclEscapeHtml(row.carNumber) : '');
  var nameRow = _rclEl('div', 'rcl-standings-name-row rcl-board-name-cell');
  if (kind === 'teams') {
    var teamName = document.createElement('span');
    teamName.className = 'rcl-standings-name';
    teamName.textContent = row.teamName || '';
    nameRow.appendChild(teamName);
  } else {
    nameRow.appendChild(_rclBuildDriverNameEl_('rcl-standings-name', row.name, row.profileId));
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
    // GT / prototype driver boards: the driver's team in gray right after the name.
    if (showTeam && row.teamName) nameRow.appendChild(_rclEl('span', 'rcl-standings-team', _rclEscapeHtml(row.teamName)));
  }
  // Hover shows the full name and number when the name is cut off with "...".
  nameRow.title = (kind === 'teams' ? (row.teamName || '') : (row.name || '')) + (row.carNumber ? ' #' + row.carNumber : '');
  // carYear is set only on boards that show the CAR column (Teams boards and Hypercar).
  return carYear !== undefined ? [slot, _rclCarPic_(carYear, row.carNumber, carSeries), num, nameRow] : [slot, num, nameRow];
}

// "+1 Bonus points for Pole Position, Fastest Lap, Most Laps Led" when every bonus is worth the same,
// "+1 Bonus points for Pole Position, Most Laps Led and +2 bonus points for Fastest Lap" when they
// differ (grouped by value, in this order). Null when the season has no bonus points.
function _rclBoardBonusNote_(hub) {
  var b = hub.bonusPoints || {};
  var groups = [];
  [['pole', 'Pole Position'], ['fastestLap', 'Fastest Lap'], ['mostLapsLed', 'Most Laps Led']].forEach(function (pair) {
    var n = Number(b[pair[0]]) || 0;
    if (n <= 0) return;
    var g = groups.filter(function (x) { return x.n === n; })[0];
    if (!g) { g = { n: n, names: [] }; groups.push(g); }
    g.names.push(pair[1]);
  });
  if (!groups.length) return null;
  return groups.map(function (g, i) {
    return '+' + g.n + (i === 0 ? ' Bonus' : ' bonus') + ' points for ' + g.names.join(', ');
  }).join(' and ');
}

// Footer under each board: the PRELIMINARY / OFFICIAL RESULTS line (no asterisk), the bonus points
// note, and the phone-only "view on PC" line (hidden on desktop and tablet).
function _rclBoardFooter_(board, hub) {
  var foot = _rclEl('div', 'rcl-results-bottom-row rcl-results-status-footer rcl-board-footer');
  var status = hub.lastRace ? _rclBuildResultsStatusNotice_(hub.lastRace, hub.seasonEnded, hub.seasonNumber) : null;
  if (status) {
    status.textContent = status.textContent.replace(/^\*+/, '');
    foot.appendChild(status);
  }
  var bonus = _rclBoardBonusNote_(hub);
  if (bonus) foot.appendChild(_rclEl('div', 'rcl-standings-status-note rcl-board-bonus-note', _rclEscapeHtml(bonus)));
  board.appendChild(foot);
}

function _rclBuildStandingsBoard_(hub, cls, className, kind) {
  var board = _rclEl('div', 'rcl-standings-class rcl-board');
  var head = _rclEl('div', 'rcl-standings-class-header');
  if (className === 'Hypercar') {
    head.textContent = 'RACE CLUB WORLD ENDURANCE CHAMPIONSHIP';
    head.appendChild(_rclEl('span', 'rcl-lr-class-header-sub', ' FOR HYPERCAR DRIVERS'));
  } else {
    head.textContent = 'RACE CLUB ENDURANCE TROPHY';
    head.appendChild(_rclEl('span', 'rcl-lr-class-header-sub', ' FOR ' + _rclEscapeHtml(className.toUpperCase()) + (kind === 'teams' ? ' TEAMS' : ' DRIVERS')));
  }
  board.appendChild(head);

  // One column per race on the calendar (raced or not), in calendar order. Byes and special events
  // have no points round of their own, so they get no column.
  var rounds = (hub.calendar || []).filter(function (e) { return e.kind === 'round'; })
    .sort(function (a, b) { return (a.roundNum || 0) - (b.roundNum || 0); });
  var scoredIdx = {};
  (cls.scoredRoundIds || []).forEach(function (id, i) { scoredIdx[id] = i; });

  // The name column shrinks first (names cut off with "..." down to 140px); only past that does the
  // board scroll sideways, inside the panel. min-width = the fixed columns + 140 + the 6px gaps
  // between columns + the rows' 6px side padding.
  var n = rounds.length;
  var showCar = kind === 'teams' || className === 'Hypercar';
  var carYear = showCar ? (((hub.classSeasons || {})[className]) || '') : undefined;
  var scroller = _rclEl('div', 'rcl-board-scroll');
  var table = _rclEl('div', 'rcl-board-table' + (showCar ? ' rcl-board-has-car' : ''));
  table.style.setProperty('--rcl-board-cols', '44px 78px ' + (showCar ? '110px ' : '') + '44px minmax(140px, 1fr) repeat(' + n + ', 46px) 58px');
  table.style.minWidth = (44 + 58 + (showCar ? 116 : 0) + 44 + 140 + 46 * n + 58 + 6 * (n + 4) + 12) + 'px';

  var hr = _rclEl('div', 'rcl-board-row rcl-board-head');
  hr.appendChild(_rclEl('div', null, 'Pos'));
  hr.appendChild(_rclEl('div', 'rcl-board-manu-head', 'Manu'));
  if (showCar) hr.appendChild(_rclEl('div', 'rcl-board-manu-head', 'Car'));
  hr.appendChild(_rclEl('div', 'rcl-board-num-head', 'N<sup class="rcl-board-num-deg">&deg;</sup>'));
  hr.appendChild(_rclEl('div', 'rcl-board-name-head', kind === 'teams' ? 'Teams' : 'Drivers'));
  rounds.forEach(function (r) {
    var cell = _rclEl('div', 'rcl-board-round-head');
    cell.title = 'Round ' + r.roundNum + (r.track ? ' · ' + r.track : '');
    var flagSrc = (r.country && typeof countryFlagSrc === 'function') ? countryFlagSrc(r.country) : '';
    if (flagSrc) {
      var f = document.createElement('img');
      f.className = 'rcl-board-flag';
      f.src = flagSrc;
      f.alt = '';
      f.onerror = function () { f.style.display = 'none'; cell.appendChild(_rclEl('span', null, 'R' + r.roundNum)); };
      cell.appendChild(f);
    } else {
      cell.appendChild(_rclEl('span', null, 'R' + r.roundNum));
    }
    hr.appendChild(cell);
  });
  hr.appendChild(_rclEl('div', 'rcl-board-total-head', 'Pts'));
  table.appendChild(hr);

  var rows = cls.standings || [];
  scroller.appendChild(table);
  board.appendChild(scroller);
  if (!rows.length) {
    board.appendChild(_rclEmptyState('No Data To Display', 'No entries in this class.'));
    _rclBoardFooter_(board, hub);
    return board;
  }
  rows.forEach(function (row, idx) {
    var rowEl = _rclEl('div', 'rcl-board-row rcl-standings-row' + (RCL_POS_METAL_CLASS_[idx] ? ' ' + RCL_POS_METAL_CLASS_[idx] : ''));
    rowEl.appendChild(_rclBuildPosBadge_(idx));
    _rclBoardIdentityCells_(row, kind, carYear, (hub.carSeries || {})[className + '|' + String(row.carNumber === undefined ? '' : row.carNumber).trim()] || '', kind !== 'teams' && className !== 'Hypercar').forEach(function (cell) { rowEl.appendChild(cell); });
    rounds.forEach(function (r) {
      var cell = _rclEl('div', 'rcl-board-round');
      var i = scoredIdx[r.roundId];
      // Blank for a round not raced yet; 0 for a raced round where this entry scored nothing.
      if (i !== undefined) {
        var total = Number((row.perRound || [])[i]) || 0;
        var bonus = Number((row.perRoundBonus || [])[i]) || 0;
        cell.appendChild(document.createTextNode(String(total - bonus)));
        if (bonus) cell.appendChild(_rclEl('sup', 'rcl-board-bonus', String(bonus)));
        // The drop-week round: still shown, greyed and struck through, so the total makes sense.
        if ((row.perRoundDropped || [])[i]) {
          cell.classList.add('rcl-board-dropped');
          cell.title = 'Dropped round (not counted in the total)';
        }
      }
      rowEl.appendChild(cell);
    });
    var pts = _rclEl('div', 'rcl-standings-pts');
    pts.appendChild(_rclEl('div', 'rcl-standings-pts-num', String(row.championshipPoints)));
    rowEl.appendChild(pts);
    table.appendChild(rowEl);
  });
  _rclBoardFooter_(board, hub);
  return board;
}

// DRIVER LIST (Matt, 2026-10-22): before the first round has results, one panel per class listing the
// season's registrations, laid out like the standings board without the position, round and points
// columns: manufacturer logo, car picture, car number, then the member registered to the car (full
// display name, country flag) with the team in gray. Cars in car-number order. Only cars that have a
// registered driver appear, so the list grows with every registration. hub.driverList comes from the
// server (_rcBuildHubDriverList_, Website.gs) and is only sent while no round has results.
function _rclRenderDriverLists_(hub, host) {
  var list = hub.driverList || [];
  var classes = [];
  list.forEach(function (d) { if (d.className && classes.indexOf(d.className) === -1) classes.push(d.className); });
  _rclBoardSortClasses_(classes).forEach(function (className) {
    var entries = list.filter(function (d) { return d.className === className; }).sort(function (a, b) {
      return (Number(a.carNumber) || 0) - (Number(b.carNumber) || 0) || String(a.carNumber).localeCompare(String(b.carNumber));
    });
    if (!entries.length) return;
    var row = _rclEl('div', 'rcl-row-full');
    var panel = _rclEl('section', 'rcl-panel');
    var bannerKind = className === 'Hypercar' ? 'hyper' : ((className === 'LMP2' || className === 'LMP3') ? 'proto' : 'gt');
    var headEl = _rclEl('div', 'rcl-panel-head rcl-panel-head-banner rcl-panel-head-banner-' + bannerKind);
    headEl.appendChild(_rclEl('div', 'rcl-panel-title', _rclEscapeHtml(className) + ' Driver List'));
    var bodyEl = _rclEl('div', 'rcl-panel-body');
    var board = _rclEl('div', 'rcl-standings-class rcl-board rcl-driverlist');
    var head = _rclEl('div', 'rcl-standings-class-header');
    head.textContent = className.toUpperCase() + ' DRIVER LIST';
    if (hub.seasonNumber) head.appendChild(_rclEl('span', 'rcl-lr-class-header-sub', ' FOR SEASON ' + _rclEscapeHtml(String(hub.seasonNumber))));
    board.appendChild(head);
    var carYear = ((hub.classSeasons || {})[className]) || '';
    var scroller = _rclEl('div', 'rcl-board-scroll');
    var table = _rclEl('div', 'rcl-board-table rcl-board-has-car');
    table.style.setProperty('--rcl-board-cols', '78px 110px 44px minmax(140px, 1fr)');
    table.style.minWidth = (58 + 116 + 44 + 140 + 6 * 3 + 12) + 'px';
    var hr = _rclEl('div', 'rcl-board-row rcl-board-head');
    hr.appendChild(_rclEl('div', 'rcl-board-manu-head', 'Manu'));
    hr.appendChild(_rclEl('div', 'rcl-board-manu-head', 'Car'));
    hr.appendChild(_rclEl('div', 'rcl-board-num-head', 'N<sup class="rcl-board-num-deg">&deg;</sup>'));
    hr.appendChild(_rclEl('div', 'rcl-board-name-head', 'Drivers'));
    table.appendChild(hr);
    entries.forEach(function (d) {
      var rowEl = _rclEl('div', 'rcl-board-row rcl-standings-row');
      var line = { manufacturer: d.manufacturer, carNumber: d.carNumber, name: d.name, profileId: d.profileId, country: d.country, teamName: d.teamName };
      var series = (hub.carSeries || {})[className + '|' + String(d.carNumber === undefined ? '' : d.carNumber).trim()] || '';
      _rclBoardIdentityCells_(line, 'drivers', carYear, series, true).forEach(function (cell) { rowEl.appendChild(cell); });
      table.appendChild(rowEl);
    });
    scroller.appendChild(table);
    board.appendChild(scroller);
    bodyEl.appendChild(board);
    panel.appendChild(headEl);
    panel.appendChild(bodyEl);
    row.appendChild(panel);
    host.appendChild(row);
  });
}

function _rclRenderStandings(hub) {
  var emptyRow = document.getElementById('rcl-standings-empty-row');
  var body = document.getElementById('rcl-standings-body');
  var host = document.getElementById('rcl-standings-panels');
  if (!body || !host) return;
  body.innerHTML = '';
  // Manufacturers' Standings is moved inside this host (right above the Hypercar board) while the
  // boards are built, so take it back out before the host is cleared.
  var mfr = document.getElementById('rcl-manufacturer-standings');
  if (mfr && host.contains(mfr)) host.parentNode.insertBefore(mfr, host.nextSibling);
  host.innerHTML = '';

  var hasStandings = hub.hasSeason && hub.standings && hub.standings.length;
  // No season at all: Championship Standings is hidden without a word.
  if (!hub.hasSeason) { if (emptyRow) emptyRow.style.display = 'none'; return; }
  // Before any race has actually been run, there's nothing to rank yet -- same hasResults gate the
  // ticker already uses (roundsCompleted > 0).
  var hasResults = (hub.roundsCompleted || 0) > 0;

  // No standings yet (a season with no scored race): the Standings area is hidden without a word, as
  // Manufacturers' Standings and the Team Endurance sections already are (Matt, 2026-10-21). Until the
  // first round has results, the same spot shows one DRIVER LIST panel per class instead (Matt, 2026-10-22).
  if (!hasResults) {
    if (emptyRow) emptyRow.style.display = 'none';
    _rclRenderDriverLists_(hub, host);
    return;
  }
  if (!hasStandings) {
    if (emptyRow) emptyRow.style.display = 'none';
    return;
  }
  if (emptyRow) emptyRow.style.display = 'none';

  var byName = {};
  hub.standings.forEach(function (c) { byName[c.className] = c; });
  _rclBoardSortClasses_(Object.keys(byName)).forEach(function (className) {
    var cls = byName[className];
    // Above each class board: Manufacturers' Standings (Hypercar) or Team Endurance Standings (every
    // other class). Both stay bare on the page, no panel.
    if (className === 'Hypercar') { if (mfr) host.appendChild(mfr); }
    else { var trophy = _rclBuildTeamTrophy_(hub, cls, className); if (trophy) host.appendChild(trophy); }
    var row = _rclEl('div', 'rcl-row-full');
    var panel = _rclEl('section', 'rcl-panel');
    var bannerKind = className === 'Hypercar' ? 'hyper' : ((className === 'LMP2' || className === 'LMP3') ? 'proto' : 'gt');
    var headEl = _rclEl('div', 'rcl-panel-head rcl-panel-head-banner rcl-panel-head-banner-' + bannerKind);
    // Titles never change when a season ends (Matt, 2026-10-13).
    headEl.appendChild(_rclEl('div', 'rcl-panel-title', _rclEscapeHtml(className) + ' Standings'));
    var bodyEl = _rclEl('div', 'rcl-panel-body');
    // Drivers board only. The Drivers/Teams switch and the Teams board were replaced by the Team
    // Endurance Standings section above each non-Hypercar board.
    bodyEl.appendChild(_rclBuildStandingsBoard_(hub, cls, className, 'drivers'));
    panel.appendChild(headEl);
    panel.appendChild(bodyEl);
    row.appendChild(panel);
    host.appendChild(row);
  });
}

// TEAM ENDURANCE STANDINGS: every class except Hypercar. Bare on the page like Manufacturers'
// Standings. A team here is one car entry (team name + car number), the same rows the old Teams board
// listed. Top 3 as a podium (P2 / P1 / P3), then 4th onward in two columns. The signed-in driver's
// own team is bold. Hidden until the class has any points.
function _rclBuildTeamTrophy_(hub, cls, className) {
  if (!hub || !hub.hasSeason || !((hub.roundsCompleted || 0) > 0)) return null;
  var list = (cls && cls.standings) || [];
  if (!list.length || !list.some(function (t) { return Number(t.championshipPoints) > 0; })) return null;
  var year = ((hub.classSeasons || {})[className]) || '';
  var me = _rclMyProfileId_();
  var box = _rclEl('div', 'rcl-row-full rcl-tt');
  box.appendChild(_rclEl('div', 'rcl-mfr-title', 'Team Endurance Standings'));
  box.appendChild(_rclEl('div', 'rcl-mfr-subtitle', _rclEscapeHtml(className) + ' Class'));
  var ptsText = function (t) { return String(t.championshipPoints) + (Number(t.championshipPoints) === 1 ? ' PT' : ' PTS'); };
  var isMe = function (t) { return !!me && t.profileId === me; };
  var carSlot = function (t, slotClass) {
    var slot = _rclEl('span', slotClass);
    if (year && t.carNumber) {
      var img = document.createElement('img');
      img.className = 'rcl-tt-car';
      img.alt = '';
      img.loading = 'lazy';
      _rclCarImg(img, year, t.carNumber, (hub.carSeries || {})[className + '|' + String(t.carNumber).trim()] || '', function () { img.remove(); });
      slot.appendChild(img);
    }
    return slot;
  };
  var nameEl = function (t, nameClass) {
    var name = _rclEl('span', nameClass);
    name.appendChild(_rclEl('span', null, _rclEscapeHtml(String(t.teamName || '').toUpperCase())));
    if (t.carNumber) name.appendChild(_rclEl('span', 'rcl-tt-num', ' #' + _rclEscapeHtml(String(t.carNumber))));
    name.title = (t.teamName || '') + (t.carNumber ? ' #' + t.carNumber : '');
    return name;
  };
  var top3 = list.slice(0, 3);
  var podium = _rclEl('div', 'rcl-mfr-podium rcl-tt-podium');
  (top3.length === 3 ? [1, 0, 2] : top3.map(function (_, i) { return i; })).forEach(function (idx) {
    var t = top3[idx];
    var tile = _rclEl('div', 'rcl-mfr-tile rcl-mfr-tile-p' + (idx + 1) + ' rcl-tt-tile' + (isMe(t) ? ' rcl-me' : ''));
    tile.appendChild(carSlot(t, 'rcl-tt-podium-car'));
    var rl = _rclEl('div', 'rcl-mfr-tile-rankline');
    rl.appendChild(_rclEl('span', 'rcl-mfr-tile-rank', String(idx + 1)));
    tile.appendChild(rl);
    tile.appendChild(nameEl(t, 'rcl-mfr-tile-name rcl-tt-tile-name'));
    tile.appendChild(_rclEl('div', 'rcl-mfr-tile-points', ptsText(t)));
    podium.appendChild(tile);
  });
  box.appendChild(podium);
  var rest = list.slice(3);
  if (rest.length) {
    var grid = _rclEl('div', 'rcl-tt-list');
    grid.style.setProperty('--rcl-tt-rows', String(Math.ceil(rest.length / 2)));
    rest.forEach(function (t, i) {
      var r = _rclEl('div', 'rcl-tt-item' + (isMe(t) ? ' rcl-me' : ''));
      r.appendChild(_rclEl('span', 'rcl-tt-rank', (i + 4) + '.'));
      r.appendChild(carSlot(t, 'rcl-tt-car-slot'));
      r.appendChild(nameEl(t, 'rcl-tt-name'));
      r.appendChild(_rclEl('span', 'rcl-tt-pts', ptsText(t)));
      grid.appendChild(r);
    });
    box.appendChild(grid);
  }
  return box;
}

// ---------------------------------------------------------------------
// RECENT RESULTS (last completed race)
// ---------------------------------------------------------------------
// Shared headline builder -- Event on its own line, Winner/Pole/Fastest Lap together on the row
// underneath.
// Shared "Round <n> <EventName> at <Track>: <Layout>" title line builder. Shared by
// _rclBuildRaceHeadline_ (Race headline, below) and _rclBuildQualifyingBody_ (Qualifying tab) so
// the two never drift apart.

// The "Round n" text itself is a bare text node with no class of its own (same as it's always been)
// -- it inherits .rcl-race-headline-eventname's own color/weight (var(--rcl-ink), a near-white
// #f2f2f0, and no bold -- only the event NAME span below gets font-weight 800), which already reads
// as "white, normal weight" with no extra CSS needed.
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

// Icons for the All Results popup's per-class category breakdown.
var _RCL_ICON_TROPHY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8v5a4 4 0 0 1-8 0V3z"></path><path d="M8 4H4a3 3 0 0 0 3 5"></path><path d="M16 4h4a3 3 0 0 1-3 5"></path><path d="M12 12v4"></path><path d="M9 20h6"></path><path d="M10 20v-2.5"></path><path d="M14 20v-2.5"></path></svg>';
var _RCL_ICON_LAPS_LED = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path><path d="M3 21v-5h5"></path></svg>';
var _RCL_ICON_POLE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="21" x2="6" y2="3"></line><path d="M6 4l12 4-12 4"></path></svg>';
var _RCL_ICON_STOPWATCH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l3 2"></path><path d="M9 2h6"></path><path d="M12 2v3"></path></svg>';

// Icons for the Last Race section's 10 possible "headline mention" tiles -- same 16x16/viewBox
// 24/stroke-1.8 convention as every other icon on this page.
var _RCL_ICON_TRENDING_UP = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"></path><path d="M15 7h6v6"></path></svg>';
var _RCL_ICON_TRENDING_DOWN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l6 6 4-4 8 8"></path><path d="M15 17h6v-6"></path></svg>';
var _RCL_ICON_WARNING = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3L2 21h20L12 3z"></path><line x1="12" y1="9" x2="12" y2="14"></line><line x1="12" y1="17.3" x2="12" y2="17.31"></line></svg>';
var _RCL_ICON_SHIELD_CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z"></path><path d="M9 12l2 2 4-4"></path></svg>';
var _RCL_ICON_CAMERA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-2h6l2 2h3v11H4V8z"></path><circle cx="12" cy="13.5" r="3.5"></circle></svg>';
var _RCL_ICON_BOLT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"></path></svg>';
var _RCL_ICON_REBOUND = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5v6a5 5 0 0 0 5 5h11"></path><path d="M16 12l4 4-4 4"></path></svg>';
var _RCL_ICON_FLAME = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c3 4-3 5-3 9a3 3 0 0 0 6 0c0-1-1-2-1-2 2 1 3 3 3 5a5 5 0 0 1-10 0c0-5 5-6 5-12z"></path></svg>';
var _RCL_ICON_CONVERGE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l7 6-7 6"></path><path d="M20 6l-7 6 7 6"></path></svg>';
var _RCL_ICON_SWAP_VERTICAL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v12"></path><path d="M4 13l3 3 3-3"></path><path d="M17 20V8"></path><path d="M20 11l-3-3-3 3"></path></svg>';

var RCL_MENTION_ICON_BY_TYPE_ = {
  hardCharger: _RCL_ICON_TRENDING_UP,
  fallenFavorite: _RCL_ICON_TRENDING_DOWN,
  chaosAgent: _RCL_ICON_WARNING,
  ironMan: _RCL_ICON_SHIELD_CHECK,
  photoFinish: _RCL_ICON_CAMERA,
  statementLap: _RCL_ICON_BOLT,
  bounceBack: _RCL_ICON_REBOUND,
  streakWatch: _RCL_ICON_FLAME,
  closingIn: _RCL_ICON_CONVERGE,
  positionSwap: _RCL_ICON_SWAP_VERTICAL
};

// Season-level mention icons -- same 16x16/viewBox 24/stroke-1.8 icon convention, backing
// _rcComputeClassSeasonMentions_'s pool of 8 (Results.gs).
var _RCL_ICON_TROPHY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0V4z"></path><path d="M8 5H5a3 3 0 0 0 3 5"></path><path d="M16 5h3a3 3 0 0 1-3 5"></path><path d="M9 20h6"></path><path d="M12 13v4"></path></svg>';
var _RCL_ICON_FLAG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v18"></path><path d="M5 4h13l-3 4 3 4H5"></path></svg>';
var _RCL_ICON_CHECKLIST = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h10"></path><path d="M9 12h10"></path><path d="M9 18h10"></path><path d="M4 6l1 1 2-2"></path><path d="M4 12l1 1 2-2"></path><path d="M4 18l1 1 2-2"></path></svg>';

var RCL_SEASON_MENTION_ICON_BY_TYPE_ = {
  seasonDominance: _RCL_ICON_TROPHY,
  titleFight: _RCL_ICON_CONVERGE,
  ironManSeason: _RCL_ICON_SHIELD_CHECK,
  polePositionKing: _RCL_ICON_FLAG,
  fastestLapKing: _RCL_ICON_BOLT,
  seasonSurge: _RCL_ICON_TRENDING_UP,
  underdogStory: _RCL_ICON_REBOUND,
  mrConsistency: _RCL_ICON_CHECKLIST
};

// Race Recap icons: Most Laps Led, Pole Sitter and Fastest Lap (no Winner icon -- P1 already says
// it). Returns the list of {key, icon, label} categories this class has, each with a matcher that
// says whether a given standings row earned it.
function _rclRecapAwards_(cls) {
  function same(name, num, row) {
    if (!name) return false;
    if (String(row.name || '') !== String(name)) return false;
    return !num || String(row.carNumber || '') === String(num);
  }
  var list = [];
  if (cls.classMostLapsLedDriver && cls.classMostLapsLedCount) {
    list.push({ key: 'laps', icon: _RCL_ICON_LAPS_LED, label: 'Most Laps Led', has: function (r) { return same(cls.classMostLapsLedDriver, cls.classMostLapsLedCarNumber, r); } });
  }
  if (cls.classPoleSitter) {
    list.push({ key: 'pole', icon: _RCL_ICON_POLE, label: 'Pole Sitter', has: function (r) { return same(cls.classPoleSitter, cls.classPoleSitterCarNumber, r); } });
  }
  if (cls.classFastestLapDriver) {
    list.push({ key: 'fastest', icon: _RCL_ICON_STOPWATCH, label: 'Fastest Lap', has: function (r) { return same(cls.classFastestLapDriver, cls.classFastestLapCarNumber, r); } });
  }
  return list;
}

// The key shown under a class's results board.
function _rclBuildRecapIconKey_(awards) {
  if (!awards.length) return null;
  var wrap = _rclEl('div', 'rcl-recap-key');
  awards.forEach(function (a) {
    var item = _rclEl('span', 'rcl-recap-key-item');
    item.appendChild(_rclEl('span', 'rcl-recap-key-icon', a.icon));
    item.appendChild(document.createTextNode(a.label));
    wrap.appendChild(item);
  });
  return wrap;
}

// The little icons shown right after a driver's name in the board.
function _rclRecapNameIcons_(awards, row) {
  var got = awards.filter(function (a) { return a.has(row); });
  if (!got.length) return null;
  var wrap = _rclEl('span', 'rcl-recap-name-icons');
  got.forEach(function (a) {
    var ic = _rclEl('span', 'rcl-recap-name-icon', a.icon);
    ic.title = a.label;
    wrap.appendChild(ic);
  });
  return wrap;
}

// One sub-section per class: a top-3 podium-STAND graphic, then a 3-across row of "headline
// mention" tiles sitting on the same row as the podium.
// ONE header for every Race Recap page (Highlights, Race Results, Qualify Results, Race Report,
// Penalties Assessed): the metal bar, the title, then the lighter "FROM ROUND N AT <TRACK>" (the
// track is the Tracks ShortName the round payload already carries). `r` is a round payload (or
// hub.lastRace); with no round number or track the bar shows the title alone.
function _rclRecapHeader_(title, r) {
  var headerDiv = _rclEl('div', 'rcl-standings-class-header');
  headerDiv.appendChild(document.createTextNode(String(title || '').toUpperCase()));
  if (r && (r.roundNum || r.track)) {
    var fromBits = 'FROM ROUND ' + (r.roundNum || '') + (r.track ? (' AT ' + String(r.track).toUpperCase()) : '');
    headerDiv.appendChild(_rclEl('span', 'rcl-lr-class-header-sub', ' ' + fromBits));
  }
  return headerDiv;
}

// ONE shared builder for a race's per-class highlights (header bar, podium, headline-mention cards).
// Used by BOTH the Last Race box (raceResult = hub.lastRace) and the Race Recap popup's Highlights
// page (raceResult = that round's getPublicRoundResults payload, the same payload and cache entry
// the Race page uses). Both shapes carry roundNum, track and classes[].standings/headlineMentions.
// Classes arrive pre-sorted Hypercar -> LMP2 -> LMP3 -> LMGT3 -> LMGTE.
function _rclBuildRaceHighlightBlocks_(hub, raceResult, container) {
  var r = raceResult || {};
  // Name -> profile link lookup for the mention cards: the hub-wide index first, then this
  // race's own standings (a past round can include drivers who are not in today's tables).
  _rclIndexLastRaceNames_(hub);
  (r.classes || []).forEach(function (c) {
    (c.standings || []).forEach(function (row) {
      if (row && row.name && row.profileId) _rclLastRaceNameToPid_[String(row.name).trim().toLowerCase()] = row.profileId;
    });
  });
  (r.classes || []).forEach(function (cls) {
    var clsWrap = _rclEl('div', 'rcl-lr-class');
    // Same graphite header bar Current Standings uses, but reads "<CLASS> HIGHLIGHTS": the podium
    // plus headline-mention story for the class, not a standings table.
    var headerDiv = _rclRecapHeader_((cls.className || 'CLASS') + ' HIGHLIGHTS', r);
    clsWrap.appendChild(headerDiv);
    clsWrap.appendChild(_rclBuildLastRacePodium_(cls, (hub.classSeasons || {})[cls.className], hub.carSeries || {}));
    if ((cls.headlineMentions || []).length) {
      clsWrap.appendChild(_rclBuildLastRaceMentions_(cls.headlineMentions));
    }
    container.appendChild(clsWrap);
  });
}

function _rclRenderLastRace_(hub) {
  var body = document.getElementById('rcl-last-race');
  if (!body) return;
  body.innerHTML = '';

  // No in-body "Last Race" title any more -- the section is back in a .rcl-panel (league.html) with
  // its own .rcl-panel-title, same as League News, so this body would otherwise show the title
  // twice.
  // Event title line + the *OFFICIAL/PRELIMINARY RESULTS status footer/mobile nudge/gray divider
  // line (_rclBuildRaceHeadline_, _rclAppendResultsStatusNotice_) are BOTH gone -- the first
  // class's own graphite header bar now sits directly under the panel's red underline, and nothing
  // follows the last class's mentions.
  var seasonEnded = !!hub.seasonEnded;
  var hasSeason = !!hub.hasSeason;
  var hasLastRaceData = seasonEnded ? !!hub.lastSeason : !!hub.lastRace;
  var showPreview = hasSeason && !seasonEnded && !hasLastRaceData;
  var titleEl = document.getElementById('rcl-last-race-title');
  if (titleEl) {
    var lastRoundNum = (hub.lastRace && Number(hub.lastRace.roundNum)) || 0;
    titleEl.textContent = seasonEnded ? 'Season Recap' : (showPreview ? 'Season Preview' : (lastRoundNum ? 'Round ' + lastRoundNum + ' Highlights' : 'Last Race'));
  }
  body.classList.toggle('rcl-seasonfmt-modal-body', showPreview);

  // (The RACE RECAP button that used to sit at the right end of this header was removed; the Race Recap
  // popup is still opened from the calendar's RACE RECAP buttons.) Remove any leftover copy from an older draw.
  var recapHead = document.querySelector('#rcl-last-race-panel .rcl-panel-head');
  if (recapHead) {
    var oldRecap = recapHead.querySelector('.rcl-metal-button');
    if (oldRecap) oldRecap.parentNode.removeChild(oldRecap);
  }

  var panel = document.getElementById('rcl-last-race-panel');
  var row = document.getElementById('rcl-news-lastrace-row');
  if (panel) panel.style.display = hasSeason ? '' : 'none';
  if (row) row.classList.toggle('rcl-news-lastrace-row-newsonly', !hasSeason);
  if (!hasSeason) return;

  if (!hasLastRaceData) {
    _rclAppendSeasonFormatSections_(hub, body);
    return;
  }
  _rclIndexLastRaceNames_(hub);

  if (seasonEnded) {
    var ls = hub.lastSeason;
    // Classes arrive pre-sorted Hypercar -> LMP2 -> LMP3 -> LMGT3 -> LMGTE, same as
    // hub.lastRace.classes (_rcBuildSeasonStandings_ sorts the same way hub.standings already
    // does).
    (ls.classes || []).forEach(function (cls) {
      var clsWrap = _rclEl('div', 'rcl-lr-class');
      var headerDiv = _rclEl('div', 'rcl-standings-class-header');
      headerDiv.appendChild(document.createTextNode((cls.className || 'CLASS').toUpperCase() + ' HIGHLIGHTS'));
      // "FROM SEASON <N>", same lighter-weight sub-span the in-season Last Race header uses for
      // "FROM ROUND N AT TRACK" (rcl-lr-class-header-sub) -- "FROM" carries the same style as
      // "SEASON <N>" here, both inside the one sub-span, rather than "FROM" reading as part of the
      // bold "<CLASS> HIGHLIGHTS" text.
      if (hub.seasonNumber) {
        headerDiv.appendChild(_rclEl('span', 'rcl-lr-class-header-sub', ' FROM SEASON ' + hub.seasonNumber));
      }
      clsWrap.appendChild(headerDiv);
      clsWrap.appendChild(_rclBuildLastRacePodium_(cls, (hub.classSeasons || {})[cls.className], hub.carSeries || {}));
      if ((cls.mentions || []).length) {
        clsWrap.appendChild(_rclBuildLastSeasonMentions_(cls.mentions));
      }
      body.appendChild(clsWrap);
    });
    return;
  }

  var r = hub.lastRace;

  // Same per-class highlights blocks the Race Recap popup's Highlights page draws (one shared function).
  _rclBuildRaceHighlightBlocks_(hub, r, body);

  // Footer under a line: opens the Race Recap popup on this race. hub.lastRace carries no roundId, so the
  // round is matched by round number against hub.resultsRounds (falls back to the popup's default round).
  var recapRounds = hub.resultsRounds || [];
  if (recapRounds.length) {
    var match = null;
    recapRounds.forEach(function (rr) { if (!match && r.roundNum && Number(rr.roundNum) === Number(r.roundNum)) match = rr; });
    var footer = _rclEl('div', 'rcl-lr-footer');
    var footBtn = _rclEl('button', 'rcl-lr-footer-link', 'SEE THE FULL RACE RECAPS AND DRIVER REPORTS <span class="rcl-lr-footer-arrow" aria-hidden="true">&rarr;</span>');
    footBtn.type = 'button';
    footBtn.addEventListener('click', function () { _rclOpenAllResultsModal(hub, match ? match.roundId : undefined); });
    footer.appendChild(footBtn);
    body.appendChild(footer);
  }
}

// Podium-STAND graphic for one class's top 3: classic left-to-right P2/P1/P3 order, P1's stand
// tallest and centered (gold), P2 to its left (silver), P3 to its right (bronze, shortest) -- the
// PLACE NUMBER lives inside the stand, vertically centered; the driver's identity (manufacturer
// logo above a flag + car number + name line) sits above the stand, not inside a boxed tile like
// Manufacturers' Standings' logo tiles.
function _rclBuildLastRacePodium_(cls, carYear, carSeriesMap) {
  var top3 = (cls.standings || []).slice(0, 3);
  var podium = _rclEl('div', 'rcl-lr-podium');
  if (!top3.length) {
    podium.appendChild(_rclEmptyState('No Data To Display', 'No classified finishers yet.'));
    return podium;
  }
  // Same fallback as the Manufacturers' podium (_rclRenderManufacturerStandings) for a sparse field
  // -- plain rank order instead of a P2/P1/P3 "center" that doesn't exist with only 1 or 2
  // finishers.
  var displayOrder = (top3.length === 3) ? [1, 0, 2] : top3.map(function (_, i) { return i; });
  displayOrder.forEach(function (rankIdx) {
    var row = top3[rankIdx];
    if (!row) return;
    var dnf = _rclIsDnf_(row);
    var tile = _rclEl('div', 'rcl-lr-podium-tile rcl-lr-podium-tile-p' + (rankIdx + 1));

    var driverWrap = _rclEl('div', 'rcl-lr-podium-driver');
    // Car picture (assets/cars/<year>-<number>.png) instead of the maker logo; no picture = nothing.
    if (carYear && row.carNumber) {
      var img = document.createElement('img');
      img.className = 'rcl-lr-podium-car';
      img.alt = '';
      _rclCarImg(img, carYear, row.carNumber, (carSeriesMap || {})[(cls.className || '') + '|' + String(row.carNumber).trim()], function () { img.style.display = 'none'; });
      driverWrap.appendChild(img);
    }

    // Name first, no flag (removed), and no car number here any more.
    var identity = _rclEl('div', 'rcl-lr-podium-identity');
    // A link to the driver's profile when the profile ID is known (the helper adds the .rcl-me bold for the signed-in driver).
    identity.appendChild(_rclBuildDriverNameEl_('rcl-lr-podium-name' + (dnf ? ' rcl-lr-podium-name-dnf' : ''), (row.name || '').toUpperCase(), row.profileId));
    if (row.carNumber) identity.appendChild(_rclEl('span', 'rcl-lr-podium-num', '#' + _rclEscapeHtml(row.carNumber)));
    driverWrap.appendChild(identity);
    tile.appendChild(driverWrap);

    // Ordinal suffix (st/nd/rd), top-aligned against the number rather than
    // centered/baseline-aligned -- always one of these three since this is a top-3 podium, no need
    // for the general ordinal- suffix logic (11th/12th/13th etc.) a season-long list would need.
    var stand = _rclEl('div', 'rcl-lr-podium-stand');
    var standNumWrap = _rclEl('span', 'rcl-lr-podium-standnum-wrap');
    standNumWrap.appendChild(_rclEl('span', 'rcl-lr-podium-standnum', String(rankIdx + 1)));
    standNumWrap.appendChild(_rclEl('span', 'rcl-lr-podium-standsuffix', ['', 'st', 'nd', 'rd'][rankIdx + 1] || ''));
    stand.appendChild(standNumWrap);
    tile.appendChild(stand);

    podium.appendChild(tile);
  });
  return podium;
}

// Driver names under a Last Race / Last Season highlight tile, joined with " & ". Mentions carry names
// but no profile ID, so the signed-in driver is matched by display name and shown in bold.
// Display name (lower case) -> profile ID, rebuilt on every Last Race draw from the hub's standings and
// last race rows, so a highlight tile's driver name can link to that driver's profile.
var _rclLastRaceNameToPid_ = {};
function _rclIndexLastRaceNames_(hub) {
  var map = {};
  function add(rows) {
    (rows || []).forEach(function (r) { if (r && r.name && r.profileId) map[String(r.name).trim().toLowerCase()] = r.profileId; });
  }
  (hub.standings || []).forEach(function (c) { add(c.standings); });
  ((hub.lastRace && hub.lastRace.classes) || []).forEach(function (c) { add(c.standings); });
  ((hub.lastSeason && hub.lastSeason.classes) || []).forEach(function (c) { add(c.standings); });
  _rclLastRaceNameToPid_ = map;
}
function _rclMentionDriversEl_(m) {
  var names = (m.drivers || []).map(function (d) { return d.name; }).filter(Boolean);
  if (!names.length) return null;
  var myName = '';
  var el = _rclEl('div', 'rcl-lr-mention-drivers');
  names.forEach(function (n, i) {
    if (i > 0) el.appendChild(document.createTextNode(' & '));
    var pid = _rclLastRaceNameToPid_[String(n).trim().toLowerCase()] || '';
    var span = _rclBuildDriverNameEl_((myName && String(n).trim().toLowerCase() === myName) ? 'rcl-me' : '', n, pid);
    el.appendChild(span);
  });
  return el;
}

// 3-across "headline mention" row, sitting on the same row as the podium.
function _rclBuildLastRaceMentions_(mentions) {
  var grid = _rclEl('div', 'rcl-lr-mentions');
  mentions.slice(0, 3).forEach(function (m) {
    var tile = _rclEl('div', 'rcl-lr-mention-tile');
    var head = _rclEl('div', 'rcl-lr-mention-head');
    head.appendChild(_rclEl('span', 'rcl-lr-mention-icon', RCL_MENTION_ICON_BY_TYPE_[m.typeKey] || ''));
    head.appendChild(_rclEl('span', 'rcl-lr-mention-title', _rclEscapeHtml((m.title || '').toUpperCase())));
    tile.appendChild(head);
    tile.appendChild(_rclEl('div', 'rcl-lr-mention-stat', _rclEscapeHtml(m.stat || '')));
    var driversEl = _rclMentionDriversEl_(m);
    if (driversEl) tile.appendChild(driversEl);
    tile.appendChild(_rclEl('div', 'rcl-lr-mention-narrative', _rclEscapeHtml(m.narrative || '')));
    grid.appendChild(tile);
  });
  return grid;
}

// Same tile shape as _rclBuildLastRaceMentions_ above, just 4-across instead of 3, and reading the
// season-level icon map/typeKeys (_rcComputeClassSeasonMentions_, Results.gs) instead of the
// race-level pool.
function _rclBuildLastSeasonMentions_(mentions) {
  var grid = _rclEl('div', 'rcl-lr-mentions rcl-lr-mentions-season');
  mentions.slice(0, 4).forEach(function (m) {
    var tile = _rclEl('div', 'rcl-lr-mention-tile');
    var head = _rclEl('div', 'rcl-lr-mention-head');
    head.appendChild(_rclEl('span', 'rcl-lr-mention-icon', RCL_SEASON_MENTION_ICON_BY_TYPE_[m.typeKey] || ''));
    head.appendChild(_rclEl('span', 'rcl-lr-mention-title', _rclEscapeHtml((m.title || '').toUpperCase())));
    tile.appendChild(head);
    tile.appendChild(_rclEl('div', 'rcl-lr-mention-stat', _rclEscapeHtml(m.stat || '')));
    var driversEl = _rclMentionDriversEl_(m);
    if (driversEl) tile.appendChild(driversEl);
    tile.appendChild(_rclEl('div', 'rcl-lr-mention-narrative', _rclEscapeHtml(m.narrative || '')));
    grid.appendChild(tile);
  });
  return grid;
}

// "*PRELIMINARY RESULTS (date)"/"*OFFICIAL RESULTS (date)" notice -- moved off the top of Current
// Standings (was "Preliminary Results Pending League Review"/"Official Results", no date, two
// different colors) down to the bottom of Recent Results/Current Standings/the All Results popup,
// always in the same gold accent color now ("Both should be the same gold color as the current
// preliminary standings message" -- .rcl-standings-status-preliminary, #e0b64c) with a "date of
// posting" appended: finalizedAt once a round's results are official, otherwise the race session's
// own importedAt (when the results were first posted, still preliminary).
// ---------------------------------------------------------------------
// Entirely derived from hub.standings, which already carries each Hypercar driver's `manufacturer`
// and `championshipPoints` (no new server data) -- see _rcBuildSeasonStandings_, Results.gs.
// ---------------------------------------------------------------------

// Sums each driver's championshipPoints into their manufacturer within the Hypercar class only,
// then returns the top 3 manufacturers by that total, highest first.
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

// Full Hypercar manufacturer standings, every manufacturer with points, highest first -- same
// totals as _rclComputeManufacturerStandings_ above (duplicated rather than sliced out of it so
// that function's own "top 3" contract stays obviously unchanged), used by the ranks-4-and-on list
// added below the top-3 podium.
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

  // No season, or no Hypercar entrants with points yet -- section is silently hidden entirely
  // rather than just left empty -- an empty .rcl-row-full still carries its own margin-top
  // (css/league.css), which would leave a stray gap above Championship Standings instead of
  // actually closing it up. display:none collapses that margin along with everything else; the else
  // branch below resets it back to visible for the next render once a Hypercar class does have
  // points (no full page reload needed for this to reappear).
  // Also hidden until a race has actually been scored (same roundsCompleted gate as the Championship
  // Standings) -- manufacturers can't be ranked before then, even though every Hypercar entrant
  // already exists in the standings at 0 points -- and while no manufacturer has any points.
  var hasResults = (hub.roundsCompleted || 0) > 0;
  var top3 = (hub.hasSeason && hasResults) ? _rclComputeManufacturerStandings_(hub) : [];
  var anyPoints = top3.some(function (m) { return m.points > 0; });
  if (!top3.length || !anyPoints) {
    body.style.display = 'none';
    return;
  }
  body.style.display = '';

  body.appendChild(_rclEl('div', 'rcl-mfr-title', "Manufacturers' Standings"));
  body.appendChild(_rclEl('div', 'rcl-mfr-subtitle', 'Hypercar Class'));

  var podium = _rclEl('div', 'rcl-mfr-podium');
  // Classic podium order left-to-right: P2, P1 (center, tallest), P3. rankIdx is 0-based (0 =
  // P1/gold) -- falls back to plain rank order (P1, P2, ...) if fewer than 3 manufacturers have
  // points yet, since there's no "center" to build around with only 1 or 2 tiles.
  var displayOrder = (top3.length === 3) ? [1, 0, 2] : top3.map(function (_, i) { return i; });
  displayOrder.forEach(function (rankIdx) {
    var entry = top3[rankIdx];
    if (!entry) return;
    var tile = _rclEl('div', 'rcl-mfr-tile rcl-mfr-tile-p' + (rankIdx + 1));
    // Square-at-all-costs box -- a plain width:100% + aspect-ratio:1/1 box wasn't holding square
    // reliably here, so this switches to the old reliable padding-bottom:100% trick instead:
    // percentage padding is always computed off the containing block's WIDTH (even
    // padding-top/bottom), so a box with no declared height and padding-bottom:100% is forced to
    // exactly match its own width, no matter what.
    var box = _rclEl('div', 'rcl-mfr-tile-box');
    var boxInner = _rclEl('div', 'rcl-mfr-tile-box-inner');
    var img = document.createElement('img');
    img.className = 'rcl-mfr-tile-logo';
    img.src = manufacturerLogoSrc(entry.manufacturer, 'white');
    img.alt = entry.manufacturer;
    // Same onerror-hide convention as every other manufacturer logo on this page
    // (manufacturerLogoFallback -- tries a .svg before giving up and hiding the <img> entirely).
    manufacturerLogoFallback(img, entry.manufacturer, function () { img.style.display = 'none'; });
    boxInner.appendChild(img);
    box.appendChild(boxInner);
    tile.appendChild(box);
    var rankWrap = _rclEl('div', 'rcl-mfr-tile-rankline');
    rankWrap.appendChild(_rclEl('span', 'rcl-mfr-tile-rank', String(rankIdx + 1)));
    tile.appendChild(rankWrap);
    // Name on its own line, points on the line below it.
    var nameLine = _rclEl('div', 'rcl-mfr-tile-name', _rclEscapeHtml(entry.manufacturer.toUpperCase()));
    tile.appendChild(nameLine);
    var ptsLine = _rclEl('div', 'rcl-mfr-tile-points', Math.round(entry.points) + ' PTS');
    tile.appendChild(ptsLine);
    podium.appendChild(tile);
  });
  body.appendChild(podium);

  // Rest-of-field list, ranks 4 and on, two columns -- top-to-bottom rank order within each column.
  // Silently omitted when there's nothing beyond the top 3 yet.
  // CSS alone (grid-auto-flow: column) only fills column-major if it already knows how many ROWS
  // each column holds -- an implicit column count has no such limit, so it would just put
  // everything in one tall column instead of wrapping to a second. rowCount here is that explicit
  // height, set as an inline custom property .rcl-mfr-rest reads (css/league.css) rather than a
  // fixed CSS constant, since it depends on how many manufacturers actually have points this
  // season.
  var fullField = _rclComputeManufacturerStandingsFull_(hub);
  var rest = fullField.slice(3);
  if (rest.length) {
    var restList = _rclEl('div', 'rcl-mfr-rest');
    var rowCount = Math.ceil(rest.length / 2);
    restList.style.setProperty('--rcl-mfr-rest-rows', String(rowCount));
    rest.forEach(function (entry, i) {
      var row = _rclEl('div', 'rcl-mfr-rest-item');
      row.appendChild(_rclEl('span', 'rcl-mfr-rest-rank', String(i + 4) + '.'));
      // Small logo (wider than tall, so short wide logos show in full); the slot stays even when a
      // logo is missing so every name lines up.
      var logoSlot = _rclEl('span', 'rcl-mfr-rest-logo-slot');
      var restImg = document.createElement('img');
      restImg.className = 'rcl-mfr-rest-logo';
      restImg.alt = '';
      restImg.src = manufacturerLogoSrc(entry.manufacturer, 'white');
      manufacturerLogoFallback(restImg, entry.manufacturer, function () { restImg.style.display = 'none'; });
      logoSlot.appendChild(restImg);
      row.appendChild(logoSlot);
      row.appendChild(_rclEl('span', 'rcl-mfr-rest-name', _rclEscapeHtml(entry.manufacturer.toUpperCase())));
      row.appendChild(_rclEl('span', 'rcl-mfr-rest-pts', Math.round(entry.points) + ' PTS'));
      restList.appendChild(row);
    });
    body.appendChild(restList);
  }
}

// This notice now always reads the plain preliminary/official-by-date wording, in season or out.
function _rclBuildResultsStatusNotice_(round, seasonEnded, seasonNumber) {
  if (!round) return null;
  var finalized = !!round.resultsFinalized;
  var dateSource = finalized ? round.finalizedAt : (round.importedAt || round.startUtc);
  var dateText = dateSource ? _rclFormatDate(dateSource) : '';
  // "(POSTED ON <date>)" -- was just "(<date>)" with no label.
  var label = (finalized ? '*OFFICIAL RESULTS' : '*PRELIMINARY RESULTS') + (dateText ? ' (POSTED ON ' + dateText + ')' : '');
  return _rclEl('div', 'rcl-standings-status-note rcl-standings-status-preliminary', label);
}

// Mobile-only "view on PC" nudge -- was All Results-only, extended to sit under the same
// *PRELIMINARY/*OFFICIAL RESULTS notice everywhere it appears, not just the All Results popup --
// Recent Results and Current Standings both collapse columns/hide team names at the mobile
// breakpoint too (league.css), so a phone visitor gets the same nudge there.
function _rclBuildMobileViewOnPcNote_() {
  return _rclEl('div', 'rcl-standings-status-note rcl-standings-status-preliminary rcl-standings-status-mobile-note', '**FOR FULL RESULTS, VIEW ON PC BROWSER');
}

// Shared by both branches of _rclRenderLastRace_ (the normal render and its "no lastRace yet"
// empty-state fallback) so the link still shows up whenever the season actually has any completed
// rounds on record, even in the rare case the abbreviated lastRace payload itself came back empty
// for some reason.
function _rclAppendResultsStatusFooter_(body, round, seasonEnded, seasonNumber) {
  var notice = _rclBuildResultsStatusNotice_(round, seasonEnded, seasonNumber);
  if (!notice) return;
  var footer = _rclEl('div', 'rcl-results-bottom-row rcl-results-status-footer');
  footer.appendChild(notice);
  // Mobile-only "view on PC" nudge -- Recent Results/ Current Standings both hide team names on
  // phone width same as All Results (league.css), so it gets the same nudge under its status
  // notice.
  footer.appendChild(_rclBuildMobileViewOnPcNote_());
  body.appendChild(footer);
}

// ---------------------------------------------------------------------
// ALL RESULTS POPUP -- the FULL, uncapped result set for any completed round in the current season,
// picked from a dropdown (hub.resultsRounds, most recent first), plus that round's "Penalties
// Assessed" list.
// ---------------------------------------------------------------------

// Tier effect text for one penalty entry -- effectType/effectSeconds come straight off the
// Adjustments row this penalty was built from (see _rcBuildRoundResultData_'s penaltiesThisRound,
// Results.gs).
function _rclDescribePenaltyEffect_(effectType, effectSeconds) {
  if (effectType === 'Time') return '+' + (Number(effectSeconds) || 0) + 's';
  if (effectType === 'DSQ') return 'Disqualified';
  if (effectType === 'Suspension') return 'Suspended';
  if (effectType === 'Warning') return 'No time or position change';
  return 'Logged';
}

// GAP (to class leader), the View All Results table's one gap column. Derived client-side from
// finishTimeSeconds -- standings arrive sorted by adjusted class position, so index 0 is always the
// class leader.
function _rclFormatGap_(row, leaderRow, rowPenSeconds, leaderPenSeconds) {
  // Suspended-this-round checked before DSQ -- a Tier 7 ruling now removes the driver from THIS
  // race's own classification the same way a DSQ does, so the same "no real gap" short-circuit
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

// INTERVAL (to the car directly ahead), back in the All Results table. Same shape as _rclFormatGap_
// just above, just measured against the row immediately ahead in this class's standings (prevRow)
// instead of the class leader -- the leader/first row has no car ahead of it, so that row always
// shows '--'.
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

// TOTAL TIME as h:mm:ss.mmm. No leading zero on the hours digit, but minutes/seconds are always 2
// digits and milliseconds always 3, matching that example.
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

// Fastest/best lap time, M:SS:mmm. BestLapTime comes off the XML import, and out of Results.gs, as
// a raw decimal-seconds string like "92.3456". No hour component -- unlike _rclFormatTotalTime_
// above (a full race time), a single lap is never going to run an hour.
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

// AVG (KM/H) -- not a stored field, derived from trackLengthMeters (on the round result payload,
// Results.gs) times laps completed, over finish time. A DSQ'd/DNF driver with no usable finish time
// shows a dash rather than a bogus speed.
function _rclFormatAvgSpeed_(row, trackLengthMeters) {
  if (row.suspended) return 'SUS';
  if (row.disqualified) return 'DSQ';
  if (!trackLengthMeters || !row.laps || row.finishTimeSeconds === null || row.finishTimeSeconds === undefined || row.finishTimeSeconds <= 0) return '--';
  var kmh = (trackLengthMeters * row.laps / 1000) / (row.finishTimeSeconds / 3600);
  return kmh.toFixed(1);
}

// Renders one round's full result data (from handleGetPublicRoundResults) into `bodyEl` -- the
// popup's own content area, rebuilt fresh every time the round dropdown changes.
// Race Recap popup, "Race Details" page: how the race was set up. Two columns like the Championship recap:
// "From The Race File" (read from the results file at import, result.raceDetails.fromFile) and "Planned For This
// Round" (the round's schedule and weather plus the season's session format and race rules).
function _rclPlannedRaceRows_(hub, roundId) {
  var rows = [];
  var entry = ((hub && hub.calendar) || []).filter(function (e) { return e.roundId === roundId; })[0];
  if (entry) {
    if (entry.startUtc) rows.push({ label: 'Scheduled', value: _rclFormatDateTime(entry.startUtc) });
    if (entry.raceLengthTier) rows.push({ label: 'Race Length', value: entry.raceLengthTier + (entry.raceLengthMinutes ? ' (' + rcFormatRaceLength(entry.raceLengthMinutes) + ')' : '') });
    if (entry.igPracticeStart) rows.push({ label: 'In-Game Practice Start', value: _rclFormat12h(entry.igPracticeStart) });
    if (entry.igQualifyStart) rows.push({ label: 'In-Game Qualifying Start', value: _rclFormat12h(entry.igQualifyStart) });
    if (entry.igRaceStart) rows.push({ label: 'In-Game Event Time', value: _rclFormat12h(entry.igRaceStart) });
    if (entry.weather) {
      var weatherText = (entry.chanceOfRain || 0) + '% Rain';
      if (entry.temperatureC !== null && entry.temperatureC !== undefined) weatherText += ' · ' + entry.temperatureC + '°C';
      rows.push({ label: 'Weather', value: weatherText });
    }
  }
  var sections = _rclBuildSeasonFormatBlocks_(hub);
  sections.forEach(function (sec) {
    if (sec.pill === 'Season Format' && sec.blocks && sec.blocks.length) {
      // The last block is the session format (practice / qualify lengths, qualifying type); the race length
      // rows are skipped because this round's own length is already listed above.
      sec.blocks[sec.blocks.length - 1].forEach(function (stat) {
        if (!/^Race Duration/.test(stat.label)) rows.push(stat);
      });
    } else if (sec.pill === 'Season Rules') {
      (sec.blocks || []).forEach(function (blk) { blk.forEach(function (stat) { rows.push(stat); }); });
    }
  });
  return rows;
}
function _rclBuildRaceDetailsBody_(hub, roundId, result, bodyEl) {
  bodyEl.innerHTML = '';
  var fromFile = (result && result.raceDetails && result.raceDetails.fromFile) || [];
  var planned = _rclPlannedRaceRows_(hub, roundId);
  if (!result || (!fromFile.length && !planned.length)) {
    bodyEl.appendChild(_rclEmptyState('No Data To Display', 'No race details for this round yet.'));
    return;
  }
  bodyEl.appendChild(_rclRecapHeader_('Race Details', result));
  var cols = _rclEl('div', 'rcl-race-details-cols');
  [['From The Race File', fromFile], ['Planned For This Round', planned]].forEach(function (pair) {
    if (!pair[1].length) return;
    var col = _rclEl('div', 'rcl-race-details-col');
    col.appendChild(_rclEl('div', 'rcl-race-details-head', _rclEscapeHtml(pair[0])));
    pair[1].forEach(function (x) {
      col.appendChild(_rclEl('div', 'rcl-seasonfmt-row', '<span class="rcl-seasonfmt-row-label">' + _rclEscapeHtml(x.label) + ':</span> <span class="rcl-seasonfmt-row-value">' + _rclEscapeHtml(x.value) + '</span>'));
    });
    cols.appendChild(col);
  });
  bodyEl.appendChild(cols);
}

// Race Recap popup, "Highlights" page: the chosen round's Last Race view.
function _rclBuildHighlightsBody_(hub, result, bodyEl) {
  bodyEl.innerHTML = '';
  if (!result || !(result.classes || []).length) {
    bodyEl.appendChild(_rclEmptyState('No Data To Display', 'No posted results for that round.'));
    return;
  }
  _rclBuildRaceHighlightBlocks_(hub, result, bodyEl);
}

function _rclBuildAllResultsBody_(result, bodyEl) {
  bodyEl.innerHTML = '';
  if (!result || !(result.classes || []).length) {
    bodyEl.appendChild(_rclEmptyState('No Data To Display', 'No posted results for that round.'));
    return;
  }

  // .rcl-allresults-select-row's own margin-bottom (css/league.css) supplies the breathing room
  // before the first class section now.

  // A dedicated PEN column (below, penSecondsByProfileId) is a distinct, later ask -- a real grid
  // column, not a badge glued onto Total Time, so it does not undo that revert.

  // profileId -> display name, built off this round's own full standings -- penalties (below) only
  // carry a profileId (see the `against` field on _rcBuildRoundResultData_'s penaltiesThisRound,
  // Results.gs), so this is how the popup resolves a name to show next to each one.
  var namesByProfileId = {};
  // profileId -> total seconds of Time-effect penalties this round, summed. A driver can be hit
  // with more than one time penalty in a round, so this sums every Time-effect adjustment against
  // them rather than showing only the first.
  var penSecondsByProfileId = {};
  (result.penalties || []).forEach(function (p) {
    if (p.effectType !== 'Time' || !p.against) return;
    penSecondsByProfileId[p.against] = (penSecondsByProfileId[p.against] || 0) + (Number(p.effectSeconds) || 0);
  });
  // Classes arrive pre-sorted Hypercar -> LMP2 -> LMP3 -> LMGT3 -> LMGTE.
  (result.classes || []).forEach(function (cls) {
    var clsWrap = _rclEl('div', 'rcl-race-class');
    // "<CLASS> RESULTS" -- no "(n)" count. Same shared graphite bar Recent Results and Current
    // Standings both use.
    clsWrap.appendChild(_rclRecapHeader_((cls.className || 'CLASS') + ' RESULTS', result));

    var recapAwards = _rclRecapAwards_(cls);

    // Column labels, divider line BELOW them -- POS, DRIVER, LAPS, TOTAL TIME, INTERVAL, GAP, AVG
    // (KM/H), BEST LAP, PTS. PEN removed and INTERVAL put back in its slot.
    var headRow = _rclEl('div', 'rcl-race-col-head rcl-race-grid-recap');
    headRow.appendChild(_rclEl('div', null, 'Pos'));
    headRow.appendChild(_rclEl('div', null, 'Manu'));
    headRow.appendChild(_rclEl('div', null, 'N<sup class="rcl-board-num-deg">&deg;</sup>'));
    headRow.appendChild(_rclEl('div', null, 'Driver'));
    headRow.appendChild(_rclEl('div', null, 'Laps'));
    headRow.appendChild(_rclEl('div', null, 'Total Time'));
    headRow.appendChild(_rclEl('div', null, 'Interval'));
    headRow.appendChild(_rclEl('div', null, 'Gap'));
    headRow.appendChild(_rclEl('div', null, 'Avg (KM/H)'));
    headRow.appendChild(_rclEl('div', null, 'Best Lap'));
    headRow.appendChild(_rclEl('div', null, 'Pts'));
    // Column labels + rows sit in a scroller so phones can pan the table sideways; the class header bar above stays put.
    var scroller = _rclEl('div', 'rcl-race-scroll');
    var scrollInner = _rclEl('div', 'rcl-race-scroll-inner');
    scroller.appendChild(scrollInner);
    scrollInner.appendChild(headRow);
    clsWrap.appendChild(scroller);

    var standings = cls.standings || [];
    // Class leader's finish time, for GAP -- standings arrive sorted by adjusted class position, so
    // index 0 is always P1 (or the first non-DSQ'd entry in practice;
    // _rcRecomputeStandingsCacheFromRound_ already sorts DSQ'd drivers to the back, Results.gs).
    var leaderRow = standings.length ? standings[0] : null;

    standings.forEach(function (row, idx) {
      if (row.profileId) namesByProfileId[row.profileId] = row.name;
      var dnf = _rclIsDnf_(row);
      // Pos badge + driver identity, identical markup to Current Standings, same metal coloring by
      // finish position.
      var rowEl = _rclEl('div', 'rcl-race-row rcl-race-grid-recap' + (RCL_POS_METAL_CLASS_[idx] ? ' ' + RCL_POS_METAL_CLASS_[idx] : ''));
      // Suspended (SUS) takes precedence over DSQ/DNF -- synthetic row injected server-side
      // (Results.gs) for every round on/after a Tier 7 ruling's effective round, All Results popup
      // only.
      rowEl.appendChild(_rclBuildPosBadge_(idx, row.suspended ? 'SUS' : (row.disqualified ? 'DSQ' : (dnf ? 'DNF' : undefined))));
      // Same cells as the Standings board: maker logo | N° | driver name + flag (no team name).
      var recapCells = _rclBoardIdentityCells_(row, 'drivers', undefined, '');
      if (dnf) { recapCells[1].classList.add('rcl-recap-dnf'); recapCells[2].classList.add('rcl-standings-identity-dnf'); }
      var nameIcons = _rclRecapNameIcons_(recapAwards, row);
      if (nameIcons) recapCells[2].appendChild(nameIcons);
      recapCells.forEach(function (cell) { rowEl.appendChild(cell); });
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-num', String(row.laps || 0)));
      var penSeconds = row.profileId ? (penSecondsByProfileId[row.profileId] || 0) : 0;
      // Total Time still shows the CORRECTED time -- raw finishTimeSeconds plus this driver's own
      // Time-effect penalty seconds, so a +5s penalty still moves the number shown here even with
      // the PEN column itself gone; Gap and Interval (right below) both need this same correction
      // kept too, or they'd go stale next to Total Time's own corrected number.
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
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-pts', (row.points !== null && row.points !== undefined) ? ('+' + row.points) : '--'));
      scrollInner.appendChild(rowEl);
    });
    var recapKey = _rclBuildRecapIconKey_(recapAwards);
    if (recapKey) clsWrap.appendChild(recapKey);
    bodyEl.appendChild(clsWrap);
  });

  var allResultsNotice = _rclBuildResultsStatusNotice_(result);
  if (allResultsNotice) bodyEl.appendChild(allResultsNotice);
  // Mobile-only "view on PC" nudge (see _rclBuildMobileViewOnPcNote_ above for the full history) --
  // the standings grid above collapses down to just Pos/Driver/Pts on phone widths (see
  // .rcl-race-grid-recap' mobile override, league.css), so a phone visitor is told there's
  // more detail (Laps/Total Time/Pen/Gap/Avg/Best Lap) on a bigger screen.
  // (The "view on PC" note was removed here: the Race Recap tables now keep every column on phones and pan sideways.)
}

// Driver Reports page of the Race Recap (2026-10-21). Looks like the Championship's Driver Report: the
// driver block (car picture, driver, team and number, maker and car), then the same charts, drawn by
// js/league-report.js on a white card. The driver dropdown sits at the right end of the block's row and
// lists every league driver in the race. Each report is fetched from getDriverProfileRound (the same feed the
// driver profile pages use) the first time a driver is picked, then kept for the rest of the visit.
var _rclDriverReportCache_ = {};
var _rclDriverReportPick_ = {};
var _rclDriverReportToken_ = 0;

function _rclDriverReportDrivers_(result) {
  var out = [];
  (result.classes || []).forEach(function (cls) {
    (cls.standings || []).forEach(function (row) {
      if (!row || !row.profileId || !/^RC-\d+$/.test(String(row.profileId))) return;
      out.push({ profileId: row.profileId, name: row.name || row.profileId, carNumber: row.carNumber, teamName: row.teamName || '',
        manufacturer: row.manufacturer || '', carClass: cls.className || row.carClass || '', classPosition: row.classPosition });
    });
  });
  return out;
}

function _rclDriverReportWho_(hub, d, dr) {
  var who = _rccEl('div', 'rc-cs-row rcr-report-who');
  var carNumber = String((dr && dr.carNumber) || d.carNumber || '');
  var year = (hub.classSeasons || {})[d.carClass] || '';
  var series = (hub.carSeries || {})[d.carClass + '|' + carNumber.trim()] || '';
  if (year && carNumber) {
    var picWrap = _rccEl('div', 'rc-cs-logo-wrap');
    var pic = document.createElement('img');
    pic.className = 'rc-cs-logo';
    pic.alt = '';
    pic.onerror = function () { picWrap.style.display = 'none'; };
    pic.src = rcCarImageSrc(year, carNumber, series);
    picWrap.appendChild(pic);
    who.appendChild(picWrap);
  }
  var textCol = _rccEl('div', 'rc-cs-textcol');
  var nameLine = _rccEl('div', 'rc-cs-team-name rc-cs-team-name-flex rcr-who-name');
  var nameEl = document.createElement('a');
  nameEl.className = 'rcr-who-driver';
  nameEl.href = 'profile.html?id=' + encodeURIComponent(d.profileId);
  nameEl.textContent = d.name;
  nameLine.appendChild(nameEl);
  var teamName = (dr && dr.teamName) || d.teamName || '';
  if (teamName || carNumber) nameLine.appendChild(_rccText('span', 'rcr-who-team', teamName + (carNumber ? ' #' + carNumber : '')));
  textCol.appendChild(nameLine);
  var carType = (dr && dr.carType) || '';
  if (d.manufacturer || carType) {
    var carLine = _rccEl('div', 'rc-cs-car-line rc-cs-car-line-flex');
    if (d.manufacturer && typeof manufacturerLogoSrc === 'function') {
      var logo = document.createElement('img');
      logo.className = 'rc-cs-maker-logo';
      logo.alt = d.manufacturer;
      logo.src = manufacturerLogoSrc(d.manufacturer, 'black');
      if (typeof manufacturerLogoFallback === 'function') manufacturerLogoFallback(logo, d.manufacturer, function () { logo.style.display = 'none'; });
      carLine.appendChild(logo);
    }
    if (carType) carLine.appendChild(_rccText('span', null, carType));
    textCol.appendChild(carLine);
  }
  who.appendChild(textCol);
  return who;
}

function _rclBuildDriverReportBody_(hub, roundId, result, el) {
  el.innerHTML = '';
  if (typeof _rccDriverReport !== 'function') { el.appendChild(_rclEmptyState('Driver Reports Unavailable', 'The report could not be loaded. Reload the page and try again.')); return; }
  var drivers = result ? _rclDriverReportDrivers_(result) : [];
  if (!drivers.length) { el.appendChild(_rclEmptyState('No Data To Display', 'Driver reports appear once this round\u2019s race results are uploaded.')); return; }

  var card = _rclEl('div', 'rcl-dr-light');
  var top = _rclEl('div', 'rcl-dr-top');
  var whoHost = _rclEl('div', 'rcl-dr-who');
  whoHost.style.cssText = 'flex:1 1 auto;min-width:0;';
  top.appendChild(whoHost);

  var pickWrap = _rclEl('div', 'rcl-dr-pick');
  var sel = document.createElement('select');
  sel.setAttribute('aria-label', 'Choose a driver');
  sel.appendChild(new Option('Choose a driver', ''));
  var byClass = {}, order = [];
  drivers.forEach(function (d) {
    if (!byClass[d.carClass]) { byClass[d.carClass] = []; order.push(d.carClass); }
    byClass[d.carClass].push(d);
  });
  var showGroups = order.length > 1;
  order.forEach(function (c) {
    var parent = sel;
    if (showGroups) { parent = document.createElement('optgroup'); parent.label = c; sel.appendChild(parent); }
    byClass[c].forEach(function (d) {
      var o = new Option((d.classPosition ? 'P' + d.classPosition + '  ' : '') + d.name + (d.carNumber !== '' && d.carNumber != null ? ' (#' + d.carNumber + ')' : ''), d.profileId);
      parent.appendChild(o);
    });
  });
  pickWrap.appendChild(sel);
  top.appendChild(pickWrap);
  card.appendChild(top);

  var reportHost = _rclEl('div', 'rcl-dr-report');
  card.appendChild(reportHost);
  el.appendChild(card);

  function draw(profileId) {
    var my = ++_rclDriverReportToken_;
    whoHost.innerHTML = '';
    reportHost.innerHTML = '';
    var d = drivers.filter(function (x) { return x.profileId === profileId; })[0];
    if (!d) { reportHost.appendChild(_rclEmptyState('No Data To Display', 'Choose a driver above to see their report for this round.')); return; }
    whoHost.appendChild(_rclDriverReportWho_(hub, d, null));
    var key = d.profileId + '|' + roundId;
    function show(res) {
      if (my !== _rclDriverReportToken_) return;
      reportHost.innerHTML = '';
      if (!res || !res.success) { reportHost.appendChild(_rclEmptyState('Driver Report Unavailable', (res && res.message) || 'Could not load this report right now.')); return; }
      var rep = null;
      try { rep = res.driverReport ? _rccDriverReport(res.driverReport) : null; } catch (err) { rep = null; }
      if (!rep) { reportHost.appendChild(_rclEmptyState('No Data To Display', 'There is no lap data for this driver in this round.')); return; }
      whoHost.innerHTML = '';
      whoHost.appendChild(_rclDriverReportWho_(hub, d, res.driverReport));
      reportHost.appendChild(rep);
      if (res.driverReport.pitNote) reportHost.appendChild(_rccText('p', 'rcr-note', res.driverReport.pitNote));
    }
    if (Object.prototype.hasOwnProperty.call(_rclDriverReportCache_, key)) { show(_rclDriverReportCache_[key]); return; }
    reportHost.appendChild(_rclBuildInlineSpinner_('Loading driver report...'));
    sel.disabled = true;
    fetchApi('getDriverProfileRound', { params: { profileId: d.profileId, roundId: roundId }, timeoutMs: 60000 }).then(function (res) {
      if (res && res.success) _rclDriverReportCache_[key] = res;
      sel.disabled = false;
      show(res);
    }, function () {
      sel.disabled = false;
      show(null);
    }).catch(function () { sel.disabled = false; });
  }

  // Always opens on "Choose a driver".
  sel.value = '';
  sel.addEventListener('change', function () { draw(sel.value); });
  draw('');
}

// Race Report page of the Race Recap: the lap-by-lap report. Uses the same round payload as the
// Race Results page. In-game Drive Thrus and Stop and Gos are lines inside the report itself
// (clause kind 'penalty'); they and the steward penalties are also listed on the Penalties page.
function _rclBuildRaceReportBody_(result, bodyEl) {
  bodyEl.innerHTML = '';
  if (!result || !(result.classes || []).length) {
    bodyEl.appendChild(_rclEmptyState('No Data To Display', 'No posted results for that round.'));
    return;
  }
  // profileId -> display name from this round's standings: steward penalties only carry a profileId.
  var namesByProfileId = {};
  (result.classes || []).forEach(function (c) {
    (c.standings || []).forEach(function (row) { if (row && row.profileId) namesByProfileId[row.profileId] = row.name; });
  });
  // Race Report -- lap-by-lap highlights. Built once at import time from the XML's own lap/event
  // data (_rcBuildRaceReportForSession_, Ingestion.gs) and just rendered here, grouped by lap
  // number for readability.
  var report = result.raceReport || [];
  if (report.length) {
    // Metal header bar, no red heading and no divider line above (the .rcl-race-class wrapper has neither).
    var reportSection = _rclEl('div', 'rcl-race-class');
    reportSection.appendChild(_rclRecapHeader_('Race Report', result));
    var byLap = {};
    var lapOrder = [];
    report.forEach(function (entry) {
      if (!byLap[entry.lapNum]) { byLap[entry.lapNum] = []; lapOrder.push(entry.lapNum); }
      byLap[entry.lapNum].push(entry);
    });
    // Clause kind -> the CSS class that colors it.
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
          // Structured entry -- render each clause as its own span so wall/car/damage/pit/position
          // clauses can be colored independently of the rest of the line.
          // Driver names always render white.
          if (entry.carClass) lineEl.appendChild(_rclClassPill_(entry.carClass));
          // Timestamp -- the earliest underlying event's race time from the green flag (et minus lap 1's et, stamped on each entry as greenFlagEt), mm:ss (or h:mm:ss past
          // the hour mark).
          if (entry.et !== null && entry.et !== undefined) {
            lineEl.appendChild(_rclEl('span', 'rcl-report-timestamp', _rclFormatEventTime_(entry.et - (entry.greenFlagEt || 0))));
          }
          var nameEl = document.createElement('span');
          nameEl.className = 'rcl-report-name';
          nameEl.textContent = entry.name;
          lineEl.appendChild(nameEl);
          var allClauses = entry.positionClause ? entry.clauses.concat([entry.positionClause]) : entry.clauses;
          allClauses.forEach(function (clause, i) {
            lineEl.appendChild(document.createTextNode(i === 0 ? ' ' : ', '));
            var cls = CLAUSE_CLASS[clause.kind];
            // "handed a Drive Thru penalty" is bold red; "serves a ... penalty" stays plain (Matt, 2026-10-11).
            if (!cls && clause.kind === 'penalty' && /^handed/i.test(clause.text)) cls = 'rcl-report-clause-penalty';
            if (cls) {
              // Built by hand rather than via _rclEl -- that helper sets innerHTML, and clause.text
              // (driver-supplied names can flow into it via "contact with X") must never be parsed
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

  if (!report.length) {
    bodyEl.appendChild(_rclEmptyState('No Race Report', 'No race report was recorded for that round.'));
  }
}

// In-game penalties handed out during the race: the Race Report's 'penalty' clauses that start with
// "handed" ("serves a ..." lines are the same penalty being served, so they are not listed).
function _rclInGamePenalties_(result) {
  var out = [];
  (result && result.raceReport || []).forEach(function (entry) {
    (entry.clauses || []).forEach(function (clause) {
      if (clause && clause.kind === 'penalty' && /^handed/i.test(clause.text || '')) {
        out.push({ lapNum: entry.lapNum, name: entry.name, carClass: entry.carClass, text: clause.text });
      }
    });
  });
  return out;
}

// True when the round has steward penalties or in-game penalties (decides if the Penalties page can be picked).
function _rclRoundHasPenalties_(result) {
  if (!result) return false;
  return (result.penalties || []).length > 0 || _rclInGamePenalties_(result).length > 0;
}

// Penalties page of the Race Recap: in-game penalties handed out plus steward penalties
// (Adjustments rows), in race order (Pre-race, lap by lap, Post-race).
function _rclBuildPenaltiesBody_(result, bodyEl) {
  bodyEl.innerHTML = '';
  if (!result || !(result.classes || []).length) {
    bodyEl.appendChild(_rclEmptyState('No Data To Display', 'No posted results for that round.'));
    return;
  }
  var namesByProfileId = {};
  (result.classes || []).forEach(function (c) {
    (c.standings || []).forEach(function (row) { if (row && row.profileId) namesByProfileId[row.profileId] = row.name; });
  });
  var items = [];
  _rclInGamePenalties_(result).forEach(function (g) {
    items.push({ order: Number(g.lapNum) || 0, label: 'Lap ' + g.lapNum, game: g });
  });
  (result.penalties || []).forEach(function (p) {
    var lapVal = p.lapNumber;
    var label = (lapVal === 'Pre-race') ? 'Pre' : (lapVal === 'Post-race') ? 'Post' : (lapVal ? ('Lap ' + lapVal) : '-');
    var order = (lapVal === 'Pre-race') ? -1 : (lapVal === 'Post-race') ? 999999 : (lapVal ? (Number(lapVal) || 0) : 1000000);
    items.push({ order: order, label: label, steward: p });
  });
  if (!items.length) {
    bodyEl.appendChild(_rclEmptyState('No Penalties', 'No penalties were handed out in that race.'));
    return;
  }
  items = items.map(function (it, i) { it.idx = i; return it; }).sort(function (x, y) { return (x.order - y.order) || (x.idx - y.idx); });
  var section = _rclEl('div', 'rcl-race-class');
  section.appendChild(_rclRecapHeader_('Penalties', result));
  items.forEach(function (it) {
    var row = _rclEl('div', 'rcl-report-lap');
    row.appendChild(_rclEl('div', 'rcl-report-lap-num', it.label));
    var textWrap = _rclEl('div', 'rcl-report-lap-text');
    var lineEl = _rclEl('p', 'rcl-report-line');
    var nameEl = document.createElement('span');
    nameEl.className = 'rcl-report-name';
    if (it.game) {
      var g = it.game;
      if (g.carClass) lineEl.appendChild(_rclClassPill_(g.carClass));
      nameEl.textContent = g.name;
      lineEl.appendChild(nameEl);
      lineEl.appendChild(document.createTextNode(' '));
      var gs = document.createElement('span');
      gs.className = 'rcl-report-clause-penalty';
      gs.textContent = g.text;
      lineEl.appendChild(gs);
      lineEl.appendChild(document.createTextNode('.'));
    } else {
      var p = it.steward;
      if (p.carClass) lineEl.appendChild(_rclClassPill_(p.carClass));
      nameEl.textContent = (p.against && namesByProfileId[p.against]) || 'Unknown Driver';
      lineEl.appendChild(nameEl);
      var tierInfo = (typeof penaltyTierByNumber === 'function') ? penaltyTierByNumber(p.penaltyTier) : null;
      var tierPhrase = tierInfo
        ? tierInfo.label.replace(/^Tier (\d+): /, 'Tier $1 ').replace(/\s*\([^)]*\)\s*$/, '')
        : ('Tier ' + (p.penaltyTier || '?'));
      var infractionPhrase = (typeof isSelfReportInfraction === 'function' && isSelfReportInfraction(p.infractionType))
        ? 'self-reported an incident'
        : (p.infractionType || 'Infraction');
      lineEl.appendChild(document.createTextNode(' ' + infractionPhrase + ': ' + tierPhrase + ' '));
      var effectSpan = document.createElement('span');
      effectSpan.className = 'rcl-penalty-effect';
      effectSpan.textContent = '(' + _rclDescribePenaltyEffect_(p.effectType, p.effectSeconds) + ')';
      lineEl.appendChild(effectSpan);
    }
    textWrap.appendChild(lineEl);
    row.appendChild(textWrap);
    section.appendChild(row);
  });
  bodyEl.appendChild(section);
}

// Qualifying tab of "All Results".
function _rclBuildQualifyingBody_(result, bodyEl) {
  bodyEl.innerHTML = '';
  if (!result) {
    bodyEl.appendChild(_rclEmptyState('No Data To Display', 'No posted results for that round.'));
    return;
  }

  if (!result.hasQualifying || !(result.classes || []).length) {
    bodyEl.appendChild(_rclEmptyState('No Qualifying Data', 'No qualifying session was imported for this round.'));
    return;
  }

  // Classes arrive pre-sorted Hypercar -> LMP2 -> LMP3 -> LMGT3 -> LMGTE
  // (CAR_CLASS_CANONICAL_ORDER_, Website.gs), same convention as the Race view above.
  result.classes.forEach(function (cls) {
    var clsWrap = _rclEl('div', 'rcl-race-class');
    clsWrap.appendChild(_rclRecapHeader_((cls.className || 'CLASS') + ' QUALIFY RESULTS', result));

    var headRow = _rclEl('div', 'rcl-race-col-head rcl-race-grid-recap rcl-race-grid-recap-q');
    headRow.appendChild(_rclEl('div', null, 'Pos'));
    headRow.appendChild(_rclEl('div', null, 'Manu'));
    headRow.appendChild(_rclEl('div', null, 'N<sup class="rcl-board-num-deg">&deg;</sup>'));
    headRow.appendChild(_rclEl('div', null, 'Driver'));
    headRow.appendChild(_rclEl('div', null, 'Best Lap'));
    headRow.appendChild(_rclEl('div', null, 'Sector 1'));
    headRow.appendChild(_rclEl('div', null, 'Sector 2'));
    headRow.appendChild(_rclEl('div', null, 'Sector 3'));
    headRow.appendChild(_rclEl('div', null, 'Avg (KM/H)'));
    // Column labels + rows sit in a scroller so phones can pan the table sideways; the class header bar above stays put.
    var scroller = _rclEl('div', 'rcl-race-scroll');
    var scrollInner = _rclEl('div', 'rcl-race-scroll-inner');
    scroller.appendChild(scrollInner);
    scrollInner.appendChild(headRow);
    clsWrap.appendChild(scroller);

    var standings = cls.standings || [];
    if (!standings.length) {
      clsWrap.appendChild(_rclEl('div', 'rcl-empty-state-subtitle', 'No qualifying times posted for this class.'));
    }
    standings.forEach(function (row, idx) {
      var rowEl = _rclEl('div', 'rcl-race-row rcl-race-grid-recap rcl-race-grid-recap-q' + (RCL_POS_METAL_CLASS_[idx] ? ' ' + RCL_POS_METAL_CLASS_[idx] : ''));
      rowEl.appendChild(_rclBuildPosBadge_(idx));
      _rclBoardIdentityCells_(row, 'drivers', undefined, '').forEach(function (cell) { rowEl.appendChild(cell); });
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-bestlap', _rclFormatLapTime_(row.bestLapTime)));
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-num', _rclFormatLapTime_(row.sector1)));
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-num', _rclFormatLapTime_(row.sector2)));
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-num', _rclFormatLapTime_(row.sector3)));
      rowEl.appendChild(_rclEl('div', 'rcl-race-row-avg', (row.avgKmh !== null && row.avgKmh !== undefined) ? String(row.avgKmh) : '--'));
      scrollInner.appendChild(rowEl);
    });
    bodyEl.appendChild(clsWrap);
  });
}

// Omitted/unmatched falls back to that same original behavior unchanged.
function _rclOpenAllResultsModal(hub, preselectRoundId) {
  var rounds = hub.resultsRounds || [];

  var overlay = _rclEl('div', 'rcl-modal-overlay');
  // rcl-modal-dialog-allresults -- a scoping class just for this popup's own mobile overrides
  // (hiding team names, trimming the standings grid down to Pos/Driver/Pts) so they don't also
  // apply to every OTHER popup that reuses .rcl-modal-dialog-wide or _rclBuildDriverIdentity_'s
  // shared .rcl-standings-team markup.
  var dialog = _rclEl('div', 'rcl-modal-dialog rcl-modal-dialog-wide rcl-modal-dialog-allresults');
  var head = _rclEl('div', 'rcl-modal-head');
  // "Race Recap". Purely a label change: still the exact same popup, same dropdown, same
  // Qualifying/Race toggle, same underlying data/endpoints.
  head.appendChild(_rclEl('div', 'rcl-modal-title', 'Race Recap'));
  var closeBtn = _rclEl('button', 'rcl-modal-close', '&times;');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  head.appendChild(closeBtn);
  dialog.appendChild(head);

  var body = _rclEl('div', 'rcl-modal-body');

  if (!rounds.length) {
    body.appendChild(_rclEmptyState('No Data To Display', 'No race results have been posted yet.'));
    dialog.appendChild(body);
    overlay.appendChild(dialog);
    closeBtn.addEventListener('click', function () { document.body.removeChild(overlay); _rclUnlockBodyScroll(); });
    document.body.appendChild(overlay);
    _rclLockBodyScroll();
    return;
  }

  var selectRow = _rclEl('div', 'rcl-allresults-select-row');
  var select = document.createElement('select');
  select.className = 'rcl-allresults-select';
  rounds.forEach(function (r) {
    var opt = document.createElement('option');
    opt.value = r.roundId;
    var label = (r.roundNum ? 'Round ' + r.roundNum + ' - ' : '') + (r.eventName || r.roundId);
    if (r.track) label += ': ' + r.track;
    if (r.startUtc) label += ' (' + _rclFormatDate(r.startUtc) + ')';
    opt.textContent = label;
    select.appendChild(opt);
  });
  selectRow.appendChild(select);

  // Qualifying/Race toggle -- sits beside the round select in the same row
  // (.rcl-allresults-select-row is now a flex row, see league.css). Switching either dropdown
  // re-loads via the shared load() below.
  var sessionSelect = document.createElement('select');
  sessionSelect.className = 'rcl-allresults-session-select';
  // Order: Race Details, Highlights, Race Results, Qualify Results, Driver Reports, Race Report, Penalties.
  // Race Results is the page the recap opens on.
  sessionSelect.appendChild(new Option('Race Details', 'details'));
  sessionSelect.appendChild(new Option('Highlights', 'highlights'));
  sessionSelect.appendChild(new Option('Race Results', 'race'));
  sessionSelect.appendChild(new Option('Qualify Results', 'qualifying'));
  sessionSelect.appendChild(new Option('Driver Reports', 'driver'));
  sessionSelect.appendChild(new Option('Race Report', 'report'));
  // Penalties: greyed out until the round's race data shows at least one penalty (in-game or steward).
  var penOpt = new Option('Penalties', 'penalties');
  penOpt.disabled = true;
  sessionSelect.appendChild(penOpt);
  sessionSelect.value = 'race';
  selectRow.appendChild(sessionSelect);
  body.appendChild(selectRow);

  var resultsWrap = _rclEl('div', 'rcl-allresults-body');
  body.appendChild(resultsWrap);
  dialog.appendChild(body);
  overlay.appendChild(dialog);

  // In-memory cache, this popup instance only.
  var resultCache = {};

  // Both dropdowns are locked while a round/session is being fetched, and unlocked the moment the
  // request ends (worked, failed or auth error). Cached rounds draw instantly and never lock them.
  function busy(on) {
    select.disabled = on;
    sessionSelect.disabled = on;
  }

  // Enables/greys the Penalties option from a round's race payload. If the Penalties page is open
  // on a round with no penalties, falls back to Race Results (already cached, so instant).
  function applyPenOption(roundId, result) {
    if (select.value !== roundId) return;
    var has = _rclRoundHasPenalties_(result);
    penOpt.disabled = !has;
    if (!has && sessionSelect.value === 'penalties') {
      sessionSelect.value = 'race';
      loadRound(select.value, 'race');
    }
  }
  // On the Qualify page the race payload is not otherwise loaded: fetch it quietly (no spinner, no
  // lock) just to decide whether Penalties can be picked.
  function syncPenOption(roundId) {
    var key = roundId + ':race';
    if (Object.prototype.hasOwnProperty.call(resultCache, key)) { applyPenOption(roundId, resultCache[key]); return; }
    penOpt.disabled = true;
    var archived = _rclArchivedRoundPart_(roundId, false);
    var req = archived ? Promise.resolve(archived)
      : fetchApi('getPublicRoundResults', { params: { roundId: roundId }, timeoutMs: RC_FETCH_TIMEOUT_MS_LONG });
    req.then(function (res) {
      var result = (res && res.success) ? res.result : null;
      if (!Object.prototype.hasOwnProperty.call(resultCache, key)) resultCache[key] = result;
      applyPenOption(roundId, resultCache[key]);
    }, function () {}).catch(function () {});
  }

  function loadRound(roundId, sessionKind) {
    // Highlights, Race Results, Driver Reports and Race Report all draw from the same race payload: one
    // getPublicRoundResults call and one cache entry ('race'); only Qualify Results has its own.
    var isQualifying = sessionKind === 'qualifying';
    var dataKind = isQualifying ? 'qualifying' : 'race';
    var cacheKey = roundId + ':' + dataKind;
    var builder = isQualifying ? _rclBuildQualifyingBody_
      : (sessionKind === 'details' ? function (res, el) { _rclBuildRaceDetailsBody_(hub, roundId, res, el); }
      : (sessionKind === 'highlights' ? function (res, el) { _rclBuildHighlightsBody_(hub, res, el); }
      : (sessionKind === 'driver' ? function (res, el) { _rclBuildDriverReportBody_(hub, roundId, res, el); }
      : (sessionKind === 'penalties' ? _rclBuildPenaltiesBody_
      : (sessionKind === 'report' ? _rclBuildRaceReportBody_ : _rclBuildAllResultsBody_)))));
    if (isQualifying) syncPenOption(roundId);
    if (Object.prototype.hasOwnProperty.call(resultCache, cacheKey)) {
      builder(resultCache[cacheKey], resultsWrap);
      if (!isQualifying) applyPenOption(roundId, resultCache[cacheKey]);
      return;
    }
    resultsWrap.innerHTML = '';
    // Standard site loading animation -- the same "starting grid lights" markup as the full-page
    // loader (.rcl-page-loader in league.html) and the Edit Profile popup on this same page
    // (rcOpenEditProfileModalInPlace, edit-profile.js), not the plain "Loading..." text this popup
    // used before.
    resultsWrap.appendChild(_rclBuildInlineSpinner_(isQualifying ? 'Loading qualifying results...' : (sessionKind === 'report' ? 'Loading race report...' : (sessionKind === 'details' ? 'Loading race details...' : sessionKind === 'highlights' ? 'Loading highlights...' : (sessionKind === 'driver' ? 'Loading driver reports...' : (sessionKind === 'penalties' ? 'Loading penalties...' : 'Loading round results...'))))));
    busy(true);
    // getPublicRoundQualifying -- a separate endpoint from getPublicRoundResults, since a Qualify
    // session's data (best lap + sectors, no finish position/gap/interval) has almost nothing in
    // common with a Race session's row shape.
    // BUG FIX (kept): roundId goes inside options.params so fetchApi really puts it on the URL.
    // A past season loaded from its archive file already carries every round's recap data.
    var archivedPart = _rclArchivedRoundPart_(roundId, isQualifying);
    var roundRequest = archivedPart ? Promise.resolve(archivedPart)
      : fetchApi(isQualifying ? 'getPublicRoundQualifying' : 'getPublicRoundResults', { params: { roundId: roundId }, timeoutMs: RC_FETCH_TIMEOUT_MS_LONG });
    roundRequest.then(function (res) {
      busy(false);
      var result = (res && res.success) ? res.result : null;
      resultCache[cacheKey] = result;
      builder(result, resultsWrap);
      if (!isQualifying) applyPenOption(roundId, result);
    }, function () {
      busy(false);
      builder(null, resultsWrap);
    }).catch(function () {
      // Anything thrown while drawing must never leave the dropdowns locked.
      busy(false);
    });
  }

  select.addEventListener('change', function () { loadRound(select.value, sessionSelect.value); });
  sessionSelect.addEventListener('change', function () { loadRound(select.value, sessionSelect.value); });

  // Only honor preselectRoundId if it's actually one of this popup's own round options -- a
  // stale/unknown id just falls through to the original "most recent round" default below.
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
// CALENDAR -- full public season schedule.
// ---------------------------------------------------------------------
// Renders into #rcl-race-carousel (league.html), which is deliberately NOT a .rcl-panel and is
// allowed to bleed past .rcl-main's max-width (see .rcl-carousel-outer's breakout rule,
// css/league.css) so the strip can run the full width of the viewport, exactly like the reference.
// Resolved via AskUserQuestion before building:
function _rclBuildCountdown_(startUtc, onComplete, isSpecial) {
  var wrap = _rclEl('div', 'rcl-carousel-countdown');
  // "Countdown to Special Event" for a special event, same label structure otherwise.
  wrap.appendChild(_rclEl('div', 'rcl-carousel-countdown-label', 'Countdown to <strong>' + (isSpecial ? 'Special Event' : 'Event') + '</strong>'));
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
    // Only actually schedule ticking if tick() above didn't already fire onComplete synchronously
    // (a race whose start time is already in the past the instant this renders).
    timerId = setInterval(tick, 1000);
    _rclCarouselCountdownTimers_.push(timerId);
  }

  return wrap;
}

// Builds the RACE RECAP slot for a finished race: a disabled (unclickable, dimmed) button once the
// race has happened but results aren't imported yet, or the normal active button once they are.
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
  // No current season and no earlier season to show: the calendar is hidden without a word.
  outer.style.display = hub.hasSeason ? '' : 'none';
  if (!hub.hasSeason) { _rclCarouselCountdownTimers_.forEach(function (id) { clearInterval(id); }); _rclCarouselCountdownTimers_.length = 0; return; }

  // Clear every countdown interval the PREVIOUS render of this carousel started --
  // outer.innerHTML='' above already removed their DOM, but an interval keeps firing against
  // detached elements forever otherwise.
  _rclCarouselCountdownTimers_.forEach(function (id) { clearInterval(id); });
  _rclCarouselCountdownTimers_.length = 0;

  var raceEntries = (hub.hasSeason && hub.calendar) ? hub.calendar.filter(function (e) { return e.kind !== 'bye'; }) : [];
  if (!raceEntries.length) {
    outer.appendChild(_rclEmptyState('No Data To Display', 'The season schedule shows up here once it is set.'));
    return;
  }

  var nextIdx = -1;
  raceEntries.forEach(function (entry, idx) { if (nextIdx === -1 && !entry.raceOver) nextIdx = idx; });
  var activeIdx = nextIdx === -1 ? (raceEntries.length - 1) : nextIdx;

  var track = _rclEl('div', 'rcl-carousel-track');
  outer.appendChild(track);

  var itemEls = [];

  // Nothing here moves the track at all any more.
  function setActive(idx) {
    if (idx === activeIdx) return;
    activeIdx = idx;
    itemEls.forEach(function (el, i) {
      el.classList.toggle('rcl-carousel-item-active', i === idx);
    });
  }

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

    // Compact header -- the ONLY thing a side (non-center) item shows now. Text case is left to
    // CSS's text-transform:uppercase on each line, same convention the full header's own lines
    // already use.
    var compactHeader = _rclEl('div', 'rcl-carousel-compact-header');
    if (entry.country && typeof countryFlagSrc === 'function') {
      var compactFlagSrc = countryFlagSrc(entry.country);
      if (compactFlagSrc) {
        var compactFlagImg = document.createElement('img');
        compactFlagImg.className = 'rcl-carousel-flag';
        compactFlagImg.src = compactFlagSrc;
        compactFlagImg.alt = entry.country;
        compactFlagImg.onerror = function () { compactFlagImg.style.display = 'none'; };
        compactHeader.appendChild(compactFlagImg);
      }
    }
    if (entry.track) compactHeader.appendChild(_rclEl('div', 'rcl-carousel-compact-track', _rclEscapeHtml(entry.track.slice(0, 3))));
    if (entry.startUtc) {
      var compactDate = new Date(entry.startUtc);
      if (!isNaN(compactDate.getTime())) {
        compactHeader.appendChild(_rclEl('div', 'rcl-carousel-compact-month', compactDate.toLocaleDateString(undefined, { month: 'short' })));
        compactHeader.appendChild(_rclEl('div', 'rcl-carousel-compact-day', String(compactDate.getDate())));
      }
    }
    item.appendChild(compactHeader);

    // Race details + button -- active-item-only (CSS reveals .rcl-carousel-hero only under
    // .rcl-carousel-item-active). Built every time, not just for the active item, so clicking a
    // side item to make it active never needs a second render pass.
    var hero = _rclEl('div', 'rcl-carousel-hero');

    var detailLines = [];
    // igRaceStart, not startUtc.
    var timeOfDay = _rclTimeOfDayLabel_(entry.igRaceStart);
    var lengthMin = _rclEntryLengthMinutes(entry, hub);
    // raceLengthTier (e.g. "Long") dropped from this line entirely.
    var sessionBits = [];
    if (lengthMin) sessionBits.push(rcFormatRaceLength(lengthMin) + ' Long');
    var sessionLine = (timeOfDay ? (timeOfDay + ' Race') : '') + (sessionBits.length ? ((timeOfDay ? ', ' : '') + sessionBits.join(' ')) : '');
    if (sessionLine) detailLines.push(sessionLine);
    // Weather line reformatted -- one fixed template every time now (condition, then rain chance,
    // then temperature), replacing the old "<weather> & <temp>° with/no N% chance of rain" wording.
    if (entry.weather) {
      var weatherLine = entry.weather + ', ' + (entry.chanceOfRain || 0) + '% Chance Rain';
      if (entry.temperatureC !== null && entry.temperatureC !== undefined) weatherLine += ', ' + entry.temperatureC + '° C';
      detailLines.push(weatherLine);
    }
    if (detailLines.length) {
      var detailsWrap = _rclEl('div', 'rcl-carousel-details');
      detailLines.forEach(function (line) { detailsWrap.appendChild(_rclEl('div', 'rcl-carousel-details-line', _rclEscapeHtml(line))); });
      hero.appendChild(detailsWrap);
    }

    var btnRow = _rclEl('div', 'rcl-carousel-hero-btns');

    // The RACE RECAP slot -- three states: a live countdown while the race hasn't happened yet; a
    // disabled RACE RECAP button the instant that countdown hits zero (whether that's because the
    // page loaded after the race already started, or because the countdown ticked down to it live;
    // the normal clickable RACE RECAP button once results are actually in.
    if (!entry.finished && entry.startUtc) {
      var recapSlot = _rclEl('div', 'rcl-carousel-recap-slot');
      recapSlot.appendChild(_rclBuildCountdown_(entry.startUtc, function () {
        recapSlot.innerHTML = '';
        recapSlot.appendChild(_rclBuildRecapButton_(hub, entry));
      }, isSpecial));
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

  // Fixed track height -- the active item's own natural height isn't constant entry to entry (a
  // live countdown block is taller than a plain RACE RECAP button, and the race-details lines run
  // one or two lines depending on whether weather data is set), so without this, the track's height
  // (and everything below it on the page -- Championship Standings, Manufacturer Standings, ...)
  // reflowed every time a different entry became active.
  requestAnimationFrame(function () {
    var maxHeight = 0;
    itemEls.forEach(function (itemEl) {
      var wasActive = itemEl.classList.contains('rcl-carousel-item-active');
      itemEl.style.transition = 'none';
      if (!wasActive) itemEl.classList.add('rcl-carousel-item-active');
      maxHeight = Math.max(maxHeight, itemEl.scrollHeight);
      if (!wasActive) itemEl.classList.remove('rcl-carousel-item-active');
      itemEl.offsetHeight; // forces the toggle above to land before transition is restored
      itemEl.style.transition = '';
    });
    // Explicit height, not min-height -- a flex container's items stretch (align-items: stretch,
    // above) to the CONTENT-derived cross size of the flex line, and min-height only clamps the
    // container's own box AFTER that -- it never feeds back into how far the items themselves
    // stretch.
    // The track is border-box, so its own top and bottom padding go on top of the tallest card
    // (otherwise the padding is eaten and the space under the carousel can't be changed).
    var trackStyle = getComputedStyle(track);
    var padY = (parseFloat(trackStyle.paddingTop) || 0) + (parseFloat(trackStyle.paddingBottom) || 0);
    if (maxHeight > 0) track.style.height = (maxHeight + padY) + 'px';
  });
}

// RACE INFO popup -- this specific round's own track/session details up top ("This Race"), then the
// season's Season Format + Season Rules sections reused as-is from _rclBuildSeasonFormatBlocks_.
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

  // Same plain "Category: Value" row shape _rclOpenSeasonDetailsModal uses (see that function's own
  // comment for why) -- duplicated here rather than shared since it's a few lines and each popup
  // builds its own body independently.
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
    roundRows.push({ label: 'Race Length', value: entry.raceLengthTier + (entry.raceLengthMinutes ? (' (' + rcFormatRaceLength(entry.raceLengthMinutes) + ')') : '') });
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

// POINTS -- race-length-tier point tables + bonus points.

// ---------------------------------------------------------------------
// NEWS FEED -- admin-authored, Body is plain text with a small set of hand-rolled formatting
// markers the New/Edit Post popup's toolbar inserts (Account.html): **bold**, *italic*,
// ++underline++, lines starting with "> " become a blockquote, and [Link
// Text](mailto:someone@example.com) becomes a real mailto link.
// Clicking either opens the same read-story popup (_rclOpenStoryModal), which can pull in 3 more
// stories at a time via its own "Load More News" button.
// ---------------------------------------------------------------------
function _rclApplyInlineMarkup(escapedText) {
  return escapedText
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\+\+([^+]+)\+\+/g, '<u>$1</u>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Run last, and its own capture groups are matched against the ALREADY-escaped text, so this
    // can't be tricked into matching across an entity like &amp; the way an earlier, greedier pass
    // might.
    .replace(/\[([^\]]+)\]\(mailto:([^)\s"'<>]+)\)/g, '<a class="rcl-news-link" href="mailto:$2">$1</a>');
}

// Renders a story's Body into `container` as real paragraph/blockquote elements -- used inside the
// read-story popup, where the full text shows (no clamping).
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
      // A line starting "## " is a header (<h3>); the lines around it stay ordinary paragraph text.
      var run = [];
      var flushRun = function () {
        if (run.length) container.appendChild(_rclEl('p', null, run.map(_rclApplyInlineMarkup).join('<br>')));
        run = [];
      };
      para.trim().split('\n').forEach(function (line) {
        var hm = /^##\s+(.+)$/.exec(line.trim());
        if (hm) {
          flushRun();
          container.appendChild(_rclEl('h3', 'rcl-news-h', _rclApplyInlineMarkup(hm[1])));
        } else if (line.trim()) {
          run.push(line);
        }
      });
      flushRun();
    }
  });
}

// Flattened, single-block version of the on-page preview -- paragraph breaks become a double
// line-break inside one div instead of separate <p> elements, same reason as before (a single box
// is simpler to style than a paragraph list for a preview).
// Character-based cap, not a CSS line-clamp any more.
function _rclStoryPreviewHtml(rawBody, charLimit) {
  var full = rawBody || '';
  var truncated = !!charLimit && full.length > charLimit;
  var body = full;
  if (truncated) {
    var cut = full.slice(0, charLimit);
    var lastSpace = cut.lastIndexOf(' ');
    if (lastSpace > charLimit * 0.6) cut = cut.slice(0, lastSpace);
    body = cut.replace(/[\s.,;:!?-]+$/, '') + '…';
  }
  var escaped = _rclEscapeHtml(body);
  var paragraphs = escaped.split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
  // "## " lines become block headers (span.rcl-news-h, display:block); they carry their own spacing,
  // so no <br> goes next to them.
  var html = '';
  var lastType = null; // type of the last part added, across paragraphs: nothing extra goes right after a header
  paragraphs.forEach(function (p, pi) {
    var parts = [], text = [];
    p.split('\n').forEach(function (line) {
      var hm = /^##\s+(.+)$/.exec(line.trim());
      if (hm) {
        if (text.length) { parts.push({ t: 'p', h: text.map(_rclApplyInlineMarkup).join('<br>') }); text = []; }
        parts.push({ t: 'h', h: '<span class="rcl-news-h">' + _rclApplyInlineMarkup(hm[1]) + '</span>' });
      } else if (line.trim()) {
        text.push(line);
      }
    });
    if (text.length) parts.push({ t: 'p', h: text.map(_rclApplyInlineMarkup).join('<br>') });
    parts.forEach(function (part, i) {
      var prev = i === 0 ? (pi === 0 ? null : lastType) : parts[i - 1].t;
      if (html && part.t === 'p' && prev && prev !== 'h') html += (i === 0 ? '<br><br>' : '<br>');
      else if (html && part.t === 'h' && i === 0 && pi > 0) html += '<br>';
      html += part.h;
      lastType = part.t;
    });
  });
  return { html: html, truncated: truncated };
}

// The little square beside every League News item: an AI Season Story shows "RD" over its round number
// (01, 02, 03... the season preview is 00); a regular News post shows "NE" over "WS" in a different color.
function _rclNewsBadgeHtml(item, small) {
  var top, bottom, kind;
  if (item && item.isStory && !(Number(item.roundNum) > 0)) {
    // Season preview: one word, PRE, in the red box.
    return '<span class="rcl-news-badge rcl-news-badge-rd rcl-news-badge-pre' + (small ? ' rcl-news-badge-sm' : '') + '"><span class="rcl-news-badge-top">PRE</span></span>';
  }
  if (item && item.isStory) {
    top = 'RD';
    bottom = (item.roundNum || 0) < 10 ? '0' + (item.roundNum || 0) : String(item.roundNum);
    kind = 'rcl-news-badge-rd';
  } else {
    top = 'NE'; bottom = 'WS'; kind = 'rcl-news-badge-ne';
  }
  return '<span class="rcl-news-badge ' + kind + (small ? ' rcl-news-badge-sm' : '') + '"><span class="rcl-news-badge-top">' + top + '</span><span class="rcl-news-badge-bottom">' + bottom + '</span></span>';
}

// Title + meta with the badge on the left.
function _rclNewsHeadRow(item, noBadge) {
  var row = _rclEl('div', 'rcl-news-headrow');
  if (!noBadge) row.appendChild(_rclEl('div', 'rcl-news-badge-wrap', _rclNewsBadgeHtml(item, false)));
  var col = _rclEl('div', 'rcl-news-headtext');
  col.appendChild(_rclEl('div', 'rcl-news-title', _rclEscapeHtml(item.title || '(untitled)')));
  col.appendChild(_rclEl('div', 'rcl-news-meta', _rclEscapeHtml(_rclNewsMetaLine(item))));
  row.appendChild(col);
  return row;
}

// ---- Thumbs on AI stories: only drivers who raced in that story's season can vote. -------------
var RCL_THUMB_UP_SVG_ = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';
var RCL_THUMB_DOWN_SVG_ = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>';
var _rclVotesPromise = null;
function _rclLoadMyStoryVotes() {
  var token = null;
  try { token = getToken(); } catch (err) { token = null; }
  if (!token) return Promise.resolve({ signedIn: false, eligibleSeasonIds: [], votes: {} });
  if (!_rclVotesPromise) {
    _rclVotesPromise = fetchApi('leagueStory', { token: token, params: { op: 'myVotes' } }).then(function (res) {
      if (!res || !res.success) return { signedIn: false, eligibleSeasonIds: [], votes: {} };
      return res;
    }).catch(function () { return { signedIn: false, eligibleSeasonIds: [], votes: {} }; });
  }
  return _rclVotesPromise;
}

function _rclAddStoryVoteBar(wrap, item) {
  if (!item || !item.isStory) return;
  _rclLoadMyStoryVotes().then(function (me) {
    if (!me.signedIn || me.eligibleSeasonIds.indexOf(item.seasonId) === -1) return;
    var token = getToken();
    var bar = _rclEl('div', 'rcl-story-vote');
    bar.appendChild(_rclEl('span', 'rcl-story-vote-label', 'Rate this story'));
    var up = _rclEl('button', 'rcl-story-thumb rcl-story-thumb-up', RCL_THUMB_UP_SVG_);
    var down = _rclEl('button', 'rcl-story-thumb rcl-story-thumb-down', RCL_THUMB_DOWN_SVG_);
    up.type = 'button'; down.type = 'button';
    up.setAttribute('aria-label', 'Thumbs up'); down.setAttribute('aria-label', 'Thumbs down');
    bar.appendChild(up); bar.appendChild(down);
    var note = _rclEl('span', 'rcl-story-vote-note', '');
    bar.appendChild(note);
    var form = _rclEl('div', 'rcl-story-vote-form');
    form.style.display = 'none';
    var ta = document.createElement('textarea');
    ta.rows = 3; ta.maxLength = 1000; ta.placeholder = 'What did you not like about this story?';
    var send = _rclEl('button', 'rcl-story-vote-send', 'Send Feedback');
    send.type = 'button';
    form.appendChild(ta); form.appendChild(send);
    function mark(vote) {
      up.classList.toggle('rcl-story-thumb-on', vote === 'up');
      down.classList.toggle('rcl-story-thumb-on', vote === 'down');
    }
    mark(me.votes[item.newsId] || '');
    function submit(vote, comment) {
      note.textContent = 'Saving...';
      fetchApi('leagueStory', { method: 'POST', token: token, body: { op: 'feedback', storyId: item.newsId, vote: vote, comment: comment || '' } }).then(function (res) {
        if (!res || !res.success) { note.textContent = (res && res.message) || 'Could not save your feedback.'; return; }
        me.votes[item.newsId] = vote;
        mark(vote);
        form.style.display = 'none';
        note.textContent = 'Thanks for the feedback.';
      }).catch(function () { note.textContent = 'Could not reach the server.'; });
    }
    up.addEventListener('click', function () { form.style.display = 'none'; submit('up', ''); });
    down.addEventListener('click', function () { form.style.display = ''; ta.focus(); });
    send.addEventListener('click', function () {
      if (!ta.value.trim()) { note.textContent = 'Please say what you did not like.'; return; }
      submit('down', ta.value.trim());
    });
    wrap.appendChild(bar);
    wrap.appendChild(form);
  });
}

function _rclNewsMetaLine(item) {
  // AI stories: BY RACE CLUB PRESS · ROUND N · SHORT NAME · OCT 14, 2026 (the race date), all caps.
  // The season preview has no round or track: BY RACE CLUB PRESS · SEASON PREVIEW · date.
  if (item && item.isStory) {
    var sp = ['By ' + (item.authorName || 'Race Club Press')];
    if (Number(item.roundNum) > 0) {
      sp.push('Round ' + item.roundNum);
      if (item.shortName) sp.push(item.shortName);
    } else {
      sp.push('Season Preview');
    }
    var sDate = _rclFormatDate(item.publishedAt);
    if (sDate) sp.push(sDate);
    return sp.join(' \u00b7 ').toUpperCase();
  }
  var metaParts = [];
  if (item.authorName) metaParts.push('By ' + item.authorName);
  var dateLabel = _rclFormatDate(item.publishedAt);
  if (dateLabel) metaParts.push(dateLabel);
  return metaParts.join(' · ');
}

// Holds the full fetched news list so the read-story popup can page through older stories without a
// second server round trip.gs).
var _rclNewsList = [];

// True while the AI is writing a story (hub.storyWriting) and the claim is under 6 minutes old
// (a writer that died never leaves the light on).
function _rclStoryWritingActive(hub) {
  var w = hub && hub.storyWriting;
  if (!w || !w.startedAt) return false;
  var t = new Date(w.startedAt).getTime();
  return !isNaN(t) && (Date.now() - t) < 6 * 60 * 1000;
}

function _rclStoryWritingNotice(hub) {
  if (!_rclStoryWritingActive(hub)) return null;
  var w = hub.storyWriting;
  var what = w.kind === 'preview' ? 'the season preview' : (w.roundNum ? 'the Round ' + w.roundNum + ' story' : 'the next story');
  var box = _rclEl('div', 'rcl-story-status');
  box.appendChild(_rclEl('span', 'rcl-story-pulse'));
  box.appendChild(_rclEl('span', 'rcl-story-status-text', 'Writing ' + what + '. This takes about a minute.'));
  return box;
}

function _rclRenderNews(hub) {
  var body = document.getElementById('rcl-news-body');
  if (!body) return;
  body.innerHTML = '';
  // Newest first: index 0 is the previewed story, the rest list below it newest to oldest.
  // Stable sort: publishedAt desc, then round number desc, then original server order.
  _rclNewsList = (hub.news || []).map(function (n, idx) { return { n: n, idx: idx }; }).sort(function (a, b) {
    var ta = new Date(a.n.publishedAt).getTime() || 0;
    var tb = new Date(b.n.publishedAt).getTime() || 0;
    if (tb !== ta) return tb - ta;
    var ra = Number(a.n.roundNum) || 0, rb = Number(b.n.roundNum) || 0;
    if (rb !== ra) return rb - ra;
    return a.idx - b.idx;
  }).map(function (w) { return w.n; });
  var writingNotice = _rclStoryWritingNotice(hub);
  if (writingNotice) body.appendChild(writingNotice);

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
  currentWrap.appendChild(_rclNewsHeadRow(current));
  // 1000-character cap, not the old fixed 14-line CSS clamp -- "Continue reading..." now only shows
  // up when the story is actually longer than that, via preview.truncated.
  // EXCEPT when Last Race has nothing to show -- same hasLastRace check _rclRenderLastRace_ makes
  // from this same hub payload, just independently here since every renderer gets the whole hub and
  // neither needs to read the other's DOM state.
  var hasLastRace = !!hub.hasSeason;
  var preview = _rclStoryPreviewHtml(current.body, hasLastRace ? 1000 : undefined);
  currentWrap.appendChild(_rclEl('div', 'rcl-news-current-body', preview.html));
  if (preview.truncated) {
    var continueLink = _rclEl('a', 'rcl-news-continue', 'Continue reading...');
    continueLink.href = 'javascript:void(0)';
    continueLink.addEventListener('click', function () { _rclOpenStoryModal(0); });
    currentWrap.appendChild(continueLink);
  }
  body.appendChild(currentWrap);

  if (_rclNewsList.length > 1) {
    var prevWrap = _rclEl('div', 'rcl-news-previous');
    prevWrap.appendChild(_rclEl('div', 'rcl-news-previous-head', 'More Stories'));
    // Capped at the next 5 -- anything older than that stays reachable only through the read-story
    // popup's own "Load More News" button, not listed out here on the page.
    _rclNewsList.slice(1, 7).forEach(function (item, i) {
      var titleBtn = _rclEl('button', 'rcl-news-previous-title', _rclNewsBadgeHtml(item, true) + '<span class="rcl-news-previous-text">' + _rclEscapeHtml(item.title || '(untitled)') + '</span>');
      titleBtn.type = 'button';
      titleBtn.addEventListener('click', function () { _rclOpenStoryModal(i + 1); });
      prevWrap.appendChild(titleBtn);
    });
    body.appendChild(prevWrap);
  }
}

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
    wrap.appendChild(_rclNewsHeadRow(item));
    var bodyEl = _rclEl('div', 'rcl-news-body');
    _rclRenderStoryBodyBlocks(bodyEl, item.body);
    wrap.appendChild(bodyEl);
    if (item.editNote) {
      var editLabel = _rclFormatDate(item.editedAt);
      var editText = 'Edited' + (editLabel ? ' ' + editLabel : '') + ' -- ' + item.editNote;
      wrap.appendChild(_rclEl('div', 'rcl-news-editnote', _rclEscapeHtml(editText)));
    }
    _rclAddStoryVoteBar(wrap, item);
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

  // Closable ONLY via the X button -- no backdrop click, no Escape key. Same "avoid an accidental
  // close" posture Account.html's own generic modal already uses.
  function close() {
    document.body.removeChild(overlay);
    _rclUnlockBodyScroll();
  }
  closeBtn.addEventListener('click', close);

  document.body.appendChild(overlay);
  _rclLockBodyScroll();
}

// ---------------------------------------------------------------------
// PAGE HERO -- season number + name, and two stat strips built from real data instead of one long
// pipe-separated sentence. The title itself stays the static "League Hub" (set directly in
// league.html); the eyebrow above it carries "Race Club".
// ---------------------------------------------------------------------
// Returns an array of BLOCKS, each rendered with a little extra margin-top between blocks -- a
// plain block is just { rows: [{label, value}, ...] }; the one points block carries its own
// tiers/bonus shape instead, since it needs its own nested tree-sub-rows (Championship Points) and
// flat rows (Bonus Points) rather than one flat run of label/value rows.
// Grid line for the Season Preview: "2026 WEC LMGT3 & Hypercar", "2026 ELMS LMP3", "2023 WEC LMGTE & LMP2".
// Classes are grouped by car year (one group per year, joined with " / "), in the fixed class order.
function _rclGridText_(hub) {
  var cs = (hub && hub.classSeasons) || {};
  var series = String((hub && hub.series) || 'WEC').toUpperCase() === 'ELMS' ? 'ELMS' : 'WEC';
  var order = ['LMGTE', 'LMGT3', 'LMP3', 'LMP2', 'Hypercar'];
  var byYear = {}, years = [];
  order.forEach(function (c) {
    var y = String(cs[c] || '').trim();
    if (!y) return;
    if (!byYear[y]) { byYear[y] = []; years.push(y); }
    byYear[y].push(c);
  });
  return years.map(function (y) {
    var list = byYear[y];
    var names = list.length > 2 ? list.slice(0, -1).join(', ') + ' & ' + list[list.length - 1] : list.join(' & ');
    return y + ' ' + series + ' ' + names;
  }).join(' / ');
}

function _rclBuildSeasonFormatBlocks_(hub) {
  var rs = hub.raceSettings || {};
  var sections = [];

  // --- Block 1: season snapshot -------------------------------------
  var blocks = [];
  var block1 = [];
  // Grid -- "<year> <series> <class> & <class>" per year group, listed above the season dates.
  // hub.series is WEC/ELMS (blank = WEC); hub.classSeasons maps each ticked class to its car year.
  var gridText = _rclGridText_(hub);
  if (gridText) block1.push({ label: 'Grid', value: gridText });
  if (hub.seasonStartUtc && hub.seasonEndUtc) {
    var startLabel = _rclFormatDate(hub.seasonStartUtc);
    var endLabel = _rclFormatDate(hub.seasonEndUtc);
    if (startLabel && endLabel) {
      block1.push({ label: 'Season Dates', value: startLabel + (endLabel !== startLabel ? (' - ' + endLabel) : '') });
    }
  }
  if (hub.frequency) block1.push({ label: 'Schedule Frequency', value: hub.frequency });
  // Event Time -- the one recurring local race time + zone the admin set in the Season Creation
  // Wizard (hub.seasonStartTime/hub.enteredTimeZone, see Website.gs), NOT any individual round's
  // own startUtc (those vary round to round and already show on the Calendar below).
  if (hub.seasonStartTime) {
    block1.push({ label: 'Event Time', value: _rclFormat12h(hub.seasonStartTime) + (hub.enteredTimeZone ? (' ' + _rclTzAbbrev_(hub.enteredTimeZone)) : '') });
  }
  if (hub.totalRounds) block1.push({ label: 'Championship Rounds', value: String(hub.totalRounds) });
  // Special Events -- a count of hub.calendar entries of kind 'special' (see
  // _rcBuildSeasonEntries_, Seasons.gs), never surfaced as its own figure before this redesign.
  var specialEventCount = (hub.calendar || []).filter(function (entry) { return entry.kind === 'special'; }).length;
  if (specialEventCount) block1.push({ label: 'Special Events', value: String(specialEventCount) });
  if (hub.dropWeeks) block1.push({ label: hub.dropWeeks === 1 ? 'Drop Week' : 'Drop Weeks', value: String(hub.dropWeeks) });
  if (hub.byeWeeks) block1.push({ label: hub.byeWeeks === 1 ? 'Bye Week' : 'Bye Weeks', value: String(hub.byeWeeks) });
  var classNames = (hub.standings || []).map(function (cls) { return cls.className; }).filter(Boolean);
  if (classNames.length) block1.push({ label: classNames.length === 1 ? 'Class' : 'Classes', value: classNames.join(', ') });
  // "<class> Seats" -- hub.availableSeatsByClass is computed server-side
  // (_rcComputeAvailableSeatsByClass_, Website.gs) since it needs Teams/Cars/Registrations data
  // this page never otherwise reads. undefined (not just 0) means this class has no Teams at all
  // for the season (nothing to show); 0 itself is shown -- "0 seats" (full) is meaningful
  // information, unlike the old Drivers row, which hid a class entirely once it had a non-zero
  // count only.
  (hub.standings || []).forEach(function (cls) {
    var available = (hub.availableSeatsByClass || {})[cls.className];
    if (available !== undefined) block1.push({ label: (cls.className || 'Class') + ' Seats', value: String(available) });
  });
  if (block1.length) blocks.push(block1);

  // tables/tierNames computed here (not just inside the Championship Points section below) because
  // block2's own Race Durations row also reads each tier's duration.
  var tables = hub.pointsTables || {};
  var tierNames = Object.keys(tables).filter(function (name) { return (tables[name].points || []).length; });

  // --- Block 2: session format ---------------------------------------
  var block2 = [];
  if (rs.practiceLengthMin) block2.push({ label: 'Practice Duration', value: rs.practiceLengthMin + ' min' });
  if (rs.qualifyLengthMin) block2.push({ label: 'Qualify Duration', value: rs.qualifyLengthMin + ' min' });
  if (hub.privateQualifying) block2.push({ label: 'Qualifying Type', value: hub.privateQualifying === 'Yes' ? 'Private' : 'Public' });
  var tiersWithDuration = tierNames.filter(function (name) { return tables[name].duration; });
  if (tiersWithDuration.length) {
    block2.push({
      label: 'Race Durations',
      value: tiersWithDuration.map(function (name) { return name + ' ' + rcFormatRaceLength(tables[name].duration); }).join(', ')
    });
  } else {
    block2.push({ label: 'Race Duration', value: 'Varies' });
  }
  if (block2.length) blocks.push(block2);
  if (blocks.length) sections.push({ pill: 'Season Format', blocks: blocks });

  // --- Championship Points / Bonus Points ------------------------------ Folded in from the old,
  // now-removed standalone "Points Tables" popup (_rclBuildPointsBody) -- same
  // hub.pointsTables/hub.bonusPoints fields.
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

  // --- Season Rules ----------------------------------------------------- Own "Season Rules" pill,
  // same style as "Season Format"/"Championship Points" above it.
  var block4 = [];
  if (rs.setupRules) block4.push({ label: 'Setups', value: rs.setupRules });
  if (rs.tireWearMultiplier) block4.push({ label: 'Tire Wear', value: rs.tireWearMultiplier });
  if (rs.tireCount) block4.push({ label: 'Tires Allowed', value: String(rs.tireCount) });
  if (rs.fuelMultiplier) block4.push({ label: 'Fuel Multiplier', value: rs.fuelMultiplier });
  if (rs.pitStopReq) block4.push({ label: 'Pitstop Reqs', value: rs.pitStopReq });
  if (hub.trackLimitsPreset) block4.push({ label: 'Track Limits', value: hub.trackLimitsPreset });
  if (rs.trackLimitPoints) block4.push({ label: 'Infractions until Drive-Thru', value: rs.trackLimitPoints + ' pts' });
  if (block4.length) sections.push({ pill: 'Season Rules', blocks: [block4] });

  return sections;
}

function _rclRenderHero(hub) {
  // Eyebrow is static "Race Club" (set directly in league.html) -- nothing to fill in here anymore.
  // "Season N / Name" -- the "/" reads in the brand red, the season name itself in bright white,
  // "Season N" now reads gold.
  var seasonEl = document.getElementById('rcl-hero-season');
  if (seasonEl) {
    // A non-breaking space keeps the season line one full line tall when there is no season, so the hero band is
    // the same height as championship.html's whether or not a season exists (Matt, 2026-10-14).
    seasonEl.innerHTML = '&nbsp;';
    if (hub.hasSeason && hub.seasonNumber) {
      seasonEl.innerHTML = '';
      var numSpan = _rclEl('span', 'rcl-hero-season-num');
      numSpan.textContent = 'Season ' + hub.seasonNumber + ((hub.seasonFinished && !hub.seasonName) ? ' (FINISHED)' : '');
      seasonEl.appendChild(numSpan);
      if (hub.seasonName) {
        var sep = _rclEl('span', 'rcl-hero-season-sep');
        sep.textContent = ' / ';
        seasonEl.appendChild(sep);
        var nameSpan = _rclEl('span', 'rcl-hero-season-name');
        nameSpan.textContent = hub.seasonName + (hub.seasonFinished ? ' (FINISHED)' : '');
        seasonEl.appendChild(nameSpan);
      }
    }
  }

  // Snapshot/format stat strips moved out of the hero band entirely. rcl-hero-sub stays as the
  // plain-text "no season" fallback only.
  var subEl = document.getElementById('rcl-hero-sub');

  if (!hub.hasSeason) {
    // Left blank on purpose -- no fallback copy here anymore, the hero band just shows nothing
    // below the logo/title until a season is underway.
    if (subEl) { subEl.textContent = ''; subEl.style.display = 'none'; }
    return;
  }

  if (subEl) subEl.style.display = 'none';
}

// Builds the SEASON FORMAT content (Season Details / Championship Points / Race Rules pill-headed
// sections) into `body`. Shared by the SEASON FORMAT popup (_rclOpenSeasonDetailsModal) and the
// SEASON PREVIEW state of the LAST RACE panel so the two never drift apart.
function _rclAppendSeasonFormatSections_(hub, body) {
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

  // Display-only relabeling: "Season Format" -> "Season Details", "Season Rules" -> "Race Rules".
  // Championship Points is unchanged.
  var pillDisplayLabel_ = { 'Season Format': 'Season Details', 'Season Rules': 'Race Rules' };

  // No active season: crossed circle plus a note, instead of whatever half-empty blocks a stale hub
  // payload might build.
  if (!hub.hasSeason) {
    body.appendChild(_rclEmptyState('No Data To Display', 'The season format shows up here once it is set.'));
    return;
  }

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
    body.appendChild(_rclEmptyState('No Data To Display', 'The season format shows up here once it is set.'));
  }
}

// Opens the season snapshot + league format stats in a popup, same .rcl-modal-* shell the news
// story popup uses.
function _rclOpenSeasonDetailsModal(hub) {
  var overlay = _rclEl('div', 'rcl-modal-overlay');
  var dialog = _rclEl('div', 'rcl-modal-dialog');
  var head = _rclEl('div', 'rcl-modal-head');
  head.appendChild(_rclEl('div', 'rcl-modal-title', 'Season Format'));
  var closeBtn = _rclEl('button', 'rcl-modal-close', '&times;');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  head.appendChild(closeBtn);
  dialog.appendChild(head);

  // rcl-seasonfmt-modal-body -- scopes the red-header/ light-gray-line section styling below
  // (css/league.css) to just this popup, leaving the plain gray-pill .rcl-hero-stats-label look
  // untouched everywhere else it's used (the RACE INFO popup, further up this file).
  var body = _rclEl('div', 'rcl-modal-body rcl-seasonfmt-modal-body');

  // - Rows are plain "Category: Value" text, left-aligned, not a two-column layout.
  // - "Championship Points" and "Season Rules" are now each their own pill-headed section
  // (.rcl-hero-stats-group/-label), same style as "Season Format" above them, instead of a plain
  // text sub-header. _rclBuildSeasonFormatBlocks_ returns one such SECTION per pill now, not a flat
  // list of blocks.
  _rclAppendSeasonFormatSections_(hub, body);

  dialog.appendChild(body);
  overlay.appendChild(dialog);

  function close() { document.body.removeChild(overlay); _rclUnlockBodyScroll(); }
  closeBtn.addEventListener('click', close);

  document.body.appendChild(overlay);
  _rclLockBodyScroll();
}

// LEAGUE RULES popup -- same RULEBOOK_SECTIONS data Account.html's Rules and Regulations card reads
// (js/rulebook-content.js, now also loaded on this page, see league.html), rendered with the exact
// same markup/classes (.rc-rulebook-nav/.rc-rulebook-section/etc.
function _rclOpenLeagueRulesModal() {
  var overlay = _rclEl('div', 'rcl-modal-overlay');
  var dialog = _rclEl('div', 'rcl-modal-dialog');
  var head = _rclEl('div', 'rcl-modal-head');
  head.appendChild(_rclEl('div', 'rcl-modal-title', 'Help: Race Club\'s Online League'));
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
        // Safe to use innerHTML here -- RULEBOOK_SECTIONS' html strings are hand-authored by us,
        // not sourced from user input (see that file's own header comment).
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

// MEMBER LIST popup -- fetches handleGetMemberList (Website.gs) fresh on every open (small, public,
// no-token payload -- not worth folding into the cached League Hub bundle).
var RCL_ROLE_TIERS_ = ['Admin', 'Organizer', 'Steward', 'Driver'];
// No fetch of its own, no loading state -- hub.members is already sitting in the same cached League
// Hub payload this page loaded once up front (see _rcBuildMemberList_, Website.gs), so this reads
// it directly, exactly the same "no fetch, just render what's already in memory" shape
// _rclOpenSeasonDetailsModal above has always had.
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
        var memberNameEl = _rclEl('div', 'rcl-memberlist-name');
        memberNameEl.appendChild(_rclBuildDriverNameEl_('rcl-driver-link-inner', m.displayName || 'Unknown Driver', m.profileId));
        // Country flag right behind the name (Users.Location).
        if (m.country && typeof countryFlagSrc === 'function') {
          var memberFlagSrc = countryFlagSrc(m.country);
          if (memberFlagSrc) {
            var memberFlag = document.createElement('img');
            memberFlag.className = 'rcl-standings-flag rcl-memberlist-flag';
            memberFlag.src = memberFlagSrc;
            memberFlag.alt = '';
            memberFlag.title = m.country;
            memberFlag.onerror = function () { memberFlag.style.display = 'none'; };
            memberNameEl.appendChild(memberFlag);
          }
        }
        row.appendChild(memberNameEl);
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

// NAVBAR under the header (#rcl-navbar, league.html): Season Preview | Join Race Club (signed in: Member List) | Help
// (signed in: Member List). Same look as the Championship page's link bar (css/league.css,
// .rcl-navbar). The old row of four square image tiles at the bottom of the page is gone; these
// links replace it.
var _rclNavHub_ = { hasSeason: false };

// ---- SEASON PICKER (right end of the navbar) ----
// _rclSeasonList_ comes from the default (current) hub's `seasons`. _rclViewSeasonId_ is '' while the
// default season is showing, else the past season being viewed. _rclArchivedRounds_ holds a loaded
// archive file's per-round recap data, so the Race Recap popup needs no server call for it.
var _rclSeasonList_ = [];
var _rclDefaultSeasonId_ = '';
var _rclViewSeasonId_ = '';
var _rclArchivedRounds_ = null;
var _rclOnSeasonPick_ = null;

function _rclArchivedRoundPart_(roundId, isQualifying) {
  if (!_rclArchivedRounds_ || !Object.prototype.hasOwnProperty.call(_rclArchivedRounds_, roundId)) return null;
  var part = _rclArchivedRounds_[roundId];
  var res = part && (isQualifying ? part.qualifying : part.results);
  return (res && res.success) ? res : null;
}

// "Oct 10 - Dec 5, 2026" (same year), "Dec 27, 2026 - Feb 14, 2027" (across years), "" with no dates.
function _rclSeasonRange_(s) {
  var a = s.startUtc ? new Date(s.startUtc) : null;
  var b = s.endUtc ? new Date(s.endUtc) : null;
  if (a && isNaN(a.getTime())) a = null;
  if (b && isNaN(b.getTime())) b = null;
  if (!a && !b) return '';
  if (!a) a = b;
  if (!b) b = a;
  var md = { month: 'short', day: 'numeric' }, mdy = { month: 'short', day: 'numeric', year: 'numeric' };
  if (a.getTime() === b.getTime()) return a.toLocaleDateString(undefined, mdy);
  if (a.getFullYear() === b.getFullYear()) return a.toLocaleDateString(undefined, md) + ' \u2013 ' + b.toLocaleDateString(undefined, mdy);
  return a.toLocaleDateString(undefined, mdy) + ' \u2013 ' + b.toLocaleDateString(undefined, mdy);
}
function _rclSeasonLabel_(s) {
  // Same label as the Season dropdown on the Driver Profile page: "Season 2 - Name (Oct 10, 2026 - Dec 5, 2026)".
  function fmt(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  var a = fmt(s.startUtc), b = fmt(s.endUtc);
  var range = a && b ? (a === b ? a : a + ' - ' + b) : (a || b);
  var head = s.seasonNumber ? ('Season ' + s.seasonNumber + ' - ' + (s.name || '')) : (s.name || s.seasonId);
  return head + (range ? ' (' + range + ')' : '');
}
function _rclRenderNavbar_(hub) {
  var nav = document.getElementById('rcl-navbar');
  if (!nav) return;
  // The links always open with the newest hub data, whichever draw they were built in.
  if (hub) _rclNavHub_ = hub;
  nav.innerHTML = '';
  var inner = _rclEl('div', 'rcl-navbar-inner');
  var links = _rclEl('div', 'rcl-navbar-links');
  inner.appendChild(links);
  var signedIn = false;
  try { signedIn = !!getToken(); } catch (err) { signedIn = false; }

  function add(label, onClick) {
    var b = _rclEl('button', 'rcl-navbar-link', _rclEscapeHtml(label));
    b.type = 'button';
    b.addEventListener('click', onClick);
    links.appendChild(b);
  }
  // With no season at all the link reads Welcome instead of Season Preview.
  add((_rclNavHub_ && _rclNavHub_.hasSeason) ? 'Season Preview' : 'Welcome', function () { _rclOpenSeasonPreviewModal_(_rclNavHub_); });
  if (signedIn) {
    add('Member List', function () { _rclOpenMemberListModal(_rclNavHub_); });
  } else {
    add('Join Race Club', function () {
      if (typeof rcRememberReturnPage === 'function') rcRememberReturnPage();
      window.location.href = 'register.html';
    });
  }
  add('Help', function () { _rclOpenLeagueRulesModal(); });

  // Season picker: every season ever created, newest first, right end of the bar, centered vertically.
  if (hub && Array.isArray(hub.seasons) && hub.seasons.length && !_rclViewSeasonId_) {
    _rclSeasonList_ = hub.seasons;
    _rclDefaultSeasonId_ = hub.seasonId || '';
  }
  if (_rclSeasonList_.length) {
    var pick = document.createElement('select');
    pick.className = 'rcl-navbar-season';
    pick.setAttribute('aria-label', 'Season');
    _rclSeasonList_.forEach(function (sn) {
      var opt = document.createElement('option');
      opt.value = sn.seasonId;
      opt.textContent = _rclSeasonLabel_(sn);
      pick.appendChild(opt);
    });
    pick.value = _rclViewSeasonId_ || _rclDefaultSeasonId_ || _rclSeasonList_[0].seasonId;
    pick.addEventListener('change', function () { if (_rclOnSeasonPick_) _rclOnSeasonPick_(pick.value); });
    inner.appendChild(pick);
  }
  nav.appendChild(inner);
}

// SEASON PREVIEW popup -- the Season Details / Championship Points / Race Rules sections (same
// content as the old Season Format popup) plus a Rounds section, one line per round:
//   Round n · Event name: Track: Layout · 60 mins (Tier) · 2:00 PM · Clear 10% Rain 22°C · Raced
// The "Round n · Event name:" part uses the gray label style, the rest the white value style.
// "Raced" is only added once the round has results; otherwise the line ends after the temperature.
function _rclOpenSeasonPreviewModal_(hub) {
  var overlay = _rclEl('div', 'rcl-modal-overlay');
  var dialog = _rclEl('div', 'rcl-modal-dialog');
  var head = _rclEl('div', 'rcl-modal-head');
  head.appendChild(_rclEl('div', 'rcl-modal-title', (hub && hub.hasSeason) ? 'Season Preview' : 'Welcome'));
  var closeBtn = _rclEl('button', 'rcl-modal-close', '&times;');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  head.appendChild(closeBtn);
  dialog.appendChild(head);

  var body = _rclEl('div', 'rcl-modal-body rcl-seasonfmt-modal-body');
  if (hub && hub.hasSeason) {
    _rclAppendSeasonFormatSections_(hub, body);
  } else {
    // No season yet: a welcome message instead of the season details.
    body.appendChild(_rclEl('p', 'rcl-welcome-text', 'Welcome to Race Club, an online endurance racing league for Le Mans Ultimate. We are glad you are here.'));
    body.appendChild(_rclEl('p', 'rcl-welcome-text', 'Sit tight. A new season will begin shortly, and the calendar, standings and news will fill in here as soon as it does.'));
  }

  var rounds = ((hub && hub.calendar) || []).filter(function (e) { return e.kind === 'round'; })
    .sort(function (a, b) { return (a.roundNum || 0) - (b.roundNum || 0); });
  if (hub && hub.hasSeason && rounds.length) {
    var group = _rclEl('div', 'rcl-hero-stats-group');
    group.appendChild(_rclEl('div', 'rcl-hero-stats-label', 'Rounds'));
    var list = _rclEl('div', 'rcl-seasonfmt-list');
    rounds.forEach(function (e) {
      var bits = [];
      var trackBit = (e.track || '') + (e.layout ? ': ' + e.layout : '');
      if (trackBit) bits.push(trackBit);
      var mins = _rclEntryLengthMinutes(e, hub);
      if (mins || e.raceLengthTier) bits.push((mins ? rcFormatRaceLength(mins) : '') + (e.raceLengthTier ? (mins ? ' ' : '') + '(' + e.raceLengthTier + ')' : ''));
      if (e.igRaceStart) bits.push(_rclFormat12h(e.igRaceStart));
      if (e.weather) {
        var w = e.weather + ' ' + (e.chanceOfRain || 0) + '% Rain';
        if (e.temperatureC !== null && e.temperatureC !== undefined) w += ' ' + e.temperatureC + '\u00B0C';
        bits.push(w);
      }
      if (e.hasResults) bits.push('Raced');
      var html = '<span class="rcl-seasonfmt-row-label">Round ' + _rclEscapeHtml(String(e.roundNum || '')) + ' \u00B7 ' + _rclEscapeHtml(e.eventName || 'Race') + ':</span> ' +
        '<span class="rcl-seasonfmt-row-value">' + _rclEscapeHtml(bits.join(' \u00B7 ')) + '</span>';
      list.appendChild(_rclEl('div', 'rcl-seasonfmt-row', html));
    });
    group.appendChild(list);
    body.appendChild(group);
  }

  dialog.appendChild(body);
  overlay.appendChild(dialog);
  function close() { document.body.removeChild(overlay); _rclUnlockBodyScroll(); }
  closeBtn.addEventListener('click', close);
  document.body.appendChild(overlay);
  _rclLockBodyScroll();
}

// Full-page loading overlay -- markup/CSS live in league.html and css/league.css; this just locks
// body scroll while it's up (same .rc-modal-scroll-locked pattern every popup on this page already
// uses) and fades + removes it once the initial fetch below resolves, success or failure either
// way, so a fetch error still reveals the page's own "No Data To Display" states instead of leaving
// the overlay up forever.
// Shows the same full-page loading overlay league.html starts with (starting lights + text) again,
// for a season switch. _rclHidePageLoader() fades it out and removes it.
function _rclShowPageLoader_(text) {
  var old = document.getElementById('rcl-page-loader');
  if (old && old.parentNode) old.parentNode.removeChild(old);
  document.documentElement.classList.remove('rcl-has-cache');
  var loader = _rclEl('div', 'rcl-page-loader');
  loader.id = 'rcl-page-loader';
  var lights = _rclEl('div', 'rc-startlights');
  for (var i = 0; i < 5; i++) lights.appendChild(_rclEl('div', 'rc-startlight'));
  loader.appendChild(lights);
  loader.appendChild(_rclEl('div', 'rc-loading-text', _rclEscapeHtml(text || 'Loading...')));
  document.body.appendChild(loader);
  if (!document.body.classList.contains('rc-modal-scroll-locked')) _rclLockBodyScroll();
}

function _rclHidePageLoader() {
  var loader = document.getElementById('rcl-page-loader');
  if (!loader) return;
  loader.classList.add('rcl-page-loader-hidden');
  if (document.body.classList.contains('rc-modal-scroll-locked')) _rclUnlockBodyScroll();
  setTimeout(function () {
    if (loader.parentNode) loader.parentNode.removeChild(loader);
  }, 450); // matches the 0.4s CSS transition, plus a hair of slack
}

// _rclPatchTimeDerivedFields_(hub) -- client-side port of _rcRefreshTimeDerivedLeagueHubFields_
// (Website.gs). Keep this in exact lockstep with the server-side function if that one ever changes.
function _rclPatchTimeDerivedFields_(hub) {
  if (!hub || !hub.hasSeason || !Array.isArray(hub.calendar)) return hub;
  var nowMs = Date.now();

  hub.calendar.forEach(function (entry) {
    entry.finished = !!(entry.startUtc && new Date(entry.startUtc).getTime() < nowMs);
    // raceOver = start time + 3 hours has passed. Used ONLY to pick the next race (the dashboard and
    // hub keep showing an event as "next" for 3 hours after it starts). finished still gates results.
    entry.raceOver = !!(entry.startUtc && (new Date(entry.startUtc).getTime() + 3 * 60 * 60 * 1000) <= nowMs);
  });

  var completedEntries = hub.calendar.filter(function (entry) {
    return entry.kind === 'round' && entry.finished && entry.hasResults;
  });
  hub.roundsCompleted = completedEntries.length;
  hub.hasUnofficialResults = completedEntries.some(function (entry) { return !entry.resultsFinalized; });

  var nextEntry = hub.calendar.filter(function (entry) {
    return entry.kind !== 'bye' && !entry.raceOver;
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

// Saved copy of the last League Hub payload, kept in this browser (localStorage) so coming back to
// this page (e.g. from a driver profile) draws instantly from it while fresh data is fetched quietly
// in the background (stale-while-revalidate). league.html's <head> checks the same key to skip the
// loading overlay when a copy exists.
var RCL_HUB_STORAGE_KEY_ = 'rc_league_hub_v1';

// Load-failure panel with a RETRY button. Shown only when the first load fails and there is no saved
// copy to draw from (a saved copy means the page is already showing something, so no panel).
function _rclClearLoadError_() {
  var old = document.getElementById('rcl-load-error');
  if (old && old.parentNode) old.parentNode.removeChild(old);
}
function _rclShowLoadError_(onRetry, title) {
  _rclClearLoadError_();
  _rclHidePageLoader();
  var main = document.querySelector('.rcl-main');
  if (!main) return;
  var box = _rclEl('div', 'rcl-row-full rcl-load-error');
  box.id = 'rcl-load-error';
  box.appendChild(_rclEmptyState(title || 'Could Not Load The League Hub', 'Check your connection and try again.'));
  var btn = _rclEl('button', 'rcl-load-error-btn', 'RETRY');
  btn.type = 'button';
  btn.addEventListener('click', function () {
    btn.disabled = true;
    btn.textContent = 'LOADING...';
    onRetry();
    // revalidate() redraws the page on success; if it fails again the panel is rebuilt.
    setTimeout(function () { if (btn.parentNode) { btn.disabled = false; btn.textContent = 'RETRY'; } }, 4000);
  });
  box.appendChild(btn);
  main.insertBefore(box, main.firstChild);
}

function _rclReadSavedHubText_() {
  try { return localStorage.getItem(RCL_HUB_STORAGE_KEY_); } catch (err) { return null; }
}
function _rclSaveHubText_(text) {
  try { localStorage.setItem(RCL_HUB_STORAGE_KEY_, text); } catch (err) { /* storage full or blocked -- the page still works */ }
}

// _rclFetchLeagueHubRaw_() -- tries the published CSV first, which hits Google's own static-file
// servers with zero Apps Script execution, and falls back to the normal fetchApi('getLeagueHub',
// ...) call on ANY failure (CSV URL not configured, fetch failed, or the text didn't parse).
function _rclFetchLeagueHubRaw_() {
  return fetchPublishedJson(RC_LEAGUE_HUB_CSV_URL).catch(function () {
    return fetchApi('getLeagueHub', { timeoutMs: RC_FETCH_TIMEOUT_MS_LONG });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  // The link bar is drawn first and on its own, so a problem in any renderer below can never keep it off the page.
  try { _rclRenderNavbar_(null); } catch (err) { /* the page still works without it */ }
  var RENDERERS = [_rclRenderStandings, _rclRenderLastRace_, _rclRenderManufacturerStandings, _rclRenderRaceCarousel, _rclRenderNews];

  var storyWritingOn = false;
  function showHub(hub) {
    // The page looks exactly the same after a season ends as it did after the last race was uploaded
    // (Matt, 2026-10-13): Last Race, the ticker, the standings and every title stay as they were.
    // The story tells visitors the season is over. The ended-season branches in this file are kept
    // but no longer reached from here.
    if (hub && hub.seasonEnded) { hub.seasonFinished = true; hub.seasonEnded = false; }
    if (!hub || !hub.success) {
      _rclRenderTicker({ lastRace: null, standings: [] });
      RENDERERS.forEach(function (fn) { fn({ hasSeason: false }); });
      _rclRenderHero({ hasSeason: false });
      _rclHidePageLoader();
      return;
    }
    try { _rclRenderNavbar_(hub); } catch (err) { /* keep going */ }
    _rclRenderHero(hub);
    _rclRenderTicker(hub);
    RENDERERS.forEach(function (fn) { fn(hub); });
    storyWritingOn = _rclStoryWritingActive(hub);
    _rclHidePageLoader();
  }

  // Draw the saved copy first, if there is one.
  var currentText = null;
  var savedText = _rclReadSavedHubText_();
  if (savedText) {
    try {
      var savedHub = JSON.parse(savedText);
      if (savedHub && savedHub.success) {
        currentText = savedText;
        showHub(_rclPatchTimeDerivedFields_(savedHub));
      }
    } catch (parseErr) { currentText = null; }
  }
  if (!currentText) {
    document.documentElement.classList.remove('rcl-has-cache');
    if (document.getElementById('rcl-page-loader')) _rclLockBodyScroll();
  }

  // ---- Season picker: load a past season (from its archive file when it has one) ----
  function plainPastHub(res) {
    if (res && res.success && !res.archived && res.hasSeason) return { hub: res, rounds: null };
    throw new Error('RCL_BAD_SEASON');
  }
  function fetchSeasonHub(seasonId, noArchive) {
    var params = { seasonId: seasonId };
    if (noArchive) params.noArchive = '1';
    return fetchApi('getLeagueHub', { params: params, timeoutMs: RC_FETCH_TIMEOUT_MS_LONG });
  }
  // The file is accepted only if it is the season the server named and the version the server saved.
  function fetchArchiveFile(info, seasonId) {
    if (!/^https:\/\//.test(String(info.archiveUrl || ''))) return Promise.reject(new Error('RCL_BAD_URL'));
    return fetch(info.archiveUrl, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('RCL_ARCHIVE_' + r.status);
      return r.json();
    }).then(function (b) {
      var a = b && b.archive;
      if (!a || a.kind !== 'leaguehub' || a.seasonId !== seasonId || a.archivedAt !== info.archivedAt) throw new Error('RCL_ARCHIVE_MISMATCH');
      if (!b.hub || !b.hub.success || b.hub.seasonId !== seasonId) throw new Error('RCL_ARCHIVE_BAD_HUB');
      return { hub: b.hub, rounds: b.rounds || {} };
    });
  }
  function loadPastSeason(seasonId) {
    return fetchSeasonHub(seasonId, false).then(function (res) {
      if (res && res.archived && res.seasonId === seasonId) {
        return fetchArchiveFile(res, seasonId).catch(function () {
          // File not readable (GitHub may still be publishing it): ask the server to build it instead.
          return fetchSeasonHub(seasonId, true).then(plainPastHub);
        });
      }
      return plainPastHub(res);
    });
  }
  var pickToken = 0;
  _rclOnSeasonPick_ = function (seasonId) {
    _rclClearLoadError_();
    var myToken = ++pickToken;
    if (!seasonId || seasonId === _rclDefaultSeasonId_) {
      _rclViewSeasonId_ = '';
      _rclArchivedRounds_ = null;
      if (currentText) {
        try { showHub(_rclPatchTimeDerivedFields_(JSON.parse(currentText))); } catch (err) { /* keep what is shown */ }
      }
      return;
    }
    _rclShowPageLoader_('Loading Season...');
    loadPastSeason(seasonId).then(function (loaded) {
      if (myToken !== pickToken) return;
      _rclViewSeasonId_ = seasonId;
      _rclArchivedRounds_ = loaded.rounds;
      showHub(_rclPatchTimeDerivedFields_(loaded.hub));
    }).catch(function () {
      if (myToken !== pickToken) return;
      // Put the picker back on the season that is still showing, and offer a retry.
      try { _rclRenderNavbar_(null); } catch (err) { /* ignore */ }
      _rclHidePageLoader();
      _rclShowLoadError_(function () { _rclOnSeasonPick_(seasonId); }, 'Could Not Load That Season');
    });
  };

  // Fetch fresh data; only redraw when it actually differs from what is already on screen.
  var revalidating = false;
  function revalidate() {
    if (revalidating) return;
    revalidating = true;
    _rclFetchLeagueHubRaw_().then(function (hub) {
      if (hub && hub.success) {
        var text = JSON.stringify(hub);
        if (text !== currentText) {
          currentText = text;
          _rclSaveHubText_(text);
          // While a past season is showing, only the saved current-season copy is refreshed.
          if (!_rclViewSeasonId_) showHub(_rclPatchTimeDerivedFields_(hub));
        }
        _rclClearLoadError_();
      } else if (!currentText) {
        // The server answered but said no (not a real "no season" reply): let the visitor try again.
        _rclShowLoadError_(revalidate);
      }
    }).catch(function () {
      if (!currentText) _rclShowLoadError_(revalidate);
    }).then(function () { revalidating = false; });
  }
  revalidate();

  // While the AI is writing a story, check again every 30 seconds so the light clears (and the new
  // story appears) without a manual refresh. Does nothing the rest of the time.
  setInterval(function () { if (storyWritingOn) revalidate(); }, 30000);

  // Coming back via the browser's back button can restore this page from memory without reloading
  // it; refresh quietly in that case too.
  window.addEventListener('pageshow', function (evt) {
    if (evt.persisted) revalidate();
  });

  // Quietly keep the driver directory (profile.html's data) warm so a profile opens instantly.
  setTimeout(function () {
    if (typeof rcDriverDirectoryIsStale === 'function' && rcDriverDirectoryIsStale(10 * 60 * 1000)) {
      rcFetchDriverDirectory().catch(function () {});
    }
  }, 1500);
});
