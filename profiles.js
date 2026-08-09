/**
 * Profiles Page Script
 * Manages profile UI and interactions
 */

// DOM Elements
const btnBack = document.getElementById('btnBack');
const btnCreateProfile = document.getElementById('btnCreateProfile');
const newProfileName = document.getElementById('newProfileName');
const profilesList = document.getElementById('profilesList');
const btnImportProfile = document.getElementById('btnImportProfile');
const importFile = document.getElementById('importFile');
const btnVerifyLogin = document.getElementById('btnVerifyLogin');
const loginUserId = document.getElementById('loginUserId');
const loginPassword = document.getElementById('loginPassword');
const loginStatus = document.getElementById('loginStatus');

// Modal elements
const profileModal = document.getElementById('profileModal');
const confirmModal = document.getElementById('confirmModal');
const toast = document.getElementById('toast');

// Modal controls
const btnCloseModal = document.getElementById('btnCloseModal');
const btnDeleteProfile = document.getElementById('btnDeleteProfile');
const btnExportProfile = document.getElementById('btnExportProfile');
const btnSaveProfile = document.getElementById('btnSaveProfile');
const btnLoadProfile = document.getElementById('btnLoadProfile');

// Confirm modal
const btnCancelConfirm = document.getElementById('btnCancelConfirm');
const btnConfirmAction = document.getElementById('btnConfirmAction');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');

// Modal form fields
const modalTitle = document.getElementById('modalTitle');
const modalProfileName = document.getElementById('modalProfileName');
const modalCloserHelper = document.getElementById('modalCloserHelper');
const modalAutoExport = document.getElementById('modalAutoExport');
const modalAutoExportFormat = document.getElementById('modalAutoExportFormat');
const modalTheme = document.getElementById('modalTheme');
const profileCreatedAt = document.getElementById('profileCreatedAt');
const profileUpdatedAt = document.getElementById('profileUpdatedAt');

let currentEditingProfile = null;
let pendingAction = null;
let loginCheckTimer = null;
const REMOTE_LOGIN_URL = 'https://raw.githubusercontent.com/chirag-deshwal/gspn-helper/refs/heads/main/risk_zone/api_data.json';
const LOGIN_CHECK_INTERVAL_MS = 10 * 60 * 1000;

// Navigation
btnBack.addEventListener('click', () => {
  window.close();
});

// ==================== Profile CRUD ====================

/**
 * Create new profile
 */
btnCreateProfile.addEventListener('click', async () => {
  const name = newProfileName.value.trim();

  if (!name) {
    showToast('Please enter a profile name', 'error');
    return;
  }

  try {
    btnCreateProfile.disabled = true;
    const newProfile = await profileManager.createProfile(name);
    showToast(`Profile "${name}" created successfully`, 'success');
    newProfileName.value = '';
    await renderProfiles();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    btnCreateProfile.disabled = false;
  }
});

/**
 * Render all profiles
 */
async function renderProfiles() {
  try {
    const profiles = await profileManager.getAllProfiles();
    const currentProfile = await profileManager.getCurrentProfile();

    if (profiles.length === 0) {
      profilesList.innerHTML = '<div class="empty-state"><p>No profiles created yet. Create one to get started!</p></div>';
      return;
    }

    let html = '';
    for (const profile of profiles) {
      const isActive = currentProfile && currentProfile.id === profile.id;
      const createdDate = new Date(profile.createdAt).toLocaleDateString();

      html += `
        <div class="profile-card ${isActive ? 'active' : ''}" data-profile-id="${profile.id}">
          <div class="profile-header">
            <div class="profile-name">${escapeHtml(profile.name)}</div>
            ${isActive ? '<span class="profile-badge">Active</span>' : ''}
          </div>
          <div class="profile-settings">
            <div class="profile-setting">
              <span class="profile-setting-icon ${profile.settings.closerHelperEnabled ? 'enabled' : 'disabled'}">
                ${profile.settings.closerHelperEnabled ? '✓' : '✕'}
              </span>
              <span>Closer Helper: ${profile.settings.closerHelperEnabled ? 'On' : 'Off'}</span>
            </div>
            <div class="profile-setting">
              <span class="profile-setting-icon ${profile.settings.autoExport ? 'enabled' : 'disabled'}">
                ${profile.settings.autoExport ? '✓' : '✕'}
              </span>
              <span>Auto Export: ${profile.settings.autoExport ? 'On' : 'Off'}</span>
            </div>
          </div>
          <div class="profile-date">Created: ${createdDate}</div>
        </div>
      `;
    }

    profilesList.innerHTML = html;

    // Add click handlers to cards
    document.querySelectorAll('.profile-card').forEach(card => {
      card.addEventListener('click', () => {
        const profileId = card.getAttribute('data-profile-id');
        openProfileModal(profileId);
      });
    });
  } catch (error) {
    showToast('Failed to load profiles', 'error');
    console.error(error);
  }
}

