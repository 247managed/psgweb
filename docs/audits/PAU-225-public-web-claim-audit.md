# PAU-225 — Public Web: every factual claim the website makes, checked against the code

**Author:** Colleen · **Date:** 2026-07-31 · **Parent:** PAU-146 (wave 3)

**Website tree audited:** `247managed/psgweb` **`main` @ `d4365ff`** — *the live site*.
GitHub Pages deploys from `main`, so this and only this is what a client sees today.

**Code tree audited:** `247managed/paula-gordy-ehr` **`main` @ `8be1c12d`**
(`fix(pdf): relationship check and PHI audit row on every /api/pdf/* route (PAU-203)`).

Every `file:line` in this document refers to one of those two commits. Where a claim
also exists on the unmerged branch `fix/portal-capability-copy` (4 commits, PAU-133),
that is stated explicitly — see §0.

**Nothing was changed.** No page, stylesheet or script was edited for this audit. The only
files written are this document and the repro harness at `docs/audits/pau-225-repro/`.

---

## §0 — A correction I have to make before anything else, including to my own earlier work

**The five client-portal capability claims of PAU-133 are still live.** I corrected them on
`fix/portal-capability-copy`, that branch is not merged, and GitHub Pages serves `main`.
On my first pass through this audit I read the working tree and recorded the *corrected*
wording as the site's wording. That was sampling from a document — my own branch — instead of
deriving from the tree that ships. Corrected on the second pass with `git show origin/main:`.

So `resources.html:280-286` today still tells clients they can **"manage your schedule"** and
**"Access billing statements"**, which are respectively wrong (§2 C12) and the subject of
PAU-144. Everything in the tables below is quoted from `main`.

This matters beyond bookkeeping: **the fix existing is not the fix shipping.** Any reader of
this audit who checks the branch will conclude these claims are handled. They are not.

---

## §0.1 — Correction, 2026-08-01: C51 / F6 (Group Therapy) was wrong

**I reversed C51.** This audit recorded that `NoteType.GroupNote = 50` was *"the only
occurrence of group-therapy support in the codebase"* and marked the website's Group Therapy
claim **F as software support**. That is false, and it was false at the audited commit
`8be1c12d` — not something that landed afterwards. Verified by re-reading `8be1c12d`
directly, not the working tree.

Group therapy is supported end to end. It is keyed on **CPT 90853**, not on the note-type enum:

- **Scheduling** — `AppointmentType` *"Group Therapy"* (`SeedData.cs:581-596`): code `GRP`,
  90 minutes, `DefaultCptCode = "90853"`, `ServiceType = "Group"`, and
  `AllowOverlap = true // Multiple clients in same group` — which is honoured, not decorative
  (`AppointmentConflictService.cs:54`). Several clients can be booked into one slot.
- **Documentation** — opening a note from that appointment auto-populates the billing code
  from the appointment type (`ProgressNote.razor:2793-2796`), and `90853` is selectable from
  the seeded `TherapyProcedures` lookup (`SeedData.cs:1051`, `ProgressNote.razor:270-276`).
- **A code path written specifically for the group case** — the overlap guard exempts 90853 so
  every group member's note may legitimately share one start/end time
  (`ClinicalNoteOverlapGuardService.cs:34-37,81`; `ProgressNote.razor:3110-3113,3335`). This is
  not an accident of a permissive check; it is a documented exemption with the reasoning in a
  comment.
- **Billing** — `TherapyProcedure` `90853` *"Group psychotherapy"*, $50.00, active
  (`SeedData.cs:1051`).

Family therapy is in the same state (`AppointmentType` *"Family Therapy"* / `FAM` /
`90847`, `SeedData.cs:597-615`; `90846`/`90847` in the fee schedule at `:1049-1050`), and
telehealth was already recorded as supported at the appointment level.

**What is actually absent** is a group *entity*: no roster, no shared session record, no way to
write one encounter against several charts. The route that works is one progress note per
attendee, all carrying 90853 — which §2 C51 hypothesised as a workaround and which is in fact
the implemented, defended design. The website never claims a roster.

**How I got it wrong:** I grepped for the *name* (`GroupNote`) and concluded from its zero
usages that the *capability* was absent. A name-shaped search cannot answer a
capability-shaped question. The three unused enum members are still dead — that part stands,
and is all that remains of F6 (§6.3).

Corrected verdicts: **C51 → T as software support** (the clinical half stays `?`); C51 leaves
the "outran the build" list in §9; F6 (**PAU-245**) drops from *medium* to *low* and becomes a
dead-enum cleanup in the EHR repo.

---

## §1 — Headline

### The website's contact form tells clients their message has been received. Nothing is sent. There is no server.

| | |
|---|---|
| **Claim** | *"Your message has been received. We will respond within 1-2 business days."* |
| **Where** | `pages/contact.html:733` (the string) · `pages/contact.html:349` (the same promise beside the button) |
| **Reality** | `pages/contact.html:731-732` — `// In production, this would submit to a server endpoint.` / `// For now, show a success message.` and `js/main.js:190-191` — `// In production, this would submit to a secure server endpoint` / `// For now, show success message` |
| **Verdict** | **verified false** — proven, not read (§8, harness) |

The form is `<form id="contact-form" action="#" method="post">` (`pages/contact.html:271`).
Two separate submit handlers are bound to it — `js/main.js:121-122` and the inline copy at
`pages/contact.html:689-690` — and **both** call `e.preventDefault()` and neither transmits.

