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

   The endpoint below is the Apps Script web app deployment.
   To redeploy or change recipients, see apps-script/README.md.
   ============================================================ */
(function (window, document) {
  'use strict';

  /* ---- CONFIGURATION -------------------------------------- */
  /* Apps Script web app /exec URL. Must be the plain /macros/s/<id>/exec
     form deployed with access "Anyone" - the /a/macros/<domain>/ variant
     forces a Google sign-in that public visitors cannot pass. */
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbygvlez8XW24VaTEemHcx0iw3hl54h5cV4io5yDieG6fZMHN9lrY-J5AtLCaS8_b3Pk/exec';

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
          var entry = { key: el.name, label: groupLabel, value: value };
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

      /* key is the input's name. The backend uses it to pre-fill the
         Release of Information PDF without matching on display labels. */
      fields.push({ key: el.name, label: label, value: value });
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
