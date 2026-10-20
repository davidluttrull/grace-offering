/**
 * Grace Baptist Church - Offering Report: emailed report
 *
 * When the business office saves its verification, verifyReport_ (Code.gs)
 * calls emailReport_, which builds a report of that tab and emails it to the
 * addresses on the Report Emails tab. The report is the body of the email,
 * as HTML styled like the web pages, with a plain-text version for email apps
 * that don't show HTML. The Sheet's Offering menu can send it again.
 */

const EMAILS_NAME = 'Report Emails';
// The web pages' logo, made for their dark green header (600 x 210).
const LOGO_URL = 'https://davidluttrull.github.io/grace-offering/logo.png';
const DESIGNATION_TITLES = ['Sunday School Envelopes', 'Other Designations'];

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
      subject: (updated ? 'Updated offering report for ' : 'Offering report for ') + d.forShort +
        ' (' + usd_(d.totalGiving) + ' total giving)',
      htmlBody: reportHtml_(d, updated),
      body: emailText_(d, updated),
      name: 'Grace Offering',
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
    tab.getRange(1, 2).setFontColor(THEME.muted).setFontStyle('italic');
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
  const extras = verifiedBy ? readOfficeExtras_(sh) : {};
  const cash = extras.cash || 0;
  const addDesignated = extras.addDesignated || 0;
  const addMission = extras.addMission || 0;
  const fmt = function (d, p) { return d instanceof Date ? Utilities.formatDate(d, tz, p) : ''; };
  // The Sunday this offering belongs to: the report date, or the Sunday before it.
  // ('u' is the ISO day number, 1 = Monday ... 7 = Sunday.)
  const isSunday = date instanceof Date && fmt(date, 'u') === '7';
  const sunday = date instanceof Date ? new Date(date.getTime() - (Number(fmt(date, 'u')) % 7) * 86400000) : null;

  const out = {
    tab: sh.getName(),
    // "Sunday, October 11, 2026", or "Week of Sunday, ..." when the report date isn't a Sunday
    forLabel: sunday ? (isSunday ? '' : 'Week of ') + fmt(sunday, 'EEEE, MMMM d, yyyy') : sh.getName(),
    forShort: sunday ? (isSunday ? '' : 'week of ') + fmt(sunday, 'EEEE, MMM d, yyyy') : sh.getName(),
    reportDate: isSunday || !sunday ? '' : fmt(date, 'EEEE, MMMM d, yyyy'),
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
    cash: cash,
    addDesignated: addDesignated,
    addMission: addMission,
    // Cash Unaccounted is for the record only, so it isn't in Total Giving.
    totalGiving: Math.round((offering + (online || 0) + addDesignated + addMission) * 100) / 100,
    designations: designationsWithOffice_(sh),
    week: weekFigures_(sh),        // general fund, designated, mission fund (Giving.gs)
    giving: givingFor_(sh, tz),    // budget, year to date, balance from the giving tab
  };
  // How many designations the office's amount differs from the count on.
  out.desDiffs = !verifiedBy ? 0 : out.designations.reduce(function (n, g) {
    return n + g.items.filter(function (x) {
      return x.office !== null && Math.round(x.office * 100) !== Math.round((x.amount || 0) * 100);
    }).length;
  }, 0);
  return out;
}

/** The counters' Designations section as [{title, items: [{label, amount}]}], read back from the tab. */
function readDesignations_(sh) {
  const last = sh.getLastRow();
  if (last < DESIGNATIONS_ROW) return [];
  // The office's section, when there is one, starts below the counters' rows.
  const end = officeExtrasRow_(sh) || last + 1;
  if (end <= DESIGNATIONS_ROW) return [];
  const rows = sh.getRange(DESIGNATIONS_ROW, 1, end - DESIGNATIONS_ROW, 6).getValues();
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

// ---- Email HTML -------------------------------------------------------------
//
// The report is the email itself, styled like the web pages (THEME in Code.gs).
// Email apps ignore most CSS, so everything is tables, inline styles and
// inline-block columns: side by side on a computer, stacked on a phone.

const FONT = "font-family:Poppins,'Helvetica Neue',Helvetica,Arial,sans-serif;";
const DASH = '<span style="color:#AAAAAA">—</span>';

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

/** A full-width layout table. */
function eTable_(rows, style) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;' + (style || '') + '">' + rows + '</table>';
}

