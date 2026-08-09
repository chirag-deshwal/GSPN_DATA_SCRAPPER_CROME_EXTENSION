/**
 * GSPN Data Scraper - Content Script
 * Parses service ticket data from the Samsung GSPN multi-print page.
 * Each ticket block is a <table width="100%" height="980"> containing
 * a nested data table with CSS classes PboxV_T_bold / PboxV_B_bold for labels
 * and PboxV_T / PboxV_B / PboxV_TR / PboxV_BR for values.
 */

// Field mapping: label text -> clean key name
const FIELD_MAP = {
  'Customer Name': 'Customer Name',
  'Service Order No': 'Service Order No',
  'Customer No': 'Customer No',
  'Address': 'Address',
  'Model Name': 'Model Name',
  'Engineer': 'Engineer',
  'Telephone(Home)': 'Telephone (Home)',
  'Customer Preferred Date': 'Customer Preferred Date',
  'Service Type': 'Service Type',
  'Telephone(Office)': 'Telephone (Office)',
  'Purchase Date': 'Purchase Date',
  'Appointment Date': 'Appointment Date',
  'Telephone(Mobile)': 'Telephone (Mobile)',
  'ASC Assigned': 'ASC Assigned',
  'Symptom 1': 'Symptom 1',
  'Symptom 2': 'Symptom 2',
  'Symptom 3': 'Symptom 3',
  '1st Service Comment': '1st Service Comment',
  'Remark': 'Remark'
};

// Ordered columns for the Excel export
const COLUMN_ORDER = [
  'Service Order No',
  'Customer Name',
  'Customer No',
  'Address',
  'Model Name',
  'Engineer',
  'Telephone (Home)',
  'Telephone (Office)',
  'Telephone (Mobile)',
  'Customer Preferred Date',
  'Purchase Date',
  'Appointment Date',
  'Service Type',
  'ASC Assigned',
  'Symptom 1',
  'Symptom 2',
  'Symptom 3',
  '1st Service Comment',
  'Remark'
];

const LOG_SOURCE = 'content';

function formatLogValue(value) {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function publishExtensionLog(level, args) {
  const message = args.map(formatLogValue).join(' ');
  if (!message) return;
  chrome.runtime.sendMessage({
    action: 'extensionLog',
    entry: {
      source: LOG_SOURCE,
      level,
      message,
      timestamp: new Date().toISOString()
    }
  }).catch(() => {});
}

['log', 'info', 'warn', 'error', 'debug'].forEach((method) => {
  const original = console[method];
  console[method] = (...args) => {
    publishExtensionLog(method, args);
    if (original) {
      original.apply(console, args);
    }
  };
});

/**
 * Clean extracted text: trim whitespace, collapse multiple spaces,
 * remove &nbsp; remnants.
 */
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\u00A0/g, ' ')   // Replace &nbsp;
    .replace(/\s+/g, ' ')       // Collapse whitespace
    .trim();
}

/**
 * Parse a single ticket table block and return a data object.
 */
function parseTicketBlock(tableEl) {
  const data = {};

  // Find all rows in the innermost data table (the one with PboxV_* classes)
  const rows = tableEl.querySelectorAll('tr');

  for (const row of rows) {
    const cells = row.querySelectorAll('td');

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const className = cell.className || '';

      // Check if this cell is a label cell (bold class)
      const isLabel = className.includes('PboxV_T_bold') ||
                      className.includes('PboxV_B_bold') ||
                      className.includes('Pboxv_B_bold');

      if (isLabel) {
        const labelText = cleanText(cell.textContent);

        // Find the mapped field name
        let fieldName = null;
        for (const [key, value] of Object.entries(FIELD_MAP)) {
          if (labelText.includes(key)) {
            fieldName = value;
            break;
          }
        }

        if (fieldName) {
          // The value is in the next cell(s)
          let valueCell = cells[i + 1];
          if (valueCell) {
            const valueClassName = valueCell.className || '';
            // Only grab value from non-label cells
            if (!valueClassName.includes('bold')) {
              // For address, the colspan=3 cell contains the full address
              // For 1st Service Comment and Remark, colspan=5
              const colSpan = parseInt(valueCell.getAttribute('colspan') || '1');
              data[fieldName] = cleanText(valueCell.textContent);
            }
          }
        }
      }
    }
  }

  return data;
}
const VIEW_MODE_LABEL_MAP = [
  ['Service Order No.', 'Service Order No'],
  ['Service Order No', 'Service Order No'],
  ['ASC Job No', 'ASC Job No'],
  ['Customer Preferred Date', 'Customer Preferred Date'],
  ['Customer', 'Customer Name'],
  ['Customer No', 'Customer No'],
  ['Phone No', 'Telephone'],
  ['ASC Assigned', 'ASC Assigned'],
  ['Call Received', 'Call Received'],
  ['ASC 1st App', 'ASC 1st App'],
  ['1st Visit', '1st Visit'],
  ['Repair Completed', 'Repair Completed'],
  ['Status Comment', 'Status Comment'],
  ['Service Type', 'Service Type'],
  ['Engineer', 'Engineer'],
  ['Remark', 'Remark'],
  ['Purchase Date', 'Purchase Date'],
  ['Model', 'Model Name'],
  ['Service Branch', 'Service Branch'],
  ['Job Information(Date)', 'Job Information(Date)'],
  ['Customer Symptom', 'Customer Symptom']
];

