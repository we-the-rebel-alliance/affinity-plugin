# Contributing

This repository follows [the plugin standard](https://github.com/we-the-rebel-alliance/plugin-contract/blob/master/docs/plugin-standard.md)
and [plugin-contract v0](https://github.com/we-the-rebel-alliance/plugin-contract/blob/master/docs/contract.md). Where this
file is silent, they decide.

## Commands

| Command                                             | Does                                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm ci`                                            | installs the dev tooling; there are no runtime dependencies                                                  |
| `npm run check`                                     | everything CI runs: lint, typecheck, build, unit and conformance tests, `plugin-kit check`, pack             |
| `npx plugin-kit docs`                               | rewrites the generated doc sections from the manifest                                                        |
| `npx plugin-kit check`                              | the contract's own gate: T0 and T1, the recorded sources, accounts, bus, status, docs drift, forbidden files |
| `UPDATE_FIXTURES=1 npx vitest run test/conformance` | rewrites `fixtures/conformance.json`; read the diff before committing                                        |
| `npx plugin-kit release 0.0.0`                      | cuts a release; CI publishes it                                                                              |

## Rules

1. **The manifest is the source of truth.** Add a method, source or option in `package.json` `capabilities` first, then
   its handler, then its tests and its docs. Never register a tool by hand.
2. **Classify every method truthfully**, including every pass-through tool. A delete is `delete`, a share is `share`, an
   export is `export`. If in doubt, choose the stricter class.
3. **Every method takes the account** when it reads an alias's data. Never assume `default`.
4. **Errors** read `CODE: What happened. Next step: What to do.` from the contract's table.
5. **No secrets anywhere**: code, docs, fixtures or logs. Fixtures use invented people on `example.test`.
6. **Greenfield:** no compatibility code, legacy paths, deprecated aliases or dead code. Delete rather than deprecate.
7. **One endpoint**, named once in `src/provider/`.
8. **Public OpenCode API only** (`@opencode/plugin` 2.4.1); the kit's forbidden list is final.

## A pull request

A pull request says what changed, why, which contract section it follows, the exact commands and counts from
`npm run check`, and any open question. The `ci` check must pass. A release is a tag cut after merge.
