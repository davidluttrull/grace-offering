/**
 * Grace Baptist Church - Offering Report
 *
 * Back end for the counters' offering page (index.html, hosted on GitHub
 * Pages). setup() builds a "Template" tab laid out like the church's paper
 * offering report. Each submission copies it into a new tab named for the
 * report date and fills in the green cells. The template's own formulas work
 * out the coin, bill, check and offering totals.
 *
 * The business office's page (office.html) uses the same script the next day:
 * it lists the report tabs, shows the counters' figures, and saves the
 * office's own figures into the "Business Office Only" cells, plus the week's
 * online giving. Below the Designations it adds the office's amount for each
 * designation and any cash given after the count ("Cash Unaccounted"). Saving
 * also emails a PDF report to the staff (Report.gs).
 * See SETUP.md for how to deploy it.
 *
 * Every cell address below matches the church's offering report layout. If
 * the template is rearranged, update these addresses to match. The
 * Designations section is the exception: the script lays it out on each new
 * tab from the two lists below, so classes and designations can be added or
 * renamed here without touching the Sheet.
 */

const TEMPLATE_NAME = 'Template';
const TITLE = 'Grace Baptist Church Offering Report';
const DATE_CELL = 'B4';

const COINS = [
  { name: 'Pennies', cell: 'B9', value: 0.01 },
  { name: 'Nickels', cell: 'B10', value: 0.05 },
  { name: 'Dimes', cell: 'B11', value: 0.10 },
  { name: 'Quarters', cell: 'B12', value: 0.25 },
  { name: 'Half Dollar', cell: 'B13', value: 0.50 },
  { name: 'Dollar Coin', cell: 'B14', value: 1 },
];

const BILLS = [
  { name: 'Ones', cell: 'B20', value: 1 },
  { name: 'Twos', cell: 'B21', value: 2 },
  { name: 'Fives', cell: 'B22', value: 5 },
  { name: 'Tens', cell: 'B23', value: 10 },
  { name: 'Twenties', cell: 'B24', value: 20 },
  { name: 'Fifties', cell: 'B25', value: 50 },
  { name: 'Hundreds', cell: 'B26', value: 100 },
];

// Individual check amounts fill column G, then column H. Rows 17-18 are one
// merged cell in each column.
const CHECK_CELLS = [].concat(
  ['G9', 'G10', 'G11', 'G12', 'G13', 'G14', 'G15', 'G16', 'G17',
   'G19', 'G20', 'G21', 'G22', 'G23', 'G24', 'G25', 'G26'],
  ['H9', 'H10', 'H11', 'H12', 'H13', 'H14', 'H15', 'H16', 'H17',
   'H19', 'H20', 'H21', 'H22', 'H23', 'H24', 'H25', 'H26']);

const COUNTER_CELLS = ['G31', 'G32', 'G33'];

// Designations, in the order they appear on the page and the report. Counters
// can also add their own with the page's + buttons (up to MAX_EXTRAS each).
const SUNDAY_SCHOOL = [
  'Women Walking w/ Purpose', "Men's Class (Bronkema)", 'Auditorium (Dubois)',
  'Youth', 'Morning Glory (Ward)', 'College and Career',
];
const OTHER_DESIGNATIONS = [
  'Sew and Share', 'Missions', 'Sunday School Books', 'Missions - Jimmy Gilbert',
  'Spanish Check', 'Spanish Cash', "God's Turn", 'Keenagers',
];
const MAX_EXTRAS = 10;

// The Designations section starts at this row, below the "Designations" title,
// and is laid out three to a row like the paper report: label in A, C, E and
// amount in B, D and F:G.
const DESIGNATIONS_ROW = 39;
const AMOUNT_FORMAT = '_("$"* #,##0.00_);_("$"* \\(#,##0.00\\);_("$"* "-"??_);_(@_)';

// "Business Office Only" cells, filled in from the office's page. E9:E14 and
// E20:E26 hold the office's dollar amount for each coin and bill; D33 its
// checks total. D31, D32 and the totals below them are formulas.
const OFFICE_COIN_RANGE = 'E9:E14';
const OFFICE_BILL_RANGE = 'E20:E26';
const OFFICE_CHECKS_CELL = 'D33';
const VERIFIER_CELL = 'G36';
const VERIFIED_DATE_CELL = 'H36';
// Under the Totals box: the office's online giving for the week (D35), a note
// about it (E35), and Total Giving = Total Offering + online giving (D36).
const ONLINE_CELL = 'D35';
const ONLINE_NOTE_CELL = 'E35';
const TOTAL_GIVING_CELL = 'D36';
const OFFICE_CELLS = [OFFICE_COIN_RANGE, OFFICE_BILL_RANGE, OFFICE_CHECKS_CELL, VERIFIER_CELL, VERIFIED_DATE_CELL,
  ONLINE_CELL, ONLINE_NOTE_CELL];
