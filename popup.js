/**
 * GSPN Data Scraper - Popup Script
 * Handles user interaction, triggers content script scraping,
 * and exports scraped data to Excel (.xls) format.
 *
 * Uses chrome.storage.session to persist data across tab switches,
 * since the multi-print page and status page are on DIFFERENT tabs.
 */

let scrapedData = null;
let scrapedColumns = null;
let statusMerged = false;

// Status columns to add during merge
const STATUS_COLUMNS = [
  'Status (GSPN)',
  'Reason (GSPN)',
  'City',
  'App Date',
  'App Time',
  'Wty Status',
  'REDO',
  'Service Type (Status)',
  'B2B'
];

// Product prefix mapping and helper
const PRODUCT_PREFIX = {
  RR: "REF",
  RT: "REF",
  RF: "REF",
  RS: "REF",
  RA: "REF",
  RB: "REF",
  WA: "WM",
  WT: "WM",
  WW: "WM",
  WD: "WM",
  WF: "WM",
  AR: "RAC",
  AC: "RAC",
  AJ: "RAC",
  AM: "RAC",
  ACN: "RAC",
  UA: "TV",
  QA: "TV",
  HG: "TV",
  PS: "TV",
  PN: "TV",
  UN: "TV",
  UE: "TV",
  GU: "TV",
  LH: "DISPLAY",
  LS: "DISPLAY",
  MC: "MWO",
  MG: "MWO",
  MS: "MWO",
  CE: "MWO",
  CM: "MWO",
  DW: "DW",
  DV: "DRYER",
  VS: "VACUUM",
  VR: "VACUUM",
  AX: "AIR PURIFIER",
  HW: "AUDIO",
  MX: "AUDIO",
  HT: "AUDIO",
  LC: "MONITOR",
  LSM: "MONITOR",
  NV: "OVEN",
  NQ: "OVEN",
  NA: "HOB",
  NZ: "HOB"
};

function getSamsungCategory(model) {
  if (!model) return "UNKNOWN";
  model = model.toUpperCase().trim();
  const prefixes = Object.keys(PRODUCT_PREFIX).sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (model.startsWith(prefix)) {
      return PRODUCT_PREFIX[prefix];
    }
  }
  return "UNKNOWN";
}

/**
 * Ensure each record has a `Product` field and the columns list contains `Product`.
 * Inserts `Product` right after `Model Name` when possible, otherwise appends.
 */
function ensureProductField(dataArray, columnsArray) {
  if (!Array.isArray(dataArray) || !Array.isArray(columnsArray)) return;

  // Add column if missing
  if (!columnsArray.includes('Product')) {
    const modelIdx = columnsArray.indexOf('Model Name');
    if (modelIdx >= 0) {
      columnsArray.splice(modelIdx + 1, 0, 'Product');
    } else {
      columnsArray.push('Product');
    }
  }

  // Populate product values
  for (const rec of dataArray) {
    const modelVal = (rec['Model Name'] || rec['Model'] || '').toString();
    rec['Product'] = getSamsungCategory(modelVal);
  }
}

function cleanColumnsAndData(data, columns) {
  if (!Array.isArray(data) || !Array.isArray(columns)) return;
  const keysToDelete = [
    'Remark',
    'ASC Job No',
    'Created By',
    'Service Branch',
    'Date',
    'CP/Dealer Ref. No',
    'Data Origin',
    'Contact Permission'
  ];
  // 1. Filter columns list
  for (let i = columns.length - 1; i >= 0; i--) {
    if (keysToDelete.includes(columns[i])) {
      columns.splice(i, 1);
    }
  }
  // 2. Delete properties from each record
  for (const rec of data) {
    for (const key of keysToDelete) {
      delete rec[key];
    }
  }
}

// Universal Clipboard Copy helper (supports iframe embedded context & fallbacks)
async function copyToClipboard(text, html) {
  try {
    if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
      const items = {
        'text/html': new Blob([html], { type: 'text/html' })
      };
      if (text) {
        items['text/plain'] = new Blob([text], { type: 'text/plain' });
      }
      await navigator.clipboard.write([new ClipboardItem(items)]);
      return true;
    } else if (text && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    console.warn('navigator.clipboard API write failed, attempting document.execCommand fallback:', e);
  }

  try {
    const onCopy = (e) => {
      e.stopImmediatePropagation();
      e.preventDefault();
      if (html) {
        e.clipboardData.setData('text/html', html);
      }
      if (text) {
        e.clipboardData.setData('text/plain', text);
      }
    };
    document.addEventListener('copy', onCopy, { capture: true, once: true });

    const container = document.createElement('div');
    container.contentEditable = 'true';
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    if (html) {
      container.innerHTML = html;
    } else {
      container.innerText = text || '';
    }
    document.body.appendChild(container);

    const range = document.createRange();
    range.selectNodeContents(container);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    container.focus();

    const success = document.execCommand('copy');
    selection.removeAllRanges();
    document.body.removeChild(container);

    if (success) return true;
  } catch (err) {
    console.warn('execCommand copy failed:', err);
  }

  throw new Error('Clipboard copy not permitted in current browser context.');
}

// Parse short date and compute aging
function parseShortDateFromAscAssigned(value) {
  if (!value) return null;
  const str = value.toString().trim();
  if (str.includes('00.00.0000') || str.includes('00/00/0000') || str.includes('00-00-0000')) {
    return null;
  }
  // Support common date patterns: dd/mm/yyyy, dd.mm.yyyy, yyyy-mm-dd, yyyy.mm.dd, dd-mm-yyyy
  const dateMatch = str.match(/(\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4})/);
  if (!dateMatch) return null;
  const d = dateMatch[1];
  let parts;
  if (d.includes('-')) parts = d.split('-');
  else if (d.includes('.')) parts = d.split('.');
  else if (d.includes('/')) parts = d.split('/');
  else return null;

  if (parts.length !== 3) return null;

  if (parts[0].length === 4) {
    // yyyy-mm-dd or yyyy.mm.dd
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    return new Date(y, m - 1, day);
  } else if (parts[2] && parts[2].length === 4) {
    // dd/mm/yyyy or dd.mm.yyyy or dd-mm-yyyy
    const day = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    return new Date(y, m - 1, day);
  }

  return null;
}

