# KCET Class Agent — setup

Add the repository file ClassAgent.gs to the SAME Apps Script project as the existing Daily Exit Ticket. It defines doGet and doPost. Its doGet router sends action=assignments to the Class Agent and all other requests to your existing getExitTicketDashboardData_() function, preserving the Exit Ticket JSON/JSONP feed. Replace your old doGet(e) with this router, keep getExitTicketDashboardData_() and its helper functions, and add doPost(e). Do not leave duplicate doGet functions.

## Backend setup
1. Open the Apps Script project connected to the course spreadsheet.
2. Add a script file named ClassAgent.gs and paste the repository file contents.
3. Run setupClassAgent() once and approve Sheets and Drive permissions. It reuses SPREADSHEET_ID if set, preserves Form Responses 1, creates CA Assignments, CA Submissions and CA Marks, and creates a private Drive folder. Each student submission is saved as a text record in that folder; any student-provided Drive link is included in the record for faculty review.
4. In Project Settings → Script Properties, add GEMINI_API_KEY (your Gemini API key) and FACULTY_PASSWORD_SHA256 (SHA-256 hash of a strong unique faculty password). Never put either secret in GitHub.

Generate the password hash by temporarily running this helper after replacing the sample password; copy the log value to Script Properties and then remove the helper:

```javascript
function printFacultyPasswordHashOnce(){const password='REPLACE_WITH_A_LONG_UNIQUE_PASSWORD';const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,password,Utilities.Charset.UTF_8).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');console.log(hash)}
```

## Faculty assignment posting PIN (no sign-in)
Assignment creation uses a separate shared PIN. Faculty do not need to sign in to publish a topic, instructions, unit, due date and marks. The existing faculty password login remains required for viewing student submissions, AI-assisted evaluation, and approving/releasing marks.

1. Choose a strong, private PIN and share it only with authorised faculty. Do not put the PIN in GitHub or the website.
2. In Apps Script, open Project Settings → Script Properties.
3. Add a property named `CA_ASSIGNMENT_PIN_SHA256` with the SHA-256 hash of your chosen PIN.
4. To calculate the hash, temporarily add this helper to the Apps Script editor, replace the sample value locally, run it once, copy the log output into the Script Property, and then delete the helper:
```javascript
function printAssignmentPinHashOnce(){
  const pin='REPLACE_WITH_YOUR_PRIVATE_PIN';
  const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,pin,Utilities.Charset.UTF_8)
    .map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
  console.log(hash);
}
```
5. Save and deploy a New version of the Web App. The website will show a separate Faculty Assignment Posting form. Enter the PIN to publish; no faculty sign-in is needed for this action.

The PIN is shared among faculty, so rotate it if it is disclosed. This PIN protects assignment creation only; it does not grant access to student submissions or marks. Anyone who obtains the PIN can publish assignments, so distribute it carefully.

## Deployment
Deploy → Manage deployments → Edit → New version → Deploy. Choose Execute as: Me. For no-login student access, the web app must accept anonymous users (Anyone), if allowed by your Workspace administrator. If anonymous deployment is prohibited, student sign-in must be enabled instead. Paste the /exec URL into the website Class Agent connection field. The same endpoint serves both the Class Agent and Exit Ticket: action=assignments returns published tasks; the normal callback request continues to call getExitTicketDashboardData_(). Keep that existing data function and its helpers.

## Test
Publish a test assignment, submit a dummy answer, save the receipt code, sign in to the faculty panel, load submissions, generate AI draft feedback, verify it, edit marks if needed and Approve & release. Check released feedback using the roll number and receipt code. Test the Exit Ticket separately.

## Safeguards and limitations
- With no student login, names and roll numbers are self-declared and cannot be verified. The receipt code is required to retrieve released marks; students must keep it private. Do not expose a public marks list.
- Faculty actions are checked server-side with a six-hour session token. Use a long unique password and protect Apps Script project access.
- AI scores are provisional; faculty approval is mandatory. AI cannot open or inspect Drive links in this starter version; faculty must inspect linked files directly.
- Student submissions accept typed answers and Google Drive share links. A private text record is created in the faculty-owned Drive folder for each submission. The AI does not open linked files; faculty must inspect any student-provided Drive link and ensure it is shared with the faculty account according to institutional policy. Direct binary file upload is not included in this first release.
- Test with dummy records and obtain institutional IT/data-protection approval before using official marks. Back up the spreadsheet and review access permissions regularly.

## Gemini API connection test (updated November 2026)
Google's current Gemini API guidance uses the `x-goog-api-key` HTTP header for REST requests and new AI Studio keys are authorization keys. The current Class Agent backend uses that header and the `gemini-3.6-flash` model. See the official [Gemini API key guide](https://ai.google.dev/gemini-api/docs/generate-content/api-key).

After updating `ClassAgent.gs` in Apps Script and saving:
1. In Project Settings → Script Properties, confirm the property name is exactly `GEMINI_API_KEY` (no spaces) and the value is the complete key, with no quotation marks or leading/trailing spaces.
2. In the Apps Script editor, select `testGeminiConnection` and click Run. Approve the external request permission if prompted.
3. Open **Executions** (left sidebar) and inspect the latest run. A successful test logs `KCET Gemini connection successful`. If it fails, the exception now includes the Gemini HTTP status and Google API error message.
4. After a successful test, deploy the web app again using Deploy → Manage deployments → Edit → New version → Deploy. The Script Property itself does not require a deployment, but code changes do.
5. Re-test **Ask the Class Agent** and **AI evaluate** on the website.

Do not paste the API key into GitHub, website JavaScript, or a chat. Do not share execution logs if they contain secrets.

 
## Fix for faculty sign-in showing "No response / loading continuously"
The website/backend transport has been changed to avoid relying on an Apps Script HTML response executing inside a cross-origin hidden iframe. The browser now submits the request to `doPost`, and the page retrieves the result using a JSONP poll to `doGet?action=apiResult`. This keeps the faculty password in the POST body rather than a URL query string. Google documents the `doPost(e)` event parameters and web-app deployment behavior at https://developers.google.com/apps-script/guides/web.

Apply BOTH updated files from GitHub:
- Replace the complete contents of the Apps Script `ClassAgent.gs` with the repository version.
- Update the website repository's `app.js` (GitHub Pages will publish it automatically after the commit).

Then in Apps Script: Save → Deploy → Manage deployments → Edit → New version → Deploy. Copy the deployed URL ending in `/exec` and re-save it in the website's Class Agent endpoint field. Test in a fresh browser tab. Check Apps Script **Executions**: a login attempt should create a `doPost` execution. If no execution appears, the endpoint/deployment URL or access setting is wrong. If an execution appears with an error, inspect that execution's error details.

The hidden form iframe is used only to send the POST; the browser no longer waits for a JavaScript `postMessage` from an Apps Script HtmlService page. This avoids a class of cross-origin iframe response failures.
