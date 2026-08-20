# PSGWEB - Paula S. Gordy LISW, LLC Website

## Overview
Static HTML website for Paula S. Gordy LISW, LLC, a behavioral health practice in southern Iowa.

## Hosting
- **GitHub repo**: https://github.com/247managed/psgweb
- **Hosting**: GitHub Pages, deployed from `main` branch
- **DNS**: Cloudflare (DNS only / grey cloud for GitHub Pages SSL)
- **CNAME**: Custom domain configured via `CNAME` file in repo root

## Project Structure
```
/
├── index.html          # Homepage
├── CNAME               # Custom domain for GitHub Pages
├── css/
│   └── styles.css      # Main stylesheet
├── js/
│   ├── main.js         # Main JavaScript
│   └── form-submit.js  # Posts form data to the Apps Script endpoint
├── images/             # Site images
├── apps-script/        # Google Apps Script form endpoint (deployed manually)
│   ├── Code.gs
│   └── README.md
└── pages/
    ├── about.html      # About Us / Team page
    ├── services.html   # Services
    ├── contact.html    # Contact / Locations
    ├── bhis-referral.html # BHIS Referral form (emails submissions)
    ├── insurance.html  # Insurance & Billing
    ├── resources.html  # Client Resources
    ├── forms.html      # Forms & Documents
    ├── blog.html       # Blog
    ├── privacy.html    # Privacy Policy
    ├── terms.html      # Terms of Use
    └── accessibility.html # Accessibility
```

## Team (pages/about.html)

### Owner & Clinical Director
- Paula S. Gordy, LISW (has photo: images/paula.PNG)

### Therapists
- Allison Brown (has photo: images/allison.jpg)
- Jacoby Campbell (placeholder)
- Carla Schippers (placeholder)
- Cassidy Stewart (placeholder)
- Sydney Thomas (placeholder)
- Jalyn Day, LMSW (placeholder)

### BHIS Providers
- Morgan Boney (placeholder)
- Chelsea Chandler (placeholder)
- Jodi Collier (placeholder)
- Hannah Haggard (placeholder)
- Emma Henderson (placeholder)
- Crystal Shondel (placeholder)
- Lisa Collier, MS (placeholder)
- Angelia Scott, BS (placeholder)
- Mekaayla Chamberlain, BA (placeholder)

### Administrative Team
- Barbara Alexander - Office Manager (placeholder)
- Billie Simmer - Medical Receptionist (placeholder)

## How to Add a New Team Member

1. Add their card in `pages/about.html` under the appropriate section
2. Use `card--accent-top` class for Therapists, `card--accent-green` for BHIS, `card--flat` for Admin
3. If they have a photo, add the image to `images/` and use an `<img>` tag
4. If no photo, use the placeholder SVG pattern (copy from an existing placeholder card)
5. Commit and push to `main` - GitHub Pages will auto-deploy

## Contact Info
- Phone: (641) 856-2688
- Fax: (641) 856-2690
- Email: info@paulagordy.com
- Client Portal: https://portal.paulagordy.com/login

## Forms That Send Email

GitHub Pages is static and cannot send email, so both live forms post from the
visitor's browser to a **Google Apps Script Web App** in the paulagordy.com Google
Workspace tenant, which emails the submission. Google Workspace (Gmail, Drive/Sheets,
Apps Script) is covered by the practice's signed Google BAA, and GitHub Pages never
receives the submitted data — so the site can stay on GitHub Pages.

| Form | Delivered to |
|---|---|
| `pages/bhis-referral.html` | jalyn.day@paulagordy.com |
| `pages/contact.html` | info@paulagordy.com |

- Endpoint URL lives in **one** place: `ENDPOINT` at the top of `js/form-submit.js`.
- Backend source: `apps-script/Code.gs`. Setup and redeploy steps: `apps-script/README.md`.
- Editing `Code.gs` in the Apps Script editor is not enough — you must
  **Deploy → Manage deployments → edit → Deploy** for changes to go live.
- Forms never show a false success: if delivery fails, the visitor sees an error with
  the office phone number and their answers are preserved.
- `pages/forms.html` still submits via `mailto:`, which is unencrypted and truncates
  at ~1,800 characters. Migrating it to the same endpoint is outstanding work.

## Adding a Referral or Contact Field

1. Add the field to the form with a `data-label="Human readable name"` attribute —
   that label is what appears in the email.
2. For multi-checkbox groups, give every box the same `name` plus a shared
   `data-group="Group label"`; they collapse onto one line.
3. Required fields are enforced by the `require(...)` calls in the page's inline
   script, not by the `required` attribute alone.
4. No backend change is needed — `Code.gs` renders whatever labelled fields it receives.
