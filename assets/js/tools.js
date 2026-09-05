/**
 * tools.js — Page controller for tools.html
 * Handles Step 1 (Print Text) and Step 2 (Management Lite) data inputs.
 */

var combinedState = {
  rawRecords: [],
  columns: [],
  data: [],
  template: 'GGN_OPEN_PENDING',
  sortCol: null,
  sortDir: 1
};

var MASTER_COLUMNS_GGN = [
  'Service Order No','ASC Job No','Customer Name','Customer No',
  'Telephone(Mobile)','Telephone(Home)','Telephone(Office)',
  'City','Address','Model','Product','Serial','Wty Status','TAT',
  'Service Type','Status','Reason','Created','Assigned','Assigned Time',
  'App Date','App Time','Engineer','Symptom 1','Symptom 2','Symptom 3',
  '1st Service Comment','Remark','VOC','REDO','High Priority'
];

var LS_KEY = 'gspn_tools_state';

// ── Custom Template Helpers ──────────────────────────────────────────────────
function getSavedCustomTemplates() {
  try {
    var raw = localStorage.getItem('gspn_custom_templates');
    return raw ? JSON.parse(raw) : [];
  } catch(e) {
    return [];
  }
}

function loadCustomTemplatesInTools() {
  var grid = document.getElementById('combinedTemplateGrid');
  if (!grid) return;

  // Remove existing custom cards and new template button
  grid.querySelectorAll('.custom-tpl-card, .btn-new-tpl-card').forEach(function(el) { el.remove(); });

  var customList = getSavedCustomTemplates();
  customList.forEach(function(tpl) {
    var card = document.createElement('div');
    card.className = 'template-card custom-tpl-card' + (combinedState.template === ('CUSTOM_' + tpl.id) ? ' selected' : '');
    card.dataset.template = 'CUSTOM_' + tpl.id;
    card.onclick = function() { selectCombinedTemplate('CUSTOM_' + tpl.id, card); };

    var colCount = tpl.columns ? tpl.columns.length : 0;
    card.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
      '  <div class="template-badge badge-green" style="margin-bottom:0;">Custom Puzzle</div>' +
      '  <div style="display:flex;gap:6px;align-items:center;">' +
      '    <a href="custom-template.html?edit=' + tpl.id + '" title="Edit in Template Builder" onclick="event.stopPropagation();" style="color:var(--text-soft);text-decoration:none;font-size:12px;">✏️</a>' +
      '    <span title="Delete Template" onclick="event.stopPropagation();deleteCustomTemplateFromTools(\'' + tpl.id + '\');" style="color:#dc2626;cursor:pointer;font-size:12px;font-weight:700;">🗑️</span>' +
      '  </div>' +
      '</div>' +
      '<div class="template-name">' + escapeHtml(tpl.name) + '</div>' +
      '<div class="template-desc">' + colCount + ' mapped column(s). Click to apply format.</div>';

    grid.appendChild(card);
  });

  // Also append "+ New Custom Template" button card
  var addCard = document.createElement('a');
  addCard.href = 'custom-template.html';
  addCard.className = 'template-card btn-new-tpl-card';
  addCard.style.cssText = 'border:2px dashed #cbd5e1;background:rgba(248,250,252,0.6);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;text-decoration:none;cursor:pointer;padding:14px;';
  addCard.innerHTML =
    '<div style="font-size:22px;margin-bottom:4px;">🧩</div>' +
    '<div style="font-weight:700;font-size:12.5px;color:var(--primary);">+ New Custom Template</div>' +
    '<div style="font-size:11px;color:var(--text-soft);">Drag &amp; drop puzzle builder</div>';
  grid.appendChild(addCard);
}

function deleteCustomTemplateFromTools(tplId) {
  if (!confirm('Delete this custom template?')) return;
  var list = getSavedCustomTemplates().filter(function(t) { return t.id !== tplId; });
  try { localStorage.setItem('gspn_custom_templates', JSON.stringify(list)); } catch(e) {}
  if (combinedState.template === 'CUSTOM_' + tplId) {
    combinedState.template = 'GGN_OPEN_PENDING';
  }
  loadCustomTemplatesInTools();
  if (combinedState.rawRecords && combinedState.rawRecords.length > 0) {
    applySelectedTemplate();
    renderCombinedPreview(combinedState.columns, combinedState.data);
    saveState();
  }
  showToast('Custom template deleted.', 'idle');
}

