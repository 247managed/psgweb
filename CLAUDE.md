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
│   └── main.js         # Main JavaScript
├── images/             # Site images
└── pages/
    ├── about.html      # About Us / Team page
    ├── services.html   # Services
    ├── contact.html    # Contact / Locations
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
- Client Portal: https://ehr.paulagordy.com/portal/login
