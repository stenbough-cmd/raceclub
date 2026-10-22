// Race Club -- Championship Help content (js/championship-help.js)
// The HELP popup on championship.html (js/championship.js, rccOpenHelp) reads RCC_HELP_SECTIONS:
// one entry per section, rendered with the rulebook's own look (.rc-rulebook-nav / .rc-rulebook-
// section in css/style.css) plus the numbered step circles in css/championship.css (.rcc-help-steps).
// The html strings are hand-written here, never built from user input, so innerHTML is safe.
// Writing rules for this text (Matt): plain, correct English in full sentences. No em dashes, and no
// colon followed by a lowercase clause. Callout titles are their own line (.rcc-help-callout-title)
// rather than "Label:". Apostrophes are typographic (’) so the strings need no escaping.
// Quick start (Matt, 2026-10-13): three steps shown above Jump To A Section.
var RCC_HELP_QUICKSTART =
  '<div class="rcc-quick-title">Using Race Club Championship Is as Easy as 1-2-3</div>' +
  '<ol class="rcc-quick-steps">' +
  '<li><span class="rcc-quick-num">1</span><strong>Create a Season</strong><span>Create a season here on the website and choose the car you will drive all season.</span></li>' +
  '<li><span class="rcc-quick-num">2</span><strong>Race It</strong><span>Complete a race in Le Mans Ultimate in the car you chose, at the track your calendar shows for the round.</span></li>' +
  '<li><span class="rcc-quick-num">3</span><strong>Upload Your Results</strong><span>Upload the .xml results file from the folder where Le Mans Ultimate is installed.</span></li>' +
  '</ol>' +
  '<div class="rcc-quick-done">That\u2019s it!</div>';