// Below the counters' Designations section, verifying adds the office's own
// designation amounts and any cash given after the count. Each verification
// rewrites everything from the first of these titles down.
const OFFICE_DES_TITLE = 'Designations: Business Office';
const CASH_TITLE = 'Cash Unaccounted';
const DES_TOTAL_LABEL = 'Designations total';
const CASH_TOTAL_LABEL = 'Cash unaccounted total';
const MAX_CASH = 10;
const MAX_LISTED_REPORTS = 25;

const MAX_COUNT = 100000;
const MAX_AMOUNT = 1000000;
const MAX_BAD_CODES = 20;   // wrong counter codes allowed per 10 minutes, across all phones

/** GET: the designation lists the page shows. Also confirms the deployment is live. */
function doGet() {
  return json_({ status: 'ok', sundaySchool: SUNDAY_SCHOOL, otherDesignations: OTHER_DESIGNATIONS });
}

/** POST from the page, body = the report. Sent as plain text with no Google login. */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    // The counters' page sends a report; the office's page sends an action.
    if (!body.action) return json_(submitReport(body));
    if (!codeIsRight_(body.code, 'OFFICE_CODE')) return json_({ status: 'badcode' });
    if (body.action === 'reports') return json_(listReports_());
    if (body.action === 'report') return json_(getReport_(body.tab));
    if (body.action === 'verify') return json_(verifyReport_(body));
    throw new Error('Unknown action.');
  } catch (err) {
    return json_({ status: 'error', message: err.message });
  }
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Run once from the editor. Builds the Template tab (unless there already is
 * one), moves it to the end, and creates a counter code, shown in the
 * Execution log. Safe to run again: an existing Template is only emptied of
 * numbers. To rebuild it from scratch, delete the Template tab and run setup.
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let template = ss.getSheetByName(TEMPLATE_NAME);
  if (!template) {
    const sheets = ss.getSheets();
    // A brand-new spreadsheet has one empty "Sheet1": reuse it.
    template = sheets.length === 1 && sheets[0].getLastRow() === 0
      ? sheets[0].setName(TEMPLATE_NAME)
      : ss.insertSheet(TEMPLATE_NAME);
    buildTemplate_(template);
  }
  ensureOnlineRows_(template);
  template.getRangeList(inputCells_().concat(OFFICE_CELLS)).clearContent();
  // Each report lays out its own Designations section below the title.
  template.getRange('A' + DESIGNATIONS_ROW + ':H' + (DESIGNATIONS_ROW + 60)).breakApart().clear();
  ensureEmailsTab_();
  ss.setActiveSheet(template);
  ss.moveActiveSheet(ss.getNumSheets());

  const props = PropertiesService.getScriptProperties();
  [['COUNTER_CODE', 'Counter code'], ['OFFICE_CODE', 'Business office code']].forEach(function (c) {
    let code = props.getProperty(c[0]);
    if (!code) {
      code = String(Math.floor(100000 + Math.random() * 900000));
      props.setProperty(c[0], code);
    }
    Logger.log(c[1] + ': ' + code);
  });
}

/**
 * Lays out the church's offering report (rows 1-37) on an empty tab: the same
 * text, formulas, colors, borders, number formats, row heights and column
 * widths as the paper report. Green cells are the ones the page fills in.
 */
