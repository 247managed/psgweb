/**
 * PSGWEB form endpoint - Google Apps Script Web App
 * ------------------------------------------------------------------
 * Receives form submissions from paulagordy.com (GitHub Pages) and
 * emails them to practice staff. Runs inside the paulagordy.com
 * Google Workspace tenant, so Gmail / Drive / Apps Script handling of
 * the data is covered by the practice's signed Google BAA.
 *
 * For BHIS referrals it also attaches a PRE-FILLED, UNSIGNED copy of the
 * practice's "Authorization to Obtain or Release Health Care Information"
 * so staff do not retype what the referrer already gave us. It is
 * deliberately not a completed authorization - see buildReleaseHtml().
 *
 * Deploy: Deploy > New deployment > Web app
 *   Execute as:      Me (a @paulagordy.com account)
 *   Who has access:  Anyone
 * Then paste the /exec URL into js/form-submit.js.
 * ------------------------------------------------------------------
 */

var CONFIG = {
  // Where each form type is delivered.
  recipients: {
    'bhis-referral': 'jalyn.day@paulagordy.com',
    'contact': 'info@paulagordy.com'
  },

  // Fallback if an unknown formType arrives.
  defaultRecipient: 'info@paulagordy.com',

  // Optional: id of a Google Sheet to log submissions to, so nothing is
  // lost if an email bounces. Leave '' to disable.
  // NOTE: a log of BHIS referrals contains PHI. If you enable this, keep
  // the Sheet in a restricted Drive folder shared only with staff who
  // need it, and never share it outside the paulagordy.com tenant.
  spreadsheetId: '',

  // Attach the pre-filled Release of Information to BHIS referrals.
  // Set false to go back to email-only.
  attachReleaseForm: true,

  // Appears in the "With the following agency" block of the release.
  practice: {
    name: 'Paula S. Gordy LISW, LLC',
    address: '501 N. 12th St., Ste 1',
    cityStateZip: 'Centerville, IA 52544',
    phone: '641-856-2688',
    fax: '641-856-2690'
  },

  // Pre-printed on the practice's paper form.
  releasePurpose: 'Coordination of Services and Treatment Planning',

  // Reject anything that is not one of these form types.
  allowedFormTypes: ['bhis-referral', 'contact'],

  // Abuse guards.
  maxFields: 80,
  maxValueLength: 5000,
  maxPayloadBytes: 100000,
  maxEmailsPerHour: 40
};

/**
 * Simple health check so you can confirm the deployment is live by
 * opening the /exec URL in a browser. Returns no submission data.
 */
function doGet() {
  return json({ ok: true, service: 'psgweb-forms' });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json({ ok: false, error: 'Empty request.' });
    }
    if (e.postData.contents.length > CONFIG.maxPayloadBytes) {
      return json({ ok: false, error: 'Request too large.' });
    }

    var data = JSON.parse(e.postData.contents);

    var formType = String(data.formType || '');
    if (CONFIG.allowedFormTypes.indexOf(formType) === -1) {
      return json({ ok: false, error: 'Unknown form type.' });
    }

    var fields = Array.isArray(data.fields) ? data.fields : [];
    if (!fields.length) {
      return json({ ok: false, error: 'No form data received.' });
    }
    if (fields.length > CONFIG.maxFields) {
      return json({ ok: false, error: 'Too many fields.' });
    }

    if (!withinRateLimit()) {
      return json({ ok: false, error: 'Too many submissions right now. Please call the office.' });
    }

    var recipient = CONFIG.recipients[formType] || CONFIG.defaultRecipient;
    var subject = sanitizeLine(data.subject || 'Website Form Submission');
    var values = byKey(fields);

    // A failure building the PDF must never lose the referral itself,
    // so the attachment is best-effort and the email goes either way.
    var attachments = [];
    var attachmentNote = '';
    if (formType === 'bhis-referral' && CONFIG.attachReleaseForm) {
      var pdf = buildReleasePdf(values);
      if (pdf) {
        attachments.push(pdf);
        attachmentNote = 'attached';
      } else {
        attachmentNote = 'failed';
      }
    }

    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      body: buildBody(formType, fields, data, attachmentNote),
      name: 'paulagordy.com Website',
      noReply: true,
      attachments: attachments
    });

    logToSheet(formType, subject, recipient, fields);

    return json({ ok: true });
  } catch (err) {
    // Deliberately does not echo the submitted data back to the client.
    console.error('Form submission failed: ' + err);
    return json({ ok: false, error: 'The submission could not be processed.' });
  }
}

