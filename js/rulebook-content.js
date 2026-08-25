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
// Rendered by renderHelpSection()/openRulebookModal() in Account.html:
// the index up top links to each section's id (#rc-rulebook-sec-N), and
// unwritten sections still appear in both the index and the body (marked
// "Not yet drafted") so the popup honestly reflects the rulebook's full
// planned scope, not just what's done so far -- same "coming soon, not
// hidden" philosophy as the rest of the site.
//
// title: shown in the index and as the section heading.
// draft: true for sections not yet written -- renders a "Not yet
//   drafted" note instead of html, and is visually de-emphasized in the
//   index (see .rc-rulebook-index a.rc-rulebook-draft in style.css).
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
      '<li>Clean race and fastest lap bonuses are tracked automatically each session</li>' +
      '<li>Multiclass grids: all three tiers race together on track</li>' +
      '</ul></div>' +
      '<p>Drivers progress through three tiers over the course of their career. Bronze is where every rookie starts, racing GT3 or LMP3 machinery — money is the only gate. Silver (LMP2) is a step up in every sense: a larger financial commitment and a 400 Reputation floor stand between a driver and a seat, but the risk comes with greater reward. Gold is Hypercar, the pinnacle of the league, gated behind a 500 Reputation floor and reserved for drivers who’ve proven they belong there. Meeting a class’s money and Reputation gate is all it takes to race there — it’s always the driver’s own choice, never an admin decision. The one exception is a driver who wants into a class before their Reputation has caught up to it; see Section 10, Class Progression, for how that request works.</p>' +
      '<div class="rc-rulebook-callout"><strong>The ladder:</strong><ul>' +
      '<li><strong>Bronze</strong>: GT3 / LMP3 (rookie seats, money only)</li>' +
      '<li><strong>Silver</strong>: LMP2 (money + 400 Reputation floor; higher risk, higher reward)</li>' +
      '<li><strong>Gold</strong>: Hypercar (money + 500 Reputation floor; the pinnacle, only proven drivers qualify)</li>' +
      '<li>Any driver who clears a class’s money + Reputation gate can freely choose to race there — no approval needed</li>' +
      '<li>A driver who wants a class before their Reputation qualifies them can submit a Class Placement Request instead (see Section 10)</li>' +
      '</ul></div>'
  },
  { id: 'getting-started', num: '2', title: 'Getting Started', draft: true },
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
      '<p>A driver who doesn’t attend a round has that round recorded as a dropped race. Attending a round costs money regardless of attendance, as part of the season’s overall cost, so a dropped race is not a way to avoid that cost (see Section 8, Career Economy, once finalized).</p>' +
      '<p>The number of dropped races allowed per season without further consequence is set at the start of the season:</p>' +
      '<ul><li>Only championship points are excluded for a dropped race within that allowance. Any money earned, wagers, or other economy-related changes tied to that round still stand as normal.</li>' +
      '<li>Dropped races beyond that allowance result in an additional deduction from the driver’s bank account, on top of the standard season cost.</li></ul>'
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
      '<div class="rc-rulebook-callout"><strong>These calls are final.</strong> Any penalty or track limit point issued automatically by the game is not reviewable and cannot be appealed or overturned by stewards, organizers, or the appeals process in Section 14. If the in-game system flags it, the result stands as-is.</div>' +
      '<h4>4.4 Reviewed by Stewards</h4>' +
      '<p>The following require steward review after the race, since the game doesn’t reliably catch them:</p>' +
      '<ul><li>Avoidable collisions and their consequences</li><li>Unsafe rejoins</li><li>Blocking/weaving</li>' +
      '<li>Blue flag violations</li><li>Deliberate retaliation or unsportsmanlike conduct</li></ul>' +
      '<p>There is no live steward commentary or in-race intervention. All of the above are assessed after the fact, via replay and driver reports, and penalties are applied to the final classification (see Section 5).</p>' +
      '<h4>4.5 Incident Reporting</h4><p class="rc-hint">Not yet drafted — need to define: reporting process/template, where reports are submitted, review timeline.</p>'
  },
  {
    id: 'penalties', num: '5', title: 'Penalties',
    html: '<p>Race Club’s penalty system is adapted from FIA/WEC’s structure, simplified for a solo-driver format. It’s scoped to what the game <em>doesn’t</em> already catch. Track limits, pit lane speeding, and jump starts are enforced automatically by LMU’s Race Control and don’t require organizer action (see Section 4).</p>' +
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
      '<p><strong>Eligibility</strong></p><ul><li>Wrong-class entry: a driver who signs up for and races in a class they aren’t eligible for is disqualified from that race and removed from the session (kicked); this is a Tier 6 (Disqualification) matter, not a graduated penalty.</li></ul>' +
      '<h4>5.3 Example Incidents by Tier</h4>' +
      '<p>For context, these are illustrative examples, not an exhaustive list. Stewards retain discretion to adjust based on circumstances.</p>' +
      '<table><tr><td><strong>Tier</strong></td><td><strong>Example Incident</strong></td></tr>' +
      '<tr><td>1, Warning</td><td>Minor, brief off-line defensive move with no contact; borderline blue flag delay with no time gained</td></tr>' +
      '<tr><td>2, 5s</td><td>Light contact causing another driver to briefly run wide, no spin or position change</td></tr>' +
      '<tr><td>3, 10s</td><td>Contact causing another driver to spin or lose a position; ignoring a blue flag long enough to hold up a lapping car</td></tr>' +
      '<tr><td>4, Drive-Through Equiv. (+20s)</td><td>Contact causing another driver to retire or lose significant time/positions</td></tr>' +
      '<tr><td>5, Stop-and-Go Equiv. (+40s)</td><td>Deliberate or reckless contact</td></tr>' +
      '<tr><td>6, Disqualification</td><td>Intentional dangerous driving; deliberate race manipulation; severe unsporting conduct; wrong-class entry (driver removed from session)</td></tr>' +
      '<tr><td>7, Suspension</td><td>Repeated Tier 4/5 offenses within a season following a prior disqualification; serious conduct violations off-track</td></tr></table>'
  },
  { id: 'race-control', num: '6', title: 'Race Control Procedures', draft: true },
  { id: 'points-standings', num: '7', title: 'Points & Standings', draft: true },
  { id: 'career-economy', num: '8', title: 'Career Economy', draft: true, draftNote: 'Design pending, separate conversation.' },
  {
    id: 'reputation', num: '9', title: 'Reputation',
    html: '<p>Reputation is a single blended score, on a 0–1000 scale, that follows a driver across their entire Race Club career — it is never reset between seasons. Every new driver starts at 300 (“unproven,” not zero), and it only moves from specific events: wins, podiums, points finishes, clean races, and fastest laps raise it; penalty-tier incidents and other misconduct lower it. It never decays just from the passage of time.</p>' +
      '<p>Reputation is what stands between a driver and the higher classes. Bronze (GT3/LMP3) has no reputation requirement — money is the only gate. Silver (LMP2) requires a Reputation of at least 400 to hold that seat, and Gold (Hypercar) requires at least 500. These are floors a driver has to keep clearing, not a one-time check passed at signup — see Section 10, Class Progression, for what happens if it slips below the floor.</p>' +
      '<div class="rc-rulebook-callout"><strong>Reputation basics:</strong><ul>' +
      '<li>Single blended score, 0–1000 scale, career-long (never reset each season)</li>' +
      '<li>New drivers start at 300</li>' +
      '<li>Moves only from specific on-track results and conduct — never decays from time alone</li>' +
      '<li>Reputation floor to hold a seat: Bronze none, Silver (LMP2) 400+, Gold (Hypercar) 500+</li>' +
      '</ul></div>'
  },
  {
    id: 'class-progression', num: '10', title: 'Class Progression',
    html: '<p>Every driver chooses their own class, every season. The admin has no part in a normal class choice — the only requirement is clearing that class’s gate: enough money for the seat, and enough Reputation to clear that class’s floor (see Section 9). Bronze (GT3/LMP3) has no Reputation floor at all, so it’s always available. Whatever class a driver’s current Reputation qualifies them for, they’re free to pick it, with no approval and no waiting.</p>' +
      '<p>This works the same way going into every season, including one right after a driver’s Reputation has changed:</p>' +
      '<ul><li><strong>Reputation dropped below a class’s floor?</strong> The driver simply picks again next season from whichever classes they still qualify for. Nobody assigns them a class — it’s their choice from whatever they still clear.</li>' +
      '<li><strong>Reputation rose enough to newly clear a higher floor?</strong> The driver is free to move up the same way — again, their own choice, not an admin decision.</li></ul>' +
      '<h4>Class Placement Request — the one situation where an admin gets involved</h4>' +
      '<p>There’s exactly one case where an admin is part of a driver’s class choice: a <strong>Class Placement Request</strong>, submitted by a driver who wants to race in a class they don’t currently qualify for by Reputation. This exists for drivers who are genuinely safe, competent racers — often with real experience from another league — whose Race Club Reputation score just hasn’t caught up yet.</p>' +
      '<ul><li><strong>An existing driver</strong> submits a Class Placement Request from their Career section, between seasons. It shows up in the admin’s Pending Approvals list, the same place Prospect account approvals already appear, and the admin approves or denies it.</li>' +
      '<li><strong>A brand-new driver</strong> does this at signup, simply by picking a Preferred Class above Bronze on the registration form. There’s no separate approval step for this — it’s decided as part of the same Prospect → Driver approval every new signup already goes through. The admin can approve the driver straight into their requested class, or start them in a lower class instead, until they’ve proven themselves.</li>' +
      '<li><strong>If approved,</strong> the driver’s Reputation is set to exactly that class’s floor (400 for Silver, 500 for Gold) — the same starting point as anyone else holding that seat, no head start and no shortfall.</li>' +
      '<li><strong>If denied,</strong> the admin picks a reason from a fixed list, so a denied driver always gets a clear, specific answer instead of a vague no:' +
      '<ul><li>Not Enough Proven Reputation</li><li>Unknown / Unverified Skill Level</li><li>Not Enough Race History in Race Club Yet</li>' +
      '<li>Recent Conduct or Discipline Concerns</li><li>No Seat Available in That Class Right Now</li><li>Other (a short written note from the admin)</li></ul></li></ul>' +
      '<p>A Class Placement Request only decides what a driver starts the season in — it doesn’t skip the season-end Reputation check in Section 9. If a driver’s Reputation is still below the floor when that season ends, they go back to choosing from whatever classes they actually qualify for, the same as anyone else.</p>' +
      '<div class="rc-rulebook-callout"><strong>Class progression:</strong><ul>' +
      '<li>Every driver picks their own class each season, as long as they clear that class’s money + Reputation gate — no admin approval needed</li>' +
      '<li>Reputation drops below the floor by season’s end → driver picks again from whatever they still qualify for, next season</li>' +
      '<li>Reputation rises to clear a higher floor → driver is free to move up, next season</li>' +
      '<li><strong>Class Placement Request:</strong> the one exception, for a class a driver doesn’t yet qualify for by Reputation — always needs admin approval</li>' +
      '<li>Existing drivers submit it from their Career section between seasons (appears in Admin Pending Approvals); new drivers submit it as their Preferred Class at signup, decided during Prospect → Driver approval</li>' +
      '<li>Approved → Reputation is set to exactly that class’s floor (400 Silver / 500 Gold)</li>' +
      '<li>Denied → admin states a specific reason from a fixed list</li></ul></div>'
  },
  { id: 'wagering', num: '11', title: 'Wagering, "Battles to Watch"', draft: true },
  { id: 'car-class-selection', num: '12', title: 'Car & Class Selection', draft: true, draftNote: 'Naming pending confirmation.' },
  { id: 'conduct-discipline', num: '13', title: 'Conduct & Discipline (Off-Track)', draft: true },
  { id: 'appeals', num: '14', title: 'Appeals', draft: true },
  { id: 'glossary', num: '15', title: 'Glossary', draft: true }
];