// ── Template Application ─────────────────────────────────────────────────────
function applySelectedTemplate() {
  if (!combinedState.rawRecords || combinedState.rawRecords.length === 0) {
    if (combinedState.data && combinedState.data.length > 0) {
      combinedState.rawRecords = combinedState.data;
    } else {
      return;
    }
  }

  var raw = combinedState.rawRecords;

  if (combinedState.template === 'RAW_DATA') {
    // Preserve all raw keys in the order they appear across records
    var seen = {}, cols = [];
    for (var i = 0; i < raw.length; i++) {
      for (var k in raw[i]) {
        if (k !== '_isMerged' && !seen[k]) {
          seen[k] = true;
          cols.push(k);
        }
      }
    }
    combinedState.columns = cols;
    combinedState.data = raw.map(function(r) { return Object.assign({}, r); });

  } else if (combinedState.template === 'GGN_OPEN_PENDING') {
    // Standard Samsung GGN 31-column template
    combinedState.columns = MASTER_COLUMNS_GGN.slice();
    combinedState.data = raw.map(function(r) {
      var row = {};
      if (r['_isMerged']) row['_isMerged'] = true;
      for (var c = 0; c < MASTER_COLUMNS_GGN.length; c++) {
        var colName = MASTER_COLUMNS_GGN[c];
        row[colName] = (r[colName] !== undefined && r[colName] !== null) ? r[colName] : '';
      }
      return row;
    });

  } else if (combinedState.template.indexOf('CUSTOM_') === 0) {
    var tplId = combinedState.template.substring(7);
    var templates = getSavedCustomTemplates();
    var found = null;
    for (var t = 0; t < templates.length; t++) {
      if (templates[t].id === tplId || templates[t].name === tplId) {
        found = templates[t];
        break;
      }
    }

    if (found && found.columns && found.columns.length > 0) {
      combinedState.columns = found.columns.map(function(c) { return c.name; });
      combinedState.data = raw.map(function(r) {
        var row = {};
        if (r['_isMerged']) row['_isMerged'] = true;
        for (var c = 0; c < found.columns.length; c++) {
          var colDef = found.columns[c];
          if (!colDef.sources || colDef.sources.length === 0) {
            row[colDef.name] = '';
          } else {
            var parts = [];
            for (var s = 0; s < colDef.sources.length; s++) {
              var src = colDef.sources[s];
              if (src.indexOf('__STATIC__:') === 0) {
                parts.push(src.substring(10));
              } else if (r[src] !== undefined && r[src] !== null && r[src] !== '') {
                parts.push(r[src]);
              }
            }
            row[colDef.name] = parts.join(colDef.separator !== undefined ? colDef.separator : ' ');
          }
        }
        return row;
      });
    } else {
      // Fallback
      combinedState.columns = MASTER_COLUMNS_GGN.slice();
      combinedState.data = raw.map(function(r) { return Object.assign({}, r); });
    }
  }
}

// ── Template Selection ───────────────────────────────────────────────────────
function selectCombinedTemplate(templateName, cardEl) {
  var grid = document.getElementById('combinedTemplateGrid');
  if (grid) {
    grid.querySelectorAll('.template-card').forEach(function(c) {
      c.classList.toggle('selected', c.dataset.template === templateName);
    });
  }
  combinedState.template = templateName;

  if (combinedState.rawRecords && combinedState.rawRecords.length > 0) {
    applySelectedTemplate();
    renderCombinedPreview(combinedState.columns, combinedState.data);
    saveState();
    showToast('Applied template: ' + (templateName.indexOf('CUSTOM_') === 0 ? 'Custom Template' : templateName), 'success');
  }
}