/** Index submitted fields by the input name the page sent. */
function byKey(fields) {
  var map = {};
  fields.forEach(function (f) {
    if (f && f.key) map[String(f.key)] = String(f.value == null ? '' : f.value);
  });
  return map;
}

/** Build the plain-text email body from the labelled fields. */
function buildBody(formType, fields, data, attachmentNote) {
  var lines = [];

  lines.push(formType === 'bhis-referral'
    ? 'A new BHIS referral was submitted through paulagordy.com.'
    : 'A new message was submitted through paulagordy.com.');
  lines.push('');
  lines.push('Received: ' + Utilities.formatDate(new Date(), 'America/Chicago', "EEEE, MMMM d, yyyy 'at' h:mm a z"));
  lines.push('');

  if (attachmentNote === 'attached') {
    lines.push('ATTACHED: a pre-filled Release of Information (PDF).');
    lines.push('It is NOT signed and is NOT a valid authorization yet. The');
    lines.push('client or guardian still has to mark which records may be');
    lines.push('shared, initial the specific-consent rows, and sign it.');
    lines.push('');
  } else if (attachmentNote === 'failed') {
    lines.push('NOTE: the pre-filled Release of Information could not be');
    lines.push('generated for this referral. Use the blank paper form.');
    lines.push('');
  }

  lines.push('----------------------------------------------------------');
  lines.push('');

  fields.forEach(function (field) {
    var label = sanitizeLine(field && field.label ? field.label : 'Field');
    var value = String(field && field.value != null ? field.value : '');
    if (value.length > CONFIG.maxValueLength) {
      value = value.substring(0, CONFIG.maxValueLength) + ' [truncated]';
    }
    if (value.indexOf('\n') !== -1) {
      lines.push(label + ':');
      value.split('\n').forEach(function (part) { lines.push('  ' + part); });
    } else {
      lines.push(label + ': ' + value);
    }
    lines.push('');
  });

  lines.push('----------------------------------------------------------');
  lines.push('');
  lines.push('Submitted from: ' + sanitizeLine(data.submittedFrom || 'unknown'));
  lines.push('Browser: ' + sanitizeLine(data.userAgent || 'unknown'));
  lines.push('');

  if (formType === 'bhis-referral') {
    lines.push('This email contains protected health information. Handle it');
    lines.push('according to the practice HIPAA policy and do not forward it');
    lines.push('outside the paulagordy.com Workspace account.');
  }

  return lines.join('\n');
}

/**
 * Render the pre-filled release as a PDF blob, or null on failure.
 */
function buildReleasePdf(values) {
  try {
    var html = buildReleaseHtml(values);
    var blob = Utilities.newBlob(html, 'text/html', 'release.html').getAs('application/pdf');
    var who = fileSafe(joinName(values) || 'client');
    blob.setName('Release-of-Information-PREFILLED-' + who + '.pdf');
    return blob;
  } catch (err) {
    console.error('Release PDF generation failed: ' + err);
    return null;
  }
}

function joinName(values) {
  return [values['client_first_name'], values['client_last_name']]
    .filter(function (p) { return p; }).join(' ').trim();
}

function fileSafe(text) {
  return String(text).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60);
}

