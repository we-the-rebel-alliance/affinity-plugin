/**
 * `events_list`: the meetings page, its privacy choices, its cursor and its window (contract §7).
 *
 * Every case drives the handler through the provider over the fake Affinity transport, so the vendor envelope, the
 * derivation of the tool id and the normalisation are all exercised. The page is checked against the contract's own
 * shape with `resultProblems`.
 */
import { type EventsListResult, eventHash, resultProblems } from "@we-the-rebel-alliance/plugin-contract/events"
import { checkOutput } from "@we-the-rebel-alliance/plugin-contract/outputs"
import { describe, expect, test } from "vitest"
import { MAX_BYTES, SETTLE_MS } from "../../src/handlers/events.ts"
import { createHandlers } from "../../src/handlers/index.ts"
import { createProvider } from "../../src/provider/index.ts"
import { fakeContext, NOW } from "../conformance/fake.ts"
import { callOf, handlersFor, profiles, refusalOf, tableFor } from "./helpers.ts"

/** One page as the handler answered it, checked against the contract's own shape. */
async function page(options: Parameters<typeof handlersFor>[0] = {}, input: Record<string, unknown> = {}, account = "work"): Promise<EventsListResult> {
  const { handlers } = handlersFor(options)
  const answer = (await handlers.events_list.run({ source: "affinity", ...input }, callOf(account))) as EventsListResult
  expect(resultProblems(answer, 500, MAX_BYTES), "the page keeps the contract").toEqual([])
  return answer
}