function scrollToElement(elId) {
  setTimeout(function() {
    var el = document.getElementById(elId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 120);
}
function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }


// ═══════════════════════════════════════════════════════════════════════════════
// EXTRACTION & COMBINATION
// ═══════════════════════════════════════════════════════════════════════════════
function extractAllCombined() {
  var raw2 = (document.getElementById('inputStep2') || {}).value || '';
  var raw3 = (document.getElementById('inputStep3') || {}).value || '';
  var t2 = raw2.trim(), t3 = raw3.trim();

  if (!t2 && !t3) {
    setStatus('globalStatusBar', 'globalStatusText', 'error', 'Please paste data into at least one step first.');
    showToast('No data to extract.', 'error');
    return;
  }

  setStatus('globalStatusBar', 'globalStatusText', 'loading', 'Extracting & combining...');

  try {
    var pcRecords = [], mlRecords = [];

    if (t2) {
      var res2 = parsePrintCommandText(t2);
      if (res2 && res2.data) pcRecords = pcRecords.concat(res2.data);
    }
    if (t3) {
      var res3 = parseManagementLiteText(t3);
      if (res3 && res3.data) mlRecords = res3.data;
    }

    var combined = [], mergedCount = 0;

    if (pcRecords.length > 0 && mlRecords.length > 0) {
      var map = {};
      for (var i = 0; i < mlRecords.length; i++) {
        var mRow = mlRecords[i];
        var so = (mRow['Service Order No'] || '').trim();
        if (so) map[so] = Object.assign({}, mRow);
        else combined.push(Object.assign({}, mRow));
      }
      for (var j = 0; j < pcRecords.length; j++) {
        var pRow = pcRecords[j];
        var pso = (pRow['Service Order No'] || '').trim();
        if (pso && map[pso]) {
          var target = map[pso];
          for (var key in pRow) {
            if (pRow[key] && (!target[key] || key === 'Address' || key === 'Telephone(Mobile)' ||
                key === 'Engineer' || key === 'Customer No' || key.indexOf('Symptom') !== -1 ||
                key === '1st Service Comment' || key === 'Remark')) {
              target[key] = pRow[key];
            }
          }
          if (pRow['Model Name'] && !target['Model']) target['Model'] = pRow['Model Name'];
          target['_isMerged'] = true;
          mergedCount++;
        } else if (pso) {
          var nr = Object.assign({}, pRow);
          if (nr['Model Name'] && !nr['Model']) nr['Model'] = nr['Model Name'];
          map[pso] = nr;
        } else {
          combined.push(Object.assign({}, pRow));
        }
      }
      for (var k in map) combined.push(map[k]);
    } else if (mlRecords.length > 0) {
      combined = mlRecords;
    } else {
      combined = pcRecords;
      for (var i = 0; i < combined.length; i++) {
        if (combined[i]['Model Name'] && !combined[i]['Model'])
          combined[i]['Model'] = combined[i]['Model Name'];
      }
    }

    if (combined.length === 0) {
      setStatus('globalStatusBar', 'globalStatusText', 'error', 'No valid records found.');
      showToast('No records found. Check pasted formats.', 'error');
      return;
    }

    for (var i = 0; i < combined.length; i++) {
      var cr = combined[i]['Created'] || combined[i]['ASC Assigned'] || '';
      if (cr) {
        var tatDays = calcTAT(cr);
        combined[i]['TAT'] = (typeof tatDays === 'number') ? tatDays + 'd' : '';
      }
      if (!combined[i]['Product'] && combined[i]['Model'])
        combined[i]['Product'] = getProductCategory(combined[i]['Model']);
    }

    combinedState.rawRecords = combined;
    applySelectedTemplate();

    combinedState.sortCol = null;
    combinedState.sortDir = 1;

    var statusMsg = 'Extracted ' + combined.length + ' record(s)';
    if (mergedCount > 0) statusMsg += ' (' + mergedCount + ' merged)';
    statusMsg += '. Results below ↓';

    setStatus('globalStatusBar', 'globalStatusText', 'success', statusMsg);
    showToast(combined.length + ' record(s) extracted!', 'success');
    showCombinedStats('combinedStats', combined, mergedCount);
    renderCombinedPreview(combinedState.columns, combinedState.data);
    showElement('combinedResultsSection');
    toggleBtn('btnExportCombined', true);
    toggleBtn('btnCopyCombined', true);
    saveState();
    scrollToElement('combinedResultsSection');
  } catch (err) {
    console.error('[Extract]', err);
    setStatus('globalStatusBar', 'globalStatusText', 'error', 'Error: ' + err.message);
    showToast('Failed: ' + err.message, 'error');
  }
}

// ── Persist / Restore ────────────────────────────────────────────────────────
function saveState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      inputs: {
        step2: (document.getElementById('inputStep2') || {}).value || '',
        step3: (document.getElementById('inputStep3') || {}).value || ''
      },
      rawRecords: combinedState.rawRecords,
      columns: combinedState.columns,
      data: combinedState.data,
      template: combinedState.template
    }));
    // Also save extracted data for custom template builder and reports
    localStorage.setItem('gspn_extracted_data', JSON.stringify({
      columns: combinedState.columns,
      data: combinedState.data,
      rawRecords: combinedState.rawRecords,
      source: 'Combined',
      timestamp: new Date().toISOString()
    }));
  } catch(e) {}
}

