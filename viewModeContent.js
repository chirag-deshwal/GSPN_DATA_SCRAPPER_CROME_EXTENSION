/**
 * GSPN Data Scraper - View Mode Content Script
 * Handles dedicated scraping for the service order detail view mode.
 */
(function() {
  'use strict';

  if (window.__viewModeContentInitialized) {
    return;
  }
  window.__viewModeContentInitialized = true;

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

  if (homeMatch) result['Telephone (Home)'] = cleanText(homeMatch[1]);
  if (officeMatch) result['Telephone (Office)'] = cleanText(officeMatch[1]);
  if (mobileMatch) result['Telephone (Mobile)'] = cleanText(mobileMatch[1]);
  if (!homeMatch && !officeMatch && !mobileMatch) result['Telephone'] = cleanText(rawValue);

  return result;
}

function parseViewModeTicketInDocument(doc) {
  if (!doc) return null;
  const ticket = {};

  const inputObjectId = doc.querySelector('input#OBJECT_ID')
    || doc.querySelector('input#objectID')
    || doc.querySelector('input[name="OBJECT_ID" i]')
    || doc.querySelector('input[name="objectID" i]');
  const spanObjectId = doc.querySelector('span#OBJECT_ID')
    || doc.querySelector('span[id*="OBJECT_ID" i]');
  const rawObjectId = inputObjectId?.value || spanObjectId?.textContent;

  if (rawObjectId) {
    ticket['Service Order No'] = cleanText(rawObjectId);
  }

  function getCellValue(cell) {
    if (!cell) return '';
    const input = cell.querySelector('input[type="text"], input[type="hidden"], select, textarea');
    if (input) {
      if (input.tagName === 'SELECT') {
        return cleanText(input.options[input.selectedIndex]?.text || input.value);
      }
      if (input.value) return cleanText(input.value);
    }
    return cleanText(cell.textContent);
  }

  const rows = doc.querySelectorAll('table.sertb_brdr tr, table.ser_tb tr, table tr');
  for (const row of rows) {
    const labelCells = Array.from(row.querySelectorAll('td.ser_ti, th.ser_ti, td.title'));
    for (const cell of labelCells) {
      const labelText = cleanText(cell.textContent);
      if (!labelText) continue;

      const valueCell = cell.nextElementSibling;
      if (!valueCell) continue;

      const rawValue = getCellValue(valueCell);
      if (!rawValue) continue;

      if (labelText.includes('Phone No')) {
        Object.assign(ticket, parseViewModePhoneValues(rawValue));
        continue;
      }

      if (labelText === 'Customer') {
        const phoneMatch = rawValue.match(/([0-9]{5,})\s*$/);
        if (phoneMatch) ticket['Customer No'] = phoneMatch[1];
        const custName = rawValue.replace(/([0-9]{5,})\s*$/, '').trim();
        if (custName) ticket['Customer Name'] = cleanText(custName);
        continue;
      }

      const fieldName = mapViewLabelToField(labelText);
      if (fieldName) {
        ticket[fieldName] = ticket[fieldName] || rawValue;
      } else {
        ticket[labelText] = rawValue;
      }
    }
  }

  // Fallback 1: check _l object in window/document
  try {
    const win = doc.defaultView || window;
    const lObj = win._l || (typeof _l !== 'undefined' ? _l : null);
    if (lObj) {
      if (!ticket['Service Order No'] && (lObj.ObjectId || lObj.ASC_JOB_NO || lObj.SO_NO)) {
        ticket['Service Order No'] = cleanText((lObj.ObjectId || lObj.ASC_JOB_NO || lObj.SO_NO).toString());
      }
      if (!ticket['Model Name'] && (lObj.MODEL || lObj.MODEL_NAME)) {
        ticket['Model Name'] = cleanText((lObj.MODEL || lObj.MODEL_NAME).toString());
      }
      if (!ticket['Engineer'] && lObj.ENGINEERNAME) {
        ticket['Engineer'] = cleanText(lObj.ENGINEERNAME.toString());
      }
      if (!ticket['Customer Symptom'] && lObj.DEFECT_DESC) {
        ticket['Customer Symptom'] = cleanText(lObj.DEFECT_DESC.toString());
      }
      if (!ticket['1st Visit'] && lObj.FIRST_APP_DATE) {
        ticket['1st Visit'] = cleanText(lObj.FIRST_APP_DATE.toString());
      }
      if (!ticket['ASC Assigned'] && lObj.ENG_ASSIGN_DATE) {
        ticket['ASC Assigned'] = cleanText(lObj.ENG_ASSIGN_DATE.toString());
      }
      if (!ticket['Repair Completed'] && lObj.REPAIR_COMP_DATE) {
        ticket['Repair Completed'] = cleanText(lObj.REPAIR_COMP_DATE.toString());
      }
      if (!ticket['Service Type'] && lObj.SERVICE_TYPE) {
        ticket['Service Type'] = cleanText(lObj.SERVICE_TYPE.toString());
      }
    }
  } catch (e) {}

  // Fallback 2: check Customer element
  if (!ticket['Customer Name']) {
    const custEl = doc.querySelector('#d_CUSTNAME') || doc.querySelector('[id*="CUSTNAME" i]');
    if (custEl && custEl.textContent) {
      const txt = cleanText(custEl.textContent);
      const parts = txt.split(',');
      ticket['Customer Name'] = parts.length > 1 ? parts.slice(1).join(',').trim() : txt;
    }
  }

  // Fallback 3: check Service Order No element / URL search params
  if (!ticket['Service Order No']) {
    const objEl = doc.querySelector('input#OBJECT_ID') || doc.querySelector('input#objectID') || doc.querySelector('span#OBJECT_ID');
    if (objEl) {
      ticket['Service Order No'] = cleanText(objEl.value || objEl.textContent);
    }
  }
  if (!ticket['Service Order No']) {
    try {
      const win = doc.defaultView || window;
      const urlObj = new URL(win.location.href);
      const urlSo = urlObj.searchParams.get('objectID') || urlObj.searchParams.get('objectId') || urlObj.searchParams.get('soNo') || urlObj.searchParams.get('SO_NO');
      if (urlSo) {
        ticket['Service Order No'] = cleanText(urlSo);
      }
    } catch (e) {}
  }

  if (!ticket['Service Order No'] && !ticket['Customer Name']) {
    return null;
  }

  return ticket;
}

function findViewModeTicket(doc) {
  const ticket = parseViewModeTicketInDocument(doc);
  if (ticket) return ticket;

  const iframes = Array.from(doc.querySelectorAll('iframe'));
  for (const frame of iframes) {
    try {
      const frameDoc = frame.contentDocument;
      if (!frameDoc) continue;
      const nestedTicket = findViewModeTicket(frameDoc);
      if (nestedTicket) return nestedTicket;
    } catch (error) {
      // Ignore cross-origin frames or unreadable content
    }
  }

  return null;
}

function parseServiceOrderListLiteTicketInDocument(doc) {
  const ticket = {};
  const objectIdInput = doc.querySelector('input#OBJECT_ID');
  if (objectIdInput && objectIdInput.value) {
    ticket['Service Order No'] = cleanText(objectIdInput.value);
  }

  const tableRows = doc.querySelectorAll('table.sertb_brdr tr');
  for (const row of tableRows) {
    const cells = Array.from(row.querySelectorAll('td.ser_ti, td.ser_td'));
    for (let i = 0; i < cells.length; i += 2) { // Process in pairs of label and value
      const labelCell = cells[i];
      const valueCell = cells[i + 1];

      if (labelCell && valueCell) {
        const labelText = cleanText(labelCell.textContent);
        const rawValue = cleanText(valueCell.textContent);

        if (!labelText) continue;

        if (labelText.includes('Service Order No.')) { // Prioritize input#OBJECT_ID if already set
          ticket['Service Order No'] = ticket['Service Order No'] || rawValue;
          continue;
        }

        if (labelText.includes('Customer')) {
          const customerMatch = rawValue.match(/(.+?),\s*(.+?)(?:\s*([0-9]+))?$/);
          if (customerMatch) {
            ticket['Customer Name'] = cleanText(customerMatch[1] + ', ' + customerMatch[2]);
            if (customerMatch[3]) ticket['Customer No'] = customerMatch[3];
          } else {
            ticket['Customer Name'] = rawValue;
          }
          continue;
        }

        if (labelText.includes('Phone No')) {
          Object.assign(ticket, parseViewModePhoneValues(rawValue));
          continue;
        }
        
        if (labelText.includes('Model')) {
          const modelMatch = rawValue.match(/^(\S+)/); // Extract first word as Model Name
          if (modelMatch) {
            ticket['Model Name'] = modelMatch[1];
          }
          continue;
        }

        const fieldName = mapViewLabelToField(labelText);
        if (fieldName) {
          ticket[fieldName] = ticket[fieldName] || rawValue;
        } else {
          // Add raw label if not mapped to capture all fields
          ticket[labelText] = rawValue;
        }
      }
    }
  }

  // Fallback for fields not captured by table parsing but available as _l variables
  if (typeof _l !== 'undefined') {
    ticket['Service Order No'] = ticket['Service Order No'] || (_l.ObjectId ? cleanText(_l.ObjectId.toString()) : '');
    ticket['Model Name'] = ticket['Model Name'] || (_l.MODEL ? cleanText(_l.MODEL.toString()) : '');
    ticket['Engineer'] = ticket['Engineer'] || (_l.ENGINEERNAME ? cleanText(_l.ENGINEERNAME.toString()) : '');
    ticket['Remark'] = ticket['Remark'] || (_l.REMARK ? cleanText(_l.REMARK.toString()) : '');
    ticket['Purchase Date'] = ticket['Purchase Date'] || (_l.PURCHASE_DATE ? cleanText(_l.PURCHASE_DATE.toString()) : '');
    ticket['ASC Assigned'] = ticket['ASC Assigned'] || (_l.ENG_ASSIGN_DATE ? cleanText(_l.ENG_ASSIGN_DATE.toString()) : '');
    ticket['Customer Symptom'] = ticket['Customer Symptom'] || (_l.DEFECT_DESC ? cleanText(_l.DEFECT_DESC.toString()) : '');
    ticket['1st Visit'] = ticket['1st Visit'] || (_l.FIRST_APP_DATE ? cleanText(_l.FIRST_APP_DATE.toString()) : '');
    ticket['Repair Completed'] = ticket['Repair Completed'] || (_l.REPAIR_COMP_DATE ? cleanText(_l.REPAIR_COMP_DATE.toString()) : '');
    ticket['Call Received'] = ticket['Call Received'] || (_l.CREATE_TIME ? cleanText(_l.CREATE_TIME.toString()) : '');
    ticket['Service Type'] = ticket['Service Type'] || (_l.SERVICE_TYPE ? cleanText(_l.SERVICE_TYPE.toString()) : '');
    ticket['Status Comment'] = ticket['Status Comment'] || (_l.DEFECT_DESC ? cleanText(_l.DEFECT_DESC.toString()) : ''); // Often same as Defect Desc

    // Specific mapping for Job Information(Date)
    ticket['Job Information(Date)'] = ticket['Job Information(Date)'] ||
      (ticket['Call Received'] || ticket['ASC Assigned'] || ticket['ASC 1st App'] || '');
  }

  if (!ticket['Service Order No'] && !ticket['Customer Name'] && !ticket['Model Name']) {
    return null;
  }

  return ticket;
}


async function scrapeFromIframe(iframeId, parseFunction) {
  try {
    const iframe = document.getElementById(iframeId);
    if (!iframe || !iframe.contentDocument) {
      console.warn(`Iframe with ID '${iframeId}' not found or inaccessible.`);
      return null;
    }
    return parseFunction(iframe.contentDocument);
  } catch (error) {
    console.error(`Error scraping iframe '${iframeId}':`, error);
    return null;
  }
}

function parseTimestamp(dateStr) {
  if (!dateStr) return null;
  const cleanStr = dateStr.trim();
  if (cleanStr.includes('00.00.0000') || cleanStr.includes('00/00/0000') || cleanStr.includes('00-00-0000')) {
    return null;
  }
  const match = cleanStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    const normalParsed = new Date(cleanStr);
    return isNaN(normalParsed.getTime()) ? null : normalParsed;
  }
  const [, day, month, year, hours, minutes, seconds] = match;
  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hours),
    parseInt(minutes),
    parseInt(seconds)
  );
}

