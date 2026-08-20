/**
 * PSGWEB form endpoint - Google Apps Script Web App
 * ------------------------------------------------------------------
 * Receives form submissions from paulagordy.com (GitHub Pages) and
 * emails them to practice staff. Runs inside the paulagordy.com
 * Google Workspace tenant, so Gmail / Drive / Apps Script handling of
 * the data is covered by the practice's signed Google BAA.
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
      return json({ ok: false, error: 'Empty request.' }, 400);
    }
    if (e.postData.contents.length > CONFIG.maxPayloadBytes) {
      return json({ ok: false, error: 'Request too large.' }, 413);
    }

    var data = JSON.parse(e.postData.contents);

    var formType = String(data.formType || '');
    if (CONFIG.allowedFormTypes.indexOf(formType) === -1) {
      return json({ ok: false, error: 'Unknown form type.' }, 400);
    }

    var fields = Array.isArray(data.fields) ? data.fields : [];
    if (!fields.length) {
      return json({ ok: false, error: 'No form data received.' }, 400);
    }
    if (fields.length > CONFIG.maxFields) {
      return json({ ok: false, error: 'Too many fields.' }, 400);
    }

    if (!withinRateLimit()) {
      return json({ ok: false, error: 'Too many submissions right now. Please call the office.' }, 429);
    }

    var recipient = CONFIG.recipients[formType] || CONFIG.defaultRecipient;
    var subject = sanitizeLine(data.subject || 'Website Form Submission');
    var body = buildBody(formType, fields, data);

    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      body: body,
      name: 'paulagordy.com Website',
      noReply: true
    });

    logToSheet(formType, subject, recipient, fields);

    return json({ ok: true });
  } catch (err) {
    // Deliberately does not echo the submitted data back to the client.
    console.error('Form submission failed: ' + err);
    return json({ ok: false, error: 'The submission could not be processed.' }, 500);
  }
}

/** Build the plain-text email body from the labelled fields. */
function buildBody(formType, fields, data) {
  var lines = [];

  lines.push(formType === 'bhis-referral'
    ? 'A new BHIS referral was submitted through paulagordy.com.'
    : 'A new message was submitted through paulagordy.com.');
  lines.push('');
  lines.push('Received: ' + Utilities.formatDate(new Date(), 'America/Chicago', "EEEE, MMMM d, yyyy 'at' h:mm a z"));
  lines.push('');
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

function json(obj, status) {
  // Apps Script web apps cannot set status codes on ContentService output;
  // the ok flag in the body is what the browser checks.
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
