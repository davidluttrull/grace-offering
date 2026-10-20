# Offering Report: Setup

Counters fill in the offering report on a phone instead of in the spreadsheet. Each time they submit, the Google Sheet gets a new tab named for the report date (for example **Oct 12, 2026**). The tab is laid out like the church's offering report, with the same formatting and formulas, and the green cells are filled in.

The next day, the business office opens a second page, picks the report, and enters its own figures beside the counters' figures, plus the week's online giving. They're saved into that tab's "Business Office Only" cells, and a one-page PDF report is emailed to the staff.

It has three parts:

- **The Sheet and its script** (`Code.gs`, `Report.gs` and `Giving.gs`). The script lives inside the Google Sheet. It builds a **Template** tab that looks like the offering report, then copies it for each report and fills it in. `Report.gs` builds and emails the PDF report. `Giving.gs` keeps the fiscal year's giving tab, which tracks each week against the budget.
- **The counters' page** (`index.html`, plus the logo, icons, and `manifest.webmanifest`). It's hosted on GitHub Pages at <https://davidluttrull.github.io/grace-offering/>. The church site forwards <https://gracetoanderson.com/offeringcount> there, and that's the address counters use.
- **The business office's page** (`office.html` and `office.webmanifest`), at <https://davidluttrull.github.io/grace-offering/office.html>. The church site forwards <https://gracetoanderson.com/offeringverification> there.

The pages talk to the script without any Google sign-in, so nobody needs a Google account. Instead, each page asks for a code once per device:

- The **counter code** lets the counters add reports. It can't read anything back.
- The **business office code** lets the office read the reports and save its figures. Give it only to the business office.

The codes are stored in the script's settings, not in the pages, so finding a page's link isn't enough to add or read reports.

## 1. Create the Sheet

1. Sign in to the Google account that should own the offering records. The church office account is a better choice than a personal one.
2. Create a new blank Google Sheet and name it something like **Grace Offering Reports**.

Leave it empty. Setup builds the report layout in step 3.

## 2. Add the script

1. In the new Sheet, open **Extensions → Apps Script**.
2. Click "Untitled project" at the top and rename it **Offering Report**.
3. Delete what's in `Code.gs`, then paste in the entire contents of this folder's `Code.gs`.
4. Click the **+** next to "Files", choose **Script**, and name it `Report` (Apps Script adds the `.gs` itself). Delete what's inside and paste in the contents of `Report.gs`. Do the same for `Giving.gs`, naming it `Giving`.
5. Click the **+** next to "Services", choose **Drive API**, and click **Add**. The report uses it to turn each report into a PDF.
6. Click the save icon (💾).

## 3. Run setup once

1. Make sure **Code.gs** is selected in the Files list. In the function dropdown next to **Debug**, pick **setup**, then click **Run**.
2. Google will ask for permission. Click **Review permissions** and choose your account. When it warns "Google hasn't verified this app", click **Advanced → Go to Offering Report (unsafe) → Allow**. That warning is expected for a script you wrote yourself. The list includes Drive, Docs and sending email: the script needs them to build the PDF report and email it.
3. When it finishes, the **Execution log** at the bottom shows two lines like `Counter code: 482915` and `Business office code: 730264`. Write both down. The counter code goes to the counters, and the business office code goes only to the business office.
4. Switch back to the Sheet. **Sheet1** is now named **Template** and holds a blank offering report: the coins, bills, checks, totals, online giving, counters, and **Verified By** sections, with green cells for the counters' numbers and the report's formulas. It stops at the **Designations** title, because the script lays out the Designations section on each new report.
5. There's also a **Report Emails** tab. Type the staff email addresses in column A, one per row, starting in A2. A Google Group or routing address works too.

To change a code later: in Apps Script, click the gear icon (**Project Settings**), scroll to **Script Properties**, and edit **COUNTER_CODE** or **OFFICE_CODE**. Each device asks for the new code the next time it's used.

## 4. Deploy the script

1. Click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in:
   - **Description:** `v1`
   - **Execute as:** **Me**
   - **Who has access:** **Anyone**. The pages need this setting to reach the script without a sign-in. The codes are what keep strangers out.
4. Click **Deploy** and copy the **Web app URL**. It ends in `/exec`.

To check the deployment, open that URL in a browser. You should see a short block of text that starts with `{"status":"ok"`.

## 5. Connect the page to the script

Near the bottom of both `index.html` and `office.html`, find the line that starts with `const API_URL =`, and put the `/exec` URL between the quotes. Then publish the updated pages.

This only needs to be done once. Deploying a new version of the script later keeps the same URL.

## 6. Put it on the counters' phones

Send the counters <https://gracetoanderson.com/offeringcount> and the counter code. Each counter should save the page to their home screen. It shows up as **Offering** with the Grace cross icon.

- **iPhone:** open the link in Safari, tap the Share button, then tap **Add to Home Screen**.
- **Android:** open the link in Chrome, tap **⋮**, then tap **Add to Home screen** (or **Install app**).

Send the business office <https://gracetoanderson.com/offeringverification> and the business office code. It works on a computer or a phone. On a phone it can be saved to the home screen the same way, and shows up as **Verify**.