/**
 * Open profile modal for editing
 */
async function openProfileModal(profileId) {
  try {
    const profiles = await profileManager.getAllProfiles();
    const profile = profiles.find(p => p.id === profileId);

    if (!profile) {
      showToast('Profile not found', 'error');
      return;
    }

    currentEditingProfile = profile;
    modalTitle.textContent = profile.name;
    modalProfileName.value = profile.name;
    modalCloserHelper.checked = profile.settings.closerHelperEnabled;
    modalAutoExport.checked = profile.settings.autoExport;
    modalAutoExportFormat.value = profile.settings.autoExportFormat;
    modalTheme.value = profile.settings.theme;

    // Show profile info
    const createdDate = new Date(profile.createdAt).toLocaleString();
    const updatedDate = new Date(profile.updatedAt).toLocaleString();
    profileCreatedAt.textContent = `Created: ${createdDate}`;
    profileUpdatedAt.textContent = `Last updated: ${updatedDate}`;

    profileModal.classList.remove('hidden');
  } catch (error) {
    showToast('Failed to open profile', 'error');
    console.error(error);
  }
}

/**
 * Close modal
 */
function closeProfileModal() {
  profileModal.classList.add('hidden');
  currentEditingProfile = null;
}

btnCloseModal.addEventListener('click', closeProfileModal);

/**
 * Save profile changes
 */
btnSaveProfile.addEventListener('click', async () => {
  if (!currentEditingProfile) return;

  try {
    btnSaveProfile.disabled = true;

    const updates = {
      name: modalProfileName.value.trim(),
      settings: {
        closerHelperEnabled: modalCloserHelper.checked,
        autoExport: modalAutoExport.checked,
        autoExportFormat: modalAutoExportFormat.value,
        theme: modalTheme.value
      }
    };

    if (!updates.name) {
      showToast('Profile name cannot be empty', 'error');
      return;
    }

    await profileManager.updateProfile(currentEditingProfile.id, updates);
    showToast('Profile updated successfully', 'success');
    closeProfileModal();
    await renderProfiles();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    btnSaveProfile.disabled = false;
  }
});

/**
 * Load profile (apply settings)
 */
btnLoadProfile.addEventListener('click', async () => {
  if (!currentEditingProfile) return;

  try {
    btnLoadProfile.disabled = true;
    await profileManager.loadProfile(currentEditingProfile.id);
    showToast(`Profile "${currentEditingProfile.name}" loaded successfully`, 'success');
    closeProfileModal();
    await renderProfiles();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    btnLoadProfile.disabled = false;
  }
});

/**
 * Delete profile
 */
btnDeleteProfile.addEventListener('click', () => {
  if (!currentEditingProfile) return;

  confirmTitle.textContent = 'Delete Profile';
  confirmMessage.textContent = `Are you sure you want to delete "${currentEditingProfile.name}"? This action cannot be undone.`;
  btnConfirmAction.textContent = 'Delete';
  pendingAction = 'deleteProfile';
  profileModal.classList.add('hidden');
  confirmModal.classList.remove('hidden');
});

/**
 * Export profile
 */
btnExportProfile.addEventListener('click', async () => {
  if (!currentEditingProfile) return;

  try {
    const profileJson = await profileManager.exportProfile(currentEditingProfile.id);
    const blob = new Blob([profileJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentEditingProfile.name.replace(/\s+/g, '_')}_profile.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Profile exported successfully', 'success');
  } catch (error) {
    showToast('Failed to export profile', 'error');
  }
});

/**
 * Import profile
 */
btnImportProfile.addEventListener('click', () => {
  importFile.click();
});

importFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const content = await file.text();
    const profile = await profileManager.importProfile(content);
    showToast('Profile imported successfully', 'success');
    importFile.value = ''; // Reset file input
    await renderProfiles();
  } catch (error) {
    showToast(error.message, 'error');
    importFile.value = '';
  }
});

// ==================== Login System ====================

btnVerifyLogin.addEventListener('click', async () => {
  const userId = loginUserId.value.trim();
  const password = loginPassword.value.trim();
  await validateRemoteLogin(userId, password, true);
});

function setLoginStatus(message, type = 'info') {
  loginStatus.textContent = message;
  loginStatus.className = `login-status ${type}`;
}

function normalizeLoginValue(value) {
  return String(value || '').trim().toLowerCase();
}

function readLoginField(source, keys) {
  for (const key of keys) {
    if (source && Object.prototype.hasOwnProperty.call(source, key) && source[key] !== null && source[key] !== undefined && String(source[key]).trim() !== '') {
      return source[key];
    }
  }
  return null;
}

