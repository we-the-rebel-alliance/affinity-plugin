# Contributing

This repository is an OpenCode plugin for Affinity on
[plugin-contract](https://github.com/we-the-rebel-alliance/plugin-contract) v0. The contract is
[docs/contract.md](https://github.com/we-the-rebel-alliance/plugin-contract/blob/master/docs/contract.md), the bar for
every plugin repository is
[docs/plugin-standard.md](https://github.com/we-the-rebel-alliance/plugin-contract/blob/master/docs/plugin-standard.md),
and [AGENTS.md](AGENTS.md) is the working guide.

## Set up and check

You need Node 24.

```sh
npm ci --ignore-scripts
npm run check
```

`npm run check` runs the whole gate:

| Step | What it proves |
|---|---|
| `npm run lint` | `@biomejs/biome` finds no lint error |
| `npm run typecheck` | the sources and tests typecheck under strict settings |
| `npm run bundle` | `dist/index.js` is bundled from `src/index.ts` with esbuild, and the committed file must match (`git diff --exit-code dist/`) |
| `npm test` | the unit tests: manifest, provider, events, probe, status, accounts, skills and refusals |
| `npm run conformance` | `plugin-kit check`: conformance T0 and T1 on the real 2.4.1 host, the recorded fixture, accounts, status, docs drift, the forbidden scan and no bundled kit |
| `npm run test:pack` | the tarball holds `package.json`, `dist/index.js`, both skills, the assets, `README.md` and `LICENSE`, and its entry loads |

CI runs the same gate in one job named `ci`. `dist/index.js` is committed, because OpenCode installs the package as it
is: CI rebundles it, fails when the committed file differs, then packs the tarball and runs `plugin-kit check`.

## The contract pin

`package.json` pins the contract to `github:we-the-rebel-alliance/plugin-contract#v0.0.0`, and `package-lock.json`
resolves it to `f7f0e011f6c036766e721ead9d4d902587e04c44`. Move the pin to the contract's next release tag; never follow
a branch, and never copy a contract module into this repository.

The lock records the contract's repository over `git+ssh`, as npm writes a GitHub dependency. CI rewrites that URL to
HTTPS because a runner has no SSH key; do the same locally if `npm ci` cannot reach GitHub.

## Pull requests

One change per pull request, based on `master`, with a conventional commit (`feat:`, `fix:`, `docs:`, `chore:`). The
pull request says what changed and why, the contract section it implements, the exact commands and counts from
`npm run check`, and any open question. A change to the manifest needs `npx plugin-kit docs` in the same pull request.

A new method, source or option starts in `package.json` `capabilities`, then its handler in `src/handlers/`, then its
tests, then `npx plugin-kit docs`, then `npx plugin-kit check`. Every capability has tests, including its negative
cases. Affinity's pass-through tools are classified in `methods` and never proxied by code here.

## Fixtures

`fixtures/conformance.json` is the plugin's evidence to the conformance kit, recorded for the two synthetic aliases
`work` and `personal`. `test/conformance/fixture.test.ts` drives the real handlers over the fake Affinity MCP transport
in `test/conformance/fake.ts`, rebuilds the fixture and fails on any drift. Regenerate it with:

```sh
UPDATE_FIXTURES=1 npx vitest run test/conformance
```

Read the diff before committing it: the fixture must carry no credential and no person's data. `npx plugin-kit record
--check` says whether it does. When a real account is used instead of the fake, record with
`npx plugin-kit record --account work`, which redacts credentials, emails, phone numbers and home directories.

## Releases

Releases are tags, not npm packages. A release is prepared in one pull request, `chore(release): prepare vX.Y.Z`: the
version in `package.json` and `package-lock.json`, the `CHANGELOG.md` section, and `npx plugin-kit docs` if the manifest
changed. The owner pushes the tag after `master`'s CI passed; the release workflow checks that the tag names the
package's version, checks the committed bundle, and creates the GitHub release with the packed tarball, the conformance report and
`SHA256SUMS`.
