# PAU-225 F1 / PAU-241 — does the contact page transmit anything?

Two scripts. `contact-form-repro.mjs` proves the defect: `pages/contact.html` told a
client *"Your message has been received"* and sent nothing.
`contact-page-verify.mjs` proves the defect is gone and has not come back.

## Run

```sh
npm init -y && npm i playwright && npx playwright install chromium   # once
node contact-form-repro.mjs  /path/to/psgweb    # exit 0 = defect reproduced
node contact-page-verify.mjs /path/to/psgweb    # exit 0 = page is honest
```

## `contact-form-repro.mjs` — the defect

1. Serves the psgweb tree over a loopback HTTP server (so the page runs exactly as
   GitHub Pages serves it — relative paths, `js/main.js`, everything).
2. Opens `pages/contact.html` in headless Chromium and records **every** request the
   page issues, discarding the ones from initial asset load.
3. Fills the form as a first-time client asking for an appointment, ticks the PHI
   acknowledgment, and clicks **Send Message**.
4. Reports what the client is shown against what actually left the browser, and
   checks whether any request carried a field the client typed.

Observed on `main` @ `d4365ff`:

```
=== what the client is told =========================================
  Thank you for reaching out!Your message has been received. We will respond within
  1-2 business days. If you need immediate assistance, please call us at (641) 856-2688.
=== what left the browser ===========================================
  requests issued after clicking "Send Message": 0
  requests carrying any field the client typed:  0
=== verdict =========================================================
  page claims the message was received: true
  message actually transmitted:          false
  >>> CONFIRMED: the client is told the message was received; nothing was sent.
```

Two independent `submit` listeners were bound to `#contact-form` — `js/main.js:121`
and the inline copy at `pages/contact.html:689`. Both called `preventDefault()`, so
fixing one would have left the other cancelling the submit. That is why a fix has to
be run, not read.

## `contact-page-verify.mjs` — the fix

There is no server behind this site (GitHub Pages, static), so the form had nowhere
to submit to. PAU-241 removed it and put the real ways to reach the office on the
page instead. This script checks that the page now claims only what it can do:

- no file in the tree claims a message was received or promises a reply window,
- no `<form>` and no submit handler bound to `#contact-form` survives anywhere,
- `pages/contact.html` offers no message field or submit button,
- `pages/contact.html` says plainly that there is no online message form,
- the phone number, office email, and client portal are real, working links,
- `pages/resources.html` Step 1 no longer routes a new client to a form.

Observed after the PAU-241 fix:

```
=== PAU-241 verification =============================================
  PASS  no file claims a message was received or promises a reply window
  PASS  no <form> anywhere in the site that has nowhere to submit to
  PASS  no submit handler is still bound to #contact-form
  PASS  contact.html offers no message field or submit button
  PASS  contact.html states there is no online message form
  PASS  contact.html does not promise a response time
  PASS  the phone number is a real tel: link
  PASS  the office email is a real mailto: link
  PASS  the client portal is linked
  PASS  resources.html Step 1 does not send a new client to a form
=== verdict =========================================================
  >>> The contact page no longer claims to send anything. Fix verified.
```

`contact-form-repro.mjs` exits 1 against the fixed tree, reporting that there is no
form to drive. Run **both**: if a form is ever restored, the repro is what proves
whether it actually sends.

## If an online intake form is wanted later

The form's required PHI-acknowledgment checkbox was enforced only in JavaScript, and
the form tag carried `novalidate`, which switches off native validation of the
`required` attributes too. It was a real control only because nothing was ever sent.
Wiring any endpoint to a restored form therefore has to enforce the acknowledgment
**server-side**, or the control is gone.