function mapViewLabelToField(labelText) {
  const normalized = labelText.replace(/\s+/g, ' ').trim();
  for (const [match, field] of VIEW_MODE_LABEL_MAP) {
    if (normalized.includes(match)) {
      return field;
    }
  }
  return null;
}

function parseViewModePhoneValues(rawValue) {
  const result = {};
  const homeMatch = rawValue.match(/\[Home\]\s*([0-9+\-\s]+)/i);
  const officeMatch = rawValue.match(/\[Office\]\s*([0-9+\-\s]+)/i);
  const mobileMatch = rawValue.match(/\[Mobile\]\s*([0-9+\-\s]+)/i);

  if (homeMatch) {
    result['Telephone (Home)'] = cleanText(homeMatch[1]);
  }
  if (officeMatch) {
    result['Telephone (Office)'] = cleanText(officeMatch[1]);
  }
  if (mobileMatch) {
    result['Telephone (Mobile)'] = cleanText(mobileMatch[1]);
  }

  if (!homeMatch && !officeMatch && !mobileMatch) {
    result['Telephone'] = cleanText(rawValue);
  }

  return result;
}

function parseViewModeTicket() {
  const ticket = {};

  const inputObjectId = document.querySelector('input#OBJECT_ID');
  const spanObjectId = document.querySelector('span#OBJECT_ID');
  const rawObjectId = inputObjectId?.value || spanObjectId?.textContent;

  if (rawObjectId) {
    ticket['Service Order No'] = cleanText(rawObjectId);
  }

  const rows = document.querySelectorAll('table.sertb_brdr tr');
  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll('td'));
    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      if (!cell.className || !cell.className.includes('ser_ti')) continue;

      const labelText = cleanText(cell.textContent);
      if (!labelText) continue;

      const valueCell = cells[i + 1];
      if (!valueCell) continue;

      const rawValue = cleanText(valueCell.textContent);
      if (!rawValue) continue;

      if (labelText.includes('Phone No')) {
        Object.assign(ticket, parseViewModePhoneValues(rawValue));
        continue;
      }

      if (labelText === 'Customer') {
        const phoneMatch = rawValue.match(/([0-9]{5,})\s*$/);
        if (phoneMatch) {
          ticket['Customer No'] = phoneMatch[1];
        }
        const customerName = rawValue.replace(/([0-9]{5,})\s*$/, '').trim();
        ticket['Customer Name'] = cleanText(customerName);
        continue;
      }

      const fieldName = mapViewLabelToField(labelText);
      if (fieldName) {
        if (!ticket[fieldName]) {
          ticket[fieldName] = rawValue;
        }
      } else {
        ticket[labelText] = rawValue;
      }
    }
  }

  if (!ticket['Service Order No'] && !ticket['Customer Name']) {
    return null;
  }

  return ticket;
}

function getColumnsForTicket(ticket) {
  const columns = [...COLUMN_ORDER];
  for (const field of Object.keys(ticket)) {
    if (!columns.includes(field)) {
      columns.push(field);
    }
  }
  return columns;
}
/**
 * Scrape all ticket blocks from the page.
 */
