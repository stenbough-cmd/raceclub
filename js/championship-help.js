// Race Club -- Championship Help content (js/championship-help.js)
// The HELP popup on championship.html (js/championship.js, rccOpenHelp) reads RCC_HELP_SECTIONS:
// one entry per section, rendered with the rulebook's own look (.rc-rulebook-nav / .rc-rulebook-
// section in css/style.css) plus the numbered step circles in css/championship.css (.rcc-help-steps).
// The html strings are hand-written here, never built from user input, so innerHTML is safe.
// No em dashes in this text (site rule). Apostrophes are typographic (’) so the strings need no
// escaping. The Le Mans Ultimate steps follow Matt's own walkthrough of the game (2026-10-09).
var RCC_HELP_SECTIONS = [
  {
    id: 'what-it-is', num: '1', title: 'What Race Club Championship Is',
    html:
      '<p>Le Mans Ultimate lets you run a single race weekend against the AI, but it has no way to string those weekends together into a season. Race Club Championship is the missing piece: an offline championship you build here and race in the game, one round at a time, at your own pace.</p>' +
      '<p>You pick the year, the classes, the calendar, the race lengths and the points. You sign for a real team and car, and your rivals are the real drivers listed on every other car on the grid. After each round you upload the two results files the game writes (Qualifying and Race), and this page does the rest: class standings for drivers and teams, the manufacturers’ standings for factory Hypercars, bonus points, a race recap with a lap-by-lap report and the race’s settings, your own lap times, and the Highlights ticker.</p>' +
      '<div class="rc-rulebook-callout"><strong>In short:</strong><ul>' +
      '<li>A full season against the AI, scored the same way as the Race Club league</li>' +
      '<li>WEC and ELMS cars and tracks, as they are in the game</li>' +
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
      '<li><strong>Classes.</strong> Pick the year first. That is the season of cars you will race against (the same year you will choose in the game). Then tick the classes you want. Classes with no cars in that year are grayed out, and the count next to each class shows how many cars join the grid.</li>' +
      '<li><strong>Race Settings.</strong> AI Difficulty, AI Aggression, Mechanical Failures, Flag Rules, Start, fuel and tyre use, Time Scale, RealRoad Time Scale, track limits, tyre allowance and the Qualify length. These are the settings you will copy into the game before every round.</li>' +
      '<li><strong>Points.</strong> Set how long a Sprint, Medium and Long race is (in minutes) and the points for P1 to P10 in each. Choose 0 to 5 bonus points for Pole Position, Fastest Lap and Most Laps Led. Points are scored per class.</li>' +
      '<li><strong>Rounds.</strong> Add your rounds in order. Each round has a track and layout, a race length (Sprint, Medium or Long), a weather preset (Sunny, Cloudy, Rainy or Real World) and the in-game start time.</li>' +
      '</ol>' +
      '<p>Click <strong>Create Season</strong> at the bottom. Then click <strong>Choose Your Team</strong> in the black bar, pick a class and a car, and click <strong>Join This Team</strong>. That is the seat you race in all season.</p>' +
      '<div class="rc-rulebook-callout"><strong>Good to know:</strong><ul>' +
      '<li>While the season runs, Create Season becomes <strong>Season Preview</strong>: it shows every setting and round of your season, so you can check them before you set up a race.</li>' +
      '<li>Edit Season can change rounds that have not been raced yet. Once you join a team the year and classes lock, and once a round has results the points lock.</li>' +
      '<li>Your team choice is final for the season.</li>' +
      '</ul></div>'
  },
  {
    id: 'set-up-race', num: '3', title: 'Setting Up the Race in Le Mans Ultimate',
    html:
      '<p>Each round is one Race Weekend in the game. Open <strong>Season Preview</strong> here so your season’s settings and the round’s details are in front of you, then in Le Mans Ultimate:</p>' +
      '<ol class="rcc-help-steps">' +
      '<li><strong>Click Race Weekend</strong> on the main menu.</li>' +
      '<li><strong>Choose the series and the year.</strong> WEC and ELMS are both represented in Race Club. Pick the year your season uses.</li>' +
      '<li><strong>Choose the track.</strong> Pick the round’s track and layout. If it is not on that year’s calendar, switch the filter to <strong>All</strong> to see every track in the game.</li>' +
      '<li><strong>Choose your class and car.</strong> Pick the class, the car and the team you signed for. This is your seat for the whole season.</li>' +
      '<li><strong>Set the Starting Grid.</strong> You are now on the Event Settings page, with a summary of the last settings used (or the defaults). Under <strong>Starting Grid</strong>, choose your season of cars (for example <strong>Season 2023</strong>). Do not choose Fill Grid: it adds cars that did not race that season, and Race Club Championship will not import results with cars that are not on your grid.</li>' +
      '<li><strong>Open the advanced options.</strong> From Event Settings, open the advanced options. Near the top are four tabs: Difficulty, Sessions, Weather and Advanced.</li>' +
      '<li><strong>Difficulty.</strong> Set the opponent difficulty from your season. Choose any assists you like: Race Club sets no rules for assists, but the ones you use show in the race recap.</li>' +
      '<li><strong>Sessions.</strong> Practice is optional. Always run a Qualifying and a Race, so the round has a grid and a result (practice files cannot be imported). Set Qualifying and the Race to match your season. The settings that really matter here are the <strong>race length</strong>, the <strong>start time</strong> and the <strong>RealRoad Time Scale</strong>.</li>' +
      '<li><strong>Weather.</strong> Pick the round’s preset for each session (Sunny, Cloudy, Rainy or Real World), or set it by hand: each session is split into five parts you can change.</li>' +
      '<li><strong>Advanced.</strong> Set the rest of your season’s settings here, such as Time Scale, Flag Rules, Mechanical Failures and AI Aggression.</li>' +
      '<li><strong>Check and start.</strong> Go back to Event Settings at the top, look over the page to make sure it matches your season and the round, then click <strong>Start Race Weekend</strong>. Run Qualifying, then drive the Race to the chequered flag so the game saves the results.</li>' +
      '</ol>' +
      '<div class="rc-rulebook-callout"><strong>These five decide whether your results upload:</strong><ul>' +
      '<li>The right series and year</li>' +
      '<li>The right track and layout</li>' +
      '<li>The right class, car and team (the seat you signed for)</li>' +
      '<li>Your season of cars under Starting Grid (Season YYYY), never Fill Grid</li>' +
      '<li>The right race length</li>' +
      '</ul>Everything else (weather, start time, time scales, AI settings) does not stop an upload, but the closer it matches your season, the truer your season’s story will be.</div>' +
      '<div class="rc-rulebook-callout"><strong>DLC:</strong> some tracks and cars need DLC in Le Mans Ultimate. Race Club Championship lists everything in the game and does not know which DLC you own, so only pick tracks and teams you can race.</div>'
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
      '<p>Both files are checked before anything is saved: they must be a Qualifying and a Race file, from the same weekend, at the round’s track, with your car, and with only cars from your season’s grid. If a car in the file is not on your grid, the upload stops and names that car. Whenever something is off, a message in the lower right says what, and nothing is kept, so fix it and upload again.</p>' +
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
      '<li><strong>Start the next one.</strong> Season Preview turns back into Create Season. Past seasons stay available from the Season dropdown in the black bar.</li>' +
      '</ol>' +
      '<div class="rc-rulebook-callout"><strong>Delete Season</strong> removes the season you are looking at, with its rounds, your team signing and every result and lap. It cannot be undone, so it asks you to type DELETE SEASON first.</div>' +
      '<p>Found something that doesn’t work? Click <strong>Find A Bug?</strong> in the black bar to tell us.</p>'
  }
];
