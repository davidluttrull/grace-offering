/**
 * Grace Baptist Church - Offering Report: budget and yearly giving
 *
 * Each fiscal year (July through June) has a "Yr. Giving 2026-2027" tab laid
 * out like the church's yearly giving sheet: one row per Sunday with the
 * running budget, that week's general fund, the year-to-date actual and the
 * balance (over or under budget). The weekly budget is one cell at the top of
 * the tab, B2. Change it there when the budget is set, and the Budget and
 * Balance columns follow.
 *
 * When the business office verifies a report, verifyReport_ (Code.gs) calls
 * recordWeek_, which writes the week's general fund into that Sunday's row.
 * The emailed report (Report.gs) reads the budget, the week and the year to
 * date back from the tab.
 *
 * General fund for a week = the offering, less the designations that belong
 * to the Designated and Mission Fund groups, plus online giving and any cash
 * unaccounted. Which group a designation belongs to is set below.
 */

const FISCAL_YEAR_START_MONTH = 7;   // July
const DEFAULT_WEEKLY_BUDGET = 16170; // used only for the first year's tab
const GIVING_TAB_PREFIX = 'Yr. Giving ';
const GIVING_BUDGET_CELL = 'B2';
const GIVING_HEADER_ROW = 4;
const GIVING_FIRST_ROW = 5;
const GIVING_HEADERS = ['WEEK', 'DATE', 'BUDGET', 'WK GEN FUND', 'YTD ACTUAL', 'NSF CK', 'BALANCE', 'REPORT'];

// Designations that stay in the general fund. Names with "mission" in them
// (listed or added by the counters) are Mission Fund, and every other
// designation, including the Sunday School envelopes, is Designated.
const GENERAL_FUND_DESIGNATIONS = ["God's Turn"];
const MISSION_FUND_PATTERN = /mission/i;

/** 'general', 'mission' or 'designated' for a designation's name. */
function fundOf_(label) {
  const name = String(label || '').trim();
  if (GENERAL_FUND_DESIGNATIONS.some(function (g) { return g.toLowerCase() === name.toLowerCase(); })) return 'general';
  return MISSION_FUND_PATTERN.test(name) ? 'mission' : 'designated';
}

/** The Sunday a report belongs to: its date, or the Sunday before it. Noon, so time zones can't shift the day. */
function sundayOf_(date, tz) {
  const dow = Number(Utilities.formatDate(date, tz, 'u')) % 7;   // 'u': 1 = Monday ... 7 = Sunday
  const d = new Date(date.getTime() - dow * 86400000);
  return new Date(Number(Utilities.formatDate(d, tz, 'yyyy')), Number(Utilities.formatDate(d, tz, 'M')) - 1,
    Number(Utilities.formatDate(d, tz, 'd')), 12);
}

/** 2026 for any date from July 2026 through June 2027. */
function fiscalYear_(date) {
  return date.getMonth() + 1 >= FISCAL_YEAR_START_MONTH ? date.getFullYear() : date.getFullYear() - 1;
}

function givingTabName_(year) {
  return GIVING_TAB_PREFIX + year + '-' + (year + 1);
}

/**
 * The fiscal year's giving tab, made if it doesn't exist yet. A new year's tab
 * starts with the previous year's weekly budget (update B2 when the new budget
 * is set).
 */