function restoreState() {
  loadCustomTemplatesInTools();
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    var saved = JSON.parse(raw);
    if (!saved) return;

    if (saved.inputs) {
      var in2 = document.getElementById('inputStep2');
      var in3 = document.getElementById('inputStep3');
      if (in2 && saved.inputs.step2) in2.value = saved.inputs.step2;
      if (in3 && saved.inputs.step3) in3.value = saved.inputs.step3;
    }

    if (saved.template) {
      combinedState.template = saved.template;
      var grid = document.getElementById('combinedTemplateGrid');
      if (grid) {
        grid.querySelectorAll('.template-card').forEach(function(c) {
          c.classList.toggle('selected', c.dataset.template === saved.template);
        });
      }
    }

    if (saved.rawRecords && saved.rawRecords.length > 0) {
      combinedState.rawRecords = saved.rawRecords;
    } else if (saved.data && saved.data.length > 0) {
      combinedState.rawRecords = saved.data;
    }

    if (combinedState.rawRecords && combinedState.rawRecords.length > 0) {
      applySelectedTemplate();
      renderCombinedPreview(combinedState.columns, combinedState.data);
      showCombinedStats('combinedStats', combinedState.rawRecords, 0);
      showElement('combinedResultsSection');
      toggleBtn('btnExportCombined', true);
      toggleBtn('btnCopyCombined', true);
      setStatus('globalStatusBar', 'globalStatusText', 'success',
        'Restored ' + combinedState.data.length + ' record(s) from last session.');
    }
  } catch(e) {}
}

function clearAllInputs() {
  var in2 = document.getElementById('inputStep2');
  var in3 = document.getElementById('inputStep3');
  if (in2) in2.value = '';
  if (in3) in3.value = '';
  combinedState.rawRecords = [];
  combinedState.columns = [];
  combinedState.data = [];
  combinedState.sortCol = null;
  try {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem('gspn_extracted_data');
  } catch(e) {}
  setStatus('globalStatusBar', 'globalStatusText', 'idle', 'Paste data into Step 1 or Step 2, then click Extract & Combine Data.');
  hideElement('combinedResultsSection');
  toggleBtn('btnExportCombined', false);
  toggleBtn('btnCopyCombined', false);
  scrollToTop();
  showToast('Cleared all data.', 'idle');
}

function exportCombinedExcel() {
  if (!combinedState.data.length) return;
  var safeName = combinedState.template.replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadExcel(combinedState.columns, combinedState.data, 'GSPN_' + safeName);
  showToast('Excel downloaded (' + combinedState.columns.length + ' cols)!', 'success');
}

