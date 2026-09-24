/*
  Race Club — js/reference-data.js  (v0.2.5, GitHub Pages edition)

  WHAT CHANGED VS. THE GOOGLE SITES VERSION:
  In the single-file embed, the country list, country->flag-emoji lookup,
  and the curated/offset-sorted timezone list were declared once and used
  by both the registration form and the profile edit form because
  everything shared one <script> scope. Split into real pages, both
  register.html and Account.html need this same data — rather than
  duplicating ~150 lines of country/timezone tables in two files, it lives
  here once and both pages load it via <script src="js/reference-data.js">.

  Every value below (COUNTRY_CODES, COUNTRIES, TIMEZONE_LIST,
  PREFERRED_CLASSES, EVENT_LENGTHS, and the flagEmoji/timezoneLabel/
  timezoneOffsetMinutes/getTimezoneList functions) is copied verbatim from
  the source file — no entries added, removed, or reordered.
*/

var COUNTRY_CODES = {
  'Afghanistan':'AF','Albania':'AL','Algeria':'DZ','Andorra':'AD','Angola':'AO','Argentina':'AR','Armenia':'AM','Australia':'AU','Austria':'AT','Azerbaijan':'AZ',
  'Bahamas':'BS','Bahrain':'BH','Bangladesh':'BD','Barbados':'BB','Belarus':'BY','Belgium':'BE','Belize':'BZ','Benin':'BJ','Bhutan':'BT','Bolivia':'BO',
  'Bosnia and Herzegovina':'BA','Botswana':'BW','Brazil':'BR','Brunei':'BN','Bulgaria':'BG','Burkina Faso':'BF','Burundi':'BI',
  'Cambodia':'KH','Cameroon':'CM','Canada':'CA','Cape Verde':'CV','Central African Republic':'CF','Chad':'TD','Chile':'CL','China':'CN','Colombia':'CO','Comoros':'KM',
  'Costa Rica':'CR','Croatia':'HR','Cuba':'CU','Cyprus':'CY','Czechia':'CZ','Democratic Republic of the Congo':'CD','Denmark':'DK','Djibouti':'DJ','Dominica':'DM','Dominican Republic':'DO',
  'Ecuador':'EC','Egypt':'EG','El Salvador':'SV','Equatorial Guinea':'GQ','Eritrea':'ER','Estonia':'EE','Eswatini':'SZ','Ethiopia':'ET',
  'Fiji':'FJ','Finland':'FI','France':'FR',
  'Gabon':'GA','Gambia':'GM','Georgia':'GE','Germany':'DE','Ghana':'GH','Greece':'GR','Grenada':'GD','Guatemala':'GT','Guinea':'GN','Guinea-Bissau':'GW','Guyana':'GY',
  'Haiti':'HT','Honduras':'HN','Hungary':'HU',
  'Iceland':'IS','India':'IN','Indonesia':'ID','Iran':'IR','Iraq':'IQ','Ireland':'IE','Israel':'IL','Italy':'IT','Ivory Coast':'CI',
  'Jamaica':'JM','Japan':'JP','Jordan':'JO',
  'Kazakhstan':'KZ','Kenya':'KE','Kiribati':'KI','Kosovo':'XK','Kuwait':'KW','Kyrgyzstan':'KG',
  'Laos':'LA','Latvia':'LV','Lebanon':'LB','Lesotho':'LS','Liberia':'LR','Libya':'LY','Liechtenstein':'LI','Lithuania':'LT','Luxembourg':'LU',
  'Madagascar':'MG','Malawi':'MW','Malaysia':'MY','Maldives':'MV','Mali':'ML','Malta':'MT','Marshall Islands':'MH','Mauritania':'MR','Mauritius':'MU','Mexico':'MX',
  'Micronesia':'FM','Moldova':'MD','Monaco':'MC','Mongolia':'MN','Montenegro':'ME','Morocco':'MA','Mozambique':'MZ','Myanmar':'MM',
  'Namibia':'NA','Nauru':'NR','Nepal':'NP','Netherlands':'NL','New Zealand':'NZ','Nicaragua':'NI','Niger':'NE','Nigeria':'NG','North Korea':'KP','North Macedonia':'MK','Norway':'NO',
  'Oman':'OM',
  'Pakistan':'PK','Palau':'PW','Palestine':'PS','Panama':'PA','Papua New Guinea':'PG','Paraguay':'PY','Peru':'PE','Philippines':'PH','Poland':'PL','Portugal':'PT',
  'Qatar':'QA',
  'Republic of the Congo':'CG','Romania':'RO','Russia':'RU','Rwanda':'RW',
  'Saint Kitts and Nevis':'KN','Saint Lucia':'LC','Saint Vincent and the Grenadines':'VC','Samoa':'WS','San Marino':'SM','Sao Tome and Principe':'ST','Saudi Arabia':'SA','Senegal':'SN','Serbia':'RS','Seychelles':'SC','Sierra Leone':'SL','Singapore':'SG','Slovakia':'SK','Slovenia':'SI','Solomon Islands':'SB','Somalia':'SO','South Africa':'ZA','South Korea':'KR','South Sudan':'SS','Spain':'ES','Sri Lanka':'LK','Sudan':'SD','Suriname':'SR','Sweden':'SE','Switzerland':'CH','Syria':'SY',
  'Taiwan':'TW','Tajikistan':'TJ','Tanzania':'TZ','Thailand':'TH','Timor-Leste':'TL','Togo':'TG','Tonga':'TO','Trinidad and Tobago':'TT','Tunisia':'TN','Turkey':'TR','Turkmenistan':'TM','Tuvalu':'TV',
  'Uganda':'UG','Ukraine':'UA','United Arab Emirates':'AE','United Kingdom':'GB','United States':'US','Uruguay':'UY','Uzbekistan':'UZ',
  'Vanuatu':'VU','Vatican City':'VA','Venezuela':'VE','Vietnam':'VN',
  'Yemen':'YE',
  'Zambia':'ZM','Zimbabwe':'ZW'
};

