// Race Club -- js/profile.js. Backs profile.html?id=RC-00012: avatar, display name, country flag and
// member-since date for one driver, read from the public driver directory (api.js). Draws instantly
// from the copy saved in this browser, then quietly refreshes it; no loading screen.
(function () {
  var params = new URLSearchParams(window.location.search);
  var profileId = (params.get('id') || '').trim();

  var card = document.getElementById('rc-profile-card');
  var emptyCard = document.getElementById('rc-profile-empty');
  var avatar = document.getElementById('rc-profile-avatar');
  var nameEl = document.getElementById('rc-profile-name');
  var flag = document.getElementById('rc-profile-flag');
  var sinceEl = document.getElementById('rc-profile-since');
  var shownKey = null;

  function findDriver(dir) {
    if (!dir || !dir.drivers) return null;
    for (var i = 0; i < dir.drivers.length; i++) {
      if (dir.drivers[i].id === profileId) return dir.drivers[i];
    }
    return null;
  }

  function formatSince(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return 'Member since ' + d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  }

  function showEmpty(title, text) {
    card.hidden = true;
    emptyCard.hidden = false;
    document.getElementById('rc-profile-empty-title').textContent = title;
    document.getElementById('rc-profile-empty-text').textContent = text;
    document.title = 'Race Club: Driver Profile';
    shownKey = null;
  }

  function showDriver(driver) {
    var key = [driver.n, driver.a, driver.c, driver.j].join('|');
    if (key === shownKey) return;
    shownKey = key;

    emptyCard.hidden = true;
    card.hidden = false;
    nameEl.textContent = driver.n || 'Race Club Driver';
    document.title = (driver.n || 'Driver') + ' | Race Club';
    sinceEl.textContent = formatSince(driver.j);

    avatar.onerror = function () {
      rcAvatarNext_(avatar, function () { avatar.style.visibility = 'hidden'; }, true);
    };
    avatar.style.visibility = '';
    avatar.src = rcAvatarCandidates_(driver.a, true)[0];

    var flagSrc = driver.c ? countryFlagSrc(driver.c) : '';
    if (flagSrc) {
      flag.onerror = function () { flag.hidden = true; };
      flag.src = flagSrc;
      flag.title = driver.c;
      flag.hidden = false;
    } else {
      flag.hidden = true;
    }
  }

  if (!/^RC-\d+$/.test(profileId)) {
    showEmpty('Profile Not Found', 'That link does not point to a Race Club driver.');
    return;
  }

  var saved = rcReadSavedDriverDirectory();
  var savedDriver = findDriver(saved);
  if (savedDriver) showDriver(savedDriver);

  rcFetchDriverDirectory().then(function (fresh) {
    var driver = findDriver(fresh);
    if (driver) showDriver(driver);
    else showEmpty('Profile Not Available', 'This driver does not have an active Race Club profile.');
  }).catch(function () {
    if (!savedDriver) showEmpty('Profile Unavailable', 'Could not load this profile right now. Please try again in a moment.');
  });
})();
