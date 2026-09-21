/*
  Race Club — js/edit-profile.js

  Lets the Edit Profile popup open IN PLACE on index.html and league.html
  (2026-09-21, Matt's ask: "make it so that the popup appears on the index
  or league page, with league styling, if the user is on the league or
  index page" -- previously _rcOpenEditProfileFromHeader (js/header.js)
  always navigated to Account.html first and opened its own copy of this
  modal there, same as Edit Profile still does when clicked FROM
  Account.html or from login/register/verify/reset-password, none of
  which show the account dropdown at all when logged out).

  This is a deliberate PARALLEL implementation of Account.html's own
  openEditProfileModal/openAvatarPickerModal/passwordChangeSection, not a
  shared one -- Account.html's copies stay exactly as they are (still used
  when Edit Profile is opened from Account.html's own sidebar, or via the
  header dropdown while already on Account.html). Duplicating this one
  popup is simpler and lower-risk than refactoring Account.html's already
  very large file to import from here, and this file only ever loads on
  index.html/league.html (see those pages' <script> tags), so there's no
  double-definition risk with Account.html's own functions of the same
  name.

  Themed to match whichever page it's opened from -- same
  document.body.classList.contains('rc-league-page') branch
  _rcOpenFeedbackModal (js/header.js) already uses -- via _rcEPShowModal
  below, which builds either the light .rc-modal shell or the dark
  .rcl-modal-dialog shell. Both branches use the NARROW width (460px,
  .rcl-modal-dialog-narrow on the dark side -- see css/league.css) to
  match Account.html's own Edit Profile/Change Avatar popups exactly,
  which use the plain (non -wide) .rc-modal.

  Depends on (all already loaded before this file on both pages -- see
  <script src="js/..."> order in index.html/league.html's <head>):
  js/api.js (fetchApi), js/auth.js (getToken/setProfileCache), js/header.js
  (showToast, _rcHeaderInitials, renderHeader), js/reference-data.js
  (COUNTRIES, DRIVER_NAME_SUFFIXES, getTimezoneList, timezoneLabel).
*/

// Local el()/escapeHtml() -- same tiny helpers Account.html's own script
// scope has, duplicated here rather than shared since this file has its
// own global scope on the pages that load it (index.html/league.html
// never load Account.html's inline script).
function _rcEP_el(tag, style, html) {
  var e = document.createElement(tag);
  if (style) {
    if (style.indexOf(':') !== -1) e.style.cssText = style;
    else e.className = style;
  }
  if (html !== undefined) e.innerHTML = html;
  return e;
}

// Same fixed 18-image set as RC_AVATAR_FILENAMES_ in Account.html --
// keep these two in sync if that range ever changes again.
var RC_AVATAR_FILENAMES_ = (function () {
  var list = [];
  for (var i = 1; i <= 18; i++) list.push('avatar-' + (i < 10 ? '0' + i : i) + '.png');
  return list;
})();

// Same avatar-or-initials rendering as Account.html's buildAvatarCircle().
function _rcEP_buildAvatarCircle(profile, extraClass) {
  var circle = _rcEP_el('div', 'rc-avatar-circle' + (extraClass ? ' ' + extraClass : ''));
  var initials = (typeof _rcHeaderInitials === 'function') ? _rcHeaderInitials(profile && profile.displayName) : '?';
  if (profile && profile.avatarFilename) {
    var img = document.createElement('img');
    img.className = 'rc-avatar-circle-img';
    img.alt = '';
    img.src = 'assets/avatars/' + profile.avatarFilename;
    img.onerror = function () {
      img.remove();
      circle.textContent = initials;
    };
    circle.appendChild(img);
  } else {
    circle.textContent = initials;
  }
  return circle;
}