function buildTemplate_(sheet) {
  const GREEN = '#D9EAD3';
  const GRAY = '#D9D9D9';
  const DOLLARS = AMOUNT_FORMAT;
  const r = function (a1) { return sheet.getRange(a1); };
  const box = function (a1) { return r(a1).setBorder(true, true, true, true, true, true); };
  const header = function (a1) {
    return r(a1).setBackground(GRAY).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  };

  r('A1:H40').setFontFamily('Arial').setFontSize(11).setVerticalAlignment('bottom');
  [129, 129, 129, 129, 129, 48, 129, 129].forEach(function (w, i) { sheet.setColumnWidth(i + 1, w); });
  const heights = { 1: 50, 4: 29, 5: 29, 7: 31, 8: 43, 16: 35, 19: 43, 27: 35, 30: 43, 34: 35 };
  for (let row = 1; row <= 37; row++) sheet.setRowHeight(row, heights[row] || (row >= 9 && row <= 33 && row !== 17 && row !== 18 && row !== 28 && row !== 29 ? 27 : 21));

  // Title, date, instructions
  r('A1:H1').merge().setValue(TITLE)
    .setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  r('A4').setValue('Report Date:');
  r('B4:C4').merge().setBackground(GREEN).setHorizontalAlignment('right').setNumberFormat('M/d/yyyy')
    .setBorder(null, null, true, null, null, null);
  r('A7:H7').merge().setValue('Instructions:  Enter amounts and text in the green cells only').setFontSize(10);

  // Coins (rows 8-16) and bills (rows 19-27)
  [[8, 'Coins', COINS, 16, 'Total Coins'], [19, 'Bills', BILLS, 27, 'Total Bills']].forEach(function (block) {
    const top = block[0], list = block[2], total = block[3];
    r('A' + top + ':E' + top).setValues([[block[1], 'Quantity', 'Value', 'Amount', 'Business Office Only']]);
    header('A' + top + ':E' + top);
    r('E' + top).setWrap(true);
    list.forEach(function (item, i) {
      const row = top + 1 + i;
      r('A' + row).setValue(item.name).setHorizontalAlignment('left');
      r('C' + row).setValue(item.value);
      r('D' + row).setFormula('=B' + row + '*C' + row);
    });
    const first = top + 1, last = top + list.length;
    r('B' + first + ':B' + last).setBackground(GREEN).setHorizontalAlignment('right');
    r('C' + first + ':D' + last).setNumberFormat(DOLLARS).setHorizontalAlignment('right');
    r('E' + first + ':E' + last).setNumberFormat(DOLLARS).setHorizontalAlignment('right');
    box('A' + top + ':E' + (block[1] === 'Coins' ? top + 7 : total));
    r('A' + total).setValue(block[4]);
    header('A' + total + ':E' + total);
    r('D' + total).setFormula('=sum(D' + first + ':D' + last + ')').setNumberFormat(DOLLARS).setHorizontalAlignment('right');
    box('A' + total + ':E' + total);
  });
  r('E16').setFormula('=SUM(E9:E14)').setNumberFormat(DOLLARS).setHorizontalAlignment('right').setFontWeight('normal');
  r('E27').setFormula('=SUM(E20:E26)').setNumberFormat(DOLLARS).setHorizontalAlignment('right').setFontWeight('normal');

  // Checks: G9:H26, with G17:G18 and H17:H18 merged
  r('G8:H8').merge().setValue('Checks');
  header('G8:H8');
  r('G17:G18').merge();
  r('H17:H18').merge();
  r('G9:H26').setBackground(GREEN).setNumberFormat(DOLLARS).setHorizontalAlignment('right');
  box('G8:H27');
  header('G27:H27');
  r('H27').setFormula('=sum(G9:G26)+sum(H9:H26)').setNumberFormat(DOLLARS).setHorizontalAlignment('right');

  // Totals and counters
  r('B30:D30').merge().setValue('Totals');
  header('B30:D30');
  r('B31:B34').setValues([['Coins'], ['Bills'], ['Checks'], ['Total Offering']]).setHorizontalAlignment('left');
  r('C31:C34').setFormulas([['=D16'], ['=D27'], ['=H27'], ['=sum(C31:C33)']]);
  r('D31:D32').setFormulas([['=E16'], ['=E27']]);
  r('D34').setFormula('=SUM(D31:D33)');
  r('C31:D34').setNumberFormat(DOLLARS).setHorizontalAlignment('right');
  header('B34:D34');
  r('B34').setHorizontalAlignment('center');
  r('C34:D34').setHorizontalAlignment('right');
  r('D34').setFontWeight('normal');
  box('B30:D34');
  r('G30:H30').merge().setValue('Name of Counters');
  header('G30:H30');
  ['G31:H31', 'G32:H32', 'G33:H33', 'G34:H34'].forEach(function (a1) { r(a1).merge(); });
  r('G31:H33').setBackground(GREEN).setHorizontalAlignment('left');
  box('G30:H33');
  // Filled in from the business office's page.
  r('G35:H35').merge().setValue('Verified By');
  header('G35:H35');
  r('G36').setHorizontalAlignment('left');
  r('H36').setNumberFormat('M/d/yyyy').setHorizontalAlignment('right');
  box('G35:H36');
  sheet.setRowHeight(35, 27);
  sheet.setRowHeight(36, 27);
  r('A30').setFontWeight('bold');
  r('A34').setFontWeight('bold');

  // Designations title; setup and each report fill in the rows below it.
  r('A37:H37').merge().setValue('Designations').setFontSize(14).setHorizontalAlignment('center')
    .setBorder(true, null, null, null, null, null);
}