function ensureGivingTab_(year) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = givingTabName_(year);
  let tab = ss.getSheetByName(name);
  if (tab) return tab;
  const prior = ss.getSheetByName(givingTabName_(year - 1));
  const budget = prior ? Number(prior.getRange(GIVING_BUDGET_CELL).getValue()) || DEFAULT_WEEKLY_BUDGET : DEFAULT_WEEKLY_BUDGET;

  tab = ss.insertSheet(name, Math.max(ss.getNumSheets() - 1, 0));
  tab.getRange('A1').setValue(name);
  tab.getRange('A2').setValue('Weekly budget');
  tab.getRange(GIVING_BUDGET_CELL).setValue(budget);
  tab.getRange('C2').setValue('Change B2 when the budget is set. Verifying a report fills in that Sunday\'s WK GEN FUND.');
  tab.getRange(GIVING_HEADER_ROW, 1, 1, GIVING_HEADERS.length).setValues([GIVING_HEADERS]);

  // Every Sunday from the first one in July through the end of June.
  const sundays = [];
  for (let d = new Date(year, FISCAL_YEAR_START_MONTH - 1, 1, 12); d < new Date(year + 1, FISCAL_YEAR_START_MONTH - 1, 1); d = new Date(d.getTime() + 86400000)) {
    if (d.getDay() === 0) sundays.push(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12));
  }
  const rows = sundays.map(function (d, i) {
    const n = GIVING_FIRST_ROW + i;
    return [i + 1, d, '=IF(A' + n + '="","",A' + n + '*$B$2)', '', '=IF(D' + n + '="","",SUM(D$' + GIVING_FIRST_ROW + ':D' + n + '))',
      '', '=IF(OR(D' + n + '="",F' + n + '<>""),"",E' + n + '-C' + n + ')', ''];
  });
  tab.getRange(GIVING_FIRST_ROW, 1, rows.length, GIVING_HEADERS.length).setValues(rows);
  tab.setFrozenRows(GIVING_HEADER_ROW);
  styleGivingTab_(tab);
  return tab;
}

/**
 * The giving tab's look, matching the web pages (THEME in Code.gs). Formatting
 * only, so it's safe on a tab already filled in, including rows added by hand.
 * Balances are green when over budget and amber when under.
 */
function styleGivingTab_(tab) {
  const n = Math.max(tab.getLastRow() - GIVING_FIRST_ROW + 1, 1);
  const r = function (a1) { return tab.getRange(a1); };
  tab.setHiddenGridlines(true);
  tab.setTabColor(THEME.deep);
  tab.getRange(1, 1, GIVING_FIRST_ROW + n - 1, GIVING_HEADERS.length)
    .setFontFamily(THEME.font).setFontSize(10).setFontColor(THEME.ink).setVerticalAlignment('middle');
  r('A1:H1').merge().setBackground(THEME.deep).setFontColor('#FFFFFF').setFontSize(14).setFontWeight('bold')
    .setHorizontalAlignment('center');
  tab.setRowHeight(1, 40);
  r('A2').setFontWeight('bold').setFontColor(THEME.mid);
  r(GIVING_BUDGET_CELL).setNumberFormat(AMOUNT_FORMAT).setBackground(THEME.input).setFontWeight('bold')
    .setBorder(true, true, true, true, null, null, THEME.brand, SpreadsheetApp.BorderStyle.SOLID);
  r('C2:H2').merge().setFontSize(9).setFontStyle('italic').setFontColor(THEME.muted);
  tab.setRowHeight(2, 30);
  const body = tab.getRange(GIVING_FIRST_ROW, 1, n, GIVING_HEADERS.length);
  LOOK.box(tab.getRange(GIVING_HEADER_ROW, 1, n + 1, GIVING_HEADERS.length));
  LOOK.header(tab.getRange(GIVING_HEADER_ROW, 1, 1, GIVING_HEADERS.length));
  tab.setRowHeight(GIVING_HEADER_ROW, 30);
  body.setBackground('#FFFFFF');
  tab.getRange(GIVING_FIRST_ROW, 1, n, 1).setHorizontalAlignment('center');
  tab.getRange(GIVING_FIRST_ROW, 2, n, 1).setNumberFormat('M/d/yyyy').setHorizontalAlignment('center');
  tab.getRange(GIVING_FIRST_ROW, 3, n, 5).setNumberFormat(AMOUNT_FORMAT);
  tab.getRange(GIVING_FIRST_ROW, 4, n, 1).setBackground(THEME.soft);   // filled in by verifying
  tab.getRange(GIVING_FIRST_ROW, 7, n, 1).setFontWeight('bold');
  [60, 95, 120, 120, 120, 90, 120, 130].forEach(function (w, i) { tab.setColumnWidth(i + 1, w); });
  const balance = tab.getRange(GIVING_FIRST_ROW, 7, n, 1);
  tab.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setFontColor(THEME.diff).setBackground(THEME.diffBg)
      .setRanges([balance]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(0).setFontColor(THEME.match)
      .setRanges([balance]).build(),
  ]);
}