// Generic modal shell, themed to whichever page this is (light .rc-modal
// on every page except league.html, dark .rcl-modal-dialog on
// league.html) -- same branch and manual document.createElement approach
// _rcOpenFeedbackModal (js/header.js) already uses. Same "closable only
// via the X button" lockdown as every modal on the site. opts.wide/narrow
// mirror Account.html's showModal(title, {wide}) -- narrow (the default)
// matches Account's plain .rc-modal (460px); wide matches .rc-modal-wide
// (820px, same width as the dark shell's own default, so wide needs no
// extra dark-side class).
function _rcEPShowModal(title, opts) {
  opts = opts || {};
  var isDark = document.body.classList.contains('rc-league-page');

  var backdrop = document.createElement('div');
  // rcl-modal-overlay-over-nav (2026-09-21, Matt's ask: "only when EDIT
  // PROFILE and FEEDBACK popups are visible on the league page, dim the
  // navbar with the main league page... keep the other popups how they
  // are") -- sits above .rc-fixed-header (css/style.css, z-index:1000)
  // instead of below it, so the navbar dims along with the rest of the
  // page. Every popup built with this shared shell (Edit Profile, Change
  // Avatar, and the brief loading state before either) gets this, since
  // they're all the same "Edit Profile" flow.
  backdrop.className = isDark ? 'rcl-modal-overlay rcl-modal-overlay-over-nav' : 'rc-modal-backdrop';
  var modal = document.createElement('div');
  modal.className = isDark
    ? ('rcl-modal-dialog' + (opts.wide ? '' : ' rcl-modal-dialog-narrow'))
    : ('rc-modal' + (opts.wide ? ' rc-modal-wide' : ''));
  var head = document.createElement('div');
  head.className = isDark ? 'rcl-modal-head' : 'rc-modal-head';
  var titleEl = document.createElement(isDark ? 'div' : 'h3');
  if (isDark) {
    titleEl.className = 'rcl-modal-title';
  } else {
    titleEl.style.margin = '0';
    titleEl.style.fontSize = '16px';
  }
  titleEl.textContent = title;
  head.appendChild(titleEl);
  var closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = isDark ? 'rcl-modal-close' : 'rc-modal-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '&times;';
  head.appendChild(closeBtn);
  var body = document.createElement('div');
  body.className = isDark ? 'rcl-modal-body' : 'rc-modal-body';
  if (opts.bodyEl) body.appendChild(opts.bodyEl);
  modal.appendChild(head);
  modal.appendChild(body);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  var scrollYBeforeModal = window.scrollY || window.pageYOffset || 0;
  document.body.style.top = '-' + scrollYBeforeModal + 'px';
  document.body.classList.add('rc-modal-scroll-locked');

  function close() {
    backdrop.remove();
    document.body.classList.remove('rc-modal-scroll-locked');
    document.body.style.top = '';
    window.scrollTo(0, scrollYBeforeModal);
  }
  closeBtn.addEventListener('click', close);

  return { close: close, body: body, el: modal };
}

// Same fixed avatar grid as Account.html's openAvatarPickerModal(), just
// built on _rcEPShowModal/_rcEP_el instead of showModal/el, and with no
// reload-the-page step after saving (there's no profile page here to
// refresh -- the header's own avatar updates immediately via
// setProfileCache + renderHeader(), same as it always does).
function _rcEPOpenAvatarPickerModal(profile, token, onSaved) {
  var body = _rcEP_el('div');
  body.appendChild(_rcEP_el('p', 'rc-hint', 'Choose a profile picture. You can change this again any time.'));

  var grid = _rcEP_el('div', 'rc-avatar-picker-grid');
  var selected = profile.avatarFilename || null;
  var itemButtons = [];

  function refreshSelection() {
    itemButtons.forEach(function (btn) {
      btn.classList.toggle('rc-avatar-picker-item-selected', btn.getAttribute('data-filename') === selected);
    });
  }

  RC_AVATAR_FILENAMES_.forEach(function (filename) {
    var btn = _rcEP_el('button', 'rc-avatar-picker-item');
    btn.type = 'button';
    btn.setAttribute('data-filename', filename);
    var img = document.createElement('img');
    img.src = 'assets/avatars/' + filename;
    img.alt = 'Avatar option';
    img.loading = 'lazy';
    img.onerror = function () { btn.style.display = 'none'; };
    btn.appendChild(img);
    btn.addEventListener('click', function () {
      selected = filename;
      refreshSelection();
    });
    grid.appendChild(btn);
    itemButtons.push(btn);
  });
  refreshSelection();
  body.appendChild(grid);

  var saveBtn = _rcEP_el('button', 'rc-btn-primary', 'Save Avatar');
  saveBtn.type = 'button';
  saveBtn.style.marginTop = '18px';
  saveBtn.addEventListener('click', function () {
    if (!selected) {
      showToast('Pick an avatar first.', 'error');
      return;
    }

    var previousAvatarFilename = profile.avatarFilename;
    profile.avatarFilename = selected;
    if (onSaved) onSaved(profile);
    setProfileCache(profile);
    if (typeof renderHeader === 'function') renderHeader();
    if (pickerModal) pickerModal.close();

    fetchApi('updateOwnProfile', {
      method: 'POST',
      token: token,
      body: {
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
        suffix: profile.suffix || '',
        email: profile.email,
        location: profile.location || '',
        timeZone: profile.timeZone || '',
        avatarFilename: selected
      }
    })
      .then(function (data) {
        if (!data.success) {
          profile.avatarFilename = previousAvatarFilename;
          if (onSaved) onSaved(profile);
          setProfileCache(profile);
          if (typeof renderHeader === 'function') renderHeader();
          showToast(data.message || 'Could not save your avatar -- reverted.', 'error');
          return;
        }
        setProfileCache(data.profile);
        if (typeof renderHeader === 'function') renderHeader();
      })
      .catch(function () {
        profile.avatarFilename = previousAvatarFilename;
        if (onSaved) onSaved(profile);
        setProfileCache(profile);
        if (typeof renderHeader === 'function') renderHeader();
        showToast('Could not reach the server -- avatar change reverted.', 'error');
      });
  });
  body.appendChild(saveBtn);

  var pickerModal = _rcEPShowModal('Change Avatar', { bodyEl: body });
}

