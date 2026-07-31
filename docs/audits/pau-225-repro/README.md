# PAU-225 repro — does the contact form transmit anything?

Proves finding **F1**: `pages/contact.html` tells a client *"Your message has been
received"* and sends nothing.

## Run

```sh
npm init -y && npm i playwright && npx playwright install chromium   # once
node contact-form-repro.mjs /path/to/psgweb
```

Exit `0` = defect reproduced. Exit `1` = not reproduced (i.e. the form now works).

## What it does

1. Serves the psgweb tree over a loopback HTTP server (so the page runs exactly as
   GitHub Pages serves it — relative paths, `js/main.js`, everything).
2. Opens `pages/contact.html` in headless Chromium and records **every** request the
   page issues, discarding the ones from initial asset load.
3. Fills the form as a first-time client asking for an appointment, ticks the PHI
   acknowledgment, and clicks **Send Message**.
4. Reports what the client is shown against what actually left the browser, and
   checks whether any request carried a field the client typed.

## Observed on `main` @ `d4365ff`

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

## Note on the two handlers

Two independent `submit` listeners are bound to `#contact-form` — `js/main.js:121`
and the inline copy at `pages/contact.html:689`. Both call `preventDefault()`. Fixing
one leaves the other cancelling the submit, so a fix must be verified with this
harness rather than by reading the diff.
