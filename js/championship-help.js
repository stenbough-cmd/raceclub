// Race Club -- Championship Help content (js/championship-help.js)
// The HELP popup on championship.html (js/championship.js, rccOpenHelp) reads RCC_HELP_SECTIONS:
// one entry per section, rendered with the rulebook's own look (.rc-rulebook-nav / .rc-rulebook-
// section in css/style.css) plus the numbered step circles in css/championship.css (.rcc-help-steps).
// The html strings are hand-written here, never built from user input, so innerHTML is safe.
// Writing rules for this text (Matt): plain, correct English in full sentences. No em dashes, and no
// colon followed by a lowercase clause. Callout titles are their own line (.rcc-help-callout-title)
// rather than "Label:". Apostrophes are typographic (’) so the strings need no escaping.
// Quick start (Matt, 2026-10-13; simplified 2026-11-06): three steps shown above Jump To A Section.
var RCC_HELP_QUICKSTART =
  '<div class="rcc-quick-title">How the Single Player Championship Works</div>' +
  '<ol class="rcc-quick-steps">' +
  '<li><span class="rcc-quick-num">1</span><strong>Set Up Your Season</strong><span>Once per season, create it and choose your team and car on your Dashboard.</span></li>' +
  '<li><span class="rcc-quick-num">2</span><strong>Race a Round</strong><span>Match the round\u2019s settings in Le Mans Ultimate, then drive the race.</span></li>' +
  '<li><span class="rcc-quick-num">3</span><strong>Upload Your Results</strong><span>Upload the results file from the game. This page does the rest.</span></li>' +
  '</ol>' +
  '<div class="rcc-quick-done">Repeat steps 2 and 3 for every round.</div>';