function formatDateDDMMYYYY(dateObj) {
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return '';
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function ensureAscAssignedShortAndAging(dataArray, columnsArray) {
  if (!Array.isArray(dataArray) || !Array.isArray(columnsArray)) return;

  // Ensure Short ASC Assigned Date column exists
  if (!columnsArray.includes('Short ASC Assigned Date')) {
    const ascIdx = columnsArray.indexOf('ASC Assigned');
    if (ascIdx >= 0) {
      columnsArray.splice(ascIdx + 1, 0, 'Short ASC Assigned Date');
    } else {
      columnsArray.push('Short ASC Assigned Date');
    }
  }

  // Ensure Aging column exists after Short ASC Assigned Date
  if (!columnsArray.includes('Aging')) {
    const shortIdx = columnsArray.indexOf('Short ASC Assigned Date');
    if (shortIdx >= 0) {
      columnsArray.splice(shortIdx + 1, 0, 'Aging');
    } else {
      columnsArray.push('Aging');
    }
  }

  const today = new Date();
  // normalize to midnight
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  for (const rec of dataArray) {
    const raw = rec['ASC Assigned'] || rec['ASC_Assigned'] || rec['ASCAssigned'] ||
                rec['Appointment Date'] || rec['Customer Preferred Date'] || rec['Purchase Date'] ||
                rec['Call Received'] || rec['1st Visit'] || rec['Repair Completed'] || rec['Job Information(Date)'] || '';
    const parsed = parseShortDateFromAscAssigned(raw);
    if (parsed && !isNaN(parsed.getTime())) {
      rec['Short ASC Assigned Date'] = formatDateDDMMYYYY(parsed);
      const parsedMid = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      const diffMs = todayMid - parsedMid;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      rec['Aging'] = diffDays;
    } else {
      rec['Short ASC Assigned Date'] = '';
      rec['Aging'] = '';
    }
  }
}

// DOM Elements
const btnScrape = document.getElementById('btnScrape');
const btnViewModeScrape = document.getElementById('btnViewModeScrape');
const btnAppendScrape = document.getElementById('btnAppendScrape');
const btnExport = document.getElementById('btnExport');
const btnCopy = document.getElementById('btnCopy');
const statusBar = document.getElementById('statusBar');
const statusText = document.getElementById('statusText');
const statsSection = document.getElementById('statsSection');
const ticketCount = document.getElementById('ticketCount');
const fieldCount = document.getElementById('fieldCount');
const previewSection = document.getElementById('previewSection');
const previewHead = document.getElementById('previewHead');
const previewBody = document.getElementById('previewBody');
const previewInfo = document.getElementById('previewInfo');
const errorSection = document.getElementById('errorSection');
const errorText = document.getElementById('errorText');

// Status merge elements
const statusSection = document.getElementById('statusSection');
const btnAddStatus = document.getElementById('btnAddStatus');
const statusMergeHint = document.getElementById('statusMergeHint');
const mergeResult = document.getElementById('mergeResult');
const mergeResultIcon = document.getElementById('mergeResultIcon');
const mergeResultText = document.getElementById('mergeResultText');

// New 1-1-1 Scraper UI Elements
const autoAddToggle = document.getElementById('auto-add-toggle');
const txtViewModePasteIds = document.getElementById('txtViewModePasteIds');
const btnAutoScrape111 = document.getElementById('btnAutoScrape111');
const btnCopyExcel111 = document.getElementById('btnCopyExcel111');
const btnExcelDownload111 = document.getElementById('btnExcelDownload111');
const statusBar111 = document.getElementById('statusBar111');
const statusText111 = document.getElementById('statusText111');
const progressBar111 = document.getElementById('progressBar111');
const tableBody111 = document.getElementById('tableBody111');
const recordsCount111 = document.getElementById('recordsCount111');

// Module Checkboxes (Others, 1-1-1, Health Check Dialog)
const btnCloserSettings = document.getElementById('btnCloserSettings');
const chkCloserHelper = document.getElementById('chkCloserHelper');
const chkCloserStatus = document.getElementById('chkCloserStatus');
const chk111Scraper = document.getElementById('chk111Scraper');
const chk111Status = document.getElementById('chk111Status');
const chkHealthCheck = document.getElementById('chkHealthCheck');
const chkHealthStatus = document.getElementById('chkHealthStatus');
const chkGhostMode = document.getElementById('chkGhostMode');
const chkGhostStatus = document.getElementById('chkGhostStatus');
const chkHideHealthBtn = document.getElementById('chkHideHealthBtn');
const chkHideHealthStatus = document.getElementById('chkHideHealthStatus');
const chkHide111Btn = document.getElementById('chkHide111Btn');
const chkHide111Status = document.getElementById('chkHide111Status');
const chkOpenInNewTab = document.getElementById('chkOpenInNewTab');
const closerCard = document.querySelector('.closer-helper-card');
const btnCopyPreset = document.getElementById('btnCopyPreset');

// Profile button
const btnProfiles = document.getElementById('btnProfiles');
const btnToggleLogs = document.getElementById('btnToggleLogs');
const loginGate = document.getElementById('loginGate');
const popupMainContent = document.getElementById('popupMainContent');
const popupLoginForm = document.getElementById('popupLoginForm');
const popupLoginUserId = document.getElementById('popupLoginUserId');
const popupLoginPassword = document.getElementById('popupLoginPassword');
const btnTogglePasswordVis = document.getElementById('btnTogglePasswordVis');
const iconTogglePassword = document.getElementById('iconTogglePassword');
const btnPopupLogin = document.getElementById('btnPopupLogin');
const popupLoginStatus = document.getElementById('popupLoginStatus');
const btnClearLogs = document.getElementById('btnClearLogs');
const logsPanel = document.getElementById('logsPanel');
const logsList = document.getElementById('logsList');
const tabButtons = document.querySelectorAll('.tab-item');
const tabPanes = document.querySelectorAll('.tab-pane');

function formatLogValue(value) {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function setupPopupLogBridge() {
  ['log', 'info', 'warn', 'error', 'debug'].forEach((method) => {
    const original = console[method];
    console[method] = (...args) => {
      const message = args.map(formatLogValue).join(' ');
      if (message) {
        chrome.runtime.sendMessage({
          action: 'extensionLog',
          entry: {
            source: 'popup',
            level: method,
            message,
            timestamp: new Date().toISOString()
          }
        }).catch(() => { });
      }
      if (original) {
        original.apply(console, args);
      }
    };
  });
}

setupPopupLogBridge();

async function loadLogs() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getExtensionLogs' });
    const logs = Array.isArray(response?.logs) ? response.logs : [];
    renderLogs(logs);
  } catch (error) {
    console.warn('Failed to load logs:', error);
    renderLogs([]);
  }
}

function renderLogs(logs) {
  if (!logsList) return;
  if (!logs || logs.length === 0) {
    logsList.innerHTML = '<div class="log-empty">No extension logs captured yet.</div>';
    return;
  }

  const html = logs.slice().reverse().map((entry) => {
    const levelClass = `log-${(entry.level || 'log').toLowerCase()}`;
    const ts = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Unknown time';
    return `
      <div class="log-entry ${levelClass}">
        <div class="log-meta">
          <span>${escapeHtml(entry.source || 'unknown')}</span>
          <span>${escapeHtml(ts)}</span>
        </div>
        <div class="log-message">${escapeHtml(entry.message || '')}</div>
      </div>`;
  }).join('');

  logsList.innerHTML = html;
}

async function clearLogs() {
  try {
    await chrome.runtime.sendMessage({ action: 'clearExtensionLogs' });
    renderLogs([]);
  } catch (error) {
    console.warn('Failed to clear logs:', error);
  }
}

if (btnToggleLogs) {
  btnToggleLogs.addEventListener('click', () => {
    if (!logsPanel) return;
    const willShow = logsPanel.classList.contains('hidden');
    logsPanel.classList.toggle('hidden', !willShow);
    if (willShow) {
      loadLogs();
    }
  });
}

if (btnClearLogs) {
  btnClearLogs.addEventListener('click', () => {
    clearLogs();
  });
}

function setupTabNavigation() {
  if (!tabButtons.length || !tabPanes.length) return;

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.dataset.target;
      if (!targetId) return;

      tabButtons.forEach((btn) => btn.classList.toggle('active', btn === button));
      tabPanes.forEach((pane) => {
        pane.classList.toggle('hidden', pane.id !== targetId);
      });

      if (targetId === 'pane-others') {
        if (logsPanel) {
          logsPanel.classList.remove('hidden');
        }
        loadLogs();
      }
    });
  });
}

loadLogs();
setupTabNavigation();

// =====================================================
// Profile Manager Integration
// =====================================================

/**
 * Load profile settings on popup open
 */
function updateCloserUI(enabled) {
  if (chkCloserHelper) chkCloserHelper.checked = enabled;
  if (chkCloserStatus) {
    chkCloserStatus.textContent = enabled
      ? 'Enabled — floating panel active on GSPN page'
      : 'Disabled — toggle to enable on GSPN page';
    chkCloserStatus.classList.toggle('active', enabled);
  }
  if (closerCard) {
    closerCard.classList.toggle('enabled', enabled);
  }
}

function update111UI(enabled) {
  if (chk111Scraper) chk111Scraper.checked = enabled;
  if (autoAddToggle) autoAddToggle.checked = enabled;
  if (chk111Status) {
    chk111Status.textContent = enabled
      ? 'Enabled — auto-add manual tickets on GSPN'
      : 'Disabled — toggle auto-add tickets';
    chk111Status.classList.toggle('active', enabled);
  }
}

function updateHealthUI(enabled) {
  if (chkHealthCheck) chkHealthCheck.checked = enabled;
  if (chkHealthStatus) {
    chkHealthStatus.textContent = enabled
      ? 'Enabled — Complaint Health popup dialog active on GSPN'
      : 'Disabled — toggle to enable dialog';
    chkHealthStatus.classList.toggle('active', enabled);
  }
}

function updateGhostUI(enabled) {
  if (chkGhostMode) chkGhostMode.checked = enabled;
  if (chkGhostStatus) {
    chkGhostStatus.textContent = enabled
      ? 'On — ALL floating buttons & functions disabled'
      : 'Off — floating buttons active';
    chkGhostStatus.classList.toggle('active', enabled);
  }
}

function updateHideHealthUI(enabled) {
  if (chkHideHealthBtn) chkHideHealthBtn.checked = enabled;
  if (chkHideHealthStatus) {
    chkHideHealthStatus.textContent = enabled
      ? 'On — Health button hidden on GSPN'
      : 'Off — Health button visible on GSPN';
    chkHideHealthStatus.classList.toggle('active', enabled);
  }
}

function updateHide111UI(enabled) {
  if (chkHide111Btn) chkHide111Btn.checked = enabled;
  if (chkHide111Status) {
    chkHide111Status.textContent = enabled
      ? 'On — Add 1-1-1 button hidden on GSPN'
      : 'Off — Add 1-1-1 button visible on GSPN';
    chkHide111Status.classList.toggle('active', enabled);
  }
}

/**
 * Load profile settings and module toggle states on popup open
 */
