# Accounts

The credentials are Affinity's own: the plugin holds none. Accounts use the **mcp** mechanism, one Affinity MCP server
per alias, each with its own OAuth sign-in.

<!-- generated:accounts -->
Accounts are held by the **mcp** mechanism: the vendor's MCP server holds them.

| Field | Type | Required |
|---|---|---|
| `clientId` | string | no |
<!-- /generated:accounts -->

## One server per alias

| Alias      | MCP server          | Sign in with                             |
| ---------- | ------------------- | ---------------------------------------- |
| `default`  | `affinity`          | `/connect`, then **affinity**            |
| `work`     | `affinity-work`     | `/connect`, then **affinity-work**       |
| `personal` | `affinity-personal` | `/connect`, then **affinity-personal** |

The name is the contract's one rule: `<name>` for the default account and `<name>-<alias>` for every other. A person
signs in and a tool is permitted under the same name, and a rule for one alias's tools never reaches another alias's.

With no `accounts` option the plugin has exactly one account, `default`. An empty map is also one `default` account.

## The profile

One field, optional: `clientId`, the client ID of your organisation's own Public OAuth app in Affinity, a UUID.

- Without it, OpenCode signs in with its own client metadata document and the server sets no client id. An Affinity
  admin may have to add OpenCode's client URL first, under Settings, Manage Apps.
- With it, the OAuth request carries `client_id`, and OpenCode signs in as your organisation's own app. Use it when
  your firm requires its own app, or when Affinity answers `Unknown client_id` for OpenCode's document.

The scope is always `mcp mcp.read offline_access`: changes, reads, and a refresh token. Without `offline_access` the
sign-in would expire without a refresh token, so the plugin pins it rather than trusting a challenge to ask.

## Choosing an account in a call

Every one of the plugin's own methods that signs in takes `account`, and so does every pass-through tool the host
permits per alias. With one account it may be left out; with more than one, leaving it out is `ACCOUNT_REQUIRED`, whose
next step lists the aliases. An alias the plugin does not have is `ACCOUNT_UNKNOWN`.

```jsonc
// Code Mode or an automation
tools.affinity.events_list({ account: "work", source: "affinity", cursor })
```

A cursor is bound to its plugin, source and account: a cursor `work` issued is refused as `CURSOR_INVALID` when it is
passed for `personal`, never silently restarted.

## Signing out and switching

`/connect` also switches or signs out an alias. The plugin keeps no credential: it reads the state of the alias's MCP
server on every call, so a server that needs a new sign-in refuses with `NEEDS_SIGN_IN` and names the alias to sign in,
and status shows that alias as `needs_sign_in`.
