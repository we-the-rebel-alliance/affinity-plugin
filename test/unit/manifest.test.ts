/**
 * The manifest: valid under `checkManifest`, complete against the recorded vendor tool list, and classified as the
 * inventory classifies it (contract §§4, 6, 7, 8, 16).
 *
 * The recorded list is the live tool list the phase-0.5 inventory captured (`test/unit/affinity-tools-list.json`, 103
 * tools with their annotations). This test is what keeps the manifest and the vendor's server in step: a tool Affinity
 * adds stays out of agent prompts until someone classifies it, and a tool it retires cannot linger in the manifest.
 */
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { checkManifest, type Manifest, manifestHash } from "@we-the-rebel-alliance/plugin-contract/manifest"
import { describe, expect, test } from "vitest"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { name: string; version: string; capabilities: Manifest }
const manifest = pkg.capabilities
/** The options schema's properties, as the tests read them. */
const OPTIONS = ((manifest.options as { properties?: Record<string, Record<string, unknown>> }).properties ?? {}) as Record<string, Record<string, unknown>>
const recorded = (
  JSON.parse(readFileSync(join(ROOT, "test", "unit", "affinity-tools-list.json"), "utf8")) as { tools: readonly { name: string; annotations: { readOnlyHint: boolean } }[] }
).tools

/** The inventory's classes for the 35 tools whose `readOnlyHint` is false. */
const NON_READ: Readonly<Record<string, string>> = {
  create_company: "write",
  create_field: "write",
  create_list_field_dropdown_option: "write",
  create_interaction: "write",
  create_list_entry: "write",
  create_note: "write",
  create_opportunity: "write",
  create_person: "write",
  create_reminder: "write",
  issue_entity_files_upload_token: "write",
  update_company: "write",
  update_list_field_dropdown_option: "write",
  upsert_entity_field_values: "write",
  upsert_list_entry_field_values: "write",
  update_note: "write",
  update_opportunity: "write",
  update_person: "write",
  update_reminder: "write",
  update_field: "write",
  apply_suggested_field_updates: "write",
  dismiss_suggested_field_updates: "write",
  suggest_field_updates: "write",
  create_list: "share",
  issue_entity_files_download_token: "export",
  delete_company: "delete",
  delete_list_field_dropdown_option: "delete",
  delete_list_entries: "delete",
  delete_note: "delete",
  delete_opportunity: "delete",
  delete_person: "delete",
  delete_reminder: "delete",
  delete_field: "delete",
  merge_companies: "delete",
  merge_persons: "delete",
  send_feedback: "send"
}

/** The class the inventory gives one vendor tool. */
function classOf(tool: string, readOnly: boolean): string {
  if (readOnly) return "read"
  const held = NON_READ[tool]
  if (held === undefined) throw new Error(`${tool} is not read-only and the inventory does not classify it`)
  return held
}

