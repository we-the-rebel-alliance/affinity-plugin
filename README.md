# Affinity plugin for OpenCode

Affinity is a CRM for venture and private-capital firms: companies, people, deals held in lists, notes, meetings and
relationship paths. This plugin connects OpenCode to your firm's Affinity through Affinity's hosted MCP server, built
on [plugin-contract](https://github.com/we-the-rebel-alliance/plugin-contract) v0. It reads
the meetings you took part in as a cursor-based feed and your firm's companies as a list snapshot, and it passes
Affinity's own tools through unchanged, so an agent can search, read and change what you are allowed to see. Several
accounts can be signed in at once, one per Affinity organisation or person.

## Install

```sh
opencode plugin add github:we-the-rebel-alliance/affinity-plugin#v0.0.0
```

`v0.0.0` is the release cut from this pull request. The lead's release bot replaces the earlier published `v0.0.0` at
`fbfa617`, which predates the skill registration. Nothing else is needed: there are no runtime dependencies, and the
built entry is committed, so the install needs no build step.

## Sign in

Install the plugin, then run `/connect` in OpenCode and choose the alias's server: **affinity** for the default
account. One account needs no options at all.

Several accounts, each signed in on its own:

```jsonc
// opencode.json
{
  "plugins": [
    {
      "package": "github:we-the-rebel-alliance/affinity-plugin#v0.0.0",
      "options": {
        "accounts": {
          "work": {},
          "personal": {}
        }
      }
    }
  ]
}
```

Each alias is one Affinity MCP server, `affinity` for the default account and `affinity-<alias>` for the others, and
each is signed in with `/connect`. OpenCode keys the OAuth per server, so two organisations stay apart.

The sign-in asks for the scopes `mcp`, `mcp.read` and `offline_access`: changes, reads, and a refresh token. Without the
profile's `clientId`, OpenCode signs in with its own client metadata document; an Affinity admin may first have to add
OpenCode's client URL under Settings, Manage Apps. A profile's `clientId` (a UUID) signs in as your organisation's own
Public OAuth app instead.

## Skills

The plugin ships two skills, and OpenCode loads both when the plugin starts: `affinity` for reads and
`affinity-write` for changes. `affinity` says when to use the plugin, how to find a company, a person or a deal, how to
pick an account and what the quota allows. `affinity-write` says what a change reaches — the firm's shared CRM, the
organisation, a colleague or Affinity itself — and when to ask before a delete or a merge.

## Options

| Option | Default | What it does |
|---|---|---|
| `access` | `all` | how much may run: `all`, `ask-changes` or `read-only` |
| `accounts` | one `default` account | one profile per alias; its `clientId` signs in as your organisation's own OAuth app |
| `allowUntestedHost` | `false` | start outside the tested OpenCode range; for testing only |

[Configuration](docs/configuration.md) has every field and a full example.

## Access levels

`options.access` is the ceiling for everything the plugin does, and only the plugin's own methods and Affinity's
pass-through tools use it.

| Level           | Reads | Changes   |
| --------------- | ----- | --------- |
| `all` (default) | run   | run       |
| `ask-changes`   | run   | ask first |
| `read-only`     | run   | are off   |

Affinity's pass-through tools are classified one by one: 68 read, 22 write, 1 send, 1 share, 10 delete and 1 export.
`send_feedback` is one you offer only when the user asks for it: the hosted server may suggest it, and this plugin's
namespace says not to. Every change reaches the firm's shared CRM, and every call shares the firm's monthly API quota.

## Capabilities

<!-- generated:capabilities -->
### Methods

| Method | Class | Accounts | Operations |
|---|---|---|---|
| `status` | read | none | — |
| `events_list` | read | optional | `get_current_user`, `get_meetings`, `search_all_companies` |
| `probe` | read | optional | `get_current_user` |
| `mcp:get_current_user` | read | none | `get_current_user` |
| `mcp:search_companies_top_matches` | read | none | `search_companies_top_matches` |
| `mcp:search_all_companies` | read | none | `search_all_companies` |
| `mcp:get_company_info` | read | none | `get_company_info` |
| `mcp:get_company_list_entries` | read | none | `get_company_list_entries` |
| `mcp:get_merge_task` | read | none | `get_merge_task` |
| `mcp:render_market_map` | read | none | `render_market_map` |
| `mcp:get_entity_fields` | read | none | `get_entity_fields` |
| `mcp:get_list_fields` | read | none | `get_list_fields` |
| `mcp:get_list_field_dropdown_options` | read | none | `get_list_field_dropdown_options` |
| `mcp:get_entity_field_dropdown_options` | read | none | `get_entity_field_dropdown_options` |
| `mcp:get_field_value_changes` | read | none | `get_field_value_changes` |
| `mcp:get_investor_executive_connections` | read | none | `get_investor_executive_connections` |
| `mcp:get_coworker_connections` | read | none | `get_coworker_connections` |
| `mcp:get_lists` | read | none | `get_lists` |
| `mcp:get_single_list_entry` | read | none | `get_single_list_entry` |
| `mcp:get_list_info` | read | none | `get_list_info` |
| `mcp:search_list_entries` | read | none | `search_list_entries` |
| `mcp:get_meetings` | read | none | `get_meetings` |
| `mcp:get_meetings_for_entity` | read | none | `get_meetings_for_entity` |
| `mcp:query_notes` | read | none | `query_notes` |
| `mcp:get_notes_for_entity` | read | none | `get_notes_for_entity` |
| `mcp:get_entities_attached_to_note` | read | none | `get_entities_attached_to_note` |
| `mcp:search_notes` | read | none | `search_notes` |
| `mcp:get_entity_files` | read | none | `get_entity_files` |
| `mcp:get_entity_file_metadata` | read | none | `get_entity_file_metadata` |
| `mcp:search_files` | read | none | `search_files` |
| `mcp:search_opportunities` | read | none | `search_opportunities` |
| `mcp:search_persons` | read | none | `search_persons` |
| `mcp:get_person_info` | read | none | `get_person_info` |
| `mcp:get_persons_info` | read | none | `get_persons_info` |
| `mcp:get_person_list_entries` | read | none | `get_person_list_entries` |
| `mcp:get_person_relationships` | read | none | `get_person_relationships` |
| `mcp:get_company_relationships` | read | none | `get_company_relationships` |
| `mcp:get_reminders` | read | none | `get_reminders` |
| `mcp:get_saved_views` | read | none | `get_saved_views` |
| `mcp:get_saved_view_list_entries` | read | none | `get_saved_view_list_entries` |
| `mcp:get_transcript_fragments` | read | none | `get_transcript_fragments` |
| `mcp:get_users` | read | none | `get_users` |
| `mcp:render_warm_intro_graph` | read | none | `render_warm_intro_graph` |
| `mcp:create_company` | write | none | `create_company` |
| `mcp:send_feedback` | send | none | `send_feedback` |
| `mcp:create_field` | write | none | `create_field` |
| `mcp:create_list_field_dropdown_option` | write | none | `create_list_field_dropdown_option` |
| `mcp:create_interaction` | write | none | `create_interaction` |
| `mcp:create_list` | share | none | `create_list` |
| `mcp:create_list_entry` | write | none | `create_list_entry` |
| `mcp:create_note` | write | none | `create_note` |
| `mcp:create_opportunity` | write | none | `create_opportunity` |
| `mcp:create_person` | write | none | `create_person` |
| `mcp:create_reminder` | write | none | `create_reminder` |
| `mcp:update_company` | write | none | `update_company` |
| `mcp:delete_company` | delete | none | `delete_company` |
| `mcp:merge_companies` | delete | none | `merge_companies` |
| `mcp:update_list_field_dropdown_option` | write | none | `update_list_field_dropdown_option` |
| `mcp:delete_list_field_dropdown_option` | delete | none | `delete_list_field_dropdown_option` |
| `mcp:delete_list_entries` | delete | none | `delete_list_entries` |
| `mcp:upsert_entity_field_values` | write | none | `upsert_entity_field_values` |
| `mcp:upsert_list_entry_field_values` | write | none | `upsert_list_entry_field_values` |
| `mcp:update_note` | write | none | `update_note` |
| `mcp:delete_note` | delete | none | `delete_note` |
| `mcp:update_opportunity` | write | none | `update_opportunity` |
| `mcp:delete_opportunity` | delete | none | `delete_opportunity` |
| `mcp:update_person` | write | none | `update_person` |
| `mcp:delete_person` | delete | none | `delete_person` |
| `mcp:merge_persons` | delete | none | `merge_persons` |
| `mcp:update_reminder` | write | none | `update_reminder` |
| `mcp:delete_reminder` | delete | none | `delete_reminder` |
| `mcp:issue_entity_files_upload_token` | write | none | `issue_entity_files_upload_token` |
| `mcp:issue_entity_files_download_token` | export | none | `issue_entity_files_download_token` |
| `mcp:affinity_data_migration` | read | none | `affinity_data_migration` |
| `mcp:affinity_event_setup` | read | none | `affinity_event_setup` |
| `mcp:affinity_lp_pipeline_brief` | read | none | `affinity_lp_pipeline_brief` |
| `mcp:affinity_meeting_prep` | read | none | `affinity_meeting_prep` |
| `mcp:affinity_missed_deal_review` | read | none | `affinity_missed_deal_review` |
| `mcp:affinity_reference_check` | read | none | `affinity_reference_check` |
| `mcp:company_signals` | read | none | `company_signals` |
| `mcp:crm_audit` | read | none | `crm_audit` |
| `mcp:customer_ready_to_raise` | read | none | `customer_ready_to_raise` |
| `mcp:market_map_generator` | read | none | `market_map_generator` |
| `mcp:portfolio_attention_score` | read | none | `portfolio_attention_score` |
| `mcp:warm_intro` | read | none | `warm_intro` |
| `mcp:get_calls` | read | none | `get_calls` |
| `mcp:get_chat_messages` | read | none | `get_chat_messages` |
| `mcp:get_emails` | read | none | `get_emails` |
| `mcp:get_interactions_for_entity` | read | none | `get_interactions_for_entity` |
| `mcp:get_intro_paths` | read | none | `get_intro_paths` |
| `mcp:render_intro_paths_graph` | read | none | `render_intro_paths_graph` |
| `mcp:get_opportunities_info` | read | none | `get_opportunities_info` |
| `mcp:get_suggested_field_updates` | read | none | `get_suggested_field_updates` |
| `mcp:get_suggested_field_updates_task` | read | none | `get_suggested_field_updates_task` |
| `mcp:list_suggested_field_updates` | read | none | `list_suggested_field_updates` |
| `mcp:list_suggested_field_updates_tasks` | read | none | `list_suggested_field_updates_tasks` |
| `mcp:data_quality_audit` | read | none | `data_quality_audit` |
| `mcp:founder_references` | read | none | `founder_references` |
| `mcp:passed_deal_review` | read | none | `passed_deal_review` |
| `mcp:portfolio_check_in` | read | none | `portfolio_check_in` |
| `mcp:ready_to_raise_indicator` | read | none | `ready_to_raise_indicator` |
| `mcp:update_field` | write | none | `update_field` |
| `mcp:apply_suggested_field_updates` | write | none | `apply_suggested_field_updates` |
| `mcp:dismiss_suggested_field_updates` | write | none | `dismiss_suggested_field_updates` |
| `mcp:suggest_field_updates` | write | none | `suggest_field_updates` |
| `mcp:delete_field` | delete | none | `delete_field` |

### Sources

| Source | Kind | Reads or output | Method | Cost |
|---|---|---|---|---|
| `affinity.meetings` | events | `meeting` | `events_list` | metered |
| `affinity.companies` | snapshot | `list` | `events_list` | metered |

### Actions

None.

### Bus events

None.
<!-- /generated:capabilities -->

## Errors

Every failure reads `CODE: What happened. Next step: What to do.`

<!-- generated:errors -->
| Code | Meaning |
|---|---|
| `NEEDS_SIGN_IN` | the account is not signed in |
| `SCOPE_MISSING` | the call needs a scope the person has not confirmed |
| `ACCOUNT_REQUIRED` | the plugin serves several accounts and the call names none |
| `ACCOUNT_UNKNOWN` | the call names an alias the plugin does not serve |
| `ACCOUNT_MISMATCH` | the item belongs to another account |
| `CURSOR_INVALID` | the cursor is malformed, or belongs to another source, account or scope |
| `CURSOR_EXPIRED` | the provider no longer keeps the history the cursor names |
| `RATE_LIMITED` | the provider asked the plugin to slow down |
| `BUDGET_EXCEEDED` | the read would cost more than the person allows |
| `SOURCE_DISABLED` | the person turned this source or action off |
| `TOO_LARGE` | the answer is larger than the source's maxBytes |
| `INPUT_INVALID` | the input does not match the method's schema |
| `SOURCE_UNKNOWN` | the plugin declares no such source |
| `SCHEMA_VIOLATION` | an answer does not keep the contract's shape |
| `PERMISSION_DENIED` | the person's grant does not cover the call |
| `PLAN_INVALID` | the plan is missing, or belongs to another method |
| `PLAN_USED` | the plan was already used by an earlier commit |
| `GRANT_INVALID` | the action grant did not verify, or was already spent |
| `HOST_UNTESTED` | OpenCode is outside the plugin's tested range |
| `OPTIONS_INVALID` | the plugin's options do not match their schema |
| `UNAVAILABLE` | the provider could not be reached |
<!-- /generated:errors -->

The skill loader uses the contract's `SCHEMA_VIOLATION` code: a bundled `skills/<id>/SKILL.md` whose frontmatter is
not valid YAML, or has no name or description or an empty body, fails setup with the file's path and a next step. The
frontmatter is parsed as YAML, so `>` and `|` block-scalar descriptions register their text, not the marker.

## Troubleshooting

- **`NEEDS_SIGN_IN`**: the alias's MCP server has no sign-in. Run `/connect` and choose that server (`affinity`,
  `affinity-work`, …), then call again.
