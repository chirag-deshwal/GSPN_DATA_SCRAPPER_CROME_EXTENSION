/**
 * excel.js — Excel export utilities for GSPN Website Tools
 */

/**
 * Build an HTML table string from columns and data arrays.
 * @param {string[]} columns - Column headers
 * @param {Object[]} data - Array of row objects
 * @returns {string} HTML table markup
 */
function buildExcelHTML(columns, data) {
  var html = '<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;">';

  // Header row
  html += '<tr>';
  for (var c = 0; c < columns.length; c++) {
    html += '<th style="background:#4472C4;color:#fff;font-weight:bold;padding:6px 10px;white-space:nowrap;">';
    html += escapeHtml(columns[c]);
    html += '</th>';
  }
  html += '</tr>';

  // Data rows
  for (var r = 0; r < data.length; r++) {
    var bgColor = r % 2 === 0 ? '#fff' : '#f2f6fc';
    html += '<tr style="background:' + bgColor + ';">';
    for (var c = 0; c < columns.length; c++) {
      var val = data[r][columns[c]] || '';
      html += '<td style="padding:4px 8px;white-space:nowrap;">' + escapeHtml(val) + '</td>';
    }
    html += '</tr>';
  }

  html += '</table>';
  return html;
}

/**
 * Download data as an .xls file.
 * @param {string[]} columns
 * @param {Object[]} data
 * @param {string} filenamePrefix
 */
function downloadExcel(columns, data, filenamePrefix) {
  var tableHTML = buildExcelHTML(columns, data);
  var fullHTML = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>' +
    '<x:Name>Data</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>' +
    '</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>' + tableHTML + '</body></html>';

  var blob = new Blob([fullHTML], { type: 'application/vnd.ms-excel' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = (filenamePrefix || 'GSPN_Data') + '_' + getTimestamp() + '.xls';
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Copy data as tab-separated text to clipboard.
 * @param {string[]} columns
 * @param {Object[]} data
 * @returns {Promise<boolean>}
 */
async function copyToClipboard(columns, data) {
  var lines = [];

  // Header
  lines.push(columns.join('\t'));

  // Data rows
  for (var r = 0; r < data.length; r++) {
    var row = [];
    for (var c = 0; c < columns.length; c++) {
      row.push(data[r][columns[c]] || '');
    }
    lines.push(row.join('\t'));
  }

  var text = lines.join('\n');

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback: textarea approach
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
    return ok;
  }
}
