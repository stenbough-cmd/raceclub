// Race Club -- Championship Help content (js/championship-help.js)
// The HELP popup on championship.html (js/championship.js, rccOpenHelp) reads RCC_HELP_SECTIONS:
// one entry per section, rendered with the rulebook's own look (.rc-rulebook-nav / .rc-rulebook-
// section in css/style.css) plus the numbered step circles in css/championship.css (.rcc-help-steps).
// The html strings are hand-written here, never built from user input, so innerHTML is safe.
// No em dashes in this text (site rule). Apostrophes are typographic (’) so the strings need no
// escaping.
var RCC_HELP_SECTIONS = [
  {
    id: 'what-it-is', num: '1', title: 'What Race Club Championship Is',
    html:
      '<p>Le Mans Ultimate lets you run a single race weekend against the AI, but it has no way to string those weekends together into a season. Race Club Championship is the missing piece: an offline championship you build here and race in the game, one round at a time, at your own pace.</p>' +
      '<p>You pick the classes, the calendar, the race lengths and the points. You sign for a real team and car, and your rivals are the real drivers listed on every other car on the grid. After each round you upload the two results files the game writes (Qualifying and Race), and this page does the rest: class standings for drivers and teams, the manufacturers’ standings for factory Hypercars, bonus points, a race recap with a lap-by-lap report, your own lap times, and the Highlights ticker.</p>' +
      '<div class="rc-rulebook-callout"><strong>In short:</strong><ul>' +
      '<li>A full season against the AI, scored the same way as the Race Club league</li>' +
      '<li>No dates and no deadlines: race the rounds in order, whenever you like</li>' +
      '<li>Everything is worked out from the game’s own results files, so nothing is typed in by hand</li>' +
      '<li>One season at a time; finished seasons stay on this page as a record</li>' +
      '</ul></div>'
  },
  {
    id: 'create-season', num: '2', title: 'Creating a Season',
    html:
      '<p>Click <strong>Create Season</strong> in the black bar. The popup has five parts:</p>' +
      '<ol class="rcc-help-steps">' +
      '<li><strong>Season.</strong> Give the season a name. It shows in the header and the ticker.</li>' +
      '<li><strong>Classes.</strong> Tick every class you want on the grid and pick the year for each one (for example LMGTE 2023 or LMGT3 2026). Every car from that class and year joins the grid, and the count next to each class tells you how many.</li>' +
      '<li><strong>Race Settings.</strong> AI Difficulty, AI Aggression, Mechanical Failures, Flag Rules, Start, fuel and tyre use, track limits, tyre allowance and the Practice and Qualify lengths. These are the settings you will copy into the game before every round, so they are saved with the season.</li>' +
      '<li><strong>Points.</strong> Set how long a Sprint, Medium and Long race is (in minutes) and the points for P1 to P10 in each. Choose 0 to 5 bonus points for Pole Position, Fastest Lap and Most Laps Led. Points are scored per class.</li>' +
      '<li><strong>Rounds.</strong> Add your rounds in order. Each round has a track and layout, a race length (Sprint, Medium or Long), weather, chance of rain, temperature and the in-game start time. Leave the event name blank to use the season name.</li>' +
      '</ol>' +
      '<p>Click <strong>Create Season</strong> at the bottom. Then click <strong>Choose Your Team</strong> in the black bar, pick a class and a car, and click <strong>Join This Team</strong>. That is the car you drive all season.</p>' +
      '<div class="rc-rulebook-callout"><strong>Good to know:</strong><ul>' +
      '<li>Edit Season can change rounds that have not been raced yet. Once you join a team the classes lock, and once a round has results the points lock.</li>' +
      '<li>Your team choice is final for the season.</li>' +
      '</ul></div>'
  },
  {
    id: 'set-up-race', num: '3', title: 'Setting Up the Race in Le Mans Ultimate',
    html:
      '<p>Each round is one Race Weekend in the game. Open the round’s card on the calendar here so its details are in front of you, then in Le Mans Ultimate:</p>' +
      '<ol class="rcc-help-steps">' +
      '<li><strong>Start a Race Weekend.</strong> From the main menu, open the single player Race Weekend.</li>' +
      '<li><strong>Pick the season year.</strong> Choose the same year you picked for your classes in the season.</li>' +
      '<li><strong>Pick the track and layout</strong> shown on the round’s card.</li>' +
      '<li><strong>Pick your car:</strong> the class, manufacturer and the exact team and number you joined.</li>' +
      '<li><strong>Pick the classes</strong> that are in your season. <strong>Do not use Fill Grid.</strong> It swaps in cars that are not on your season’s grid, and the upload will refuse a file with cars it does not know.</li>' +
      '<li><strong>Sessions.</strong> Turn Qualifying and Race on (Practice is optional and is not uploaded). Set Qualifying to your season’s Qualify length and the Race to the round’s length in minutes. Set the race by time, not laps.</li>' +
      '<li><strong>Weather and time.</strong> Set the start time, sky, chance of rain and temperature from the round’s card.</li>' +
      '<li><strong>Difficulty and rules.</strong> Copy your season’s Race Settings: Opponent Difficulty (AI Difficulty), AI Aggression, Mechanical Failures, Flag Rules, track limits, fuel usage, tyre wear and tyre allowance.</li>' +
      '<li><strong>Race the weekend.</strong> Run Qualifying, then the Race, in the same weekend. Drive the race to the chequered flag and let the session finish so the game saves the results.</li>' +
      '</ol>' +
      '<div class="rc-rulebook-callout"><strong>So your upload goes through first time:</strong><ul>' +
      '<li>Same track and layout as the round, or the upload is refused</li>' +
      '<li>Your own car (the team and number you joined)</li>' +
      '<li>Only cars from your season’s classes and years, so no Fill Grid</li>' +
      '<li>Qualifying and Race from the same weekend</li>' +
      '<li>Your in-game driver name should match your Race Club name</li>' +
      '</ul></div>' +
      '<p>If the race runs a different length than planned, that is fine: the upload uses the length you actually raced (see Uploading Your Results).</p>'
  },
  {
    id: 'find-files', num: '4', title: 'Finding Your Results Files',
    html:
      '<p>The game saves one XML file per session in its Results folder. The quickest way there:</p>' +
      '<ol class="rcc-help-steps">' +
      '<li><strong>Open Steam</strong> and go to your Library.</li>' +
      '<li><strong>Right-click Le Mans Ultimate</strong>, then choose Manage, then Browse local files.</li>' +
      '<li><strong>Open UserData</strong>, then <strong>Log</strong>, then <strong>Results</strong>.</li>' +
      '</ol>' +
      '<p>On a standard Steam install that folder is:</p>' +
      '<p class="rcc-help-path">C:\\Program Files (x86)\\Steam\\steamapps\\common\\Le Mans Ultimate\\UserData\\Log\\Results</p>' +
      '<p>Each file is named with the date and time the session ended, followed by the session:</p>' +
      '<table class="rcc-help-table"><tbody>' +
      '<tr><td><strong>…Q1.xml</strong></td><td>Qualifying. This is file 1.</td></tr>' +
      '<tr><td><strong>…R1.xml</strong></td><td>Race. This is file 2.</td></tr>' +
      '<tr><td><strong>…P1.xml</strong></td><td>Practice. Not uploaded.</td></tr>' +
      '</tbody></table>' +
      '<div class="rc-rulebook-callout"><strong>Tip:</strong> sort the folder by date. The newest R1 file is your race, and the Q1 file just before it is the qualifying from the same weekend.</div>'
  },
  {
    id: 'upload', num: '5', title: 'Uploading Your Results',
    html:
      '<ol class="rcc-help-steps">' +
      '<li><strong>Click Upload Results</strong> in the black bar (or UPLOAD RESULTS on the round’s calendar card).</li>' +
      '<li><strong>Pick the round</strong> from the dropdown. Only rounds without results are listed.</li>' +
      '<li><strong>File 1:</strong> choose the Qualifying file (…Q1.xml).</li>' +
      '<li><strong>File 2:</strong> choose the Race file (…R1.xml).</li>' +
      '<li><strong>Click Upload Results</strong> and wait. It can take a minute. When it is done the page reloads with the new standings, the race recap and the ticker.</li>' +
      '</ol>' +
      '<p>Both files are checked before anything is saved: they must be a Qualifying and a Race file, from the same weekend, at the round’s track, with your car and only cars from your grid. If something is off, a message in the lower right says what, and nothing is kept, so fix it and upload again.</p>' +
      '<div class="rc-rulebook-callout"><strong>Race length:</strong> the length you actually raced decides which points table the round uses, rounded down to the nearest length. Shorter than a Sprint, or between a Sprint and a Medium, scores as a Sprint; between a Medium and a Long scores as a Medium; a Long or longer scores as a Long. The calendar card shows the length you raced.</div>' +
      '<p>Uploaded the wrong files? Click <strong>Erase Results</strong> in the black bar, pick the round, and upload again. The round stays on the calendar.</p>'
  },
  {
    id: 'end-season', num: '6', title: 'Ending a Season',
    html:
      '<ol class="rcc-help-steps">' +
      '<li><strong>Upload every round.</strong> The season can only end once every round on the calendar has its results.</li>' +
      '<li><strong>Click End Season</strong> in the black bar and confirm.</li>' +
      '<li><strong>That’s the season done.</strong> The standings become final, the panels switch to Final Standings, and the season can no longer be edited.</li>' +
      '<li><strong>Start the next one</strong> with Create Season. Past seasons stay available from the Season dropdown in the black bar.</li>' +
      '</ol>' +
      '<div class="rc-rulebook-callout"><strong>Delete Season</strong> removes the season you are looking at, with its rounds, your team signing and every result and lap. It cannot be undone, so it asks you to type DELETE SEASON first.</div>'
  }
];