function flagEmoji(countryName) {
  var code = COUNTRY_CODES[countryName];
  if (!code) return '';
  var base = 0x1F1E6;
  return String.fromCodePoint(base + (code.charCodeAt(0) - 65)) + String.fromCodePoint(base + (code.charCodeAt(1) - 65));
}

var COUNTRIES = ['Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cambodia','Cameroon','Canada','Cape Verde','Central African Republic','Chad','Chile','China','Colombia','Comoros','Costa Rica','Croatia','Cuba','Cyprus','Czechia','Democratic Republic of the Congo','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Ivory Coast','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Republic of the Congo','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'];

// Curated, not the full ~400-zone IANA list, but every standard UTC
// offset (including the half-hour and 45-minute ones actually used by
// real countries, e.g. India +5:30, Nepal +5:45, Iran +3:30) has at
// least one representative city here, and offsets that span very
// different regions of the world get two or three cities -- one per
// area -- instead of a single global stand-in.
var TIMEZONE_LIST = [
  'Pacific/Honolulu', 'America/Anchorage',
  'America/Los_Angeles', 'America/Tijuana',
  'America/Denver', 'America/Phoenix',
  'America/Chicago', 'America/Mexico_City',
  'America/New_York', 'America/Bogota',
  'America/Halifax', 'America/La_Paz',
  'America/Sao_Paulo', 'America/Argentina/Buenos_Aires',
  'America/Noronha',
  'Atlantic/Cape_Verde',
  'Europe/London', 'Africa/Accra',
  'Europe/Paris', 'Africa/Lagos',
  'Europe/Athens', 'Africa/Johannesburg',
  'Europe/Moscow', 'Africa/Nairobi',
  'Asia/Tehran',
  'Asia/Dubai', 'Asia/Baku',
  'Asia/Kabul',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Kathmandu',
  'Asia/Dhaka',
  'Asia/Yangon',
  'Asia/Bangkok', 'Asia/Jakarta',
  'Asia/Shanghai', 'Asia/Singapore', 'Australia/Perth',
  'Asia/Tokyo', 'Asia/Seoul',
  'Australia/Adelaide',
  'Australia/Sydney', 'Pacific/Port_Moresby',
  'Pacific/Noumea',
  'Pacific/Auckland', 'Pacific/Fiji',
  'Pacific/Tongatapu',
  'Pacific/Kiritimati'
];