/** One white card on the page, like the web pages' cards. */
function eCard_(inner) {
  return '<tr><td style="padding-top:12px">' +
    eTable_('<tr><td style="padding:16px 14px">' + inner + '</td></tr>',
      'background:#FFFFFF;border:1px solid ' + THEME.line + ';border-radius:16px;border-collapse:separate') + '</td></tr>';
}

function eHeading_(text, top) {
  return '<p style="' + FONT + 'margin:' + (top === undefined ? 0 : top) + 'px 0 4px;font-size:13px;font-weight:600;letter-spacing:1px;' +
    'text-transform:uppercase;color:' + THEME.mid + '">' + esc_(text) + '</p>';
}

function eCaption_(text) {
  return '<p style="' + FONT + 'margin:0 0 10px;font-size:12px;line-height:1.4;color:' + THEME.muted + '">' + esc_(text) + '</p>';
}

function eSubhead_(text) {
  return '<p style="' + FONT + 'margin:10px 0 4px;font-size:14px;font-weight:600;color:' + THEME.ink + '">' + esc_(text) + '</p>';
}

/**
 * A table with a heading row. cols: [{label, right}]; rows: arrays of cell
 * HTML; styles: an optional extra style per row ('sub' or 'grand' or CSS).
 */
function eGrid_(cols, rows, styles, size) {
  const look = function (st) {
    return st === 'sub' ? 'background:' + THEME.soft + ';font-weight:600;'
      : st === 'grand' ? 'background:' + THEME.deep + ';color:#FFFFFF;font-weight:600;'
      : st || '';
  };
  const head = cols.some(function (c) { return c.label; })
    ? '<tr>' + cols.map(function (c) {
      return '<td style="' + FONT + 'padding:4px 5px;font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:' + THEME.muted +
        ';border-bottom:2px solid ' + THEME.brand + (c.right ? ';text-align:right' : '') + '">' + esc_(c.label) + '</td>';
    }).join('') + '</tr>'
    : '';
  const body = rows.map(function (cells, i) {
    const st = look(styles && styles[i]);
    return '<tr>' + cells.map(function (html, j) {
      return '<td style="' + FONT + 'padding:7px 5px;font-size:' + (size || 14) + 'px;color:' + THEME.ink + ';border-bottom:1px solid ' + THEME.line + ';' +
        'font-variant-numeric:tabular-nums;' + st + (cols[j].right ? 'text-align:right;white-space:nowrap;' : '') + '">' + html + '</td>';
    }).join('') + '</tr>';
  }).join('');
  return eTable_(head + body);
}

/**
 * One of two side-by-side slots in a card (eRow_). Each is up to 304px wide
 * with 8px of padding on both sides, so two fit across the 608px inside a
 * card with a 16px gap, and one alone sits centered on a phone.
 */
function eSlot_(html, style) {
  return '<div style="display:inline-block;vertical-align:top;width:100%;max-width:304px;text-align:left;' + (style || '') + '">' +
    eTable_('<tr><td style="padding:0 8px">' + html + '</td></tr>') + '</div>';
}

/** A row of slots: side by side when there's room, stacked and centered when there isn't. */
function eRow_(slots) {
  return '<div style="font-size:0;line-height:0;text-align:center;margin:0 -8px">' + slots + '</div>';
}

/** Two columns side by side, stacking on narrow screens. */
function eColumns_(left, right) {
  const col = function (html) {
    return eSlot_(html, 'font-size:14px;line-height:1.4');
  };
  return eRow_(col(left) + col(right));
}

/** A difference cell: green "Matches", amber amount, or a dash when the office left it blank. */
function diffCell_(office, counted) {
  if (office === null) return DASH;
  const t = diff_(office, counted);
  return t === 'Matches' ? '<span style="color:' + THEME.match + '">Matches</span>'
    : '<span style="color:' + THEME.diff + ';font-weight:600">' + t + '</span>';
}