var RCC_HELP_SECTIONS = [
  {
    id: 'what-it-is', num: '1', title: 'What It Is',
    html:
      '<p>Le Mans Ultimate has no way to link single races into a season. The Single Player Championship does that. You build a season here, race each round in the game against the AI, and upload the results. There are no dates or deadlines, so you race at your own pace.</p>' +
      '<p>This page keeps the standings for drivers, teams and manufacturers. Every round also gets a race recap, a Driver Report with charts of your race, and a news story. Finished seasons stay here as a record.</p>'
  },
  {
    id: 'create-season', num: '2', title: 'Set Up Your Season',
    html:
      '<p>Open your <strong>Dashboard</strong>, go to the <strong>Single Player Championship</strong> section and press <strong>Create Season</strong>. The popup has six parts, and the defaults are a good starting point.</p>' +
      '<ol class="rcc-help-steps">' +
      '<li><strong>Season.</strong> A name, the series (WEC or ELMS) and the year. Use the same series and year in the game.</li>' +
      '<li><strong>Classes.</strong> Tick the classes you want on the grid.</li>' +
      '<li><strong>Difficulty and Advanced.</strong> These match the Difficulty and Advanced tabs in the game.</li>' +
      '<li><strong>Points.</strong> The length of a Sprint, Medium and Long race, the points for P1 to P10 and any bonus points.</li>' +
      '<li><strong>Sessions.</strong> The start type (Rolling or Fast Rolling), the RealRoad time scale and whether there is qualifying. Choose <strong>No (Random start)</strong> and the game sets a random grid, you upload only the Race file and there is no pole bonus.</li>' +
      '<li><strong>Rounds.</strong> Add the rounds in the order you will race them. Each has a track, a layout, a race length, a weather preset and a start time.</li>' +
      '</ol>' +
      '<p>Then press <strong>Choose Your Team</strong>, pick a class and a car, and press <strong>Join This Team</strong>. That car is yours for the whole season.</p>' +
      '<div class="rc-rulebook-callout"><strong class="rcc-help-callout-title">Good to Know</strong><ul>' +
      '<li><strong>Season Preview</strong> shows every setting and round on one screen. Keep it open while you set up the game.</li>' +
      '<li>Edit Season can change the name, the Difficulty and Advanced settings, the start type and any round that has not been raced. The series, year, classes and points cannot change once the season exists.</li>' +
      '<li>Your team is final for the season.</li>' +
      '</ul></div>'
  },
  {
    id: 'set-up-race', num: '3', title: 'Race a Round in the Game',
    html:
      '<p>Each round is one Race Weekend in Le Mans Ultimate. Open <strong>Season Preview</strong> here, then in the game choose <strong>Race Weekend</strong> and match the round.</p>' +
      '<div class="rc-rulebook-callout"><strong class="rcc-help-callout-title">Race Setup Guide</strong>In Season Preview, press <strong>Open Race Setup Guide</strong>. It shows each game screen with your season\u2019s values on it, so you can match them one for one. Red values must match or the upload is refused, blue values keep your records accurate, and grey values are your choice.</div>' +
      '<div class="rc-rulebook-callout"><strong class="rcc-help-callout-title">These Five Settings Must Match or the Upload Fails</strong><ul>' +
      '<li><strong>Series and year</strong>, as in your season</li>' +
      '<li><strong>Track and layout</strong>, as in the round. If the track is missing, switch the filter to All.</li>' +
      '<li><strong>Class, car and team</strong>, the seat you signed for</li>' +
      '<li><strong>Starting Grid</strong>, set to your season of cars, such as Season 2023. Never choose Fill Grid, and only race your season\u2019s classes.</li>' +
      '<li><strong>Race length</strong>, the same as the round or longer. A shorter race is refused.</li>' +
      '</ul></div>' +
      '<p>Everything else only affects how accurate your records are. Copy the Difficulty and Advanced settings, the start type and the RealRoad time scale from your season, and choose the weather and start time the round shows. Assists are up to you, and the ones you use appear in the race recap.</p>' +
      '<ol class="rcc-help-steps">' +
      '<li><strong>Qualifying.</strong> If your season has it, run Qualifying first. Practice is optional and is never uploaded. If your season has no qualifying, turn it off in the game so the race starts from a random grid.</li>' +
      '<li><strong>Race.</strong> Drive the Race to the checkered flag so the game saves the results.</li>' +
      '</ol>' +
      '<div class="rc-rulebook-callout"><strong class="rcc-help-callout-title">Use the Base Setup</strong>The AI drives every car on the game\u2019s base setup. For the fairest racing, use it too. A bought or downloaded setup can make you faster than the AI was built to race against.</div>' +
      '<div class="rc-rulebook-callout"><strong class="rcc-help-callout-title">DLC</strong>The Single Player Championship cannot tell which DLC you own, so only choose tracks and cars you are able to race.</div>'
  },
  {
    id: 'upload', num: '4', title: 'Find and Upload Your Results',
    html:
      '<p>The game saves an XML file for every session. To find them, open Steam, right-click Le Mans Ultimate, choose Manage and then Browse local files, and open <strong>UserData</strong>, then <strong>Log</strong>, then <strong>Results</strong>. On a standard installation the folder is here.</p>' +
      '<p class="rcc-help-path">C:\\Program Files (x86)\\Steam\\steamapps\\common\\Le Mans Ultimate\\UserData\\Log\\Results</p>' +
      '<p>Sort the folder by date. The newest file ending in <strong>R1.xml</strong> is your race. The <strong>Q1.xml</strong> file just before it is your qualifying from the same weekend. Files ending in P1.xml are practice and are not uploaded.</p>' +
      '<ol class="rcc-help-steps">' +
      '<li><strong>Click Upload Results</strong> on the round in the Single Player Championship section of your Dashboard. Rounds upload in calendar order.</li>' +
      '<li><strong>Choose the files.</strong> File 1 is the Qualifying file and file 2 is the Race file. If your season has no qualifying, choose only the Race file.</li>' +
      '<li><strong>Click Upload Results</strong> and wait up to a minute. The page reloads with your standings, recap and story.</li>' +
      '</ol>' +
      '<p>The files are checked before anything is saved. If something is wrong, a message explains it and nothing is saved, so you can fix it and try again. If the track name in the files looks different from the round\u2019s track, you are asked whether to upload anyway. Choose Upload Anyway only when it really is the same track.</p>' +
      '<div class="rc-rulebook-callout"><strong class="rcc-help-callout-title">Wrong Files?</strong>Click <strong>Erase Results</strong> on your latest round and upload again. The round stays on the calendar. If the race was shorter than the round, use Edit Season to shorten the round before you upload.</div>'
  },
  {
    id: 'recap', num: '5', title: 'Recaps, Reports and Stories',
    html:
      '<p>Every round with results gets a <strong>Race Recap</strong>, opened from the round\u2019s calendar card. The dropdown inside it switches between the race results, qualifying, your <strong>Driver Report</strong>, the race settings and every lap you drove. <strong>Driver Report</strong> on the calendar card opens the recap straight on your charts.</p>' +
      '<p>The Driver Report shows your race at a glance, your position on every lap, tyres, fuel, pit strategy, pace, contacts and your qualifying laps. Switch between <strong>Whole Class</strong> and <strong>Nearest Rivals</strong> to see who you are comparing against.</p>' +
      '<p><strong>Season Stories</strong> are news articles written by AI from your results. A Season Preview is written when you join a team, a Race Story after every upload and a Season Finale after the last round. A new story takes a minute or two and you can keep using the page while you wait. Rate a story with the thumbs up or down, and your ratings shape the stories that follow.</p>' +
      '<div class="rc-rulebook-callout"><strong class="rcc-help-callout-title">Good to Know</strong><ul>' +
      '<li>The standings stay empty until the first round has results.</li>' +
      '<li>Erase Results removes that round\u2019s story too, and uploading again writes a new one.</li>' +
      '<li>Stories are written by AI, so the occasional detail may be off. The standings and results are the official record.</li>' +
      '</ul></div>'
  },
  {
    id: 'end-season', num: '6', title: 'Ending a Season',
    html:
      '<ol class="rcc-help-steps">' +
      '<li><strong>Upload every round.</strong> A season counts toward your racing record only when it ends after the last round\u2019s results are uploaded.</li>' +
      '<li><strong>Click End Season</strong> in the Single Player Championship section of your Dashboard and confirm. The standings become final.</li>' +
      '<li><strong>Start the next one</strong> with Create Season. Past seasons stay available from the Season dropdown in the black bar.</li>' +
      '</ol>' +
      '<div class="rc-rulebook-callout"><strong class="rcc-help-callout-title">Changed Your Mind?</strong>You can click End Season before every round is raced and type END SEASON to confirm. The season is saved as unfinished and never counts toward your career. Or click Delete Season to remove it completely, including its rounds, your team signing and every result. Deleting cannot be undone, so you are asked to type DELETE SEASON first.</div>' +
      '<p>If something does not work, open the menu under your name at the top of the page (the menu button on a phone), choose <strong>Feedback</strong> and let us know.</p>'
  }
];
