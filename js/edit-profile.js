// Race Club — js/edit-profile.js
// Lets the Edit Profile popup open IN PLACE on index.html and league.html.

// Local el()/escapeHtml() -- same tiny helpers Account.html's own script scope has, duplicated here
// rather than shared since this file has its own global scope on the pages that load it
// (index.html/league.html never load Account.html's inline script).
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

// Same avatar-or-initials rendering as Account.html's buildAvatarCircle(), including the
// rcAvatarSrc_/rcWireAvatarFallback_ resolve-then-default- then-initials chain (both globals from
// header.js.
function _rcEP_buildAvatarCircle(profile, extraClass) {
  var circle = _rcEP_el('div', 'rc-avatar-circle' + (extraClass ? ' ' + extraClass : ''));
  var initials = (typeof _rcHeaderInitials === 'function') ? _rcHeaderInitials(profile && profile.displayName) : '?';
  var avatarSrc = (typeof rcAvatarSrc_ === 'function' && profile) ? rcAvatarSrc_(profile.avatarFilename) : '';
  if (avatarSrc) {
    var img = document.createElement('img');
    img.className = 'rc-avatar-circle-img';
    img.alt = '';
    img.src = avatarSrc;
    rcWireAvatarFallback_(img, function () {
      img.remove();
      circle.textContent = initials;
    });
    circle.appendChild(img);
  } else {
    circle.textContent = initials;
  }
  return circle;
}