function scrapeAllTickets(targetDoc = document) {
  const tickets = [];

  // Each ticket is wrapped in a <table width="100%" height="980">
  // Inside there's a nested table with the actual data (PboxV_* classes)
  const outerTables = targetDoc.querySelectorAll('table[width="100%"][height="980"]');

  for (const outerTable of outerTables) {
    // Find the data table inside (with PboxV_T_bold cells)
    const dataTables = outerTable.querySelectorAll('table[width="100%"][border="0"][cellspacing="0"][cellpadding="0"]');

    for (const dataTable of dataTables) {
      // Check if this table has PboxV_T_bold cells (it's a data table)
      const boldCells = dataTable.querySelectorAll('td.PboxV_T_bold');
      if (boldCells.length > 0) {
        const ticketData = parseTicketBlock(dataTable);
        // Only add if we got meaningful data
        if (ticketData['Service Order No'] || ticketData['Customer Name']) {
          tickets.push(ticketData);
        }
        break; // Only process the first data table per outer block
      }
    }
  }

  // Fallback: If no tickets found in targetDoc, search inside child iframes
  if (tickets.length === 0) {
    const iframes = Array.from(targetDoc.querySelectorAll('iframe'));
    for (const frame of iframes) {
      try {
        const frameDoc = frame.contentDocument || frame.contentWindow.document;
        if (!frameDoc) continue;
        const subRes = scrapeAllTickets(frameDoc);
        if (subRes && subRes.tickets && subRes.tickets.length > 0) {
          return subRes;
        }
      } catch (e) {
        // Cross-origin blocked
      }
    }
  }

  return { tickets, columns: COLUMN_ORDER };
}