describe("the meetings page", () => {
  test("lists the person's own meetings, oldest first, with no note, address or score", async () => {
    const answer = await page({}, { since: "2026-11-01T00:00:00Z" })
    expect(answer.source).toBe("affinity")
    expect(answer.account).toBe("work")
    expect(answer.owner).toEqual({ id: "affinity:user:77", label: "Pilot Owner (Example Ventures)" })
    expect(answer.trust).toBe("untrusted")
    expect(answer.events.map((event) => event.external_id)).toEqual(["1000", "1001", "1002"])
    for (const event of answer.events) {
      expect(event.kind).toBe("meeting")
      expect(event.text).toBe("")
      expect(event.url).toBeNull()
      expect(event.labels).toEqual([])
      expect(event.thread).toBeNull()
      expect(event.hash).toBe(eventHash(event))
      expect(event.actors?.every((actor) => actor.id.startsWith("affinity:person/"))).toBe(true)
    }
    // No email address reaches an event, a title, or the page.
    expect(JSON.stringify(answer)).not.toContain("@example")
  })

  test("carries a person's name when Affinity gives one, under their Affinity person id", async () => {
    const named = [
      {
        id: 3000,
        title: "Named meeting",
        startTime: "2026-11-12T10:00:00Z",
        creator: null,
        organizer: { emailAddress: "pilot.owner@example.com", person: { id: 9001, firstName: "Pilot", lastName: "Owner", primaryEmailAddress: "pilot.owner@example.com" } },
        createdAt: "2026-11-10T10:00:00Z",
        attendeesPreview: {
          data: [{ emailAddress: "kofi@example.test", person: { id: 501, firstName: "Kofi", lastName: "Boateng", primaryEmailAddress: "kofi@example.test" } }],
          totalCount: 2
        }
      }
    ]
    const { handlers } = handlersFor({ meetings: { work: named, personal: [] } })
    const answer = (await handlers.events_list.run({ since: "2026-11-01T00:00:00Z" }, callOf("work"))) as EventsListResult
    expect(answer.events[0]?.actors).toEqual([
      { role: "organizer", id: "affinity:person/9001", name: "Pilot Owner" },
      { role: "attendee", id: "affinity:person/501", name: "Kofi Boateng" }
    ])
  })

  test("leaves a colleague's meeting out and refuses a title that holds a secret", async () => {
    const answer = await page({}, { since: "2026-11-01T00:00:00Z" })
    expect(answer.events.map((event) => event.external_id)).not.toContain("1003")
    expect(answer.refused).toEqual([{ external_id: "1004", reason: "secret", detail: "holds a secret (api key)" }])
    expect(JSON.stringify(answer)).not.toContain("sk-")
  })

  test("lists a meeting only once it started an hour ago, and never one in the future", async () => {
    const answer = await page({}, { since: "2026-11-13T00:00:00Z" })
    expect(answer.events).toEqual([])
    expect(NOW - SETTLE_MS).toBe(Date.parse("2026-11-13T11:00:00.000Z"))
  })

  test("starts 24 hours before now when the call names neither cursor nor since", async () => {
    const { handlers, calls } = handlersFor()
    const answer = (await handlers.events_list.run({ source: "affinity" }, callOf("work"))) as EventsListResult
    expect(answer.events.map((event) => event.external_id)).toEqual(["1002"])
    expect(calls[1]?.input["filter_expr"]).toContain("startTime>=2026-11-12T12:00:00Z")
  })

  test("lists the personal account's own meeting, and only it", async () => {
    const answer = await page({}, { since: "2026-11-01T00:00:00Z" }, "personal")
    expect(answer.account).toBe("personal")
    expect(answer.owner.id).toBe("affinity:user:88")
    expect(answer.events.map((event) => event.external_id)).toEqual(["2000"])
  })

  test("pages by limit and carries on from the cursor", async () => {
    const first = await page({}, { since: "2026-11-01T00:00:00Z", limit: 2 })
    expect(first.events.map((event) => event.external_id)).toEqual(["1000", "1001"])
    expect(typeof first.cursor).toBe("string")
    const second = await page({}, { cursor: first.cursor })
    expect(second.events.map((event) => event.external_id)).toEqual(["1002"])
    expect(second.cursor).not.toBe(first.cursor)
    const third = await page({}, { cursor: second.cursor })
    expect(third.events).toEqual([])
    expect(third.more).toBe(false)
  })

  test("refuses another account's cursor as CURSOR_INVALID, never as an empty page", async () => {
    const first = await page({}, { since: "2026-11-01T00:00:00Z", limit: 1 })
    const message = await refusalOf(() => handlersFor().handlers.events_list.run({ cursor: first.cursor }, callOf("personal")))
    expect(message).toMatch(/^CURSOR_INVALID: /)
    expect(message).toContain("Next step: ")
  })

  test("refuses a malformed cursor and a cursor made for another source", async () => {
    const { handlers } = handlersFor()
    for (const cursor of ["not-a-cursor", Buffer.from(JSON.stringify({ v: 2, b: "0000000000000000", l: "meetings" })).toString("base64url")]) {
      const message = await refusalOf(() => handlers.events_list.run({ cursor }, callOf("work")))
      expect(message).toMatch(/^CURSOR_INVALID: /)
    }
  })

  test("answers a gap once when the window is truncated, and reads on from its own cursor", async () => {
    const answer = await page({}, { since: "2026-01-01T00:00:00Z" })
    expect(answer.gap).toEqual({ reason: "window-truncated", since: "2026-08-15T12:00:00.000Z" })
    expect(answer.events.map((event) => event.external_id)).toEqual(["1000", "1001", "1002"])
    expect(answer.more).toBe(false)
  })

  test("answers an expired gap once for a cursor older than it lasts", async () => {
    const old = handlersFor({ now: NOW - 120 * 86_400_000 })
    const first = (await old.handlers.events_list.run({ since: new Date(NOW - 121 * 86_400_000).toISOString() }, callOf("work"))) as EventsListResult
    const answer = await page({}, { cursor: first.cursor })
    expect(answer.gap).toEqual({ reason: "expired", since: "2026-08-15T12:00:00.000Z" })
    const next = await page({}, { cursor: answer.cursor })
    expect(next.gap).toBeUndefined()
  })

  test("reports the calls it made, identity included", async () => {
    const { handlers, calls } = handlersFor()
    const first = (await handlers.events_list.run({ since: "2026-11-01T00:00:00Z" }, callOf("work"))) as EventsListResult
    expect(first.cost?.units).toEqual([{ per: "call", count: calls.length }])
    expect(calls[0]?.tool).toBe("get_current_user")
    const before = calls.length
    const second = (await handlers.events_list.run({ since: "2026-11-01T00:00:00Z" }, callOf("work"))) as EventsListResult
    // The owner and the matching address are kept for a bounded time, so a second listing pays no identity call.
    expect(calls.slice(before).some((call) => call.tool === "get_current_user")).toBe(false)
    expect(second.cost?.units[0]?.count).toBe(calls.length - before)
  })

  test("refreshes the identity after its time to live", async () => {
    let now = NOW
    const transport = fakeContext()
    const table = tableFor({ provider: createProvider(transport.ctx), hostVersion: "2.4.1", accountProblems: [], profiles: profiles(), now: () => now })
    await table.events_list.run({ since: "2026-11-01T00:00:00Z" }, callOf("work"))
    now += 16 * 60_000
    await table.events_list.run({ since: "2026-11-01T00:00:00Z" }, callOf("work"))
    expect(transport.calls.filter((call) => call.tool === "get_current_user")).toHaveLength(2)
  })

  test("refuses a call cancelled before it starts, and makes no vendor call", async () => {
    const { handlers, calls } = handlersFor()
    const controller = new AbortController()
    controller.abort(new Error("stopped"))
    await expect(handlers.events_list.run({ since: "2026-11-01T00:00:00Z" }, callOf("work", { signal: controller.signal }))).rejects.toThrow("stopped")
    expect(calls).toEqual([])
  })

  test("refuses an input it does not take, before any call", async () => {
    const { handlers, calls } = handlersFor()
    for (const input of [{ since: "yesterday" }, { limit: 0 }, { limit: 501 }, { cursor: "" }, { unknown: true }]) {
      const message = await refusalOf(() => handlers.events_list.run(input, callOf("work")))
      expect(message).toMatch(/^INPUT_INVALID: /)
    }
    expect(calls).toEqual([])
  })
})

