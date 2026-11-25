/**
 * Every refusal this plugin raises reads `CODE: What happened. Next step: What to do.`, from the contract's table.
 *
 * The matrix walks each failing path once: the server states, the vendor's own failures, an unreadable answer, a bad
 * input, a bad cursor and a truncated window. A refusal with no next step fails here rather than in a person's session.
 */
import { describe, expect, test } from "vitest"
import { createProvider } from "../../src/provider/index.ts"
import { fakeContext } from "../conformance/fake.ts"
import { callOf, handlersFor, profiles, refusalOf, tableFor } from "./helpers.ts"

const FORM = /^[A-Z][A-Z0-9_]*: \S[\s\S]*\. Next step: \S[\s\S]*$/
/** A bearer token, assembled at runtime so the file holds no credential-shaped literal. */
const BEARER = ["Kq7T", "z2Lm", "9Rp4", "Vw8B", "n3Cd"].join("")

/** One refusal, checked for its shape and its code. */
async function refusal(run: () => Promise<unknown>, code: string): Promise<string> {
  const message = await refusalOf(run)
  expect(message).toMatch(FORM)
  expect(message.startsWith(`${code}: `)).toBe(true)
  expect(message).not.toMatch(/[\r\n]/)
  return message
}

describe("the refusals", () => {
  test("a server that needs a sign-in", async () => {
    const { handlers } = handlersFor({ state: "needs_auth" })
    await refusal(() => handlers.probe.run({}, callOf("work")), "NEEDS_SIGN_IN")
  })

  test("a missing, failed, disabled or pending server", async () => {
    for (const state of ["missing", "failed", "disabled", "pending"] as const) {
      const { handlers } = handlersFor({ state })
      await refusal(() => handlers.probe.run({}, callOf("work")), "UNAVAILABLE")
    }
  })

  test("Affinity's rate limit", async () => {
    const { handlers } = handlersFor({ fail: { tool: "get_meetings", message: "429 Too Many Requests" } })
    await refusal(() => handlers.events_list.run({ since: "2026-11-01T00:00:00Z" }, callOf("work")), "RATE_LIMITED")
  })

  test("Affinity's missing scope", async () => {
    const { handlers } = handlersFor({ fail: { tool: "get_meetings", message: "Insufficient scope: meetings.read" } })
    await refusal(() => handlers.events_list.run({ since: "2026-11-01T00:00:00Z" }, callOf("work")), "SCOPE_MISSING")
  })

  test("an answer this plugin cannot read", async () => {
    const { handlers } = handlersFor({ unreadable: "hello" })
    await refusal(() => handlers.events_list.run({ since: "2026-11-01T00:00:00Z" }, callOf("work")), "UNAVAILABLE")
  })

  test("an input the method does not take", async () => {
    const { handlers } = handlersFor()
    await refusal(() => handlers.events_list.run({ limit: 900 }, callOf("work")), "INPUT_INVALID")
  })

  test("a cursor another account issued", async () => {
    const first = handlersFor()
    const answer = (await first.handlers.events_list.run({ since: "2026-11-01T00:00:00Z", limit: 1 }, callOf("work"))) as { cursor: string }
    await refusal(() => first.handlers.events_list.run({ cursor: answer.cursor }, callOf("personal")), "CURSOR_INVALID")
  })

  test("a source or a list this plugin does not have", async () => {
    const { handlers } = handlersFor()
    await refusal(() => handlers.events_list.run({ source: "notes" }, callOf("work")), "SOURCE_UNKNOWN")
    await refusal(() => handlers.events_list.run({ list: "notes" }, callOf("work")), "SOURCE_UNKNOWN")
  })

  test("a probed answer that names no organisation", async () => {
    const transport = fakeContext({ unreadableUser: "{}" })
    const table = tableFor({ provider: createProvider(transport.ctx), hostVersion: "2.4.1", accountProblems: [], profiles: profiles() })
    await refusal(() => table.probe.run({}, callOf("work")), "UNAVAILABLE")
  })

  test("keeps a reason to one line and never prints a bearer token", async () => {
    const { handlers } = handlersFor({ fail: { tool: "get_meetings", message: `upstream said: Authorization: Bearer ${BEARER} is expired` } })
    const message = await refusal(() => handlers.events_list.run({ since: "2026-11-01T00:00:00Z" }, callOf("work")), "UNAVAILABLE")
    expect(message).not.toContain(BEARER)
    expect(message.length).toBeLessThan(400)
  })
})