## How it works: counters

- **Date:** the page starts on the most recent Sunday, so a count finished on Monday is still filed under that Sunday. Counters can change it for an offering from another day.
- **Coins and bills:** counters type how many of each. The page shows each amount and the totals as they go.
- **Checks:** counters type each check's amount. A new box appears whenever the last one is filled in, and the **×** button removes a check. The report has room for 34 checks. If there are more, add the rest to the tab by hand.
- **Designations:** every Sunday School class and designation in the lists has its own box. **+ Add class** and **+ Add designation** add up to 10 more of each, with a name and an amount. A note at the top of the section says these amounts are not added to the Total Offering.
- **Counters:** the first two names are required and the third is optional. The phone remembers the names and the counter code.
- **Before saving**, the page shows the coin, bill, check and offering totals for the counters to confirm. After saving, it shows the total from the new tab and the tab's name. If the tab's total doesn't match the page, it says so.
- **If the connection drops**, the numbers stay on the screen so the counters can try again. Unfinished reports are kept on the phone for 12 hours.

## How it works: business office

- **Pick a report.** The list shows the most recent 25 report tabs, newest first, each with its total and whether it's been verified. It starts on the newest one that isn't verified yet.
- **Counted and Office, side by side.** Each coin and bill shows what the counters counted, and a box beside it for the office's dollar amount. Checks show the counters' check count and total, and one box for the office's checks total.
- **Matches and differences.** A box turns green when the office amount matches the count. When it doesn't, it turns amber and says how much more or less the office counted. The Totals table and the bar at the bottom compare coins, bills, checks, and the Total Offering.
- **Each check.** Under the Checks total, every check the counters entered is listed with its amount and a fund, **General Fund** to start. Pick a class or designation to move a designated check out of the general fund, or tap **Split between two funds** to send part to one fund and the rest to another: type the first fund's amount and the rest goes to the second. Moved checks come out of the General Fund Total and go into Designated or Mission Fund. Total Offering and Total Giving don't change. Don't move a check whose amount the counters already entered under Designations, or it's counted twice.
- **Designations.** Every Sunday School class and designation on the report is listed, including the ones the counters added, each with the counted amount and a box for the office's amount. They're colored and flagged the same way as the coins and bills, and a Total line compares the two. Like on the counters' page, they aren't added to the Total Offering.
- **Online giving.** One box for the week's online gifts to the general fund, and an optional note such as "Tithe.ly, Oct 5–11". It isn't compared with the count. It's added to the Total Offering to make **Total Giving**, which the Totals table shows at the bottom.
- **General Fund Total.** Under Total Giving, the Totals table has a **General fund** block: the office's Total Offering, less the Designated and Mission Fund envelopes in it, plus online giving. It's the same figure the bulletin calls Subtotal General Fund and the giving tab records for the week.
- **Cash Unaccounted.** One box for cash given after the count, such as an envelope handed to the office later in the week. It's for the record only: it isn't compared with the count and isn't added to Total Giving or the general fund. The Totals table shows it under Total Giving as "record only".
- **Additional Funds.** Two boxes, **Designated** and **Mission Fund**, for gifts to those funds received online. They're added to those funds on the report, and to Total Giving.
- **Verified By.** One person enters their name, and the device remembers it. Saving writes the office's figures, the online giving, the name, and today's date into the report's tab, then emails the report. The confirmation says whether the email went out.
- **Verifying again** replaces the earlier office figures. The page shows who verified it before and when. Staff get a new report with "Updated" in the subject.

## The Sheet

- New report tabs appear on the left, newest first. **Template** stays on the far right.
- The Sheet uses the web pages' look: the Poppins font, a dark green title bar, medium green headings with a green rule under them, and soft green borders. The light green cells are still the ones the counters fill in. Total Offering and Total Giving are dark green, like the bar at the bottom of the pages. Designation differences, and the giving tab's Balance, show green when they match or are over budget and amber when they're not. Setup applies the look to every tab. Report tabs made before it are restyled once, with their numbers left as they are.
- If a tab for that date already exists, the new one is named with **(2)**, **(3)**, and so on. Nothing is ever overwritten.
- The Business Office Only cells start blank. The office's page fills in the dollar amount for each coin and bill (column E) and the checks total (D33). The office's coin and bill totals (D31 and D32) and its Total Offering (D34) are formulas, so they sit right beside the counters' totals in column C. The verifier's name and the date go in the **Verified By** box under the counters' names.
- Under the Totals box, **Online Giving** (D35) holds the office's online giving, with its note beside it in E35, and **Total Giving** (D36) adds it, and any additional Designated and Mission Fund gifts, to the office's Total Offering. Cash Unaccounted isn't added. Report tabs made before this was added get these two rows the first time they're verified.
- Below the counters' Designations, verifying adds two sections. **Designations: Business Office** lists each class and designation with the counted amount, the office's amount and the difference, and a total. A **Cash Unaccounted** row holds the office's cash amount, for the record only. Verifying again replaces both.
- After Cash Unaccounted come **Additional Designated (online)** and **Additional Mission Fund (online)**, which Total Giving adds in. If the office moved any checks, a **Designated Checks** table comes last: each moved check's number and cell, its amount, and the one or two funds it went to. Checks not listed are general fund.
- The **Verified By** date cell (H36) carries a note, visible when you hover over it, saying when the report was emailed and to how many people, or why it wasn't.
- Each report lists every class and designation under **Sunday School Envelopes** and **Other Designations**, three to a row, in the same style as the original report. Ones the counters added come after the listed ones.
- Don't rename the **Template** tab. You can change its formatting, but keep the green cells in the same places. If the report's layout ever changes, the cell addresses at the top of `Code.gs` have to be updated to match.
- If the Template gets damaged, delete the **Template** tab and run **setup** again. It builds a fresh one. Report tabs and the counter code aren't affected.