/** "+$29,600.16 over" / "−$4,296.52 under" against the budget, or a dash. */
function overUnder_(n) {
  if (n === null || n === undefined) return '—';
  return (n < 0 ? '−' : '+') + usd_(Math.abs(n)) + (n < 0 ? ' under' : ' over');
}

function overUnderCell_(n) {
  if (n === null || n === undefined) return DASH;
  return '<span style="color:' + (n < 0 ? THEME.diff : THEME.match) + ';font-weight:600">' + overUnder_(n) + '</span>';
}

/** The report, as the email's HTML body. */
function reportHtml_(d, updated) {
  const T = THEME;
  const totalDiff = Math.round((d.office[3] - d.counted[3]) * 100);
  const out = [];
  const preview = 'General fund ' + usd_(d.week.subtotal) + ' · ' + usd_(d.totalGiving) + ' total giving' +
    (d.verified ? (totalDiff === 0 ? ' · count matches' : ' · count differs by ' + diff_(d.office[3], d.counted[3])) : ' · not verified');

  out.push('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">' +
    '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet"></head>' +
    '<body style="margin:0;padding:0;background:' + T.soft + '">' +
    '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">' + esc_(preview) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' + T.soft + '" style="background:' + T.soft + '">' +
    '<tr><td align="center" style="padding:16px 6px 24px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;border-collapse:collapse">');

  // Header bar, like the top of the web pages
  out.push('<tr><td bgcolor="' + T.deep + '" align="center" style="background:' + T.deep + ';border-radius:16px;padding:20px 18px 18px">' +
    '<img src="' + LOGO_URL + '" width="149" height="52" alt="Grace Baptist Church" style="display:block;margin:0 auto 10px;border:0;height:52px;width:149px">' +
    '<p style="' + FONT + 'margin:0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#CFE3C0">' +
    (updated ? 'Updated offering report' : 'Offering report') + '</p>' +
    '<p style="' + FONT + 'margin:2px 0 0;font-size:22px;font-weight:700;color:#FFFFFF">' + esc_(d.forLabel) + '</p>' +
    (d.reportDate ? '<p style="' + FONT + 'margin:2px 0 0;font-size:12px;color:#CFE3C0">Report dated ' + esc_(d.reportDate) + '</p>' : '') +
    '</td></tr>');

  // Quick boxes, two by two: general fund, the week against the budget, the
  // fiscal year to date, and in-person against online giving.
  const w = d.week, g = d.giving;
  const forWeek = g ? Math.round((w.subtotal - g.budget) * 100) / 100 : null;
  const ytdBalance = g ? g.balance : null;
  const signed = function (n) { return n === null || n === undefined ? '—' : (n < 0 ? '−' : '+') + usd_(Math.abs(n)); };
  const box = function (inner, bg, border) {
    return eSlot_(eTable_('<tr><td style="' + FONT + 'padding:12px 14px;line-height:1.3;background:' + bg + ';border:1px solid ' + border +
        ';border-radius:12px;height:96px;vertical-align:top">' + inner + '</td></tr>', 'border-collapse:separate'), 'margin-top:10px');
  };
  const label = function (text, color) {
    return '<p style="margin:0;font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:' + color + '">' + esc_(text) + '</p>';
  };
  const big = function (value, color) {
    return '<p style="margin:3px 0 0;font-size:26px;line-height:1.15;font-weight:700;color:' + color + '">' + value + '</p>';
  };
  const small = function (text, color) {
    return '<p style="margin:3px 0 0;font-size:12px;line-height:1.35;color:' + color + '">' + text + '</p>';
  };
  // Over is green, under is amber, like the page's matches and differences.
  const overUnderBox = function (title, n, sub, foot) {
    const known = n !== null && n !== undefined;
    const under = known && n < 0;
    return box(label(title, T.muted) +
      big(signed(n), !known ? T.muted : under ? T.diff : T.match) +
      small(!known ? 'No budget figures for this week.' : sub(under), T.ink) +
      (foot ? small(foot, T.muted) : ''),
      !known ? '#FFFFFF' : under ? T.diffBg : '#EEF6E8', !known ? T.line : under ? '#F0D6A8' : T.line);
  };

  const generalBox = box(label('General fund this week', '#CFE3C0') + big(usd_(w.subtotal), '#FFFFFF') +
    small('Offering, less designated and mission gifts, plus online giving', '#CFE3C0'), T.deep, T.deep);
  const weekBox = overUnderBox('For the week', forWeek, function (under) {
    return (under ? 'Under' : 'Over') + ' the ' + usd_(g.budget) + ' weekly budget';
  });
  const ytdBox = overUnderBox('Fiscal year to date', ytdBalance, function (under) {
    return (under ? 'Under' : 'Over') + ' budget for the year so far';
  }, g && g.ytd !== null ? usd_(g.ytd) + ' received this fiscal year' : '');

  // In-person (the offering) against online (general, plus designated and mission gifts online)
  const inPerson = Math.round(d.offering * 100);
  const online = Math.round(((d.online || 0) + (d.addDesignated || 0) + (d.addMission || 0)) * 100);
  const all = inPerson + online;
  const pct = function (x) { return all ? Math.round(x * 100 / all) : 0; };
  const split = function (name, cents, color) {
    return '<tr><td style="' + FONT + 'padding:2px 0;font-size:13px;color:' + T.ink + '">' +
      '<span style="display:inline-block;width:9px;height:9px;border-radius:5px;background:' + color + ';margin-right:6px"></span>' + name + '</td>' +
      '<td style="' + FONT + 'padding:2px 0;font-size:13px;font-weight:600;text-align:right;white-space:nowrap;color:' + T.ink + '">' + usd_(cents / 100) +
      ' <span style="font-weight:400;color:' + T.muted + '">' + pct(cents) + '%</span></td></tr>';
  };
  const bar = all ? eTable_('<tr>' +
      (inPerson ? '<td width="' + pct(inPerson) + '%" style="height:8px;background:' + T.deep + ';font-size:0;line-height:0">&nbsp;</td>' : '') +
      (online ? '<td width="' + (100 - pct(inPerson)) + '%" style="height:8px;background:' + T.brand + ';font-size:0;line-height:0">&nbsp;</td>' : '') +
      '</tr>', 'margin-top:8px;border-radius:4px;overflow:hidden;border-collapse:separate') : '';
  const mixBox = box(label('In-person vs. online', T.muted) +
    eTable_(split('In-person', inPerson, T.deep) + split('Online', online, T.brand), 'margin-top:6px') + bar, '#FFFFFF', T.line);

  const pair = function (left, right) {
    return eRow_(left + right);
  };
  const status = !d.verified ? '<span style="color:' + T.muted + '">Not verified yet. These are the counters’ figures.</span>'
    : totalDiff === 0 ? '<span style="color:' + T.match + '">✓ The business office count matches the counters.</span>'
    : '<span style="color:' + T.diff + ';font-weight:600">The business office count differs from the counters by ' + diff_(d.office[3], d.counted[3]) + '.</span>';
  out.push(eCard_(pair(generalBox, weekBox) + pair(ytdBox, mixBox) +
    '<p style="' + FONT + 'margin:12px 0 0;font-size:13px">' + status + '</p>'));

  // Budget, laid out like the bulletin figures
  const pairs = function (rows, styles) { return eGrid_([{ label: '' }, { label: '', right: true }], rows, styles); };
  out.push(eCard_(eHeading_('Budget') +
    eCaption_('General fund is the offering, less designated and mission fund gifts, plus online giving. Year to date is the fiscal year' +
      (g ? ' (' + g.tab.replace(GIVING_TAB_PREFIX, '') + ')' : '') + ', July through June.') +
    eColumns_(
      eSubhead_('General Fund') + pairs([['Weekly budget', g ? usd_(g.budget) : '—'], ['General fund (offering)', usd_(w.generalFund)],
        ['Online giving', usd_(w.online)], ['Subtotal general fund', usd_(w.subtotal)], ['For week', overUnderCell_(forWeek)]],
        [null, null, null, 'sub', null]),
      eSubhead_('Funds and Year to Date') + pairs([['Designated', usd_(w.designated)], ['Mission Fund', usd_(w.mission)],
        ['Weekly fiscal YTD', overUnderCell_(g ? g.balance : null)], ['Year to date', g && g.ytd !== null ? usd_(g.ytd) : '—']],
        [null, null, null, 'sub']))));

  // Verification: counted beside office
  const vRows = [], vStyles = [];
  ['Coins', 'Bills', 'Checks', 'Total Offering'].forEach(function (name, i) {
    vRows.push([name, usd_(d.counted[i]), d.verified ? usd_(d.office[i]) : '—', d.verified ? diffCell_(d.office[i], d.counted[i]) : '—']);
    vStyles.push(i === 3 ? 'sub' : null);
  });
  vRows.push(['Online giving', '', usd_(d.online === null ? 0 : d.online), '']);
  vStyles.push(null);
  [['Additional designated (online)', d.addDesignated], ['Additional mission fund (online)', d.addMission]].forEach(function (x) {
    if (!x[1]) return;
    vRows.push([x[0], '', usd_(x[1]), '']);
    vStyles.push(null);
  });
  vRows.push(['Total giving', '', usd_(d.totalGiving), '']);
  vStyles.push('grand');
  if (d.cash) {
    vRows.push(['Cash unaccounted (record only)', '', usd_(d.cash), '']);
    vStyles.push('color:' + T.muted + ';font-size:13px;');
  }
  out.push(eCard_(eHeading_('Verification') + eCaption_('What the counters counted beside what the business office counted.') +
    eGrid_([{ label: '' }, { label: 'Counted', right: true }, { label: 'Office', right: true }, { label: 'Difference', right: true }], vRows, vStyles, 13)));

  // Coins and bills, then checks
  const money = function (title, list) {
    return eSubhead_(title) + eGrid_([{ label: 'Item' }, { label: 'Qty', right: true }, { label: 'Counted', right: true }, { label: 'Office', right: true }],
      list.map(function (x) {
        return [esc_(x.name), x.quantity === null ? DASH : String(x.quantity), usd_(x.counted), x.office === null ? DASH : usd_(x.office)];
      }));
  };
  out.push(eCard_(eHeading_('Cash and checks') + eColumns_(money('Coins', d.coins), money('Bills', d.bills)) +
    '<p style="' + FONT + 'margin:12px 0 0;font-size:14px;color:' + T.ink + '"><b>Checks:</b> ' + d.checks.count + (d.checks.count === 1 ? ' check' : ' checks') +
    ' counted, totaling ' + usd_(d.checks.counted) + '. Office checks total: ' + usd_(d.checks.office) + '.</p>'));

  // Designations, listing only the ones that have an amount
  if (d.designations.length) {
    const officeCell = function (x) {
      if (x.office === null) return DASH;
      return Math.round(x.office * 100) === Math.round((x.amount || 0) * 100) ? usd_(x.office)
        : '<span style="color:' + T.diff + ';font-weight:600">' + usd_(x.office) + '</span>';
    };
    const group = function (gr) {
      if (!gr) return '';
      const given = gr.items.filter(function (x) { return x.amount !== null || (d.verified && x.office !== null); });
      if (!given.length) return eSubhead_(gr.title) + '<p style="' + FONT + 'margin:0;font-size:13px;color:' + T.muted + '">None this week.</p>';
      const sum = function (key) { return given.reduce(function (t, x) { return t + Math.round((x[key] || 0) * 100); }, 0) / 100; };
      const styles = given.map(function () { return null; }).concat(['sub']);
      if (!d.verified) {
        return eSubhead_(gr.title) + eGrid_([{ label: 'Name' }, { label: 'Amount', right: true }],
          given.map(function (x) { return [esc_(x.label), usd_(x.amount)]; }).concat([['Total', usd_(sum('amount'))]]), styles);
      }
      return eSubhead_(gr.title) + eGrid_([{ label: 'Name' }, { label: 'Counted', right: true }, { label: 'Office', right: true }],
        given.map(function (x) { return [esc_(x.label), x.amount === null ? DASH : usd_(x.amount), officeCell(x)]; })
          .concat([['Total', usd_(sum('amount')), officeCell({ amount: sum('amount'), office: sum('office') })]]), styles);
    };
    let html = '';
    for (let i = 0; i < d.designations.length; i += 2) html += eColumns_(group(d.designations[i]), group(d.designations[i + 1]));
    out.push(eCard_(eHeading_('Designations') +
      eCaption_('Not added to the Total Offering. Only designations with an amount are listed.' + (d.verified ? ' Amber office amounts differ from the count.' : '')) +
      html));
  }

  // Who counted and verified
  const people = 'Counted by ' + (d.counters.join(', ') || 'no names given') + '. ' +
    (d.verified ? 'Verified by ' + d.verifiedBy + (d.verifiedOn ? ' on ' + d.verifiedOn : '') + '.' : 'Not verified yet.');
  out.push('<tr><td style="' + FONT + 'padding:16px 8px 0;text-align:center;font-size:13px;color:' + T.muted + '">' + esc_(people) +
    (d.desDiffs ? '<br><span style="color:' + T.diff + ';font-weight:600">' + esc_(desDiffText_(d.desDiffs)) + '</span>' : '') +
    '<br><span style="font-size:11px;color:#999999">Sent automatically when the business office saved its verification. Sheet tab: ' + esc_(d.tab) + '.</span>' +
    '</td></tr>');

  out.push('</table></td></tr></table></body></html>');
  return out.join('\n');
}

