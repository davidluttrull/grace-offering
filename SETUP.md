# Offering Report: Setup

Counters fill in the offering report on a phone instead of in the spreadsheet. Each time they submit, the Google Sheet gets a new tab named for the report date (for example **Oct 12, 2026**). The tab is laid out like the church's offering report, with the same formatting and formulas, and the green cells are filled in.

The next day, the business office opens a second page, picks the report, and enters its own figures beside the counters' figures, plus the week's online giving. They're saved into that tab's "Business Office Only" cells, and a one-page PDF report is emailed to the staff.

It has three parts:

- **The Sheet and its script** (`Code.gs` and `Report.gs`). The script lives inside the Google Sheet. It builds a **Template** tab that looks like the offering report, then copies it for each report and fills it in. `Report.gs` builds and emails the PDF report.
- **The counters' page** (`index.html`, plus the logo, icons, and `manifest.webmanifest`). It's hosted on GitHub Pages at <https://davidluttrull.github.io/grace-offering/>.
- **The business office's page** (`office.html` and `office.webmanifest`), at <https://davidluttrull.github.io/grace-offering/office.html>.

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
4. Click the **+** next to "Files", choose **Script**, and name it `Report` (Apps Script adds the `.gs` itself). Delete what's inside and paste in the contents of `Report.gs`.
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

Send the counters <https://davidluttrull.github.io/grace-offering/> and the counter code. Each counter should save the page to their home screen. It shows up as **Offering** with the Grace cross icon.

- **iPhone:** open the link in Safari, tap the Share button, then tap **Add to Home Screen**.
- **Android:** open the link in Chrome, tap **⋮**, then tap **Add to Home screen** (or **Install app**).

Send the business office <https://davidluttrull.github.io/grace-offering/office.html> and the business office code. It works on a computer or a phone. On a phone it can be saved to the home screen the same way, and shows up as **Verify**.

## How it works: counters

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
- **Online giving.** One box for the week's online giving total, and an optional note such as "Tithe.ly, Oct 5–11". It isn't compared with the count. It's added to the Total Offering to make **Total Giving**, which the Totals table shows at the bottom.
- **Verified By.** One person enters their name, and the device remembers it. Saving writes the office's figures, the online giving, the name, and today's date into the report's tab, then emails the report. The confirmation says whether the email went out.
- **Verifying again** replaces the earlier office figures. The page shows who verified it before and when. Staff get a new report with "Updated" in the subject.

## The Sheet

- New report tabs appear on the left, newest first. **Template** stays on the far right.
- If a tab for that date already exists, the new one is named with **(2)**, **(3)**, and so on. Nothing is ever overwritten.
- The Business Office Only cells start blank. The office's page fills in the dollar amount for each coin and bill (column E) and the checks total (D33). The office's coin and bill totals (D31 and D32) and its Total Offering (D34) are formulas, so they sit right beside the counters' totals in column C. The verifier's name and the date go in the **Verified By** box under the counters' names.
- Under the Totals box, **Online Giving** (D35) holds the office's online giving, with its note beside it in E35, and **Total Giving** (D36) adds it to the office's Total Offering. Report tabs made before this was added get these two rows the first time they're verified.
- The **Verified By** date cell (H36) carries a note, visible when you hover over it, saying when the report was emailed and to how many people, or why it wasn't.
- Each report lists every class and designation under **Sunday School Envelopes** and **Other Designations**, three to a row, in the same style as the original report. Ones the counters added come after the listed ones.
- Don't rename the **Template** tab. You can change its formatting, but keep the green cells in the same places. If the report's layout ever changes, the cell addresses at the top of `Code.gs` have to be updated to match.
- If the Template gets damaged, delete the **Template** tab and run **setup** again. It builds a fresh one. Report tabs and the counter code aren't affected.

## Emailed reports

When the business office saves a verification, the script emails a one-page PDF to everyone on the **Report Emails** tab. The report shows Total Giving, the verified offering, online giving, and whether the office's count matches the counters'. It also has the counted and office figures side by side, the coins and bills, the checks total, the designations that have an amount, and who counted and verified. The email itself shows the offering, online giving, and Total Giving, so staff can see the numbers without opening the attachment.

To stop the emails, clear the addresses on the Report Emails tab.

The Sheet has an **Offering** menu (it appears a few seconds after the Sheet opens). Open a report tab first, then:

- **Email report for this tab** sends that tab's report to everyone on the list again. Use it if an email failed, or to resend an older report.
- **Send me a test report for this tab** sends it only to you, so you can check how it looks without emailing the staff.

Each report is built in a temporary Google Doc that's moved to the Drive trash right after the PDF is made, so you may see "Offering report (temporary)" files in the trash. Google empties the trash on its own after 30 days.

## Updating the script

Whenever `Code.gs` or `Report.gs` changes:

1. Paste the new version into Apps Script and save.
2. Open **Code.gs** and run **setup** once. The dropdown lists only the open file's functions, so setup won't appear while Report.gs is open. If the new version needs a new permission, Google asks for it here. The pages can't ask, so skipping this step makes them fail until someone runs setup. Setup doesn't change the codes or any report tabs.
3. Click **Deploy → Manage deployments**, then click the pencil icon. Under **Version**, choose **New version**, then click **Deploy**.

Don't use **New deployment**, because it creates a new URL and the pages would stop reaching the script.

## Changing the classes or designations

The lists are near the top of `Code.gs`, in `SUNDAY_SCHOOL` and `OTHER_DESIGNATIONS`. To add, rename, remove, or reorder one, edit the list and follow "Updating the script" above.

The page picks up the new lists from the script a moment after it opens, so it doesn't need to be republished. Past report tabs keep the names they were saved with.
