// Race Club — js/reference-data.js (v0.2.5, GitHub Pages edition)
// WHAT CHANGED VS. THE GOOGLE SITES VERSION: In the single-file embed, the country list,
// country->flag-emoji lookup, and the curated/offset-sorted timezone list were declared once and
// used by both the registration form and the profile edit form because everything shared one
// <script> scope.

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

// Curated, not the full ~400-zone IANA list, but every standard UTC offset (including the half-hour
// and 45-minute ones actually used by real countries, e.g.
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

// Minutes offset from UTC, right now, for a given IANA zone -- e.g. "America/Chicago" during DST
// returns -300.
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

// v0.17 -- the canonical race-class list, used as the SINGLE SOURCE for both the Data Management >
// Cars panel's Class dropdown (Account.html) and the Create Season wizard's class checkboxes.
var CAR_CLASS_LIST = ['LMGTE', 'LMGT3', 'LMP3', 'LMP2', 'Hypercar'];

// CAR OBJECTIVES SYSTEM -- a second, independent bonus layer alongside Sponsors, bound to a car for
// one season. Unlike class, this is ONE global grouping across every class combined (a GT3 and a
// Hypercar can both be "High" side by side) -- set by hand per car/team in Car Management
// (Cars.Tier), never a computed numeric rank.
// Cars.Tier/Teams.Tier are now archived columns in the backend (see Core.gs's TAB_SCHEMAS),
// untouched but never read or written going forward.

// 6 objectives per tier (Low/Mid/High), matched to that tier's difficulty (Low = things a
// backmarker car can realistically pull off in a season; High = things only a factory-caliber
// effort should manage, but every one of the six should feel about equally hard to each other).
// Elite carries just the one objective, deliberately.
// No two cars in the same tier get the same objective in the same season while the pool lasts --
// handleCreateSeason hands them out round-robin per tier, repeating from the top only once every
// objective in that tier is already assigned this season (six per tier keeps that ceiling well out
// of reach for a normal-size grid).
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
  // Elite -- one car per class, hand-picked per season in the Season Creation Wizard (never
  // assigned via Car Management's Tier field, and never round-robin'd like the tiers above since
  // there's exactly one Elite car per class to begin with).
  Elite: [
    'Win Season Championship' // wins the class championship
  ]
};

// One short, driver-facing description per objective above -- shown as a hover tooltip on the
// objective's checkbox in the Create Season wizard, and on the Season Objective chip on the Choose
// Your Team screen. Keep these in sync with the inline comments in CAR_OBJECTIVE_CATALOG.
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

// Confirmed dead (no remaining references anywhere) before removing. Same fate as the Sponsor
// catalogs below.

// See season-1-mvp-scope.md.

// ---------------------------------------------------------------------------
// PROTESTS -- backs the driver-facing Protest submission page, the Dashboard's Protest card, and
// League Management's EDIT (penalty-tier assessment) popup.

var PROTEST_INFRACTION_TYPES = [
  'Intentional Wrecking',
  'Unsafe Rejoin',
  'Avoidable Contact (Other Driver)',
  'Avoidable Contact (Self Report)',
  'Unsportsmanlike Behavior'
];

// Race Club Rulebook.md Section 5.1 Penalty Tiers, mirrored here as data so the EDIT popup's
// penalty-tier dropdown and its resulting time-penalty/ disqualification effect can never drift
// from the published rulebook text.
var PENALTY_TIERS = [
  { tier: 1, label: 'Tier 1: Warning', effect: 'Logged only, no time or position impact', effectType: null, effectSeconds: 0 },
  { tier: 2, label: 'Tier 2: Time Penalty', effect: '+5s added to final race time', effectType: 'Time', effectSeconds: 5 },
  { tier: 3, label: 'Tier 3: Time Penalty', effect: '+10s added to final race time', effectType: 'Time', effectSeconds: 10 },
  { tier: 4, label: 'Tier 4: Drive-Through Equivalent', effect: '+20s added to final race time', effectType: 'Time', effectSeconds: 20 },
  { tier: 5, label: 'Tier 5: Stop-and-Go Equivalent', effect: '+40s added to final race time', effectType: 'Time', effectSeconds: 40 },
  { tier: 6, label: 'Tier 6: Disqualification', effect: 'Removed from session results', effectType: 'DSQ', effectSeconds: 0 },
  // Suspension now also removes the driver from THIS race's own classification -- on top of sitting
  // out the rest of the season. Requires a prior Upheld Tier 6 for this driver this season
  // (enforced in the ruling dropdown and server-side -- see handleAdminRuleOnProtest's
  // TIER7_REQUIRES_PRIOR_DSQ gate in Protests.gs).
  { tier: 7, label: 'Tier 7: Suspension', effect: 'Removed from this race, suspended for the rest of the season', effectType: 'Suspension', effectSeconds: 0 }
];

function penaltyTierByNumber(tierNum) {
  var n = Number(tierNum);
  for (var i = 0; i < PENALTY_TIERS.length; i++) {
    if (PENALTY_TIERS[i].tier === n) return PENALTY_TIERS[i];
  }
  return null;
}

