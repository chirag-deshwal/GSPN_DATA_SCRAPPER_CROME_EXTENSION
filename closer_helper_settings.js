/**
 * Closer Helper Settings Page Logic
 * Loads product definitions from products_keys.json (master config).
 * Saves presets to chrome.storage.local under key "closerPresets".
 * Each preset: { id, product, workType, name, fields: { fieldId: value, ... }, fieldMap }
 */

let productConfig = {};   // loaded from products_keys.json
let presets = [];
let activePresetId = null;

const codeSelectOptions = {
  LAB_TYPE: [
    { value: '', label: '- Select -' },
    { value: 'AE', label: 'Accessory Exchange' },
    { value: 'F1', label: 'Flat Rate 1', disabled: true },
    { value: 'FL', label: 'Flat Rate' },
    { value: 'IP', label: 'Inspection' },
    { value: 'L1', label: 'Level 1 Service', disabled: true },
    { value: 'L2', label: 'Level 2 Service', disabled: true },
    { value: 'L3', label: 'Level 3 Service', disabled: true },
    { value: 'MJ', label: 'Major' },
    { value: 'MN', label: 'Minor' },
    { value: 'SP', label: 'Simple Repair' },
    { value: 'UB', label: 'Unbreakable', disabled: true }
  ],
  IRIS_CONDI: [
    { value: '', label: '- Select -' },
    { value: '1', label: '1-Defect' },
    { value: '2', label: '2-No defect' },
    { value: '3', label: "3-Customer's misuse" },
    { value: '4', label: '4-Installation Trouble' },
    { value: '5', label: '5-Software' },
    { value: 'S', label: 'S-LCD Damage by customer faults' },
    { value: 'W', label: 'W-Defect' },
    { value: 'X', label: 'X-No defect' },
    { value: 'Y', label: 'Y-Special repair' },
    { value: 'Z', label: "Z-Customer's misuse" }
  ],
  IRIS_DEFECT: [
    { value: '', label: '- select -' },
    { value: 'A', label: 'A-Worn-out' },
    { value: 'B', label: 'B-Dirty, Glogged' },
    { value: 'C', label: 'C-Misaligned' },
    { value: 'D', label: 'D-Deformed' },
    { value: 'F', label: 'F-Snapped' },
    { value: 'G', label: 'G-Scratched' },
    { value: 'H', label: 'H-Cracked, Peeled' },
    { value: 'I', label: 'I-Loose' },
    { value: 'J', label: 'J-Shaky, Unstable' },
    { value: 'K', label: 'K-Leaking' },
    { value: 'L', label: 'L-Dry' },
    { value: 'M', label: 'M-Forein object' },
    { value: 'N', label: 'N-Exhausted' },
    { value: 'O', label: 'O-Burnt, Arc' },
    { value: 'P', label: 'P-Misaligned' },
    { value: 'Q', label: 'Q-Short' },
    { value: 'R', label: 'R-Open' },
    { value: 'S', label: 'S-Leaking' },
    { value: 'T', label: 'T-Bad connection' },
    { value: 'U', label: 'U-Open pattern' },
    { value: 'V', label: 'V-Cracked PCB' },
    { value: 'W', label: 'W-Cold solder' },
    { value: 'X', label: 'X-Bridge soder' },
    { value: 'Y', label: 'Y-Wrong parts' },
    { value: 'Z', label: 'Z-Software Bug' }
  ],
  DEF_BLK: [
    { value: '', label: '- Select -' },
    { value: '9999', label: '9999-OTHERS' },
    { value: '6W22', label: "6W22-DECK ASS'Y" },
    { value: '6W23', label: "6W23-DRUM ASS'Y" },
    { value: '6W24', label: '6W24-CAPSTAN MOTOR' },
    { value: '6W25', label: '6W25-TRANSPORTING MECHANISM' },
    { value: '6W26', label: '6W26-LOADING MECHANISM' },
    { value: '6W27', label: '6W27-IDLER' },
    { value: '6W28', label: "6W28-HOUSING ASS'Y" },
    { value: '6W29', label: '6W29-POLE BASE' },
    { value: 'PA01', label: 'PA01-U-BEND WELDING POINTS' },
    { value: 'PA02', label: 'PA02-DISCHARGE PIPE (COMPRESSOR)' },
    { value: 'PA03', label: 'PA03-SUCTION PIPE (COMPRESSOR)' },
    { value: 'PA04', label: 'PA04-LEAK ON EVAPORATOR (INDOOR UNIT)' },
    { value: 'PA05', label: 'PA05-LEAK ON CONDENSOR(OUTDOOR UNIT)' },
    { value: 'PA06', label: 'PA06-CAPILLARY TUBE & DRYER' },
    { value: 'PA07', label: 'PA07-SERVICE VALVE LEAKAGE (OUTDOOR)' },
    { value: 'PA08', label: 'PA08-LEAK ON 4 WAY VALVE (CRACK)' },
    { value: 'PA09', label: 'PA09-Gas Recharge' },
    { value: 'PB01', label: 'PB01-COMPRESSOR FAILURE' },
    { value: 'PC01', label: 'PC01-MAIN PCB (INDOOR)' },
    { value: 'PC02', label: 'PC02-MAIN PCB (OUTDOOR)' },
    { value: 'PC03', label: 'PC03-MEMBRANE PCB (WINDOW)' },
    { value: 'PC04', label: 'PC04-CONTROL BOX (OUTDOOR)' },
    { value: 'PD01', label: 'PD01-WIRELESS REMOTE_CONTROLER (PCB FAILURE)' },
    { value: 'PD02', label: 'PD02-WIRED REMOTE CONTROLLER (ONLY DVM)' },
    { value: 'PD03', label: 'PD03-REMOTE RECEIVER PCB (INDOOR UNIT)' },
    { value: 'PE01', label: 'PE01-WIRE CONNECTOR PART' },
    { value: 'PF01', label: 'PF01-INDOOR FAN-MOTOR' },
    { value: 'PF02', label: 'PF02-OUTDOOR FAN-MOTOR' },
    { value: 'PF03', label: 'PF03-SWING/STEP MOTOR' },
    { value: 'PG01', label: 'PG01-INDOOR FAN' },
    { value: 'PG02', label: 'PG02-OUTDOOR FAN' },
    { value: 'PH01', label: 'PH01-POWER RELAY (COMPRESSOR)' },
    { value: 'PH02', label: 'PH02-TRANS POWER (LVT)' },
    { value: 'PH03', label: 'PH03-HEATER (FLOOR STANDING)' },
    { value: 'PH04', label: 'PH04-CAPACITOR COMPRESSOR' },
    { value: 'PH05', label: 'PH05-CAPACITOR FAN-MOTOR' },
    { value: 'PH06', label: 'PH06-VALVE SOLENOID' },
    { value: 'PH07', label: 'PH07-EEV (ELECTRONIC EXPANSION VALVE)' },
    { value: 'PH08', label: 'PH08-FLOAT SWITCH (ONLY DVM)' },
    { value: 'PH09', label: 'PH09-DRAIN PUMP (ONLY DVM)' },
    { value: 'PH10', label: 'PH10-MAGNETIC S/W' },
    { value: 'PJ01', label: 'PJ01-THERMISTOR SENSOR (INDOOR ROOM SENSOR)' },
    { value: 'PJ02', label: 'PJ02-THERMISTOR SENSOR (INDOOR PIPE SENSOR)' },
    { value: 'PJ03', label: 'PJ03-COMP DISCHARGE PIPE SENSOR' },
    { value: 'PL01', label: 'PL01-BLADE-H (CRACK,DEFORMATION)' },
    { value: 'PM01', label: 'PM01-BACK BODY (INDOOR)' },
    { value: 'PM02', label: 'PM02-CABINET FRONT (OUTDOOR)' },
    { value: 'PM03', label: 'PM03-FRONT PANEL GRILLE (INDOOR)' },
    { value: 'PM04', label: 'PM04-Change Packaging' },
    { value: 'PM05', label: 'PM05-Change Accessary' },
    { value: 'PN01', label: 'PN01-CUSTOMER EXPLANATION' },
    { value: 'PP01', label: 'PP01-WATER LEAKAGE (DRAIN PIPE CLOGGED)' },
    { value: 'PP02', label: 'PP02-WATER LEAKAGE (INSTALLATION PROBLEM)' },
    { value: 'PQ01', label: 'PQ01-SERVICE VALVE BAD CONNECTION' },
    { value: 'PQ02', label: 'PQ02-MAIN POWER' },
    { value: 'PQ03', label: 'PQ03-COMMUNICATION WIRE FAILURE (ONLY DVM)' },
    { value: 'PQXX', label: 'PQXX-Others' }
  ],
  IRIS_SYMPT_QCODE: [
    { value: '', label: '- select -' },
    { value: 'SRC003', label: 'SRC003-Cleaning' },
    { value: 'SRC004', label: 'SRC004-Installation Problem' },
    { value: 'SRC007', label: 'SRC007-OS/SW' },
    { value: 'SRC008', label: 'SRC008-Other' },
    { value: 'SRC011', label: 'SRC011-Case Problem' },
    { value: 'SRC012', label: 'SRC012-Power Problem' },
    { value: 'SRC013', label: 'SRC013-Operating Problem' },
    { value: 'SRC014', label: 'SRC014-Display Problem' },
    { value: 'SRC015', label: 'SRC015-Vibration/Noise' },
    { value: 'SRC016', label: 'SRC016-Charging Problem' },
    { value: 'SRC017', label: 'SRC017-Sound' },
    { value: 'SRC018', label: 'SRC018-Communication' },
    { value: 'SRC019', label: 'SRC019-Connection' },
    { value: 'SRC020', label: 'SRC020-Accessory missing' },
    { value: 'SRC021', label: 'SRC021-Heating/Cooling' },
    { value: 'SRC022', label: 'SRC022-Leakage' },
    { value: 'SRC026', label: 'SRC026-Button/Key Problem' },
    { value: 'SRC029', label: 'SRC029-Water Supply' },
    { value: 'SRC030', label: 'SRC030-Rotate Problem' },
    { value: 'SRC031', label: 'SRC031-Smell/Smoke' },
    { value: 'SRC032', label: 'SRC032-Cosmetic' },
    { value: 'SRC038', label: 'SRC038-NDF' },
    { value: 'SRC047', label: 'SRC047-Customer Request' }
  ],
  IRIS_SYMPT: [
    { value: '', label: '- select -' },
    { value: 'AE1', label: 'AE1-No picture/No raster' },
    { value: 'AE2', label: 'AE2-Intermittent picture' },
    { value: 'AE3', label: 'AE3-Only horizontal line' },
    { value: 'AEB', label: 'AEB-No color' },
    { value: 'AEC', label: 'AEC-Weak color' },
    { value: 'AER', label: 'AER-Flickering' },
    { value: 'AX8', label: 'AX8-Installation requested' },
    { value: 'AX9', label: 'AX9-Demo requested' },
    { value: 'HB2', label: 'HB2-Intermittent display' },
    { value: 'HB3', label: 'HB3-Dust/dirt on display' },
    { value: 'HB4', label: 'HB4-Dot/bit missing' },
    { value: 'HB5', label: 'HB5-Display dim' },
    { value: 'HB6', label: 'HB6-Distorted character' },
    { value: 'HB9', label: 'HB9-Faulty temperature display' },
    { value: 'HBB', label: 'HBB-Faulty humidity display' },
    { value: 'HLL', label: 'HLL-No light in the unit' },
    { value: 'HX8', label: 'HX8-Installation requested' }
  ]
};

