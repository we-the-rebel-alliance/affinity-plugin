# Changelog

## [0.0.0]

The first release of `@we-the-rebel-alliance/affinity-plugin`, rebuilt greenfield on plugin-contract v0.

### Added

- Affinity through its hosted MCP server: one server per account alias (`affinity`, `affinity-work`, …), each with its
  own OAuth sign-in, and an optional `clientId` per profile for an organisation's own OAuth app.
- `events_list`: the meetings the signed-in person organised, created or attended, oldest first, as contract events
  with a cursor bound to the alias — and, with `list: "companies"`, the firm's companies as a `list` snapshot.
- `probe`: the provider-confirmed owner of an alias and its sign-in scopes, without reading content.
- `status`: the plugin's state, its host range and one entry per alias, without an Affinity call.
- All 103 of Affinity's MCP tools classified in the manifest, so OpenCode's access levels cover reads and changes
  before they run.
- One `changed` bus event after a completed non-read pass-through call, through a tool hook that adds no model text.

### Notes

- No actions and no plan/commit pair: every change is Affinity's own tool.
- Metered cost: each call shares the firm's monthly API quota. The source's cost is recorded as one call per unit at
  usd 0, because that quota, not a per-call price, is the real cost.