function parseChangeLogTable(table) {
  const events = {
    assignedToSC: null,
    engineerAssigned: null,
    pdaFirst: null,
    repairCompleted: null,
    goodsDelivered: null
  };

  const rows = table.querySelectorAll('tbody tr, tr');
  for (const row of rows) {
    const cells = row.querySelectorAll('td');
    if (cells.length < 5) continue;

    const dateStr = cleanText(cells[1]?.textContent);
    const status = cleanText(cells[4]?.textContent);
    const reason = cleanText(cells[5]?.textContent);

    if (!dateStr) continue;
    const timestamp = parseTimestamp(dateStr);
    if (!timestamp) continue;

    const statusLower = status.toLowerCase();
    const reasonLower = reason.toLowerCase();

    if (statusLower === 'assigned to service center') {
      if (!events.assignedToSC) events.assignedToSC = { dateStr, timestamp };
    } else if (statusLower === 'engineer assigned' || statusLower === 'acknowledged (asc)') {
      if (!events.engineerAssigned) events.engineerAssigned = { dateStr, timestamp };
    } else if (statusLower.includes('arrived(pda)') || reasonLower.includes('arrived(pda)')) {
      if (!events.pdaFirst) events.pdaFirst = { dateStr, timestamp };
    } else if (statusLower === 'repair completed') {
      if (!events.repairCompleted) events.repairCompleted = { dateStr, timestamp };
    } else if (statusLower.includes('goods deliver')) {
      if (!events.goodsDelivered) events.goodsDelivered = { dateStr, timestamp };
    }
  }
  return events;
}