/**
 * The week's figures from a report tab, the way the bulletin shows them.
 * Uses the office's amounts once verified, the counters' before that.
 */
function weekFigures_(sh) {
  const verified = !!sh.getRange(VERIFIER_CELL).getValue();
  const totals = sh.getRange('C34:D34').getValues()[0];
  const offering = Math.round((verified ? Number(totals[1]) : Number(totals[0])) * 100 || 0);
  const extras = readOfficeExtras_(sh);
  const c = function (v) { return Math.round((Number(v) || 0) * 100); };
  const inOffering = { general: 0, designated: 0, mission: 0 };
  designationsWithOffice_(sh).forEach(function (g) {
    g.items.forEach(function (x) { inOffering[fundOf_(x.label)] += c(x.office !== null ? x.office : x.amount); });
  });
  const online = verified ? c(sh.getRange(ONLINE_CELL).getValue()) : 0;
  const cash = verified ? c(extras.cash) : 0;
  const general = offering - inOffering.designated - inOffering.mission;
  return {
    generalFund: general / 100,           // the offering, less designated and mission fund gifts
    online: online / 100,
    cash: cash / 100,
    subtotal: (general + online + cash) / 100,
    designated: (inOffering.designated + c(extras.addDesignated)) / 100,
    mission: (inOffering.mission + c(extras.addMission)) / 100,
  };
}

/** The giving tab row for a Sunday (skipping NSF adjustment rows), or 0. */
function givingRow_(tab, sunday, tz) {
  const last = tab.getLastRow();
  if (last < GIVING_FIRST_ROW) return 0;
  const want = Utilities.formatDate(sunday, tz, 'yyyy-MM-dd');
  const v = tab.getRange(GIVING_FIRST_ROW, 1, last - GIVING_FIRST_ROW + 1, 6).getValues();
  for (let i = 0; i < v.length; i++) {
    if (v[i][1] instanceof Date && Utilities.formatDate(v[i][1], tz, 'yyyy-MM-dd') === want && v[i][5] === '') return GIVING_FIRST_ROW + i;
  }
  return 0;
}

/** Writes a verified report's general fund into its Sunday's row of the giving tab. */
function recordWeek_(sh) {
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const date = sh.getRange(DATE_CELL).getValue();
  if (!(date instanceof Date)) return;
  const sunday = sundayOf_(date, tz);
  const tab = ensureGivingTab_(fiscalYear_(sunday));
  const row = givingRow_(tab, sunday, tz);
  if (!row) return;
  tab.getRange(row, 4).setValue(weekFigures_(sh).subtotal);
  tab.getRange(row, 8).setValue(sh.getName());
}

/**
 * Budget figures for a report's Sunday from its giving tab: the weekly budget,
 * the year to date and the balance (null when that week isn't filled in).
 */
function givingFor_(sh, tz) {
  const date = sh.getRange(DATE_CELL).getValue();
  if (!(date instanceof Date)) return null;
  const sunday = sundayOf_(date, tz);
  const tab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(givingTabName_(fiscalYear_(sunday)));
  if (!tab) return null;
  const row = givingRow_(tab, sunday, tz);
  const v = row ? tab.getRange(row, 1, 1, 7).getValues()[0] : null;
  const num = function (x) { return x === '' || x === null || x === undefined ? null : Number(x); };
  return {
    tab: tab.getName(),
    budget: Number(tab.getRange(GIVING_BUDGET_CELL).getValue()) || 0,
    week: v ? v[0] : null,
    ytd: v ? num(v[4]) : null,
    balance: v ? num(v[6]) : null,
  };
}
