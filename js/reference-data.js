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
var CAR_CLASS_LIST = ['LMGT3', 'LMP3', 'LMP2', 'Hypercar'];

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
var CAR_CLASS_REPUTATION_FLOOR = { LMGT3: 0, LMP3: 300, LMP2: 400, Hypercar: 600 };

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

// CSS variable (defined in css/style.css) holding each class's badge
// color -- shared by the driver profile's Current Seat number badge and
// anywhere else a class needs the same consistent color.
var CAR_CLASS_BADGE_COLOR_VAR = { LMGT3: '--rc-class-lmgt3', LMP3: '--rc-class-lmp3', LMP2: '--rc-class-lmp2', Hypercar: '--rc-class-hypercar' };

// Manufacturer logo file convention -- assets/manufacturers/{slug}.png,
// same folder structure as the site's existing assets/avatars/ (see
// avatarImageSrc() in Account.html/profile.html), keyed by manufacturer
// name instead of by driver, since the same manufacturer (e.g. "Ford")
// logo is reused across every car/team that drives one. Admin uploads the
// actual image files by hand (not built/seeded here) using this exact
// naming -- lowercase, spaces/punctuation collapsed to a single hyphen,
// e.g. "Aston Martin" -> "aston-martin.png". Callers should always set an
// onerror handler to hide the <img> gracefully if that file hasn't been
// uploaded yet (see currentSeatBlock() in Account.html).
function manufacturerLogoSrc(manufacturerName) {
  var slug = String(manufacturerName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
  return 'assets/manufacturers/' + slug + '.png';
}

// Same slugging convention as manufacturerLogoSrc() above, pointed at
// assets/sponsors/{slug}.png instead -- e.g. "Blackline Motor Oil" ->
// "blackline-motor-oil.png" (Matt's own example). Admin uploads the
// actual image files by hand, same as manufacturer logos; callers should
// always set an onerror handler to hide the <img> gracefully if that
// sponsor's file hasn't been uploaded yet.
function sponsorLogoSrc(sponsorName) {
  var slug = String(sponsorName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
  return 'assets/sponsors/' + slug + '.png';
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
