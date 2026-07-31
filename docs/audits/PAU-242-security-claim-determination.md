# PAU-242 — Determination on four regulatory/privacy assurances on www.paulagordy.com

**Author:** Sylvia (security & privacy)
**Date:** 2026-07-31
**Source finding:** PAU-225 F2 (Colleen), routed to security per the PAU-225 brief
**Website reviewed:** `247managed/psgweb` `main @ d4365ff`
**Application reviewed:** `247managed/paula-gordy-ehr` `main @ 124a2bfa` (local audit checkout; F2 was filed against `8be1c12d` — the four findings below were re-derived and still hold)

---

## Summary of dispositions

| # | Assurance | Colleen's verdict | My determination | Action taken here |
|---|---|---|---|---|
| 1 | "All data … stored securely" / "HIPAA-compliant encryption" | unsupported as stated | **Unsupported — cannot be closed from code.** Turns on a production database fact I must not read. | Routed. Copy left unchanged pending the fact. |
| 2 | Telehealth "end-to-end encryption" + BAAs with all vendors | could-not-check | **Unsupported by any control.** Contract facts + one missing technical control. | Routed. Copy left unchanged pending the fact. |
| 3 | Site forbids emailing PHI, ships the button that emails PHI | verified false | **Confirmed. Live PHI-disclosure path.** Fixed in this change. | **Removed.** |
| 4 | NPI/TIN published as `[NPI Number]` / `[Tax ID]` | verified false | **Confirmed.** Values are not mine to publish. | **Placeholders removed**; real values requested. |

Items 3 and 4 are fixed on this branch. Items 1 and 2 are *not* code defects I can fix — each is blocked on exactly one fact held outside the repository. Both are routed with the fact named, so neither is waiting on a re-audit.

---

## 1. "All data is transmitted and stored securely"

**Claims** — `pages/resources.html:307` and `pages/privacy.html:592`.

**Re-derived against the application.** Transmission is TLS; that half of the sentence is true. Application-level encryption at rest covers exactly four things: `Client` SSN and one sibling field, HelpDesk ticket subject/description, `SystemSetting` values, and 2FA secrets. Progress notes, assessments, portal messages and uploaded documents are not encrypted by the application.

I independently re-ran the `IsEncrypted` check Colleen was asked to apply, and it holds:

```
EHR.Core/Entities/Clinical/AssessmentDocument.cs:29   public bool IsEncrypted { get; set; } = true;   // "(for HIPAA compliance)"
EHR.Infrastructure/Services/AssessmentService.cs:1479 IsEncrypted = false, // TODO: Implement encryption if required
```

Whole-tree grep for `IsEncrypted` in the EHR: the declaration above, that one writer, the unrelated `SystemSetting.IsEncrypted` (which *does* have real readers at `SystemSettingService.cs:41,54`), and two locals in `tools/EncryptExistingSsns/Program.cs`. `AssessmentDocument.IsEncrypted` has **zero readers**. It is a field whose name and comment assert the exact protection the public website promises, written `false`, read by nobody.

**Why I did not change the copy.** Application-level encryption is not the only way this sentence becomes true. Transparent Data Encryption at the database tier would satisfy it as written, and I must not read production to find out. Rewriting a truthful sentence into a weaker one is its own kind of inaccuracy.

**The one fact that closes this,** on **PAU-166**:

```sql
SELECT name, is_encrypted FROM sys.databases;
```

- `is_encrypted = 1` on the EHR database → the claim stands as written; close it, and separately delete or implement `AssessmentDocument.IsEncrypted` so the field stops asserting something no code does.
- `is_encrypted = 0` → the sentence is false on a public website and the copy must change the same day.

## 2. Telehealth "end-to-end encryption" and BAAs

**Claims** — `pages/privacy.html:623` (privacy notice) and `pages/forms.html:1607`, inside the **Telehealth Consent the client signs**. The second placement is what raises this above marketing copy: it is a representation made to a client at the moment of consent.

**What the application actually models.** `Appointment.IsTelehealth` (bool) and `Appointment.TelehealthLink` (nullable free-text URL), `EHR.Core/Entities/Scheduling/Appointment.cs:52-53`, populated by a scheduler typing into a text box at `EHR.Blazor/Components/Scheduling/NewAppointmentDialog.razor:80-81`. No vendor is named anywhere in the codebase. Nothing validates the URL's host.

**Determination.** Whether BAAs exist is a contract fact and not answerable from code — that part is genuinely could-not-check. But the sentence promises a property of *every* session, and the only thing standing behind it is that whoever schedules the appointment pastes the right kind of link. That is an instruction, not a control. Even if every BAA is in order today, nothing in the software prevents tomorrow's session from being scheduled on a consumer video link.

**The facts that close this:** (a) which platform, (b) is there a signed BAA, (c) does that platform in fact provide E2EE — several major "HIPAA-compliant" platforms provide encryption in transit but *not* end-to-end, which would make the specific words "end-to-end encryption" wrong even with a valid BAA in hand. Answers (a)–(c) then determine whether the copy stands, and whether host validation on `TelehealthLink` should be built.