I built the harness rather than reading it. `docs/audits/pau-225-repro/contact-form-repro.mjs`
serves the site tree, drives `contact.html` in headless Chromium as a first-time client asking
for an appointment, and records every request the page issues after the click:

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

**The denominator that makes this a system fact and not a page bug.** Across all 23 HTML
pages plus `js/main.js` there is **exactly one `<form>`** and **zero** occurrences of
`fetch(`, `XMLHttpRequest`, `sendBeacon`, `new WebSocket`, `.submit()`, `axios`, `$.post`,
`$.ajax` or `FormData`. There is no transmission path in the site at all. Nothing a visitor
types anywhere on paulagordy.com can reach the practice except through a `mailto:` or `tel:`
link they choose to follow.

**Why it survived.** It is the only defect in this audit that is *invisible from both ends*.
The client sees a success panel. The office sees no email — and an office that has never
received a contact-form email has nothing to notice the absence of. The failure produces no
error, no log, no bounce, and no complaint from the person harmed, because that person
believes they have been heard and is waiting.

**Who this misleads.** `pages/resources.html:152` — Step 1 of "What to Expect" for a new
client — is *"Call us at (641) 856-2688 or fill out our online contact form to request an
appointment."* `index.html:213` and `:578` are **"Schedule an Appointment"** buttons pointing
at this form. `pages/blog-medicaid-therapy-coverage.html:167` tells a reader to *"use the
scheduling options on our contact page."* The site routes first-time help-seeking into a
form that discards it and thanks them.

**Category.** This is **not** marketing copy that outran the build. The success message is
in the same file, four lines below a comment by the person who wrote it saying it does not
send. It was **known false when written**, twice, by two authors, in two files.

`pages/terms.html:206` is the one place on the site that tells the truth — *"submitting a
contact form does not guarantee a response within any specific time frame."* It is in section
4 of the Terms of Use.

---

## §2 — Disproved claims table

Verdict key: **F** verified false · **T** verified true · **U** unsupported-as-stated (the
code neither implements nor disproves it; see §8) · **?** could-not-check.

Claims are numbered C1…C58. The full enumeration and its denominator is §3.

### A. The website's own mechanics

| # | Claim | Where (site @ `d4365ff`) | Reality (code) | V |
|---|---|---|---|---|
| C1 | "Your message has been received. We will respond within 1-2 business days." | `contact.html:733` | `contact.html:731`, `js/main.js:190` — no submit path; site-wide zero transmission APIs | **F** |
| C2 | "We typically respond within 1-2 business days." (beside Send Message) | `contact.html:349` | as C1 | **F** |
| C3 | "fill out our online contact form to request an appointment" | `resources.html:152` | as C1 | **F** |
| C4 | "use the scheduling options on our contact page" | `blog-medicaid-therapy-coverage.html:167` | `contact.html` has no scheduling control; one dead form and a phone number | **F** |
| C5 | "Schedule an Appointment" (primary hero CTA, twice) | `index.html:213`, `:578` | both link to `pages/contact.html`, whose only appointment mechanism is the dead form (C1) and a phone number | **F** |
| C6 | "This website uses only essential cookies necessary for basic functionality." | `js/main.js:596` | the site sets **no cookies**. `document.cookie` appears nowhere; the banner's own state is `localStorage.setItem('psg-cookie-notice', …)` at `js/main.js:608` | **F** (trivially — it uses fewer) |
| C7 | "Analytics cookies that help us understand how visitors interact with our website" | `privacy.html:601` | no analytics of any kind: zero hits for `gtag`, `googletagmanager`, `analytics` across all 23 pages and `js/main.js` | **F** (hedged by "may include") |
| C8 | "Our website uses SSL/TLS encryption (HTTPS)" | `privacy.html:584` | no `http://` asset or link anywhere in the tree; enforcement is a GitHub Pages setting I cannot read | **?** |
| C9 | "Our online forms can be filled out in your browser and then printed or emailed to our office." | `resources.html:378` | true — `forms.html:1900` `printForm`, `:1929` `emailForm` (a `mailto:`) | **T** |
| C10 | "You can also complete forms through our client portal" (of the downloadable forms) | `resources.html:378`, `resources.html:321` | false: the portal has no upload surface for these; its forms are provider-assigned packets only (`EHR.ClientPortal/Components/Pages/Forms.razor:34,40,49`). **Corrected on the unmerged branch** | **F** |

### B. Client portal capabilities

Portal surface enumerated from the tree, not from PAU-153: `grep -rn '^@page' EHR.ClientPortal --include=*.razor` → **18** routable pages; `EHR.Infrastructure/Services/Portal/*.cs` → **11** services. Both match Raymond's counts exactly.