// Minutes offset from UTC, right now, for a given IANA zone -- e.g.
// "America/Chicago" during DST returns -300. Used purely to SORT the
// dropdown by actual UTC offset (west to east) rather than alphabetical
// zone-name order.
function timezoneOffsetMinutes(tz) {
  try {
    var parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date());
    var raw = parts.find(function (p) { return p.type === 'timeZoneName'; });
    if (!raw) return 0;
    var m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(raw.value);
    if (!m) return 0;
    var sign = m[1] === '-' ? -1 : 1;
    return sign * (parseInt(m[2], 10) * 60 + (m[3] ? parseInt(m[3], 10) : 0));
  } catch (err) {
    return 0;
  }
}

function getTimezoneList() {
  return TIMEZONE_LIST.slice().sort(function (a, b) { return timezoneOffsetMinutes(a) - timezoneOffsetMinutes(b); });
}

function timezoneLabel(tz) {
  try {
    var offsetPart = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(new Date()).find(function (p) { return p.type === 'timeZoneName'; });
    return tz.replace(/_/g, ' ') + (offsetPart ? ' (' + offsetPart.value + ')' : '');
  } catch (err) {
    return tz.replace(/_/g, ' ');
  }
}

var PREFERRED_CLASSES = ['GTE', 'GT3', 'LMP3', 'LMP2', 'LMP2 *Unrestricted', 'Hypercar'];
var EVENT_LENGTHS = ['Sprint', 'Endurance', 'Mixed'];

// v0.17 -- the canonical race-class list, used as the SINGLE SOURCE for
// both the Data Management > Cars panel's Class dropdown (Account.html)
// and the Create Season wizard's class checkboxes. Sharing one list
// between the two is what guarantees a car entered as "LMGT3" is always
// the same "LMGT3" the wizard checks for availability against -- no risk
// of the two places drifting to different names for the same class (this
// replaces the wizard's old standalone ['GT3','LMP3','LMP2','Hypercar']
// array, updated to match real LMU class naming / the Cars data itself).
// Order (2026-08-21, Matt's call): GT3 -> LMP3 -> LMP2 -> Hypercar, the
// order the ladder is meant to read in everywhere on the site (class
// picker, wizard checkboxes/inputs, admin Cars class dropdown, etc.) --
// LMP3 is the very next step up from GT3, not LMP2.
// LMGTE added 2026-09-20 (Matt's ask: "I also added a LMGTE class of car
// data to the sheets. This is a rookie class of cars below LMGT3") --
// slotted in FIRST, below LMGT3 on the ladder, since it's the entry-level
// class every other class sits above. Mirrored in DataCache.gs's own
// CAR_CLASS_CANONICAL_ORDER_ -- keep both in sync if this order ever
// changes again.
var CAR_CLASS_LIST = ['LMGTE', 'LMGT3', 'LMP3', 'LMP2', 'Hypercar'];

