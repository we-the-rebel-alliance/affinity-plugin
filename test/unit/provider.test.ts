/**
 * The provider client: the alias's own server, the vendor tool's derived id, and the contract's error codes.
 *
 * These are the paths a real host takes too: `ctx.tool.list()` and `tool.execute` over the server that `accountName`
 * derived, so a rule for one alias's tools never matches another alias's.
 */
import { Error as ToolError } from "@opencode/plugin/promise/tool"
import { toolAction } from "@we-the-rebel-alliance/plugin-contract/access"
import { accountName } from "@we-the-rebel-alliance/plugin-contract/accounts"
import { describe, expect, test } from "vitest"
import { OAUTH_SCOPE, serverConfig, serverName } from "../../src/accounts.ts"
import { createProvider, mcpServerUrl, type ProviderContext } from "../../src/provider/index.ts"
import { fakeContext, NOW } from "../conformance/fake.ts"
import { callOf, refusalOf } from "./helpers.ts"

const AT = callOf("work")
/** A bearer token, assembled at runtime so the file holds no credential-shaped literal. */
const BEARER = ["Kq7T", "z2Lm", "9Rp4", "Vw8B", "n3Cd"].join("")

/** A context with one tool that throws what a test names, for the paths the fake transport does not model. */
function throwingContext(error: unknown): ProviderContext {
  return {
    tool: { list: async () => [{ id: toolAction("affinity-work", "get_meetings"), execute: async () => Promise.reject(error) }] },
    mcp: {
      list: async () => ({
        data: [
          { name: "affinity-work", status: { status: "connected" } },
          { name: "affinity-personal", status: { status: "connected" } }
        ]
      })
    }
  } as unknown as ProviderContext
}