async function loadProfileSettings() {
  try {
    const currentProfile = await profileManager.getCurrentProfile();
    if (currentProfile) {
      // Apply settings from profile
      const enabled = currentProfile.settings.closerHelperEnabled !== false;
      updateCloserUI(enabled);
    } else {
      // No active profile, load from chrome.storage.local (legacy support)
      chrome.storage.local.get(['closerHelperEnabled', 'openRequestsInNewTab'], (data) => {
        const enabled = data.closerHelperEnabled !== false;
        if (chkOpenInNewTab) chkOpenInNewTab.checked = !!data.openRequestsInNewTab;
        updateCloserUI(enabled);
      });
    }
  } catch (error) {
    console.warn('Failed to load profile settings:', error);
  }

  // Load 1-1-1, Health Check Dialog, Ghost Mode, and Hide floating button states
  chrome.storage.local.get([
    'autoAddManualTicketsEnabled',
    'complaintHealthEnabled',
    'ghostModeEnabled',
    'hideHealthBtn',
    'hide111Btn'
  ], (data) => {
    const autoAddEnabled = !!data.autoAddManualTicketsEnabled;
    const healthEnabled = data.complaintHealthEnabled !== false;
    const ghostEnabled = !!data.ghostModeEnabled;
    const hideHealthEnabled = !!data.hideHealthBtn;
    const hide111Enabled = !!data.hide111Btn;
    update111UI(autoAddEnabled);
    updateHealthUI(healthEnabled);
    updateGhostUI(ghostEnabled);
    updateHideHealthUI(hideHealthEnabled);
    updateHide111UI(hide111Enabled);
  });
}

// Load profile settings on popup open
updateLoginGateVisibility();
loadProfileSettings();

// Toggle 1: Others (Closer Helper)
if (chkCloserHelper) {
  chkCloserHelper.addEventListener('change', () => {
    const enabled = chkCloserHelper.checked;
    chrome.storage.local.set({ closerHelperEnabled: enabled });
    updateCloserUI(enabled);

    // Also update current profile if one is active
    chrome.storage.local.get('currentProfile', (data) => {
      if (data.currentProfile) {
        profileManager.updateProfile(data.currentProfile.id, {
          settings: { closerHelperEnabled: enabled }
        }).catch(err => console.warn('Failed to update profile:', err));
      }
    });
  });
}

// Toggle 2: 1-1-1 Scraper
if (chk111Scraper) {
  chk111Scraper.addEventListener('change', () => {
    const enabled = chk111Scraper.checked;
    chrome.storage.local.set({ autoAddManualTicketsEnabled: enabled });
    update111UI(enabled);
  });
}

if (autoAddToggle) {
  autoAddToggle.addEventListener('change', () => {
    const enabled = autoAddToggle.checked;
    chrome.storage.local.set({ autoAddManualTicketsEnabled: enabled });
    update111UI(enabled);
  });
}

// Toggle 3: Health Check Dialog
if (chkHealthCheck) {
  chkHealthCheck.addEventListener('change', () => {
    const enabled = chkHealthCheck.checked;
    chrome.storage.local.set({ complaintHealthEnabled: enabled });
    updateHealthUI(enabled);
  });
}

// Toggle 4: Ghost Mode (Disable All Floating Features)
if (chkGhostMode) {
  chkGhostMode.addEventListener('change', () => {
    const enabled = chkGhostMode.checked;
    chrome.storage.local.set({ ghostModeEnabled: enabled });
    updateGhostUI(enabled);
  });
}

// Toggle 5: Hide Health Floating Button
if (chkHideHealthBtn) {
  chkHideHealthBtn.addEventListener('change', () => {
    const enabled = chkHideHealthBtn.checked;
    chrome.storage.local.set({ hideHealthBtn: enabled });
    updateHideHealthUI(enabled);
  });
}

// Toggle 6: Hide "Add 1-1-1 Data" Button
if (chkHide111Btn) {
  chkHide111Btn.addEventListener('change', () => {
    const enabled = chkHide111Btn.checked;
    chrome.storage.local.set({ hide111Btn: enabled });
    updateHide111UI(enabled);
  });
}

if (chkOpenInNewTab) {
  chkOpenInNewTab.addEventListener('change', () => {
    chrome.storage.local.set({ openRequestsInNewTab: chkOpenInNewTab.checked });
  });
}

// Open settings page
if (btnCloserSettings) {
  btnCloserSettings.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('closer_helper_settings.html') });
  });
}

// Copy Preset button
if (btnCopyPreset) {
  btnCopyPreset.addEventListener('click', async () => {
    hideError();
    setStatus('loading', 'Fetching opened request details...');
    btnCopyPreset.classList.add('loading');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        throw new Error('No active tab found.');
      }

      // Allow GSPN portal and local testing pages
      const isGspnUrl = tab.url && tab.url.includes('biz2.samsungcsportal.com');
      const isLocalManagementLite = tab.url && (
        tab.url.includes('so_view_information_by_mangement_lite') ||
        tab.url.includes('call_info_viewing_mode') ||
        tab.url.includes('manegement_lite')
      );

      if (!tab.url || (!isGspnUrl && !isLocalManagementLite)) {
        throw new Error('Please navigate to an active Service Order page.');
      }

      // Inject viewModeContent.js if not already done
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ['viewModeContent.js']
        });
      } catch (e) {
        console.warn('Failed to inject viewModeContent.js:', e);
      }

      // Request view-mode data from the active tab
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeViewMode' });

      if (!response) {
        throw new Error('No response from page. Make sure the Service Order detail is open and visible.');
      }

      if (!response.success) {
        throw new Error(response.error || 'Failed to scrape service order.');
      }

      const ticket = response.data && response.data[0];
      if (!ticket) {
        throw new Error('No ticket details found on the page.');
      }

      // Determine Samsung Category from Model Name
      const modelName = ticket['Model Name'] || '';
      const category = getSamsungCategory(modelName) || 'LED';
      const isAcProduct = category === 'RAC' || category === 'AC' || category === 'AIR PURIFIER';

      // Determine if it is an installation service order
      const serviceType = (ticket['Service Type'] || '').toLowerCase();
      const customerSymptom = (ticket['Customer Symptom'] || '').toLowerCase();
      const isInstallation = serviceType.includes('install') || customerSymptom.includes('install');

      // Setup fallbacks/scraped values
      const scrapedStatusComment = ticket['1st Service Comment'] || ticket['Status Comment'] || '';
      const scrapedRemark = ticket['Remark'] || '';
      const scrapedDefectDesc = ticket['Customer Symptom'] || ticket['Symptom 1'] || '';
      const scrapedRepairDesc = ticket['1st Service Comment'] || ticket['Status Comment'] || '';

      // Merge values: Page Fields (directly scraped from elements) > Scraped Ticket (table parsing) > Fallback defaults
      const pageFields = response.fields || {};

      const statusCommentVal = pageFields.STATUS_COMMENT || scrapedStatusComment || (isInstallation ? "demo installation done set ok" : "completed");
      const remarkVal = pageFields.REMARK || scrapedRemark || statusCommentVal;
      const defectDescVal = pageFields.DEFECTDESC_L || scrapedDefectDesc || (isInstallation ? "demo installation done set ok" : "request");
      const repairDescVal = pageFields.REPAIRDESC_L || scrapedRepairDesc || (isInstallation ? "done by" : "done");

      const labTypeVal = pageFields.LAB_TYPE || (isInstallation ? 'FL' : 'FL');
      const defBlkVal = pageFields.DEF_BLK || (isInstallation ? '9999' : '9999');
      const irisCondiVal = pageFields.IRIS_CONDI || (isInstallation ? '4' : '1');
      const irisSymptQcodeVal = pageFields.IRIS_SYMPT_QCODE || (isInstallation ? 'SRC004' : 'SRC047');
      const irisSymptVal = pageFields.IRIS_SYMPT || (isInstallation ? 'AX8' : 'AX8');
      const irisDefectVal = pageFields.IRIS_DEFECT || (isInstallation ? 'R' : 'A');
      const irisRepairQcodeVal = pageFields.IRIS_REPAIR_QCODE || (isInstallation ? 'SRC004' : 'SRC004');
      const irisRepairVal = pageFields.IRIS_REPAIR || (isInstallation ? 'E01' : 'E01');
      const reasonVal = pageFields.REASON || (isInstallation ? 'HLZ23' : 'HLZ23');

      // Map GSPN input element IDs to values from scraped ticket/fields
      const fields = {
        STATUS_COMMENT: statusCommentVal,
        REMARK: remarkVal,
        DEFECTDESC_L: defectDescVal,
        REPAIRDESC_L: repairDescVal,
        EDITEXT: pageFields.EDITEXT || repairDescVal,
        LAB_TYPE: labTypeVal,
        DEF_BLK: defBlkVal,
        IRIS_CONDI: irisCondiVal,
        IRIS_SYMPT_QCODE: irisSymptQcodeVal,
        IRIS_SYMPT: irisSymptVal,
        IRIS_DEFECT: irisDefectVal,
        IRIS_REPAIR_QCODE: irisRepairQcodeVal,
        IRIS_REPAIR: irisRepairVal,
        REASON: reasonVal,
        REPAIR_DESC: pageFields.REPAIR_DESC || repairDescVal,
        DEFECT_DESC: pageFields.DEFECT_DESC || defectDescVal
      };

      // Construct Closer Preset JSON object (matching Closer Helper format)
      const requestId = ticket['Service Order No'] || ticket['SO'] || 'request';
      const presetData = {
        id: Date.now().toString(),
        name: isInstallation ? `${category} installation` : `${category} repair`,
        team: isInstallation ? (isAcProduct ? 'Installation-AC' : 'Installation-HA') : (isAcProduct ? 'AC' : 'InHome'),
        product: category,
        workType: isInstallation ? 'installation' : 'repair',
        fields: fields,
        repairDetailDesc: fields.REPAIRDESC_L,
        defectDetailDesc: fields.DEFECTDESC_L,
        statusComment: fields.STATUS_COMMENT,
        remark: fields.REMARK,
        editText: fields.EDITEXT,
        conditionCode: fields.IRIS_CONDI,
        defectType: fields.LAB_TYPE,
        defectBlock: fields.DEF_BLK,
        reasonCode: fields.REASON,
        defectCode: fields.IRIS_DEFECT,
        symptomQCode: fields.IRIS_SYMPT_QCODE,
        symptomCode: fields.IRIS_SYMPT,
        repairQCode: fields.IRIS_REPAIR_QCODE,
        repairCode: fields.IRIS_REPAIR,
        fieldMap: {
          repairDetail: 'REPAIRDESC_L',
          defectDetail: 'DEFECTDESC_L',
          statusComment: 'STATUS_COMMENT',
          remark: 'REMARK',
          editText: 'EDITEXT',
          symptom: 'IRIS_SYMPT',
          defectBlock: 'DEF_BLK',
          repairCode: 'IRIS_REPAIR',
          condition: 'IRIS_CONDI',
          defectType: 'LAB_TYPE',
          defectCode: 'IRIS_DEFECT'
        },
        rawTicketData: ticket // Include raw scraped ticket data
      };

      // Format preset as a JSON string
      const jsonStr = JSON.stringify(presetData, null, 2);

      // 1. Copy JSON string to clipboard
      await copyToClipboard(jsonStr, null);

      // 2. Download as [Service Order No].json
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${requestId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus('success', `Copied and downloaded request ${requestId} Preset JSON ✓`);
    } catch (error) {
      setStatus('error', 'Failed to copy request');
      showError(error.message || 'An unknown error occurred.');
    } finally {
      btnCopyPreset.classList.remove('loading');
    }
  });
}