// CAR OBJECTIVES SYSTEM (added 2026-08-29, reworked 2026-08-30) -- a
// second, independent bonus layer alongside Sponsors, bound to a car for
// one season. Unlike class, this is ONE global grouping across every class
// combined (a GT3 and a Hypercar can both be "High" side by side) -- set
// by hand per car/team in Car Management (Cars.Tier), never a computed
// numeric rank. It drives which of the tier's objectives a car draws
// (CAR_OBJECTIVE_CATALOG below) and the ±20%-randomized seat cost/
// objective bonus computed from the wizard's per-tier averages (see
// handleCreateSeason in 4_DataCache.gs). This is separate from the older,
// still-unmodified driver-wide Season Objectives mechanic (one fixed list
// every driver shares regardless of car -- see
// v0.3-Economy-Reputation-Design.md).
//
// CAR_TIER_LIST and the Elite Tier season-creation picker were removed
// entirely 2026-09-19 (Matt's call: car Tier classification doesn't matter
// anymore -- only Class does, and tier information should never surface
// anywhere on the site). Cars.Tier/Teams.Tier are now archived columns in
// the backend (see Core.gs's TAB_SCHEMAS), untouched but never read or
// written going forward.

// 6 objectives per tier (Low/Mid/High), matched to that tier's difficulty
// (Low = things a backmarker car can realistically pull off in a season;
// High = things only a factory-caliber effort should manage, but every one
// of the six should feel about equally hard to each other). Elite carries
// just the one objective, deliberately -- see the note above.
//
// No two cars in the same tier get the same objective in the same season
// while the pool lasts -- handleCreateSeason hands them out round-robin
// per tier, repeating from the top only once every objective in that tier
// is already assigned this season (six per tier keeps that ceiling well
// out of reach for a normal-size grid). Season-end evaluation of these
// (did the car's driver(s) actually meet it?) and a progress-tracking
// display are NOT built yet -- this catalog exists so objective NAMES can
// be assigned at Create Season now, with the scoring logic to follow as
// its own pass (Matt's call).
//
// 'Half-Season Clean' (Low) and 'Clean Season' (Mid) removed 2026-09-23
// (Matt's ask: remove all Clean Race language/bonus -- the Clean Race
// system is gone from the site entirely, so no objective can reference
// it anymore).
var CAR_OBJECTIVE_CATALOG = {
  Low: [
    'Season Finisher',       // completes every scheduled round this season
    'Podium Once',           // finishes on the podium (class P1-P3) at least once
    'Points Every Round',    // scores championship points in every round finished
    'Top-10 Regular',        // finishes P10 or better in class at least 3 times
    'Regular Attendee'       // attends at least 75% of this season's scheduled rounds
  ],
  Mid: [
    'Multiple Podiums',      // finishes on the podium at least 3 times this season
    'Above The Median',      // finishes the season above the class's median points total
    'Consistent Top Five',   // finishes P5 or better in class at least 4 times
    'Front-Row Twice',       // qualifies P1 or P2 in class at least twice this season
    'Charger'                // qualifies P10 or better and gains at least 5 positions from grid to finish, at least once this season
  ],
  High: [
    'Championship Podium',   // finishes the season in the top 3 of class standings
    'Multiple Wins',         // wins at least 2 rounds this season
    'Podium Regular',        // finishes on the podium in at least 75% of this season's rounds
    'Fastest Lap x3',        // sets the class's fastest lap in at least 3 rounds this season
    'Grand Slam Round',      // pole, win, and fastest lap all in the same round, at least once this season
    'Pole-to-Win Twice'      // qualifies P1 in class and wins from it, at least twice this season
  ],
  // Elite -- one car per class, hand-picked per season in the Season
  // Creation Wizard (never assigned via Car Management's Tier field, and
  // never round-robin'd like the tiers above since there's exactly one
  // Elite car per class to begin with). The single hardest objective on
  // the site, matching the huge multiplier that comes with it.
  Elite: [
    'Win Season Championship' // wins the class championship
  ]
};

