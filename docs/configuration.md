# Configuration

Every option lives in the plugin's `options` block in `opencode.json`. The table is generated from the manifest, so it
is the same schema the plugin validates.

<!-- generated:configuration -->
| Option | Type | Default | Description |
|---|---|---|---|
| `access` | `all` \| `ask-changes` \| `read-only` | `"all"` | How much the plugin's methods may do: all runs every method, ask-changes asks before a change, read-only runs reads only. |
| `accounts` | object | — | One profile per account alias, such as work or personal. Each alias signs in to its own Affinity MCP server, affinity or affinity-<alias>. |
| `allowUntestedHost` | boolean | `false` | Start on an OpenCode release outside the tested range instead of refusing with HOST_UNTESTED. |
<!-- /generated:configuration -->

## One account

```jsonc
{
  "plugins": [{ "package": "github:we-the-rebel-alliance/affinity-plugin#v0.0.8" }]
}
```

No options at all: one default account, `affinity`, signed in with `/connect`. Options go on the same entry:
`{ "package": "github:we-the-rebel-alliance/affinity-plugin#v0.0.8", "options": { … } }`.

## Two accounts, each with its own profile

```jsonc
{
  "plugins": [
    {
      "package": "github:we-the-rebel-alliance/affinity-plugin#v0.0.8",
      "options": {
        "accounts": {
          "work": {},
          "personal": { "clientId": "5d8b4c1e-7a2f-4d3b-9c6e-1f0a2b3c4d5e" }
        }
      }
    }
  ]
}
```

`work` signs in with OpenCode's client metadata; `personal` signs in as the organisation's own OAuth app.

## Reads only

```jsonc
{
  "plugins": [
    {
      "package": "github:we-the-rebel-alliance/affinity-plugin#v0.0.8",
      "options": { "access": "read-only", "accounts": { "work": {} } }
    }
  ]
}
```

Every read runs; every write, send, share, delete and export is off. The same setting is what an app's own consent
screen narrows, never widens.

## Ask before a change

```jsonc
{
  "plugins": [
    {
      "package": "github:we-the-rebel-alliance/affinity-plugin#v0.0.8",
      "options": { "access": "ask-changes", "accounts": { "work": {}, "personal": {} } }
    }
  ]
}
```

A read runs; a change asks first, in OpenCode's own permission prompt, which every client can answer.

## An untested OpenCode release

`allowUntestedHost` exists for testing a release outside `>=2.4.1 <2.5.0`: when it is set, the plugin starts instead of
refusing with `HOST_UNTESTED`. Leave it at its default `false` unless you are testing that release; the plugin's rules
may not hold there. It is not a supported configuration and no example here sets it.