describe("the provider", () => {
  test("names the endpoint once, for every alias", () => {
    expect(mcpServerUrl()).toBe("https://mcp.affinity.co/mcp")
    expect(mcpServerUrl()).toBe("https://mcp.affinity.co/mcp")
  })

  test("derives one server per alias", () => {
    expect(accountName("affinity", "default")).toBe("affinity")
    expect(serverName("default")).toBe("affinity")
    expect(serverName("work")).toBe("affinity-work")
    expect(serverName("personal")).toBe("affinity-personal")
  })

  test("sets the pinned scope, and the profile's client id only when it has one", () => {
    expect(serverConfig({})).toEqual({ type: "remote", url: "https://mcp.affinity.co/mcp", oauth: { scope: OAUTH_SCOPE } })
    const clientId = "5d8b4c1e-7a2f-4d3b-9c6e-1f0a2b3c4d5e"
    expect(serverConfig({ clientId })).toEqual({
      type: "remote",
      url: "https://mcp.affinity.co/mcp",
      oauth: { client_id: clientId, scope: "mcp mcp.read offline_access" }
    })
  })

  test("calls the alias's own server and tool, never another alias's", async () => {
    const fake = fakeContext()
    const provider = createProvider(fake.ctx)
    const answer = await provider.call("personal", "get_current_user", {}, callOf("personal"))
    expect(fake.calls.map((entry) => entry.alias)).toEqual(["personal"])
    expect(answer.output).toMatchObject({ tenant: { id: 9001 } })
    // The ids the provider looked up are the ones the contract derives: affinity-personal_get_current_user.
    expect(toolAction(serverName("personal"), "get_current_user")).toBe("affinity-personal_get_current_user")
  })

  test("answers each alias from its own server", async () => {
    const fake = fakeContext()
    const provider = createProvider(fake.ctx)
    const work = await provider.call("work", "get_current_user", {}, AT)
    const personal = await provider.call("personal", "get_current_user", {}, callOf("personal"))
    expect(work.output).toMatchObject({ tenant: { id: 4821 } })
    expect(personal.output).toMatchObject({ tenant: { id: 9001 } })
  })

  test("refuses a server that needs a sign-in with NEEDS_SIGN_IN and the alias to sign in", async () => {
    const fake = fakeContext({ state: "needs_auth" })
    const provider = createProvider(fake.ctx)
    const message = await refusalOf(() => provider.call("work", "get_meetings", {}, AT))
    expect(message).toMatch(/^NEEDS_SIGN_IN: /)
    expect(message).toContain("affinity-work")
    expect(message).toContain("/connect")
    expect(message).toContain("Next step: ")
    expect(fake.calls).toEqual([])
  })

  test("refuses a missing server with UNAVAILABLE, a state and a next step", async () => {
    const fake = fakeContext({ state: "missing" })
    const message = await refusalOf(() => createProvider(fake.ctx).call("work", "get_meetings", {}, AT))
    expect(message).toMatch(/^UNAVAILABLE: /)
    expect(message).toContain("affinity-work")
    expect(message).toContain("no server")
    expect(message).toContain("Next step: ")
  })

  for (const state of ["failed", "disabled", "pending"] as const) {
    test(`refuses a ${state} server with UNAVAILABLE rather than waiting on it`, async () => {
      const fake = fakeContext({ state })
      const message = await refusalOf(() => createProvider(fake.ctx).call("work", "get_meetings", {}, AT))
      expect(message).toMatch(/^UNAVAILABLE: /)
      expect(message).toContain(state)
      expect(fake.calls).toEqual([])
    })
  }

  test("refuses a connected server that lists no such tool", async () => {
    const provider = createProvider({
      tool: { list: async () => [] },
      mcp: { list: async () => ({ data: [{ name: "affinity-work", status: { status: "connected" } }] }) }
    } as unknown as ProviderContext)
    const message = await refusalOf(() => provider.call("work", "get_meetings", {}, AT))
    expect(message).toMatch(/^UNAVAILABLE: /)
    expect(message).toContain("affinity-work_get_meetings")
  })

  test("maps Affinity's rate limit to RATE_LIMITED, one redacted line with its request id", async () => {
    const fake = fakeContext({ fail: { tool: "get_meetings", message: "Rate limit exceeded for this organisation" } })
    const message = await refusalOf(() => createProvider(fake.ctx).call("work", "get_meetings", {}, AT))
    expect(message).toMatch(/^RATE_LIMITED: /)
    expect(message).toContain("req_0001_get_meetings")
    expect(message).toContain("Next step: ")
    expect(message.split("\n")).toHaveLength(1)
  })

  test("maps a missing scope to SCOPE_MISSING", async () => {
    const fake = fakeContext({ fail: { tool: "get_meetings", message: "Insufficient scope for this call" } })
    const message = await refusalOf(() => createProvider(fake.ctx).call("work", "get_meetings", {}, AT))
    expect(message).toMatch(/^SCOPE_MISSING: /)
    expect(message).toContain("mcp scope")
  })

  test("maps any other vendor failure to UNAVAILABLE and never leaks a token", async () => {
    const fake = fakeContext({ fail: { tool: "get_meetings", message: `Bad request: token Bearer ${BEARER} is expired` } })
    const message = await refusalOf(() => createProvider(fake.ctx).call("work", "get_meetings", {}, AT))
    expect(message).toMatch(/^UNAVAILABLE: /)
    expect(message).not.toContain(BEARER)
    expect(message).toContain("Bearer …")
  })

  test("maps a permission refusal to PERMISSION_DENIED", async () => {
    const provider = createProvider(throwingContext(new ToolError({ message: "the rule says ask", error: { tag: "Permission.BlockedError" } })) as unknown as ProviderContext)
    const message = await refusalOf(() => provider.call("work", "get_meetings", {}, AT))
    expect(message).toMatch(/^PERMISSION_DENIED: /)
    expect(message).toContain("affinity-work_get_meetings")
  })

  test("answers a call cancelled before it starts with the caller's own cancellation", async () => {
    const fake = fakeContext()
    const controller = new AbortController()
    controller.abort(new Error("stopped by the person"))
    const message = await refusalOf(() => createProvider(fake.ctx).call("work", "get_meetings", {}, callOf("work", { signal: controller.signal })))
    expect(message).toBe("stopped by the person")
    expect(fake.calls).toEqual([])
  })

  test("reads a server's state without a provider call", async () => {
    const fake = fakeContext()
    const provider = createProvider(fake.ctx)
    expect(await provider.serverState("work")).toEqual({ name: "affinity-work", state: "connected" })
    expect(await provider.serverState("personal")).toEqual({ name: "affinity-personal", state: "connected" })
    expect(fake.calls).toEqual([])
  })

  test("keeps the clock out of the provider: nothing time-dependent is read", () => {
    expect(NOW).toBe(Date.parse("2026-11-13T12:00:00.000Z"))
    expect(Object.keys(createProvider(fakeContext().ctx))).toEqual(["serverState", "call"])
  })
})
