// PAU-305 verification: does paulagordy.com publish anything internal?
//
// GitHub Pages serves the repository ROOT of `main` (build_type: legacy,
// source path /). Every file merged to `main` is on the public domain unless
// Jekyll excludes it. That is easy to get wrong silently, because a file that
// leaks looks exactly like a file that does not until someone fetches it.
//
// Two modes, because the question has two halves:
//
//   node pages-exposure-verify.mjs https://paulagordy.com
//     LIVE  — what is actually being served right now. The ground truth.
//
//   node pages-exposure-verify.mjs /path/to/psgweb-checkout
//     STATIC — what a Pages build of this tree WOULD publish. Run this on a
//     PR head before merging, when the live answer does not exist yet.
//
// Exit 0 = nothing internal is exposed. Exit 1 = something is, or a real page
// stopped being served (an over-broad `exclude` is its own kind of failure).
import fs from 'node:fs';
import path from 'node:path';

const TARGET = process.argv[2];
if (!TARGET) {
  console.error('usage: node pages-exposure-verify.mjs <https://host | /path/to/checkout>');
  process.exit(2);
}

const failures = [];
const checks = [];
const check = (name, ok, detail) => {
  checks.push({ name, ok, detail });
  if (!ok) failures.push(name);
};

// Paths that must never be reachable on the public site. `.claude/` and
// `.git/` are already excluded by Jekyll's dotfile rule; they are listed so
// that a future `.nojekyll` — which turns the build into a verbatim copy and
// silently repeals every rule below — fails this check loudly.
const MUST_NOT_PUBLISH = [
  'CLAUDE.md',
  'docs/',
  'docs/audits/PAU-225-public-web-claim-audit.md',
  '_config.yml',
  '.claude/settings.local.json',
  '.git/config',
];

// Real site content, which must survive whatever `exclude` is set to.
const MUST_PUBLISH = [
  '',
  'robots.txt',
  'sitemap.xml',
  'css/styles.css',
  'pages/contact.html',
  'pages/about.html',
  'pages/services.html',
];

// --------------------------------------------------------------- live mode
async function live(base) {
  const root = base.replace(/\/+$/, '');
  const status = async (p) => {
    try {
      const res = await fetch(`${root}/${p}`, { redirect: 'follow' });
      return res.status;
    } catch (err) {
      return `network error: ${err.message}`;
    }
  };

  for (const p of MUST_NOT_PUBLISH) {
    const code = await status(p);
    check(`not served: /${p}`, code === 404, `HTTP ${code}`);
  }
  for (const p of MUST_PUBLISH) {
    const code = await status(p);
    check(`still served: /${p || '(root)'}`, code === 200, `HTTP ${code}`);
  }
}

// ------------------------------------------------------------- static mode
// A deliberately small model of what Jekyll publishes: everything under the
// source root except dot- and underscore-prefixed entries and whatever
// `_config.yml` excludes. It is not a Jekyll build. It is enough to catch a
// file nobody meant to ship, which is the failure this issue exists for.
function readExclude(root) {
  const cfgPath = path.join(root, '_config.yml');
  if (!fs.existsSync(cfgPath)) return null;
  const lines = fs.readFileSync(cfgPath, 'utf8').split('\n');
  const out = [];
  let inList = false;
  for (const line of lines) {
    if (/^exclude:\s*$/.test(line)) { inList = true; continue; }
    if (!inList) continue;
    const item = line.match(/^\s*-\s*(.+?)\s*$/);
    if (item) { out.push(item[1].replace(/^['"]|['"]$/g, '')); continue; }
    if (/^\s*(#.*)?$/.test(line)) continue; // blank or comment inside the list
    break; // a new top-level key ends the list
  }
  return out;
}

function publishSet(root, exclude) {
  const excluded = (rel) =>
    exclude.some((e) => {
      const norm = e.replace(/\/+$/, '');
      return rel === norm || rel.startsWith(`${norm}/`);
    });

  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      // Jekyll skips dot- and underscore-prefixed entries outright.
      if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full);
      if (excluded(rel)) continue;
      if (entry.isDirectory()) walk(full);
      else out.push(rel);
    }
  })(root);
  return out;
}

function staticScan(root) {
  const exclude = readExclude(root);
  check('_config.yml exists', exclude !== null,
    exclude === null ? 'no _config.yml — nothing is excluded, docs/ would be published' : `${exclude.length} entries`);
  if (exclude === null) return;

  for (const required of ['CLAUDE.md', 'docs/']) {
    check(`_config.yml excludes ${required}`,
      exclude.some((e) => e.replace(/\/+$/, '') === required.replace(/\/+$/, '')),
      exclude.join(', '));
  }

  const nojekyll = fs.existsSync(path.join(root, '.nojekyll'));
  check('no .nojekyll', !nojekyll,
    nojekyll ? '.nojekyll makes Pages copy the tree verbatim and repeals every exclusion' : '');

  const published = publishSet(root, exclude);

  // Anything Markdown at any depth is engineering material on this site; the
  // site itself is HTML. Same for the repro harnesses.
  const leaks = published.filter((p) => /\.(md|mjs)$/i.test(p) || p.startsWith('docs/'));
  check('no internal files in the publish set', leaks.length === 0,
    leaks.length ? leaks.join(', ') : `${published.length} files would be published, all site content`);

  for (const p of MUST_PUBLISH.filter(Boolean)) {
    if (!fs.existsSync(path.join(root, p))) continue; // not every tree has every page
    const ok = published.includes(p);
    check(`still published: ${p}`, ok, ok ? '' : 'excluded by an over-broad rule');
  }
}

// ------------------------------------------------------------------- report
const isUrl = /^https?:\/\//i.test(TARGET);
if (isUrl) await live(TARGET);
else staticScan(path.resolve(TARGET));

console.log(`\nPAU-305 exposure check — ${isUrl ? 'LIVE' : 'STATIC'} — ${TARGET}\n`);
for (const c of checks) {
  console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
}
console.log(`\n${checks.length - failures.length}/${checks.length} passed\n`);
process.exit(failures.length ? 1 : 0);