const codeSelectClasses = {
  LAB_TYPE: 'selectIDS',
  DEF_BLK: 'selectF',
  IRIS_CONDI: 'selectIDS',
  IRIS_DEFECT: 'selectF',
  IRIS_SYMPT_QCODE: 'selectF',
  IRIS_SYMPT: 'selectIDS'
};

function renderSelectOptions(fieldId, selectedValue) {
  const options = codeSelectOptions[fieldId] || [{ value: '', label: '- Select -' }];
  return options.map(opt => {
    const attrs = [];
    if (opt.disabled) attrs.push('disabled');
    if (String(opt.value) === String(selectedValue)) attrs.push('selected');
    return `<option value="${escapeHtml(opt.value)}" ${attrs.join(' ')}>${escapeHtml(opt.label)}</option>`;
  }).join('');
}

const TEAM_OPTIONS = [
  { value: '', label: '— Select Team —' },
  { value: 'Installation-AC', label: 'Installation-AC' },
  { value: 'Installation-HA', label: 'Installation-HA' },
  { value: 'InHome', label: 'InHome' },
  { value: 'AC', label: 'AC' }
];

function renderSelect(fieldId, selectedValue) {
  const cssClass = codeSelectClasses[fieldId] || 'selectF';
  return `<select id="field_${fieldId}" data-field-id="${fieldId}" class="${cssClass}">
    ${renderSelectOptions(fieldId, selectedValue)}
  </select>`;
}