/**
 * The practice's "Authorization to Obtain or Release Health Care
 * Information", pre-filled from the referral.
 *
 * WHAT IS DELIBERATELY LEFT BLANK, and why:
 *   - Authorizing signature, date, expiration date. Whoever submitted the
 *     referral is often a school counsellor or case manager who cannot
 *     sign a release on the family's behalf, so nothing here may be
 *     presented as signed.
 *   - Which categories of records may be shared. That is the client's
 *     choice, not ours to assume.
 *   - The specific-consent initials (mental health, AIDS/HIV, substance
 *     abuse). These require specific consent under federal law and must
 *     never be pre-marked.
 *   - SS#. The web form does not collect it and should not.
 *   - Relationship of the signer, and Self / Other. We do not know who
 *     will actually sign.
 */
function buildReleaseHtml(values) {
  var p = CONFIG.practice;
  var clientName = joinName(values);
  var otherAgency = values['referrer_org'] || values['referrer_name'] || '';

  var css =
    '@page { size: letter; margin: 0.5in; }' +
    'body { font-family: Georgia, "Times New Roman", serif; font-size: 9.5pt; color: #000; margin: 0; }' +
    'h1 { font-size: 13pt; text-align: center; margin: 0 0 2pt; letter-spacing: .5pt; }' +
    'h2 { font-size: 10.5pt; text-align: center; font-weight: normal; margin: 0 0 8pt; }' +
    '.banner { border: 1.5pt solid #000; background: #eee; padding: 5pt 7pt; margin-bottom: 8pt; font-family: Arial, Helvetica, sans-serif; font-size: 8pt; }' +
    '.banner strong { font-size: 8.5pt; }' +
    'table { width: 100%; border-collapse: collapse; margin-bottom: 6pt; }' +
    'td, th { border: 0.75pt solid #000; padding: 3pt 4pt; vertical-align: top; font-size: 9pt; }' +
    '.lbl { white-space: nowrap; }' +
    '.fill { font-family: Arial, Helvetica, sans-serif; font-weight: bold; }' +
    '.blank { color: #666; font-family: Arial, Helvetica, sans-serif; font-size: 7.5pt; font-style: italic; }' +
    '.stmt { text-align: center; font-weight: bold; padding: 4pt; }' +
    '.para { text-align: justify; font-size: 8.5pt; line-height: 1.35; padding: 5pt 6pt; border: 0.75pt solid #000; margin-bottom: 6pt; }' +
    '.box { display: inline-block; width: 8pt; height: 8pt; border: 0.75pt solid #000; margin-right: 3pt; vertical-align: -1pt; }' +
    '.items td { border: none; padding: 1.5pt 4pt; font-size: 8.5pt; }' +
    '.items { border: 0.75pt solid #000; }' +
    '.sig { height: 30pt; }' +
    '.notice { margin-top: 8pt; font-size: 8pt; text-align: justify; line-height: 1.3; }' +
    '.notice h3 { font-size: 9pt; text-align: center; margin: 0 0 3pt; font-weight: normal; }';

  var items = [
    ['Discharge Summary', 'Psychological Evals', 'Diagnosis', 'Treatment/Service Plan'],
    ['Social History', 'School Records', 'Court Documents', 'Medication Records'],
    ['Receiving Phone Calls', 'Progress Reports', 'Initial Assessment', 'Psychiatric Evaluations']
  ];

  var h = [];
  h.push('<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + css + '</style></head><body>');

  h.push('<div class="banner"><strong>PRE-FILLED FROM A WEBSITE REFERRAL &mdash; NOT A VALID AUTHORIZATION.</strong><br>' +
    'Generated ' + esc(Utilities.formatDate(new Date(), 'America/Chicago', 'MMMM d, yyyy')) +
    ' from the BHIS referral submitted for this client. The bold entries below were supplied by the referrer and should be ' +
    'checked against the record. This form does not authorize anything until the client or legal guardian marks which records ' +
    'may be shared, initials the specific-consent rows, and signs and dates it.</div>');

  h.push('<h1>' + esc(p.name.toUpperCase()) + '</h1>');
  h.push('<h2>AUTHORIZATION TO OBTAIN OR RELEASE HEALTH CARE INFORMATION</h2>');

  h.push('<table>');
  h.push(row2('Client Name:', fill(clientName), 'SS#:', blank('not collected online')));
  h.push(row2('Date of Birth:', fill(formatDate(values['client_dob'])), 'Parent/Guardian:', fill(values['guardian_name'])));
  h.push('</table>');

  h.push('<table><tr><td class="stmt">I authorize the following individual or agency to share written and oral ' +
    'information (two-way or reciprocal release) about my needs and the services I receive:</td></tr></table>');

  h.push('<table>');
  h.push(row1('Name or agency to release and receive information:', fill(otherAgency)));
  h.push(row1('Address:', blank('to be completed')));
  h.push(row1('City/State/Zip:', blank('to be completed')));
  h.push(row2('Phone:', fill(values['referrer_phone']), 'Fax:', blank('to be completed')));
  h.push('</table>');

  h.push('<table><tr><td class="stmt">With the following agency:</td></tr></table>');
  h.push('<table>');
  h.push(row1(esc(p.name), ''));
  h.push(row1(esc(p.address), ''));
  h.push(row1(esc(p.cityStateZip), ''));
  h.push(row2('Phone:', esc(p.phone), 'Fax:', esc(p.fax)));
  h.push('</table>');

  h.push('<table class="items"><tr><td colspan="4"><strong>The information released or shared may include:</strong> ' +
    '<span class="blank">(client or guardian marks these)</span></td></tr>');
  items.forEach(function (r) {
    h.push('<tr>' + r.map(function (c) { return '<td><span class="box"></span>' + esc(c) + '</td>'; }).join('') + '</tr>');
  });
  h.push('<tr><td colspan="2"><span class="box"></span>Consultation reports from (doctor/specialty name):</td>' +
    '<td colspan="2"><span class="box"></span>Other (please specify):</td></tr>');
  h.push('</table>');

  h.push('<table><tr><td class="lbl"><strong>This information is being used ONLY for (state purpose):</strong></td>' +
    '<td>' + esc(CONFIG.releasePurpose) + '</td></tr></table>');

  h.push('<table><tr><td style="width:50%"><strong>SPECIFIC AUTHORIZATION FOR RELEASE</strong><br>' +
    'I authorize the release of the information listed at the right, which requires specific consent under federal law:</td>' +
    '<td style="padding:0"><table style="margin:0;border:none">' +
    '<tr><th style="border-top:none;border-left:none">Type of Information</th><th style="border-top:none;border-right:none">Authorizing Initials</th></tr>' +
    '<tr><td style="border-left:none">Mental health eval/treatment</td><td style="border-right:none"></td></tr>' +
    '<tr><td style="border-left:none">AIDS/HIV related</td><td style="border-right:none"></td></tr>' +
    '<tr><td style="border-left:none;border-bottom:none">Substance Abuse</td><td style="border-right:none;border-bottom:none"></td></tr>' +
    '</table></td></tr></table>');

  h.push('<div class="para">This authorization is valid for information already in existence and any information that may be ' +
    'generated while this authorization is effective. I understand that I have the right to see any information that is ' +
    'disclosed pursuant to this authorization for release. I may request this information during normal business hours. ' +
    'I understand that I can revoke my authorization at any time in writing. Unless otherwise revoked, this authorization ' +
    'shall expire on the date specified below. If I fail to specify an expiration date, this authorization will expire in ' +
    'one year after the date it is signed. I understand that authorizing the disclosure of this information is voluntary. ' +
    'I can refuse to sign this authorization. I need not sign this form in order to receive services. I understand that any ' +
    'disclosure of information carries with it the potential for unauthorized redisclosure and the information may not be ' +
    'protected by federal confidentiality rules. If I have questions about disclosure of my health information, I can contact ' +
    esc(p.name) + ' at ' + esc(p.phone) + '. I have read this form, or it has been read to me and explained to me, and I ' +
    'understand its content.</div>');

  h.push('<table>');
  h.push('<tr><td class="sig" style="width:55%">Authorizing Signature: X</td><td style="width:22%">Date:</td>' +
    '<td style="width:23%">Expiration Date:</td></tr>');
  h.push('<tr><td colspan="3">Relationship to Individuals Receiving Services: ' +
    '<span class="box"></span>Self &nbsp;&nbsp; <span class="box"></span>Other (please specify):</td></tr>');
  h.push(row1('Please Return To:', ''));
  h.push(row1('Address:', ''));
  h.push('</table>');

  h.push('<div class="notice"><h3>NOTICE TO RECIPIENT OF INFORMATION</h3>' +
    'This information has been disclosed to you from records protected by Federal confidentiality rules (42 CFR part 2). ' +
    'The Federal rules prohibit you from making any further disclosure of this information unless further disclosure is ' +
    'expressly permitted by the written consent of the person to whom it pertains or as otherwise permitted by 42 CFR Part 2. ' +
    'A general authorization for the release of medical or other information is <u>NOT</u> sufficient for this purpose.</div>');

  h.push('</body></html>');
  return h.join('');
}

function row1(label, value) {
  return '<tr><td class="lbl" style="width:38%">' + label + '</td><td>' + value + '</td></tr>';
}

function row2(l1, v1, l2, v2) {
  return '<tr><td class="lbl" style="width:16%">' + l1 + '</td><td style="width:34%">' + v1 + '</td>' +
    '<td class="lbl" style="width:16%">' + l2 + '</td><td>' + v2 + '</td></tr>';
}

function fill(value) {
  var v = String(value == null ? '' : value).trim();
  return v ? '<span class="fill">' + esc(v) + '</span>' : blank('to be completed');
}

function blank(note) {
  return '<span class="blank">' + esc(note) + '</span>';
}

/** yyyy-mm-dd from the date input, rendered the way staff read it. */
function formatDate(value) {
  var v = String(value == null ? '' : value).trim();
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return v;
  var months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var mi = parseInt(m[2], 10) - 1;
  if (mi < 0 || mi > 11) return v;
  return months[mi] + ' ' + parseInt(m[3], 10) + ', ' + m[1];
}

function esc(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Optional Sheet log, so a bounced email does not lose a referral. */
function logToSheet(formType, subject, recipient, fields) {
  if (!CONFIG.spreadsheetId) return;
  try {
    var sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheets()[0];
    var summary = fields.map(function (f) {
      return sanitizeLine(f.label) + ': ' + String(f.value == null ? '' : f.value);
    }).join('\n');
    sheet.appendRow([new Date(), formType, subject, recipient, summary]);
  } catch (err) {
    console.error('Sheet logging failed: ' + err);
  }
}

/** Rolling hourly cap so a scripted flood cannot bury the inbox. */
function withinRateLimit() {
  var props = PropertiesService.getScriptProperties();
  var hourKey = Utilities.formatDate(new Date(), 'America/Chicago', 'yyyyMMddHH');
  var stored = props.getProperty('rate_' + hourKey);
  var count = stored ? parseInt(stored, 10) : 0;
  if (count >= CONFIG.maxEmailsPerHour) return false;
  props.setProperty('rate_' + hourKey, String(count + 1));
  return true;
}

/** Strip control characters and header-injection attempts from one line. */
function sanitizeLine(value) {
  return String(value).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().substring(0, 300);
}

function json(obj) {
  // Apps Script web apps cannot set status codes on ContentService output;
  // the ok flag in the body is what the browser checks.
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