- **`ACCOUNT_REQUIRED`**: more than one alias is configured and the call named none. Pass `account`; the refusal's next
  step lists the aliases. `ACCOUNT_UNKNOWN` means the alias is not one `options.accounts` declares.
- **`Unknown client_id` at sign-in**: an Affinity admin must add OpenCode's client URL under Settings, Manage Apps, or
  the alias's profile sets `clientId` to your organisation's own Public OAuth app.
- **`RATE_LIMITED`**: Affinity refused the call for a burst limit or the firm's shared monthly API quota. Wait, do not
  retry in a loop, and ask an Affinity admin if it says the monthly quota.
- **`CURSOR_INVALID`**: a cursor belongs to the account and source that issued it. Pass it with the same `account`, or
  start again with `since`.
- **`HOST_UNTESTED`**: OpenCode is outside the plugin's tested range (`>=2.4.1 <2.5.0`). Pin a supported release.
- **`SCHEMA_VIOLATION` from setup**: a bundled `skills/<id>/SKILL.md` has invalid YAML, a missing name or description,
  or an empty body. The error names the file and the next step; fix the skill file, then reload the plugin.
- **An alias that stays in error**: its MCP server is missing, disabled or failed. Check `options.accounts`, then reload
  the plugin; `status` (`tools.affinity.status` in Code Mode) names the state and the next step.

## Documentation

- [plugin-contract](https://github.com/we-the-rebel-alliance/plugin-contract): the manifest, doors, events and error
  table this plugin implements.
- [Capabilities](docs/capabilities.md): the sources, the methods and what each one reads.
- [Accounts](docs/accounts.md): aliases, profiles and signing in.
- [Configuration](docs/configuration.md): every option and an example.
- [Architecture](docs/architecture.md): the layers, the provider, the skills and what is cached.
- [Automations](docs/automations.md): collecting meetings with an OpenCode automation.
- [Security](docs/security.md): what leaves the machine, the scopes, and redaction.
- [Contributing](CONTRIBUTING.md) and [Security policy](SECURITY.md).

Affinity and the Affinity logo are trademarks of Affinity. This plugin is not affiliated with or endorsed by Affinity.
