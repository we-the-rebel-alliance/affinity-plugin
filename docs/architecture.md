# Architecture

One `register` call wires the plugin's methods through the contract's doors (agent tool, Code Mode and RPC). Affinity's
own tools stay Affinity's: the manifest declares them and the plugin writes no pass-through tool.

## Layers

| File                      | Does                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`            | `Plugin.define`, `assertHost`, `readSkills`, `registerSkills`, `registerAccounts`, one `register`                |
| `src/manifest.ts`         | reads `../package.json`; the manifest and the installed version                                                  |
| `src/accounts.ts`         | the profile, the one server name per alias, the MCP server config                                                |
| `src/skills.ts`           | reads every `skills/<id>/SKILL.md`, parses its YAML frontmatter (including `>` and `|` block scalars), checks it and registers it with `ctx.skill.transform` |
| `src/provider/index.ts`   | the only place the endpoint is named; `ctx.tool.list()` and `tool.execute` per alias; the contract's error codes |
| `src/provider/answers.ts` | Affinity's API v2 field names; the readers for meetings, whoami and companies                                    |
| `src/handlers/`           | `status`, `events_list`, `probe`, and the one handler table                                                      |

`dist/index.js` is committed: OpenCode installs the package as it is, so the bundle ships with the source, and
`npm run check` rebundles it and fails when the committed file is stale.

## The provider

The endpoint is `https://mcp.affinity.co/mcp`, named once in `src/provider/index.ts`. A call never builds a tool's name
by hand: `accountName("affinity", alias)` derives the server (`affinity`, `affinity-work`, …) and `toolAction(server,
tool)` derives the effective tool id (`affinity-work_get_meetings`), exactly as OpenCode does. The provider looks the
alias's server up in `ctx.mcp.list()` and refuses fast when it cannot take a call:

| Server state                 | Answer                                       |
| ---------------------------- | -------------------------------------------- |
| `connected`                  | the call runs                                |
| `needs_auth`                 | `NEEDS_SIGN_IN`, naming the alias to sign in |
| `pending`                    | `UNAVAILABLE`: still connecting, try again   |
| `failed`, `disabled`, absent | `UNAVAILABLE` with the state and a next step |

Affinity's own failure is mapped, one redacted line: a rate limit or the firm's monthly quota is `RATE_LIMITED`, a
missing scope `SCOPE_MISSING`, a refused permission rule `PERMISSION_DENIED`, anything else `UNAVAILABLE`. A missing or
unreadable answer is unknown, never zero: `get_meetings` that does not answer a page is `UNAVAILABLE`, not an empty
page.

## Pass-through tools and the account

Every one of Affinity's 103 tools is an explicit `mcp:<tool>` row, with `accounts: "none"` and `operations: ["<tool>"]`.
That is the contract's reading (§5, §6): the account an MCP tool runs as is the server that carries it, not a field in
its input. The register refuses a handler for an `mcp:` method, and the vendor owns the tool's input. The plugin's own
methods take `account` and resolve it through the contract's `accounts` module.

## Skills

`readSkills()` reads every `skills/<id>/SKILL.md` once at setup and parses its frontmatter as YAML. It validates that
the frontmatter `name` equals the directory, that a description exists and that the body is not empty, then
`registerSkills(ctx, skills)` adds each skill through OpenCode's skill editor. A `>` or `|` block scalar registers its
folded or literal text, never the marker. A malformed file throws `SCHEMA_VIOLATION` at setup with a fix-the-file next
step, so a broken package fails with one clear error instead of loading without its skills.

## What is cached

Only one thing: the identity a meetings listing needs. `get_current_user` gives the signed-in person's id, name and
organisation (for the page's owner) and their address (to keep only their own meetings). That answer is kept per alias
for 15 minutes, so a two-minute automation does not pay an identity call every time. A stale identity can only
under-list, never over-list: the filter keeps the meetings the cached address took part in, and the server's own
sign-in decides what it can see at all. `probe` always reads a fresh answer.

Nothing else is cached: no meetings, no companies, no tokens, and no status between calls.

## Cursors

A cursor is the contract's bound cursor: `{ plugin: "affinity", source: "affinity", account: <alias> }`, with the
listing's state inside (its position, its late-feed generation and the spans it has learned). Its position is a total
order over `(start time, Affinity's meeting id as the exact string it sent)`, and a read resumes strictly after that
pair: the id is never turned into a number, because two ids beyond `Number`'s safe range can collapse to one value, and
a tie-breaker that cannot tell them apart repeats one meeting and skips the other at a page boundary. A cursor from
another alias is `CURSOR_INVALID`, never a silent restart. The snapshot carries no cursor.

## OpenCode APIs used

`ctx.app.version` (the host gate), `ctx.options`, `ctx.mcp.transform` (through `registerAccounts`), `ctx.tool.list()`
and `tool.execute` (the provider), `ctx.skill.transform` (the two skills), and everything `register` itself wires
(`ctx.agent.transform`, `ctx.tool.transform`, `ctx.rpc.register`, `ctx.permission.assert`). No internal API is used.
The plugin installs no `ctx.tool.hook` and declares no bus event: it makes no write of its own and receives no webhook.

## Tests

| Suite              | Proves                                                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/unit`        | the manifest against the recorded 103-tool list, the provider's names and error codes, the meetings page and its cursor, probe, status, accounts, the skills loader and every refusal's shape |
| `test/conformance` | the real handlers over a fake Affinity transport for `work` and `personal`, recorded into `fixtures/conformance.json`                                                                    |
| `test/host`        | the built bundle in the real OpenCode 2.4.1 host: id, namespace, tools, RPC, status, the access rules, and the skills list in an empty project                                           |
| `test/pack`        | the tarball `npm pack` builds, and that its entry loads                                                                                                                                  |