// =====================================================
// MAIN POPUP LOGIN SYSTEM & REMOTE VERIFICATION
// =====================================================

const REMOTE_LOGIN_URL = 'https://raw.githubusercontent.com/chirag-deshwal/gspn-helper/refs/heads/main/risk_zone/api_data.json';

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

function setPopupLoginStatus(message, type = 'info') {
  if (!popupLoginStatus) return;
  popupLoginStatus.textContent = message;
  popupLoginStatus.className = `login-status-box ${type}`;
  popupLoginStatus.classList.remove('hidden');
  popupLoginStatus.style.display = 'block';
}

// Toggle password visibility
const iconEyeOpen = document.getElementById('iconEyeOpen');
const iconEyeClosed = document.getElementById('iconEyeClosed');

if (btnTogglePasswordVis && popupLoginPassword) {
  btnTogglePasswordVis.addEventListener('click', () => {
    const isPassword = popupLoginPassword.type === 'password';
    popupLoginPassword.type = isPassword ? 'text' : 'password';
    if (iconEyeOpen && iconEyeClosed) {
      iconEyeOpen.style.display = isPassword ? 'none' : 'block';
      iconEyeClosed.style.display = isPassword ? 'block' : 'none';
    }
  });
}

// Handle Form Submit
if (popupLoginForm) {
  popupLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = popupLoginUserId ? popupLoginUserId.value.trim() : '';
    const password = popupLoginPassword ? popupLoginPassword.value.trim() : '';

    if (!userId || !password) {
      setPopupLoginStatus('Enter both User ID and Password to sign in.', 'error');
      return;
    }

    try {
      if (btnPopupLogin) {
        btnPopupLogin.disabled = true;
        btnPopupLogin.classList.add('opacity-70', 'cursor-not-allowed');
      }
      setPopupLoginStatus('Verifying credentials with system API...', 'info');

      const response = await fetch(REMOTE_LOGIN_URL, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Network error connecting to verification service.');
      }

      const payload = await response.json();
      const isValid = findMatchingLogin(payload, userId, password);

      if (isValid) {
        setPopupLoginStatus('Login verified successfully! Unlocking...', 'success');
        chrome.storage.local.set({
          savedLoginUserId: userId,
          savedLoginPassword: password,
          lastLoginStatus: 'success',
          lastLoginCheck: new Date().toISOString()
        }, () => {
          chrome.runtime.sendMessage({ action: 'startLoginAlarm' }).catch(() => { });
          updateLoginGateVisibility();
        });
      } else {
        // Wrong password / credentials
        setPopupLoginStatus('Invalid User ID or Password. Check your credentials.', 'error');
      }
    } catch (error) {
      setPopupLoginStatus('Unable to reach login service. Please check internet connection.', 'error');
    } finally {
      if (btnPopupLogin) {
        btnPopupLogin.disabled = false;
        btnPopupLogin.classList.remove('opacity-70', 'cursor-not-allowed');
      }
    }
  });
}

function updateLoginGateVisibility() {
  chrome.storage.local.get(['savedLoginUserId', 'savedLoginPassword', 'lastLoginStatus'], (data) => {
    const isLoggedIn = !!data.savedLoginUserId && !!data.savedLoginPassword && data.lastLoginStatus === 'success';

    if (loginGate) {
      if (isLoggedIn) {
        loginGate.classList.add('hidden');
        loginGate.style.display = 'none';
      } else {
        loginGate.classList.remove('hidden');
        loginGate.style.display = 'flex';
      }
    }
    if (popupMainContent) {
      if (isLoggedIn) {
        popupMainContent.classList.remove('hidden');
        popupMainContent.style.display = 'flex';
      } else {
        popupMainContent.classList.add('hidden');
        popupMainContent.style.display = 'none';
      }
    }

    if (isLoggedIn) {
      loadProfileSettings();
      restoreSession();
    } else {
      // Auto pre-fill saved User ID if user was previously logged in
      if (data.savedLoginUserId && popupLoginUserId && !popupLoginUserId.value) {
        popupLoginUserId.value = data.savedLoginUserId;
      }
      if (data.lastLoginStatus === 'invalid' && popupLoginStatus && popupLoginStatus.classList.contains('hidden')) {
        setPopupLoginStatus('Password updated or session expired. Please log in with new password.', 'error');
      }
    }
  });
}

// Open profiles manager
if (btnProfiles) {
  btnProfiles.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('profiles.html') });
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && (changes.savedLoginUserId || changes.savedLoginPassword || changes.lastLoginStatus)) {
    updateLoginGateVisibility();
  }
});

// Listen for profile application messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'profileApplied') {
    // Reload settings from the applied profile
    loadProfileSettings();
  }
});

// =====================================================
// SESSION STORAGE — persist data across tab switches
// =====================================================

/**
 * Save current state to chrome.storage.session.
 * Called after scraping and after merging status.
 */
async function saveSession() {
  try {
    cleanColumnsAndData(scrapedData, scrapedColumns);
    await chrome.storage.session.set({
      gspn_scrapedData: scrapedData,
      gspn_scrapedColumns: scrapedColumns,
      gspn_statusMerged: statusMerged
    });
  } catch (e) {
    console.warn('Failed to save session:', e);
  }
}

/**
 * Restore state from chrome.storage.session on popup open.
 * This is critical when user switches from multi-print tab to status tab.
 */
async function restoreSession() {
  try {
    const stored = await chrome.storage.session.get([
      'gspn_scrapedData',
      'gspn_scrapedColumns',
      'gspn_statusMerged'
    ]);

    if (stored.gspn_scrapedData && stored.gspn_scrapedData.length > 0) {
      scrapedData = stored.gspn_scrapedData;
      scrapedColumns = stored.gspn_scrapedColumns;
      cleanColumnsAndData(scrapedData, scrapedColumns);
      // Ensure Product column/value exists for restored data
      ensureProductField(scrapedData, scrapedColumns);
      // Ensure Short ASC Assigned Date and Aging are present
      ensureAscAssignedShortAndAging(scrapedData, scrapedColumns);
      statusMerged = stored.gspn_statusMerged || false;

      // Restore UI state
      ticketCount.textContent = scrapedData.length;
      fieldCount.textContent = scrapedColumns.length;
      statsSection.classList.remove('hidden');
      updateActionButtonsState();
      statusSection.classList.remove('hidden');

      // Build preview
      buildPreview(scrapedData, scrapedColumns);
      previewSection.classList.remove('hidden');

      if (statusMerged) {
        setStatus('success', `${scrapedData.length} ticket(s) with status data — ready to export`);
        statusMergeHint.textContent = '✓ Status already merged — you can export or re-merge';
        // Show a green merge result
        mergeResult.classList.remove('hidden', 'merge-error', 'merge-partial');
        mergeResult.classList.add('merge-success');
        mergeResultIcon.textContent = '✓';
        mergeResultText.textContent = 'Status data merged — switch tabs freely';
      } else {
        setStatus('success', `${scrapedData.length} ticket(s) loaded — navigate to status page to add status`);
      }
    }
  } catch (e) {
    console.warn('Failed to restore session:', e);
  }
}