// One short, driver-facing description per objective above -- shown as a
// hover tooltip on the objective's checkbox in the Create Season wizard,
// and on the Season Objective chip on the Choose Your Team screen. Keep
// these in sync with the inline comments in CAR_OBJECTIVE_CATALOG.
var CAR_OBJECTIVE_DESCRIPTIONS = {
  'Season Finisher': 'Completes every scheduled round this season.',
  'Podium Once': 'Finishes on the podium (class P1-P3) at least once.',
  'Points Every Round': 'Scores championship points in every round finished.',
  'Top-10 Regular': 'Finishes P10 or better in class at least 3 times.',
  'Regular Attendee': 'Attends at least 75% of this season\'s scheduled rounds.',
  'Multiple Podiums': 'Finishes on the podium at least 3 times this season.',
  'Above The Median': 'Finishes the season above the class\'s median points total.',
  'Consistent Top Five': 'Finishes P5 or better in class at least 4 times.',
  'Front-Row Twice': 'Qualifies P1 or P2 in class at least twice this season.',
  'Charger': 'Qualifies P10 or better and gains at least 5 positions from grid to finish, at least once this season.',
  'Championship Podium': 'Finishes the season in the top 3 of class standings.',
  'Multiple Wins': 'Wins at least 2 rounds this season.',
  'Podium Regular': 'Finishes on the podium in at least 75% of this season\'s rounds.',
  'Fastest Lap x3': 'Sets the class\'s fastest lap in at least 3 rounds this season.',
  'Grand Slam Round': 'Pole, win, and fastest lap all in the same round, at least once this season.',
  'Pole-to-Win Twice': 'Qualifies P1 in class and wins from it, at least twice this season.',
  'Win Season Championship': 'Wins the class championship.'
};

// Reputation floor required to join each class -- LOCKED per Matt's call
// (v0.20.8 correction): LMGT3 (Bronze) has no floor -- money only, same
// as the ladder in the Rulebook/system map. LMP3 requires 300, LMP2
// requires 400, Hypercar requires 600. (Was LMGT3:0/LMP3:0/LMP2:400/
// Hypercar:500 before this pass -- Matt's direct correction moved LMP3
// from open to a real floor and raised Hypercar's floor from 500 to 600.)
// A driver who clears a class's floor is always free to pick that class
// themselves -- no admin approval needed. Enforced both server-side
// (handleChooseClass, 4_DataCache.gs -- TODO once that check is added)
// and client-side (the class-choice screen in Account.html, which also
// shows this exact number next to each class). See Race Club
// Rulebook.md Section 9/10 and the v0.3 design doc for the full mechanic,
// including Class Placement Requests -- the driver-initiated, admin-
// approved exception for a class a driver doesn't yet qualify for.
// LMGTE (2026-09-20) sits below LMGT3 on the ladder, so it gets the same
// no-floor/open treatment LMGT3 already has -- neither requires proven
// reputation to join.
var CAR_CLASS_REPUTATION_FLOOR = { LMGTE: 0, LMGT3: 0, LMP3: 300, LMP2: 400, Hypercar: 600 };

// Class Placement Request denial reasons -- admin-curated, fixed list
// (same pattern as the Sponsor/Vanity catalogs: preconfigured options,
// not free text), so a denied driver always gets a clear, specific
// answer. "Other" is the one deliberate escape hatch, paired with a
// short admin-written note -- same "last resort, not the default"
// treatment as the Steward Board's free-text incident fallback. See
// Race Club Rulebook.md Section 10 for the full Class Placement Request
// flow this feeds into.
var CLASS_PLACEMENT_DENIAL_REASONS = [
  'Not Enough Proven Reputation',
  'Unknown / Unverified Skill Level',
  'Not Enough Race History in Race Club Yet',
  'Recent Conduct or Discipline Concerns',
  'No Seat Available in That Class Right Now',
  'Other'
];

// SPONSOR_TIER_LIST, SPONSOR_BONUS_TRIGGERS/SPONSOR_PENALTY_TRIGGERS and
// their description/suggested-amount/range-label tables, and
// sponsorTriggerDescription() were all removed entirely 2026-09-17 -- V1
// scope cut, the whole Sponsorship system is out of the site for now. See
// season-1-mvp-scope.md.

