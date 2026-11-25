# Changelog

## 0.0.0 (2026-11-25)

The first release: Affinity for OpenCode, built on [plugin-contract](https://github.com/we-the-rebel-alliance/plugin-contract) v0.0.0.

- Affinity through its hosted MCP server, one server per account alias (`affinity`, `affinity-work`, …), each with its
  own OAuth sign-in and an optional `clientId` per profile for an organisation's own OAuth app.
- `events_list`: the meetings the signed-in person organised, created or attended, oldest first, as contract events
  with a cursor bound to the alias and to `(start time, the exact meeting id)` — and, with `list: "companies"`, the
  firm's companies as a `list` snapshot.
- `probe`: the provider-confirmed owner of an alias and its sign-in scopes, without reading content.
- `status`: the plugin's state, its OpenCode range and one entry per alias, without an Affinity call.
- The two skills, `affinity` for reads and `affinity-write` for changes, are read from `skills/<id>/SKILL.md` at setup
  and registered through `ctx.skill.transform`, so OpenCode loads them; a missing or broken file is reported in `status`
  and does not stop the plugin.
- All 103 of Affinity's MCP tools classified in the manifest — 68 read, 22 write, 1 send, 1 share, 10 delete and
  1 export — so OpenCode's access levels cover reads and changes before they run.
- One `changed` bus event after a completed non-read pass-through call, through a tool hook that adds no model text.
- No actions and no plan/commit pair: every change is Affinity's own tool. Metered cost: each call shares the firm's
  monthly API quota, recorded as one call per unit at usd 0.

### Removed since v0.0.7

- The `/affinity-status` command and the `/affinity` status dialog, with the `./tui` export: `status` is the
  `affinity_status` agent tool, `tools.affinity.status` in Code Mode and RPC `affinity` method `status`.
- The RPC ids `affinity.crm`, `affinity.crm.tools` and `affinity.crm.tui`: every method is now on the one RPC id
  `affinity`.
- Nothing else. Affinity's MCP-provided `/affinity:<playbook>` commands are unchanged, not removed.