| # | Claim | Where | Reality (code) | V |
|---|---|---|---|---|
| C11 | "Complete intake paperwork online **before your first appointment**" | `resources.html:282` | Packets are provider-assigned and require an activated account: `Forms.razor:5,34`, `ClientIntakePacketService`. A client with no invitation cannot do this "before" anything. **Corrected on the unmerged branch** | **F** |
| C12 | "View upcoming appointments **and manage your schedule**" | `resources.html:283` | `Appointments.razor` is a read-only table — no cancel, reschedule, request or booking control exists in the file. **Corrected on the unmerged branch** | **F** |
| C13 | "**Access billing statements** and view your account history" | `resources.html:285` | account history yes (`PortalBillingService.GetLedgerAsync`); downloadable statement **no** — `IStatementService`/`StatementService` are staff-side only and no portal route exposes them. This is **PAU-144**, already open. **Corrected on the unmerged branch** | **F** |
| C14 | "Send secure messages to your provider between sessions" | `resources.html:284` | true — `PortalMessagingService.cs:64-84` resolves therapist / BHIS provider / front office; `Messages.razor`, `Conversation.razor` | **T** |
| C15 | "Sign consent forms electronically" | `resources.html:286` | true — `ReleaseSign.razor` (`/forms/release/{Id:guid}`), `ClientReleaseService` | **T** |
| C16 | "24/7 access … from any device" | `resources.html:280` | no maintenance-window or availability logic in `EHR.ClientPortal`; uptime is an infrastructure fact | **?** |
| C17 | "manage important aspects of your care" | `resources.html:280` | the only client-initiated writes in the portal are: sign a release, complete a packet, answer a screener, send a message, pay a card balance. Nothing else is "managed". **Reworded on the unmerged branch** | **U** |
| C18 | "Existing clients can securely message their provider, view appointments, and access documents" | `contact.html:418` | true on all three — `PortalMessagingService`, `Appointments.razor`, `PortalDocumentService`/`Documents.razor` | **T** |
| C19 | "…communicate with our practice, access records, and **manage appointments**" | `privacy.html:592` | as C12. **Corrected on the unmerged branch** | **F** |
| C20 | "…communicate with their provider, access documents, and **manage appointments**" | `terms.html:211` | as C12. **Corrected on the unmerged branch** | **F** |
| C21 | "Access to the client portal is limited to established clients who have been provided login credentials by our office." | `terms.html:214` | true — activation is invitation-only (`Activate.razor` `/activate/{Token}`, `PortalAccountService`) | **T** |
| C22 | "The client portal is a separate system from this Website" | `terms.html:213` | true — separate ASP.NET application, separate host | **T** |
| C23 | Portal features "are provided and managed by **external vendors**" | `accessibility.html:199` | **false.** The client portal is `EHR.ClientPortal`, built and maintained in this organisation's own repository — 18 pages, 6 `.cs` files, 11 services. There is no vendor. | **F** |
| C24 | "pay a balance online by card" *(branch only — not live)* | `fix/portal-capability-copy` `resources.html:285` | true — `Billing.razor:31,78-80`, `IPortalBillingService.PreparePaymentAsync`/`FinalizePaymentAsync`, Stripe two-step via `IPaymentIntakeService` | **T** |

### C. Security, privacy and HIPAA assurances → **also sent to Sylvia**

| # | Claim | Where | Reality (code) | V |
|---|---|---|---|---|
| C25 | "The client portal uses HIPAA-compliant encryption to safeguard your personal health information. **All data is transmitted and stored securely**" | `resources.html:307` | *Transmitted*: TLS, fine. *Stored*: application-level encryption at rest covers **exactly** `Client` SSN + one sibling field (`ClientConfiguration.cs:38-39,162-163`), HelpDesk ticket subject/description (`HelpDeskConfiguration.cs:22-27`), `SystemSetting` values, and 2FA secrets (`TwoFactorService.cs:67,75`). Progress notes, assessments, portal messages and uploaded documents are **not** encrypted by the application. Database-level TDE is an infrastructure fact I must not check (§8). | **U** — see §2.1 |
| C26 | "Our client portal is a HIPAA-compliant, **encrypted** platform … uses industry-standard encryption and **authentication measures**" | `privacy.html:592` | *Authentication*: verified true and genuinely strong — 2FA by email, SMS or authenticator (`LoginVerify.razor:22-46`), invitation-only activation, `SessionValidationMiddleware`. *Encryption*: as C25. | **T** (auth) / **U** (encryption) |
| C27 | "We conduct telehealth sessions using HIPAA-compliant video conferencing platforms that provide **end-to-end encryption** … We maintain **Business Associate Agreements (BAAs) with all telehealth platform vendors**" | `privacy.html:623` | the code models telehealth as `Appointment.IsTelehealth` (bool) and `Appointment.TelehealthLink` (`Appointment.cs:52-53`) — a nullable free-text URL typed by a scheduler (`NewAppointmentDialog.razor:80-81`). No vendor is named anywhere in the codebase and nothing constrains that URL to any platform. Whether BAAs exist is a contract fact, not a code fact. | **?** — see §2.1 |
| C28 | "All video sessions are encrypted and meet federal standards" (in the Telehealth Consent the client signs) | `forms.html:1607` | as C27, and this one is *signed by the client* | **?** — see §2.1 |
| C29 | "We do not collect protected health information through our website contact form" | `privacy.html:595` | true, and true for a reason the sentence does not intend: the form collects nothing at all (C1). `js/main.js:277` `scanForPHI` warns on likely PHI but the dialog is dismissible and proceeds either way (`js/main.js:175-186`) | **T** |
| C30 | "This contact form is NOT a secure method of communication." | `contact.html:267` | true | **T** |
| C31 | "Standard email … is not a secure method of communication. Please **do not send** protected health information … via regular email." | `privacy.html:607` | **contradicted by the site's own Email buttons.** `forms.html` offers "Email this form" on the New Client Intake Form, which collects SSN (`forms.html:754`), diagnoses and checkboxes including *Suicidal Thoughts* (`:1039`) and *Self-Harm* (`:1040`), and sends it by `mailto:` (`forms.html:1969-1974`). The button warns first (`:1934-1943`) — but the site simultaneously instructs clients never to do this and provides the button that does it. | **F** (as a description of the site's behaviour) — see §2.1 |
| C32 | "Our records are stored on HIPAA-compliant platforms with appropriate administrative, physical, and technical safeguards." | `privacy.html:266` | infrastructure and policy, not code | **?** |
| C33 | "You have the right to request a list (accounting) of certain disclosures" | `privacy.html:459-468` | supported — `IPhiDisclosureLogService`, `PhiDisclosureLogEntry`, `PhiDisclosureLogReportPdfDocument` | **T** |
| C34 | "You have the right to be notified if there is a breach … no later than 60 days" | `privacy.html:493-502` | statutory duty; no automated breach-detection or notification path exists in the code. Not disproved — a manual process satisfies it. | **?** |
| C35 | "We will apply the 'minimum necessary' standard" | `privacy.html:544` | out of my area — the six audited areas found **one** service-layer ownership check total (`MileageService.GetOwnedAsync:307-314`). Named here only so it is not mistaken for checked. | **?** |
| C36 | "HIPAA Compliant Practice" (footer, every page) | 23 of 23 pages | a compliance posture, not a code fact | **?** |