// Same Change Password form as Account.html's passwordChangeSection(),
// minus the rcReloadAfterSave() call on success (that function navigates
// to Account.html#<section>, which makes no sense to fire from index.html
// or league.html -- a toast alone is the confirmation here).
function _rcEPPasswordChangeSection(token) {
  var box = document.createElement('div');
  box.className = 'rc-panel';
  box.style.borderColor = 'var(--rc-red)';
  box.appendChild(_rcEP_el('h3', 'margin-top:0;font-size:15px;', 'Change Password'));
  var cur = _rcEP_el('input'); cur.type = 'password'; cur.placeholder = 'Current password';
  var next = _rcEP_el('input'); next.type = 'password'; next.placeholder = 'New password (8+ characters)';
  var confirm = _rcEP_el('input'); confirm.type = 'password'; confirm.placeholder = 'Confirm new password';
  var btn = _rcEP_el('button', null, 'Update Password'); btn.className = 'rc-btn-primary rc-btn-sm'; btn.style.marginTop = '14px';

  btn.addEventListener('click', function () {
    if (next.value !== confirm.value) {
      showToast('New password and confirmation don\'t match.', 'error');
      return;
    }
    fetchApi('changeOwnPassword', { method: 'POST', token: token, body: { currentPassword: cur.value, newPassword: next.value } })
      .then(function (data) {
        showToast(data.message || (data.success ? 'Updated.' : 'Failed.'), data.success ? 'success' : 'error');
        if (data.success) { cur.value = ''; next.value = ''; confirm.value = ''; }
      });
  });

  box.appendChild(cur); box.appendChild(next); box.appendChild(confirm); box.appendChild(btn);
  return box;
}