var RCC_HELP_SECTIONS = [
  {
    id: 'what-it-is', num: '1', title: 'What Race Club Championship Is',
    html:
      '<p>Le Mans Ultimate lets you race a single weekend against the AI, but it has no way to link those weekends into a season. Race Club Championship fills that gap. You build an offline championship here, race each round in the game, and play through the season one round at a time, at your own pace.</p>' +
      '<p>You choose the series, the year, the classes, the calendar, the race lengths and the points. You sign for a real team and car, and your rivals are the drivers the game puts in every other car on the grid. After each round, you upload the results files the game creates (Qualifying and Race, or just the Race when your season has no qualifying), and this page takes care of the rest. It keeps the class standings for drivers and teams, the manufacturers’ standings for factory Hypercars and the bonus points. Every round also gets a race recap with a lap-by-lap report and the race’s settings, a Driver Report that turns your race into charts, a breakdown of your own laps, and a place in the Highlights ticker.</p>' +
      '<div class="rc-rulebook-callout"><strong class="rcc-help-callout-title">In Short</strong><ul>' +
      '<li>A full season against the AI, scored the same way as the Race Club league</li>' +
      '<li>WEC and ELMS cars and tracks, as they appear in the game</li>' +
      '<li>No dates and no deadlines, so you can race each round whenever you like</li>' +
      '<li>Results come straight from the game’s own files, so nothing is typed in by hand</li>' +
      '<li>One season at a time, with finished seasons kept on this page as a record</li>' +
      '</ul></div>'
  },
  {
    id: 'create-season', num: '2', title: 'Creating a Season',
    html:
      '<p>Open <strong>Season Tools</strong> in the black bar and choose <strong>Create Season</strong>. The popup is laid out in six parts.</p>' +
      '<ol class="rcc-help-steps">' +
      '<li><strong>Season.</strong> Give the season a name, then pick the series (WEC or ELMS) and the year. Together they decide which cars you race against, and they should match the series and year you choose in the game. Only years with cars available are listed.</li>' +
      '<li><strong>Classes.</strong> Tick the classes you want to race. Classes with no cars in that series and year are grayed out, and the number next to each class shows how many cars it adds to the grid.</li>' +
      '<li><strong>Difficulty.</strong> Set the AI difficulty, damage simulation, tire wear, tire warmers, available tires and fuel usage. These match the Difficulty tab in the game.</li>' +
      '<li><strong>Advanced.</strong> Set the time scale, flag rules, track limits rules, mechanical failures, AI aggression and track limits points. These match the Advanced tab in the game.</li>' +
      '<li><strong>Points.</strong> Pick the length of a Sprint, Medium and Long race, from 15m up to 24h, and the points for P1 to P10 in each. You can also award 0 to 5 bonus points for Pole Position, Fastest Lap and Most Laps Led. Points are scored within each class.</li>' +
      '<li><strong>Sessions.</strong> First choose the settings every round shares, which are the start type (Rolling or Fast), the RealRoad time scale and whether there is a qualifying session. If you choose <strong>No (Random start)</strong>, the game sets a random grid, you only upload the Race file, and there is no pole bonus. Then add your rounds in the order you want to race them. Each round has a track, a layout, a race length, a weather preset (Sunny, Cloudy, Rainy or Real World) and an in-game race start (Morning, Midday, Afternoon, Evening or Night). If you leave the event name blank, the round uses the season name.</li>' +
      '</ol>' +
      '<p>Click <strong>Create Season</strong> at the bottom of the popup. Next, click <strong>Choose Your Team</strong> in the Season Preview section of the page, pick a class and a car, and click <strong>Join This Team</strong>. That car is your seat for the whole season.</p>' +
      '<div class="rc-rulebook-callout"><strong class="rcc-help-callout-title">Good to Know</strong><ul>' +
      '<li><strong>Season Preview</strong> in the black bar shows every setting and round in the season on screen, so you can check them before you set up a race. Create Season stays in Season Tools, ready for when this season ends.</li>' +
      '<li>Edit Season can change almost anything at any time, including the name, the Difficulty and Advanced settings, the start type, the RealRoad time scale and any round that has not been raced yet. The series, year, classes, points and bonuses are fixed once the season is created. The qualifying setting is fixed once a round has results.</li>' +
      '<li>Rounds with results are locked and keep their round number. You can add, remove and reorder the rounds after them, but no round can be moved or added in front of them.</li>' +
      '<li>Your choice of team is final for the season, so you cannot change cars partway through.</li>' +
      '</ul></div>'
  },
  {
    id: 'set-up-race', num: '3', title: 'Setting Up the Race in Le Mans Ultimate',
    html:
      '<p>Each round is one Race Weekend in the game. Before you start, open <strong>Season Preview</strong> here so your season’s settings and the round’s details are in front of you. Then follow these steps in Le Mans Ultimate.</p>' +
      '<ol class="rcc-help-steps">' +
      '<li><strong>Open Race Weekend.</strong> Click Race Weekend on the main menu.</li>' +
      '<li><strong>Choose the series and year.</strong> Race Club includes both WEC and ELMS. Pick the series and year your season uses.</li>' +
      '<li><strong>Choose the track.</strong> Pick the round’s track and layout. If the track is not on that year’s calendar, switch the filter to <strong>All</strong> to see every track in the game.</li>' +
      '<li><strong>Choose your class and car.</strong> Pick the class, car and team you signed for. This is your seat for the whole season.</li>' +
      '<li><strong>Set the starting grid.</strong> You will now see the Event Settings page, which summarizes the last settings used or the defaults. Under <strong>Starting Grid</strong>, choose your season of cars, such as <strong>Season 2023</strong>. Do not choose Fill Grid. It adds cars that did not race that season, and Race Club Championship will not import results that include cars from outside your grid. For the same reason, only race the classes your season includes.</li>' +
      '<li><strong>Open the advanced options.</strong> From Event Settings, open the advanced options. You will see four tabs near the top named Difficulty, Sessions, Weather and Advanced.</li>' +
      '<li><strong>Difficulty.</strong> Copy your season’s Difficulty settings, which are the AI difficulty, damage simulation, tire wear, tire warmers, available tires and fuel usage. You can also set any assists you like. Race Club has no rules about assists, but the ones you use appear in the race recap.</li>' +
      '<li><strong>Sessions.</strong> Practice is optional, and practice files cannot be imported. If your season has a qualifying session, run Qualifying and then the Race. If it does not, turn qualifying off so the race starts from a random grid. For the Race, the settings that matter most are the <strong>race length</strong>, the <strong>start time</strong>, the <strong>start type</strong> and the <strong>RealRoad time scale</strong>. Set the race length to the round’s length or longer. A shorter race cannot be uploaded.</li>' +
      '<li><strong>Weather.</strong> Choose the round’s preset for each session (Sunny, Cloudy, Rainy or Real World). You can also set the weather by hand, since each session is split into five parts that you can change one at a time.</li>' +
      '<li><strong>Advanced.</strong> Copy your season’s Advanced settings, which are the time scale, flag rules, track limits rules, mechanical failures, AI aggression and track limits points.</li>' +
      '<li><strong>Check and start.</strong> Go back to Event Settings at the top and make sure everything matches your season and the round. Then click <strong>Start Race Weekend</strong>. Run Qualifying if your season has it, and drive the Race to the checkered flag so the game saves the results.</li>' +
      '</ol>' +
      '<div class="rc-rulebook-callout"><strong class="rcc-help-callout-title">Five Settings Decide Whether Your Results Upload</strong><ul>' +
      '<li>The correct series and year</li>' +
      '<li>The correct track and layout</li>' +
      '<li>The correct class, car and team, which is the seat you signed for</li>' +
      '<li>Your season of cars under Starting Grid (Season YYYY), never Fill Grid, and only your season’s classes</li>' +
      '<li>A race length that is the same as the round’s length or longer</li>' +
      '</ul>The other settings, such as weather, start time, time scales and AI settings, will not stop an upload. Matching them as closely as you can keeps your season’s records accurate.</div>' +
      '<div class="rc-rulebook-callout"><strong class="rcc-help-callout-title">Use the Base Setup</strong>The AI drives every car on the game\u2019s base setup. For the fairest competition, use the base setup too, in qualifying and in the race. A tuned setup, such as one you bought or downloaded, can make your car faster than the AI was built to race against.</div>' +
      '<div class="rc-rulebook-callout"><strong class="rcc-help-callout-title">DLC</strong>Some tracks and cars in Le Mans Ultimate require DLC. Race Club Championship includes everything in the game and cannot tell which DLC you own, so only choose tracks and teams you are able to race.</div>'
  },
  {
    id: 'find-files', num: '4', title: 'Finding Your Results Files',
    html:
      '<p>The game saves an XML file for every session in its Results folder. This is the quickest way to find it.</p>' +
      '<ol class="rcc-help-steps">' +
      '<li><strong>Open Steam</strong> and go to your Library.</li>' +
      '<li><strong>Right-click Le Mans Ultimate</strong>, then choose Manage and Browse local files.</li>' +
      '<li><strong>Open the UserData folder</strong>, then <strong>Log</strong>, then <strong>Results</strong>.</li>' +
      '</ol>' +
      '<p>On a standard Steam installation, the folder is located here.</p>' +
      '<p class="rcc-help-path">C:\\Program Files (x86)\\Steam\\steamapps\\common\\Le Mans Ultimate\\UserData\\Log\\Results</p>' +
      '<p>Each file is named with the date and time its session ended, and the ending tells you which session it is.</p>' +
      '<table class="rcc-help-table"><tbody>' +
      '<tr><td><strong>…Q1.xml</strong></td><td>Qualifying, which is file 1</td></tr>' +
      '<tr><td><strong>…R1.xml</strong></td><td>Race, which is file 2</td></tr>' +
      '<tr><td><strong>…P1.xml</strong></td><td>Practice, which is not uploaded</td></tr>' +
      '</tbody></table>' +
      '<div class="rc-rulebook-callout"><strong class="rcc-help-callout-title">Tip</strong>Sort the folder by date. The newest R1 file is your race, and the Q1 file just before it is the qualifying session from the same weekend.</div>'
  },
  {
    id: 'upload', num: '5', title: 'Uploading Your Results',
    html:
      '<ol class="rcc-help-steps">' +
      '<li><strong>Click Upload Results</strong> in the black bar, or UPLOAD RESULTS on the calendar card of the next round.</li>' +
      '<li><strong>Check the round.</strong> Rounds are uploaded in calendar order, so the popup always shows the next round without results. A later round cannot be uploaded until every round before it has results.</li>' +
      '<li><strong>For file 1</strong>, choose the Qualifying file (…Q1.xml). Seasons without a qualifying session skip this step.</li>' +
      '<li><strong>For file 2</strong>, choose the Race file (…R1.xml).</li>' +
      '<li><strong>Click Upload Results</strong> and wait. It can take up to a minute. When it finishes, the page reloads with the new standings, the race recap and the ticker.</li>' +
      '</ol>' +
      '<p>The files are checked before anything is saved. They must be a Qualifying file and a Race file from the same weekend (or just the Race file when your season has no qualifying), raced at the round’s track and at least as long as the round, with you in your own car and only cars from your season’s grid. Cars in the files that are missing from your grid are added for you. If more than 6 of them are cars Race Club does not know yet, the upload stops. Whenever something is wrong, a message in the lower right explains it and nothing is saved, so you can fix the problem and upload again. The one exception is the track name: when the name in the files looks different from the round’s track, you are asked whether to upload anyway. Choose Upload Anyway only when it is the same track under a slightly different name in the game; otherwise choose Cancel and pick the right files.</p>' +
      '<div class="rc-rulebook-callout"><strong class="rcc-help-callout-title">Race Length</strong>The race in the game has to be the same length as the round on your calendar, or longer. If it is shorter, the upload is refused and nothing is saved. For example, a Sprint round of 40 minutes accepts a race of 40 minutes or more, but not a race of 30 minutes. A longer race is accepted and still scores the round’s own points table, so a 60 minute race on a 40 minute Sprint round scores Sprint points. If you have to race a shorter length, use Edit Season to change the round’s race length before you upload.</div>' +
      '<p>If you upload the wrong files, click <strong>Erase Results</strong> in the black bar and upload again. Only your latest round with results can be erased. The round stays on the calendar.</p>'
  },
  {
    id: 'recap', num: '6', title: 'Race Recap, Driver Report and Standings',
    html:
      '<p>Every round with results has its own recap. Open it with <strong>RACE RECAP</strong> on the round’s calendar card. <strong>DRIVER REPORT</strong>, next to RACE RECAP on the calendar card, opens the same recap already showing your Driver Report. Inside the recap, the dropdown next to the round switches between five pages.</p>' +
      '<table class="rcc-help-table"><tbody>' +
      '<tr><td><strong>Race</strong></td><td>The results for every class, the bonus winners and the lap-by-lap Race Report.</td></tr>' +
      '<tr><td><strong>Qualifying</strong></td><td>The qualifying order, when your season has a qualifying session.</td></tr>' +
      '<tr><td><strong>Driver Report</strong></td><td>Your race in charts, explained below.</td></tr>' +
      '<tr><td><strong>Race Details</strong></td><td>The settings read from the race file, such as length, laps, damage, fuel and tire use and your assists, next to what was planned for the round.</td></tr>' +
      '<tr><td><strong>My Laps</strong></td><td>Every lap you drove, with sectors, top speed, fuel and tire wear.</td></tr>' +
      '</tbody></table>' +
      '<p>The <strong>Driver Report</strong> covers your race at a glance (start to finish, best lap, pit stops and contacts), your class position on every lap, a tire report with a top-down view of your car and the tread left on each corner, a fuel report, your pit strategy against everyone else’s, your pace and sector times, every contact and track limits warning, and your qualifying laps. The <strong>Whole Class</strong> and <strong>Nearest Rivals</strong> switch at the top compares you with the average of your class, or with the two cars that finished just ahead of you and the two just behind. Hover over any chart to see the exact numbers.</p>' +
      '<div class="rc-rulebook-callout"><strong class="rcc-help-callout-title">Good to Know</strong><ul>' +
      '<li>The game’s results file has no damage figures, so the Driver Report shows how hard each contact was instead.</li>' +
      '<li>A round uploaded before the Driver Report existed shows only your own numbers. Erase that round and upload the same files again to compare yourself with the field.</li>' +
      '<li>The standings stay empty until the first round has results. Each round’s points go to the driver the race file shows in that car, so a car that changes drivers between tracks credits each driver only for the rounds they raced.</li>' +
      '</ul></div>'
  },
  {
    id: 'stories', num: '7', title: 'Season Stories',
    html:
      '<p>Your season gets its own news coverage. Season Stories, next to Last Race on this page, are written for you by AI from the facts of your season: the results of every class, the standings after each round, lap-by-lap battles, pit stops, contacts, penalties and the weather. Each story reads like a motorsport news article, with a headline, a short summary and a sidebar of key facts.</p>' +
      '<table class="rcc-help-table"><tbody>' +
      '<tr><td><strong>Season Preview</strong></td><td>Written as soon as you sign for a team. It sets the scene for the season ahead: the calendar, the classes, the grid and your team.</td></tr>' +
      '<tr><td><strong>Race Story</strong></td><td>Written after you upload a round\u2019s results. It covers the whole race, with the points as they stood after that round.</td></tr>' +
      '<tr><td><strong>Season Finale</strong></td><td>The story for the last round, which also looks back on the season and its champions.</td></tr>' +
      '</tbody></table>' +
      '<p>The newest story shows first. Click <strong>CONTINUE READING</strong> to open the full story, and use <strong>MORE STORIES</strong> to read earlier ones. Each story is dated by the day its race was run.</p>' +
      '<ol class="rcc-help-steps">' +
      '<li><strong>Wait a minute or two.</strong> A new story is written in the background and the panel shows that it is being written. You can keep using the page while you wait.</li>' +
      '<li><strong>Leave whenever you like.</strong> If you close the page before a story is finished, it is written the next time you open your season.</li>' +
      '<li><strong>Rate it.</strong> Use the thumbs up or thumbs down under a story. A thumbs down asks what you didn\u2019t like. Your ratings and comments shape the stories written for you from then on, and they are shared with the Race Club team.</li>' +
      '</ol>' +
      '<div class="rc-rulebook-callout"><strong class="rcc-help-callout-title">Good to Know</strong><ul>' +
      '<li>A story is written once. Editing your season later does not rewrite stories that already exist, but the next story may mention a change to your calendar.</li>' +
      '<li>Erase Results removes that round\u2019s story too. Upload the files again and a new story is written. Delete Season removes all of that season\u2019s stories.</li>' +
      '<li>If a story could not be written, the panel says why and tries again the next time you open the page.</li>' +
      '<li>Stories are written by AI from your results, so the occasional detail may be off. The standings and results on this page are always the official record.</li>' +
      '</ul></div>'
  },
  {
    id: 'end-season', num: '8', title: 'Ending a Season',
    html:
      '<ol class="rcc-help-steps">' +
      '<li><strong>Upload every round.</strong> A season counts toward your career only when it ends after the last round’s results are uploaded.</li>' +
      '<li><strong>Click End Season</strong> in the black bar and confirm.</li>' +
      '<li><strong>The season is complete.</strong> The standings become final and the season can no longer be edited.</li>' +
      '<li><strong>Start the next one.</strong> Choose Create Season in Season Tools. Your past seasons stay available from the Season dropdown in the black bar.</li>' +
      '</ol>' +
      '<div class="rc-rulebook-callout"><strong class="rcc-help-callout-title">Changed Your Mind?</strong>If you are unhappy with a season, you have two choices. You can click End Season before every round is raced and type END SEASON to confirm, which saves it as an unfinished season. Its standings stay on this page, but an unfinished season never counts toward your career. Or you can click Delete Season, which removes the season you are viewing along with its rounds, your team signing and every result and lap. Deleting cannot be undone, so you will be asked to type DELETE SEASON first.</div>' +
      '<p>If you find something that doesn’t work, open the menu under your name at the top of the page (the menu button on a phone), choose <strong>Feedback</strong> and let us know.</p>'
  }
];
