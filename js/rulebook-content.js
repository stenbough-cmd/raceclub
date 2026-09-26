// Race Club — Rulebook content (js/rulebook-content.js)
//
// WHAT THIS FILE IS FOR
// Holds the Rulebook popup's content as plain data, kept separate from
// Account.html (already a very large file) so updating the rulebook as it
// grows is a small, low-risk edit here instead of hunting through the
// account script. This is a hand-maintained mirror of the Race Club
// Rulebook.md document (the canonical source) -- whenever the rulebook
// doc changes, update RULEBOOK_SECTIONS below to match. Each section's
// `html` is written by hand (not parsed from Markdown at runtime) since
// the content is controlled by us, not user input, and a full Markdown
// parser would be a lot of weight for content that changes rarely.
//
// Rendered by renderHelpSection() in Account.html, under that section's
// "Rules and Regulations" container: the index up top links to each
// section's id (#rc-rulebook-sec-N), and unwritten sections still appear
// in both the index and the body (marked "Not yet drafted") so the page
// honestly reflects the rulebook's full planned scope, not just what's
// done so far -- same "coming soon, not hidden" philosophy as the rest
// of the site. (Help briefly lived on its own page, help.html, so the
// Rulebook would have room to grow -- but that dropped the sidebar/nav
// chrome, which read as leaving the site, so Matt had it folded back
// into Account.html as an ordinary section.)
//
// REWRITTEN 2026-09-26 (Matt's pass): renumbered 1-9 after two sections
// were folded away -- "Car & Class Selection" merged into Getting Started
// (Section 2), and "Appeals" removed outright (there is no appeals
// process; every automatic in-game call and every steward ruling is
// final, see Sections 4.3 and 5). Every section's copy was also
// tightened to stay factual and current-state-only -- no specific times
// or point values that could change season to season, no "not yet
// decided" placeholders where the real answer is just "set per season."
//
// title: shown in the index and as the section heading.
// draft: true for sections not yet written -- renders a "Not yet
//   drafted" note instead of html, and is visually de-emphasized in the
//   "Jump To A Section" quick-nav (see .rc-rulebook-nav-link.rc-rulebook-
//   draft in style.css).
// html: the section body. Safe to use innerHTML here since every string
//   below is authored by us, not sourced from user input.
var RULEBOOK_SECTIONS = [
  {
    id: 'welcome-overview', num: '1', title: 'Welcome & Overview',
    html: '<p>Race Club is a persistent driver career league built on real Le Mans Ultimate races. Every round you run and every season you complete is tracked to your own driver profile -- results, penalties, and history all carry forward instead of resetting each week.</p>' +
      '<p>The League Hub is the public view of that career: standings, results, and news update as soon as a round is scored, visible to anyone without needing to log in.</p>' +
      '<p>Race Club runs a WEC-style season: race length varies round to round, mixing shorter sprint rounds with longer endurance rounds. Cars are grouped into classes modeled on real WEC competition -- Hypercar, LMP2, LMP3, LMGT3, and LMGTE.</p>' +
      '<div class="rc-rulebook-callout"><strong>Overview:</strong><ul>' +
      '<li>Driver profile, results, and career history persist across every season</li>' +
      '<li>Every race, penalty, and bonus is logged to your permanent record</li>' +
      '<li>Built on real LMU league races, not a separate simulation layer</li>' +
      '</ul></div>'
  },
  {
    id: 'getting-started', num: '2', title: 'Getting Started',
    html: '<h4>2.1 Registering For a Season</h4>' +
      '<p>When a season is open for registration, the Dashboard’s Registration Status card shows REGISTER FOR [SEASON NAME]. Clicking it opens the registration popup:</p>' +
      '<ol><li>Choose a class. If only one class is currently open, this step is skipped automatically.</li>' +
      '<li>Choose a car. Cars are listed by car number, lowest to highest.</li>' +
      '<li>Click Join This Team. This locks the seat in immediately and cannot be undone.</li></ol>' +
      '<p>Joining a team plays a short signing sequence, then holds on a congratulations screen until Continue is clicked. Continue reloads the page and returns to the Dashboard with the new team reflected everywhere.</p>' +
      '<div class="rc-rulebook-callout"><strong>Registering:</strong><ul>' +
      '<li>Seats are first-come, first-served: once a driver joins a team, that seat is locked for the rest of the season</li>' +
      '<li>Class and team choice both lock in immediately, no confirmation step after Join This Team</li>' +
      '</ul></div>' +
      '<h4>2.2 Classes</h4>' +
      '<p>Race Club currently runs five classes: Hypercar, LMP2, LMP3, LMGT3, and LMGTE. Which classes are open for a given season is set when that season is created.</p>'
  },
  {
    id: 'race-weekend-format', num: '3', title: 'Race Weekend Format',
    html: '<h4>3.1 Session Order</h4>' +
      '<p>A race weekend runs in one fixed order: the server opens for practice first, then qualifying, then the race. Session start times are set per round and shown on the Calendar -- they can vary from season to season, so check the Calendar for a specific round rather than assuming a fixed schedule.</p>' +
      '<p>Be in the server before qualifying starts. A driver who isn’t in by the start of qualifying may not be able to start the race.</p>' +
      '<h4>3.2 Qualifying Format</h4>' +
      '<p>Qualifying is either private (each driver sets a time independently) or public (all drivers qualify together on track at the same time). Which format is used is decided at the start of the season and applies to every round that season -- it is not changed round to round.</p>' +
      '<h4>3.3 Formation Lap &amp; Start</h4>' +
      '<p>The formation lap and race start are handled automatically by the game. Drivers must follow the game’s visual cues; a jump start or formation lap violation is penalized automatically and is not reviewable (see Section 4.3).</p>' +
      '<h4>3.4 No-Shows (Missed Races)</h4>' +
      '<p>A driver who doesn’t take part in a round has that round recorded as a missed race. A missed race simply scores no points for that round -- nothing else about it is treated differently from a race the driver could have attended. How many of a season’s worst results (including missed races) can be dropped from the championship total is a per-season setting -- see Section 7.</p>'
  },
  {
    id: 'driving-standards', num: '4', title: 'Driving Standards',
    html: '<h4>4.1 General Principles</h4>' +
      '<p>Race Club expects competitive, hard racing. Contact and incidents happen, and not every incident is a penalty. The standard stewards apply is whether an action was reasonably avoidable, not simply whether contact occurred. Drivers are expected to race with awareness of who’s around them and to leave room where it’s reasonably possible to do so.</p>' +
      '<h4>4.2 On-Track Conduct</h4>' +
      '<p>Drivers are responsible for:</p>' +
      '<ul><li>Avoiding contact that could reasonably have been avoided</li>' +
      '<li>Rejoining the track safely after going off, without endangering other cars</li>' +
      '<li>Racing other drivers fairly: no blocking, weaving, or erratic defensive driving</li>' +
      '<li>Being aware of blue flags when about to be lapped</li></ul>' +
      '<h4>4.3 Automatically Enforced (No Organizer Action Required)</h4>' +
      '<p>The following are detected and penalized automatically by LMU’s in-game systems. Stewards do not review or re-adjudicate these:</p>' +
      '<ul><li>Track limits</li><li>Pit lane speeding</li><li>Jump starts</li><li>Formation lap conduct</li></ul>' +
      '<div class="rc-rulebook-callout"><strong>These calls are final.</strong> Any penalty or track limit point issued automatically by the game is not reviewable and cannot be appealed or overturned by stewards or organizers.</div>' +
      '<h4>4.4 Reviewed by Stewards</h4>' +
      '<p>The following require steward review after the race, since the game doesn’t reliably catch them:</p>' +
      '<ul><li>Avoidable collisions and their consequences</li><li>Unsafe rejoins</li><li>Blocking/weaving</li>' +
      '<li>Blue flag violations</li><li>Deliberate retaliation or unsportsmanlike conduct</li></ul>' +
      '<p>There is no live steward commentary or in-race intervention. All of the above are assessed after the fact, via replay and driver reports, and penalties are applied to the final classification (see Section 5).</p>' +
      '<h4>4.5 Incident Reporting (Protests)</h4>' +
      '<p>A driver can file a protest from the Dashboard’s Protests card. Filing one asks for the round, the lap it happened on (or Pre-race/Post-race), an infraction type, and the other driver involved, if any.</p>' +
      '<ul><li>A protest must be filed within 24 hours of that round’s results being posted.</li>' +
      '<li>Each driver can file up to 2 protests per race. A withdrawn protest still counts toward that limit.</li>' +
      '<li>A protest can be edited or withdrawn any time before a steward rules on it, or before the round’s results are finalized.</li></ul>' +
      '<p>Once filed, a protest is reviewed and ruled on by the Steward Board -- see Section 5.</p>'
  },
  {
    id: 'penalties', num: '5', title: 'Penalties',
    html: '<div class="rc-rulebook-callout"><strong>Fully active.</strong> A driver can file a protest, and the Steward Board rules on it and assigns a tier below. Ruling at Tier 2 through Tier 6 automatically applies that tier’s effect (a time penalty, or a disqualification) to the round’s results and every affected standing going forward -- a ruling isn’t just a recorded judgment, it moves the finishing position and points on its own. Tier 7 (Suspension) is enforced automatically as well. Two infraction types -- Wrong-Class Entry and Wrong-Team/Car Entry -- carry a standard Tier 6.</div>' +
      '<p>Race Club’s penalty system is adapted from FIA/WEC’s structure, simplified for a solo-driver format. It’s scoped to what the game <em>doesn’t</em> already catch. Track limits, pit lane speeding, and jump starts are enforced automatically by LMU’s Race Control and don’t require organizer action (see Section 4).</p>' +
      '<h4>5.1 Penalty Tiers</h4>' +
      '<p>All time penalties in Race Club are applied post-race by stewards reviewing replays/reports. There is no in-race serving mechanic. Every penalty either gets logged as a reprimand or is converted directly into added time (or a further consequence) on the final classification.</p>' +
      '<table><tr><td><strong>Tier</strong></td><td><strong>Penalty</strong></td><td><strong>Effect</strong></td></tr>' +
      '<tr><td>1</td><td>Warning</td><td>Logged only, no time or position impact</td></tr>' +
      '<tr><td>2</td><td>Time Penalty (5s)</td><td>Added to final race time</td></tr>' +
      '<tr><td>3</td><td>Time Penalty (10s)</td><td>Added to final race time</td></tr>' +
      '<tr><td>4</td><td>Drive-Through Equivalent</td><td>+20s added to final race time</td></tr>' +
      '<tr><td>5</td><td>Stop-and-Go Equivalent</td><td>+40s added to final race time</td></tr>' +
      '<tr><td>6</td><td>Disqualification</td><td>Removed from session results</td></tr>' +
      '<tr><td>7</td><td>Suspension</td><td>Driver sits out one or more future rounds</td></tr></table>' +
      '<h4>5.2 Infraction Types</h4>' +
      '<p><strong>Contact &amp; driving standards</strong></p>' +
      '<ul><li>Avoidable collision: causing contact that could reasonably have been avoided</li>' +
      '<li>Unsafe rejoin: returning to the track in a way that endangers another driver</li>' +
      '<li>Blocking/weaving: erratic defensive moves, especially under braking or on straights</li></ul>' +
      '<p><strong>Procedural</strong></p><ul><li>Ignoring blue flags when being lapped</li></ul>' +
      '<p class="rc-hint"><em>Note: jump starts and formation lap conduct are automatically detected and enforced by LMU, no organizer/steward action required (see Section 4). These automatic calls are final and not subject to review.</em></p>' +
      '<p><strong>Conduct</strong></p><ul><li>Deliberate retaliation after an incident</li><li>Post-incident unsportsmanlike behavior (chat, voice comms)</li></ul>' +
      '<p><strong>Eligibility</strong></p><ul><li>Wrong-class entry: a driver who signs up for and races in a class they aren’t eligible for is disqualified from that race and removed from the session (kicked); this is a Tier 6 (Disqualification) matter, not a graduated penalty.</li>' +
      '<li>Wrong-team/car entry: a driver who races a car or team seat other than the one they registered for is disqualified from that race and removed from the session (kicked); this is also a Tier 6 (Disqualification) matter, not a graduated penalty.</li></ul>' +
      '<h4>5.3 Example Incidents by Tier</h4>' +
      '<p>For context, these are illustrative examples, not an exhaustive list. Stewards retain discretion to adjust based on circumstances.</p>' +
      '<table><tr><td><strong>Tier</strong></td><td><strong>Example Incident</strong></td></tr>' +
      '<tr><td>1, Warning</td><td>Minor, brief off-line defensive move with no contact; borderline blue flag delay with no time gained</td></tr>' +
      '<tr><td>2, 5s</td><td>Light contact causing another driver to briefly run wide, no spin or position change</td></tr>' +
      '<tr><td>3, 10s</td><td>Contact causing another driver to spin or lose a position; ignoring a blue flag long enough to hold up a lapping car</td></tr>' +
      '<tr><td>4, Drive-Through Equiv. (+20s)</td><td>Contact causing another driver to retire or lose significant time/positions</td></tr>' +
      '<tr><td>5, Stop-and-Go Equiv. (+40s)</td><td>Deliberate or reckless contact</td></tr>' +
      '<tr><td>6, Disqualification</td><td>Intentional dangerous driving; deliberate race manipulation; severe unsporting conduct; wrong-class or wrong-team/car entry (driver removed from session)</td></tr>' +
      '<tr><td>7, Suspension</td><td>Repeated Tier 4/5 offenses within a season following a prior disqualification; serious conduct violations off-track</td></tr></table>'
  },
  {
    id: 'race-control', num: '6', title: 'Race Control Procedures',
    html: '<p>Race control is handled by the game itself. Races follow LMU’s standard online multiplayer rules, with penalties and decisions applied automatically according to whatever format the season is set to.</p>' +
      '<p>There is currently no safety car functionality, so there are no full-course caution periods.</p>' +
      '<p>Post-race stewarding is handled entirely through protests submitted by drivers (see Section 4.5). Drivers are encouraged to join Race Club’s Discord and use the chat channel for their class.</p>'
  },
  {
    id: 'points-standings', num: '7', title: 'Points & Standings',
    html: '<p>Every round awards championship points by finishing position within your class. Longer and higher-profile rounds are worth more points than shorter ones, so the calendar isn’t weighted evenly round to round -- exact point values are set per season and can change from one season to the next.</p>' +
      '<p>Pole position, fastest lap, and most laps led are tracked automatically each race and can add bonus points on top of finishing position.</p>' +
      '<p>A season can allow a number of drop weeks: once enough rounds have been completed, each driver’s lowest-scoring result(s) are dropped from their championship total, up to the number of drop weeks that season allows.</p>' +
      '<p>Special events are exhibition (“fun”) races and never count toward championship standings. They don’t count as a missed race either, and have no effect on drop weeks or anything else tied to the championship.</p>' +
      '<p>Ties in the standings are broken by countback: the driver with the better finishing positions across the season, compared head to head, ranks higher.</p>'
  },
  {
    id: 'conduct-discipline', num: '8', title: 'Conduct & Discipline (Off-Track)',
    html: '<p>Race Club is a friendly, competitive community. Most incidents are just racing -- a respectful conversation between the drivers involved solves things faster than escalating.</p>' +
      '<h4>Expected of every driver</h4>' +
      '<ul><li>Race hard, but race fair -- treat contact and mistakes as part of racing, not a reason for retaliation</li>' +
      '<li>Talk to other drivers the way you would if they were standing in front of you</li>' +
      '<li>Keep race chat, voice comms, and Discord respectful, even in the heat of the moment</li>' +
      '<li>Try to work out disagreements directly with the other driver first</li>' +
      '<li>Contact a league organizer if a disagreement can’t be resolved between drivers, or if conduct crosses a line</li></ul>' +
      '<h4>Not allowed</h4>' +
      '<ul><li>Harassment, hate speech, or discrimination of any kind</li>' +
      '<li>Personal insults, threats, or targeted abuse in race chat, voice comms, or Discord</li>' +
      '<li>Deliberate wrecking, blocking, or retaliation against another driver</li>' +
      '<li>Spamming, trolling, or deliberately disrupting a race or the Discord server</li>' +
      '<li>Sharing another member’s personal information without their consent</li>' +
      '<li>Cheating, exploiting bugs, or attempting to manipulate results</li></ul>' +
      '<div class="rc-rulebook-callout">All race chat and Discord activity is visible to admins and league organizers. Race Club is meant to be a friendly place first, and we’d rather a disagreement get resolved quietly between drivers than turn into a bigger issue. That said, conduct that violates the rules above won’t be tolerated, and Race Club reserves the right to remove any member who can’t follow them.</div>'
  },
  {
    id: 'glossary', num: '9', title: 'Glossary',
    html: '<table>' +
      '<tr><td><strong>Season</strong></td><td>A defined period of racing with its own calendar, standings, and registrations, from an opening round through its final round.</td></tr>' +
      '<tr><td><strong>Round</strong></td><td>One scheduled race weekend within a season: Practice, then Qualifying, then the Race.</td></tr>' +
      '<tr><td><strong>Special Event</strong></td><td>An exhibition (“fun”) round on the calendar that never affects championship standings, drop weeks, or missed-race counts.</td></tr>' +
      '<tr><td><strong>Bye Week</strong></td><td>A week on the calendar with no scheduled round at all -- nothing to race, nothing to score.</td></tr>' +
      '<tr><td><strong>Drop Week</strong></td><td>A per-season setting that drops a driver’s lowest-scoring round(s) from their championship point total once enough rounds are complete (see Section 7).</td></tr>' +
      '<tr><td><strong>Private Qualifying</strong></td><td>A qualifying format where each driver sets their lap time independently, not on track with the rest of the grid at once.</td></tr>' +
      '<tr><td><strong>Public Qualifying</strong></td><td>A qualifying format where every driver qualifies together on track at the same time.</td></tr>' +
      '<tr><td><strong>Class</strong></td><td>The category of car a driver races for a season. Race Club currently runs Hypercar, LMP2, LMP3, LMGT3, and LMGTE.</td></tr>' +
      '<tr><td><strong>Seat</strong></td><td>A driver’s registered car and team for a season. Seats are first-come, first-served and lock in once claimed.</td></tr>' +
      '<tr><td><strong>Steward</strong></td><td>An Admin, Organizer, or Steward who reviews and rules on protests.</td></tr>' +
      '<tr><td><strong>Protest</strong></td><td>A driver-submitted report of an on-track incident, reviewed by the Steward Board (Sections 4.5 and 5).</td></tr>' +
      '<tr><td><strong>Tier</strong></td><td>The penalty level, 1 through 7, a steward assigns when upholding a protest -- from a Warning up to Suspension (Section 5.1).</td></tr>' +
      '<tr><td><strong>Finalized Results</strong></td><td>A round whose results and rulings are locked in and can no longer be protested, edited, or changed.</td></tr>' +
      '<tr><td><strong>Countback</strong></td><td>The tie-break method used in the standings: compares drivers’ best finishes head to head.</td></tr>' +
      '</table>'
  }
];
