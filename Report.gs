/**
 * Grace Baptist Church - Offering Report: emailed PDF report
 *
 * When the business office saves its verification, verifyReport_ (Code.gs)
 * calls emailReport_, which builds a report of that tab, turns it into a PDF
 * by way of a temporary Google Doc, and emails it to the addresses on the
 * Report Emails tab. The Sheet's Offering menu can send it again.
 *
 * The report is HTML made of tables only: the Google Docs import that turns
 * it into a PDF ignores flexbox, grid, SVG and embedded images, and draws a
 * border on every table cell unless told not to.
 */

const EMAILS_NAME = 'Report Emails';
const REPORT_LOGO_URL = 'https://davidluttrull.github.io/grace-offering/report-logo.png';
const DESIGNATION_TITLES = ['Sunday School Envelopes', 'Other Designations'];

const C_DEEP = '#4E7A34';
const C_BRAND = '#7BAE59';
const C_TINT = '#E3EFD9';
const C_MUTED = '#6B6B6B';
const C_RULE = '#E6E6E6';
const C_MATCH = '#3D7A28';
const C_DIFF = '#8A5200';
const C_DIFF_BG = '#FFF4E0';

/** Adds an Offering menu to the Sheet. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Offering')
    .addItem('Email report for this tab', 'emailActiveReport')
    .addItem('Send me a test report for this tab', 'emailActiveReportToMe')
    .addToUi();
}

/** Menu: (re)send the open tab's report to everyone on the list. */
function emailActiveReport() {
  sendActive_(reportRecipients_());
}

/** Menu: send the open tab's report only to whoever is signed in, to check how it looks. */
function emailActiveReportToMe() {
  sendActive_([Session.getEffectiveUser().getEmail()]);
}

function sendActive_(recipients) {
  const ui = SpreadsheetApp.getUi();
  const sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() === TEMPLATE_NAME || sh.getRange('A1').getValue() !== TITLE) {
    ui.alert('Open an offering report tab first, then try again.');
    return;
  }
  const r = emailReport_(sh, recipients, false);
  ui.alert(r.status === 'sent' ? 'Report emailed to ' + recipients.join(', ') + '.'
    : r.status === 'none' ? 'There are no addresses on the ' + EMAILS_NAME + ' tab, so nothing was sent.'
    : 'The report could not be sent: ' + r.message);
}

/**
 * Builds and emails one tab's report. Never throws: returns
 * {status: 'sent', count}, {status: 'none'} or {status: 'failed', message}.
 * The outcome is also noted on the tab's Verified By date cell.
 */
function emailReport_(sh, recipients, updated) {
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const stamp = Utilities.formatDate(new Date(), tz, 'M/d/yyyy h:mm a');
  const note = function (text) {
    try { sh.getRange(VERIFIED_DATE_CELL).setNote(text); } catch (e) { /* the note is only a record */ }
  };
  if (!recipients.length) {
    note('Report not emailed ' + stamp + ': no addresses on the ' + EMAILS_NAME + ' tab.');
    return { status: 'none' };
  }
  try {
    const d = reportData_(sh, tz);
    MailApp.sendEmail({
      to: recipients.join(','),
      subject: (updated ? 'Updated offering report: ' : 'Offering report: ') + d.shortDate +
        ' (' + usd_(d.totalGiving) + ' total giving)',
      htmlBody: emailHtml_(d, updated),
      body: emailText_(d, updated),
      name: 'Grace Offering',
      attachments: [reportPdf_(reportHtml_(d), 'Offering ' + d.fileDate + '.pdf')],
    });
    note('Report emailed ' + stamp + ' to ' + recipients.length + (recipients.length === 1 ? ' address.' : ' addresses.'));
    return { status: 'sent', count: recipients.length };
  } catch (err) {
    note('Report email failed ' + stamp + ': ' + err.message);
    return { status: 'failed', message: err.message };
  }
}

/** Addresses from the Report Emails tab (column A, below the heading). */
function reportRecipients_() {
  const tab = ensureEmailsTab_();
  const last = tab.getLastRow();
  if (last < 2) return [];
  return tab.getRange(2, 1, last - 1, 1).getValues()
    .map(function (r) { return String(r[0]).trim(); })
    .filter(function (s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); });
}

