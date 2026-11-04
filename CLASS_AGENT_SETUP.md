# KCET Class Agent — setup

Add the repository file ClassAgent.gs to the SAME Apps Script project as the existing Daily Exit Ticket. It defines doGet and doPost; if these names already exist, merge the Class Agent routes into your existing handlers rather than leaving duplicate definitions.

## Backend setup
1. Open the Apps Script project connected to the course spreadsheet.
2. Add a script file named ClassAgent.gs and paste the repository file contents.
3. Run setupClassAgent() once and approve Sheets and Drive permissions. It reuses SPREADSHEET_ID if set, preserves Form Responses 1, creates CA Assignments, CA Submissions and CA Marks, and creates a Drive folder.
4. In Project Settings → Script Properties, add GEMINI_API_KEY (your Gemini API key) and FACULTY_PASSWORD_SHA256 (SHA-256 hash of a strong unique faculty password). Never put either secret in GitHub.

Generate the password hash by temporarily running this helper after replacing the sample password; copy the log value to Script Properties and then remove the helper:

```javascript
function printFacultyPasswordHashOnce(){const password='REPLACE_WITH_A_LONG_UNIQUE_PASSWORD';const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,password,Utilities.Charset.UTF_8).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');console.log(hash)}
```

## Deployment
Deploy → Manage deployments → Edit → New version → Deploy. Choose Execute as: Me. For no-login student access, the web app must accept anonymous users (Anyone), if allowed by your Workspace administrator. If anonymous deployment is prohibited, student sign-in must be enabled instead. Paste the /exec URL into the website Class Agent connection field. The same endpoint can serve the Exit Ticket only after merging both doGet routes and retaining the existing Exit Ticket handler and data function.

## Test
Publish a test assignment, submit a dummy answer, save the receipt code, sign in to the faculty panel, load submissions, generate AI draft feedback, verify it, edit marks if needed and Approve & release. Check released feedback using the roll number and receipt code. Test the Exit Ticket separately.

## Safeguards and limitations
- With no student login, names and roll numbers are self-declared and cannot be verified. The receipt code is required to retrieve released marks; students must keep it private. Do not expose a public marks list.
- Faculty actions are checked server-side with a six-hour session token. Use a long unique password and protect Apps Script project access.
- AI scores are provisional; faculty approval is mandatory. AI cannot open or inspect Drive links in this starter version; faculty must inspect linked files directly.
- Student submissions accept text and Google Drive share links. Students must share linked files with the faculty account according to institutional policy. Direct file upload is not included in this first release.
- Test with dummy records and obtain institutional IT/data-protection approval before using official marks. Back up the spreadsheet and review access permissions regularly.
