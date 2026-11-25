/**
 * `probe` and `status` (contract §11): the owner a probe reads, and one state per alias without a provider call.
 */
import { STATUS_SCHEMA } from "@we-the-rebel-alliance/plugin-contract/accounts"
import { PROBE_SCHEMA } from "@we-the-rebel-alliance/plugin-contract/events"
import { describe, expect, test } from "vitest"
import { createProvider } from "../../src/provider/index.ts"
import { fakeContext } from "../conformance/fake.ts"
import { callOf, handlersFor, profiles, refusalOf, tableFor } from "./helpers.ts"

/** The probe answer, and the status answer, as the tests read them. */
type ProbeAnswer = { source: string; account: string; owner: { id: string; label: string }; scopes?: string[]; trust: string }
type StatusAnswer = {
  name: string
  version: string
  host: { version: string; range: string; tested: string[] }
  state: string
  accounts: { alias: string; state: string; reason?: string }[]
  unguardedAgents: string[]
  nextStep: string | null
}

describe("probe", () => {
  test("answers the provider-confirmed owner, the alias and the sign-in's scopes, and no content", async () => {
    const { handlers } = handlersFor()
    const answer = (await handlers.probe.run({}, callOf("work"))) as ProbeAnswer
    expect(answer).toEqual({
      source: "affinity",
      account: "work",
      owner: { id: "affinity:user:77", label: "Pilot Owner (Example Ventures)" },
      scopes: ["mcp", "mcp.read", "offline_access"],
      trust: "untrusted"
    })
    expect(Object.keys(answer).sort()).toEqual(["account", "owner", "scopes", "source", "trust"])
    expect(PROBE_SCHEMA).toBeDefined()
    expect(JSON.stringify(answer)).not.toContain("@example")
  })

  test("answers the personal alias from its own server", async () => {
    const { handlers, calls } = handlersFor()
    const answer = (await handlers.probe.run({}, callOf("personal"))) as { account: string; owner: { id: string }; scopes: string[] }
    expect(answer.account).toBe("personal")
    expect(answer.owner.id).toBe("affinity:user:88")
    expect(answer.scopes).toEqual(["mcp.read"])
    expect(calls.map((call) => call.alias)).toEqual(["personal"])
  })

  test("refuses an answer that names no organisation, user and address", async () => {
    const transport = fakeContext({ unreadableUser: JSON.stringify({ user: { id: 77 } }) })
    const table = tableFor({ provider: createProvider(transport.ctx), hostVersion: "2.4.1", accountProblems: [], profiles: profiles() })
    const message = await refusalOf(() => table.probe.run({}, callOf("work")))
    expect(message).toMatch(/^UNAVAILABLE: /)
    expect(message).toContain("get_current_user")
  })

  test("refuses a server that needs a sign-in with NEEDS_SIGN_IN", async () => {
    const { handlers } = handlersFor({ state: "needs_auth" })
    expect(await refusalOf(() => handlers.probe.run({}, callOf("work")))).toMatch(/^NEEDS_SIGN_IN: /)
  })
})

describe("status", () => {
  test("answers one ready entry per alias without reading any Affinity data", async () => {
    const { handlers, calls } = handlersFor()
    const answer = (await handlers.status.run({}, callOf("work"))) as StatusAnswer
    expect(Object.keys(answer).sort()).toEqual(["accounts", "host", "name", "nextStep", "state", "unguardedAgents", "version"])
    expect(STATUS_SCHEMA).toBeDefined()
    expect(answer).toMatchObject({
      name: "affinity",
      version: "0.0.8",
      host: { version: "2.4.1", range: ">=2.4.1 <2.5.0", tested: ["2.4.1"] },
      state: "ready",
      accounts: [
        { alias: "work", state: "ready" },
        { alias: "personal", state: "ready" }
      ],
      unguardedAgents: [],
      nextStep: null
    })
    expect(calls).toEqual([])
  })

  test("marks a server that needs a sign-in, and one that failed, with a redacted one-line reason", async () => {
    const auth = (await handlersFor({ state: "needs_auth" }).handlers.status.run({}, callOf("work"))) as StatusAnswer
    expect(auth).toMatchObject({
      state: "needs_sign_in",
      accounts: [
        { alias: "work", state: "needs_sign_in" },
        { alias: "personal", state: "needs_sign_in" }
      ]
    })
    expect(typeof auth.nextStep).toBe("string")

    const failed = (await handlersFor({ state: "failed" }).handlers.status.run({}, callOf("work"))) as StatusAnswer
    expect(failed.state).toBe("error")
    expect(failed.accounts[0]).toMatchObject({ alias: "work", state: "error" })
    const reason = failed.accounts[0]?.reason ?? ""
    expect(reason.length).toBeLessThanOrEqual(160)
    expect(reason).not.toMatch(/[\r\n]/)
  })

  test("marks a missing server as an error with the next step, not as ready", async () => {
    const answer = (await handlersFor({ state: "missing" }).handlers.status.run({}, callOf("work"))) as StatusAnswer
    expect(answer.state).toBe("error")
    expect(answer.accounts[0]?.reason).toContain("no MCP server")
    expect(answer.nextStep).toContain("no MCP server")
  })

  test("treats an unreadable agent list as unknown, never as zero", async () => {
    const { handlers } = handlersFor()
    const answer = (await handlers.status.run({}, callOf("work", { unguarded: async () => ({ ok: false, error: "the agent list could not be read" }) }))) as StatusAnswer
    expect(answer.state).toBe("error")
    expect(answer.nextStep).toBe("the agent list could not be read")
    expect(answer.unguardedAgents).toEqual([])
  })

  test("names the agents whose rules no longer carry every generated rule", async () => {
    const { handlers } = handlersFor()
    const answer = (await handlers.status.run({}, callOf("work", { unguarded: async () => ({ ok: true, agents: ["plan"] }) }))) as StatusAnswer
    expect(answer.unguardedAgents).toEqual(["plan"])
  })

  test("reports a problem setup recorded, redacted to one line", async () => {
    const transport = fakeContext()
    const table = tableFor({
      provider: createProvider(transport.ctx),
      hostVersion: "2.4.1",
      accountProblems: ["the accounts option could not be read: https://example.test/x?token=abcdefghijklmnop"],
      profiles: profiles()
    })
    const answer = (await table.status.run({}, callOf("work"))) as StatusAnswer
    expect(answer.state).toBe("error")
    expect(answer.nextStep).toContain("token=…")
  })

  test("lists no account when the options could not be read", async () => {
    const transport = fakeContext()
    const table = tableFor({ provider: createProvider(transport.ctx), hostVersion: "2.4.1", accountProblems: ["capabilities.options.accounts: bad"], profiles: [] })
    const answer = (await table.status.run({}, callOf("work"))) as StatusAnswer
    expect(answer).toMatchObject({ state: "error", accounts: [] })
  })
})