/**
 * Clear persisted session data
 */
async function clearSession() {
  try {
    await chrome.storage.session.remove([
      'gspn_scrapedData',
      'gspn_scrapedColumns',
      'gspn_statusMerged'
    ]);
  } catch (e) {
    console.warn('Failed to clear session:', e);
  }
}

updateActionButtonsState();

// Restore session on popup open
restoreSession();

// ---- Action State Helpers ----
function updateActionButtonsState() {
  const hasData = !!scrapedData && scrapedData.length > 0;
  if (btnExport) btnExport.disabled = !hasData;
  if (btnCopy) btnCopy.disabled = !hasData;
  if (btnAppendScrape) btnAppendScrape.disabled = !hasData;

  if (btnCopyExcel111) btnCopyExcel111.disabled = !hasData;
  if (btnExcelDownload111) btnExcelDownload111.disabled = !hasData;
}

function getTicketIdentity(ticket) {
  const serviceOrderNo = (ticket?.['Service Order No'] || ticket?.['SO'] || '').toString().trim();
  const customerName = (ticket?.['Customer Name'] || ticket?.['CX Name'] || '').toString().trim();

  if (serviceOrderNo) {
    return `so:${serviceOrderNo.toLowerCase()}`;
  }

  if (customerName) {
    return `name:${customerName.toLowerCase()}`;
  }

  return null;
}

function mergeScrapedData(existingData, incomingData) {
  const merged = Array.isArray(existingData) ? [...existingData] : [];
  const seen = new Set();

  for (const ticket of merged) {
    const identity = getTicketIdentity(ticket);
    if (identity) {
      seen.add(identity);
    }
  }

  for (const ticket of Array.isArray(incomingData) ? incomingData : []) {
    const identity = getTicketIdentity(ticket);
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    merged.push(ticket);
  }

  return merged;
}

function mergeScrapedColumns(existingColumns, incomingColumns) {
  const merged = Array.isArray(existingColumns) ? [...existingColumns] : [];

  for (const column of Array.isArray(incomingColumns) ? incomingColumns : []) {
    if (!merged.includes(column)) {
      merged.push(column);
    }
  }

  return merged;
}

// ---- Status Helpers ----
function setStatus(type, message) {
  statusBar.className = `status-bar status-${type}`;
  statusText.textContent = message;
}

function showError(msg) {
  errorSection.classList.remove('hidden');
  errorText.textContent = msg;
}

function hideError() {
  errorSection.classList.add('hidden');
}

// ---- Scrape Handler ----
btnScrape.addEventListener('click', async () => {
  hideError();
  statsSection.classList.add('hidden');
  previewSection.classList.add('hidden');
  statusSection.classList.add('hidden');
  mergeResult.classList.add('hidden');
  btnScrape.classList.add('loading');
  setStatus('loading', 'Scraping data...');

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      throw new Error('No active tab found.');
    }

    // Check URL
    const isAllowedTabUrl = tab.url && (
      tab.url.includes('biz2.samsungcsportal.com') ||
      tab.url.includes('so_view_information_by_mangement_lite') ||
      tab.url.includes('call_info_viewing_mode') ||
      tab.url.startsWith('file://')
    );
    if (!isAllowedTabUrl) {
      throw new Error('Please navigate to the GSPN portal (biz2.samsungcsportal.com) first.');
    }

    // Inject content script if not already loaded (in case page was loaded before extension)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content.js']
      });
    } catch (e) {
      // Script may already be injected, continue
    }

    // Send message to content script
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeData' });

    if (!response) {
      throw new Error('No response from page. Please reload the GSPN page and try again.');
    }

    if (!response.success) {
      throw new Error(response.error || 'Failed to scrape data.');
    }

    if (response.count === 0) {
      throw new Error('No service tickets found on this page. Make sure you are on the multi-print page.');
    }

    // Store data
    scrapedData = response.data;
    scrapedColumns = response.columns;
    statusMerged = false;
    // Populate Product column/value based on Model Name
    ensureProductField(scrapedData, scrapedColumns);
    // Populate Short ASC Assigned Date and Aging
    ensureAscAssignedShortAndAging(scrapedData, scrapedColumns);

    // Save to session storage (persists across tab switches!)
    await saveSession();

    // Update UI
    setStatus('success', `Successfully scraped ${response.count} ticket(s)`);
    ticketCount.textContent = response.count;
    fieldCount.textContent = scrapedColumns.length;
    statsSection.classList.remove('hidden');
    updateActionButtonsState();

    // Show the status merge section
    statusSection.classList.remove('hidden');
    statusMergeHint.textContent = 'Navigate to Service Order Management Light page, then click below';

    // Build preview (show first 5 tickets, limited columns)
    buildPreview(scrapedData, scrapedColumns);
    previewSection.classList.remove('hidden');

  } catch (error) {
    setStatus('error', 'Scrape failed');
    showError(error.message || 'An unknown error occurred.');
  } finally {
    btnScrape.classList.remove('loading');
  }
});

if (btnViewModeScrape) {
  btnViewModeScrape.addEventListener('click', async () => {
    hideError();
    statsSection.classList.add('hidden');
    previewSection.classList.add('hidden');
    statusSection.classList.add('hidden');
    mergeResult.classList.add('hidden');
    btnViewModeScrape.classList.add('loading');
    setStatus('loading', 'Scraping view-mode labels...');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        throw new Error('No active tab found.');
      }

      // Allow both biz2.samsungcsportal.com and local saved HTML files for testing
      const isGspnUrl = tab.url && tab.url.includes('biz2.samsungcsportal.com');
      const isLocalManagementLite = tab.url && (
        tab.url.includes('so_view_information_by_mangement_lite')
        || tab.url.includes('call_info_viewing_mode')
        || tab.url.includes('manegement_lite')
      );

      if (!tab.url || (!isGspnUrl && !isLocalManagementLite)) {
        throw new Error('Please navigate to the GSPN portal or open the Service Order detail / Management Lite page first.');
      }

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ['viewModeContent.js']
        });
      } catch (e) {
        console.warn('Failed to inject viewModeContent.js:', e);
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeViewMode' });

      if (!response) {
        throw new Error('No response from page. Please reload the page and try again.');
      }

      if (!response.success) {
        throw new Error(response.error || 'Failed to scrape view-mode data.');
      }

      if (response.count === 0) {
        throw new Error('No view-mode ticket data found on this page.');
      }

      scrapedData = response.data;
      scrapedColumns = response.columns;
      statusMerged = false;
      // Populate Product column/value based on Model Name
      ensureProductField(scrapedData, scrapedColumns);
      // Populate Short ASC Assigned Date and Aging
      ensureAscAssignedShortAndAging(scrapedData, scrapedColumns);

      await saveSession();

      setStatus('success', `Successfully scraped ${response.count} view-mode ticket(s)`);
      ticketCount.textContent = response.count;
      fieldCount.textContent = scrapedColumns.length;
      statsSection.classList.remove('hidden');
      updateActionButtonsState();

      statusSection.classList.remove('hidden');
      statusMergeHint.textContent = 'Navigate to Service Order Management Light page, then click below';

      buildPreview(scrapedData, scrapedColumns);
      previewSection.classList.remove('hidden');

      // Auto-export to Excel if the checkbox is enabled
      const autoExport = chkAutoExport111 && chkAutoExport111.checked;
      if (autoExport) {
        autoExportToExcel();
      }

    } catch (error) {
      setStatus('error', 'View-mode scrape failed');
      showError(error.message || 'An unknown error occurred.');
    } finally {
      btnViewModeScrape.classList.remove('loading');
    }
  });
}

