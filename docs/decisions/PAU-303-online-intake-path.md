# PAU-303 — Should paulagordy.com have a real online intake path?

**Status:** decision brief, awaiting a decision. Nothing here has been built.
**Author:** Colleen (Public Web), 2026-08-01.
**Parent:** PAU-241 — the contact form that claimed receipt and transmitted nothing (removed, PR #9).
**Evidence base:** `247managed/psgweb` @ `2486b46`; `247managed/paula-gordy-ehr` @ `8be1c12d`.

---

## §1 — The question, stated narrowly

PAU-241 removed the contact form rather than wiring it up, because `247managed/psgweb` is a
static GitHub Pages site with no server behind it and nowhere for a form to submit to. That
removal is honest but it leaves a real gap: **a person who is not yet a client, at 11pm, has no
way to ask for an appointment except to call during office hours.**

This document does not decide that. It establishes what the options actually are, what each one
costs, and which of the four requirements in the ticket each one can and cannot meet — so that
the person with the authority is choosing between real things rather than approving a direction.

The four requirements PAU-303 sets for anything that replaces the form:

1. **A transmission path.** Static Pages cannot do it alone.
2. **A PHI decision.** People type health details into intake forms regardless of what the page says.
3. **Server-side enforcement of the acknowledgment.** The removed PHI-acknowledgment checkbox was
   enforced *only* in JavaScript, and the `<form>` carried `novalidate`, which also switches off
   native validation of the `required` attributes. It was a real control **only because nothing
   was ever sent.** Wiring any endpoint to that same markup silently deletes the only control on
   the page.
4. **A failure mode that is visible.** The original defect was invisible from both ends — the
   client saw a success panel and waited; the office had no absence to notice.

---

## §2 — What I verified before writing the options

Everything in this section is read from the two repositories at the commits above. Where I could
not verify something from source, §6 says so explicitly.

### §2.1 — The client portal cannot be the answer as it stands

`portal.paulagordy.com` (`EHR.ClientPortal`) has **no self-registration.** Its entire anonymous
surface is four actions on `Controllers/PortalAccountController.cs` — `Login` (:57), `SendCode`
(:131), `Verify` (:151), and `Activate` (:182) — and `Activate` consumes a **staff-issued token**.
The anonymous Razor pages are `Login`, `LoginVerify`, `Activate`, `AccessDenied`, `Error`. There is
no "request an account" page and no route that creates one.

So the portal is by construction **existing-clients-only**: staff create the account, the client
activates it. Pointing a prospective client at the portal is pointing them at a login screen they
cannot get past. That is not a criticism of the portal — it is the correct design for a portal —
but it removes the cheapest-looking answer from the table.

It also **narrows the gap to exactly one population.** Existing clients already have
authenticated secure messaging inside the portal — `Components/Pages/Messages.razor`
(`[Authorize(Policy = "PatientPortal")]`), which even carries the *"your provider usually responds
within 1–2 business days"* promise that the dead contact form was making to the whole world. So
the thing that is genuinely missing is not "an online way to contact the practice". It is
narrower and should be costed as such: **an online way for someone who is not yet a client to ask
to become one.**

### §2.2 — There *is* already a server, and it already accepts anonymous POSTs from the internet

The EHR is internet-reachable at `https://ehr.paulagordy.com` (Cloudflare Tunnel → IIS on
`EHR-PROD-01`), and it already exposes an **anonymous, unauthenticated-at-the-edge POST endpoint
that accepts submissions from members of the public**:

```csharp
// EHR.Blazor/Controllers/HireApplyController.cs:52-56
[HttpPost("{token}/documents")]
[AllowAnonymous]
[IgnoreAntiforgeryToken] // XHR multipart from an anonymous page; the token is the auth.
[RequestSizeLimit(31_457_280)]
```

BHIS applicants upload their driver's licence, degree and transcript through it. It validates
size (25 MB), file count (15/applicant), document kind, and file content, and it re-validates the
link token on every request.

**The important qualifier:** that endpoint is *token-gated* — "the token IS the authorization".
A public intake endpoint has no token, because the person submitting it has never been given
one. So this is a precedent for the **shape** (anonymous controller, antiforgery exemption,
server-side validation, tight caps) but not for the **threat model**. An open endpoint needs its
own spam and abuse controls, and the tree has **none today**: `recaptcha`, `turnstile`,
`hcaptcha` and `honeypot` return zero matches across the whole repository.

What *does* exist and is reusable: ASP.NET rate limiting is already configured and turned on —
`AddRateLimiter` with a fixed-window `"api"` policy (`EHR.Blazor/Program.cs:549-589`,
`app.UseRateLimiter()` at :1541).

### §2.3 — Outbound email already works in production

`EHR.Core/Configuration/EmailSettings.cs` + `EHR.Infrastructure/Services/Billing/EmailService.cs`
(System.Net.Mail over configured SMTP) already send real client-facing mail — payment receipts,
statements, appointment reminders (`Services/Scheduling/AppointmentReminderLogic.cs`). Notifying
the office of a new request needs no new vendor.

### §2.4 — There is a cautionary precedent for "just point a mailbox at it"

`EHR.Infrastructure/Services/HelpDesk/TicketEmailIntakeJob.cs` IMAP-polls a mailbox and turns
each unseen message into a ticket. Its own header records what happened when it was first pointed
at a real mailbox:

> the first staging poll created 6 tickets, 5 of which were Google account-setup mail

It now carries an `AllowedSenderDomains` allowlist for exactly that reason — which is a control
that **cannot** be applied to intake, since the whole point is mail from strangers. Any
"appointment requests land in a mailbox/queue" design inherits this noise problem and needs a
different answer to it.

### §2.5 — Nothing in the EHR can hold the request

There is no `Referral`, `Waitlist`, `Inquiry`, `Lead`, `IntakeRequest` or `AppointmentRequest`
entity anywhere in `EHR.Core/Entities/`. The data model has no place for a person who is not yet
a client. **This is the largest hidden cost in the EHR option** and the reason it is a project
rather than a patch: a new entity, a migration, a staff-facing queue screen, and a production
deploy of the EHR.

---

## §3 — The options

### Option A — Do nothing. Phone, fax, email, portal-for-existing-clients.

This is the state PR #9 shipped, and it is honest: the page now says plainly that there is no
online message form.

- **Cost:** $0. No new vendor, no new PHI processor, no deploy.
- **Requirement 1–4:** not applicable; there is nothing to transmit.
- **What it actually costs:** the prospective clients who will not or cannot phone. That is a
  practice-operations judgement, not an engineering one, and I have no data on its size — nobody
  has ever measured it, because the form that was supposed to capture it never sent anything.
- **Honest note:** the pre-PAU-241 world was *already* this world. Every request that ever
  arrived, arrived by phone. Choosing A is choosing the status quo that has actually been in
  effect, not a regression from a working system.

### Option B — A third-party form backend (Formspree, Basin, Netlify Forms, etc.)

Static page posts to a vendor; the vendor emails the office and keeps a submission log.

- **Cost:** the HIPAA-eligible tiers that will sign a BAA run materially higher than the
  advertised hobby pricing, and the cheap tiers generally will not sign one at all. This needs a
  real quote, not my estimate — see §6.
- **Requirement 1 (transmission):** ✅ genuinely works.
- **Requirement 2 (PHI):** ❌ **adds a new PHI processor.** Health details typed into the form
  land in a third party's database. This is the whole of Theodore's decision, and it is the
  strongest argument against B.
- **Requirement 3 (server-side acknowledgment):** ❌ **cannot be met.** A generic form backend
  accepts whatever fields are posted; the acknowledgment becomes a *value in the payload*, not a
  *gate*. Anyone bypassing the JavaScript submits without it and the vendor accepts it. This
  reproduces exactly the defect PAU-303 warns about — the natural fix silently deleting the only
  control on the page.
- **Requirement 4 (visible failure):** ⚠️ partial. Real HTTP errors reach the client, which is
  better than the old form. But delivery to the office is by email, so a silent bounce or spam
  foldering is possible; the vendor's submission log is the compensating control and someone has
  to actually check it.

### Option C — An intake endpoint in the EHR

`POST https://ehr.paulagordy.com/api/intake/request`, anonymous and rate-limited, writing a new
`IntakeRequest` row and notifying the office through the existing mail path. The static page
keeps a form; the form posts off-site to the EHR.

- **Requirement 1 (transmission):** ✅ — the server exists, is public, and already accepts
  anonymous public POSTs (§2.2).
- **Requirement 2 (PHI):** ✅ **no new processor.** The data lands in the system that already
  holds every client's chart, under the controls that are already in place there.
- **Requirement 3 (server-side acknowledgment):** ✅ **the only option that can actually do
  this.** The endpoint validates the acknowledgment field server-side and returns `400` without
  it. Bypassing the JavaScript gets you a rejection, not an unacknowledged submission.
- **Requirement 4 (visible failure):** ✅ — a real HTTP status to the client (no success panel
  unless the server said so), plus a staff queue that can be looked at, which is a positive
  artefact rather than an absence nobody notices.
- **Cost — and this is the honest part:**
  - a new entity + EF migration + a staff screen to work the queue (§2.5);
  - spam/abuse control that does not exist anywhere in the tree today (§2.2) — rate limiting is
    reusable, bot defence is not;
  - either a CORS allowlist entry (there is **no** `AddCors`/`UseCors` anywhere in the EHR source
    today, so a `fetch()` from `paulagordy.com` would be blocked) **or** a plain navigating form
    POST, which is not subject to CORS but takes the client off `paulagordy.com` onto an EHR
    page — and needs `[IgnoreAntiforgeryToken]`, for which there is established precedent
    (`HireApplyController.cs:54`, `FaxController.cs:53`, and four others);
  - a **production EHR deploy**, which under the current rules is full-package publish from a
    clean `main` worktree with a `C:\inetpub\EHR` snapshot and mandatory staging-first
    validation, and requires Jason's explicit authorization for that specific action;
  - it is EHR work, so it belongs to Sterling's review area, not Malcolm's — a second team.
- **Scale:** this is a multi-ticket project, not an afternoon. Anyone estimating it as "add a
  controller" has not costed the entity, the queue screen, the bot defence, or the deploy.

### Option D — Publish a monitored intake mailbox and keep the site static

The page gives an address; mail is worked by a person or fed through a job like §2.4.

- **Requirement 1:** ✅ trivially. **Requirement 2:** ⚠️ typed health details travel in
  unencrypted email — the same objection this ticket raises against `mailto:`, minus the
  device-dependency defect. **Requirement 3:** ❌ there is no acknowledgment gate in email at all.
  **Requirement 4:** ⚠️ depends entirely on whether someone actually reads the mailbox, and §2.4
  is direct evidence of what an unfiltered public mailbox fills up with.
- Cheap, and strictly worse than C on every requirement except cost. Included because it is what
  gets proposed when C is priced.

### Explicitly ruled out — restore the form and point it at `mailto:`

PAU-303 rules this out and I agree: it is a silent no-op on any device without a configured mail
client — the *same* invisible failure as the original defect — and it puts typed health details
into unencrypted email.

---

## §4 — Recommendation

**If an online intake path is wanted at all, it should be Option C. If C is not worth its cost,
the answer is Option A — not B and not D.**

The reasoning is requirement 3. It is the requirement that distinguishes a real control from a
decorative one, and **C is the only option that can satisfy it**, because it is the only option
where we control the receiving code. B and D both accept the submission and let the
acknowledgment ride along as data. Choosing them would mean rebuilding the exact defect PAU-241
just removed, one layer further out — and this time with a live endpoint behind it, so the
consequence would be real rather than theoretical.

Between C and A, the deciding factor is not technical. It is whether the volume of people who
will not phone justifies a multi-ticket EHR project plus its ongoing spam surface. I do not have
that number and cannot get it from the code.

**A is a legitimate final answer.** It is what the practice has actually been doing all along.

---

## §5 — What I am asking for

A decision between A and C (and an explicit rejection of B and D, or an argument for them):

- **Franklin / Jason** — is an online intake path worth a multi-ticket EHR project? If no, PAU-303
  closes as "phone remains the intake path" and the site stays as PR #9 left it.
- **Theodore (Legal)** — if the answer is B rather than C, a new PHI processor is being taken on.
  §3 records that this is his call; no legal requirement is asserted here by me.
- **Sterling** — if C is chosen, the build is EHR work in his review area and should be scoped
  there, not on the Public Web board.

---

## §6 — What I did not verify

Stated plainly so nobody treats this brief as more than it is:

- **Vendor pricing for Option B.** I have not quoted anyone and deliberately did not invent
  numbers. If B is seriously considered it needs a real quote, and the first question to any
  vendor is whether they will sign a BAA at the tier being priced.
- **Whether production SMTP credentials are live.** `EmailSettings`/`EmailService` are wired for
  it in source and other features depend on it, but the credentials live in
  `C:\inetpub\EHR-config\appsettings.secrets.json`, outside the repository. I read code, not prod
  config.
- **Actual demand.** Nobody knows how many people bounced off the site rather than phoning. The
  form that was supposed to tell us never transmitted anything.
- **Cloudflare-level bot controls.** The site and the EHR are both behind Cloudflare; whether
  Turnstile or bot-fight is already available on that plan would change the spam cost of Option
  C, and I did not check the Cloudflare account.

---

## §7 — Verification harness for whatever gets built

`docs/audits/pau-225-repro/` on this branch:

- `contact-form-repro.mjs` — serves the tree, drives the contact page in headless Chromium as a
  first-time client, and records every outbound request. **This is what proves a form actually
  transmits.** Exit 0 against the old tree = defect reproduced.
- `contact-page-verify.mjs` — asserts the post-PAU-241 page state.

Both take the path to the tree under test as an argument. If Option C is built, `contact-form-repro`
is the acceptance test: it must show a request carrying the fields the client typed, and the
success panel must appear only after a real success response. A second test belongs with it —
post without the acknowledgment field and assert a `400`, which is requirement 3 in executable
form.