### D. Insurance, billing and the No Surprises Act

| # | Claim | Where | Reality (code) | V |
|---|---|---|---|---|
| C37 | "**Good Faith Estimates available** per the No Surprises Act" | `index.html:558` | **The strings `good faith`, `goodfaith`, `GFE`, `no surprises` and `NoSurprises` do not occur anywhere in the EHR codebase** — zero hits, case-insensitive, across every `.cs`, `.razor` and `.md` file excluding `obj/`. There is no entity, service, template, PDF document or page that produces a Good Faith Estimate. | **U** — see below | 
| C38 | "you have the right to receive a Good Faith Estimate … **we will provide it automatically when you schedule an appointment**" | `no-surprises-act.html:342` | as C37. This is the strongest form of the claim on the site: automatic, unprompted, at scheduling. | **U** |
| C39 | GFE will contain "Provider information: the name of the practice, the **National Provider Identifier (NPI)**, and the **Tax Identification Number (TIN)**" | `no-surprises-act.html:269` | as C37 | **U** |
| C40 | GFE "covers a 12-month period" for recurring therapy; "updated estimate" when the plan changes; "new GFE for extended treatment" | `no-surprises-act.html:301,306,311` | as C37 | **U** |
| C41 | "This estimate is provided in advance of your scheduled services" — **in the Financial Agreement the client signs** | `forms.html:1328` | as C37 | **U** |
| C42 | **"National Provider Identifier (NPI): `[NPI Number]`"** and **"Tax Identification Number (TIN): `[Tax ID]`"** | `no-surprises-act.html:422`, `:426` | **verified false as published.** These are unreplaced template placeholders, under the heading *"The following information identifies our practice as required under the No Surprises Act"* (`:411`). The required identifiers are literally absent from the page that exists to publish them. | **F** |
| C43 | "We verify your insurance benefits before your first visit" | `index.html:550`, `insurance.html:251`, `resources.html:157`, `therapy-*.html:149,167` (×3), `blog-medicaid-therapy-coverage.html:168`, `blog-bhis-parent-guide.html:198,206`, `blog-understanding-anxiety.html:153`, `about.html:445` | supported — `IEligibilityService`/`EligibilityService.cs`, real 270/271 over `AvailityService.cs` (`HttpClient.PostAsync` at `:63,126,450`), `EligibilityCache`, staff page `EligibilityVerification.razor` | **T** |
| C44 | "we can provide you with a superbill" for out-of-network reimbursement | `insurance.html:455` | supported — `SuperBillDocument.cs`, `SuperBillDialog.razor`, `PdfGenerationService` | **T** |
| C45 | "we will send you a statement" if a balance remains | `insurance.html:424` | supported staff-side — `IStatementService`/`StatementService.cs`, `Accounting/Statements.razor`. (Deborah's PAU-180 found a statement that prints two different balances; that is her finding, not a re-file.) | **T** |
| C46 | "We handle the authorization process for you" (prior auth) | `insurance.html:286` | out of my area (Marjorie, PAU-152); authorization entities exist | **?** |
| C47 | "We accept the following forms of payment: Cash, Personal checks, Credit cards (Visa, MasterCard, Discover), Debit cards" | `insurance.html:389-392`, `forms.html:1304` | card supported (`IPaymentIntakeService`, Stripe); cash/check are front-desk facts | **T** (card) / **?** |
| C48 | "Sliding scale fee schedule may be available" | `insurance.html:303` | supported — `ISlidingScaleService`, `ClientSlidingScaleAssignment`, `SlidingScaleAssignment.razor` | **T** |
| C49 | Ten named insurance panels incl. Medicare, Iowa Medicaid, three MCOs | `insurance.html:147-187`, `:213-215` | payer configuration is production data (PAU-166), not code | **?** |
| C50 | "Balances unpaid for more than 90 days may be referred to a collections agency" | `forms.html:1319` | supported — `CollectionsWorkqueue.razor` | **T** |

**On C37–C41 and why the verdict is U, not F.** A Good Faith Estimate is a document a practice
must furnish; nothing requires the EHR to generate it, and a hand-typed letter satisfies the
statute. So I cannot write "false" and I will not. What I can write, with a stated denominator,
is that **the software this practice runs on has no concept of a Good Faith Estimate at all** —
not a field, not a template, not a task, not a reminder — while the site makes the promise on
four pages including one the client signs, and `no-surprises-act.html:342` promises it
*automatically at scheduling*, which is precisely the kind of promise that only survives if
something in the workflow produces it. Whether a person does this by hand is a
production/operations question. It is the single largest could-not-check in this audit and it
is filed as one.

### E. Clinical services

| # | Claim | Where | Reality (code) | V |
|---|---|---|---|---|
| C51 | **Group Therapy** — a headline service (`index.html:267`), a full section naming four group types (`services.html:249-316`), in the nav on 23 of 23 pages, and in `schema.org` `availableService` (`index.html:59-62`) | `index.html`, `services.html`, `therapy-*.html:140` | **Corrected 2026-08-01 — §0.1.** Supported end to end, keyed on **CPT 90853** rather than on the note-type enum: `AppointmentType` "Group Therapy" (`SeedData.cs:581-596`, `DefaultCptCode = "90853"`, `AllowOverlap = true`, honoured at `AppointmentConflictService.cs:54`); billing code auto-populated onto the note (`ProgressNote.razor:2793-2796`) and 90853 selectable from the seeded `TherapyProcedures` (`SeedData.cs:1051`); and a purpose-built overlap-guard exemption so every group member's note may share one session time (`ClinicalNoteOverlapGuardService.cs:34-37,81`, `ProgressNote.razor:3110-3113,3335`). Family therapy likewise (`FAM`/`90847`, `SeedData.cs:597-615`). Absent: a group *entity* — no roster, no shared session, no write-once-to-many-charts. `NoteType.GroupNote = 50` is unused (`NoteType.cs:42`), as are `FamilyNote = 51` and `TelehealthNote = 60` (`:45,48`) — but those name a note *format*, not the capability (§6.3). ~~`GroupNote` is the only occurrence of group-therapy support in the codebase~~ — withdrawn. | **T** as software support / **?** clinically — §0.1 |
| C52 | "Telehealth sessions … through a secure, HIPAA-compliant video platform" | `contact.html:534`, `services.html:443`, `accessibility.html:219` | as C27 | **?** |
| C53 | "BHIS services … skills training, individual and family support" for Iowa Medicaid members | `insurance.html:225`, `services.html:341-343` | supported — a full BHIS subsystem (`EHR.Infrastructure/Services/BHIS/`, `EHR.Blazor/Components/Pages/BHIS/`, `BHISHomeVisit/SchoolVisit/CommunityVisit/Crisis` note types) | **T** |
| C54 | "Our initial appointment is typically 60 minutes"; "follow-up sessions 45–60 minutes" | `resources.html:167,539,550`, `services.html:165` | scheduling durations are configuration/production data | **?** |
| C55 | "We do not prescribe medication" (LISW practice) | `resources.html:853` | consistent with the code — no prescribing, e-prescribing or medication-order surface exists | **T** |

### F. Practice facts

| # | Claim | Where | Reality | V |
|---|---|---|---|---|
| C56 | "Serving Southern Iowa **Since 2010**" vs "**20+** Years of Experience" vs `aria-label="**Nearly 20** years of experience"` | `index.html:209`, `:387` | three mutually inconsistent tenure figures, two of them inside the same element. 2026 − 2010 = **16**. A screen-reader user is told "nearly 20"; a sighted user is shown "20+"; the hero badge implies 16. | **F** (internally inconsistent) |
| C57 | "1,000+ Clients Served" | `index.html:391` | a production database read — PAU-166 | **?** |
| C58 | Team roster: `CLAUDE.md:45,49,50,52,56,57` names Sydney Thomas, Morgan Boney, Chelsea Chandler, Hannah Haggard, Angelia Scott and Mekaayla Chamberlain as current staff | `CLAUDE.md` vs `pages/about.html` | **false.** All six were removed from `about.html` in `f08c39b` — *"Remove six team members from About page … at the practice's request"* — and `CLAUDE.md` was not touched in that commit. Verified by grepping each of the 17 documented names against `about.html`: 11 present, 6 absent. | **F** |

Hours (`contact.html:382-407`), addresses, phone and fax are consistent across all 23 pages
and the three `schema.org` blocks; I checked them and found no drift. The `© 2024 / 2025 / 2026`
footers disagree across pages (`insurance.html:565` = 2024, `index.html:665` = 2025,
`contact.html:631` = 2026) — cosmetic, listed for completeness, not filed.

### G. Accessibility statement — checked against the markup

`accessibility.html` makes 12 testable claims. **Eleven hold.**

| Claim | Where | Check | V |
|---|---|---|---|
| Skip-to-content link "at the top of every page" | `:158` | present on **23 of 23** | **T** |
| "All meaningful images include descriptive alternative text" | `:165` | **24 of 24** `<img>` have a non-empty `alt` | **T** |
| Print stylesheets | `:178` | `css/styles.css:1883` `@media print` | **T** |
| Reduced-motion support | `:177` | `css/styles.css:1960` + `js/main.js:394` (JS animations bail out too) | **T** |
| Focus indicators | `:168` | 6 focus rules in `css/styles.css` | **T** |
| ARIA landmarks / semantic HTML / keyboard nav | `:155-157` | consistent with the markup | **T** |
| Form labels and accessible error handling | `:175` | `js/main.js:226` `showFieldError`, `:317` `announceToScreenReader` | **T** |
| "Map embeds … may have limited accessibility" | `:198` | 3 Google Maps iframes at `contact.html:155,186,217`, each with a `title` | **T** |
| Portal is third-party | `:199` | **false** — see C23 | **F** |
| WCAG 2.1 AA conformance overall | `:145` | not established by any of the above | **?** |

The one false claim in the section is the one about the software.

---

## §2.1 — Escalated to Sylvia in the same heartbeat

Four items are regulatory/privacy assurances rather than marketing inaccuracies, and go to
Sylvia as well as here: **C25** (portal "stored securely" vs. what is actually encrypted at
rest), **C27/C28** (telehealth end-to-end encryption and BAAs, one of them in a consent the
client signs), **C31** (the site forbids emailing PHI and ships the button that emails PHI,
including SSN and a *Suicidal Thoughts* checkbox), and **C42** (NPI/TIN placeholders on the
statutory notice). Filed as a single issue rather than four, assigned to Sylvia, cross-linked
from PAU-225.

On C25 specifically, the brief asked me to check any encryption claim against the
`AssessmentDocument.IsEncrypted` class of finding rather than against the field's existence.
I re-derived it with a different instrument and it holds exactly:
`AssessmentDocument.cs:29` `public bool IsEncrypted { get; set; } = true;` with the comment
*"Encryption status (for HIPAA compliance)"* at `:28`; the sole writer is
`AssessmentService.cs:1479` `IsEncrypted = false, // TODO: Implement encryption if required`;
readers: **zero** (a whole-tree grep for `IsEncrypted` returns four hits — the declaration, that
writer, and two unrelated locals in `tools/EncryptExistingSsns/Program.cs`). A field whose
name and comment assert the exact protection the website promises, which is written false and
read by nobody.

---

## §3 — The denominator

**Never taken from a document.** Derived from the tree with `find . -name "*.html"` and
`git show origin/main:` for every quotation.

| Surface | Denominator | Covered |
|---|---|---|
| HTML pages in `psgweb` | **23** | 23 — every one read in full as extracted visible text |
| — of those, blog articles | 8 | 8 |
| — location landing pages | 3 | 3 |
| — legal/notice pages | 4 (`privacy`, `terms`, `accessibility`, `no-surprises-act`) | 4 |
| — core pages | 8 (`index`, `about`, `services`, `contact`, `insurance`, `resources`, `forms`, `blog`) | 8 |
| `<form>` elements site-wide | **1** | 1 |
| Network-capable API calls site-wide | **0** | 0 |
| `<img>` elements | **24** | 24 |
| Non-HTML shipped files | 4 (`css/styles.css`, `js/main.js`, `robots.txt`, `sitemap.xml`) | 4 |
| `EHR.ClientPortal` routable pages | **18** | 18 |
| `EHR.Infrastructure/Services/Portal/*.cs` | **11** | 11 |
| **Factual claims enumerated and adjudicated** | **58** | 58 |

Verdicts: **17 verified false**, **19 verified true**, **7 unsupported-as-stated**,
**15 could-not-check**. The counts sum to 58; C26 and C51 carry a split verdict and are
counted once, under their more serious half.

**What I did not enumerate, and say so:** the 32 client-portal links (excluded by the brief);
CSS rules; `sitemap.xml` completeness; and the clinical accuracy of the eight blog articles'
mental-health content, which is education, not a claim about this practice or this software.
I read all eight and none of them makes a capability claim beyond C4 and the shared
"accepting new patients / we verify your benefits" footer block, which is C43.

---

## §4 — Every control in my area, and whether it fires

The website has five controls. They are the mechanisms that are supposed to stop a client
sending PHI somewhere unsafe, or relying on something untrue.

| Control | Where | Structural or instruction? | Fires? |
|---|---|---|---|
| **PHI acknowledgment checkbox**, required before contact-form submit | `contact.html:341`, enforced `js/main.js:164-168` | **structural within the page** — the handler will not proceed unchecked, and there is no non-JS path because the form has no action | fires |
| **PHI content scanner** on the contact message | `js/main.js:277-316`, invoked `:171-187` | **instruction** — it raises `confirm()`, and choosing "no" submits anyway (`:182-185`) | fires, advisory only |
| **HIPAA warning before emailing a form** | `forms.html:1934-1943` | **instruction** — a dismissible `confirm()` | fires, advisory only |
| **Contact-form privacy notice** | `contact.html:267`, `privacy.html:588`, `terms.html:199` | **instruction** | n/a |
| **Session-inactivity warning on form pages** | `js/main.js:522-548` | **instruction** — announces to screen readers after 15 minutes; clears nothing | fires |

**No third structural control.** The coordinator has two across six areas
(`AccountingAuditInterceptor`, `AccountingLayout.razor:13`) and asked to be corrected if a
third exists. The PHI acknowledgment checkbox is the closest thing in my area and it is
**not** a third: it is structural only by accident of the form being inert. The moment a
submit endpoint is added, a caller who bypasses the JS — a curl, a disabled-JS browser, a
form-filling extension — reaches it with no acknowledgment, because `novalidate`
(`contact.html:271`) turns off native constraint validation and the `required` attribute with
it. **The control that looks structural today becomes an instruction on the day the form
starts working.** That is worth saying out loud to whoever fixes §1, because the natural fix —
wire up an endpoint — silently deletes the only control on the page.

The reverse of the coordinator's "one position away" observation applies here, and I think it
is the more useful shape for my area: **the correct implementation is not one position away.
There is no position.** No endpoint, no handler, no serverless function, no form service, no
`mailto:` fallback on the contact form. This is a static site on GitHub Pages; a working
contact form requires a component that does not exist in the repository at all.

---

## §5 — Caller-supplied identifiers reaching data

**Zero, as predicted.** The site is static HTML on GitHub Pages. It has no server, no session,
no database, no identifier and no data. Nothing a visitor supplies reaches storage of any kind
— which is exactly the §1 finding stated in the coordinator's vocabulary.

One thing worth recording because it is not obvious: `js/main.js:608` and `:582` use
`localStorage` (`psg-cookie-notice`), and `forms.html`'s intake form holds an SSN
(`forms.html:754`), diagnoses and a *Suicidal Thoughts* checkbox (`:1039`) in DOM state on a
page that has a 15-minute inactivity *warning* (`js/main.js:522-548`) but **no clear**. On a
shared or public computer that data stays in the form until the tab closes. The mechanism that
looks like it protects it — the inactivity timer — only announces.

---

## §6 — Dead, duplicated and half-wired surfaces

1. **The contact form.** The complete instance: a validated, accessible, PHI-scanned,
   acknowledgment-gated form whose only missing part is the one that sends it — and which
   reports success. §1.
2. **Duplicated submit handlers.** `contact.html:689` and `js/main.js:121` both bind `submit`
   on `#contact-form` and both `preventDefault()`. Two independent implementations of the same
   validation with different error text ("This field is required" vs "First name is
   required."). Whichever is fixed first, the other still fires and still cancels.
3. **`NoteType.GroupNote`, `FamilyNote`, `TelehealthNote`** — three enum members, zero usages
   each (`NoteType.cs:42,45,48`). **Corrected 2026-08-01 (§0.1):** this item originally read
   their deadness as evidence that group therapy was unsupported. It is not — all three name
   capabilities the software *does* have by another route (group and family therapy keyed on
   CPT 90853/90846/90847, telehealth on `Appointment.IsTelehealth`). What remains is a real but
   smaller defect, and it is a trap rather than mere clutter: the group behaviour is keyed on
   the **procedure code**, so anyone who later wires `NoteType.GroupNote` as the way to mark a
   group note creates a second, unkeyed path — such a note would *not* receive the 90853
   overlap exemption (`ClinicalNoteOverlapGuardService.cs:82`) and would be reported as a
   provider time conflict against the rest of its own group. Delete the three members or key
   the behaviour off them; do not leave both.
   Also dead alongside them: `ProgressNoteService.GetProcedureCodes()` (`:610-624`), a
   hard-coded nine-code list with zero callers that duplicates — and now drifts from — the
   `TherapyProcedures` table the UI actually reads (`SeedData.cs:1044-1057`, ten codes).
4. **`AssessmentDocument.IsEncrypted`** — one writer writing `false`, zero readers, a comment
   asserting HIPAA compliance. §2.1. Confirmed independently of wave 2.
5. **The cookie banner.** Announces a cookie policy for cookies that do not exist, and stores
   its own dismissal in `localStorage` (`js/main.js:608`) — the one storage mechanism it does not mention (C6).
6. **`accessibility.html:199`'s vendor escalation path** — *"we will work with the vendor to
   address the issue"* for a portal built in-house. A client who reports a portal accessibility
   barrier is promised an escalation to a party that does not exist (C23).
7. **`no-surprises-act.html`** — 629 lines describing a Good Faith Estimate process in
   procedural detail (timing windows, 12-month recurring coverage, dispute thresholds) with no
   producing mechanism anywhere in the software, and its own identifying fields left as
   placeholders (C37–C42).

---

## §7 — What I would not dare change

**`pages/forms.html`.** It is 2,106 lines and it is the only part of this website that
actually transports client information anywhere. Seven legal forms — intake, consent for
treatment, financial agreement, release of information, telehealth consent — each with
signature fields the client fills in, each serialised by hand into a `mailto:` body by
`buildEmailBody`, each with its own truncation behaviour at 1,800 characters
(`forms.html:1958-1966`). The intake form alone will exceed that and silently drop its tail
before the alert fires. Every one of those forms is a document a client signs, and the
serialiser is bespoke per form. Changing it means changing what a signed consent says.

**`js/main.js:277-316`, `scanForPHI`.** It is advisory, it is the only PHI control that reads
content rather than asking the user to attest, and its false-positive behaviour is the thing
that makes clients click through. Tightening it makes it noisier and less heeded; loosening it
removes the only substantive check. I would want to know what it actually catches in practice
before touching either bound, and that is production data.

**`no-surprises-act.html` and `privacy.html` as legal text.** The defects I found in them are
factual (C42, C31, C25) and I have cited them precisely, but the surrounding statutory
language should be edited by whoever is accountable for the practice's HIPAA posture, not by
whoever is fixing the website. Note that the corrections are *removals and fills*, not
rewrites: replace two placeholders, and reconcile one instruction with one button.

---

## §8 — Verified / inferred / could-not-check

**Verified** (I read the code and, where behavioural, ran it): §1 in full, by harness. C6, C7,
C9, C10–C15, C18–C23, C29–C31, C33, C42–C45, C48, C50, C51 (software support — **re-checked
and reversed 2026-08-01, §0.1**; it is supported, and the original entry here was wrong), C53, C55, C56,
C58, and all twelve accessibility checks in §2 G. The portal denominators (18 pages, 11
services) were re-derived from the tree and match PAU-153 exactly.

**Inferred** (the code says this, but reachability or data state is not established): C16, C17,
C25's negative half (the *absence* of application-level encryption on clinical content is
established; whether that leaves PHI unencrypted on disk depends on the database
configuration), C37–C41 (the absence of any GFE mechanism is verified; whether the practice
produces GFEs by hand is not).

**Could-not-check** — and these are the useful ones:

| # | Question | What would settle it | Where it belongs |
|---|---|---|---|
| 1 | Does the SQL Server have TDE enabled? | one read of `sys.databases.is_encrypted` | **PAU-166** — `SELECT name, is_encrypted FROM sys.databases;` Decides C25. |
| 2 | Have any Good Faith Estimates ever been produced? | a production/operations answer from the practice, not SQL | Sylvia / practice — decides C37–C41 |
| 3 | Which telehealth platform is used, and is there a BAA? | a contract, not a repository | Sylvia — decides C27, C28 |
| 4 | Is "1,000+ clients served" true? | `SELECT COUNT(*) FROM Clients;` | **PAU-166** — decides C57 |
| 5 | Is "Enforce HTTPS" on for the GitHub Pages site? | repository settings | whoever owns the Pages config — decides C8 |
| 6 | Does the practice actually run therapy groups, and are the four named group types current? | practice answer | decides the clinical half of C51 — the software half is settled and is a **yes** (§0.1) |
| 7 | Are all ten named insurance panels currently contracted? | payer configuration in production | **PAU-166** — decides C49 |

**Two production reads for PAU-166**, both single-row and read-only. I have not run them and
will not.

---

## §9 — What the coordinator asked me to answer that nobody else can

**Which false claims are copy that outran the build, and which are claims somebody had to
check something to write?**

**Outran the build** — aspirational at the time, never revisited: C11, C12, C13, C19, C20
(the portal capability set — written from a plan), C37–C41 (the whole No Surprises Act page
describes an intended process), C7 (analytics that were presumably intended).
~~C51 (Group Therapy sold as a shipped service)~~ — **withdrawn 2026-08-01, §0.1.** Group
Therapy is shipped; the copy did not outrun this build. Removing it leaves the category
smaller and more honest, and the lesson belongs in the other column: the audit itself is the
thing that outran its evidence here.

**Somebody had to check something** — the interesting category, and there are four:

1. **C1, the contact form.** The comment *"In production, this would submit to a server
   endpoint"* sits four lines above the sentence *"Your message has been received."* The author
   knew, wrote the knowledge down, and then wrote the opposite in the user-visible string. It
   is in **two** files by two hands (`contact.html:731`, `js/main.js:190`), which means the
   second author read the first and reproduced both halves.
2. **C23, "provided and managed by external vendors."** Nobody writes a vendor-escalation
   commitment about their own product by accident. Someone formed a belief about how the portal
   is built — and the belief is wrong in the direction that removes their own responsibility.
3. **C42, the NPI/TIN placeholders.** A 629-line page was drafted, reviewed enough to ship,
   and published with `[NPI Number]` visible under the words "as required under the No
   Surprises Act." Someone looked at that section and did not see it.
4. **C58, `CLAUDE.md`'s roster.** Commit `f08c39b` removed six named people from the public
   page *"at the practice's request"* — a deliberate, reasoned change by someone who had the
   roster open — and left the instruction file that lists them untouched. This is the exact
   shape of wave 2's "nested" finding: **wrong when written**, by someone who had just read the
   thing it describes.

**And the thing the coordinator most wanted to be wrong about.** I cannot give it to them
cleanly, but the honest answer is more interesting than either extreme:

The site does **not** systematically over-promise about the *practice*. Insurance verification,
superbills, statements, sliding scale, collections, BHIS, secure messaging, portal
authentication, e-signature, card payment and the accessibility statement are all real, all
implemented, and eleven of twelve accessibility claims are true when checked against the
markup. That is 19 verified-true claims and it should be said as plainly as the failures.
**The first area in this audit where the documents and the code substantially agree is this
one.**

What the site over-promises about is **the software's client-facing surface specifically** —
the portal's capabilities, the No Surprises Act machinery, and above all the website's own
ability to receive a message. Every one of the 17 false claims is about something a *client*
would try to do. Not one is about something a staff member does.

That is the finding underneath the findings, and it has a cause worth naming: **staff-facing
software gets used, so its lies get discovered.** Client-facing claims are tested by people who
have no way to report that they failed — and in the case of the contact form, no way to know.

---

## Findings filed

Each filed exactly once, at the end of the run, per the wave-2 correction.

| # | Ticket | Title | Severity |
|---|---|---|---|
| F1 | **PAU-241** | Contact form tells clients their message was received and sends nothing | **high** |
| F2 | **PAU-242** → Sylvia | Four regulatory/privacy assurances the code does not support | **high** |
| F3 | **PAU-243** | No Good Faith Estimate mechanism in the software; NSA notice ships NPI/TIN placeholders | **high** |
| F4 | *not filed — see below* | PAU-133's five portal claims are still live; the corrections are unmerged | **medium** |
| F5 | **PAU-244** | Website states the client portal is a third-party vendor product | **medium** |
| F6 | **PAU-245** | `GroupNote`/`FamilyNote`/`TelehealthNote` have zero usages; ~~Group Therapy is a headline service~~ | ~~medium~~ → **low** |
| F7·F8 | **PAU-246** | `CLAUDE.md` roster, homepage tenure figures, cookie banner | **low** |

**F6 was reversed on 2026-08-01** — see §0.1. The website claim it questioned is true; the
ticket survives only as a dead-enum cleanup in the EHR repo.

**F4 is deliberately not a ticket.** It is a status fact about **PAU-133** (currently
`in_review`) — that its corrections sit unmerged on `fix/portal-capability-copy` while
GitHub Pages serves `main` — not a new finding. Filing it would produce exactly the duplicate
the wave-2 method note warns about. It is recorded in §0, in the PAU-225 thread, and belongs
on PAU-133's own resolution. I cannot comment on PAU-133 directly; commenting is refused
outside my own issue subtree.

Repro harness: `docs/audits/pau-225-repro/contact-form-repro.mjs` (Node 22 + Playwright;
`node contact-form-repro.mjs /path/to/psgweb`). Exit 0 = defect reproduced.