// ---------------------------------------------------------------------------
// PROTESTS (2026-09-08) -- backs the driver-facing Protest submission page,
// the Dashboard's Protest card, and League Management's EDIT (penalty-tier
// assessment) popup. Everything here is admin/steward-facing catalog data,
// same "one source of truth, referenced everywhere it's shown" pattern as
// the Sponsor triggers above.

// What a driver picks from when filing a protest -- exactly Matt's own
// list, nothing added or reworded. "AVOIDABLE CONTACT (Self report)" is a
// driver reporting their OWN at-fault contact rather than someone else's --
// the "Drivers Involved" picker still applies (who else was involved), it's
// just this driver admitting fault up front rather than naming someone else
// as the cause.
var PROTEST_INFRACTION_TYPES = [
  'Intentional Wrecking',
  'Unsafe Rejoin',
  'Avoidable Contact (Other Driver)',
  'Avoidable Contact (Self Report)',
  'Unsportsmanlike Behavior'
];

// Race Club Rulebook.md Section 5.1 Penalty Tiers, mirrored here as data so
// the EDIT popup's penalty-tier dropdown and its resulting time-penalty/
// disqualification effect can never drift from the published rulebook
// text. `effect` is the plain-language consequence shown next to the tier
// in the dropdown; `effectType`/`effectSeconds` mirror Protests.gs's
// PENALTY_TIER_EFFECTS_ exactly -- these are what actually get written to
// the Adjustments tab once a protest is ruled on, replacing the old
// per-tier monetary `fine` field (removed 2026-09-23, Matt's ask: remove
// all "fines"/monetary language since there's no monetary system).
// Tier 1 (Warning) and Tier 7 (Suspension) never produce an Adjustments
// row -- Tier 1 is logged only, and Tier 7 is enforced via a Registrations
// status change instead (see _rcSetRegistrationStatus_ in Protests.gs).
// Tier labels use ": " not " -- " (2026-09-23, Matt's ask: "get rid of all
// the -- between things... I like colons" -- applies to every "Label --
// Value" style separator sitewide, this one included since it's what
// PENALTY_TIERS' own .label renders directly into the Steward ruling
// dropdown and suggested-tier text). See _rclDescribePenaltyEffect_/the
// tierLabel regex in league.js, which strips this same "Tier N: " prefix
// back off -- kept in sync with this format.
var PENALTY_TIERS = [
  { tier: 1, label: 'Tier 1: Warning', effect: 'Logged only, no time or position impact', effectType: null, effectSeconds: 0 },
  { tier: 2, label: 'Tier 2: Time Penalty (5s)', effect: '+5s added to final race time', effectType: 'Time', effectSeconds: 5 },
  { tier: 3, label: 'Tier 3: Time Penalty (10s)', effect: '+10s added to final race time', effectType: 'Time', effectSeconds: 10 },
  { tier: 4, label: 'Tier 4: Drive-Through Equivalent', effect: '+20s added to final race time', effectType: 'Time', effectSeconds: 20 },
  { tier: 5, label: 'Tier 5: Stop-and-Go Equivalent', effect: '+40s added to final race time', effectType: 'Time', effectSeconds: 40 },
  { tier: 6, label: 'Tier 6: Disqualification', effect: 'Removed from session results', effectType: 'DSQ', effectSeconds: 0 },
  { tier: 7, label: 'Tier 7: Suspension', effect: 'Sits out one or more future rounds (requires a prior Tier 6)', effectType: null, effectSeconds: 0 }
];

function penaltyTierByNumber(tierNum) {
  var n = Number(tierNum);
  for (var i = 0; i < PENALTY_TIERS.length; i++) {
    if (PENALTY_TIERS[i].tier === n) return PENALTY_TIERS[i];
  }
  return null;
}

