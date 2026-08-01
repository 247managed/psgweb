// PAU-225 repro: does pages/contact.html transmit anything when a client
// fills in the form and presses "Send Message"?
//
// Serves the site tree statically, drives it in headless Chromium, records
// EVERY outbound request the page makes after the click, and reports what
// the user is told versus what left the browser.
//
// Run:  node contact-form-repro.mjs /path/to/psgweb
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.argv[2] || process.cwd();
const TYPES = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.png':'image/png',
                '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.txt':'text/plain', '.xml':'application/xml' };

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

const outbound = [];               // every request the page issues
page.on('request', r => outbound.push({ method: r.method(), url: r.url(), post: r.postData() }));

await page.goto(`${base}/pages/contact.html`, { waitUntil: 'networkidle' });
const loadMark = outbound.length;  // ignore asset loads

if (await page.locator('#contact-form').count() === 0) {
  console.log('  >>> NOT reproduced: there is no contact form on this page.');
  console.log('      Run contact-page-verify.mjs to check the page is honest about that.');
  await browser.close(); server.close(); process.exit(1);
}

// A realistic first-contact message from somebody asking for an appointment.
const MESSAGE = 'Please call me back, I would like to set up a first appointment.';
await page.fill('#first-name', 'Test');
await page.fill('#last-name',  'Client');
await page.fill('#email',      'test.client@example.com');
await page.fill('#phone',      '641-555-0117');
await page.fill('#message',    MESSAGE);
await page.check('#phi-acknowledgment');

page.on('dialog', d => d.dismiss());
await page.click('button[type="submit"]');
await page.waitForTimeout(1500);

const afterSubmit = outbound.slice(loadMark);
const carrying = afterSubmit.filter(r =>
  (r.post && (r.post.includes('test.client@example.com') || r.post.includes(MESSAGE.slice(0, 20)))) ||
  r.url.includes('test.client%40example.com') || r.url.includes('test.client@example.com'));

const shown = (await page.locator('#contact-form, .form-success, [role="status"]').first().innerText()).trim();

console.log('=== what the client is told =========================================');
console.log(shown.split('\n').map(s => '  ' + s).join('\n'));
console.log('=== what left the browser ===========================================');
console.log('  requests issued after clicking "Send Message": ' + afterSubmit.length);
afterSubmit.forEach(r => console.log(`    ${r.method} ${r.url}`));
console.log('  requests carrying any field the client typed:  ' + carrying.length);
console.log('=== verdict =========================================================');
const claimsReceipt = /received|thank you/i.test(shown);
console.log(`  page claims the message was received: ${claimsReceipt}`);
console.log(`  message actually transmitted:          ${carrying.length > 0}`);
console.log(claimsReceipt && carrying.length === 0
  ? '  >>> CONFIRMED: the client is told the message was received; nothing was sent.'
  : '  >>> NOT reproduced.');

await browser.close();
server.close();
process.exit(claimsReceipt && carrying.length === 0 ? 0 : 1);