function ensureEmailsTab_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let tab = ss.getSheetByName(EMAILS_NAME);
  if (!tab) {
    tab = ss.insertSheet(EMAILS_NAME);
    tab.getRange(1, 1, 1, 2).setValues([['Email the report to', 'One address per row in column A. ' +
      'A Google Group or routing address works too. Leave the list empty to stop sending.']]);
    tab.getRange(1, 1).setFontWeight('bold').setFontColor('#ffffff').setBackground('#233617');
    tab.getRange(1, 2).setFontColor(C_MUTED).setFontStyle('italic');
    tab.setColumnWidth(1, 280);
    tab.setFrozenRows(1);
  }
  return tab;
}

// ---- Data -------------------------------------------------------------------

/** Everything the report shows, read from one report tab. */
function reportData_(sh, tz) {
  const num = function (v) { return v === '' || v === null ? null : Number(v); };
  const items = function (a1) {
    // name, quantity, value, amount, office amount
    return sh.getRange(a1).getValues().map(function (v) {
      return { name: v[0], quantity: num(v[1]), counted: Number(v[3]) || 0, office: num(v[4]) };
    });
  };
  const checkCells = sh.getRange('G9:H26').getValues();
  let checkCount = 0;
  checkCells.forEach(function (line) { line.forEach(function (v) { if (typeof v === 'number') checkCount++; }); });
  const totals = sh.getRange('C31:D34').getValues();
  const verifiedBy = String(sh.getRange(VERIFIER_CELL).getValue() || '');
  const verifiedOn = sh.getRange(VERIFIED_DATE_CELL).getValue();
  const date = sh.getRange(DATE_CELL).getValue();
  const online = num(sh.getRange(ONLINE_CELL).getValue());
  const offering = verifiedBy ? Number(totals[3][1]) || 0 : Number(totals[3][0]) || 0;
  const fmt = function (d, p) { return d instanceof Date ? Utilities.formatDate(d, tz, p) : ''; };

  return {
    tab: sh.getName(),
    longDate: fmt(date, 'EEEE, MMMM d, yyyy') || sh.getName(),
    shortDate: fmt(date, 'MMM d, yyyy') || sh.getName(),
    fileDate: fmt(date, 'yyyy-MM-dd') || sh.getName(),
    coins: items('A9:E14'),
    bills: items('A20:E26'),
    checks: { count: checkCount, counted: Number(sh.getRange('H27').getValue()) || 0, office: num(sh.getRange(OFFICE_CHECKS_CELL).getValue()) },
    counted: totals.map(function (r) { return Number(r[0]) || 0; }),
    office: totals.map(function (r) { return Number(r[1]) || 0; }),
    verified: !!verifiedBy,
    verifiedBy: verifiedBy,
    verifiedOn: fmt(verifiedOn, 'EEE, MMM d, yyyy'),
    counters: sh.getRange('G31:G33').getValues().map(function (r) { return String(r[0] || ''); }).filter(Boolean),
    online: online,
    onlineNote: String(sh.getRange(ONLINE_NOTE_CELL).getValue() || ''),
    offering: offering,
    totalGiving: offering + (online || 0),
    designations: readDesignations_(sh),
  };
}

/** The Designations section as [{title, items: [{label, amount}]}], read back from the tab. */
function readDesignations_(sh) {
  const last = sh.getLastRow();
  if (last < DESIGNATIONS_ROW) return [];
  const rows = sh.getRange(DESIGNATIONS_ROW, 1, last - DESIGNATIONS_ROW + 1, 6).getValues();
  const groups = [];
  rows.forEach(function (v) {
    if (DESIGNATION_TITLES.indexOf(String(v[0])) > -1) {
      groups.push({ title: String(v[0]), items: [] });
      return;
    }
    if (!groups.length) return;
    [0, 2, 4].forEach(function (c) {
      const label = String(v[c] || '').trim();
      if (label) groups[groups.length - 1].items.push({ label: label, amount: v[c + 1] === '' ? null : Number(v[c + 1]) });
    });
  });
  return groups;
}