/**
 * Adds the Online Giving and Total Giving rows under the Totals box (B35:D36)
 * and a note cell beside them (E35:F36). Report tabs made before these rows
 * existed get them the first time they're verified.
 */
function ensureOnlineRows_(sheet) {
  if (sheet.getRange('B35').getValue() === 'Online Giving') return;
  const r = function (a1) { return sheet.getRange(a1); };
  r('B35:D36').setFontFamily('Arial').setFontSize(11).setVerticalAlignment('middle');
  r('B35:B36').setValues([['Online Giving'], ['Total Giving']]).setHorizontalAlignment('left');
  r('C35').setBackground('#F3F3F3');   // the counters don't count online giving
  r(ONLINE_CELL).setNumberFormat(AMOUNT_FORMAT).setHorizontalAlignment('right');
  r('B36:D36').setBackground('#D9D9D9').setFontWeight('bold');
  r(TOTAL_GIVING_CELL).setFormula('=D34+D35').setNumberFormat(AMOUNT_FORMAT).setHorizontalAlignment('right');
  r('B35:D36').setBorder(true, true, true, true, true, true);
  r('E35:F36').merge().setFontFamily('Arial').setFontSize(9).setFontStyle('italic').setWrap(true)
    .setVerticalAlignment('top').setHorizontalAlignment('left');
}

/** Every green cell the page fills in. */
function inputCells_() {
  const cells = [DATE_CELL];
  COINS.concat(BILLS).forEach(function (item) { cells.push(item.cell); });
  return cells.concat(CHECK_CELLS, COUNTER_CELLS);
}

/** Validates the report, copies the Template into a new tab and fills it in. */
function submitReport(form) {
  form = form || {};
  if (!codeIsRight_(form.code, 'COUNTER_CODE')) return { status: 'badcode' };

  const date = parseDate_(form.date);
  const writes = [[DATE_CELL, date]];

  const coins = form.coins || {};
  COINS.forEach(function (c) { writes.push([c.cell, count_(coins[c.name], c.name)]); });
  const bills = form.bills || {};
  BILLS.forEach(function (b) { writes.push([b.cell, count_(bills[b.name], b.name)]); });

  const checks = (form.checks || [])
    .map(function (v, i) { return money_(v, 'check ' + (i + 1)); })
    .filter(function (v) { return v !== ''; });
  if (checks.length > CHECK_CELLS.length) {
    throw new Error('The report has room for ' + CHECK_CELLS.length + ' checks. Add the rest by hand in the Sheet.');
  }
  checks.forEach(function (v, i) { writes.push([CHECK_CELLS[i], v]); });

  const groups = designationGroups_(form);

  const counters = (form.counters || []).slice(0, COUNTER_CELLS.length).map(function (c) { return clean_(c, 60); });
  if (!counters[0] || !counters[1]) throw new Error('At least two counters need to enter their names.');
  counters.forEach(function (name, i) { writes.push([COUNTER_CELLS[i], name]); });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const template = ss.getSheetByName(TEMPLATE_NAME);
    if (!template) throw new Error('The Sheet has no Template tab. Run setup in Apps Script.');

    const sheet = template.copyTo(ss).setName(uniqueName_(ss, tabName_(date)));
    sheet.showSheet();
    ss.setActiveSheet(sheet);
    ss.moveActiveSheet(1);
    writes.forEach(function (w) { sheet.getRange(w[0]).setValue(w[1]); });
    writeDesignations_(sheet, groups);
    SpreadsheetApp.flush();

    // Read back what the report's formulas came to, so the page shows the Sheet's numbers.
    const t = sheet.getRange('C31:C34').getValues();
    return {
      status: 'saved',
      tab: sheet.getName(),
      coins: t[0][0], bills: t[1][0], checks: t[2][0], total: t[3][0],
    };
  } finally {
    lock.releaseLock();
  }
}