// ---- Append Scrape Handler ----
if (btnAppendScrape) {
  btnAppendScrape.addEventListener('click', async () => {
    hideError();
    btnAppendScrape.classList.add('loading');
    setStatus('loading', 'Appending new data...');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        throw new Error('No active tab found.');
      }

      const isAllowedTabUrl = tab.url && (
        tab.url.includes('biz2.samsungcsportal.com') ||
        tab.url.includes('so_view_information_by_mangement_lite') ||
        tab.url.includes('call_info_viewing_mode') ||
        tab.url.startsWith('file://')
      );
      if (!isAllowedTabUrl) {
        throw new Error('Please navigate to the GSPN portal (biz2.samsungcsportal.com) first.');
      }

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ['content.js']
        });
      } catch (e) {
        // Script may already be injected, continue
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeData' });

      if (!response) {
        throw new Error('No response from page. Please reload the GSPN page and try again.');
      }

      if (!response.success) {
        throw new Error(response.error || 'Failed to scrape data.');
      }

      if (response.count === 0) {
        throw new Error('No service tickets found on this page. Make sure you are on the multi-print page.');
      }

      const existingData = Array.isArray(scrapedData) ? scrapedData : [];
      const mergedData = mergeScrapedData(existingData, response.data);
      const mergedColumns = mergeScrapedColumns(scrapedColumns, response.columns);

      scrapedData = mergedData;
      scrapedColumns = mergedColumns;
      statusMerged = statusMerged;
      // Ensure Product column/value after merging
      ensureProductField(scrapedData, scrapedColumns);
      // Ensure Short ASC Assigned Date and Aging after merging
      ensureAscAssignedShortAndAging(scrapedData, scrapedColumns);

      await saveSession();

      const addedCount = mergedData.length - existingData.length;
      setStatus('success', `Added ${addedCount} new ticket(s). Total ${mergedData.length} ticket(s)`);
      ticketCount.textContent = mergedData.length;
      fieldCount.textContent = scrapedColumns.length;
      statsSection.classList.remove('hidden');
      updateActionButtonsState();
      statusSection.classList.remove('hidden');
      statusMergeHint.textContent = 'Added more records — export or merge status again';
      buildPreview(scrapedData, scrapedColumns);
      previewSection.classList.remove('hidden');
    } catch (error) {
      setStatus('error', 'Append failed');
      showError(error.message || 'An unknown error occurred.');
    } finally {
      btnAppendScrape.classList.remove('loading');
    }
  });
}

// ---- Add Status Handler ----
btnAddStatus.addEventListener('click', async () => {
  hideError();
  mergeResult.classList.add('hidden');
  btnAddStatus.classList.add('loading');
  setStatus('loading', 'Fetching status data...');

  // Make sure we have scraped data (restore from session if needed)
  if (!scrapedData || scrapedData.length === 0) {
    try {
      const stored = await chrome.storage.session.get(['gspn_scrapedData', 'gspn_scrapedColumns']);
      if (stored.gspn_scrapedData && stored.gspn_scrapedData.length > 0) {
        scrapedData = stored.gspn_scrapedData;
        scrapedColumns = stored.gspn_scrapedColumns;
      }
    } catch (e) { /* ignore */ }
  }

  if (!scrapedData || scrapedData.length === 0) {
    setStatus('error', 'No scraped data');
    showMergeError('Please scrape ticket data first (Step 1), then come back here.');
    btnAddStatus.classList.remove('loading');
    return;
  }

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      throw new Error('No active tab found.');
    }

    // Inject the statusContent.js script into the current tab across all frames
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['statusContent.js']
      });
    } catch (e) {
      // Script may already be injected
    }

    // Execute scrapeStatusData across all frames directly in each frame's context
    let statusRecords = [];
    let statusError = null;

    try {
      const execResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: () => {
          if (typeof scrapeStatusData === 'function') {
            return scrapeStatusData();
          }
          return null;
        }
      });

      if (Array.isArray(execResults)) {
        for (const item of execResults) {
          if (item && item.result && Array.isArray(item.result.records) && item.result.records.length > 0) {
            statusRecords = item.result.records;
            statusError = null;
            break;
          } else if (item && item.result && item.result.error && !statusError) {
            statusError = item.result.error;
          }
        }
      }
    } catch (e) {
      console.warn('executeScript multi-frame scan failed:', e);
    }

    // Fallback: Request status data via message passing if executeScript returned no records
    if (!statusRecords || statusRecords.length === 0) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeStatus' });
        if (response && response.success && Array.isArray(response.data) && response.data.length > 0) {
          statusRecords = response.data;
          statusError = null;
        } else if (response && response.error) {
          statusError = response.error;
        }
      } catch (e) {
        // Message passing fallback error
      }
    }

    if (!statusRecords || statusRecords.length === 0) {
      throw new Error(statusError || 'Status table not found. Make sure you are on the Service Order Management Light page with data loaded.');
    }

    // Perform VLOOKUP merge
    const mergeStats = mergeStatusData(statusRecords);

    // Update columns list (add status columns that aren't already present)
    for (const col of STATUS_COLUMNS) {
      if (!scrapedColumns.includes(col)) {
        scrapedColumns.push(col);
      }
    }

    // Update UI
    statusMerged = true;
    fieldCount.textContent = scrapedColumns.length;
    updateActionButtonsState();

    // Save merged data back to session storage!
    await saveSession();

    // Show merge result
    showMergeResult(mergeStats);

    // Refresh preview with new columns
    buildPreview(scrapedData, scrapedColumns);

    setStatus('success', `Status merged: ${mergeStats.matched} of ${scrapedData.length} matched`);
    statusMergeHint.textContent = `✓ ${mergeStats.matched} matched, ${mergeStats.unmatched} unmatched — from ${statusRecords.length} status records`;

  } catch (error) {
    setStatus('error', 'Status merge failed');
    showMergeError(error.message);
  } finally {
    btnAddStatus.classList.remove('loading');
  }
});

/**
 * VLOOKUP merge: match scraped tickets with status records by Service Order No
 */
function mergeStatusData(statusRecords) {
  // Build a lookup map from Service Order No -> status record
  const statusMap = new Map();
  for (const record of statusRecords) {
    const soNo = record['Service Order No'];
    if (soNo) {
      statusMap.set(soNo.trim(), record);
    }
  }

  let matched = 0;
  let unmatched = 0;

  // Iterate through scraped data and merge matching status
  for (const ticket of scrapedData) {
    const ticketSO = (ticket['Service Order No'] || ticket['SO'] || '').trim();
    if (!ticketSO) {
      unmatched++;
      continue;
    }

    const statusRecord = statusMap.get(ticketSO);
    if (statusRecord) {
      // Merge status fields into the ticket (don't overwrite existing)
      for (const col of STATUS_COLUMNS) {
        if (statusRecord[col] && statusRecord[col] !== '') {
          // Only add if the ticket doesn't already have this field, or the field is empty
          if (!ticket[col] || ticket[col] === '' || ticket[col] === '-') {
            ticket[col] = statusRecord[col];
          }
        }
      }
      matched++;
    } else {
      unmatched++;
    }
  }

  return { matched, unmatched, totalStatus: statusRecords.length };
}

/**
 * Show merge result badge
 */
function showMergeResult(stats) {
  mergeResult.classList.remove('hidden', 'merge-success', 'merge-partial', 'merge-error');

  if (stats.matched === scrapedData.length) {
    mergeResult.classList.add('merge-success');
    mergeResultIcon.textContent = '✓';
    mergeResultText.textContent = `All ${stats.matched} tickets matched with status data`;
  } else if (stats.matched > 0) {
    mergeResult.classList.add('merge-partial');
    mergeResultIcon.textContent = '⚡';
    mergeResultText.textContent = `${stats.matched} matched, ${stats.unmatched} unmatched`;
  } else {
    mergeResult.classList.add('merge-error');
    mergeResultIcon.textContent = '✗';
    mergeResultText.textContent = 'No matching tickets found in status data';
  }
}

/**
 * Show merge error
 */
function showMergeError(msg) {
  mergeResult.classList.remove('hidden', 'merge-success', 'merge-partial', 'merge-error');
  mergeResult.classList.add('merge-error');
  mergeResultIcon.textContent = '✗';
  mergeResultText.textContent = msg;
}

