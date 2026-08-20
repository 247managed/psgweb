# Form Endpoint Setup (Google Apps Script)

The website is static (GitHub Pages), so it cannot send email itself. Form data is
posted from the visitor's browser **directly** to a Google Apps Script Web App that
runs inside the `paulagordy.com` Google Workspace tenant, which then emails the
submission to staff.

Why this design:

- Google Workspace (Gmail, Drive/Sheets, Apps Script) is on Google's HIPAA Included
  Functionality list and is covered by the practice's signed BAA.
- GitHub Pages only serves the HTML. The submitted data never passes through GitHub,
  Cloudflare, or any vendor without a BAA.
- No monthly cost, since it uses the Workspace subscription the practice already has.

Two forms use it:

| Form | `formType` | Delivered to |
|---|---|---|
| `pages/bhis-referral.html` | `bhis-referral` | jalyn.day@paulagordy.com |
| `pages/contact.html` | `contact` | info@paulagordy.com |

## One-time setup

1. **Sign in** to <https://script.google.com> with a `@paulagordy.com` Workspace
   account. Do **not** use a personal Gmail account — a consumer account is not
   covered by the BAA.
2. **New project**, name it something like `paulagordy.com Website Forms`.
3. Replace the contents of `Code.gs` with the contents of `apps-script/Code.gs`
   from this repo, then save.
4. **Deploy → New deployment → Web app**:
   - Description: `Website form endpoint`
   - Execute as: **Me** (the `@paulagordy.com` account)
   - Who has access: **Anyone**

   "Anyone" is required so a visitor's browser can post to it. The script only
   accepts writes — it never returns submitted data, so nothing can be read back
   out of it.
5. Authorize the script when prompted (it needs permission to send email as the
   account).
6. Copy the deployment URL. It looks like
   `https://script.google.com/macros/s/AKfycb.../exec`.
7. Paste that URL into `js/form-submit.js`, replacing
   `PASTE_APPS_SCRIPT_WEB_APP_URL_HERE`:

   ```js
   var ENDPOINT = 'https://script.google.com/macros/s/AKfycb.../exec';
   ```

8. Commit and push to `main`. GitHub Pages redeploys automatically.

## The pre-filled Release of Information

Every BHIS referral email carries a PDF copy of the practice's **Authorization to Obtain or
Release Health Care Information**, pre-filled from the referral so staff are not retyping
what the referrer already gave us. It is generated from HTML by Apps Script
(`Utilities.newBlob(...).getAs("application/pdf")`) - no external service.

**It is not a completed authorization and is labelled as such** in a banner across the top,
in the filename (`Release-of-Information-PREFILLED-<name>.pdf`) and in the email body.

Pre-filled from the referral:

| Field on the form | Comes from |
|---|---|
| Client Name | client first + last name |
| Date of Birth | client DOB, rendered as "April 12, 2015" |
| Parent/Guardian | parent/guardian name |
| Name or agency to release and receive information | referrer's agency, or their name if no agency |
| Phone | referrer phone |
| With the following agency | the practice block in `CONFIG.practice` |
| Purpose | `CONFIG.releasePurpose` |

Deliberately left blank, and why:

- **Signature, date, expiration date.** Referrals often come from school staff and case
  managers who cannot sign a release for the family. The referrer's typed name from the
  referral is never reused as the authorizing signature.
- **Which records may be shared.** The client's choice, not ours to assume.
- **The specific-consent initials** (mental health, AIDS/HIV, substance abuse). These
  require specific consent under federal law and must never be pre-marked.
- **SS#.** The web form does not collect it and should not. The field is marked
  "not collected online".
- **Relationship of the signer, Self / Other, Return To.** We do not know who will sign.

To turn the attachment off, set `CONFIG.attachReleaseForm = false` and redeploy. If PDF
generation ever fails the referral email still goes out, without the attachment, and the
body tells staff to use the blank paper form.

## Testing

- Open the `/exec` URL in a browser. It should return `{"ok":true,"service":"psgweb-forms"}`.
- Submit the live contact form at <https://paulagordy.com/pages/contact.html> and
  confirm the email arrives at info@paulagordy.com.
- Submit a test referral at <https://paulagordy.com/pages/bhis-referral.html> with
  obviously fake client details and confirm it arrives at jalyn.day@paulagordy.com.
  **Open the attached PDF and check the layout** - the HTML-to-PDF conversion is done by
  Google and has not been eyeballed on a real submission yet. Confirm it fits one page and
  that the signature block is empty. Delete the test email afterwards.
- If a submission fails, the visitor sees an error with the office phone number and
  their answers are preserved. The form never shows a false "submitted" message.

## Changing where mail goes

Edit `CONFIG.recipients` at the top of `Code.gs`, save, then **Deploy → Manage
deployments → edit → Deploy** to push a new version. Editing the code alone does
not update the live web app.

Multiple recipients work as a comma-separated string:

```js
'bhis-referral': 'jalyn.day@paulagordy.com,info@paulagordy.com'
```

## Optional: log referrals to a Sheet

Email is the primary delivery, but a Sheet log means nothing is lost if an email
is deleted or bounces.

1. Create a Google Sheet in a Drive folder shared only with staff who need it.
2. Copy its id from the URL (`docs.google.com/spreadsheets/d/<ID>/edit`).
3. Set `CONFIG.spreadsheetId` in `Code.gs` and redeploy.

**A log of BHIS referrals contains PHI.** Keep it inside the `paulagordy.com`
tenant, never share it with a link, and apply the practice's retention policy.

## Built-in abuse protection

- Honeypot field plus a minimum fill time on both forms (client side).
- Unknown `formType` values are rejected.
- Payload, field-count, and field-length caps.
- A rolling cap of 40 emails per hour (`CONFIG.maxEmailsPerHour`) so a scripted
  flood cannot bury the inbox. Raise it if referral volume ever approaches that.
- No third-party scripts (no reCAPTCHA/Turnstile) run on the referral page, so no
  outside vendor can observe the PHI in the form.

## Compliance notes

- Apps Script quota for a Workspace account is well above expected referral volume,
  but MailApp does have a daily send limit; if it is ever hit, submissions fail
  loudly rather than silently.
- Anyone with Workspace admin access can read the script's execution logs. The
  script deliberately does not log field values — only error text.
- Access to the script project itself should be limited to admins.