function scrapeFieldsFromPage(doc = document) {
  const fields = {};
  const fieldIds = [
    'STATUS_COMMENT', 'REMARK', 'DEFECTDESC_L', 'REPAIRDESC_L', 'EDITEXT',
    'LAB_TYPE', 'DEF_BLK', 'IRIS_CONDI', 'IRIS_SYMPT_QCODE', 'IRIS_SYMPT',
    'IRIS_DEFECT', 'IRIS_REPAIR_QCODE', 'IRIS_REPAIR', 'REASON'
  ];

  function getVal(id, currentDoc) {
    const el = currentDoc.getElementById(id)
        || currentDoc.querySelector(`[name="${id}"]`)
        || currentDoc.querySelector(`[id*="${id}" i]`)
        || currentDoc.querySelector(`[name*="${id}" i]`);

    if (el) {
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
        return el.value ? el.value.trim() : '';
      }
      return el.textContent ? el.textContent.trim() : '';
    }

    const iframes = Array.from(currentDoc.querySelectorAll('iframe'));
    for (const iframe of iframes) {
      try {
        const frameDoc = iframe.contentDocument || iframe.contentWindow.document;
        const val = getVal(id, frameDoc);
        if (val) return val;
      } catch (e) {
        // Ignore cross-origin frames
      }
    }
    return '';
  }

  for (const id of fieldIds) {
    const val = getVal(id, doc);
    if (val) {
      fields[id] = val;
    }
  }

  return fields;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeViewMode') {
    try {
      const ticket = parseViewModeTicket();
      if (!ticket) {
        sendResponse({ success: false, error: 'No view-mode ticket found on this page.' });
      } else {
        sendResponse({
          success: true,
          data: [ticket],
          fields: scrapeFieldsFromPage(document),
          columns: getColumnsForTicket(ticket),
          count: 1
        });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  if (request.action === 'scrapeData') {
    try {
      const result = scrapeAllTickets();
      sendResponse({
        success: true,
        data: result.tickets,
        columns: result.columns,
        count: result.tickets.length
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
  return true; // Keep message channel open for async response
});

/* ========================================================================
 *  SEPARATE DATA EXTRACTION DIALOG (Active Exclusively on Multi-Print URLs)
 *  Target URL: https://biz2.samsungcsportal.com/gspn/operate.do?print_type=SIEL_ENG&ascCode=...
 * ======================================================================== */

const PRODUCT_PREFIX = {
  RR: "REF", RT: "REF", RF: "REF", RS: "REF", RA: "REF", RB: "REF",
  WA: "WM", WT: "WM", WW: "WM", WD: "WM", WF: "WM",
  AR: "RAC", AC: "RAC", AJ: "RAC", AM: "RAC", ACN: "RAC",
  UA: "TV", QA: "TV", HG: "TV", PS: "TV", PN: "TV", UN: "TV", UE: "TV", GU: "TV",
  LH: "DISPLAY", LS: "DISPLAY",
  MC: "MWO", MG: "MWO", MS: "MWO", CE: "MWO", CM: "MWO",
  DW: "DW", DV: "DRYER", VS: "VACUUM", VR: "VACUUM", AX: "AIR PURIFIER",
  HW: "AUDIO", MX: "AUDIO", HT: "AUDIO", LC: "MONITOR", LSM: "MONITOR",
  NV: "OVEN", NQ: "OVEN", NA: "HOB", NZ: "HOB"
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ensureProductField(dataArray, columnsArray) {
  if (!Array.isArray(dataArray) || !Array.isArray(columnsArray)) return;
  if (!columnsArray.includes('Product')) {
    const modelIdx = columnsArray.indexOf('Model Name');
    if (modelIdx >= 0) {
      columnsArray.splice(modelIdx + 1, 0, 'Product');
    } else {
      columnsArray.push('Product');
    }
  }
  for (const rec of dataArray) {
    const modelVal = (rec['Model Name'] || rec['Model'] || '').toString();
    rec['Product'] = getSamsungCategory(modelVal);
  }
}

function cleanColumnsAndData(data, columns) {
  if (!Array.isArray(data) || !Array.isArray(columns)) return;
  const keysToDelete = [
    'Remark', 'ASC Job No', 'Created By', 'Service Branch',
    'Date', 'CP/Dealer Ref. No', 'Data Origin', 'Contact Permission'
  ];
  for (let i = columns.length - 1; i >= 0; i--) {
    if (keysToDelete.includes(columns[i])) {
      columns.splice(i, 1);
    }
  }
  for (const rec of data) {
    for (const key of keysToDelete) {
      delete rec[key];
    }
  }
}

function generateExcelHTML(data, columns) {
  return `
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
    td { mso-number-format:"\\@"; }
    .header { font-weight: bold; background-color: #4f46e5; color: #ffffff; text-align: center; }
  </style>
</head>
<body>
  <table border="1">
    <thead>
      <tr>
        ${columns.map(col => `<th class="header">${escapeHtml(col)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${data.map(row => `
        <tr>
          ${columns.map(col => `<td>${escapeHtml((row[col] || '').toString())}</td>`).join('')}
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;
}

function isTargetPrintUrl() {
  const url = window.location.href || '';
  return url.includes('print_type=SIEL_ENG') ||
         url.includes('ServiceRequestMultiPrintCmd') ||
         url.includes('print_data_calls details_html_data') ||
         (url.includes('/gspn/operate.do') && url.includes('print_type='));
}

function initExtractionDialog() {
  if (!isTargetPrintUrl()) return;

  // Attempt to trigger extension action popup via background script
  try {
    chrome.runtime.sendMessage({ action: 'openMainPopup' }).catch(() => {});
  } catch (e) {}

  if (document.getElementById('gspn-extract-dialog-host')) return;

  const host = document.createElement('div');
  host.id = 'gspn-extract-dialog-host';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial;
      display: block !important;
      position: fixed !important;
      top: 16px !important;
      right: 16px !important;
      z-index: 2147483647 !important;
      font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
      pointer-events: none !important;
    }

    .dialog-container {
      width: 468px;
      height: 645px;
      max-height: 92vh;
      background: #0f172a;
      border: 1px solid rgba(99, 102, 241, 0.4);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(99, 102, 241, 0.25);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      pointer-events: auto !important;
      transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease;
      animation: dialogIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    @keyframes dialogIn {
      from { opacity: 0; transform: translateY(-20px) scale(0.95); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .dialog-container.minimized {
      height: 46px !important;
      overflow: hidden !important;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 14px;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      user-select: none;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-icon {
      width: 26px;
      height: 26px;
      background: linear-gradient(135deg, #0056c6 0%, #2563eb 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 800;
      font-size: 13px;
      box-shadow: 0 4px 12px rgba(0, 86, 198, 0.4);
    }

    .header-title {
      font-size: 13px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 0.2px;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .ctrl-btn {
      all: unset;
      width: 26px;
      height: 26px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }

    .ctrl-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
    }

    .popup-frame {
      flex: 1;
      width: 100%;
      height: 595px;
      border: none;
      background: #ffffff;
    }
  `;

  shadow.appendChild(style);

  const container = document.createElement('div');
  container.className = 'dialog-container';
  container.innerHTML = `
    <div class="dialog-header">
      <div class="header-left">
        <div class="header-icon">G</div>
        <span class="header-title">GSPN Scraper — Main POPUP</span>
      </div>
      <div class="header-controls">
        <button class="ctrl-btn" id="btnMin" title="Minimize">—</button>
        <button class="ctrl-btn" id="btnClose" title="Close">✕</button>
      </div>
    </div>
    <iframe class="popup-frame" src="${chrome.runtime.getURL('popup.html')}"></iframe>
  `;

  shadow.appendChild(container);

  shadow.getElementById('btnMin').addEventListener('click', () => {
    container.classList.toggle('minimized');
    shadow.getElementById('btnMin').textContent = container.classList.contains('minimized') ? '▢' : '—';
  });

  shadow.getElementById('btnClose').addEventListener('click', () => {
    host.remove();
  });
}

// Auto-run dialog initialization on target print URLs
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initExtractionDialog);
} else {
  initExtractionDialog();
}