// ---- Preview Table ----
function buildPreview(data, columns) {
  // Show max 5 rows, and limited columns for preview
  // Show different preview columns based on whether status has been merged
  const hasSO = columns.includes('SO');
  const soCol = hasSO ? 'SO' : 'Service Order No';
  const cxCol = columns.includes('CX Name') ? 'CX Name' : 'Customer Name';

  const baseCols = [soCol, cxCol, 'Model Name', 'Telephone (Mobile)', 'Engineer'];
  const statusPreviewCols = [soCol, cxCol, 'Status (GSPN)', 'Reason (GSPN)', 'City'];
  const previewCols = statusMerged ? statusPreviewCols : baseCols;
  const maxRows = 5;

  // Head
  let headHTML = '<tr>';
  headHTML += '<th>#</th>';
  for (const col of previewCols) {
    headHTML += `<th>${col}</th>`;
  }
  headHTML += '</tr>';
  previewHead.innerHTML = headHTML;

  // Body
  let bodyHTML = '';
  const rowCount = Math.min(data.length, maxRows);
  for (let i = 0; i < rowCount; i++) {
    bodyHTML += '<tr>';
    bodyHTML += `<td>${i + 1}</td>`;
    for (const col of previewCols) {
      let val = data[i][col];
      if (val === undefined || val === null || val === '') {
        if (col === 'Service Order No') {
          val = data[i]['SO'];
        } else if (col === 'Customer Name') {
          val = data[i]['CX Name'];
        }
      }
      const valStr = (val !== undefined && val !== null && val !== '') ? String(val) : '';
      bodyHTML += `<td title="${escapeHtml(valStr)}">${escapeHtml(valStr !== '' ? valStr : '-')}</td>`;
    }
    bodyHTML += '</tr>';
  }
  previewBody.innerHTML = bodyHTML;
  previewInfo.textContent = data.length > maxRows
    ? `Showing ${maxRows} of ${data.length} records`
    : `${data.length} record(s)`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Auto-add Toggle Checkbox State ----
if (autoAddToggle) {
  chrome.storage.local.get(['autoAddManualTicketsEnabled'], (data) => {
    autoAddToggle.checked = !!data.autoAddManualTicketsEnabled;
  });
  autoAddToggle.addEventListener('change', () => {
    chrome.storage.local.set({ autoAddManualTicketsEnabled: autoAddToggle.checked });
  });
}

// ---- Auto Scrape 1-1-1 Flow ----
if (btnAutoScrape111) {
  btnAutoScrape111.addEventListener('click', async () => {
    const rawVal = txtViewModePasteIds.value.trim();
    if (!rawVal) {
      txtViewModePasteIds.classList.add('border-red-500');
      setTimeout(() => txtViewModePasteIds.classList.remove('border-red-500'), 1000);
      return;
    }

    const ids = rawVal.split('\n')
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (ids.length === 0) return;

    // Initialize UI
    btnAutoScrape111.disabled = true;
    btnCopyExcel111.disabled = true;
    btnExcelDownload111.disabled = true;
    statusBar111.classList.remove('hidden');
    tableBody111.innerHTML = '';
    recordsCount111.textContent = `0 record(s)`;
    progressBar111.style.width = '0%';
    statusText111.textContent = `Starting auto scrape...`;

    let successCount = 0;
    let failedCount = 0;

    // We'll scrape sequentially
    for (let i = 0; i < ids.length; i++) {
      const ticketId = ids[i];
      statusText111.textContent = `Processing ${i + 1} of ${ids.length}...`;
      progressBar111.style.width = `${Math.round((i / ids.length) * 100)}%`;

      try {
        const result = await scrapeTicketId(ticketId);
        if (result.success) {
          successCount++;

          const ticket = result.data;

          // Populate Product column/value based on Model Name
          const modelVal = (ticket['Model Name'] || ticket['Model'] || '').toString();
          ticket['Product'] = getProduct111(modelVal);

          ticket['SO'] = ticket['Service Order No'] || '';
          ticket['CX Name'] = ticket['Customer Name'] || '';

          const incomingColumns = result.columns;
          if (!incomingColumns.includes('Product')) incomingColumns.push('Product');

          // Load current session
          let existingData = scrapedData || [];
          let existingColumns = scrapedColumns || [];

          // Deduplicate
          const seenKeys = new Set(existingData.map(getTicketIdentity).filter(Boolean));
          const newKey = getTicketIdentity(ticket);

          if (!newKey || !seenKeys.has(newKey)) {
            scrapedData = existingData.concat([ticket]);
            scrapedColumns = mergeScrapedColumns(existingColumns, incomingColumns);
            ensureProductField(scrapedData, scrapedColumns);
            ensureAscAssignedShortAndAging(scrapedData, scrapedColumns);
            await saveSession();
          }

          appendLogTableRow(i + 1, ticketId, 'SUCCESS', null);
        } else {
          failedCount++;
          appendLogTableRow(i + 1, ticketId, 'FAILED', result.error);
        }
      } catch (err) {
        failedCount++;
        appendLogTableRow(i + 1, ticketId, 'FAILED', err.message);
      }

      progressBar111.style.width = `${Math.round(((i + 1) / ids.length) * 100)}%`;
      recordsCount111.textContent = `${successCount} record(s)`;
    }

    // Done
    statusText111.textContent = `Completed! ${successCount} succeeded, ${failedCount} failed`;
    btnAutoScrape111.disabled = false;

    const hasData = scrapedData && scrapedData.length > 0;
    btnCopyExcel111.disabled = !hasData;
    btnExcelDownload111.disabled = !hasData;

    updateActionButtonsState();
    if (scrapedData && scrapedData.length > 0) {
      ticketCount.textContent = scrapedData.length;
      fieldCount.textContent = scrapedColumns.length;
      statsSection.classList.remove('hidden');
      buildPreview(scrapedData, scrapedColumns);
      previewSection.classList.remove('hidden');
    }
  });
}

function appendLogTableRow(index, ticketId, status, errorMsg) {
  const row = document.createElement('tr');
  row.className = 'hover:bg-primary/5 transition-colors border-b border-outline-variant last:border-b-0';

  const tdIndex = document.createElement('td');
  tdIndex.className = 'px-3 py-2 font-data-mono text-body-sm';
  tdIndex.textContent = index;

  const tdSO = document.createElement('td');
  tdSO.className = 'px-3 py-2 font-data-mono text-body-sm';
  tdSO.textContent = ticketId;

  const tdStatus = document.createElement('td');
  tdStatus.className = 'px-3 py-2';

  const badge = document.createElement('span');
  if (status === 'SUCCESS') {
    badge.className = 'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-tertiary-fixed text-on-tertiary-fixed-variant';
    badge.textContent = 'SUCCESS';
  } else {
    badge.className = 'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-error-container text-on-error-container cursor-help';
    badge.textContent = 'FAILED';
    if (errorMsg) {
      badge.title = errorMsg;
    }
  }

  tdStatus.appendChild(badge);
  row.appendChild(tdIndex);
  row.appendChild(tdSO);
  row.appendChild(tdStatus);

  tableBody111.appendChild(row);
  tableBody111.parentElement.scrollTop = tableBody111.parentElement.scrollHeight;
}

const PRODUCT_PFX_MAP = {
  RR: 'REF', RT: 'REF', RF: 'REF', RS: 'REF', RA: 'REF',
  WA: 'WM', WT: 'WM', WW: 'WM', WD: 'WM', WF: 'WM',
  AR: 'RAC', AC: 'RAC', AJ: 'RAC', AM: 'RAC', ACN: 'RAC',
  UA: 'TV', QA: 'TV', HG: 'TV', PS: 'TV', PN: 'TV', UN: 'TV', UE: 'TV', GU: 'TV',
  LH: 'DISPLAY', LS: 'DISPLAY',
  MC: 'MWO', MG: 'MWO', MS: 'MWO', CE: 'MWO', CM: 'MWO',
  DW: 'DW', DV: 'DRYER', VS: 'VACUUM', VR: 'VACUUM',
  AX: 'AIR PURIFIER', HW: 'AUDIO', MX: 'AUDIO', HT: 'AUDIO',
  LC: 'MONITOR', LSM: 'MONITOR', NV: 'OVEN', NQ: 'OVEN', NA: 'HOB', NZ: 'HOB'
};
function getProduct111(model) {
  if (!model) return 'UNKNOWN';
  model = model.toUpperCase().trim();
  const keys = Object.keys(PRODUCT_PFX_MAP).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (model.startsWith(k)) return PRODUCT_PFX_MAP[k];
  }
  return 'UNKNOWN';
}

function scrapeTicketId(ticketId) {
  return new Promise((resolve) => {
    const url = `https://biz2.samsungcsportal.com/gspn/operate.do?cmd=ServiceOrderDetailLiteCmd&objectID=${ticketId}`;
    chrome.tabs.create({ url, active: false }, (tab) => {
      if (!tab) {
        resolve({ success: false, error: 'Failed to create tab' });
        return;
      }

      const listener = async (tabId, changeInfo) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          clearTimeout(timeoutId);

          try {
            await new Promise(r => setTimeout(r, 1800));

            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                files: ['viewModeContent.js']
              });
            } catch (e) {
              console.warn('Script inject error (likely harmless):', e);
            }

            chrome.tabs.sendMessage(tab.id, { action: 'scrapeViewMode' }, (response) => {
              chrome.tabs.remove(tab.id);

              if (chrome.runtime.lastError) {
                resolve({ success: false, error: chrome.runtime.lastError.message });
              } else if (!response) {
                resolve({ success: false, error: 'No response from page' });
              } else if (!response.success) {
                resolve({ success: false, error: response.error || 'Failed to scrape' });
              } else {
                resolve({ success: true, data: response.data[0], columns: response.columns });
              }
            });

          } catch (err) {
            chrome.tabs.remove(tab.id);
            resolve({ success: false, error: err.message });
          }
        }
      };

      chrome.tabs.onUpdated.addListener(listener);

      const timeoutId = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        chrome.tabs.remove(tab.id, () => {
          if (chrome.runtime.lastError) { }
        });
        resolve({ success: false, error: 'Timeout loading page (18s)' });
      }, 18000);
    });
  });
}