function parseChangeLogFromDoc(doc) {
  try {
    if (!doc) return null;
    const tables = doc.querySelectorAll('table');
    for (const table of tables) {
      const text = (table.textContent || '').trim();
      if (text.includes('Changed Date') && text.includes('Status')) {
        return parseChangeLogTable(table);
      }
    }
    const iframes = doc.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const frameDoc = iframe.contentDocument || iframe.contentWindow.document;
        const res = parseChangeLogFromDoc(frameDoc);
        if (res) return res;
      } catch (e) {
        // Cross-origin
      }
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

function getSmartThingsConnected(doc) {
  try {
    if (!doc) return 'NO';
    const smartThingsTr = doc.getElementById('SmartThingsTr');
    if (smartThingsTr) {
      const cells = smartThingsTr.querySelectorAll('td');
      if (cells.length >= 4) {
        const timeStr = (cells[3]?.textContent || '').trim();
        if (timeStr && timeStr.length > 0 && timeStr !== '-') {
          return 'YES';
        }
      }
    }
    const iframes = doc.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const frameDoc = iframe.contentDocument || iframe.contentWindow.document;
        const res = getSmartThingsConnected(frameDoc);
        if (res === 'YES') return 'YES';
      } catch (e) {
        // Cross-origin
      }
    }
  } catch (e) {
    // Ignore
  }
  return 'NO';
}

function getDayDiffString(baseDate, targetDate) {
  const baseDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const targetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const diffMs = targetDay.getTime() - baseDay.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'D0';
  if (diffDays > 0) return `D+${diffDays}`;
  return `D${diffDays}`;
}

function enrichTicketWithMetrics(ticket, doc) {
  ticket['SmartThings Connected(Yes, No)'] = getSmartThingsConnected(doc);

  const changeLog = parseChangeLogFromDoc(doc);
  
  let apptTime = null;
  const apptDateStr = ticket['Appointment Date'] || ticket['Customer Preferred Date'] || '';
  if (apptDateStr) {
    apptTime = parseTimestamp(apptDateStr);
  }

  ticket['Arrived PDA into APT Time before one hour or After one hour (YES, NO)'] = 'NO';
  if (changeLog && changeLog.pdaFirst && apptTime && !isNaN(apptTime.getTime())) {
    const diffMs = Math.abs(changeLog.pdaFirst.timestamp.getTime() - apptTime.getTime());
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours <= 1.0) {
      ticket['Arrived PDA into APT Time before one hour or After one hour (YES, NO)'] = 'YES';
    }
  }

  ticket['Eng Assign within One Hour with Date and Time of SVC Assigned Date (YES, NO)'] = 'NO';
  if (changeLog && changeLog.assignedToSC) {
    const scTime = changeLog.assignedToSC.timestamp;
    const scDateStr = changeLog.assignedToSC.dateStr;
    let isWithinOneHour = false;
    if (changeLog.engineerAssigned) {
      const engTime = changeLog.engineerAssigned.timestamp;
      const diffMs = Math.abs(engTime.getTime() - scTime.getTime());
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours <= 1.0) {
        isWithinOneHour = true;
      }
    }
    const yesNo = isWithinOneHour ? 'YES' : 'NO';
    ticket['Eng Assign within One Hour with Date and Time of SVC Assigned Date (YES, NO)'] = `${yesNo} (${scDateStr})`;
  }

  ticket['RC Done D+1, D0'] = '-';
  let rcTime = null;
  if (changeLog && changeLog.repairCompleted) {
    rcTime = changeLog.repairCompleted.timestamp;
  } else if (ticket['Repair Completed']) {
    rcTime = parseTimestamp(ticket['Repair Completed']);
  }
  if (rcTime && apptTime && !isNaN(rcTime.getTime()) && !isNaN(apptTime.getTime())) {
    ticket['RC Done D+1, D0'] = getDayDiffString(apptTime, rcTime);
  }

  ticket['GD Done on D0, D+1'] = '-';
  let gdTime = null;
  if (changeLog && changeLog.goodsDelivered) {
    gdTime = changeLog.goodsDelivered.timestamp;
  }
  if (gdTime && apptTime && !isNaN(gdTime.getTime()) && !isNaN(apptTime.getTime())) {
    ticket['GD Done on D0, D+1'] = getDayDiffString(apptTime, gdTime);
  }
}

