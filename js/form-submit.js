/* ============================================================
   PSGWEB - Form Submission Helper
   ------------------------------------------------------------
   Posts form data to a Google Apps Script Web App running in
   the paulagordy.com Google Workspace tenant, which emails the
   submission to staff. Google Workspace (Gmail, Drive/Sheets,
   Apps Script) is covered by the practice's signed BAA, so
   referral data never passes through a non-covered vendor.
   GitHub Pages only serves this page; it never receives the
   submitted data.

   SETUP: paste the Apps Script deployment URL below.
   See apps-script/README.md for deployment steps.
   ============================================================ */
(function (window, document) {
  'use strict';

  /* ---- CONFIGURATION -------------------------------------- */
  /* Replace with the /exec URL from the Apps Script deployment. */
  var ENDPOINT = 'PASTE_APPS_SCRIPT_WEB_APP_URL_HERE';

  var TIMEOUT_MS = 25000;
  var MIN_FILL_SECONDS = 4; /* submissions faster than this are treated as bots */

  var PSGForms = {};

  PSGForms.isConfigured = function () {
    return ENDPOINT.indexOf('https://script.google.com/') === 0;
  };

  /* Collect labelled values from a form, in DOM order, skipping
     empty fields, honeypots and unchecked boxes. */
  PSGForms.collect = function (form) {
    var fields = [];
    var groups = {};

    form.querySelectorAll('input, select, textarea').forEach(function (el) {
      if (!el.name || el.disabled) return;
      if (el.getAttribute('data-honeypot') === 'true') return;

      var label = el.getAttribute('data-label') || labelFor(el, form) || el.name;
      var value = '';

      if (el.type === 'checkbox') {
        if (!el.checked) return;
        value = el.getAttribute('data-value') || el.value || 'Yes';
        /* Group multi-checkboxes (same name) onto one line */
        if (form.querySelectorAll('[name="' + cssEscape(el.name) + '"]').length > 1) {
          var groupLabel = el.getAttribute('data-group') || label;
          if (groups[el.name]) {
            groups[el.name].value += ', ' + value;
            return;
          }
          var entry = { label: groupLabel, value: value };
          groups[el.name] = entry;
          fields.push(entry);
          return;
        }
      } else if (el.type === 'radio') {
        if (!el.checked) return;
        value = el.value;
      } else if (el.tagName === 'SELECT') {
        /* Send the option's visible text, not its slug, so the email reads
           "Centerville" rather than "centerville". */
        if (!String(el.value).trim()) return;
        var option = el.options[el.selectedIndex];
        value = option ? (option.textContent || option.value).trim() : String(el.value).trim();
      } else {
        value = (el.value || '').trim();
        if (!value) return;
      }

      fields.push({ label: label, value: value });
    });

    return fields;
  };

  function labelFor(el, form) {
    if (el.id) {
      var lab = form.querySelector('label[for="' + cssEscape(el.id) + '"]');
      if (lab) return cleanLabel(lab);
    }
    var wrap = el.closest('label');
    return wrap ? cleanLabel(wrap) : '';
  }

  function cleanLabel(node) {
    return node.textContent.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  }

  /* Every id and name on these forms is a plain identifier, so the
     no-CSS.escape fallback can pass the value through untouched. */
  function cssEscape(value) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(value);
    return String(value).replace(/[^A-Za-z0-9_-]/g, '');
  }

  /* Honeypot + time-on-page check. Returns true if the submission
     looks automated. */
  PSGForms.looksAutomated = function (form, startedAt) {
    var trap = form.querySelector('[data-honeypot="true"]');
    if (trap && trap.value) return true;
    if (startedAt && (Date.now() - startedAt) / 1000 < MIN_FILL_SECONDS) return true;
    return false;
  };

  /* Submit a payload. Returns a Promise that resolves on a
     confirmed server-side success and rejects otherwise, so the
     UI never shows a false "message sent". */
  PSGForms.send = function (formType, subject, fields) {
    if (!PSGForms.isConfigured()) {
      return Promise.reject(new Error('Form endpoint is not configured.'));
    }

    var payload = {
      formType: formType,
      subject: subject,
      fields: fields,
      submittedFrom: window.location.href,
      userAgent: navigator.userAgent
    };

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? window.setTimeout(function () { controller.abort(); }, TIMEOUT_MS) : null;

    /* text/plain keeps this a CORS "simple request" so the browser
       does not send a preflight, which Apps Script cannot answer. */
    return window.fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      if (timer) window.clearTimeout(timer);
      return response.text().then(function (text) {
        var result;
        try {
          result = JSON.parse(text);
        } catch (err) {
          throw new Error('Unexpected response from the submission service.');
        }
        if (!response.ok || !result || result.ok !== true) {
          throw new Error((result && result.error) || 'The submission service rejected the request.');
        }
        return result;
      });
    }, function (err) {
      if (timer) window.clearTimeout(timer);
      throw new Error(err && err.name === 'AbortError'
        ? 'The submission timed out.'
        : 'Could not reach the submission service.');
    });
  };

  window.PSGForms = PSGForms;
})(window, document);
