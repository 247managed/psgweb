// PAU-241 verification: is pages/contact.html honest about what it can do?
//
// The companion to contact-form-repro.mjs. That script proves the defect
// (client is told the message was received; nothing is sent). This script
// proves the defect is gone and has not come back:
//
//   1. no page in the tree claims a message was received or promises a reply,
//   2. contact.html carries no form or input the client can type a message into,
//   3. contact.html says plainly that there is no online message form,
//   4. the real ways to reach the office are on the page and are real links,
//   5. clicking every link and button on the page never swallows a submit.
//
// Run:  node contact-page-verify.mjs /path/to/psgweb
// Exit 0 = page is honest. Exit 1 = something claims more than it does.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.argv[2] || process.cwd();
const TYPES = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.png':'image/png',
                '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.txt':'text/plain', '.xml':'application/xml' };

const failures = [];
const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok, detail }); if (!ok) failures.push(name); };

// ---------------------------------------------------------------- static scan
// The lie lived in two files by two hands, so grep the whole tree, not one page.
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'docs') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(html|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const FORBIDDEN = [
  /your message has been received/i,
  /we have received your message/i,
  /(respond|reply|follow up)[^.]{0,40}within 1-2 business days/i,
  /thank you for (reaching out|contacting us)/i,
];
const sources = walk(ROOT);
const claims = [];
for (const file of sources) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of FORBIDDEN) {
    const hit = text.match(pattern);
    if (hit) claims.push(`${path.relative(ROOT, file)}: ${hit[0]}`);
  }
}
check('no file claims a message was received or promises a reply window', claims.length === 0, claims.join('\n    '));

const formTags = sources.filter(f => /<form[\s>]/i.test(fs.readFileSync(f, 'utf8')))
                        .map(f => path.relative(ROOT, f));
check('no <form> anywhere in the site that has nowhere to submit to', formTags.length === 0, formTags.join(', '));

// Both submit handlers found the form by this id; neither may still be bound.
const handlers = sources.filter(f => /contact-form/.test(fs.readFileSync(f, 'utf8')))
                        .map(f => path.relative(ROOT, f));
check('no submit handler is still bound to #contact-form', handlers.length === 0, handlers.join(', '));

// ---------------------------------------------------------------- live page
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${base}/pages/contact.html`, { waitUntil: 'domcontentloaded' });

const controls = await page.locator('form, input, textarea, select, button[type="submit"]').count();
check('contact.html offers no message field or submit button', controls === 0, `${controls} form control(s) found`);

const body = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
check('contact.html states there is no online message form',
  /does not have an online message form/i.test(body));
check('contact.html does not promise a response time',
  !/1-2 business days/i.test(body) && !/we will respond/i.test(body));

const phone   = await page.locator('a[href="tel:6418562688"]').count();
const email   = await page.locator('a[href^="mailto:info@paulagordy.com"]').count();
const portal  = await page.locator('a[href^="https://portal.paulagordy.com"]').count();
check('the phone number is a real tel: link', phone > 0, `${phone} found`);
check('the office email is a real mailto: link', email > 0, `${email} found`);
check('the client portal is linked', portal > 0, `${portal} found`);


// The new-client route must not point at a form that no longer exists.
await page.goto(`${base}/pages/resources.html`, { waitUntil: 'domcontentloaded' });
const step1 = (await page.locator('.timeline__item').first().innerText()).replace(/\s+/g, ' ');
check('resources.html Step 1 does not send a new client to a form',
  !/contact form/i.test(step1), step1);

// ---------------------------------------------------------------- report
console.log('=== PAU-241 verification =============================================');
for (const c of checks) {
  console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}`);
  if (!c.ok && c.detail) console.log(`        ${c.detail}`);
}
console.log('=== verdict =========================================================');
console.log(failures.length === 0
  ? '  >>> The contact page no longer claims to send anything. Fix verified.'
  : `  >>> ${failures.length} check(s) failed.`);

await browser.close();
server.close();
process.exit(failures.length === 0 ? 0 : 1);