/** The two Designations groups: every listed item, then the counters' own additions. */
function designationGroups_(form) {
  const amounts = form.designations || {};
  const listed = {};
  SUNDAY_SCHOOL.concat(OTHER_DESIGNATIONS).forEach(function (name) { listed[name] = true; });
  // A phone still showing an old list would send amounts for names that are gone.
  Object.keys(amounts).forEach(function (name) {
    if (!listed[name] && money_(amounts[name], name) !== '') {
      throw new Error('The designation list has changed since this page was opened. Close it, open it again, ' +
        'and re-enter the amount for ' + name + '.');
    }
  });
  const group = function (title, names, extras, kind) {
    const items = names.map(function (name) { return { label: name, amount: money_(amounts[name], name) }; });
    (extras || []).slice(0, MAX_EXTRAS + 1).forEach(function (extra) {
      const label = clean_(extra && extra.label, 40);
      const amount = money_(extra && extra.amount, label || 'the added ' + kind);
      if (amount !== '' && !label) throw new Error('Name the ' + kind + ' for $' + amount.toFixed(2) + '.');
      if (label) items.push({ label: label, amount: amount });
    });
    if (items.length > names.length + MAX_EXTRAS) {
      throw new Error('You can add up to ' + MAX_EXTRAS + (kind === 'class' ? ' classes.' : ' designations.'));
    }
    return { title: title, items: items };
  };
  return [
    group('Sunday School Envelopes', SUNDAY_SCHOOL, form.extraClasses, 'class'),
    group('Other Designations', OTHER_DESIGNATIONS, form.extraDesignations, 'designation'),
  ];
}

/** Lays out the Designations section in the report's style: gray header rows, then three per row. */
function writeDesignations_(sheet, groups) {
  let row = DESIGNATIONS_ROW;
  groups.forEach(function (g, gi) {
    if (gi > 0) row++;   // blank row between the groups
    sheet.getRange(row, 1, 1, 8).merge().setValue(g.title)
      .setFontFamily('Arial').setFontSize(11).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setBackground('#D9D9D9').setBorder(true, true, true, true, null, null);
    sheet.setRowHeight(row, 27);
    row++;
    for (let i = 0; i < g.items.length; i += 3) {
      sheet.getRange(row, 6, 1, 2).merge();
      sheet.getRange(row, 1, 1, 7)
        .setFontFamily('Arial').setFontSize(11).setVerticalAlignment('middle')
        .setBorder(true, true, true, true, true, true);
      g.items.slice(i, i + 3).forEach(function (item, j) {
        sheet.getRange(row, 1 + 2 * j).setValue(item.label).setHorizontalAlignment('left').setWrap(true);
        sheet.getRange(row, 2 + 2 * j).setValue(item.amount).setNumberFormat(AMOUNT_FORMAT)
          .setHorizontalAlignment('right').setBackground('#D9EAD3');
      });
      row++;
    }
  });
  sheet.autoResizeRows(DESIGNATIONS_ROW, row - DESIGNATIONS_ROW);
}

/**
 * Checks a code against a Script Property (COUNTER_CODE or OFFICE_CODE),
 * refusing everything for a while after too many wrong ones.
 */
function codeIsRight_(code, property) {
  const expected = PropertiesService.getScriptProperties().getProperty(property);
  if (!expected) throw new Error('The codes haven\'t been set up yet. Run setup in Apps Script.');
  const cache = CacheService.getScriptCache();
  const key = 'bad' + property;
  const misses = Number(cache.get(key) || 0);
  if (misses >= MAX_BAD_CODES) throw new Error('Too many wrong codes. Wait 10 minutes and try again.');
  if (String(code || '').trim() === expected.trim()) return true;
  cache.put(key, String(misses + 1), 600);
  return false;
}

// ---- Business office ---------------------------------------------------

/** The report tabs, newest first, with each one's total and who verified it. */
function listReports_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reports = ss.getSheets()
    .filter(function (sh) { return sh.getName() !== TEMPLATE_NAME && sh.getRange('A1').getValue() === TITLE; })
    .slice(0, MAX_LISTED_REPORTS)
    .map(function (sh) {
      return {
        tab: sh.getName(),
        total: Number(sh.getRange('C34').getValue()) || 0,
        verifiedBy: String(sh.getRange(VERIFIER_CELL).getValue() || ''),
      };
    });
  return { status: 'ok', reports: reports };
}

function reportSheet_(tab) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(String(tab || ''));
  if (!sh || sh.getName() === TEMPLATE_NAME || sh.getRange('A1').getValue() !== TITLE) {
    throw new Error('That report tab wasn\'t found. Reload the list and pick it again.');
  }
  return sh;
}