// Generic modal shell, themed to whichever page this is (light .rc-modal on every page except
// league.html, dark .rcl-modal-dialog on league.html) -- same branch and manual
// document.createElement approach _rcOpenFeedbackModal (js/header.js) already uses.
function _rcEPShowModal(title, opts) {
  opts = opts || {};
  var isDark = document.body.classList.contains('rc-league-page');

  var backdrop = document.createElement('div');
  // rcl-modal-overlay-over-nav -- sits above .rc-fixed-header (css/style.css, z-index:1000) instead
  // of below it, so the navbar dims along with the rest of the page.
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

// Same fixed avatar grid as Account.html's openAvatarPickerModal(), just built on
// _rcEPShowModal/_rcEP_el instead of showModal/el, and with no reload-the-page step after saving
// (there's no profile page here to refresh -- the header's own avatar updates immediately via
// setProfileCache + renderHeader(), same as it always does).
function _rcEPOpenAvatarPickerModal(profile, token, onSaved) {
  var body = _rcEP_el('div');
  body.appendChild(_rcEP_el('p', 'rc-hint', 'Choose from one of our AI generated profile pictures. You can change this again any time.'));

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
    img.src = rcAvatarSrc_(filename);
    img.alt = 'Avatar option';
    img.loading = 'lazy';
    img.onerror = function () { rcAvatarNext_(img, function () { btn.style.display = 'none'; }, false); };
    btn.appendChild(img);
    btn.addEventListener('click', function () {
      selected = filename;
      urlInput.value = ''; // picking a preset clears any pasted link so the two can't fight at Save
      refreshSelection();
    });
    grid.appendChild(btn);
    itemButtons.push(btn);
  });
  refreshSelection();
  body.appendChild(grid);

  // Paste-your-own-image-link row -- same shape as Account.html's own copy of this popup
  // (openAvatarPickerModal), see its comment for the full reasoning on why "https://" is a separate
  // non-editable label rather than part of the input's own value.
  // Margin-top added, same as Account.html's own copy, so this line isn't sitting right against the
  // bottom of the grid.
  var urlHint = _rcEP_el('p', 'rc-hint', 'Or paste a link to your own image:');
  urlHint.style.marginTop = '18px';
  body.appendChild(urlHint);
  var urlRow = _rcEP_el('div', 'rc-avatar-url-row');
  urlRow.appendChild(_rcEP_el('span', 'rc-avatar-url-prefix', 'https://'));
  var urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.className = 'rc-avatar-url-input';
  urlInput.placeholder = 'yoursite.com/your-image.jpg';
  if (profile.avatarFilename && /^https:\/\//i.test(profile.avatarFilename)) {
    urlInput.value = profile.avatarFilename.replace(/^https:\/\//i, '');
  }
  urlInput.addEventListener('input', function () {
    if (urlInput.value.trim()) {
      selected = null;
      refreshSelection();
    }
  });
  urlRow.appendChild(urlInput);
  body.appendChild(urlRow);
  // Image restriction note, same as Account.html's own copy -- a note only for now, not enforced
  // client- or server-side.
  body.appendChild(_rcEP_el('div', 'rc-hint', 'Image must be square and under 1MB.'));

  var saveBtn = _rcEP_el('button', 'rc-btn-primary', 'Save Avatar');
  saveBtn.type = 'button';
  saveBtn.style.marginTop = '18px';
  saveBtn.addEventListener('click', function () {
    var typedUrl = urlInput.value.trim();
    var finalSelection = typedUrl ? ('https://' + typedUrl) : selected;
    if (!finalSelection) {
      showToast('Pick an avatar or paste an image link first.', 'error');
      return;
    }

    var previousAvatarFilename = profile.avatarFilename;
    profile.avatarFilename = finalSelection;
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
        avatarFilename: finalSelection
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

// Same Change Password form as Account.html's passwordChangeSection(), minus the
// rcReloadAfterSave() call on success (that function navigates to Account.html#<section>, which
// makes no sense to fire from index.html or league.html -- a toast alone is the confirmation here).
// noOwnButton -- when true, renders just the three fields with no button of its own;
// _rcEPOpenEditProfileModal below reads them via .rc-pw-current/.rc-pw-new/.rc-pw-confirm and
// drives the change through its own SAVE CHANGES button instead.
function _rcEPPasswordChangeSection(token, opts) {
  opts = opts || {};
  var box = document.createElement('div');
  box.className = 'rc-panel';
  box.style.borderColor = 'var(--rc-red)';
  box.appendChild(_rcEP_el('h3', 'margin-top:0;font-size:15px;', 'Change Password'));
  var cur = _rcEP_el('input'); cur.type = 'password'; cur.placeholder = 'Current password'; cur.className = 'rc-pw-current';
  var next = _rcEP_el('input'); next.type = 'password'; next.placeholder = 'New password (8+ characters)'; next.className = 'rc-pw-new';
  var confirm = _rcEP_el('input'); confirm.type = 'password'; confirm.placeholder = 'Confirm new password'; confirm.className = 'rc-pw-confirm';
  box.appendChild(cur); box.appendChild(next); box.appendChild(confirm);

  if (!opts.noOwnButton) {
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
    box.appendChild(btn);
  }
  return box;
}

// Same form as Account.html's openEditProfileModal() -- Username / First / Last / Suffix / Email /
// Location / Time Zone, posting to updateOwnProfile, plus the Change Password section embedded
// underneath.
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

  // First Name / Last Name / Suffix share one row, First/Last 40% each and Suffix filling the rest.
  var nameRow = _rcEP_el('div', 'rc-field-trio-name');
  var firstCol = _rcEP_el('div');
  firstCol.appendChild(_rcEP_el('label', 'margin-top:0;', 'First Name'));
  var firstName = _rcEP_el('input'); firstName.type = 'text'; firstName.value = profile.firstName || ''; firstName.required = true;
  firstCol.appendChild(firstName);
  nameRow.appendChild(firstCol);

  var lastCol = _rcEP_el('div');
  lastCol.appendChild(_rcEP_el('label', 'margin-top:0;', 'Last Name'));
  var lastName = _rcEP_el('input'); lastName.type = 'text'; lastName.value = profile.lastName || ''; lastName.required = true;
  lastCol.appendChild(lastName);
  nameRow.appendChild(lastCol);

  var suffixCol = _rcEP_el('div');
  suffixCol.appendChild(_rcEP_el('label', 'margin-top:0;', 'Suffix'));
  var suffix = document.createElement('select');
  var suffixBlank = document.createElement('option'); suffixBlank.value = ''; suffixBlank.textContent = 'None';
  suffix.appendChild(suffixBlank);
  (typeof DRIVER_NAME_SUFFIXES !== 'undefined' ? DRIVER_NAME_SUFFIXES : []).forEach(function (s) {
    var opt = document.createElement('option'); opt.value = s; opt.textContent = s;
    if (profile.suffix === s) opt.selected = true;
    suffix.appendChild(opt);
  });
  suffixCol.appendChild(suffix);
  nameRow.appendChild(suffixCol);
  form.appendChild(nameRow);

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

  // Email-notification opt-in checkbox removed.

  body.appendChild(form);
  // noOwnButton: true -- SAVE CHANGES below drives both saves together now.
  var pwBox = _rcEPPasswordChangeSection(token, { noOwnButton: true });
  body.appendChild(pwBox);
  var pwCurrent = pwBox.querySelector('.rc-pw-current');
  var pwNew = pwBox.querySelector('.rc-pw-new');
  var pwConfirm = pwBox.querySelector('.rc-pw-confirm');
  pwCurrent.addEventListener('input', function () { pwCurrent.classList.remove('rc-field-invalid'); });

  // Physically outside <form> but still wired to it via the HTML5 form="" attribute, so both a
  // click here and pressing Enter in any of the fields above still fire the form's own 'submit'
  // listener below.
  form.id = form.id || ('rc-edit-profile-form-' + Date.now());
  var saveBtn = _rcEP_el('button', null, 'Save Changes');
  saveBtn.type = 'submit';
  saveBtn.setAttribute('form', form.id);
  saveBtn.className = 'rc-btn-primary';
  saveBtn.style.marginTop = '20px';
  body.appendChild(saveBtn);

  var modalHandle = _rcEPShowModal('Edit Profile', { bodyEl: body });

  function shakeAndFlagPassword(msg) {
    pwCurrent.classList.add('rc-field-invalid');
    modalHandle.el.classList.remove('rc-shake');
    void modalHandle.el.offsetWidth;
    modalHandle.el.classList.add('rc-shake');
    showToast(msg, 'error');
  }

  function saveProfileFieldsAndClose() {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving Changes...';

    fetchApi('updateOwnProfile', {
      method: 'POST',
      token: token,
      timeoutMs: RC_FETCH_TIMEOUT_MS_PROFILE,
      body: {
        username: username.value.trim(),
        firstName: firstName.value.trim(),
        lastName: lastName.value.trim(),
        suffix: suffix.value,
        email: email.value.trim(),
        location: location.value,
        timeZone: timeZone.value
      }
    })
      .then(function (data) {
        if (!data.success) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Changes';
          showToast(data.message || 'Could not save your changes.', 'error');
          return;
        }
        setProfileCache(data.profile);
        if (typeof renderHeader === 'function') renderHeader();
        if (modalHandle) modalHandle.close();
        showToast('Profile updated.', 'success');
      })
      .catch(function () {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
        showToast('Could not reach the server -- try again.', 'error');
      });
  }

  form.addEventListener('submit', function (evt) {
    evt.preventDefault();
    if (!username.value.trim() || !firstName.value.trim() || !lastName.value.trim() || !email.value.trim()) {
      showToast('Username, first name, last name, and email are required.', 'error');
      return;
    }
    var identityProblem = rcIdentityProblem({ username: username.value, firstName: firstName.value, lastName: lastName.value }, profile);
    if (identityProblem) {
      showToast(identityProblem, 'error');
      return;
    }

    // Password change folded into SAVE CHANGES, mirroring Account.html's own openEditProfileModal
    // exactly. The button waits on the server (up to RC_FETCH_TIMEOUT_MS_PROFILE) and shows "Saving
    // Changes..." the whole time.
    var changingPassword = !!(pwNew.value || pwConfirm.value);
    if (!changingPassword) {
      saveProfileFieldsAndClose();
      return;
    }
    if (!pwCurrent.value) {
      shakeAndFlagPassword('Fill in current password to save changes');
      return;
    }
    if (pwNew.value !== pwConfirm.value) {
      showToast('New password and confirmation don\'t match.', 'error');
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving Changes...';
    fetchApi('changeOwnPassword', { method: 'POST', token: token, timeoutMs: RC_FETCH_TIMEOUT_MS_PROFILE, body: { currentPassword: pwCurrent.value, newPassword: pwNew.value } })
      .then(function (pwData) {
        if (!pwData.success) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Changes';
          if (pwData.error === 'INVALID_CURRENT_PASSWORD') {
            shakeAndFlagPassword('Incorrect current password entered');
          } else {
            showToast(pwData.message || 'Could not update your password.', 'error');
          }
          return;
        }
        saveProfileFieldsAndClose();
      })
      .catch(function () {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
        showToast('Could not reach the server -- try again.', 'error');
      });
  });
}

// Entry point -- called by _rcOpenEditProfileFromHeader (js/header.js) when
// window.rcOpenEditProfileModal (Account.html's own bridge) isn't present, i.e. whenever Edit
// Profile is opened from a page other than Account.html. getProfileCache() (js/auth.js) only
// carries displayName/role/avatarFilename -- just enough for the header to render -- not the full
// editable field set this form needs, so this always fetches a fresh profile first rather than
// trusting that thin cache.
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
