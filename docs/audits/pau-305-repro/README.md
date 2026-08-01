# PAU-305 — is anything internal published on paulagordy.com?

GitHub Pages serves the **repository root** of `main`:

```
$ gh api repos/247managed/psgweb/pages
build_type: legacy    source: { branch: main, path: / }
```

So merging a file to `main` publishes it. That is easy to miss, because internal
material in a repo looks like ordinary repo documentation right up until someone
fetches it over HTTPS.

## The defect this was written for

`CLAUDE.md` has been on `main` since the repo was set up, and it was live:

```
$ curl -o /dev/null -w '%{http_code}' https://paulagordy.com/CLAUDE.md
200
```

It publishes the practice's full staff roster with credentials, the repo URL, and
the hosting/DNS layout, on the client-facing domain of a behavioral health practice.

`.claude/` was already 404 — Jekyll skips dot-prefixed entries — which is what
established that Jekyll is running on this site and applying its exclusion rules,
and therefore that `_config.yml`'s `exclude` would work here.

## Running it

```
node pages-exposure-verify.mjs https://paulagordy.com   # LIVE   — what is served now
node pages-exposure-verify.mjs /path/to/psgweb-checkout # STATIC — what a build would publish
```

Exit 0 = nothing internal exposed. Exit 1 = something is, **or** a real page
stopped being served — an over-broad `exclude` silently deleting pages from the
live site is the other half of this failure, so it is checked too.

Use STATIC on a PR head before merging, when there is no live answer yet. It
models Jekyll's publish set (skip dot/underscore entries, apply `_config.yml`
`exclude`) rather than building the site; that is enough to catch a file nobody
meant to ship, which is the failure mode here.

## Recorded results

| Tree | Mode | Result |
|---|---|---|
| live site, before the fix | LIVE | 12/13 — `FAIL not served: /CLAUDE.md (HTTP 200)` |
| `main` as-is | STATIC | 0/1 — no `_config.yml`, so `docs/` would be published |
| `fix/pau-305-exclude-internal-docs-from-pages` + `docs/` | STATIC | 11/11 |

The last row is the point: with the `exclude` in place, `docs/` can live on `main`
without reaching the site, so `main` can finally carry its own verification
harnesses instead of stranding them on audit branches.

## After the fix merges

Re-run LIVE. `/CLAUDE.md` must flip to 404 while every page stays 200. `CLAUDE.md`
is the canary — it is already published, so it proves the `exclude` mechanism
actually took effect on this site, which no amount of local reasoning can.

`docs/` exclusion is **not** proven by that run, because `docs/` is not on `main`
yet. Whichever PR first puts `docs/` on `main` has to re-run LIVE itself and
confirm `/docs/audits/...` returns 404.

## What was deliberately not done

`robots.txt` was left alone. `Disallow:` does not prevent retrieval — it only asks
crawlers not to index — so it would not fix this, and spelling out the internal
paths there would advertise them to anyone who reads it.
