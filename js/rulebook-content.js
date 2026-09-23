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
    html: '<p>Race Club is a persistent, solo-driver career league built on top of real Le Mans Ultimate races. Rather than treating each week as a standalone event, Race Club tracks your driver profile, results, and history across every season, so your career actually accumulates over time, race by race.</p>' +
      '<div class="rc-rulebook-callout"><strong>Overview:</strong><ul>' +
      '<li>Persistent driver profile: your identity, history, and stats carry across every season</li>' +
      '<li>Every race, penalty, and bonus is logged to your permanent career record</li>' +
      '<li>Built on real LMU league races, not a separate simulation layer</li>' +
      '</ul></div>' +
      '<p>Race weekends vary in length and weight. Some rounds run 40 minutes, others run up to 80, and the points on offer scale with both the length of the race and its prestige within the season calendar, so not every round carries the same value toward your standing.</p>' +
      '<div class="rc-rulebook-callout"><strong>Race format:</strong><ul>' +
      '<li>Races range from 40 to 80 minutes</li>' +
      '<li>Points scale with race length and round prestige</li>' +
      '<li>Pole, fastest lap, and most-laps-led bonuses are tracked automatically each session</li>' +
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
      '</ul></div>'
  },
  {
    id: 'race-weekend-format', num: '3', title: 'Race Weekend Format',
    html: '<h4>3.1 Session Structure</h4>' +
      '<p>Each round follows a fixed session structure:</p>' +
      '<table><tr><td><strong>Session</strong></td><td><strong>Length</strong></td></tr>' +
      '<tr><td>Practice</td><td>30 minutes</td></tr>' +
      '<tr><td>Qualifying</td><td>7 minutes</td></tr>' +
      '<tr><td>Race</td><td>40 to 80 minutes (varies by round, see Section 1)</td></tr></table>' +
      '<h4>3.2 Qualifying Format</h4>' +
      '<p>Whether qualifying is run privately (each driver sets a time independently) or publicly (qualifying together with other drivers on track) is decided at the start of the season and applies to all rounds for that season. It is not changed round to round.</p>' +
      '<h4>3.3 Formation Lap &amp; Start</h4>' +
      '<p>The formation lap is always a short formation lap and, like the start procedure itself, is handled automatically by LMU. Drivers must follow the game’s visual cues to avoid an automatic in-game penalty (see Section 4.3, these calls are final and not reviewable).</p>' +
      '<h4>3.4 No-Shows (Dropped Races)</h4>' +
      '<p>A driver who doesn’t attend a round has that round recorded as a dropped race. A dropped race is simply excluded from that round’s championship points; nothing else about it is different from a race the driver could have attended.</p>' +
      '<p class="rc-hint"><em>Not yet decided: the exact number of drops allowed per season, and whether that number is fixed league-wide or set by the admin each season.</em></p>'
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
      '<div class="rc-rulebook-callout"><strong>These calls are final.</strong> Any penalty or track limit point issued automatically by the game is not reviewable and cannot be appealed or overturned by stewards, organizers, or the appeals process in Section 10. If the in-game system flags it, the result stands as-is.</div>' +
      '<h4>4.4 Reviewed by Stewards</h4>' +
      '<p>The following require steward review after the race, since the game doesn’t reliably catch them:</p>' +
      '<ul><li>Avoidable collisions and their consequences</li><li>Unsafe rejoins</li><li>Blocking/weaving</li>' +
      '<li>Blue flag violations</li><li>Deliberate retaliation or unsportsmanlike conduct</li></ul>' +
      '<p>There is no live steward commentary or in-race intervention. All of the above are assessed after the fact, via replay and driver reports, and penalties are applied to the final classification (see Section 5).</p>' +
      '<h4>4.5 Incident Reporting</h4><p class="rc-hint">Not yet drafted. Need to define: reporting process/template, where reports are submitted, review timeline.</p>'
  },
  {
    id: 'penalties', num: '5', title: 'Penalties',
    html: '<div class="rc-rulebook-callout"><strong>Fully active.</strong> A driver can file a protest, and the Steward Board rules on it and assigns a tier below. Ruling at Tier 2 through Tier 6 automatically applies that tier’s effect (a time penalty, or a disqualification) to the round’s results and every affected standing going forward -- a ruling isn’t just a recorded judgment, it moves the finishing position and points on its own. Tier 7 (Suspension) is enforced automatically as well. Two infraction types -- Wrong-Class Entry and Wrong-Team/Car Entry -- carry a standard Tier 6 ruling under this Rulebook; ruling one of those at a different tier requires the steward to write a short explanation for the deviation. There is no monetary fine of any kind.</div>' +
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
      '<tr><td>7</td><td>Suspension</td><td>Driver sits out one or more future rounds; requires a prior Tier 6 disqualification</td></tr></table>' +
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
  { id: 'race-control', num: '6', title: 'Race Control Procedures', draft: true },
  { id: 'points-standings', num: '7', title: 'Points & Standings', draft: true },
  {
    id: 'car-class-selection', num: '8', title: 'Car & Class Selection',
    html: '<p>Signing up for a season starts with one screen: <strong>Choose Your Team</strong>. Every team on offer belongs to the class you picked, and each one shows you everything you need to know before you commit: the car and manufacturer, and a short description of what racing for that team is like. Cars are listed by car number, lowest to highest.</p>' +
      '<p>Whatever team you join, it locks in immediately and can\'t be undone once you confirm, so read the description before you commit.</p>'
  },
  { id: 'conduct-discipline', num: '9', title: 'Conduct & Discipline (Off-Track)', draft: true },
  { id: 'appeals', num: '10', title: 'Appeals', draft: true },
  { id: 'glossary', num: '11', title: 'Glossary', draft: true }
];