function populateTeamDropdown(selectedTeam) {
  const sel = $('presetTeam');
  if (!sel) return;
  sel.innerHTML = TEAM_OPTIONS.map(opt => {
    const attrs = opt.value === selectedTeam ? ' selected' : '';
    return `<option value="${escapeHtml(opt.value)}"${attrs}>${escapeHtml(opt.label)}</option>`;
  }).join('');
}

/* ─── DOM refs ─── */
const $  = id => document.getElementById(id);
const tabsEl       = $('presetTabs');
const editorEl     = $('presetEditor');
const emptyEl      = $('emptyState');
const toastEl      = $('toast');
const toastTextEl  = $('toastText');

/* ─── Load product config from JSON ─── */
async function loadProductConfig() {
  try {
    const url = chrome.runtime.getURL('webpage_source/src/products_keys.json');
    const resp = await fetch(url);
    const data = await resp.json();
    productConfig = data.products || {};
    console.log('[CloserSettings] Loaded product config:', Object.keys(productConfig));
  } catch (e) {
    console.error('[CloserSettings] Failed to load products_keys.json:', e);
    productConfig = {};
  }
}

/* ─── Storage helpers ─── */
function loadPresets() {
  return new Promise(resolve => {
    chrome.storage.local.get('closerPresets', data => {
      presets = data.closerPresets || [];
      resolve();
    });
  });
}
function savePresets() {
  return new Promise(resolve => {
    chrome.storage.local.set({ closerPresets: presets }, resolve);
  });
}