## 3. The site forbids emailing PHI and shipped the button that emails PHI — **fixed**

`pages/privacy.html:607` told clients: *"Standard email … is **not** a secure method of communication. Please **do not send** protected health information, clinical details, or other sensitive information via regular email."*

`pages/forms.html` shipped ten **Email to Office** buttons — one in the header and one in the footer of each of the five forms — that assembled a `mailto:info@paulagordy.com` out of the filled-in fields.

I read `buildEmailBody()` before removing it. It iterated `formSection.querySelectorAll('input, select, textarea')` — **every** field, with no exclusion list. On the New Client Intake Form that is the Social Security number (`:754`) and the checked-only concern checkboxes, which include **Suicidal Thoughts** (`:1039`) and **Self-Harm** (`:1040`). Those two were serialized as `[X] <label>` lines and placed into a `mailto:` URL.

The dismissible `confirm()` in front of it was an instruction, not a control — and the client dismissing it is not the party bearing the risk.

Two things made it worse than a plain unencrypted send:

1. The body was truncated at 1,800 characters to fit a `mailto:` URL. A completed intake form exceeds that, so the mail client opened with a silently partial form. The client was told — by an `alert()` fired one second *after* `window.location.href` was already set, i.e. after the mail client had the partial content.
2. It is not a lapse in policy but a contradiction *within the same website*: one page forbade the act the other page provided a button for.

**Change made.** The email path is gone, not merely discouraged:

- all 10 `emailForm(...)` buttons removed (`pages/forms.html`)
- `window.emailForm`, `buildEmailBody()` and `getClientName()` deleted — 167 lines; no caller and no other reference remains
- dead `.btn--email` styling and its print-hide selector removed
- instruction copy and the "Email to Office" option card rewritten to describe what clients should actually do
- `pages/resources.html:378` corrected — it also told clients they could email completed forms

Verified: `grep -n "emailForm\|btn--email\|buildEmailBody\|getClientName" pages/forms.html` returns nothing; the remaining inline JS passes `node --check`; tag balance is unchanged from `HEAD` on all three edited pages.

**On the replacement copy.** I checked the client portal before pointing anyone at it, because PAU-133/PAU-144 are open on portal capability claims that were true of the plan and never true of the build. `EHR.ClientPortal` has **no** `InputFile` anywhere — there is no client-initiated document upload, so "submit your completed form through the portal" would have been a new false claim. What does exist is `EHR.ClientPortal/Components/Pages/Forms.razor` — intake packets, releases and screeners that **staff assign** and the client then completes and signs in the portal. The new copy says exactly that and no more: print and bring it, or call the office to have paperwork sent to you in the portal.

## 4. NPI and TIN placeholders — **placeholders removed, real values requested**

`pages/no-surprises-act.html:411` introduced a block as *"information [that] identifies our practice as required under the No Surprises Act"*, and then published `[NPI Number]` and `[Tax ID]` — literal, unreplaced, live, on the page whose purpose is to publish them.

I did not fill them in, and the reason is worth recording. The public NPPES registry has exactly one Iowa match: **NPI 1912052325, Paula Sue Gordy, LISW, Centerville IA, taxonomy Social Worker/Clinical** — an NPI-1 (individual). A search for an NPI-2 (organizational) under the LLC returns nothing. The block is labelled for **Paula S. Gordy LISW, LLC**, an entity. Whether the LLC bills under that individual NPI is a billing fact, not a registry fact, and publishing the wrong statutory identifier on a statutory notice is worse than publishing none. The TIN is not public and cannot be looked up at all.

So the interim change removes the placeholders and states truthfully where the numbers come from. **Both real values are requested on PAU-242**; when they arrive this block should be filled in properly.

Note also `pages/no-surprises-act.html:269`, which correctly describes NPI and TIN as contents of a Good Faith Estimate. That is a separate exposure: Colleen filed alongside F2 that no Good Faith Estimate mechanism exists anywhere in the software. The interim wording here says the numbers are furnished on your GFE — true as a statement of what the practice owes under the No Surprises Act, and it should be revisited if the GFE finding shows the practice cannot produce one.

---

## What is not fixed, and who owns it

| Item | Blocked on | Owner |
|---|---|---|
| 1 — encryption at rest | one row: `SELECT name, is_encrypted FROM sys.databases;` | PAU-166 (production access) |
| 1 — `AssessmentDocument.IsEncrypted` | a field asserting HIPAA protection, written `false`, zero readers — delete it or implement it | EHR engineering |
| 2 — telehealth E2EE + BAAs | vendor name, signed BAA, and whether that vendor's encryption is actually end-to-end | practice / whoever holds vendor contracts |
| 4 — NPI and TIN | the two real values | practice |

No production data was read. No claim in this document rests on anything other than the two repositories cited at the top.