/** The bulletin figures as [label, value] pairs, for the plain-text email. */
function budgetLines_(d) {
  const w = d.week, g = d.giving;
  return [['Weekly budget', g ? usd_(g.budget) : '—'],
    ['General fund this week', usd_(w.subtotal) + (g ? ' (' + overUnder_(Math.round((w.subtotal - g.budget) * 100) / 100) + ' budget)' : '')],
    ['Weekly fiscal YTD', g && g.balance !== null ? overUnder_(g.balance) + ' budget' : '—'],
    ['Designated', usd_(w.designated)], ['Mission Fund', usd_(w.mission)],
    ['Year to date', g && g.ytd !== null ? usd_(g.ytd) : '—']];
}

// ---- Plain-text email -----------------------------------------------------------
//
// For the few email apps that don't show HTML.

function emailText_(d, updated) {
  const totalDiff = Math.round((d.office[3] - d.counted[3]) * 100);
  return [
    (updated ? 'Updated offering report for ' : 'Offering report for ') + d.forLabel +
      (d.reportDate ? ' (report dated ' + d.reportDate + ')' : ''),
    '',
    'Offering: ' + usd_(d.offering),
    'Online giving: ' + usd_(d.online === null ? 0 : d.online) + (d.onlineNote ? ' (' + d.onlineNote + ')' : ''),
  ].concat(d.addDesignated ? ['Additional designated (online): ' + usd_(d.addDesignated)] : [],
    d.addMission ? ['Additional mission fund (online): ' + usd_(d.addMission)] : [], [
    'Total giving: ' + usd_(d.totalGiving),
  ], d.cash ? ['Cash unaccounted (record only, not in total giving): ' + usd_(d.cash)] : [], [
    '',
  ], budgetLines_(d).map(function (l) { return l[0] + ': ' + l[1]; }), [
    '',
    !d.verified ? 'Not verified yet.'
      : totalDiff === 0 ? 'The business office count matches the counters.'
      : 'The business office count differs from the counters by ' + diff_(d.office[3], d.counted[3]) + '.',
  ], d.desDiffs ? [desDiffText_(d.desDiffs)] : [], [
    'Counted by ' + (d.counters.join(', ') || 'no names given') + (d.verified ? '. Verified by ' + d.verifiedBy + '.' : '.'),
    'Sheet tab: ' + d.tab,
  ]).join('\n');
}

function desDiffText_(n) {
  return n + (n === 1 ? ' designation differs' : ' designations differ') + ' from the counters. See Designations.';
}