// Same form as Account.html's openEditProfileModal() -- Username / First /
// Last / Suffix / Email / Location / Time Zone, posting to
// updateOwnProfile, plus the Change Password section embedded underneath.
// No rcReloadAfterSave() here (nothing to reload) -- a success toast is
// the confirmation instead, and the header's own name/avatar update
// immediately via setProfileCache + renderHeader(), same as everywhere
// else on the site.
function _rcEPOpenEditProfileModal(profile, token) {
  if (!profile || !token) return;

  var body = _rcEP_el('div');

  var avatarRow = _rcEP_el('div', 'rc-avatar-edit-row');
  var avatarCircle = _rcEP_buildAvatarCircle(profile, 'rc-avatar-circle-xl');
  avatarRow.appendChild(avatarCircle);
  var changeAvatarLink = _rcEP_el('a', 'rc-avatar-change-link', 'Change Avatar');
  changeAvatarLink.href = '#';
  changeAvatarLink.addEventListener('click', function (evt) {
    evt.preventDefault();
    _rcEPOpenAvatarPickerModal(profile, token, function (newProfile) {
      profile = newProfile;
      var freshCircle = _rcEP_buildAvatarCircle(profile, 'rc-avatar-circle-xl');
      avatarRow.replaceChild(freshCircle, avatarCircle);
      avatarCircle = freshCircle;
    });
  });
  avatarRow.appendChild(changeAvatarLink);

  var deleteAvatarLink = _rcEP_el('a', 'rc-avatar-delete-link', 'Delete Avatar');
  deleteAvatarLink.href = '#';
  deleteAvatarLink.addEventListener('click', function (evt) {
    evt.preventDefault();
    if (!profile.avatarFilename) return;

    var previousAvatarFilename = profile.avatarFilename;
    profile.avatarFilename = '';
    var freshCircle = _rcEP_buildAvatarCircle(profile, 'rc-avatar-circle-xl');
    avatarRow.replaceChild(freshCircle, avatarCircle);
    avatarCircle = freshCircle;
    setProfileCache(profile);
    if (typeof renderHeader === 'function') renderHeader();

    fetchApi('updateOwnProfile', {
      method: 'POST',
      token: token,
      body: {
        username: profile.username, firstName: profile.firstName, lastName: profile.lastName,
        suffix: profile.suffix || '', email: profile.email,
        location: profile.location || '', timeZone: profile.timeZone || '',
        avatarFilename: ''
      }
    })
      .then(function (data) {
        if (!data.success) {
          profile.avatarFilename = previousAvatarFilename;
          var revertedCircle = _rcEP_buildAvatarCircle(profile, 'rc-avatar-circle-xl');
          avatarRow.replaceChild(revertedCircle, avatarCircle);
          avatarCircle = revertedCircle;
          setProfileCache(profile);
          if (typeof renderHeader === 'function') renderHeader();
          showToast(data.message || 'Could not remove your avatar -- reverted.', 'error');
          return;
        }
        setProfileCache(data.profile);
        if (typeof renderHeader === 'function') renderHeader();
      })
      .catch(function () {
        profile.avatarFilename = previousAvatarFilename;
        var revertedCircle2 = _rcEP_buildAvatarCircle(profile, 'rc-avatar-circle-xl');
        avatarRow.replaceChild(revertedCircle2, avatarCircle);
        avatarCircle = revertedCircle2;
        setProfileCache(profile);
        if (typeof renderHeader === 'function') renderHeader();
        showToast('Could not reach the server -- avatar removal reverted.', 'error');
      });
  });
  avatarRow.appendChild(deleteAvatarLink);
  body.appendChild(avatarRow);

  var form = _rcEP_el('form');
  form.appendChild(_rcEP_el('label', 'margin-top:0;', 'Username'));
  var username = _rcEP_el('input'); username.type = 'text'; username.value = profile.username || ''; username.required = true;
  form.appendChild(username);

  form.appendChild(_rcEP_el('label', null, 'First Name'));
  var firstName = _rcEP_el('input'); firstName.type = 'text'; firstName.value = profile.firstName || ''; firstName.required = true;
  form.appendChild(firstName);

  form.appendChild(_rcEP_el('label', null, 'Last Name'));
  var lastName = _rcEP_el('input'); lastName.type = 'text'; lastName.value = profile.lastName || ''; lastName.required = true;
  form.appendChild(lastName);

  form.appendChild(_rcEP_el('label', null, 'Suffix (optional)'));
  var suffix = document.createElement('select');
  var suffixBlank = document.createElement('option'); suffixBlank.value = ''; suffixBlank.textContent = 'None';
  suffix.appendChild(suffixBlank);
  (typeof DRIVER_NAME_SUFFIXES !== 'undefined' ? DRIVER_NAME_SUFFIXES : []).forEach(function (s) {
    var opt = document.createElement('option'); opt.value = s; opt.textContent = s;
    if (profile.suffix === s) opt.selected = true;
    suffix.appendChild(opt);
  });
  form.appendChild(suffix);

  form.appendChild(_rcEP_el('label', null, 'Email Address'));
  var email = _rcEP_el('input'); email.type = 'email'; email.value = profile.email || ''; email.required = true;
  form.appendChild(email);
  form.appendChild(_rcEP_el('div', 'rc-hint', 'Only used for verification and password resets.'));

  form.appendChild(_rcEP_el('label', null, 'Location'));
  var location = document.createElement('select');
  var locBlank = document.createElement('option'); locBlank.value = ''; locBlank.textContent = 'Select a country';
  location.appendChild(locBlank);
  (typeof COUNTRIES !== 'undefined' ? COUNTRIES : []).forEach(function (country) {
    var opt = document.createElement('option'); opt.value = country; opt.textContent = country;
    if (profile.location === country) opt.selected = true;
    location.appendChild(opt);
  });
  form.appendChild(location);

  form.appendChild(_rcEP_el('label', null, 'Time Zone'));
  var timeZone = document.createElement('select');
  var tzBlank = document.createElement('option'); tzBlank.value = ''; tzBlank.textContent = 'Select a time zone';
  timeZone.appendChild(tzBlank);
  (typeof getTimezoneList === 'function' ? getTimezoneList() : []).forEach(function (tz) {
    var opt = document.createElement('option'); opt.value = tz; opt.textContent = typeof timezoneLabel === 'function' ? timezoneLabel(tz) : tz;
    if (profile.timeZone === tz) opt.selected = true;
    timeZone.appendChild(opt);
  });
  form.appendChild(timeZone);

  var emailNotifyRow = _rcEP_el('div', 'rc-check-row');
  emailNotifyRow.style.marginTop = '16px';
  var emailNotify = document.createElement('input');
  emailNotify.type = 'checkbox';
  emailNotify.id = 'rc-ep-email-notify';
  emailNotify.checked = !!profile.emailNotificationsOptIn;
  var emailNotifyLabel = document.createElement('label');
  emailNotifyLabel.setAttribute('for', 'rc-ep-email-notify');
  emailNotifyLabel.textContent = 'Email me about things I might miss, like season starts.';
  emailNotifyRow.appendChild(emailNotify);
  emailNotifyRow.appendChild(emailNotifyLabel);
  form.appendChild(emailNotifyRow);

  var saveBtn = _rcEP_el('button', null, 'Save Changes');
  saveBtn.type = 'submit';
  saveBtn.className = 'rc-btn-primary';
  saveBtn.style.marginTop = '16px';
  form.appendChild(saveBtn);

  body.appendChild(form);
  body.appendChild(_rcEP_el('hr', 'rc-nav-divider', null));
  body.appendChild(_rcEPPasswordChangeSection(token));

  var modalHandle = _rcEPShowModal('Edit Profile', { bodyEl: body });

  form.addEventListener('submit', function (evt) {
    evt.preventDefault();
    if (!username.value.trim() || !firstName.value.trim() || !lastName.value.trim() || !email.value.trim()) {
      showToast('Username, first name, last name, and email are required.', 'error');
      return;
    }

    var previousProfileCache = (typeof getProfileCache === 'function') ? getProfileCache() : null;
    var optimisticDisplayName = [firstName.value.trim(), lastName.value.trim(), suffix.value].filter(function (s) { return s; }).join(' ');
    setProfileCache({ displayName: optimisticDisplayName, role: previousProfileCache ? previousProfileCache.role : '', avatarFilename: profile.avatarFilename || '' });
    if (typeof renderHeader === 'function') renderHeader();
    if (modalHandle) modalHandle.close();

    fetchApi('updateOwnProfile', {
      method: 'POST',
      token: token,
      body: {
        username: username.value.trim(),
        firstName: firstName.value.trim(),
        lastName: lastName.value.trim(),
        suffix: suffix.value,
        email: email.value.trim(),
        location: location.value,
        timeZone: timeZone.value,
        emailNotificationsOptIn: emailNotify.checked ? '1' : '0'
      }
    })
      .then(function (data) {
        if (!data.success) {
          if (previousProfileCache) setProfileCache(previousProfileCache);
          if (typeof renderHeader === 'function') renderHeader();
          showToast(data.message || 'Could not save your changes -- reverted.', 'error');
          return;
        }
        setProfileCache(data.profile);
        if (typeof renderHeader === 'function') renderHeader();
        showToast('Profile updated.', 'success');
      })
      .catch(function () {
        if (previousProfileCache) setProfileCache(previousProfileCache);
        if (typeof renderHeader === 'function') renderHeader();
        showToast('Could not reach the server -- changes reverted.', 'error');
      });
  });
}

