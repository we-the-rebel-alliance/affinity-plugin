/**
 * The built bundle in the real OpenCode 2.4.1 host (the kit's `createHost`): its id, its namespace, its three tools,
 * its RPC methods, its per-alias access rules and a status that validates.
 *
 * The kit's T1 is the hard gate and runs the same host; this test keeps a fast, readable proof beside it, and it is the
 * one place a test asserts what a person's agent actually sees.
 */

import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { evaluate } from "@we-the-rebel-alliance/plugin-contract/access"
import { createHost } from "@we-the-rebel-alliance/plugin-contract/kit"
import { afterAll, describe, expect, test } from "vitest"
import { manifest } from "../../src/manifest.ts"

const DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OPTIONS = { access: "all", accounts: { work: {}, personal: {} } }
const OPEN = [{ action: "*", resource: "*", effect: "allow" as const }]

const host = await createHost({ directory: DIRECTORY, version: "2.4.1", pluginId: "affinity", options: OPTIONS })
afterAll(async () => {
  await host.close()
})

describe("the plugin on OpenCode 2.4.1", () => {
  test("loads under its manifest's name and namespace", () => {
    expect(host.failure).toBeUndefined()
    expect(host.refusal).toBeUndefined()
    expect(host.definition?.id).toBe("affinity")
    expect(host.namespace).toEqual({ name: "affinity", description: manifest.plugin.summary })
  })

  test("registers exactly its own three methods as tools, and every one in Code Mode", () => {
    expect(host.tools.map((tool) => tool.id).sort()).toEqual(["affinity_events_list", "affinity_probe", "affinity_status"])
    for (const tool of host.tools) {
      expect(tool.namespace).toBe("affinity")
      expect(tool.permission).toMatch(/^affinity\.(events_list|probe|status)$/)
      expect(tool.codemode).not.toBe(false)
    }
  })

  test("registers the same three methods over RPC, with no bus event", () => {
    expect(host.rpc?.id).toBe("affinity")
    expect([...(host.rpc?.methods ?? [])].sort()).toEqual(["events_list", "probe", "status"])
    expect(host.rpc?.events).toEqual([])
  })

  test("answers status over RPC with a validating answer", async () => {
    const answer = await host.call("status", {}, { rules: OPEN })
    expect(answer.ok).toBe(true)
    if (!answer.ok) return
    const status = answer.output as { name: string; version: string; host: unknown; state: string; accounts: { alias: string; state: string }[]; nextStep: string | null }
    expect(status.name).toBe("affinity")
    expect(status.version).toBe("0.0.1")
    expect(status.host).toEqual({ version: "2.4.1", range: ">=2.4.1 <2.5.0", tested: ["2.4.1"] })
    // No Affinity sign-in exists in this host: the honest state is "sign in", and a host that is still connecting says ready.
    expect(["ready", "needs_sign_in"]).toContain(status.state)
    expect(status.accounts.map((account) => account.alias)).toEqual(["work", "personal"])
    for (const account of status.accounts) expect(["ready", "needs_sign_in"]).toContain(account.state)
    if (status.state === "needs_sign_in") expect(typeof status.nextStep).toBe("string")
  })

  test("asks for the account over RPC, and refuses an alias it does not serve", async () => {
    const missing = await host.call("events_list", {}, { rules: OPEN })
    expect(missing).toMatchObject({ ok: false, code: "ACCOUNT_REQUIRED" })
    const unknown = await host.call("events_list", { account: "nobodyhere" }, { rules: OPEN })
    expect(unknown).toMatchObject({ ok: false, code: "ACCOUNT_UNKNOWN" })
  })

  test("puts the method's action and its operations through the host's real permission gate", async () => {
    // No Affinity server is connected in this host, so the handler refuses after the gate: a refusal that is not
    // PERMISSION_DENIED proves the gate allowed `<alias>:<operation>` under an allow rule.
    const allowed = await host.call("events_list", { account: "work" }, { rules: OPEN })
    expect(allowed.ok).toBe(false)
    if (!allowed.ok) expect(allowed.code).not.toBe("PERMISSION_DENIED")

    const denied = await host.call("events_list", { account: "work" }, { rules: [{ action: "affinity.events_list", resource: "*", effect: "deny" }] })
    expect(denied).toMatchObject({ ok: false, code: "PERMISSION_DENIED" })
  })

  test("installs per-alias access rules, so a read runs and a write is off at read-only", { timeout: 30_000 }, async () => {
    const rules = host.agents.find((agent) => agent.id === "build")?.permissions ?? []
    expect(rules.length).toBeGreaterThan(0)
    expect(evaluate(rules, "affinity.events_list", "*")).toBe("allow")
    expect(evaluate(rules, "affinity-work_create_company", "*")).toBe("allow")
    expect(evaluate(rules, "affinity-personal_delete_company", "*")).toBe("allow")

    const readOnly = await createHost({ directory: DIRECTORY, version: "2.4.1", pluginId: "affinity", options: { ...OPTIONS, access: "read-only" } })
    try {
      const held = readOnly.agents.find((agent) => agent.id === "build")?.permissions ?? []
      expect(evaluate(held, "affinity.events_list", "*")).toBe("allow")
      expect(evaluate(held, "affinity-work_create_company", "*")).toBe("deny")
      expect(evaluate(held, "affinity-work_send_feedback", "*")).toBe("deny")
    } finally {
      await readOnly.close()
    }
  })
})
