/**
 * core.js — Shared utilities for GSPN Website Tools
 */

// ── Toast Notifications ──────────────────────────────────────────────────────
function showToast(message, type) {
  type = type || 'success';
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = '<span class="toast-icon">' + icon + '</span><span>' + message + '</span>';
  container.appendChild(toast);

  requestAnimationFrame(function() { toast.classList.add('visible'); });
  setTimeout(function() {
    toast.classList.remove('visible');
    setTimeout(function() { toast.remove(); }, 350);
  }, 3500);
}

// ── Status Bar ───────────────────────────────────────────────────────────────
function setStatus(barId, textId, state, message) {
  const bar = document.getElementById(barId);
  const text = document.getElementById(textId);
  if (bar) {
    bar.className = 'status-bar status-' + state;
  }
  if (text) {
    text.textContent = message;
  }
}

// ── Date helpers ─────────────────────────────────────────────────────────────
function getTimestamp() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
    '_',
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0')
  ].join('');
}

/**
 * Parse various date formats found in GSPN data.
 * Accepts: "09.04.2026", "04/09/2026", "2026-09-04", "05/09/2026 (12:00:00)"
 * Returns a Date object or null.
 */
function parseGspnDate(str) {
  if (!str || typeof str !== 'string') return null;
  str = str.trim();

  // Remove parenthesized time portion: "05/09/2026 (12:00:00)" → "05/09/2026"
  var cleaned = str.replace(/\s*\(.*?\)\s*/g, '').trim();

  // Format: DD.MM.YYYY
  var m = cleaned.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));

  // Format: DD/MM/YYYY
  m = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));

  // Format: YYYY-MM-DD
  m = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));

  return null;
}

/**
 * Calculate TAT (Turn Around Time) in days between two date strings.
 */
function calcTAT(createdStr, todayDate) {
  var created = parseGspnDate(createdStr);
  if (!created) return '';
  todayDate = todayDate || new Date();
  var diff = Math.floor((todayDate - created) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : 0;
}

// ── Product Prefix Mapper ────────────────────────────────────────────────────
var PRODUCT_PREFIXES = {
  RR:'REF', RT:'REF', RF:'REF', RS:'REF', RA:'REF',
  WA:'WM', WT:'WM', WW:'WM', WD:'WM', WF:'WM',
  AR:'RAC', AC:'RAC', AJ:'RAC', AM:'RAC', ACN:'RAC',
  UA:'TV', QA:'TV', HG:'TV', PS:'TV', PN:'TV', UN:'TV', UE:'TV', GU:'TV',
  LH:'DISPLAY', LS:'DISPLAY',
  MC:'MWO', MG:'MWO', MS:'MWO', CE:'MWO', CM:'MWO',
  DW:'DW', DV:'DRYER', VS:'VACUUM', VR:'VACUUM',
  AX:'AIR PURIFIER', HW:'AUDIO', MX:'AUDIO', HT:'AUDIO',
  LC:'MONITOR', LSM:'MONITOR', NV:'OVEN', NQ:'OVEN', NA:'HOB', NZ:'HOB'
};

function getProductCategory(model) {
  if (!model) return 'UNKNOWN';
  model = model.toUpperCase().trim();
  var keys = Object.keys(PRODUCT_PREFIXES).sort(function(a, b) { return b.length - a.length; });
  for (var i = 0; i < keys.length; i++) {
    if (model.startsWith(keys[i])) return PRODUCT_PREFIXES[keys[i]];
  }
  return 'UNKNOWN';
}

// ── HTML Escape ──────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
