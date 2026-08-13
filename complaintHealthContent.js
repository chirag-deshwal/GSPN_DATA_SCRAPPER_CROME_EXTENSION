/**
 * Complaint Health Detail Content Script
 * Runs on call detail/viewing mode pages
 * Extracts health metrics from Change Log and displays summary box
 */

(function() {
  'use strict';

  const DEBUG = false; // set false in production to avoid heavy logging
  const LOG_SOURCE = 'complaintHealth';

  // Internal state to avoid repeated heavy work
  let _cachedChangeLogTable = null;
  let _healthBoxInjected = false;

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

  function log(...args) {
    if (DEBUG) console.log('[COMPLAINT-HEALTH]', ...args);
  }

  /**
   * Parse Change Log table and extract key events
   */
  function parseChangeLog() {
    log('Parsing Change Log...');
    const changeLog = {
      assignedToSC: null,
      engineerAssigned: null,
      pdaFirst: null,
      repairCompleted: null
    };

    // Try to reuse a cached table reference to avoid scanning the whole DOM repeatedly
    let changeLogTable = _cachedChangeLogTable;
    if (!changeLogTable) {
      const tables = document.querySelectorAll('table');
      log(`Found ${tables.length} tables (searching for change log)`);
      for (let table of tables) {
        const headerText = table.innerText || '';
        if (headerText.includes('Changed Date') && headerText.includes('Status')) {
          changeLogTable = table;
          _cachedChangeLogTable = table;
          log('Change Log table found and cached');
          break;
        }
      }

      if (!changeLogTable) {
        for (let table of tables) {
          const text = table.innerText || '';
          if (text.includes('Assigned to Service Center') || text.includes('Engineer Assigned')) {
            changeLogTable = table;
            _cachedChangeLogTable = table;
            log('Found Change Log via content match and cached');
            break;
          }
        }
      }
    }

    if (!changeLogTable) {
      log('ERROR: Change Log table not found');
      return changeLog;
    }

    // Extract rows from tbody (only from the cached table)
    const rows = changeLogTable.querySelectorAll('tbody tr');
    log(`Change Log has ${rows.length} rows`);
    for (let i = 0; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll('td');
      if (cells.length < 5) continue;

      const dateStr = cells[1]?.innerText?.trim();
      const status = cells[4]?.innerText?.trim();
      const reason = cells[5]?.innerText?.trim();

      log(`Row ${i}: Date="${dateStr}", Status="${status}", Reason="${reason}"`);

      if (!dateStr) continue;

      // Extract timestamp
      const timestamp = parseTimestamp(dateStr);
      if (!timestamp) {
        log(`  → Invalid timestamp format`);
        continue;
      }

      log(`  → Parsed: ${timestamp.toLocaleString('de-DE')}`);

      // Map status/reason to events
      if (status === 'Assigned to Service Center') {
        if (!changeLog.assignedToSC) {
          changeLog.assignedToSC = { dateStr, timestamp };
          log(`  → SET assignedToSC`);
        }
      } else if (status === 'Engineer Assigned' || status === 'Acknowledged (ASC)') {
        if (!changeLog.engineerAssigned) {
          changeLog.engineerAssigned = { dateStr, timestamp };
          log(`  → SET engineerAssigned`);
        }
      } else if (reason?.includes('Engineer Arrived(PDA)') || status?.includes('Engineer Arrived(PDA)')) {
        if (!changeLog.pdaFirst) {
          changeLog.pdaFirst = { dateStr, timestamp };
          log(`  → SET pdaFirst`);
        }
      } else if (status === 'Repair Completed') {
        if (!changeLog.repairCompleted) {
          changeLog.repairCompleted = { dateStr, timestamp };
          log(`  → SET repairCompleted`);
        }
      }
    }

    log('Change Log parsing complete:', changeLog);
    return changeLog;
  }

  /**
   * Parse timestamp string "dd.mm.yyyy hh:mm:ss" to Date object
   */
  function parseTimestamp(dateStr) {
    if (!dateStr || dateStr.includes('00.00.0000') || dateStr.includes('00/00/0000') || dateStr.includes('00-00-0000')) {
      log(`  Timestamp is zero/missing: "${dateStr}"`);
      return null;
    }
    const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (!match) {
      log(`  Timestamp parse failed for: "${dateStr}"`);
      return null;
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

  /**
   * Extract Appointment Date field from page
   */
  function getAppointmentDate() {
    log('Searching for Appointment Date...');
    
    // Method 1: Look for labeled field
    const allElements = document.querySelectorAll('*');
    let appointmentDateStr = null;

    for (let el of allElements) {
      const text = el.innerText?.trim();
      if (text === 'Appointment Date') {
        const parent = el.closest('tr');
        if (parent) {
          const cells = parent.querySelectorAll('td');
          if (cells.length > 1) {
            appointmentDateStr = cells[cells.length - 1]?.innerText?.trim();
            log(`Found Appointment Date (method 1): "${appointmentDateStr}"`);
            break;
          }
        }
      }
    }

    // Method 2: Search in SmartThings row (Appointment date often near there)
    if (!appointmentDateStr) {
      const smartThingsTr = document.getElementById('SmartThingsTr');
      if (smartThingsTr) {
        const tr = smartThingsTr.closest('table')?.querySelectorAll('tr');
        if (tr) {
          for (let row of tr) {
            if (row.innerText.includes('Appointment Date')) {
              const cells = row.querySelectorAll('td');
              if (cells.length > 1) {
                appointmentDateStr = cells[cells.length - 1]?.innerText?.trim();
                log(`Found Appointment Date (method 2): "${appointmentDateStr}"`);
                break;
              }
            }
          }
        }
      }
    }

    if (!appointmentDateStr) {
      log('Appointment Date not found');
      return null;
    }

    const date = parseTimestamp(appointmentDateStr);
    if (date) log(`Parsed Appointment Date: ${date.toLocaleString('de-DE')}`);
    return date;
  }

  /**
   * Extract SmartThings Time field
   */
  function getSmartThingsTime() {
    log('Searching for SmartThings Time...');
    
    const smartThingsTr = document.getElementById('SmartThingsTr');
    if (!smartThingsTr) {
      log('SmartThingsTr not found');
      return null;
    }

    const cells = smartThingsTr.querySelectorAll('td');
    log(`SmartThingsTr has ${cells.length} cells`);
    
    if (cells.length >= 4) {
      const timeStr = cells[3]?.innerText?.trim();
      log(`SmartThings Time field: "${timeStr}"`);
      
      if (timeStr && timeStr.length > 0 && timeStr !== '-') {
        const parsed = parseTimestamp(timeStr);
        if (parsed) {
          log(`SmartThings Time parsed: ${parsed.toLocaleString('de-DE')}`);
          return parsed;
        }
      }
    }

    log('SmartThings Time is empty or not found');
    return null;
  }

  /**
   * Calculate time difference in hours
   */
  function getHoursDifference(date1, date2) {
    if (!date1 || !date2) return null;
    const diffMs = Math.abs(date2.getTime() - date1.getTime());
    return diffMs / (1000 * 60 * 60);
  }

  /**
   * Get date part only (YYYY-MM-DD)
   */
  function getDatePart(date) {
    if (!date) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  /**
   * Calculate all 4 health conditions
   */
  function calculateHealthMetrics() {
    log('Calculating health metrics...');
    
    const changeLog = parseChangeLog();
    const appointmentDate = getAppointmentDate();
    const smartThingsTime = getSmartThingsTime();

    const metrics = {
      condition1: {
        name: 'Assigned within 1 hour',
        passed: false,
        details: ''
      },
      condition2: {
        name: 'PDA on/before appointment',
        passed: false,
        details: ''
      },
      condition3: {
        name: 'RC close same day as appointment',
        passed: false,
        details: ''
      },
      condition4: {
        name: 'SmartThings connected',
        passed: false,
        details: ''
      }
    };

    // Condition 1
    if (changeLog.assignedToSC && changeLog.engineerAssigned) {
      const hoursDiff = getHoursDifference(changeLog.assignedToSC.timestamp, changeLog.engineerAssigned.timestamp);
      if (hoursDiff !== null) {
        metrics.condition1.passed = hoursDiff <= 1;
        metrics.condition1.details = `${hoursDiff.toFixed(2)} hours`;
        log(`Condition 1: ${hoursDiff.toFixed(2)} hours → ${metrics.condition1.passed ? 'PASS' : 'FAIL'}`);
      }
    } else {
      metrics.condition1.details = 'Missing data';
      log('Condition 1: Missing data');
    }

    // Condition 2
    if (changeLog.pdaFirst && appointmentDate) {
      const pdaDate = getDatePart(changeLog.pdaFirst.timestamp);
      const apptDate = getDatePart(appointmentDate);
      metrics.condition2.passed = pdaDate <= apptDate;
      metrics.condition2.details = `PDA: ${changeLog.pdaFirst.dateStr.split(' ')[0]} vs Appt: ${appointmentDate.toLocaleDateString('de-DE')}`;
      log(`Condition 2: ${metrics.condition2.details} → ${metrics.condition2.passed ? 'PASS' : 'FAIL'}`);
    } else {
      metrics.condition2.details = 'Missing data';
      log('Condition 2: Missing data');
    }

    // Condition 3
    if (changeLog.repairCompleted && appointmentDate) {
      const rcDate = getDatePart(changeLog.repairCompleted.timestamp);
      const apptDate = getDatePart(appointmentDate);
      metrics.condition3.passed = rcDate.getTime() === apptDate.getTime();
      metrics.condition3.details = `RC: ${changeLog.repairCompleted.dateStr.split(' ')[0]} vs Appt: ${appointmentDate.toLocaleDateString('de-DE')}`;
      log(`Condition 3: ${metrics.condition3.details} → ${metrics.condition3.passed ? 'PASS' : 'FAIL'}`);
    } else {
      metrics.condition3.details = 'Missing data';
      log('Condition 3: Missing data');
    }

    // Condition 4
    metrics.condition4.passed = smartThingsTime !== null;
    metrics.condition4.details = smartThingsTime ? 
      `Connected: ${smartThingsTime.toLocaleString('de-DE')}` : 
      'Not connected';
    log(`Condition 4: ${metrics.condition4.details} → ${metrics.condition4.passed ? 'PASS' : 'FAIL'}`);

    return metrics;
  }

  /**
   * Create and inject health box into page
   * Enhanced: injects image thumbnail styles for pasted images and sets a periodic refresh
   */
  function injectHealthBox() {
    if (window._complaintHealthDisabled) {
      log('Injection skipped: disabled by user');
      return;
    }

    log('Injecting health box...');

    // Inject global styles for pasted image thumbnails (if not already present)
    if (!document.head.querySelector('style[data-complaint-images]')) {
      const imgStyle = document.createElement('style');
      imgStyle.setAttribute('data-complaint-images', 'true');
      imgStyle.textContent = `
        /* Constrain pasted images in complaint detail area to a thumbnail */
        .complaint-pasted-thumb {
          max-width: 220px !important;
          height: auto !important;
          border: 2px solid rgba(0,0,0,0.15) !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          transition: transform 0.15s ease !important;
          box-shadow: 0 4px 10px rgba(0,0,0,0.25) !important;
        }
        .complaint-pasted-thumb.expanded {
          max-width: none !important;
          width: auto !important;
          transform: scale(1.02) !important;
          z-index: 100000 !important;
          position: relative !important;
        }
        .complaint-thumb-tooltip {
          position: absolute;
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 6px 8px;
          border-radius: 4px;
          font-size: 12px;
          pointer-events: none;
          transform: translateY(-8px);
        }
      `;
      document.head.appendChild(imgStyle);
    }

    if (!document.head.querySelector('style[data-complaint-health-ui]')) {
      const uiStyle = document.createElement('style');
      uiStyle.setAttribute('data-complaint-health-ui', 'true');
      uiStyle.textContent = `
        .complaint-health-dialog * { box-sizing: border-box; }
        .complaint-health-dialog {
          font-family: Inter, "Segoe UI", Arial, sans-serif;
          color: #0b1c30;
        }
        .complaint-health-dialog .metric-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          margin-bottom: 10px;
          background: #ffffff;
          border: 1px solid rgba(114,119,134,0.18);
          border-left: 4px solid #d92d20;
          border-radius: 14px;
          box-shadow: 0 8px 20px rgba(11,28,48,0.04);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .complaint-health-dialog .metric-card.pass {
          border-left-color: #1b8a4b;
        }
        .complaint-health-dialog .metric-card.fail {
          border-left-color: #d92d20;
        }
        .complaint-health-dialog .metric-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px rgba(11,28,48,0.08);
        }
        .complaint-health-dialog .metric-badge {
          width: 40px;
          height: 40px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: #fff;
          flex-shrink: 0;
          font-size: 18px;
          background: linear-gradient(135deg, #d92d20 0%, #f04d3a 100%);
          box-shadow: 0 6px 16px rgba(217,45,32,0.18);
        }
        .complaint-health-dialog .metric-card.pass .metric-badge {
          background: linear-gradient(135deg, #138a4b 0%, #1fb96a 100%);
          box-shadow: 0 6px 16px rgba(19,138,75,0.18);
        }
        .complaint-health-dialog .metric-title {
          font-size: 14px;
          font-weight: 700;
          color: #0b1c30;
          margin-bottom: 2px;
        }
        .complaint-health-dialog .metric-subtitle {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #727786;
        }
        .complaint-health-dialog .metric-details {
          font-size: 12px;
          color: #424655;
          text-align: right;
          max-width: 150px;
          word-break: break-word;
          line-height: 1.35;
        }
        .complaint-health-dialog .dialog-button {
          border: 1px solid rgba(114,119,134,0.25);
          background: #ffffff;
          color: #0b1c30;
          padding: 8px 14px;
          border-radius: 999px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .complaint-health-dialog .dialog-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 14px rgba(11,28,48,0.07);
          background: #f6f8ff;
        }
        .complaint-health-dialog .dialog-button.primary {
          background: linear-gradient(135deg, #0056c6 0%, #0b6df7 100%);
          border-color: transparent;
          color: #ffffff;
        }
      `;
      document.head.appendChild(uiStyle);
    }

    // Helper: apply thumbnail class to images inside complaint detail tables
    function applyThumbnailToImages() {
      try {
        const tables = document.querySelectorAll('table');
        for (let table of tables) {
          const text = table.innerText || '';
          if (text.includes('Changed Date') && text.includes('Status') || text.includes('Assigned to Service Center')) {
            const imgs = table.querySelectorAll('img');
            imgs.forEach(img => {
              if (!img.classList.contains('complaint-pasted-thumb')) {
                img.classList.add('complaint-pasted-thumb');
                img.dataset._origWidth = img.width || img.naturalWidth || '';
                img.dataset._origHeight = img.height || img.naturalHeight || '';
                img.addEventListener('click', (e) => {
                  e.stopPropagation();
                  img.classList.toggle('expanded');
                  let tooltip = img._complaintTooltip;
                  if (img.classList.contains('expanded')) {
                    if (!tooltip) {
                      tooltip = document.createElement('div');
                      tooltip.className = 'complaint-thumb-tooltip';
                      tooltip.textContent = `Size: ${img.dataset._origWidth}×${img.dataset._origHeight}`;
                      img._complaintTooltip = tooltip;
                      img.parentElement && img.parentElement.appendChild(tooltip);
                    }
                    tooltip.style.left = '8px';
                    tooltip.style.top = '8px';
                    tooltip.style.display = 'block';
                  } else {
                    if (tooltip && tooltip.parentElement) tooltip.remove();
                    img._complaintTooltip = null;
                  }
                });
              }
            });
          }
        }
      } catch (e) {
        log('applyThumbnailToImages error', e);
      }
    }

    applyThumbnailToImages();

    if (!window._complaintImageObserver) {
      try {
        window._complaintImageObserver = new MutationObserver(() => {
          clearTimeout(window._complaintImageObserverDebounce);
          window._complaintImageObserverDebounce = setTimeout(() => {
            applyThumbnailToImages();
          }, 200);
        });
        window._complaintImageObserver.observe(document.body, { childList: true, subtree: true });
      } catch (e) {
        log('Failed to create image observer', e);
      }
    }

    const wrapper = document.createElement('div');
    wrapper.id = 'complaint-health-wrapper';
    wrapper.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(11, 28, 48, 0.4);
      backdrop-filter: blur(8px);
      font-family: Inter, "Segoe UI", Arial, sans-serif;
    `;

    const container = document.createElement('div');
    container.id = 'complaint-health-box';
    container.className = 'complaint-health-dialog';
    container.style.cssText = `
      width: min(92vw, 560px);
      background: linear-gradient(135deg, rgba(248,249,255,0.98), rgba(232,240,255,0.97));
      border: 1px solid rgba(114,119,134,0.22);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 24px 70px rgba(0,0,0,0.22);
      color: #0b1c30;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 20px;
      background: linear-gradient(135deg, #0056c6 0%, #0b6df7 100%);
      color: white;
    `;

    const headerLeft = document.createElement('div');
    headerLeft.style.cssText = 'display: flex; align-items: center; gap: 12px;';

    const icon = document.createElement('div');
    icon.style.cssText = `
      width: 40px;
      height: 40px;
      border-radius: 999px;
      background: rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    `;
    icon.textContent = '🩺';

    const titleWrap = document.createElement('div');
    const title = document.createElement('div');
    title.style.cssText = 'font-size: 18px; font-weight: 700;';
    title.textContent = 'Health Check';
    const subtitle = document.createElement('div');
    subtitle.style.cssText = 'font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.8;';
    subtitle.textContent = 'Complaint monitoring';
    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);
    headerLeft.appendChild(icon);
    headerLeft.appendChild(titleWrap);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'dialog-button';
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      width: 36px;
      height: 36px;
      border-radius: 999px;
      padding: 0;
      font-size: 20px;
      line-height: 1;
      background: rgba(255,255,255,0.16);
      color: white;
      border: 1px solid rgba(255,255,255,0.22);
    `;

    const dismiss = () => {
      try { window._complaintHealthDisabled = true; } catch (e) {}
      wrapper.remove();
      removeExistingHealthBox();
      _healthBoxInjected = false;
      log('Health box closed by user; further injections disabled for this page');
    };
    closeBtn.onclick = dismiss;

    header.appendChild(headerLeft);
    header.appendChild(closeBtn);
    container.appendChild(header);

    const body = document.createElement('div');
    body.style.cssText = 'padding: 16px 18px 14px;';

    const metrics = calculateHealthMetrics();
    Object.keys(metrics).forEach(key => {
      const metric = metrics[key];
      const row = document.createElement('div');
      row.className = `metric-card ${metric.passed ? 'pass' : 'fail'}`;
      row.setAttribute('data-metric', key);

      const left = document.createElement('div');
      left.style.cssText = 'display: flex; align-items: center; gap: 12px; min-width: 0;';

      const badge = document.createElement('div');
      badge.className = 'metric-badge complaint-health-indicator';
      badge.textContent = metric.passed ? '✓' : '✕';

      const textWrap = document.createElement('div');
      textWrap.style.cssText = 'min-width: 0;';
      const titleEl = document.createElement('div');
      titleEl.className = 'complaint-health-title metric-title';
      titleEl.textContent = metric.name;
      const subtitleEl = document.createElement('div');
      subtitleEl.className = 'complaint-health-subtitle metric-subtitle';
      subtitleEl.textContent = metric.passed ? 'Healthy' : 'Needs attention';
      textWrap.appendChild(titleEl);
      textWrap.appendChild(subtitleEl);

      const details = document.createElement('div');
      details.className = 'complaint-health-details metric-details';
      details.textContent = metric.details;

      left.appendChild(badge);
      left.appendChild(textWrap);
      row.appendChild(left);
      row.appendChild(details);
      body.appendChild(row);
    });

    const footer = document.createElement('div');
    footer.style.cssText = 'display: flex; justify-content: flex-end; gap: 10px; padding: 0 18px 18px;';

    const downloadBtn = document.createElement('button');
    downloadBtn.type = 'button';
    downloadBtn.className = 'dialog-button';
    downloadBtn.textContent = 'Download Log';
    downloadBtn.onclick = () => {
      const payload = {
        timestamp: new Date().toISOString(),
        pageTitle: document.title,
        metrics
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'complaint-health-log.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    };

    const acknowledgeBtn = document.createElement('button');
    acknowledgeBtn.type = 'button';
    acknowledgeBtn.className = 'dialog-button primary';
    acknowledgeBtn.textContent = 'Acknowledge';
    acknowledgeBtn.onclick = dismiss;

    footer.appendChild(downloadBtn);
    footer.appendChild(acknowledgeBtn);

    container.appendChild(body);
    container.appendChild(footer);
    wrapper.appendChild(container);

    if (document.body) {
      document.body.appendChild(wrapper);
      log('Health box injected into document.body');
    } else {
      log('ERROR: document.body not available');
      return;
    }

    _healthBoxInjected = true;

    try {
      if (window._complaintHealthRefreshInterval) {
        clearInterval(window._complaintHealthRefreshInterval);
      }
      window._complaintHealthRefreshInterval = setInterval(() => {
        if (window._complaintHealthDisabled) {
          clearInterval(window._complaintHealthRefreshInterval);
          window._complaintHealthRefreshInterval = null;
          return;
        }

        if (isComplaintDetailVisible()) {
          if (_healthBoxInjected) {
            try { updateHealthBox(); } catch (e) { log('updateHealthBox failed', e); }
          } else {
            removeExistingHealthBox();
            injectHealthBox();
          }
        } else {
          clearInterval(window._complaintHealthRefreshInterval);
          window._complaintHealthRefreshInterval = null;
        }
      }, 60000);
    } catch (e) {
      log('Failed to setup periodic refresh', e);
    }

    log('Health box injected successfully');
  }

  /**
   * Check if complaint details are currently displayed
   */
  function isComplaintDetailVisible() {
    // Check main document
    const tables = document.querySelectorAll('table');
    log(`DEBUG isComplaintDetailVisible: Found ${tables.length} tables in main doc`);
    
    for (let i = 0; i < tables.length; i++) {
      const text = tables[i].innerText;
      if (text.includes('Changed Date') && text.includes('Status')) {
        log(`DEBUG: Found Change Log at table ${i}`);
        return true;
      }
    }

    // Check for table with specific content patterns
    for (let i = 0; i < tables.length; i++) {
      const text = tables[i].innerText;
      if (text.includes('Assigned to Service Center') || text.includes('Engineer Assigned')) {
        log(`DEBUG: Found table with assignment events at table ${i}`);
        return true;
      }
    }

    // Check iframes
    const iframes = document.querySelectorAll('iframe');
    log(`DEBUG: Found ${iframes.length} iframes`);
    
    for (let iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const iframeTables = iframeDoc.querySelectorAll('table');
          log(`DEBUG: iframe has ${iframeTables.length} tables`);
          
          for (let table of iframeTables) {
            const text = table.innerText;
            if (text.includes('Changed Date') && text.includes('Status')) {
              log(`DEBUG: Found Change Log in iframe`);
              // cache iframe table to speed future parsing if accessible
              try { _cachedChangeLogTable = table; } catch (e) {}
              return true;
            }
            if (text.includes('Assigned to Service Center')) {
              log(`DEBUG: Found assignment table in iframe`);
              return true;
            }
          }
        }
      } catch (e) {
        log(`DEBUG: Cannot access iframe: ${e.message}`);
      }
    }

    log('DEBUG: No complaint detail visible');
    return false;
  }

  /**
   * Remove existing health box if present
   */
  function removeExistingHealthBox() {
    const existing = document.getElementById('complaint-health-wrapper') || document.getElementById('complaint-health-box');
    if (existing) {
      try { existing.remove(); } catch (e) { /* ignore */ }
    }

    // Clear periodic refresh interval if present
    try {
      if (window._complaintHealthRefreshInterval) {
        clearInterval(window._complaintHealthRefreshInterval);
        window._complaintHealthRefreshInterval = null;
      }
    } catch (e) {
      log('Error clearing refresh interval', e);
    }

    // Disconnect image observer if exists
    try {
      if (window._complaintImageObserver) {
        window._complaintImageObserver.disconnect();
        window._complaintImageObserver = null;
      }
      if (window._complaintImageObserverDebounce) {
        clearTimeout(window._complaintImageObserverDebounce);
        window._complaintImageObserverDebounce = null;
      }
    } catch (e) {
      log('Error disconnecting image observer', e);
    }
  }

  /**
   * Update health box in-place by recalculating metrics and updating elements
   */
  function updateHealthBox() {
    const wrapper = document.getElementById('complaint-health-wrapper');
    if (!wrapper) return;
    const metrics = calculateHealthMetrics();
    Object.keys(metrics).forEach(key => {
      const metric = metrics[key];
      const row = wrapper.querySelector(`[data-metric="${key}"]`);
      if (!row) return;

      const indicator = row.querySelector('.complaint-health-indicator');
      const title = row.querySelector('.complaint-health-title');
      const subtitle = row.querySelector('.complaint-health-subtitle');
      const details = row.querySelector('.complaint-health-details');

      row.classList.toggle('pass', metric.passed);
      row.classList.toggle('fail', !metric.passed);

      if (indicator) {
        indicator.textContent = metric.passed ? '✓' : '✗';
      }
      if (title) {
        title.textContent = metric.name;
      }
      if (subtitle) {
        subtitle.textContent = metric.passed ? 'Healthy' : 'Needs attention';
      }
      if (details) {
        details.textContent = metric.details || '';
      }
    });
  }

  /**
   * Monitor for complaint detail view and inject box when visible
   */
  function monitorComplaintDetails() {
    log('Starting complaint detail monitor...');

    // Storage listener for live ON/OFF toggling from popup
    try {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && Object.prototype.hasOwnProperty.call(changes, 'complaintHealthEnabled')) {
          const enabled = changes.complaintHealthEnabled.newValue !== false;
          if (!enabled) {
            window._complaintHealthDisabled = true;
            removeExistingHealthBox();
          } else {
            window._complaintHealthDisabled = false;
            if (isComplaintDetailVisible()) {
              removeExistingHealthBox();
              injectHealthBox();
            }
          }
        }
      });
    } catch (e) {
      log('Failed to attach storage listener', e);
    }

    // Check extension setting first
    chrome.storage.local.get(['complaintHealthEnabled'], (data) => {
      if (data.complaintHealthEnabled === false) {
        window._complaintHealthDisabled = true;
        log('Complaint health dialog disabled via popup setting');
        return;
      }

      if (window._complaintHealthDisabled) {
        log('Complaint health injection disabled for this page (user closed it)');
        return;
      }

      if (isComplaintDetailVisible()) {
        log('Complaint detail visible on init');
        removeExistingHealthBox();
        injectHealthBox();
      } else {
        log('No complaint detail on initial check');
      }

      // Watch for DOM changes but target a narrower container when possible
      const preferredSelectors = ['#content', '#detailDiv', '.detail', '#main', 'body'];
      let target = null;
      for (const sel of preferredSelectors) {
        const el = document.querySelector(sel);
        if (el) { target = el; break; }
      }

      const observerTarget = target || document.body;
      const observer = new MutationObserver((mutations) => {
        clearTimeout(observer.debounceTimer);
        observer.debounceTimer = setTimeout(() => {
          if (window._complaintHealthDisabled) {
            removeExistingHealthBox();
            return;
          }

          if (isComplaintDetailVisible()) {
            if (_healthBoxInjected) {
              updateHealthBox();
            } else {
              removeExistingHealthBox();
              injectHealthBox();
              _healthBoxInjected = true;
            }
          } else {
            removeExistingHealthBox();
            _healthBoxInjected = false;
          }
        }, 500);
      });

      observer.observe(observerTarget, {
        childList: true,
        subtree: true
      });

      log('Monitor started - watching for mutations on', observerTarget.tagName || 'BODY');
    });
  }

  /**
   * Initialize when page loads
   */
  function init() {
    log('Script initialized');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', monitorComplaintDetails);
    } else {
      monitorComplaintDetails();
    }
  }

  // Start
  init();

})();