// Mirrors Protests.gs's SUGGESTED_TIER_BY_INFRACTION_ -- the standard ruling tier the Rulebook
// assigns to an infraction type, for UI use (a hint next to the penalty-tier dropdown, and the
// basis for the "ruling at a different tier requires a written explanation" prompt).
var SUGGESTED_TIER_BY_INFRACTION = {
  'Wrong-Class Entry': 6,
  'Wrong-Team/Car Entry': 6
};

// How long after a round's results are imported a driver can still file a protest for it --
// shortened 48 -> 24.
var PROTEST_WINDOW_HOURS = 24;

// See season-1-mvp-scope.md.

// CSS variable (defined in css/style.css) holding each class's badge color -- shared by the driver
// profile's Current Seat number badge and anywhere else a class needs the same consistent color.
var CAR_CLASS_BADGE_COLOR_VAR = { LMGTE: '--rc-class-lmgte', LMGT3: '--rc-class-lmgt3', LMP3: '--rc-class-lmp3', LMP2: '--rc-class-lmp2', Hypercar: '--rc-class-hypercar' };

// Short abbreviated label per class -- for the compact class pill on the Dashboard's Current Seat
// card, placed right before the car number.
var CAR_CLASS_ABBREV = { LMP3: 'P3', LMP2: 'P2', Hypercar: 'HY' };

// Manufacturer logo file convention, two-color variant -- assets/manufacturers/{slug}-black.png
// (for a light background) and assets/manufacturers/{slug}-white.png (for a dark one), e.g.
// "Toyota" -> "toyota-black.png"/"toyota-white.png".
// Admin uploads the actual image files by hand (not built/seeded here) using this exact naming --
// lowercase, spaces/punctuation collapsed to a single hyphen, e.g. "Aston Martin" ->
// "aston-martin-black.png"/"aston-martin-white.png".
function _rcMfrLogoSlug_(manufacturerName) {
  return String(manufacturerName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
}
function manufacturerLogoSrc(manufacturerName, variant) {
  var v = (variant === 'white') ? 'white' : 'black';
  return 'assets/manufacturers/' + _rcMfrLogoSlug_(manufacturerName) + '-' + v + '.png';
}

// Legacy single-file convention, kept only as the fallback chain's second rung now (see
// manufacturerLogoFallback below) -- not called directly by any page any more.
function manufacturerLogoLegacySrc_(manufacturerName) {
  return 'assets/manufacturers/' + _rcMfrLogoSlug_(manufacturerName) + '.png';
}

function manufacturerLogoSvgSrc(manufacturerName) {
  return 'assets/manufacturers/' + _rcMfrLogoSlug_(manufacturerName) + '.svg';
}

// Arms an <img> whose src is already set to manufacturerLogoSrc(name, variant) with a three-step
// fallback chain: if the new {slug}-{variant}.png 404s, try the old single {slug}.png (today's
// logo, right color or not, for a manufacturer that hasn't been split into a pair yet); if THAT
// also 404s, try the same-named .svg; if that ALSO 404s, run onAllFailed (every existing call site
// passes a function that hides the <img> or its wrapper, same as before this fallback existed).
function manufacturerLogoFallback(imgEl, manufacturerName, onAllFailed) {
  var step = 0;
  imgEl.onerror = function () {
    if (step === 0) {
      step = 1;
      imgEl.src = manufacturerLogoLegacySrc_(manufacturerName);
    } else if (step === 1) {
      step = 2;
      imgEl.src = manufacturerLogoSvgSrc(manufacturerName);
    } else {
      imgEl.onerror = null;
      if (typeof onAllFailed === 'function') onAllFailed();
    }
  };
}

// See season-1-mvp-scope.md.

// Flat (non-emoji) country flag image -- flagcdn.com, keyed by the lowercase ISO 3166-1 alpha-2
// code looked up from COUNTRY_CODES.
// Points at flagcdn.com. flagcdn.com is a free, no-signup, no-API-key public CDN built exactly for
// hot-linking flat SVG flags by ISO code -- every country in COUNTRY_CODES already has an entry
// there, so this needs no assets of Race Club's own and no further setup.
function countryFlagSrc(countryName) {
  var code = COUNTRY_CODES[countryName || ''] || '';
  if (!code) return '';
  return 'https://flagcdn.com/' + code.toLowerCase() + '.svg';
}

// manufacturerAvatarSrc() REMOVED -- same slugging convention as manufacturerLogoSrc() above,
// pointed at assets/avatars/{slug}.jpg instead. Avatars are entirely user-chosen via Edit Profile
// now (see edit-profile.js).

// Mirrors DRIVER_NAME_SUFFIXES in 6_Auth.gs -- this is just the client- side dropdown source; the
// server independently re-validates against its own copy, so this list is never trusted as the
// actual validation.
var DRIVER_NAME_SUFFIXES = ['Jr.', 'Sr.', 'II', 'III', 'IV', 'V'];

// See season-1-mvp-scope.md.