// Mirrors Protests.gs's SUGGESTED_TIER_BY_INFRACTION_ -- the standard
// ruling tier the Rulebook assigns to an infraction type, for UI use (a
// hint next to the penalty-tier dropdown, and the basis for the
// "ruling at a different tier requires a written explanation" prompt).
// Added 2026-09-23 alongside the standardized-ruling backend work. Only
// the two auto-flagged registration-mismatch infraction types carry a
// fixed standard tier -- driver-filed infractions (contact, unsafe
// rejoin, etc.) are judged case by case and have no entry here.
var SUGGESTED_TIER_BY_INFRACTION = {
  'Wrong-Class Entry': 6,
  'Wrong-Team/Car Entry': 6
};

// How long after a round's results are imported a driver can still file a
// protest for it -- shortened 48 -> 24 (2026-09-24, Matt's call: "no one
// is going to submit a protest from a fun, casual league 2 days later.
// Plus it lets me make the results official sooner"). Measured against
// that Round's Sessions row(s) ImportedAt, the same timestamp Ingestion.gs
// stamps on every session it writes -- see the real source of truth,
// PROTEST_WINDOW_HOURS_ in Protests.gs (this copy isn't currently read by
// anything client-side, kept only so this file's reference constants stay
// in sync with the backend's).
var PROTEST_WINDOW_HOURS = 24;

// sponsorTermsTooltip() removed entirely 2026-09-17 -- V1 scope cut,
// Sponsorship system out of the site. See season-1-mvp-scope.md.

// CSS variable (defined in css/style.css) holding each class's badge
// color -- shared by the driver profile's Current Seat number badge and
// anywhere else a class needs the same consistent color.
// LMGTE (2026-09-20, Matt's ask: "the pill color is orange") added --
// --rc-class-lmgte is defined alongside the other three class-color
// tokens in css/style.css's :root.
var CAR_CLASS_BADGE_COLOR_VAR = { LMGTE: '--rc-class-lmgte', LMGT3: '--rc-class-lmgt3', LMP3: '--rc-class-lmp3', LMP2: '--rc-class-lmp2', Hypercar: '--rc-class-hypercar' };

// Short abbreviated label per class (2026-09-19) -- for the compact class
// pill on the Dashboard's Current Seat card, placed right before the car
// number (Matt's ask: "a hypercar would have a red rectangle, rounded
// edges with HY in it"). Same color tokens as CAR_CLASS_BADGE_COLOR_VAR
// above, just a shorter label for the tighter space next to a car number.
// LMGT3 stays spelled out in full here (2026-09-19 correction, Matt's
// call: "Make sure class pills are saying LMGT3 and not just GT3
// throughout the site") -- it was the one class this map actually
// shortened rather than abbreviated to a genuinely different short form
// (LMP3->P3, LMP2->P2 read unambiguously as their own class; "GT3" alone
// reads as a different real-world class entirely, not shorthand for
// LMGT3), so it's excluded from the abbreviation and just passes through
// via _rcClassAbbrevPill's own key fallback below. LMGTE (2026-09-20)
// gets the same treatment for the same reason -- "GTE" alone reads as
// the real-world Le Mans GTE class, not shorthand for LMGTE.
var CAR_CLASS_ABBREV = { LMP3: 'P3', LMP2: 'P2', Hypercar: 'HY' };