function collectLoginEntries(source, results) {
  if (Array.isArray(source)) {
    source.forEach(item => collectLoginEntries(item, results));
    return;
  }

  if (!source || typeof source !== 'object') {
    return;
  }

  const idValue = readLoginField(source, ['id', 'userId', 'user_id', 'username', 'employeeId', 'employee_id', 'loginId', 'login_id']);
  const passwordValue = readLoginField(source, ['password', 'pass', 'pwd', 'secret']);

  if (idValue !== null && passwordValue !== null) {
    results.push({
      userId: String(idValue),
      password: String(passwordValue)
    });
  }

  const nestedKeys = ['users', 'data', 'records', 'items', 'employees', 'accounts', 'logins', 'result'];
  nestedKeys.forEach((key) => {
    if (source[key]) {
      collectLoginEntries(source[key], results);
    }
  });

  Object.values(source).forEach((value) => {
    if (value && typeof value === 'object') {
      collectLoginEntries(value, results);
    }
  });
}

function findMatchingLogin(payload, enteredUserId, enteredPassword) {
  const normalizedUserId = normalizeLoginValue(enteredUserId);
  const normalizedPassword = normalizeLoginValue(enteredPassword);
  const entries = [];

  collectLoginEntries(payload, entries);

  return entries.some((entry) => normalizeLoginValue(entry.userId) === normalizedUserId && normalizeLoginValue(entry.password) === normalizedPassword);
}

async function validateRemoteLogin(userId, password, showFeedback = true) {
  if (!userId || !password) {
    setLoginStatus('Enter both ID and password to verify.', 'error');
    if (showFeedback) {
      showToast('Enter both ID and password to verify.', 'error');
    }
    return false;
  }

  try {
    btnVerifyLogin.disabled = true;
    const response = await fetch(REMOTE_LOGIN_URL, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error('network');
    }

    const payload = await response.json();
    const isValid = findMatchingLogin(payload, userId, password);

    if (isValid) {
      chrome.storage.local.set({
        savedLoginUserId: userId,
        savedLoginPassword: password,
        lastLoginStatus: 'success',
        lastLoginCheck: new Date().toISOString()
      });
      setLoginStatus('Login verified successfully.', 'success');
      if (showFeedback) {
        showToast('Login verified successfully', 'success');
      }
      return true;
    }

    chrome.storage.local.set({
      lastLoginStatus: 'invalid',
      lastLoginCheck: new Date().toISOString()
    });
    setLoginStatus('Login details did not match the remote data.', 'error');
    if (showFeedback) {
      showToast('Some Internal System login not working connect with DEV', 'error');
    }
    return false;
  } catch (error) {
    chrome.storage.local.set({
      lastLoginStatus: 'error',
      lastLoginCheck: new Date().toISOString()
    });
    setLoginStatus('Unable to reach the login service. Some Internal System login not working connect with DEV.', 'error');
    if (showFeedback) {
      showToast('Some Internal System login not working connect with DEV', 'error');
    }
    return false;
  } finally {
    btnVerifyLogin.disabled = false;
  }
}

function startLoginAutoCheck() {
  chrome.runtime.sendMessage({ action: 'startLoginAlarm' }).catch(() => {});
  
  chrome.storage.local.get(['savedLoginUserId', 'savedLoginPassword', 'lastLoginStatus'], (result) => {
    if (result.savedLoginUserId && loginUserId && !loginUserId.value) {
      loginUserId.value = result.savedLoginUserId;
    }
    if (result.savedLoginPassword && loginPassword && !loginPassword.value) {
      loginPassword.value = result.savedLoginPassword;
    }
    if (result.lastLoginStatus === 'success') {
      setLoginStatus('Login status: Verified & Active', 'success');
    } else if (result.lastLoginStatus === 'invalid') {
      setLoginStatus('Login details did not match remote data or password was updated.', 'error');
    }

    if (result.savedLoginUserId && result.savedLoginPassword) {
      validateRemoteLogin(result.savedLoginUserId, result.savedLoginPassword, false);
    }
  });
}

btnCancelConfirm.addEventListener('click', () => {
  confirmModal.classList.add('hidden');
  profileModal.classList.remove('hidden');
  pendingAction = null;
});

btnConfirmAction.addEventListener('click', async () => {
  if (pendingAction === 'deleteProfile' && currentEditingProfile) {
    try {
      btnConfirmAction.disabled = true;
      await profileManager.deleteProfile(currentEditingProfile.id);
      showToast('Profile deleted successfully', 'success');
      confirmModal.classList.add('hidden');
      currentEditingProfile = null;
      await renderProfiles();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      btnConfirmAction.disabled = false;
    }
  }
});

// ==================== Utility Functions ====================

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast ${type}`;

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== Initialize ====================

document.addEventListener('DOMContentLoaded', () => {
  renderProfiles();
  startLoginAutoCheck();
});
