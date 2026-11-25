# Capabilities

What this plugin can do, declared in `package.json`'s `capabilities` and checked by `plugin-kit check`. The tables below
are generated from the manifest.

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

`rpc.affinity.changed`
<!-- /generated:capabilities -->

## Sources

### `affinity.meetings` — meetings you took part in

An events source, read by `events_list` (`tools.affinity.events_list`) with `source: "affinity"`. A meeting is listed
once it started an hour ago, oldest first. An event carries the meeting's id, its start, its title and the people
Affinity matched to a person record — their Affinity person id and name, as `affinity:person/<id>`. It carries no notes,
no transcript, no email address, no phone number and no relationship score: `text` is empty, `url` is null and `labels`
is empty, because Affinity's meeting has none of them. A title that holds a credential is refused (`refused[]`, reason
`secret`) rather than delivered.

Affinity lists every meeting you may see, colleagues' included. A listing keeps only the meetings you organised,
created or attended, as far as Affinity's attendee preview shows; the address that tells them apart stays in memory and
never reaches an event, a page or status.

The source reads back 90 days by choice, to bound the firm's monthly API quota. An older `since` starts there and says
so once with `gap: { reason: "window-truncated" }`; a cursor older than 100 days restarts there with
`gap: { reason: "expired" }`. A listing makes at most 10 `get_meetings` calls and carries on from its cursor, so a
backfill drains over several listings. `cost` reports the Affinity calls the page made.

### `affinity.companies` — the firm's companies as a list

A snapshot, `output: "list"`, read by the same `events_list` with `source: "affinity"` and `list: "companies"`: the
first page of the firm's companies, up to 50, from one `search_all_companies` call. Each item is the company's id, its
name and, as a note, its primary domain. A name or domain that holds a credential is left out. The list is not editable.

Both sources share one service, **CRM**: a person turns the whole CRM off, not one of its reads.

## Methods

The plugin's own three methods are `status`, `events_list` and `probe`; every other row is one of Affinity's 103 MCP
tools, passed through unchanged. A pass-through tool has no handler here: Affinity's server owns its input and its
answer, and the plugin only classifies it so an app knows how risky it is before it runs. A tool Affinity adds later is
not a method until someone classifies it, so it stays out of agent prompts.

`probe` reads who is signed in for an alias, from one `get_current_user` call: the owner is
`affinity:user:<id>`, labelled with the person's name and organisation, plus the sign-in's scopes. It reads no content.

`status` reads no Affinity data: one entry per alias, from the alias's own MCP server state.

## Nothing is an action

The manifest declares no `actions`. Every change is one of Affinity's own tools, classified `write`, `send`, `share`,
`delete` or `export`, and gated by OpenCode's permission rules. There is no plan/commit pair to preview: Affinity's own
tools take a `confirm: false` flag inside the same call where they support a preview, which is Affinity's input, not
this plugin's.

## The bus

One event, `changed`, emitted after a completed non-read pass-through call for the alias whose server ran it. See
[architecture](architecture.md) for the one tool hook and why it adds no model text.