## Budget and the yearly giving tab

Each fiscal year (July through June) has its own tab, named like **Yr. Giving 2026-2027**. It has one row per Sunday: **WEEK**, **DATE**, **BUDGET** (the weekly budget times the week number), **WK GEN FUND**, **YTD ACTUAL**, **NSF CK**, **BALANCE** (over or under budget so far) and **REPORT** (the report tab it came from).

- **The weekly budget** is in **B2**, the green cell at the top. Change it there once a year when the budget is set, and the Budget and Balance columns recalculate.
- **Verifying a report** writes that week's general fund into WK GEN FUND for its Sunday and the report's tab name into REPORT. Verifying again replaces it. You can still type a week in by hand.
- **General fund** for a week is the Total Offering, less the designations that belong to Designated or Mission Fund, plus online giving. Checks the office moved to a designated or mission account come out of it too. Cash Unaccounted isn't counted. Sunday School envelopes count as Designated. Any designation with "mission" in its name, listed or added by the counters, counts as Mission Fund. **God's Turn** stays in the general fund. Every other designation counts as Designated. The page shows each designation's fund under its name. To change which ones stay in the general fund, edit `GENERAL_FUND_DESIGNATIONS` near the top of `Giving.gs`.
- **Designated** and **Mission Fund** are the designations in each fund, plus checks the office moved into them, plus the office's Additional Funds.
- **A returned check** (NSF): insert a row under that week, copy its WEEK and DATE, and put the negative amount in both WK GEN FUND and NSF CK. Year to date takes it off, and the row has no Balance of its own.
- **A new fiscal year's tab** is made the first time a report from that year is verified, or when setup runs in that year. It starts with the previous year's budget, so update its B2 when the new budget is set.

## Emailed reports

When the business office saves a verification, the script emails a one-page PDF to everyone on the **Report Emails** tab. The report and the email subject lead with the Sunday the offering is for. If a report's date isn't a Sunday, they say "Week of Sunday …" and show the report's own date below it. The report shows Total Giving, the verified offering, online giving, and whether the office's count matches the counters'. It also has the counted and office figures side by side, the coins and bills, the checks total, the designations that have an amount (with the office's amount beside each once verified), and who counted and verified. Cash Unaccounted appears under Total Giving, marked "record only", when there is any. It isn't added in. A **Budget** section near the top shows the bulletin figures: the weekly budget, the general fund (offering), online giving, the subtotal general fund, **For week** (over or under the weekly budget), Designated, Mission Fund, **Weekly fiscal YTD** (over or under budget for the year so far) and **Year to date** (received so far this fiscal year). The email itself shows the offering, online giving, Total Giving and the same budget figures, so staff can see the numbers without opening the attachment. It also shows any Cash Unaccounted (record only) and says how many designations differ from the count.

To stop the emails, clear the addresses on the Report Emails tab.

The Sheet has an **Offering** menu (it appears a few seconds after the Sheet opens). Open a report tab first, then:

- **Email report for this tab** sends that tab's report to everyone on the list again. Use it if an email failed, or to resend an older report.
- **Send me a test report for this tab** sends it only to you, so you can check how it looks without emailing the staff.

Each report is built in a temporary Google Doc that's moved to the Drive trash right after the PDF is made, so you may see "Offering report (temporary)" files in the trash. Google empties the trash on its own after 30 days.

## Updating the script

Whenever `Code.gs`, `Report.gs` or `Giving.gs` changes:

1. Paste the new version into Apps Script and save.
2. Open **Code.gs** and run **setup** once. The dropdown lists only the open file's functions, so setup won't appear while Report.gs or Giving.gs is open. If the new version needs a new permission, Google asks for it here. The pages can't ask, so skipping this step makes them fail until someone runs setup. Setup doesn't change the codes or any report tabs.
3. Click **Deploy → Manage deployments**, then click the pencil icon. Under **Version**, choose **New version**, then click **Deploy**.

Don't use **New deployment**, because it creates a new URL and the pages would stop reaching the script.

## Changing the classes or designations

The lists are near the top of `Code.gs`, in `SUNDAY_SCHOOL` and `OTHER_DESIGNATIONS`. To add, rename, remove, or reorder one, edit the list and follow "Updating the script" above.

The page picks up the new lists from the script a moment after it opens, so it doesn't need to be republished. Past report tabs keep the names they were saved with.
