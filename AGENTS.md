# Repository rules

This repository builds `@we-the-rebel-alliance/affinity-plugin`, an OpenCode plugin for Affinity CRM. It registers
Affinity's official MCP server, adds the meetings source's read as a tool, and serves the tools RPC
`affinity.crm.tools`. The plugin id is `affinity.crm`, the tool namespace is `affinity`, and the default branch is
`master`.

Version `0.0.0` is the first release of the renamed repository. The plugin-contract v0 adoption, the `capabilities`
manifest and releases come later; until then the current layout, the `sources` and `jelly` keys, the copied kit scripts
and the tools RPC stay working.

## Rules

- **Greenfield.** No legacy, migration code, compatibility shim, dual path or deprecated alias, and nothing dead.
- **Public API only.** Use only the public `@opencode/plugin` 2.4.1 API. `opencode.host` in `package.json` and
  `SUPPORTED_HOST` in `src/constants.ts` both say exactly `>=2.4.1 <2.5.0`, never `^2.4.1`. `TESTED_HOSTS` is
  `["2.4.1"]`: status calls only that release tested, and the host and pack stages and CI run on it.
- **The host packages are devDependencies pinned to exactly `2.4.1`.** `@opencode/client`, `@opencode/plugin` and
  `@opencode/sdk` are the only host packages the checks compile against. Do not add another host package or a runtime
  dependency: the bundles are self-contained.
- **One name.** Every install line, badge, link and source constant names `we-the-rebel-alliance/affinity-plugin` and
  `master`. The package name is `@we-the-rebel-alliance/affinity-plugin`; `src/events.ts` (`PACKAGE`) and
  `src/options.ts` (`EXAMPLE`) are the source constants to keep in step.
- **Fixed context.** `NAMESPACE_DESCRIPTION` in `src/constants.ts` is at most 400 characters, and each skill
  description at most 300. No tool is pinned, and there is no per-request context, prompt or compaction hook. The one
  tool hook records the account from `get_current_user` results and adds no text.
- **One tool table.** `src/affinity-tools.ts` records Affinity's reads, workflow playbooks, writes, destructive tools
  and parameters. The default rules, the tools RPC's methods, status and the fake servers derive from it. Affinity's
  tools come from its MCP server; do not hard-code a second list.
- **The meetings source.** `src/events.ts` serves `events_list` and `probe`, the tools RPC methods, and adds
  `events_list` as the `affinity_events_list` tool (`tools.affinity.events_list`). Keep the tool, the RPC method and
  `SOURCE_METHODS` in step.
- **No secrets.** No token, key, real CRM record or personal data in the repository, a fixture, a log or an error.
  Status and errors show only a redacted line, and URL query strings never appear.
- **Docs and skills** describe behaviour, never who decided it, and name no lane. Skills point at files under
  `https://github.com/we-the-rebel-alliance/affinity-plugin/blob/master/`.
- **Checks.** `npm run check` runs typecheck, unit, conformance, the release kit, build, icons, host, pack, forbidden,
  copies and the package whitelist. Run it before every commit. `bun test ./test/unit` and
  `npx tsc --noEmit -p tsconfig.json` are the fast loops.
- **Never push to `master`.** Work on a branch, open a pull request, and let CI pass first.
- **Do not edit a hash-pinned copy.** `scripts/check-copies.mjs` pins `test/support/jelly-settings.ts`, the release kit
  scripts, `scripts/jelly-family-block.md`, `scripts/tested-hosts.mjs` and the rest of the kit. Change a copy in every
  plugin at once, or leave it for the contract adoption.
- **`sources` and `jelly` are temporary.** The plugin-contract v0 adoption replaces both keys. Do not add a new app to
  either, and do not build behaviour that reads them at runtime.

## Forbidden in this repository

The forbidden scan (`scripts/check-forbidden.mjs`) rejects these in `src/`, `test/`, `scripts/` and `dist/`:

- the V1 plugin API (`@opencode-ai/*`), V1 hooks (`tool.execute.before`, `tool.execute.after`, `chat.message`,
  `chat.params`, `permission.ask`), and private host source or host checkouts;
- `ctx.generate.text`, `experimental.policies`, imported OAuth grants, `Plugin.image` and profile images;
- a second `@opencode/ai` import: the host provides `@opencode/plugin` only;
- a permission hook that escalates access, except the tools RPC's own `evaluate` hook that turns an unattended ask into
  a deny; default rules go through `ctx.agent.transform`;
- machine-local paths, the family's working folders and the owner's private names;
- internal wording: who made a decision, a review's author, a lane, or a `hey-jelly` issue reference.