// ---- Copy Excel 1-1-1 ----
if (btnCopyExcel111) {
  btnCopyExcel111.addEventListener('click', async () => {
    if (!scrapedData || scrapedData.length === 0) return;

    try {
      const originalText = btnCopyExcel111.innerHTML;
      btnCopyExcel111.disabled = true;
      statusText111.textContent = 'Copying to clipboard...';

      const excelContent = generateExcelHTML(scrapedData, scrapedColumns);
      await copyToClipboard(excelContent, excelContent);

      statusText111.textContent = `Copied ${scrapedData.length} tickets to clipboard`;

      btnCopyExcel111.innerHTML = '<span class="material-symbols-outlined">done</span><span class="text-sm">Copied!</span>';
      setTimeout(() => {
        btnCopyExcel111.innerHTML = originalText;
        btnCopyExcel111.disabled = false;
      }, 2000);

    } catch (error) {
      statusText111.textContent = 'Copy failed: ' + error.message;
      btnCopyExcel111.disabled = false;
    }
  });
}

// ---- Excel Download 1-1-1 ----
if (btnExcelDownload111) {
  btnExcelDownload111.addEventListener('click', () => {
    if (!scrapedData || scrapedData.length === 0) return;

    try {
      statusText111.textContent = 'Generating Excel file...';

      const filename = `GSPN_1-1-1_${getTimestamp()}.xls`;
      const excelContent = generateExcelHTML(scrapedData, scrapedColumns);

      const blob = new Blob([excelContent], {
        type: 'application/vnd.ms-excel;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);

      chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          statusText111.textContent = 'Download failed';
        } else {
          statusText111.textContent = `Exported ${scrapedData.length} tickets to Excel`;
        }
      });

    } catch (error) {
      statusText111.textContent = 'Export failed: ' + error.message;
    }
  });
}

/**
 * Auto-export current scraped data to Excel (used when auto-export checkbox is on).
 * Triggers a download silently without prompting saveAs dialog.
 */
function autoExportToExcel() {
  if (!scrapedData || scrapedData.length === 0) return;
  try {
    const filename = `GSPN_1-1-1_${getTimestamp()}.xls`;
    const excelContent = generateExcelHTML(scrapedData, scrapedColumns);
    const blob = new Blob([excelContent], {
      type: 'application/vnd.ms-excel;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false // Auto-save without prompt
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.warn('Auto-export failed:', chrome.runtime.lastError.message);
      } else {
        setStatus('success', `✓ Auto-exported ${scrapedData.length} ticket(s) to Excel`);
      }
      URL.revokeObjectURL(url);
    });
  } catch (error) {
    console.warn('Auto-export error:', error);
  }
}

// ---- Export to Excel ----
btnExport.addEventListener('click', () => {
  if (!scrapedData || scrapedData.length === 0) return;

  try {
    setStatus('loading', 'Generating Excel file...');

    const filename = `GSPN_Data_${getTimestamp()}.xls`;
    const excelContent = generateExcelHTML(scrapedData, scrapedColumns);

    // Create a Blob and download
    const blob = new Blob([excelContent], {
      type: 'application/vnd.ms-excel;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);

    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        setStatus('error', 'Download failed');
        showError(chrome.runtime.lastError.message);
      } else {
        setStatus('success', `Exported ${scrapedData.length} tickets to Excel`);
      }
    });

  } catch (error) {
    setStatus('error', 'Export failed');
    showError(error.message);
  }
});

// ---- Copy to Clipboard ----
if (btnCopy) {
  btnCopy.addEventListener('click', async () => {
    if (!scrapedData || scrapedData.length === 0) return;

    try {
      const originalText = btnCopy.innerHTML;
      btnCopy.classList.add('loading');
      setStatus('loading', 'Copying to clipboard...');

      const excelContent = generateExcelHTML(scrapedData, scrapedColumns);
      await copyToClipboard(excelContent, excelContent);

      setStatus('success', `Copied ${scrapedData.length} tickets to clipboard`);

      // Temporary success state for the button
      btnCopy.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      setTimeout(() => {
        btnCopy.innerHTML = originalText;
      }, 2000);

    } catch (error) {
      setStatus('error', 'Copy failed');
      showError('Could not copy to clipboard. Please use export instead. ' + error.message);
    } finally {
      btnCopy.classList.remove('loading');
    }
  });
}

/**
 * Generate an HTML table that Excel can open natively as a .xls file.
 * This approach supports formatting, column widths, and UTF-8 text.
 */
function generateExcelHTML(data, columns) {
  let html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>GSPN Data</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    table { border-collapse: collapse; }
    th {
      background-color: #1a56db;
      color: #ffffff;
      font-weight: bold;
      font-size: 11pt;
      padding: 8px 12px;
      border: 1px solid #999999;
      text-align: center;
      white-space: nowrap;
    }
    td {
      font-size: 10pt;
      padding: 6px 10px;
      border: 1px solid #cccccc;
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background-color: #f0f4ff;
    }
    .num { mso-number-format:\\@; }
  </style>
</head>
<body>
  <table>
    <thead>
      <tr>
        <th>S.No</th>`;

  // Header row
  for (const col of columns) {
    html += `\n        <th>${escapeHtml(col)}</th>`;
  }

  html += `
      </tr>
    </thead>
    <tbody>`;

  // Data rows
  for (let i = 0; i < data.length; i++) {
    html += `\n      <tr>`;
    html += `\n        <td style="text-align:center;">${i + 1}</td>`;
    for (const col of columns) {
      const value = (data[i][col] !== undefined && data[i][col] !== null && data[i][col] !== '') ? String(data[i][col]) : '';
      // Force text format for phone numbers and IDs to prevent Excel
      // from converting them to scientific notation
      const isNumericField = col.includes('Telephone') || col.includes('Customer No') || col.includes('Order No');
      if (isNumericField && value !== '') {
        html += `\n        <td class="num">${escapeHtml(value)}</td>`;
      } else {
        html += `\n        <td>${escapeHtml(value)}</td>`;
      }
    }
    html += `\n      </tr>`;
  }

  html += `
    </tbody>
  </table>
</body>
</html>`;

  return html;
}

function getTimestamp() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy}_${hh}${min}`;
}

// ---- Start Fresh / Reset Button ----
const btnReset = document.getElementById('btnReset');
if (btnReset) {
  btnReset.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all scraped data?')) {
      scrapedData = null;
      scrapedColumns = null;
      statusMerged = false;
      await clearSession();
      if (statsSection) statsSection.classList.add('hidden');
      if (previewSection) previewSection.classList.add('hidden');
      if (statusSection) statusSection.classList.add('hidden');
      if (mergeResult) mergeResult.classList.add('hidden');
      updateActionButtonsState();
    }
  });
}

// ---- Print in New Tab Helper ----
const btnPrintInNewTab = document.getElementById('btnPrintInNewTab');
const txtPrintIds = document.getElementById('txtPrintIds');
const chkPrintNewTab = document.getElementById('chkPrintNewTab');

if (chkPrintNewTab) {
  chrome.storage.local.get(['printNewTabEnabled'], (data) => {
    if (data.printNewTabEnabled !== undefined) {
      chkPrintNewTab.checked = !!data.printNewTabEnabled;
    }
  });

  chkPrintNewTab.addEventListener('change', () => {
    chrome.storage.local.set({ printNewTabEnabled: chkPrintNewTab.checked });
  });
}

if (btnPrintInNewTab && txtPrintIds) {
  btnPrintInNewTab.addEventListener('click', () => {
    const rawVal = txtPrintIds.value.trim();
    if (!rawVal) {
      txtPrintIds.classList.add('border-red-500');
      setTimeout(() => txtPrintIds.classList.remove('border-red-500'), 1000);
      return;
    }
    const ids = rawVal.split('\n')
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (ids.length === 0) return;

    const openInNewTab = chkPrintNewTab ? chkPrintNewTab.checked : true;

    if (openInNewTab) {
      // Open a separate new tab for each ID
      ids.forEach(id => {
        const printUrl = `https://biz2.samsungcsportal.com/gspn/operate.do?print_type=SIEL_ENG&ascCode=*&cmd=ServiceRequestMultiPrintCmd&objectId=${encodeURIComponent(id)}`;
        chrome.tabs.create({ url: printUrl });
      });
    } else {
      // Combine all IDs into a single tab
      const objectParams = ids.map(id => `objectId=${encodeURIComponent(id)}`).join('&');
      const printUrl = `https://biz2.samsungcsportal.com/gspn/operate.do?print_type=SIEL_ENG&ascCode=*&cmd=ServiceRequestMultiPrintCmd&${objectParams}`;
      chrome.tabs.create({ url: printUrl });
    }
  });
}