describe("the companies snapshot", () => {
  test("answers the registry's list shape, with the secret-bearing and nameless companies left out", async () => {
    const { handlers } = handlersFor()
    const answer = (await handlers.events_list.run({ source: "affinity", list: "companies" }, callOf("work"))) as {
      source: string
      account: string
      data: unknown
      asOf: string
      trust: string
    }
    expect(answer.source).toBe("affinity")
    expect(answer.account).toBe("work")
    expect(answer.asOf).toBe(new Date(NOW).toISOString())
    expect(answer.trust).toBe("untrusted")
    expect(checkOutput("list", answer.data)).toMatchObject({ ok: true })
    expect(answer.data).toEqual({
      items: [
        { id: "2001", text: "Northwind Robotics", note: "northwind.example.test" },
        { id: "2002", text: "Harbour Capital", note: "harbour.example.test" }
      ],
      editable: false
    })
    expect(JSON.stringify(answer)).not.toContain("sk-")
    expect(JSON.stringify(answer)).not.toContain("secret.example.test")
  })

  test("reads the personal account's own companies from its own server", async () => {
    const { handlers, calls } = handlersFor()
    const answer = (await handlers.events_list.run({ list: "companies" }, callOf("personal"))) as { account: string }
    expect(answer.account).toBe("personal")
    expect(calls.map((call) => call.alias)).toEqual(["personal"])
  })

  test("refuses a list this plugin does not have, and a listing's window on a snapshot", async () => {
    const { handlers, calls } = handlersFor()
    expect(await refusalOf(() => handlers.events_list.run({ list: "notes" }, callOf("work")))).toMatch(/^SOURCE_UNKNOWN: /)
    for (const key of ["since", "cursor", "limit"]) {
      expect(await refusalOf(() => handlers.events_list.run({ list: "companies", [key]: key === "limit" ? 5 : "x" }, callOf("work")))).toMatch(/^INPUT_INVALID: /)
    }
    expect(calls).toEqual([])
  })

  test("refuses an answer that is not a list of companies", async () => {
    const message = await refusalOf(() => handlersFor({ unreadableCompanies: "not a page" }).handlers.events_list.run({ list: "companies" }, callOf("work")))
    expect(message).toMatch(/^UNAVAILABLE: /)
  })
})