describe("the manifest", () => {
  test("is a valid v0 manifest", () => {
    const checked = checkManifest(manifest)
    if (!checked.ok) throw new Error(checked.problems.join("\n"))
    expect(checked.ok).toBe(true)
    expect(manifestHash(manifest)).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  test("declares exactly the manifest's own keys", () => {
    expect(Object.keys(manifest).sort()).toEqual(["accounts", "actions", "events", "methods", "options", "plugin", "sources", "version"])
    expect(manifest.version).toBe(1)
    expect(manifest.plugin.name).toBe("affinity")
    expect(manifest.plugin.vendor).toEqual({ id: "affinity", name: "Affinity", domain: "affinity.co" })
    expect(manifest.plugin.host).toEqual({ opencode: ">=2.4.1 <2.5.0", tested: ["2.4.1"] })
    expect(pkg.name).toBe("@we-the-rebel-alliance/affinity-plugin")
    expect(pkg.version).toBe("0.0.0")
  })

  test("keeps the namespace line within the fixed budget", () => {
    expect(manifest.plugin.summary.length).toBeLessThanOrEqual(400)
    expect(manifest.plugin.summary).not.toMatch(/[\r\n]/)
  })

  test("declares the accounts mechanism and the profile's one field", () => {
    expect(manifest.accounts).toEqual({ via: "mcp", profile: { $ref: "#/options/properties/accounts/additionalProperties" }, owner: "affinity" })
    const profile = (OPTIONS["accounts"]?.["additionalProperties"] ?? {}) as Record<string, unknown>
    expect(profile["additionalProperties"]).toBe(false)
    const clientId = ((profile["properties"] ?? {}) as Record<string, Record<string, unknown>>)["clientId"]
    expect(clientId?.["type"]).toBe("string")
    expect(clientId?.["pattern"]).toBe("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
    expect(profile["required"]).toBeUndefined()
  })

  test("offers the three access levels, default all, and refuses an unknown option", () => {
    const options = manifest.options as unknown as Record<string, unknown>
    expect(options["additionalProperties"]).toBe(false)
    const access = (OPTIONS["access"] ?? {}) as Record<string, unknown>
    expect(access["enum"]).toEqual(["all", "ask-changes", "read-only"])
    expect(access["default"]).toBe("all")
    const untested = (OPTIONS["allowUntestedHost"] ?? {}) as Record<string, unknown>
    expect(untested["default"]).toBe(false)
  })

  test("classifies every one of the vendor's 103 tools, and nothing it does not have", () => {
    const vendor = new Set(recorded.map((tool) => tool.name))
    const declared = Object.keys(manifest.methods).filter((method) => method.startsWith("mcp:"))
    expect(declared).toHaveLength(103)
    expect(manifest.methods["mcp:*"]).toBeUndefined()
    expect(new Set(declared.map((method) => method.slice("mcp:".length)))).toEqual(vendor)
    for (const tool of recorded) {
      const row = manifest.methods[`mcp:${tool.name}`]
      expect(row, tool.name).toBeDefined()
      expect(row?.class, tool.name).toBe(classOf(tool.name, tool.annotations.readOnlyHint))
      expect(row?.accounts, tool.name).toBe("none")
      expect(row?.operations, tool.name).toEqual([tool.name])
    }
  })

  test("has 106 rows: 3 own and 103 pass-through, by class", () => {
    expect(Object.keys(manifest.methods)).toHaveLength(106)
    const counts: Record<string, number> = {}
    for (const [method, item] of Object.entries(manifest.methods)) {
      if (!method.startsWith("mcp:")) continue
      counts[item.class] = (counts[item.class] ?? 0) + 1
    }
    expect(counts).toEqual({ read: 68, write: 22, send: 1, share: 1, delete: 10, export: 1 })
    expect(manifest.methods["status"]).toEqual({ class: "read", accounts: "none" })
    expect(manifest.methods["events_list"]).toEqual({ class: "read", accounts: "optional", operations: ["get_current_user", "get_meetings", "search_all_companies"] })
    expect(manifest.methods["probe"]).toEqual({ class: "read", accounts: "optional", operations: ["get_current_user"] })
  })

  test("carries no plans, commits, effect, agent or pinned key", () => {
    for (const [method, item] of Object.entries(manifest.methods)) {
      for (const key of ["plans", "commits", "effect", "agent", "pinned"]) expect(item, `${method}.${key}`).not.toHaveProperty(key)
    }
  })

  test("keeps the inventory's four contested classes", () => {
    expect(manifest.methods["mcp:create_list"]?.class).toBe("share")
    expect(manifest.methods["mcp:issue_entity_files_download_token"]?.class).toBe("export")
    expect(manifest.methods["mcp:issue_entity_files_upload_token"]?.class).toBe("write")
    expect(manifest.methods["mcp:merge_companies"]?.class).toBe("delete")
    expect(manifest.methods["mcp:merge_persons"]?.class).toBe("delete")
    expect(manifest.methods["mcp:update_field"]?.class).toBe("write")
    expect(manifest.methods["mcp:create_field"]?.class).toBe("write")
    expect(manifest.methods["mcp:delete_field"]?.class).toBe("delete")
    expect(manifest.methods["mcp:send_feedback"]?.class).toBe("send")
  })

  test("declares two sources whose operations their method also declares", () => {
    expect(manifest.sources.map((source) => source.id)).toEqual(["affinity.meetings", "affinity.companies"])
    for (const source of manifest.sources) {
      expect(source.service).toEqual({ id: "affinity.crm", label: "CRM" })
      expect(source.cost).toEqual({ class: "metered", units: [{ per: "call", usd: 0 }] })
      expect(source.maxBytes).toBe(65536)
      expect(source.signals).toEqual(["bus"])
      expect(source.private).toBe(true)
      expect(source.scope).toBeUndefined()
      const operations = manifest.methods[source.method]?.operations ?? []
      for (const operation of source.operations ?? []) expect(operations).toContain(operation)
    }
    expect(manifest.sources[0]).toMatchObject({ kind: "events", reads: "meeting", method: "events_list", input: { source: "affinity" }, cadence: { suggestMinutes: 2 } })
    expect(manifest.sources[1]).toMatchObject({
      kind: "snapshot",
      output: "list",
      method: "events_list",
      input: { source: "affinity", list: "companies" },
      cadence: { suggestMinutes: 2 }
    })
  })

  test("writes nothing as an action: every change is a pass-through vendor tool", () => {
    expect(manifest.actions).toEqual([])
    expect(manifest.events).toEqual({ changed: {} })
  })
})