// ---- PDF --------------------------------------------------------------------

/**
 * HTML -> temporary Google Doc (Drive converts it) -> PDF. The Doc is trashed afterwards.
 * The conversion needs the Drive API advanced service (Services + > Drive API in the editor).
 */
function reportPdf_(html, fileName) {
  if (typeof Drive === 'undefined') {
    throw new Error('The Drive API service is off. In Apps Script, click + next to Services, ' +
      'choose Drive API, click Add, then try again.');
  }
  const blob = Utilities.newBlob(html, 'text/html', 'report.html');
  const title = 'Offering report (temporary)';
  // Drive API v3 (the editor's default) has create; v2 has insert.
  const created = Drive.Files.create
    ? Drive.Files.create({ name: title, mimeType: MimeType.GOOGLE_DOCS }, blob)
    : Drive.Files.insert({ title: title, mimeType: MimeType.GOOGLE_DOCS }, blob, { convert: true });
  const file = DriveApp.getFileById(created.id);
  try {
    finishDoc_(DocumentApp.openById(created.id));
    return file.getAs('application/pdf').setName(fileName);
  } finally {
    file.setTrashed(true);
  }
}

/** Page margins and the logo, which the HTML import can't carry. */
function finishDoc_(doc) {
  const body = doc.getBody();
  body.setMarginTop(36).setMarginBottom(36).setMarginLeft(43).setMarginRight(43);
  const logo = takePlaceholder_(body, 'LOGO');
  if (logo) {
    try {
      const img = logo.insertInlineImage(0, UrlFetchApp.fetch(REPORT_LOGO_URL).getBlob());
      const h = 52;
      img.setWidth(Math.round(img.getWidth() * h / img.getHeight())).setHeight(h);
    } catch (e) {
      logo.appendText('GRACE BAPTIST CHURCH').setBold(true).setFontSize(16);
    }
  }
  doc.saveAndClose();
}

/** Removes a [[NAME]] marker and returns the paragraph it was in. */
function takePlaceholder_(body, name) {
  const found = body.findText('\\[\\[' + name + '\\]\\]');
  if (!found) return null;
  const text = found.getElement().asText();
  text.deleteText(found.getStartOffset(), found.getEndOffsetInclusive());
  return text.getParent().asParagraph();
}

// ---- Report HTML ------------------------------------------------------------

/** 1234.5 -> "$1,234.50"; null -> "—". */
function usd_(n) {
  if (n === null || n === undefined || n === '') return '—';
  const c = Math.round(Math.abs(Number(n)) * 100);
  const whole = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (Number(n) < 0 ? '−' : '') + '$' + whole + '.' + ('0' + (c % 100)).slice(-2);
}

/** Office minus counted, as "+$12.00" / "−$3.50", or "Matches". */
function diff_(office, counted) {
  const d = Math.round((office - counted) * 100);
  return d === 0 ? 'Matches' : (d > 0 ? '+' : '−') + usd_(Math.abs(d) / 100);
}