// Entry point -- called by _rcOpenEditProfileFromHeader (js/header.js)
// when window.rcOpenEditProfileModal (Account.html's own bridge) isn't
// present, i.e. whenever Edit Profile is opened from a page other than
// Account.html. getProfileCache() (js/auth.js) only carries
// displayName/role/avatarFilename -- just enough for the header to render
// -- not the full editable field set this form needs, so this always
// fetches a fresh profile first rather than trusting that thin cache.
// Opens the modal immediately with a small loading state so the click
// feels instant, then swaps in the real form once the fetch resolves.
function rcOpenEditProfileModalInPlace() {
  var token = (typeof getToken === 'function') ? getToken() : null;
  if (!token) return;

  var loadingBody = _rcEP_el('div', 'rc-inline-spinner-wrap');
  var lightsRow = _rcEP_el('div', 'rc-startlights');
  for (var li = 0; li < 5; li++) lightsRow.appendChild(_rcEP_el('span', 'rc-startlight'));
  loadingBody.appendChild(lightsRow);
  loadingBody.appendChild(_rcEP_el('div', 'rc-loading-text', 'Loading your profile...'));

  var modalHandle = _rcEPShowModal('Edit Profile', { bodyEl: loadingBody });

  fetchApi('getProfile', { token: token }).then(function (data) {
    if (!data.success || !data.profile) {
      modalHandle.close();
      showToast('Could not load your profile -- try again.', 'error');
      return;
    }
    modalHandle.close();
    _rcEPOpenEditProfileModal(data.profile, token);
  }).catch(function () {
    modalHandle.close();
    showToast('Could not reach the server -- try again.', 'error');
  });
}