/** One report: the counters' figures and any figures the office already saved. */
function getReport_(tab) {
  const sh = reportSheet_(tab);
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const day = function (d) { return d instanceof Date ? Utilities.formatDate(d, tz, 'EEE, MMM d, yyyy') : ''; };
  const rows = function (a1, list) {
    const v = sh.getRange(a1).getValues();   // name, quantity, value, amount, office amount
    return list.map(function (item, i) {
      return { name: item.name, quantity: v[i][1], counted: Number(v[i][3]) || 0, office: v[i][4] };
    });
  };
  const checkCells = sh.getRange('G9:H26').getValues();
  let checkCount = 0;
  checkCells.forEach(function (line) { line.forEach(function (v) { if (typeof v === 'number') checkCount++; }); });
  const totals = sh.getRange('C31:D34').getValues();
  return {
    status: 'ok',
    tab: sh.getName(),
    date: day(sh.getRange(DATE_CELL).getValue()),
    counters: sh.getRange('G31:G33').getValues().map(function (r) { return String(r[0] || ''); }).filter(Boolean),
    coins: rows('A9:E14', COINS),
    bills: rows('A20:E26', BILLS),
    checks: { count: checkCount, counted: Number(sh.getRange('H27').getValue()) || 0, office: sh.getRange(OFFICE_CHECKS_CELL).getValue() },
    counted: totals.map(function (r) { return Number(r[0]) || 0; }),
    verifiedBy: String(sh.getRange(VERIFIER_CELL).getValue() || ''),
    verifiedOn: day(sh.getRange(VERIFIED_DATE_CELL).getValue()),
    online: sh.getRange(ONLINE_CELL).getValue(),
    onlineNote: String(sh.getRange(ONLINE_NOTE_CELL).getValue() || ''),
    designations: designationsWithOffice_(sh),
    cash: readOfficeExtras_(sh).cash,
  };
}

/**
 * The counters' designations, each with the office's amount beside it (null
 * until verified). Matched by position, since two can share a name (a listed
 * "Missions" and one the counters added).
 */
function designationsWithOffice_(sh) {
  const office = readOfficeExtras_(sh).designations;
  return readDesignations_(sh).map(function (g) {
    const saved = office[g.title] || [];
    return {
      title: g.title,
      items: g.items.map(function (x, i) {
        return { label: x.label, amount: x.amount, office: saved[i] && saved[i].label === x.label ? saved[i].amount : null };
      }),
    };
  });
}

/** The first row of the office's section below the Designations, or 0 if the tab hasn't got one. */
function officeExtrasRow_(sh) {
  const last = sh.getLastRow();
  if (last < DESIGNATIONS_ROW) return 0;
  const col = sh.getRange(DESIGNATIONS_ROW, 1, last - DESIGNATIONS_ROW + 1, 1).getValues();
  for (let i = 0; i < col.length; i++) {
    if (col[i][0] === OFFICE_DES_TITLE || col[i][0] === CASH_TITLE) return DESIGNATIONS_ROW + i;
  }
  return 0;
}

/**
 * Reads back what writeOfficeExtras_ wrote: the office's designation amounts
 * as {groupTitle: [{label, amount}]} in report order, and the cash given after
 * the count as [{note, amount}].
 */
function readOfficeExtras_(sh) {
  const out = { designations: {}, cash: [] };
  const start = officeExtrasRow_(sh);
  if (!start) return out;
  const rows = sh.getRange(start, 1, sh.getLastRow() - start + 1, 4).getValues();
  let section = '', group = null;
  rows.forEach(function (v) {
    const a = String(v[0] || '').trim();
    if (a === OFFICE_DES_TITLE || a === CASH_TITLE) { section = a; return; }
    if (!a || a === DES_TOTAL_LABEL || a === CASH_TOTAL_LABEL) return;
    if (v[2] === 'Counted' || v[3] === 'Amount') return;   // column headings
    const amount = v[3] === '' || v[3] === null ? null : Number(v[3]);
    if (section === OFFICE_DES_TITLE) {
      if (v[2] === '' && v[3] === '' && DESIGNATION_TITLES.indexOf(a) > -1) {
        group = out.designations[a] = out.designations[a] || [];
      } else if (group) {
        group.push({ label: a, amount: amount });
      }
    } else if (section === CASH_TITLE && amount !== null) {
      out.cash.push({ note: a, amount: amount });
    }
  });
  return out;
}

/**
 * Lays out the office's section below the counters' Designations: each
 * designation with the counted amount, the office's amount and the difference,
 * then the cash given after the count. Replaces what an earlier verification wrote.
 */