/* ─── Toast ─── */
function showToast(msg, isError = false) {
  toastTextEl.textContent = msg;
  toastEl.classList.remove('hidden', 'error');
  if (isError) toastEl.classList.add('error');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.add('hidden'), 2500);
}

/* ─── Render tabs ─── */
function renderTabs() {
  tabsEl.innerHTML = '';
  presets.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'preset-tab' + (p.id === activePresetId ? ' active' : '');
    btn.textContent = p.name || 'Untitled';
    btn.addEventListener('click', () => selectPreset(p.id));
    tabsEl.appendChild(btn);
  });
  emptyEl.classList.toggle('hidden', presets.length > 0);
  editorEl.classList.toggle('hidden', !activePresetId);
}

/* ─── Populate product dropdown ─── */
function populateProductDropdown(selectedProduct) {
  const sel = $('presetProduct');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select Category —</option>';
  Object.keys(productConfig).forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${key} — ${productConfig[key].label}`;
    if (key === selectedProduct) opt.selected = true;
    sel.appendChild(opt);
  });
}

/* ─── Populate work type dropdown based on selected product ─── */
function populateWorkTypeDropdown(productKey, selectedWorkType) {
  const sel = $('presetWorkType');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select Work Type —</option>';
  const product = productConfig[productKey];
  if (!product || !product.workTypes) return;
  Object.keys(product.workTypes).forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = product.workTypes[key].label;
    if (key === selectedWorkType) opt.selected = true;
    sel.appendChild(opt);
  });
}

/* ─── Render editable fields based on product + workType ─── */
function renderFieldEditor(productKey, workTypeKey) {
  const container = $('dynamicFields');
  if (!container) return;
  container.innerHTML = '';

  const product = productConfig[productKey];
  if (!product || !product.workTypes || !product.workTypes[workTypeKey]) {
    container.innerHTML = '<p class="section-hint">Select a Category and Work Type above to see fields.</p>';
    return;
  }

  const fields = product.workTypes[workTypeKey].fields;
  const preset = presets.find(p => p.id === activePresetId);
  const savedFields = preset?.fields || {};

  // Helper: get saved value or default
  function val(fieldId) {
    if (savedFields[fieldId] !== undefined) return savedFields[fieldId];
    return fields[fieldId]?.value || '';
  }
  function hint(fieldId) {
    return fields[fieldId]?.valueLabel || '';
  }

  // Build GSPN-style table layout
  let html = '<table class="gspn-form-table">';

  // ── Text areas (full-width rows) ──
  // Status Comment
  if (fields['STATUS_COMMENT']) {
    html += `<tr>
      <td class="gspn-label">▪ Status Comment</td>
      <td class="gspn-input" colspan="3">
        <input id="field_STATUS_COMMENT" type="text" data-field-id="STATUS_COMMENT" value="${escapeHtml(val('STATUS_COMMENT'))}" placeholder="Status Comment..." />
      </td>
    </tr>`;
  }

  // Remark
  if (fields['REMARK']) {
    html += `<tr>
      <td class="gspn-label">▪ Remark</td>
      <td class="gspn-input" colspan="3">
        <input id="field_REMARK" type="text" data-field-id="REMARK" value="${escapeHtml(val('REMARK'))}" placeholder="Remark..." />
      </td>
    </tr>`;
  }

  // Defect Detail DESC
  if (fields['DEFECTDESC_L']) {
    html += `<tr>
      <td class="gspn-label">▪ Defect Detail DESC</td>
      <td class="gspn-input" colspan="3">
        <textarea id="field_DEFECTDESC_L" data-field-id="DEFECTDESC_L" rows="2" placeholder="Defect Detail...">${escapeHtml(val('DEFECTDESC_L'))}</textarea>
      </td>
    </tr>`;
  }

  // Repair Detail DESC
  if (fields['REPAIRDESC_L']) {
    html += `<tr>
      <td class="gspn-label">▪ Repair Detail DESC</td>
      <td class="gspn-input" colspan="3">
        <textarea id="field_REPAIRDESC_L" data-field-id="REPAIRDESC_L" rows="2" placeholder="Repair Detail...">${escapeHtml(val('REPAIRDESC_L'))}</textarea>
      </td>
    </tr>`;
  }

  // Edit Text (EDITEXT)
  if (fields['EDITEXT']) {
    html += `<tr>
      <td class="gspn-label">▪ Edit Text (EDITEXT)</td>
      <td class="gspn-input" colspan="3">
        <textarea id="field_EDITEXT" data-field-id="EDITEXT" rows="2" placeholder="Edit Text for Update (EDITEXT)...">${escapeHtml(val('EDITEXT'))}</textarea>
      </td>
    </tr>`;
  }

  // ── Paired dropdown rows ──

  // Row: Defect Type | Defect Block
  if (fields['LAB_TYPE'] || fields['DEF_BLK']) {
    html += `<tr>
      <td class="gspn-label">▪ Defect Type</td>
      <td class="gspn-input">
        ${renderSelect('LAB_TYPE', val('LAB_TYPE'))}
      </td>
      <td class="gspn-label">▪ Defect Block</td>
      <td class="gspn-input">
        ${renderSelect('DEF_BLK', val('DEF_BLK'))}
      </td>
    </tr>`;
  }

  // Row: Condition Code | Symptom Code (Q-Code + Code)
  html += `<tr>
    <td class="gspn-label">▪ Condition Code</td>
    <td class="gspn-input">
      ${renderSelect('IRIS_CONDI', val('IRIS_CONDI'))}
    </td>
    <td class="gspn-label">Symptom Code</td>
    <td class="gspn-input">
      <div class="gspn-dual-input">
        ${renderSelect('IRIS_SYMPT_QCODE', val('IRIS_SYMPT_QCODE'))}
        ${renderSelect('IRIS_SYMPT', val('IRIS_SYMPT'))}
      </div>
    </td>
  </tr>`;

  // Row: Defect Code | Repair Code (Q-Code + Code)
  html += `<tr>
    <td class="gspn-label">▪ Defect Code</td>
    <td class="gspn-input">
      ${renderSelect('IRIS_DEFECT', val('IRIS_DEFECT'))}
    </td>
    <td class="gspn-label">Repair Code</td>
    <td class="gspn-input">
      <div class="gspn-dual-input">
        <input id="field_IRIS_REPAIR_QCODE" type="text" data-field-id="IRIS_REPAIR_QCODE" value="${escapeHtml(val('IRIS_REPAIR_QCODE'))}" placeholder="${hint('IRIS_REPAIR_QCODE') || 'Q-Code'}" title="Repair Q-Code (parent)" />
        <input id="field_IRIS_REPAIR" type="text" data-field-id="IRIS_REPAIR" value="${escapeHtml(val('IRIS_REPAIR'))}" placeholder="${hint('IRIS_REPAIR') || 'Code'}" title="Repair Code (child)" />
      </div>
    </td>
  </tr>`;

  // Row: Reason Code (full width)
  if (fields['REASON']) {
    html += `<tr>
      <td class="gspn-label">▪ Reason Code</td>
      <td class="gspn-input" colspan="3">
        <input id="field_REASON" type="text" data-field-id="REASON" value="${escapeHtml(val('REASON'))}" placeholder="${hint('REASON') || 'e.g. HLZ23'}" />
      </td>
    </tr>`;
  }

  html += '</table>';
  container.innerHTML = html;
  renderFieldList(productKey, workTypeKey);
}

function renderFieldList(productKey, workTypeKey) {
  const listEl = $('jobDetailsList');
  if (!listEl) return;
  const product = productConfig[productKey];
  if (!product || !product.workTypes || !product.workTypes[workTypeKey]) {
    listEl.innerHTML = '<p class="section-hint">Select a Category and Work Type to see fields.</p>';
    return;
  }

  const fields = product.workTypes[workTypeKey].fields || {};
  const rows = Object.entries(fields).map(([fieldId, def]) => {
    return `<tr>
      <td>${escapeHtml(fieldId)}</td>
      <td>${escapeHtml(def.label || '')}</td>
      <td>${escapeHtml(def.type || '')}</td>
      <td>${escapeHtml(def.value || '')}</td>
      <td>${escapeHtml(def.parent || def.triggers || '')}</td>
    </tr>`;
  }).join('');

  listEl.innerHTML = `
    <table class="job-details-table">
      <thead>
        <tr>
          <th>Field ID</th>
          <th>Label</th>
          <th>Type</th>
          <th>Default</th>
          <th>Parent / Trigger</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ─── Select preset ─── */
function selectPreset(id) {
  activePresetId = id;
  const p = presets.find(x => x.id === id);
  if (!p) return;

  $('presetName').value = p.name || '';
  populateTeamDropdown(p.team);
  populateProductDropdown(p.product);
  populateWorkTypeDropdown(p.product, p.workType);
  renderFieldEditor(p.product, p.workType);
  renderFieldList(p.product, p.workType);
  renderTabs();
}

/* ─── Add preset ─── */
$('btnAddPreset').addEventListener('click', () => {
  const newPreset = {
    id: Date.now().toString(),
    name: '',
    team: '',
    product: '',
    workType: '',
    fields: {},
    fieldMap: {}
  };
  presets.push(newPreset);
  selectPreset(newPreset.id);
  $('presetName').focus();
  savePresets();
});

/* ─── Save preset ─── */
$('btnSave').addEventListener('click', () => {
  if (!activePresetId) return;
  const idx = presets.findIndex(x => x.id === activePresetId);
  if (idx < 0) return;

  const name = $('presetName').value.trim();
  if (!name) {
    showToast('Please enter a preset name!', true);
    $('presetName').focus();
    return;
  }

  const team = $('presetTeam').value;
  const product = $('presetProduct').value;
  const workType = $('presetWorkType').value;

  // Collect all field values from the dynamic editor
  const fields = {};
  document.querySelectorAll('[data-field-id]').forEach(el => {
    const fieldId = el.dataset.fieldId;
    const val = (el.value || '').trim();
    if (val) fields[fieldId] = val;
  });

  // Also populate hidden mirror fields if their visible counterpart has a value
  if (fields['REPAIRDESC_L'])  fields['REPAIR_DESC'] = fields['REPAIRDESC_L'];
  if (fields['DEFECTDESC_L'])  fields['DEFECT_DESC'] = fields['DEFECTDESC_L'];

  // Build the old-format preset data for backward compatibility with closerContent.js
  const preset = {
    id: activePresetId,
    name,
    team,
    product,
    workType,
    fields,
    // Legacy flat fields for closerContent.js compatibility
    repairDetailDesc: fields['REPAIRDESC_L'] || '',
    defectDetailDesc: fields['DEFECTDESC_L'] || '',
    statusComment:    fields['STATUS_COMMENT'] || '',
    remark:           fields['REMARK'] || '',
    editText:         fields['EDITEXT'] || '',
    conditionCode:    fields['IRIS_CONDI'] || '',
    defectType:       fields['LAB_TYPE'] || '',
    defectBlock:      fields['DEF_BLK'] || '',
    reasonCode:       fields['REASON'] || '',
    defectCode:       fields['IRIS_DEFECT'] || '',
    symptomQCode:     fields['IRIS_SYMPT_QCODE'] || '',
    symptomCode:      fields['IRIS_SYMPT'] || '',
    repairQCode:      fields['IRIS_REPAIR_QCODE'] || '',
    repairCode:       fields['IRIS_REPAIR'] || '',
    fieldMap: {
      repairDetail:  'REPAIRDESC_L',
      defectDetail:  'DEFECTDESC_L',
      statusComment: 'STATUS_COMMENT',
      remark:        'REMARK',
      editText:      'EDITEXT',
      symptom:       'IRIS_SYMPT',
      defectBlock:   'DEF_BLK',
      repairCode:    'IRIS_REPAIR',
      condition:     'IRIS_CONDI',
      defectType:    'LAB_TYPE',
      defectCode:    'IRIS_DEFECT'
    }
  };

  presets[idx] = preset;

  savePresets().then(() => {
    renderTabs();
    showToast(`"${name}" saved ✓`);
  });
});

/* ─── Copy/Download preset ─── */
$('btnCopyPreset').addEventListener('click', () => {
  if (!activePresetId) return;

  const name = $('presetName').value.trim() || 'preset';
  const team = $('presetTeam').value;
  const product = $('presetProduct').value;
  const workType = $('presetWorkType').value;

  // Collect all field values from the dynamic editor
  const fields = {};
  document.querySelectorAll('[data-field-id]').forEach(el => {
    const fieldId = el.dataset.fieldId;
    const val = (el.value || '').trim();
    if (val) fields[fieldId] = val;
  });

  if (fields['REPAIRDESC_L'])  fields['REPAIR_DESC'] = fields['REPAIRDESC_L'];
  if (fields['DEFECTDESC_L'])  fields['DEFECT_DESC'] = fields['DEFECTDESC_L'];

  const preset = {
    id: activePresetId,
    name,
    team,
    product,
    workType,
    fields,
    repairDetailDesc: fields['REPAIRDESC_L'] || '',
    defectDetailDesc: fields['DEFECTDESC_L'] || '',
    statusComment:    fields['STATUS_COMMENT'] || '',
    remark:           fields['REMARK'] || '',
    editText:         fields['EDITEXT'] || '',
    conditionCode:    fields['IRIS_CONDI'] || '',
    defectType:       fields['LAB_TYPE'] || '',
    defectBlock:      fields['DEF_BLK'] || '',
    reasonCode:       fields['REASON'] || '',
    defectCode:       fields['IRIS_DEFECT'] || '',
    symptomQCode:     fields['IRIS_SYMPT_QCODE'] || '',
    symptomCode:      fields['IRIS_SYMPT'] || '',
    repairQCode:      fields['IRIS_REPAIR_QCODE'] || '',
    repairCode:       fields['IRIS_REPAIR'] || '',
    fieldMap: {
      repairDetail:  'REPAIRDESC_L',
      defectDetail:  'DEFECTDESC_L',
      statusComment: 'STATUS_COMMENT',
      remark:        'REMARK',
      editText:      'EDITEXT',
      symptom:       'IRIS_SYMPT',
      defectBlock:   'DEF_BLK',
      repairCode:    'IRIS_REPAIR',
      condition:     'IRIS_CONDI',
      defectType:    'LAB_TYPE',
      defectCode:    'IRIS_DEFECT'
    }
  };

  const jsonStr = JSON.stringify(preset, null, 2);

  // 1. Copy to clipboard
  navigator.clipboard.writeText(jsonStr).then(() => {
    showToast('Preset copied to clipboard! ✓');
  }).catch(err => {
    console.error('Failed to copy preset to clipboard:', err);
    showToast('Failed to copy to clipboard', true);
  });

  // 2. Download as preset.json
  try {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'preset.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to download preset:', err);
  }
});