async function parseViewModeTicket() {
  let ticket = findViewModeTicket(document);

  if (!ticket && window.top && window.top.document && window.top.document !== document) {
    ticket = findViewModeTicket(window.top.document);
  }

  if (!ticket) {
    const docsToSearch = [document];
    try {
      if (window.top && window.top.document && !docsToSearch.includes(window.top.document)) {
        docsToSearch.push(window.top.document);
      }
    } catch (e) {}

    for (const docItem of docsToSearch) {
      const iframes = Array.from(docItem.querySelectorAll('iframe, frame'));
      for (const frame of iframes) {
        try {
          const frameDoc = frame.contentDocument || frame.contentWindow?.document;
          if (!frameDoc) continue;
          ticket = parseViewModeTicketInDocument(frameDoc) || parseServiceOrderListLiteTicketInDocument(frameDoc) || findViewModeTicket(frameDoc);
          if (ticket) break;
        } catch (e) { /* cross-origin */ }
      }
      if (ticket) break;
    }
  }

  if (ticket) {
    ticket['SO'] = ticket['Service Order No'] || '';
    ticket['CX Name'] = ticket['Customer Name'] || '';

    enrichTicketWithMetrics(ticket, document);

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
    for (const key of keysToDelete) {
      delete ticket[key];
    }
  }

  return ticket;
}