function writeOfficeExtras_(sh, groups, cash) {
  const GRAY = '#D9D9D9';
  const LIGHT = '#F3F3F3';
  let row = officeExtrasRow_(sh);
  if (row) {
    sh.getRange(row, 1, Math.max(sh.getLastRow() - row + 1, 1), 8).breakApart().clear();
  } else {
    row = Math.max(sh.getLastRow() + 2, DESIGNATIONS_ROW);
  }
  const range = function (col, cols) { return sh.getRange(row, col, 1, cols || 1); };
  const style = function (cols) {
    return range(1, cols).setFontFamily('Arial').setFontSize(11).setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true);
  };
  const title = function (text) {
    range(1, 8).merge().setValue(text).setFontFamily('Arial').setFontSize(14)
      .setHorizontalAlignment('center').setVerticalAlignment('middle').setBorder(true, null, null, null, null, null);
    sh.setRowHeight(row++, 31);
  };
  const heading = function (cols, merge, cells) {
    range(1, merge).merge();
    style(cols).setBackground(GRAY).setFontWeight('bold').setHorizontalAlignment('center');
    cells.forEach(function (c) { range(c[0]).setValue(c[1]); });
    sh.setRowHeight(row++, 27);
  };
  const money = function (col, cols) { return range(col, cols).setNumberFormat(AMOUNT_FORMAT).setHorizontalAlignment('right'); };

  // Designations: label in A:B, counted in C, office in D, difference in E.
  title(OFFICE_DES_TITLE);
  heading(5, 2, [[1, 'Designation'], [3, 'Counted'], [4, 'Office'], [5, 'Difference']]);
  const first = row;
  groups.forEach(function (g) {
    range(1, 5).merge();
    style(5).setBackground(LIGHT).setFontWeight('bold').setHorizontalAlignment('left');
    range(1).setValue(g.title);
    row++;
    g.items.forEach(function (x) {
      range(1, 2).merge();
      style(5);
      range(1).setValue(clean_(x.label, 100)).setHorizontalAlignment('left').setWrap(true);
      range(3, 2).setValues([[x.amount === null ? '' : x.amount, x.office === null ? '' : x.office]]);
      range(5).setFormula('=IF(D' + row + '="","",D' + row + '-N(C' + row + '))');
      money(3, 3);
      row++;
    });
  });
  const last = row - 1;
  range(1, 2).merge();
  style(5).setBackground(GRAY).setFontWeight('bold');
  range(1).setValue(DES_TOTAL_LABEL).setHorizontalAlignment('left');
  range(3, 3).setFormulas([['=SUM(C' + first + ':C' + last + ')',
    '=IF(COUNT(D' + first + ':D' + last + ')=0,"",SUM(D' + first + ':D' + last + '))',
    '=IF(D' + row + '="","",D' + row + '-C' + row + ')']]);
  money(3, 3);
  row += 2;

  // Cash given after the count: note in A:C, amount in D.
  title(CASH_TITLE);
  range(1, 8).merge().setValue('Cash given after the count. It is not included in the Total Offering or Total Giving.')
    .setFontFamily('Arial').setFontSize(9).setFontStyle('italic').setHorizontalAlignment('center');
  row++;
  heading(4, 3, [[1, 'Note'], [4, 'Amount']]);
  const cashFirst = row;
  (cash.length ? cash : [{ note: 'None recorded', amount: '' }]).forEach(function (c) {
    range(1, 3).merge();
    style(4);
    range(1).setValue(c.note).setHorizontalAlignment('left').setWrap(true);
    range(4).setValue(c.amount);
    money(4);
    row++;
  });
  range(1, 3).merge();
  style(4).setBackground(GRAY).setFontWeight('bold');
  range(1).setValue(CASH_TOTAL_LABEL).setHorizontalAlignment('left');
  range(4).setFormula('=SUM(D' + cashFirst + ':D' + (row - 1) + ')');
  money(4);
}

/**
 * Saves the office's figures into the report's Business Office Only cells,
 * plus the week's online giving, then emails the report to the staff.
 */