function esc_(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** A table cell. Docs draws a border on every cell unless told not to. */
function td_(content, style) {
  return '<td style="border:none;padding:0;vertical-align:top;' + (style || '') + '">' + content + '</td>';
}

function table_(rows, width) {
  return '<table style="border-collapse:collapse;width:' + width + 'pt">' + rows + '</table>';
}

function heading_(text, top) {
  return '<p style="margin:' + (top === undefined ? 12 : top) + 'pt 0 2pt;font-size:11pt;font-weight:bold;' +
    'color:' + C_DEEP + ';letter-spacing:1px">' + esc_(text.toUpperCase()) + '</p>';
}

function caption_(text) {
  return '<p style="margin:0 0 6pt;font-size:8.5pt;color:' + C_MUTED + '">' + esc_(text) + '</p>';
}

/**
 * A small table with a header row. cols: [{label, width, right}]; rows: arrays
 * of cell HTML; opts.styles: an extra style per row (for subtotal rows).
 * Docs sizes columns from the first row, so the header carries the widths.
 */
function grid_(cols, rows, opts) {
  opts = opts || {};
  const width = cols.reduce(function (t, c) { return t + c.width; }, 0);
  const head = '<tr>' + cols.map(function (c) {
    return td_(esc_(c.label), 'width:' + c.width + 'pt;font-size:7.5pt;color:' + C_MUTED + ';padding:2pt 4pt;' +
      'border-bottom:1.5pt solid ' + C_BRAND + (c.right ? ';text-align:right' : ''));
  }).join('') + '</tr>';
  const body = rows.map(function (cells, i) {
    const extra = (opts.styles && opts.styles[i]) || 'border-bottom:0.5pt solid ' + C_RULE;
    return '<tr>' + cells.map(function (html, j) {
      return td_(html, 'padding:2pt 4pt;font-size:9pt;' + extra + (cols[j].right ? ';text-align:right' : ''));
    }).join('') + '</tr>';
  }).join('');
  return table_(head + body, width);
}

/** A difference cell: green "Matches", amber amount, or a dash when the office left it blank. */
function diffCell_(office, counted) {
  if (office === null) return '<span style="color:#AAAAAA">—</span>';
  const t = diff_(office, counted);
  return t === 'Matches' ? '<span style="color:' + C_MATCH + '">Matches</span>'
    : '<span style="color:' + C_DIFF + ';font-weight:bold">' + t + '</span>';
}

/** The report. Letter page, 526pt between the margins set in finishDoc_. */
function reportHtml_(d) {
  const W = 526;
  const h = [];
  const totalDiff = Math.round((d.office[3] - d.counted[3]) * 100);

  h.push('<html><head><meta charset="utf-8"></head>' +
    '<body style="max-width:526pt;padding:36pt 43pt;font-family:Arial;font-size:10pt;color:#1A1A1A">');

  // Header: logo | title
  h.push(table_('<tr>' + td_('<p style="margin:0">[[LOGO]]</p>', 'width:200pt;vertical-align:middle;padding-bottom:8pt;border-bottom:3pt solid ' + C_BRAND) +
    td_('<p style="margin:0;text-align:right;font-size:17pt;font-weight:bold">OFFERING REPORT</p>' +
      '<p style="margin:0;text-align:right;color:' + C_MUTED + '">' + esc_(d.longDate) + '</p>',
      'width:326pt;vertical-align:middle;padding-bottom:8pt;border-bottom:3pt solid ' + C_BRAND) + '</tr>', W));
  h.push('<p style="margin:0;font-size:6pt">&nbsp;</p>');

  // Tiles: total giving, offering, online giving, count check
  const tile = function (label, value, sub, opts) {
    opts = opts || {};
    return td_('<p style="margin:0;font-size:7.5pt;color:' + (opts.dark ? C_TINT : C_MUTED) + '">' + esc_(label) + '</p>' +
      '<p style="margin:0;font-size:' + (opts.size || 15) + 'pt;font-weight:bold;color:' + (opts.color || (opts.dark ? '#ffffff' : '#1A1A1A')) + '">' + value + '</p>' +
      '<p style="margin:0;font-size:8pt;color:' + (opts.dark ? C_TINT : C_MUTED) + '">' + (sub || '&nbsp;') + '</p>',
      'width:' + opts.width + 'pt;padding:8pt 10pt;' + (opts.dark ? 'background:' + C_DEEP : 'border:1pt solid #D9D9D9') +
      (opts.bg ? ';background:' + opts.bg : ''));
  };
  const gap = td_('', 'width:8pt');
  const check = !d.verified
    ? tile('COUNT CHECK', 'Not verified', 'The office hasn\'t verified this report yet.', { width: 112, size: 13 })
    : totalDiff === 0
      ? tile('COUNT CHECK', 'Matches', 'Office and counters agree', { width: 112, color: C_MATCH })
      : tile('COUNT CHECK', diff_(d.office[3], d.counted[3]), 'Office vs. counters', { width: 112, color: C_DIFF, bg: C_DIFF_BG });
  h.push(table_('<tr>' +
    tile('TOTAL GIVING', usd_(d.totalGiving), 'Offering plus online giving', { width: 154, dark: true, size: 20 }) + gap +
    tile('OFFERING', usd_(d.offering), d.verified ? 'Cash and checks, verified' : 'Cash and checks, as counted', { width: 118 }) + gap +
    tile('ONLINE GIVING', usd_(d.online === null ? 0 : d.online), d.onlineNote ? esc_(d.onlineNote) : 'Entered by the office', { width: 118 }) + gap +
    check + '</tr>', W));

  // Verification summary
  h.push(heading_('Verification'));
  h.push(caption_('What the counters counted beside what the business office counted.'));
  const vRows = [], vStyles = [];
  ['Coins', 'Bills', 'Checks', 'Total Offering'].forEach(function (name, i) {
    const grand = i === 3;
    vRows.push([grand ? '<b>' + name + '</b>' : name, usd_(d.counted[i]), d.verified ? usd_(d.office[i]) : '—',
      d.verified ? diffCell_(d.office[i], d.counted[i]) : '—']);
    vStyles.push(grand ? 'background:' + C_TINT + ';font-weight:bold' : null);
  });
  vRows.push(['Online giving', '', usd_(d.online === null ? 0 : d.online), '']);
  vStyles.push(null);
  vRows.push(['<b>Total giving</b>', '', '<b>' + usd_(d.totalGiving) + '</b>', '']);
  vStyles.push('background:' + C_DEEP + ';color:#ffffff;font-weight:bold');
  h.push(grid_([{ label: '', width: 190 }, { label: 'COUNTED', width: 112, right: true },
    { label: 'OFFICE', width: 112, right: true }, { label: 'DIFFERENCE', width: 112, right: true }], vRows, { styles: vStyles }));

  // Coins and bills side by side
  const money = function (title, list) {
    const rows = list.map(function (x) {
      return [esc_(x.name), x.quantity === null ? '<span style="color:#AAAAAA">—</span>' : String(x.quantity),
        usd_(x.counted), x.office === null ? '<span style="color:#AAAAAA">—</span>' : usd_(x.office)];
    });
    return heading_(title, 10) + grid_([{ label: 'ITEM', width: 86 }, { label: 'QTY', width: 38, right: true },
      { label: 'COUNTED', width: 64, right: true }, { label: 'OFFICE', width: 64, right: true }], rows);
  };
  h.push(table_('<tr>' + td_(money('Coins', d.coins), 'width:255pt') + td_('', 'width:16pt') +
    td_(money('Bills', d.bills), 'width:255pt') + '</tr>', W));
  h.push('<p style="margin:8pt 0 0;font-size:9pt"><b>Checks:</b> ' + d.checks.count + (d.checks.count === 1 ? ' check' : ' checks') +
    ' counted, totaling ' + usd_(d.checks.counted) + '. Office checks total: ' + usd_(d.checks.office) + '.</p>');

  // Designations side by side, listing only the ones that have an amount
  if (d.designations.length) {
    h.push(heading_('Designations'));
    h.push(caption_('Amounts in this section are not added to the Total Offering. Only designations with an amount are listed.'));
    const col = function (g) {
      if (!g) return td_('', 'width:255pt');
      const given = g.items.filter(function (x) { return x.amount !== null; });
      const title = '<p style="margin:4pt 0 2pt;font-size:9.5pt;font-weight:bold">' + esc_(g.title) + '</p>';
      if (!given.length) {
        return td_(title + '<p style="margin:0;font-size:9pt;color:' + C_MUTED + '">None this week.</p>', 'width:255pt');
      }
      const total = given.reduce(function (t, x) { return t + x.amount; }, 0);
      const rows = given.map(function (x) { return [esc_(x.label), usd_(x.amount)]; });
      rows.push(['<b>Total</b>', '<b>' + usd_(total) + '</b>']);
      const styles = given.map(function () { return null; }).concat(['background:' + C_TINT]);
      return td_(title + grid_([{ label: 'NAME', width: 175 }, { label: 'AMOUNT', width: 80, right: true }], rows, { styles: styles }), 'width:255pt');
    };
    for (let i = 0; i < d.designations.length; i += 2) {
      h.push(table_('<tr>' + col(d.designations[i]) + td_('', 'width:16pt') + col(d.designations[i + 1]) + '</tr>', W));
    }
  }

  // Who counted and who verified
  const people = 'Counted by ' + (d.counters.join(', ') || 'no names given') + '. ' +
    (d.verified ? 'Verified by ' + d.verifiedBy + (d.verifiedOn ? ' on ' + d.verifiedOn : '') + '.' : 'Not verified yet.');
  h.push('<p style="margin:14pt 0 0;font-size:9pt;color:' + C_MUTED + '">' + esc_(people) + '</p>');
  h.push('<p style="margin:12pt 0 0;font-size:7.5pt;color:#999999;text-align:center">Sent automatically when the business office saved its verification. ' +
    'Sheet tab: ' + esc_(d.tab) + '.</p>');
  h.push('</body></html>');
  return h.join('\n');
}

// ---- Email body ---------------------------------------------------------------

function emailText_(d, updated) {
  const totalDiff = Math.round((d.office[3] - d.counted[3]) * 100);
  return [
    (updated ? 'Updated offering report for ' : 'Offering report for ') + d.longDate,
    '',
    'Offering: ' + usd_(d.offering),
    'Online giving: ' + usd_(d.online === null ? 0 : d.online) + (d.onlineNote ? ' (' + d.onlineNote + ')' : ''),
    'Total giving: ' + usd_(d.totalGiving),
    '',
    !d.verified ? 'Not verified yet.'
      : totalDiff === 0 ? 'The business office count matches the counters.'
      : 'The business office count differs from the counters by ' + diff_(d.office[3], d.counted[3]) + '.',
    'Counted by ' + (d.counters.join(', ') || 'no names given') + (d.verified ? '. Verified by ' + d.verifiedBy + '.' : '.'),
    '',
    'The full report is attached as a PDF.',
  ].join('\n');
}

function emailHtml_(d, updated) {
  const totalDiff = Math.round((d.office[3] - d.counted[3]) * 100);
  const row = function (label, value, bold) {
    return '<tr><td style="padding:2px 24px 2px 0">' + (bold ? '<b>' + label + '</b>' : label) + '</td>' +
      '<td style="text-align:right">' + (bold ? '<b>' + value + '</b>' : value) + '</td></tr>';
  };
  const status = !d.verified ? 'Not verified yet.'
    : totalDiff === 0 ? '<span style="color:' + C_MATCH + '">The business office count matches the counters.</span>'
    : '<span style="color:' + C_DIFF + ';font-weight:bold">The business office count differs from the counters by ' +
      diff_(d.office[3], d.counted[3]) + '.</span>';
  return '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1A1A1A">' +
    '<p style="margin:0 0 4px;color:' + C_MUTED + '">' + (updated ? 'Updated offering report' : 'Offering report') + ' &middot; ' +
    esc_(d.longDate) + '</p>' +
    '<p style="margin:0 0 12px;font-size:32px;font-weight:bold;color:' + C_DEEP + '">' + usd_(d.totalGiving) +
    ' <span style="font-size:14px;font-weight:normal;color:' + C_MUTED + '">total giving</span></p>' +
    '<table style="border-collapse:collapse;margin-bottom:12px">' +
    row('Offering', usd_(d.offering)) +
    row('Online giving' + (d.onlineNote ? ' <span style="color:' + C_MUTED + '">(' + esc_(d.onlineNote) + ')</span>' : ''),
      usd_(d.online === null ? 0 : d.online)) +
    row('Total giving', usd_(d.totalGiving), true) + '</table>' +
    '<p style="margin:0 0 8px">' + status + '</p>' +
    '<p style="margin:0 0 12px;color:' + C_MUTED + '">Counted by ' + esc_(d.counters.join(', ') || 'no names given') +
    (d.verified ? '. Verified by ' + esc_(d.verifiedBy) + '.' : '.') + '</p>' +
    '<p style="margin:0">The full report is attached as a PDF.</p></div>';
}