function getColumnsForTicket(ticket) {
  const baseColumns = [
    'SO',
    'CX Name',
    'Customer No',
    'Address',
    'Model Name',
    'Product',
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
    'SmartThings Connected(Yes, No)',
    'Arrived PDA into APT Time before one hour or After one hour (YES, NO)',
    'Eng Assign within One Hour with Date and Time of SVC Assigned Date (YES, NO)',
    'RC Done D+1, D0',
    'GD Done on D0, D+1'
  ];
  const columns = [];
  for (const col of baseColumns) {
    if (ticket[col] !== undefined || ['SO', 'CX Name', 'Model Name', 'Telephone (Mobile)'].includes(col)) {
      columns.push(col);
    }
  }
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
  for (const field of Object.keys(ticket)) {
    if (field !== 'Service Order No' && field !== 'Customer Name' && !keysToDelete.includes(field) && !columns.includes(field)) {
      columns.push(field);
    }
  }
  return columns;
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeViewMode') {
    parseViewModeTicket()
      .then((ticket) => {
        if (!ticket) {
          sendResponse({ success: false, error: 'No view-mode ticket found on this page. Make sure the Service Order detail is open and visible.' });
        } else {
          sendResponse({
            success: true,
            data: [ticket],
            fields: scrapeFieldsFromPage(document),
            columns: getColumnsForTicket(ticket),
            count: 1
          });
        }
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
});

// ——————————————————————————————————————————————————————————————————————————————————————————————————————————————————————
// FLOATING ACTION BUTTON — "Add 1-1-1 Report"
// Uses Shadow DOM so page CSS (transforms, overflow, z-index stacking contexts)
// cannot hide or clip the FAB.
// ——————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

const FAB_HOST_ID = 'gspn-fab-host-111'; // ID on the real DOM host element
let   _fabShadow  = null;                // reference to the shadow root

/** Inline CSS for the shadow DOM — use simple class names, no conflicts */
const FAB_SHADOW_CSS = `
  :host {
    all: initial;
    display: block !important;
    position: fixed !important;
    bottom: 0 !important;
    right: 0 !important;
    width: 0 !important;
    height: 0 !important;
    overflow: visible !important;
    z-index: 2147483647 !important;
    pointer-events: none !important;
  }

  /* ── FAB Container ── */
  .fab-container {
    position: absolute;
    bottom: 20px;
    right: 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    pointer-events: auto !important;
  }

  /* ── Report Button ── */
  .report-btn {
    all: unset;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 20px;
    height: 52px;
    background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%);
    color: #ffffff;
    font-family: 'Segoe UI', 'Inter', Arial, sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.1px;
    border-radius: 26px;
    box-shadow: 0 6px 24px rgba(124,58,237,0.45), 0 2px 8px rgba(0,0,0,0.22);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    transition: transform 0.18s cubic-bezier(.22,1,.36,1),
                box-shadow 0.18s ease,
                filter 0.18s ease;
    animation: fabIn 0.42s cubic-bezier(.22,1,.36,1) both;
  }
  .report-btn:hover {
    transform: translateY(-2px) scale(1.04);
    box-shadow: 0 10px 32px rgba(124,58,237,0.55), 0 4px 12px rgba(0,0,0,0.24);
    filter: brightness(1.09);
  }
  .report-btn:active {
    transform: translateY(0) scale(0.97);
    box-shadow: 0 4px 16px rgba(124,58,237,0.35);
  }

  /* ── FAB button ── */
  .fab-btn {
    all: unset;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 20px 0 16px;
    height: 52px;
    background: linear-gradient(135deg, #1a56db 0%, #3b82f6 100%);
    color: #ffffff;
    font-family: 'Segoe UI', 'Inter', Arial, sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.1px;
    border-radius: 26px;
    box-shadow: 0 6px 24px rgba(26,86,219,0.45), 0 2px 8px rgba(0,0,0,0.22);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    transition: transform 0.18s cubic-bezier(.22,1,.36,1),
                box-shadow 0.18s ease,
                filter 0.18s ease,
                background 0.45s ease;
    animation: fabIn 0.42s cubic-bezier(.22,1,.36,1) both;
  }
  @keyframes fabIn {
    from { opacity: 0; transform: translateY(30px) scale(0.86); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }
  .fab-btn:hover {
    transform: translateY(-2px) scale(1.04);
    box-shadow: 0 10px 32px rgba(26,86,219,0.55), 0 4px 12px rgba(0,0,0,0.24);
    filter: brightness(1.09);
  }
  .fab-btn:active {
    transform: translateY(0) scale(0.97);
    box-shadow: 0 4px 16px rgba(26,86,219,0.35);
  }
  .fab-btn.loading {
    pointer-events: none;
    filter: brightness(0.82);
  }

  /* Icon & spinner inside button */
  .fab-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  .fab-icon svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: #ffffff;
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .fab-spinner {
    width: 18px;
    height: 18px;
    border: 2.5px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.65s linear infinite;
    display: none;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .fab-btn.loading .fab-spinner { display: block; }
  .fab-btn.loading .fab-icon    { display: none;  }

  /* ── Toast ── */
  .fab-toast {
    position: absolute;
    bottom: 82px;
    right: 20px;
    min-width: 220px;
    max-width: 340px;
    padding: 13px 18px;
    border-radius: 12px;
    font-family: 'Segoe UI', 'Inter', Arial, sans-serif;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.5;
    white-space: pre-line;
    box-shadow: 0 8px 28px rgba(0,0,0,0.24);
    pointer-events: none;
    opacity: 0;
    transform: translateY(10px) scale(0.95);
    transition: opacity 0.25s ease, transform 0.28s cubic-bezier(.22,1,.36,1);
  }
  .fab-toast.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  .fab-toast.success { background: #0d9e4f; color: #fff; }
  .fab-toast.error   { background: #dc2626; color: #fff; }
  .fab-toast.info    { background: #1a56db; color: #fff; }

  /* ── Dialog and Wrapper ── */
  .health-wrapper {
    position: fixed !important;
    inset: 0 !important;
    z-index: 2147483647 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 24px !important;
    background: rgba(11, 28, 48, 0.4) !important;
    backdrop-filter: blur(8px) !important;
    pointer-events: auto !important;
    animation: fadeIn 0.25s ease-out;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .health-dialog {
    width: min(92vw, 520px);
    background: linear-gradient(135deg, #f8f9ff 0%, #e8f0ff 100%);
    border: 1px solid rgba(114,119,134,0.22);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 24px 70px rgba(0,0,0,0.25);
    color: #0b1c30;
    font-family: 'Segoe UI', 'Inter', Arial, sans-serif;
    animation: scaleIn 0.3s cubic-bezier(.22,1,.36,1);
    pointer-events: auto !important;
  }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

  .health-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
    color: white;
  }
  .health-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .health-header-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }
  .health-header-title-wrap {
    display: flex;
    flex-direction: column;
  }
  .health-header-title {
    font-size: 16px;
    font-weight: 700;
  }
  .health-header-subtitle {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.8;
  }
  .health-close-btn {
    all: unset;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    line-height: 1;
    background: rgba(255,255,255,0.16);
    color: white;
    border: 1px solid rgba(255,255,255,0.22);
    cursor: pointer;
    transition: background 0.18s;
  }
  .health-close-btn:hover {
    background: rgba(255,255,255,0.28);
  }

  .health-body {
    padding: 18px 20px;
  }
  .health-meta {
    margin-bottom: 16px;
    padding: 10px 14px;
    background: rgba(255,255,255,0.5);
    border: 1px dashed rgba(99,102,241,0.25);
    border-radius: 10px;
    font-size: 12px;
    color: #424655;
    line-height: 1.5;
  }
  .health-meta strong {
    color: #0b1c30;
  }

  .health-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    margin-bottom: 8px;
    background: #ffffff;
    border: 1px solid rgba(114,119,134,0.15);
    border-left: 4px solid #d92d20;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(11,28,48,0.02);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .health-card:last-child {
    margin-bottom: 0;
  }
  .health-card.pass {
    border-left-color: #1b8a4b;
  }
  .health-card.fail {
    border-left-color: #d92d20;
  }
  .health-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(11,28,48,0.05);
  }

  .health-badge {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    color: #fff;
    flex-shrink: 0;
    font-size: 15px;
    background: linear-gradient(135deg, #d92d20 0%, #f04d3a 100%);
  }
  .health-card.pass .health-badge {
    background: linear-gradient(135deg, #138a4b 0%, #1fb96a 100%);
  }
  .health-card-text {
    flex-grow: 1;
    min-width: 0;
  }
  .health-card-title {
    font-size: 13px;
    font-weight: 700;
    color: #0b1c30;
  }
  .health-card-subtitle {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: #727786;
    letter-spacing: 0.04em;
    margin-top: 1px;
  }
  .health-card-details {
    font-size: 11px;
    color: #555;
    text-align: right;
    font-weight: 600;
    word-break: break-word;
    max-width: 180px;
  }

  .health-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 0 20px 18px;
  }
  .health-btn {
    all: unset;
    border: 1px solid rgba(114,119,134,0.25);
    background: #ffffff;
    color: #0b1c30;
    padding: 8px 16px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    transition: transform 0.15s, background 0.15s;
  }
  .health-btn:hover {
    background: #f6f8ff;
    transform: translateY(-1px);
  }
  .health-btn.primary {
    background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
    color: #ffffff;
    border-color: transparent;
  }
  .health-btn.primary:hover {
    filter: brightness(1.06);
  }
`;

function escapeHtml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getFabShadow() {
  if (_fabShadow) return _fabShadow;
  let targetDoc = document;
  try {
    if (window.top && window.top.document) {
      targetDoc = window.top.document;
    }
  } catch (e) {}
  const host = targetDoc.getElementById(FAB_HOST_ID);
  if (host && host.shadowRoot) {
    _fabShadow = host.shadowRoot;
    return _fabShadow;
  }
  return null;
}

function showHealthReportDialog(ticket) {
  const shadow = getFabShadow();
  if (!ticket || !shadow) return;

  const existing = shadow.querySelector('.health-wrapper');
  if (existing) existing.remove();

  const wrapper = document.createElement('div');
  wrapper.className = 'health-wrapper';

  const soNo = ticket['SO'] || ticket['Service Order No'] || '—';
  const cxName = ticket['CX Name'] || ticket['Customer Name'] || '—';
  const modelName = ticket['Model Name'] || '—';

  const isStPass = ticket['SmartThings Connected(Yes, No)'] === 'YES';
  const isPdaPass = ticket['Arrived PDA into APT Time before one hour or After one hour (YES, NO)'] === 'YES';
  const assignVal = ticket['Eng Assign within One Hour with Date and Time of SVC Assigned Date (YES, NO)'] || '';
  const isAssignPass = assignVal.startsWith('YES');
  const rcVal = ticket['RC Done D+1, D0'] || '';
  const isRcPass = rcVal === 'D0';
  const gdVal = ticket['GD Done on D0, D+1'] || '';
  const isGdPass = gdVal === 'D0' || gdVal === 'D+1';

  wrapper.innerHTML = `
    <div class="health-dialog">
      <div class="health-header">
        <div class="health-header-left">
          <div class="health-header-icon">🩺</div>
          <div class="health-header-title-wrap">
            <div class="health-header-title">Health Report</div>
            <div class="health-header-subtitle">Performance Checklist</div>
          </div>
        </div>
        <button type="button" class="health-close-btn" id="btnHealthClose">×</button>
      </div>
      <div class="health-body">
        <div class="health-meta">
          <strong>Service Order:</strong> ${escapeHtml(soNo)}<br>
          <strong>Customer Name:</strong> ${escapeHtml(cxName)}<br>
          <strong>Model Name:</strong> ${escapeHtml(modelName)}
        </div>
        
        <div class="health-card ${isAssignPass ? 'pass' : 'fail'}">
          <div class="health-badge">${isAssignPass ? '✓' : '✕'}</div>
          <div class="health-card-text">
            <div class="health-card-title">Assigned within 1 Hour</div>
            <div class="health-card-subtitle">SLA Condition 1</div>
          </div>
          <div class="health-card-details">${escapeHtml(assignVal || '-')}</div>
        </div>

        <div class="health-card ${isPdaPass ? 'pass' : 'fail'}">
          <div class="health-badge">${isPdaPass ? '✓' : '✕'}</div>
          <div class="health-card-text">
            <div class="health-card-title">PDA Arrived on Appointment</div>
            <div class="health-card-subtitle">SLA Condition 2</div>
          </div>
          <div class="health-card-details">${escapeHtml(isPdaPass ? 'YES (Within 1 hr)' : 'NO')}</div>
        </div>

        <div class="health-card ${isRcPass ? 'pass' : 'fail'}">
          <div class="health-badge">${isRcPass ? '✓' : '✕'}</div>
          <div class="health-card-text">
            <div class="health-card-title">Repair Completed Same Day</div>
            <div class="health-card-subtitle">SLA Condition 3</div>
          </div>
          <div class="health-card-details">${escapeHtml(rcVal || '-')}</div>
        </div>

        <div class="health-card ${isGdPass ? 'pass' : 'fail'}">
          <div class="health-badge">${isGdPass ? '✓' : '✕'}</div>
          <div class="health-card-text">
            <div class="health-card-title">Goods Delivered D0/D+1</div>
            <div class="health-card-subtitle">SLA Condition 4</div>
          </div>
          <div class="health-card-details">${escapeHtml(gdVal || '-')}</div>
        </div>

        <div class="health-card ${isStPass ? 'pass' : 'fail'}">
          <div class="health-badge">${isStPass ? '✓' : '✕'}</div>
          <div class="health-card-text">
            <div class="health-card-title">SmartThings Connected</div>
            <div class="health-card-subtitle">Enrichment Metric</div>
          </div>
          <div class="health-card-details">${escapeHtml(ticket['SmartThings Connected(Yes, No)'] || '-')}</div>
        </div>
      </div>
      <div class="health-footer">
        <button type="button" class="health-btn primary" id="btnHealthAcknowledge">Acknowledge</button>
      </div>
    </div>
  `;

  const close = () => { wrapper.remove(); };
  wrapper.querySelector('#btnHealthClose').addEventListener('click', close);
  wrapper.querySelector('#btnHealthAcknowledge').addEventListener('click', close);
  wrapper.addEventListener('click', (e) => { if (e.target === wrapper) close(); });

  shadow.appendChild(wrapper);
}

async function handleReportClick() {
  try {
    const stored = await new Promise(r => chrome.storage.local.get(['ghostModeEnabled', 'hideHealthBtn'], r));
    if (stored && (stored.ghostModeEnabled || stored.hideHealthBtn)) {
      console.log('[FAB Report] Execution blocked: Ghost Mode or Hide Health is active.');
      return;
    }
  } catch (e) {}

  const shadow = getFabShadow();
  if (!shadow) return;
  const reportBtn = shadow.querySelector('.report-btn');
  if (reportBtn) {
    reportBtn.style.pointerEvents = 'none';
    reportBtn.style.opacity = '0.7';
  }
  try {
    let handledByComplaintHealth = false;

    window.dispatchEvent(new CustomEvent('GSPN_SHOW_HEALTH_CHECK'));
    if (typeof window.openGspnHealthCheck === 'function') {
      window.openGspnHealthCheck();
      handledByComplaintHealth = true;
    } else if (document.getElementById('complaint-health-wrapper')) {
      handledByComplaintHealth = true;
    }

    if (!handledByComplaintHealth) {
      const ticket = await parseViewModeTicket();
      if (!ticket) {
        showFabToast('No service order data found on this page.', 'error');
        return;
      }
      showHealthReportDialog(ticket);
    }
  } catch (err) {
    console.error('[FAB Report]', err);
    showFabToast('Error generating report: ' + err.message, 'error');
  } finally {
    if (reportBtn) {
      reportBtn.style.pointerEvents = '';
      reportBtn.style.opacity = '';
    }
  }
}

/**
 * Create the Shadow DOM host and inject FAB + toast into it.
 * Host is appended to top document (or current) to prevent frame duplication.
 */
function createFab() {
  if (!shouldShowFab()) return;

  let targetDoc = document;
  try {
    if (window.top && window.top.document) {
      targetDoc = window.top.document;
    }
  } catch (e) {}

  if (targetDoc.getElementById(FAB_HOST_ID)) return;

  // Host element: fixed at bottom-right corner, zero size, overflow visible
  const host = targetDoc.createElement('div');
  host.id = FAB_HOST_ID;
  // Critical host inline styles with !important via setAttribute
  host.setAttribute('style', [
    'position:fixed',
    'bottom:0',
    'right:0',
    'width:0',
    'height:0',
    'overflow:visible',
    'z-index:2147483647',
    'pointer-events:none',
    'display:block',
    'margin:0',
    'padding:0',
    'border:none',
    'background:transparent',
    'transform:none'
  ].join('!important;') + '!important');

  // Attach shadow DOM
  const shadow = host.attachShadow({ mode: 'open' });
  _fabShadow = shadow;

  // Inject styles
  const styleEl = document.createElement('style');
  styleEl.textContent = FAB_SHADOW_CSS;
  shadow.appendChild(styleEl);

  // Buttons container
  const container = document.createElement('div');
  container.className = 'fab-container';

  // Report/Health button
  const reportBtn = document.createElement('button');
  reportBtn.className = 'report-btn';
  reportBtn.title = 'Open Health Check dialog';
  reportBtn.innerHTML =
    '<span class="fab-icon">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' +
      '</svg>' +
    '</span>' +
    '<span class="fab-label">Health</span>';
  reportBtn.addEventListener('click', handleReportClick);
  container.appendChild(reportBtn);

  // FAB button
  const btn = document.createElement('button');
  btn.className = 'fab-btn';
  btn.title = 'Add current service order to 1-1-1 Report (no download)';
  btn.innerHTML =
    '<span class="fab-icon">' +
      '<svg viewBox="0 0 24 24">' +
        '<path d="M12 5v14"/>' +
        '<path d="M5 12h14"/>' +
      '</svg>' +
    '</span>' +
    '<span class="fab-spinner"></span>' +
    '<span class="fab-label">Add 1-1-1 Report</span>';
  btn.addEventListener('click', handleFabClick);
  container.appendChild(btn);

  shadow.appendChild(container);

  // Toast element
  const toast = document.createElement('div');
  toast.className = 'fab-toast';
  shadow.appendChild(toast);

  // Append host to <html>, not <body>, to escape any body-level constraints
  (targetDoc.documentElement || targetDoc.body).appendChild(host);

  // Apply initial storage visibility settings
  try {
    chrome.storage.local.get(['ghostModeEnabled', 'hideHealthBtn', 'hide111Btn', 'complaintHealthEnabled'], (settings) => {
      applyFabVisibility(settings || {});
    });
  } catch (e) {}
}

/**
 * Apply button visibility according to extension settings
 */
function applyFabVisibility(settings) {
  const ghostMode = !!settings.ghostModeEnabled;
  const hideHealth = !!settings.hideHealthBtn || settings.complaintHealthEnabled === false;
  const hide111 = !!settings.hide111Btn;

  let targetDoc = document;
  try {
    if (window.top && window.top.document) {
      targetDoc = window.top.document;
    }
  } catch (e) {}

  const host = targetDoc.getElementById(FAB_HOST_ID);
  if (!host) return;

  const shadow = host.shadowRoot || _fabShadow;
  if (!shadow) return;

  const reportBtn = shadow.querySelector('.report-btn');
  const fabBtn = shadow.querySelector('.fab-btn');

  if (ghostMode) {
    host.style.display = 'none';
    return;
  }

  if (reportBtn) {
    reportBtn.style.display = hideHealth ? 'none' : 'inline-flex';
  }

  if (fabBtn) {
    fabBtn.style.display = hide111 ? 'none' : 'inline-flex';
  }

  if (hideHealth && hide111) {
    host.style.display = 'none';
  } else {
    host.style.display = 'block';
  }
}

/** Show a toast inside the shadow DOM */
function showFabToast(message, type, durationMs) {
  type       = type       || 'success';
  durationMs = durationMs || 3200;
  const shadow = getFabShadow();
  if (!shadow) return;
  const toast = shadow.querySelector('.fab-toast');
  if (!toast) return;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.className = 'fab-toast ' + type;
  toast.innerHTML = '<span style="margin-right:6px">' + icon + '</span>' + message;
  if (toast._timer) clearTimeout(toast._timer);
  void toast.offsetWidth; // reflow
  toast.classList.add('visible');
  toast._timer = setTimeout(function() { toast.classList.remove('visible'); }, durationMs);
}

/** Toggle loading state on the FAB button */
function setFabLoading(on) {
  const shadow = getFabShadow();
  if (!shadow) return;
  const btn = shadow.querySelector('.fab-btn');
  if (btn) btn.classList.toggle('loading', on);
}

/** Brief color pulse on the FAB after success */
function pulseGreen() {
  const shadow = getFabShadow();
  if (!shadow) return;
  const btn = shadow.querySelector('.fab-btn');
  if (!btn) return;
  btn.style.background = 'linear-gradient(135deg,#0d9e4f 0%,#34d399 100%)';
  btn.style.boxShadow  = '0 6px 24px rgba(13,158,79,0.5),0 2px 8px rgba(0,0,0,0.18)';
  setTimeout(function() {
    btn.style.background = '';
    btn.style.boxShadow  = '';
  }, 2000);
}

// ── Helpers (same as before) ──────────────────────────────────────────────────

function mergeColumns111(existing, incoming) {
  const merged = Array.isArray(existing) ? existing.slice() : [];
  for (const col of (Array.isArray(incoming) ? incoming : [])) {
    if (!merged.includes(col)) merged.push(col);
  }
  return merged;
}

function ticketId111(ticket) {
  const so = (ticket && ticket['Service Order No'] ? ticket['Service Order No'] : '').toString().trim();
  if (so) return 'so:' + so.toLowerCase();
  const name = (ticket && ticket['Customer Name'] ? ticket['Customer Name'] : '').toString().trim();
  if (name) return 'name:' + name.toLowerCase();
  return null;
}

const PRODUCT_PFX_111 = {
  RR:'REF',RT:'REF',RF:'REF',RS:'REF',RA:'REF',
  WA:'WM',WT:'WM',WW:'WM',WD:'WM',WF:'WM',
  AR:'RAC',AC:'RAC',AJ:'RAC',AM:'RAC',ACN:'RAC',
  UA:'TV',QA:'TV',HG:'TV',PS:'TV',PN:'TV',UN:'TV',UE:'TV',GU:'TV',
  LH:'DISPLAY',LS:'DISPLAY',
  MC:'MWO',MG:'MWO',MS:'MWO',CE:'MWO',CM:'MWO',
  DW:'DW',DV:'DRYER',VS:'VACUUM',VR:'VACUUM',
  AX:'AIR PURIFIER',HW:'AUDIO',MX:'AUDIO',HT:'AUDIO',
  LC:'MONITOR',LSM:'MONITOR',NV:'OVEN',NQ:'OVEN',NA:'HOB',NZ:'HOB'
};
function getProduct111(model) {
  if (!model) return 'UNKNOWN';
  model = model.toUpperCase().trim();
  const keys = Object.keys(PRODUCT_PFX_111).sort(function(a, b) { return b.length - a.length; });
  for (const k of keys) { if (model.startsWith(k)) return PRODUCT_PFX_111[k]; }
  return 'UNKNOWN';
}

// ── Main FAB click handler ────────────────────────────────────────────────────
async function handleFabClick() {
  try {
    const stored = await new Promise(r => chrome.storage.local.get(['ghostModeEnabled', 'hide111Btn'], r));
    if (stored && (stored.ghostModeEnabled || stored.hide111Btn)) {
      console.log('[FAB] Execution blocked: Ghost Mode or Hide 1-1-1 is active.');
      return;
    }
  } catch (e) {}

  setFabLoading(true);
  try {
    // 1. Scrape
    const ticket = await parseViewModeTicket();
    if (!ticket) {
      showFabToast('No service order data found on this page.', 'error');
      return;
    }

    // Add Product field
    const modelVal = (ticket['Model Name'] || ticket['Model'] || '').toString();
    ticket['Product'] = getProduct111(modelVal);

    const incomingColumns = getColumnsForTicket(ticket);
    if (!incomingColumns.includes('Product')) incomingColumns.push('Product');

    // 2. Load session data
    let existingData    = [];
    let existingColumns = [];
    try {
      const stored = await chrome.storage.session.get(['gspn_scrapedData', 'gspn_scrapedColumns']);
      existingData    = Array.isArray(stored.gspn_scrapedData)    ? stored.gspn_scrapedData    : [];
      existingColumns = Array.isArray(stored.gspn_scrapedColumns) ? stored.gspn_scrapedColumns : [];
    } catch (e) { console.warn('[FAB] Session read:', e); }

    // 3. Deduplicate
    const seenKeys = new Set(existingData.map(ticketId111).filter(Boolean));
    const newKey   = ticketId111(ticket);
    if (newKey && seenKeys.has(newKey)) {
      showFabToast('Already in report:\nSO: ' + (ticket['Service Order No'] || ''), 'info', 3500);
      return;
    }

    // 4. Append & save — NO download
    const updatedData    = existingData.concat([ticket]);
    const updatedColumns = mergeColumns111(existingColumns, incomingColumns);
    await chrome.storage.session.set({
      gspn_scrapedData:    updatedData,
      gspn_scrapedColumns: updatedColumns,
      gspn_statusMerged:   false
    });

    // 5. Feedback
    const soNo  = ticket['Service Order No'] || '—';
    const cName = ticket['Customer Name']    || '';
    showFabToast(
      'Added to 1-1-1 Report (' + updatedData.length + ' total)\nSO: ' + soNo + (cName ? '\n' + cName : ''),
      'success',
      4000
    );
    pulseGreen();

  } catch (err) {
    console.error('[FAB]', err);
    showFabToast('Error: ' + (err.message || 'Unknown error'), 'error');
  } finally {
    setFabLoading(false);
  }
}

// ── Page detection & auto-init ────────────────────────────────────────────────
function shouldInitFabScript() {
  const url = window.location.href || '';
  return (
    url.includes('ServiceOrderDetailLiteCmd')            ||
    url.includes('ServiceOrderDetailCmd')                ||
    url.includes('ServiceOrderListLite')                 ||
    url.includes('so_view_information_by_mangement_lite') ||
    url.includes('manegement_lite')                      ||
    url.includes('call_info_viewing_mode')               ||
    url.includes('svcorder')                             ||
    url.includes('svctracking')                          ||
    url.includes('samsungcsportal.com')                  ||
    url.includes('file://')
  );
}

function shouldShowFab() {
  if (!shouldInitFabScript()) return false;

  const docs = [document];
  try {
    const frames = document.querySelectorAll('iframe, frame');
    for (const frame of frames) {
      try {
        const fDoc = frame.contentDocument || frame.contentWindow?.document;
        if (fDoc) docs.push(fDoc);
      } catch(e) {}
    }
  } catch(e) {}

  for (const docItem of docs) {
    if (docItem.querySelector('input#OBJECT_ID') || docItem.querySelector('span#OBJECT_ID')) {
      return true;
    }

    const tds = docItem.querySelectorAll('td.title, td.ser_ti, th, td, div, span');
    for (const td of tds) {
      const text = (td.textContent || '').toUpperCase().replace(/\s+/g, ' ').trim();
      if (
        text.includes('SERVICE ORDER DETAIL INFORMATION') ||
        text.includes('SERVICE ORDER DETAIL') ||
        text.includes('SERVICE ORDER NO') ||
        text.includes('SERVICE ORDER') ||
        text.includes('CUSTOMER INFORMATION') ||
        text.includes('PRODUCT INFORMATION') ||
        text.includes('GENERAL INFORMATION') ||
        text.includes('JOB INFORMATION')
      ) {
        return true;
      }
    }
  }

  const url = window.location.href || '';
  if (
    url.includes('ServiceOrderDetailLiteCmd') ||
    url.includes('ServiceOrderDetailCmd') ||
    url.includes('so_view_information_by_mangement_lite') ||
    url.includes('call_info_viewing_mode') ||
    url.includes('manegement_lite')
  ) {
    return true;
  }

  return false;
}

async function autoAddManualTicketIfEnabled() {
  if (window.__autoAddedManualTicket) return;
  
  chrome.storage.local.get(['autoAddManualTicketsEnabled', 'ghostModeEnabled', 'hide111Btn'], async (settings) => {
    if (settings && (settings.ghostModeEnabled || settings.hide111Btn)) return;
    if (settings && settings.autoAddManualTicketsEnabled) {
      window.__autoAddedManualTicket = true;
      try {
        // Wait a short time for everything to settle
        await new Promise(r => setTimeout(r, 1200));
        await handleFabClick();
      } catch (err) {
        console.warn('Auto-add manual ticket failed:', err);
      }
    }
  });
}

(function initFab() {
  if (!shouldInitFabScript()) return;

  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        if (changes.ghostModeEnabled || changes.hideHealthBtn || changes.hide111Btn || changes.complaintHealthEnabled) {
          chrome.storage.local.get(['ghostModeEnabled', 'hideHealthBtn', 'hide111Btn', 'complaintHealthEnabled'], (settings) => {
            applyFabVisibility(settings || {});
          });
        }
      }
    });
  } catch (e) {}
  
  const attemptInit = () => {
    if (shouldShowFab()) {
      createFab();
      autoAddManualTicketIfEnabled();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attemptInit);
  } else {
    attemptInit();
  }
  
  // Retries for pages with deferred / iframe-based rendering
  setTimeout(attemptInit, 800);
  setTimeout(attemptInit, 1600);
  setTimeout(attemptInit, 3000);
  
  // Periodic poll fallback (clears once created)
  const pollTimer = setInterval(() => {
    let targetDoc = document;
    try {
      if (window.top && window.top.document) targetDoc = window.top.document;
    } catch(e) {}

    if (targetDoc.getElementById(FAB_HOST_ID)) {
      clearInterval(pollTimer);
      return;
    }
    attemptInit();
  }, 2000);
})();

})();