// Manufacturer logo file convention -- assets/manufacturers/{slug}.png
// (2026-09-19, Matt's call: keep manufacturer logos in their own
// top-level assets/manufacturers/ folder, not nested under assets/images/)
// -- keyed by manufacturer name instead of by driver, since the same
// manufacturer (e.g. "Ford") logo is reused across every car/team that
// drives one. Admin uploads the actual image files by hand (not built/
// seeded here) using this exact naming -- lowercase, spaces/punctuation
// collapsed to a single hyphen, e.g. "Aston Martin" -> "aston-martin.png".
// Callers should always set an onerror handler to hide the <img>
// gracefully if that file hasn't been uploaded yet (see
// currentSeatBlock() in Account.html).
function manufacturerLogoSrc(manufacturerName) {
  var slug = String(manufacturerName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
  return 'assets/manufacturers/' + slug + '.png';
}

// sponsorLogoSrc() removed entirely 2026-09-17 -- V1 scope cut, Sponsorship
// system out of the site. See season-1-mvp-scope.md.

// Track image file convention -- assets/images/tracks/{TrackID}.png, keyed by the
// raw TrackID (e.g. "TRK-0001") verbatim, NOT slugified like the
// manufacturer/sponsor logos above -- Matt's call, since TrackID is
// already a clean, stable identifier. Admin uploads the actual image
// files by hand; callers should always set an onerror handler to hide the
// <img> gracefully (silently, no broken-image icon) if that track's file
// hasn't been uploaded yet -- see raceCard() in Account.html.
function trackImageSrc(trackId) {
  return 'assets/images/tracks/' + String(trackId || '') + '.png';
}

// Flat (non-emoji) country flag image -- flagcdn.com, keyed by the
// lowercase ISO 3166-1 alpha-2 code looked up from COUNTRY_CODES
// (2026-09-19, League Hub Leaderboard redesign, Matt's ask: "a flat flag
// (not emoji) of the driver's home country"). Deliberately NOT
// flagEmoji() above -- that one builds a Unicode emoji flag, which is
// explicitly what Matt does not want here.
//
// Points at flagcdn.com (2026-09-19 follow-up -- was assets/flags/{code}.svg,
// a manual-upload convention like manufacturerLogoSrc()/trackImageSrc()
// above, but Matt never actually wanted to have to supply flag images one
// country at a time; he was expecting something that "just worked" the
// way a universal flag set would). flagcdn.com is a free, no-signup,
// no-API-key public CDN built exactly for hot-linking flat SVG flags by
// ISO code -- every country in COUNTRY_CODES already has an entry there,
// so this needs no assets of Race Club's own and no further setup.
// Callers should still always set an onerror handler to hide the <img>
// gracefully (e.g. if countryName doesn't match anything in
// COUNTRY_CODES, or the CDN is unreachable).
function countryFlagSrc(countryName) {
  var code = COUNTRY_CODES[countryName || ''] || '';
  if (!code) return '';
  return 'https://flagcdn.com/' + code.toLowerCase() + '.svg';
}

// Same slugging convention as manufacturerLogoSrc() above, pointed at
// assets/avatars/{slug}.jpg instead -- e.g. "Porsche" -> "porsche.jpg".
// Not currently called from anywhere client-side (the server auto-writes
// this exact filename to ProfileID.AvatarFile at team lock -- see
// manufacturerToAvatarFile() / handleJoinTeam in 4_DataCache.gs, the
// actual server-side mirror of this slug rule -- and avatarImageSrc() in
// Account.html just reads whatever's stored there), but kept here as the
// documented client-side reference for the same convention, and in case
// a future screen wants to preview a manufacturer's avatar before a team
// is actually locked.
function manufacturerAvatarSrc(manufacturerName) {
  var slug = String(manufacturerName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
  return 'assets/avatars/' + slug + '.jpg';
}

// Mirrors DRIVER_NAME_SUFFIXES in 6_Auth.gs -- this is just the client-
// side dropdown source; the server independently re-validates against its
// own copy, so this list is never trusted as the actual validation.
var DRIVER_NAME_SUFFIXES = ['Jr.', 'Sr.', 'II', 'III', 'IV', 'V'];

// RC_LEDGER_TYPE_LABELS/ledgerTypeLabel() removed entirely 2026-09-17 -- V1
// scope cut, the Finances page they backed is gone along with the whole
// Finances/Economy, Sponsorship, and Wager/Betting systems. See
// season-1-mvp-scope.md.