function verifyReport_(body) {
  const verifier = clean_(body.verifier, 60);
  if (!verifier) throw new Error('Enter your name under Verified By.');
  const office = body.office || {};
  const coins = COINS.map(function (c) { return [money_((office.coins || {})[c.name], c.name)]; });
  const bills = BILLS.map(function (b) { return [money_((office.bills || {})[b.name], b.name)]; });
  const checks = money_(office.checks, 'checks');
  const online = money_(office.online, 'online giving');
  const onlineNote = clean_(office.onlineNote, 100);
  const cash = cashEntries_(office.cash);

  let sh, result, wasVerified;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    sh = reportSheet_(body.tab);
    wasVerified = !!sh.getRange(VERIFIER_CELL).getValue();
    ensureOnlineRows_(sh);
    sh.getRange(OFFICE_COIN_RANGE).setValues(coins);
    sh.getRange(OFFICE_BILL_RANGE).setValues(bills);
    sh.getRange(OFFICE_CHECKS_CELL).setValue(checks);
    sh.getRange(ONLINE_CELL).setValue(online);
    sh.getRange(ONLINE_NOTE_CELL).setValue(onlineNote);
    sh.getRange(VERIFIER_CELL).setValue(verifier);
    sh.getRange(VERIFIED_DATE_CELL).setValue(new Date());
    // The office's amount for each designation the counters' section lists,
    // in the same order. The page sends [{label, amount}] per group (an older
    // page sent {label: amount}, which can't tell two of the same name apart).
    const desOffice = office.designations || {};
    const groups = readDesignations_(sh).map(function (g) {
      const sent = desOffice[g.title] || {};
      return {
        title: g.title,
        items: g.items.map(function (x, i) {
          let value = sent[x.label];
          if (Array.isArray(sent)) {
            if (sent[i] && sent[i].label !== x.label) {
              throw new Error('The designations on this report changed after it was opened. Pick the report again and re-enter them.');
            }
            value = sent[i] && sent[i].amount;
          }
          const v = money_(value, x.label);
          return { label: x.label, amount: x.amount, office: v === '' ? null : v };
        }),
      };
    });
    writeOfficeExtras_(sh, groups, cash);
    SpreadsheetApp.flush();
    const t = sh.getRange('C31:D34').getValues();
    result = {
      status: 'saved',
      tab: sh.getName(),
      counted: t.map(function (r) { return Number(r[0]) || 0; }),
      office: t.map(function (r) { return Number(r[1]) || 0; }),
      online: online === '' ? 0 : online,
      totalGiving: Number(sh.getRange(TOTAL_GIVING_CELL).getValue()) || 0,
      cashTotal: Math.round(cash.reduce(function (t, c) { return t + c.amount * 100; }, 0)) / 100,
    };
  } finally {
    lock.releaseLock();
  }
  // The verification is saved whatever happens to the email.
  try {
    result.emailed = emailReport_(sh, reportRecipients_(), wasVerified);
  } catch (err) {
    result.emailed = { status: 'failed', message: err.message };
  }
  return result;
}

/** The office's Cash Unaccounted lines as [{note, amount}], skipping empty ones. */
function cashEntries_(list) {
  const cash = [];
  (list || []).slice(0, MAX_CASH + 1).forEach(function (c) {
    const note = clean_(c && c.note, 100);
    const amount = money_(c && c.amount, 'cash unaccounted' + (note ? ' (' + note + ')' : ''));
    if (amount === '' && !note) return;
    if (amount === '') throw new Error('Enter the amount for the cash unaccounted "' + note + '".');
    if (!note) throw new Error('Add a note for the cash unaccounted of $' + amount.toFixed(2) + ': who gave it or what it\'s for.');
    cash.push({ note: note, amount: amount });
  });
  if (cash.length > MAX_CASH) throw new Error('You can add up to ' + MAX_CASH + ' cash unaccounted lines.');
  return cash;
}

/** "Oct 12, 2026", or "Oct 12, 2026 (2)" if that tab already exists. */
function tabName_(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
}

function uniqueName_(ss, base) {
  let name = base;
  for (let n = 2; ss.getSheetByName(name); n++) name = base + ' (' + n + ')';
  return name;
}

/** "2026-10-11" -> Date at noon, so a time zone difference can't shift the day. */
function parseDate_(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!m) throw new Error('Please pick the report date.');
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
}

function count_(value, label) {
  if (value === '' || value === null || value === undefined) return '';
  const n = Number(value);
  if (!isFinite(n) || n < 0 || n > MAX_COUNT || Math.floor(n) !== n) {
    throw new Error('The number of ' + label + ' doesn\'t look right.');
  }
  return n;
}

function money_(value, label) {
  if (value === '' || value === null || value === undefined) return '';
  const n = Number(String(value).replace(/[$,\s]/g, ''));
  if (!isFinite(n) || n < 0 || n > MAX_AMOUNT || Math.round(n * 100) !== Number((n * 100).toFixed(6))) {
    throw new Error('The amount for ' + label + ' doesn\'t look right.');
  }
  return Math.round(n * 100) / 100;
}

/** Trims text and stops it from being read as a spreadsheet formula. */
function clean_(value, max) {
  let s = String(value === null || value === undefined ? '' : value).trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