async function copyCombinedExcel() {
  if (!combinedState.data.length) return;
  var ok = await copyToClipboard(combinedState.columns, combinedState.data);
  showToast(ok ? 'Copied ' + combinedState.data.length + ' row(s) to clipboard!' : 'Failed to copy.', ok ? 'success' : 'error');
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI RENDERING
// ═══════════════════════════════════════════════════════════════════════════════
function showCombinedStats(statsId, data, mergedCount) {
  var statsEl = document.getElementById(statsId);
  if (!statsEl) return;
  var inW = 0, outW = 0, prodCounts = {};
  for (var i = 0; i < data.length; i++) {
    var wty = (data[i]['Wty Status'] || '').toLowerCase();
    if (wty.indexOf('in warranty') !== -1 || wty.indexOf('in_warranty') !== -1) inW++;
    else outW++;
    var prod = data[i]['Product'] || 'UNKNOWN';
    prodCounts[prod] = (prodCounts[prod] || 0) + 1;
  }
  var topProduct = 'N/A', topCount = 0;
  for (var p in prodCounts) { if (prodCounts[p] > topCount) { topCount = prodCounts[p]; topProduct = p; } }
  var mb = mergedCount > 0 ? '<div class="stat-item"><div class="stat-value" style="color:#7c3aed;">' + mergedCount + '</div><div class="stat-label">Merged</div></div>' : '';
  statsEl.innerHTML =
    '<div class="stat-item"><div class="stat-value">' + data.length + '</div><div class="stat-label">Total</div></div>' +
    '<div class="stat-item"><div class="stat-value" style="color:var(--accent-green);">' + inW + '</div><div class="stat-label">In Warranty</div></div>' +
    '<div class="stat-item"><div class="stat-value" style="color:var(--accent-red);">' + outW + '</div><div class="stat-label">Out Warranty</div></div>' +
    '<div class="stat-item"><div class="stat-value" style="color:#d97706;">' + topProduct + ' (' + topCount + ')</div><div class="stat-label">Top Product</div></div>' + mb;
}

// ── Sort ─────────────────────────────────────────────────────────────────────
function sortBy(colName) {
  combinedState.sortDir = (combinedState.sortCol === colName) ? combinedState.sortDir * -1 : 1;
  combinedState.sortCol = colName;
  var dir = combinedState.sortDir;
  combinedState.data.sort(function(a, b) {
    var av = (a[colName] || '').toString().toLowerCase();
    var bv = (b[colName] || '').toString().toLowerCase();
    var an = parseFloat(av), bn = parseFloat(bv);
    if (!isNaN(an) && !isNaN(bn)) return dir * (an - bn);
    return dir * av.localeCompare(bv);
  });
  renderCombinedPreview(combinedState.columns, combinedState.data);
}

// ── Render Table ─────────────────────────────────────────────────────────────
function renderCombinedPreview(columns, data) {
  var thead = document.getElementById('combinedPreviewHead');
  var tbody = document.getElementById('combinedPreviewBody');
  var info  = document.getElementById('combinedPreviewInfo');
  var searchBox = document.getElementById('tableSearchBox');
  if (!thead || !tbody) return;

  var searchVal = searchBox ? searchBox.value.toLowerCase().trim() : '';
  var displayData = data;
  if (searchVal) {
    displayData = data.filter(function(row) {
      return columns.some(function(col) {
        return (row[col] || '').toString().toLowerCase().indexOf(searchVal) !== -1;
      });
    });
  }

  // Header
  var hHTML = '<tr><th style="font-size:10px;color:#94a3b8;font-weight:600;width:38px;text-align:center;user-select:none;">#</th>';
  for (var c = 0; c < columns.length; c++) {
    var col = columns[c];
    var isSort = combinedState.sortCol === col;
    var arrow = isSort ? (combinedState.sortDir === 1 ? ' ▲' : ' ▼') : ' ⇅';
    hHTML += '<th onclick="sortBy(\'' + col.replace(/'/g, "\\'") + '\')" style="cursor:pointer;user-select:none;white-space:nowrap;">' +
      escapeHtml(col) + '<span style="font-size:9px;color:' + (isSort ? '#2563eb' : '#cbd5e1') + ';">' + arrow + '</span></th>';
  }
  hHTML += '</tr>';
  thead.innerHTML = hHTML;

  // Rows
  var bHTML = '';
  for (var r = 0; r < displayData.length; r++) {
    var isMerged = displayData[r]['_isMerged'];
    bHTML += '<tr' + (isMerged ? ' style="background:rgba(124,58,237,0.04);"' : '') + '>';
    bHTML += '<td style="text-align:center;font-size:10px;color:#94a3b8;font-weight:600;background:rgba(241,245,249,0.7);border-right:1px solid #e2e8f0;">' + (r + 1) + '</td>';
    for (var c = 0; c < columns.length; c++) {
      bHTML += '<td>' + escapeHtml(displayData[r][columns[c]] || '') + '</td>';
    }
    bHTML += '</tr>';
  }
  tbody.innerHTML = bHTML;

  if (info) {
    var shown = displayData.length, total = data.length;
    info.textContent = (shown < total ? shown + '/' + total + ' shown · ' : total + ' record(s) · ') +
      columns.length + ' cols · ' + combinedState.template;
  }
}

function onTableSearch() {
  if (combinedState.data.length > 0) renderCombinedPreview(combinedState.columns, combinedState.data);
}

function toggleBtn(btnId, enabled) {
  var btn = document.getElementById(btnId);
  if (btn) btn.disabled = !enabled;
}
function hideElement(id) { var el = document.getElementById(id); if (el) el.classList.add('hidden'); }
function showElement(id) { var el = document.getElementById(id); if (el) el.classList.remove('hidden'); }

// ── DOMContentLoaded ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  restoreState();
  try {
    var tab  = sessionStorage.getItem('gspn_preload_tab');
    var pdata = sessionStorage.getItem('gspn_preload_data');
    if (tab && pdata) {
      sessionStorage.removeItem('gspn_preload_tab');
      sessionStorage.removeItem('gspn_preload_data');
      var inEl = tab === 'pc' ? document.getElementById('inputStep2')
               : tab === 'ml' ? document.getElementById('inputStep3') : null;
      if (inEl) { inEl.value = pdata; extractAllCombined(); }
    }
  } catch(e) {}
});