/* ─── Delete preset ─── */
$('btnDelete').addEventListener('click', () => {
  if (!activePresetId) return;
  const p = presets.find(x => x.id === activePresetId);
  if (!confirm(`Delete preset "${p?.name || 'Untitled'}"?`)) return;
  presets = presets.filter(x => x.id !== activePresetId);
  activePresetId = presets.length ? presets[0].id : null;
  savePresets().then(() => {
    if (activePresetId) selectPreset(activePresetId);
    else {
      editorEl.classList.add('hidden');
      renderTabs();
    }
    showToast('Preset deleted');
  });
});

/* ─── Product / Work Type change handlers ─── */
document.addEventListener('change', (e) => {
  if (e.target.id === 'presetProduct') {
    const productKey = e.target.value;
    populateWorkTypeDropdown(productKey, '');
    renderFieldEditor(productKey, '');
    renderFieldList(productKey, '');
  }
  if (e.target.id === 'presetWorkType') {
    const productKey = $('presetProduct').value;
    const workTypeKey = e.target.value;
    renderFieldEditor(productKey, workTypeKey);
    renderFieldList(productKey, workTypeKey);

    // Auto-fill default values from products_keys.json if fields are empty
    const product = productConfig[productKey];
    if (product && product.workTypes && product.workTypes[workTypeKey]) {
      const fields = product.workTypes[workTypeKey].fields;
      Object.entries(fields).forEach(([fieldId, def]) => {
        const el = $(`field_${fieldId}`);
        if (el && !el.value && def.value) {
          el.value = def.value;
        }
      });
    }
  }
});

/* ─── Init ─── */
(async () => {
  await loadProductConfig();
  await loadPresets();
  if (presets.length) {
    activePresetId = presets[0].id;
    selectPreset(activePresetId);
  }
  renderTabs();
})();
