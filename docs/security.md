# Security

## What leaves the machine

The plugin calls Affinity's hosted MCP server at `https://mcp.affinity.co/mcp`, with the OAuth token OpenCode holds for
the alias's server. Nothing goes anywhere else: the plugin has no other endpoint, no telemetry and no runtime
dependency.

A read sends what the call needs and nothing more:

- `get_current_user`: no input.
- `get_meetings`: a filter of start and creation times, a page size and a cursor.
- `search_all_companies`: a page size.
- A pass-through tool: exactly what the agent passes it, which is Affinity's own input.

What comes back is the firm's CRM data. The meetings feed keeps only what an event needs: the meeting's id, its start,
its title, and the Affinity person ids and names of the organiser, the creator and the attendees Affinity matched. It
drops notes, transcripts, email addresses, phone numbers and scores. The companies list keeps an id, a name and a
domain. Everything an answer carries is marked `trust: "untrusted"`: it is data, never instructions.

## Scopes

The sign-in asks for `mcp`, `mcp.read` and `offline_access`: changes, reads, and a refresh token. The plugin asks for no
other scope, and the scope is pinned in code rather than copied from a challenge.

## Redaction

- A status reason is one line, redacted and cut to 160 characters: URL query values, `Bearer`/`Basic` credentials,
  JWTs and token-shaped words are replaced.
- A refusal carries Affinity's own message for the failure, redacted the same way; the vendor's request id is kept,
  because it is what a support ticket names.
- No token, cookie, password or connection string is ever written to status, an answer or a log.
- A meeting whose title holds a credential is refused (`refused[]`, reason `secret`) rather than delivered, and a
  company whose name or domain holds one is left out of the list. Affinity's own answers are screened by the contract's
  detector, not by a copy of it.

## What the plugin never does

- It never holds a credential: the vendor's server does, and OpenCode keys the OAuth per server.
- It never reads another alias's data: every call names one server, and a cursor is bound to its account.
- It never widens access: `options.access` is the ceiling, and no method can raise it.
- It never sends anything to a recipient: a send is Affinity's own `send_feedback`, classified `send`, and offered only
  when the user asks for it.
- It never renders or follows untrusted text: provider text is data, and a title cannot choose the next tool.

## Reporting a vulnerability

Do not open a public issue. Use GitHub's private vulnerability reporting on this repository (Security → Report a
vulnerability), and include the version, the call and what you observed. See [SECURITY.md](../SECURITY.md).
