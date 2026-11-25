/**
 * The recorded conformance fixture, regenerated from the real handlers over a fake Affinity MCP transport.
 *
 * Every case is a real call: the provider looks up the alias's server, derives the vendor tool's id with the contract's
 * `toolAction`, and executes it through the transport; the handler normalises what comes back. Two synthetic aliases,
 * `work` and `personal`, prove the per-account pages, the cursor's account binding, the two account refusals and the
 * companies snapshot.
 *
 * The file `fixtures/conformance.json` is this recording. The test rebuilds it every run and fails when it differs, so
 * the kit's static checks read exactly what the handlers answered. Run `UPDATE_FIXTURES=1 npx vitest run
 * test/conformance` to write a changed recording, and read the diff before committing it.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { accountsOf, resolveAccount } from "@we-the-rebel-alliance/plugin-contract/accounts"
import type { Bus, BusEmitResult } from "@we-the-rebel-alliance/plugin-contract/bus"
import type { MethodCall } from "@we-the-rebel-alliance/plugin-contract/register"
import { describe, expect, test } from "vitest"
import { registerChangedHook } from "../../src/bus.ts"
import { createHandlers } from "../../src/handlers/index.ts"
import { manifest, PACKAGE } from "../../src/manifest.ts"
import { createProvider } from "../../src/provider/index.ts"
import { named, type TestHandlers } from "../support/handlers.ts"
import { fakeContext, NOW } from "./fake.ts"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const FIXTURE = join(ROOT, "fixtures", "conformance.json")
const ACCOUNTS = { work: {}, personal: {} }

/** The profiles the options name, through the contract's own reader. */
const plan = accountsOf(manifest, { accounts: ACCOUNTS })
if (!plan.ok) throw new Error(plan.problems.join("; "))
const PROFILES = plan.value.accounts

/** One handler call, as the register would make it: the input without the account, and the resolved alias. */
function callOf(
  account: string,
  options: {
    readonly signal?: AbortSignal
    readonly unguarded?: () => Promise<{ readonly ok: true; readonly agents: readonly string[] } | { readonly ok: false; readonly error: string }>
  } = {}
): MethodCall {
  const bus: Bus = { name: "affinity", emit: async () => ({ ok: true }) as BusEmitResult }
  return {
    sessionID: "ses_conformance",
    agent: "build",
    messageID: "msg_conformance",
    id: "call_conformance",
    signal: options.signal ?? new AbortController().signal,
    progress: async () => undefined,
    account,
    bus,
    unguardedAgents: options.unguarded ?? (async () => ({ ok: true as const, agents: [] })),
    door: "rpc"
  }
}

/** What one call answered, or the refusal it threw, in the contract's message form. */
async function call(run: () => Promise<unknown>): Promise<{ readonly answer?: unknown; readonly refusal?: string }> {
  try {
    return { answer: await run() }
  } catch (error) {
    return { refusal: error instanceof Error ? error.message : String(error) }
  }
}

/** The handler table over one fake transport. */
function handlersFor(options: Parameters<typeof fakeContext>[0] = {}) {
  const fake = fakeContext(options)
  return {
    calls: fake.calls,
    handlers: named(
      createHandlers({
        provider: createProvider(fake.ctx),
        hostVersion: "2.4.1",
        accountProblems: [],
        profiles: PROFILES,
        now: () => options.now ?? NOW
      })
    )
  }
}

/**
 * One recorded events_list case: what was asked, and what the real handler answered or refused.
 *
 * The label is for a person reading the recording. It is not the kit's `name` key, because `plugin-kit record` treats
 * every `name` in a fixture as personal data and replaces it, and this recording carries none.
 */
interface RecordedCase {
  readonly label: string
  readonly input: Record<string, unknown>
  readonly expect?: unknown
  readonly answer?: unknown
  readonly refuses?: string
}

/** One events_list case: what was asked, and what the real handler answered. */
async function page(handlers: TestHandlers, label: string, input: Record<string, unknown>, expect?: string): Promise<RecordedCase> {
  const account = String(input["account"])
  const outcome = await call(() => handlers.events_list.run(input, callOf(account)))
  if (outcome.refusal !== undefined) return { label, input, expect: { refuses: expect ?? "UNAVAILABLE" }, refuses: outcome.refusal }
  return { label, input, ...(expect === undefined ? {} : { expect }), answer: outcome.answer }
}

/** A tool hook domain that captures the one `execute.after` callback, so a test can drive it. */
function capturingHook() {
  const callbacks: ((event: unknown) => Promise<void>)[] = []
  const ctx = {
    tool: {
      hook: async (_name: string, callback: (event: unknown) => Promise<void>) => {
        callbacks.push(callback)
        return { dispose: async () => undefined }
      }
    }
  }
  return {
    ctx,
    async fire(event: unknown) {
      for (const callback of callbacks) await callback(event)
    }
  }
}

/** The recording. */
async function record() {
  const first = handlersFor()
  const workFirst = await page(first.handlers, "the work account's meetings, oldest first, with a colleague's meeting and a secret left out", {
    source: "affinity",
    account: "work",
    since: "2026-11-01T00:00:00Z"
  })
  const limited = await page(first.handlers, "the first two meetings, then more", { source: "affinity", account: "work", since: "2026-11-01T00:00:00Z", limit: 2 })
  const cursor = limited.answer !== undefined && typeof limited.answer === "object" ? (limited.answer as { cursor?: unknown }).cursor : undefined
  if (typeof cursor !== "string") throw new Error("the limited page answered no cursor")
  const after = await page(first.handlers, "what came after the first two", { source: "affinity", account: "work", cursor })
  const personal = await page(first.handlers, "the personal account's own meeting", { source: "affinity", account: "personal", since: "2026-11-01T00:00:00Z" })
  const empty = await page(first.handlers, "an empty page still carries a cursor", { source: "affinity", account: "work", since: "2026-11-13T00:00:00Z" }, "empty")
  const truncated = await page(first.handlers, "a since before the 90 days the source reads back starts there, with a gap", {
    source: "affinity",
    account: "work",
    since: "2026-01-01T00:00:00Z"
  })

  // A cursor issued 120 days ago is past the 100 days it lasts: the read restarts 90 days back, says so once, and reads on.
  const aged = handlersFor({ now: NOW - 120 * 86_400_000 })
  const before = await call(() => aged.handlers.events_list.run({ source: "affinity", since: new Date(NOW - 121 * 86_400_000).toISOString() }, callOf("work")))
  const agedCursor = before.answer !== undefined && typeof before.answer === "object" ? (before.answer as { cursor?: unknown }).cursor : undefined
  if (typeof agedCursor !== "string") throw new Error("the aged page answered no cursor")
  const expired = await page(
    first.handlers,
    "a cursor older than the source reads back answers a gap and reads on",
    { source: "affinity", account: "work", cursor: agedCursor },
    "expired"
  )

  const crossed = await page(first.handlers, "a work cursor passed under personal", { source: "affinity", account: "personal", cursor }, "CURSOR_INVALID")
  const unknownSource = await page(first.handlers, "a source this plugin does not have", { source: "notes", account: "work" }, "SOURCE_UNKNOWN")
  const unknownList = await page(first.handlers, "a list this plugin does not have", { source: "affinity", account: "work", list: "notes" }, "SOURCE_UNKNOWN")

  // Affinity's own failures: a rate limit and an answer this plugin cannot read.
  const limitedApi = handlersFor({ fail: { tool: "get_meetings", message: "Rate limit exceeded for this organisation" } })
  const rate = await page(
    limitedApi.handlers,
    "Affinity's rate limit is RATE_LIMITED, with its request id",
    { source: "affinity", account: "work", since: "2026-11-01T00:00:00Z" },
    "RATE_LIMITED"
  )
  const unreadableApi = handlersFor({ unreadable: "Affinity is thinking about your request" })
  const unreadable = await page(
    unreadableApi.handlers,
    "an answer this plugin cannot read is UNAVAILABLE, never an empty page",
    { source: "affinity", account: "work", since: "2026-11-01T00:00:00Z" },
    "UNAVAILABLE"
  )

  const probe = await call(() => first.handlers.probe.run({}, callOf("work")))
  const snapshot = await call(() => first.handlers.events_list.run({ source: "affinity", list: "companies" }, callOf("work")))
  const status = await call(() => first.handlers.status.run({}, callOf("work")))

  // The bus: one write tool completes, one read tool completes, and one write fails; only the completed write nudges.
  const emitted: unknown[] = []
  const bus: Bus = {
    name: "affinity",
    emit: async (event, data) => {
      emitted.push({ event, data })
      return { ok: true }
    }
  }
  const captured = capturingHook()
  const hook = await registerChangedHook(captured.ctx as never, bus, ["work", "personal"])
  await captured.fire({ tool: "affinity-work_create_company", status: "completed" })
  await captured.fire({ tool: "affinity-work_get_meetings", status: "completed" })
  await captured.fire({ tool: "affinity-personal_update_note", status: "error" })
  await hook.dispose()
  if (emitted.length !== 1) throw new Error(`the changed hook emitted ${emitted.length} events, not one`)

  const required = resolveAccount(PROFILES, {})
  const unknown = resolveAccount(PROFILES, { account: "nobodyhere" })
  if (required.ok || unknown.ok) throw new Error("the two-account refusals did not refuse")

  return {
    $comment:
      "Recorded through affinity's own handlers over a fake Affinity MCP transport: two mcp accounts, work and personal, the meetings source's pages and the companies snapshot. No live call is made. Every organisation, person, address, meeting and company is invented; the refused meeting's title holds a credential-shaped string that the recording never carries.",
    plugin: PACKAGE,
    namespace: manifest.plugin.summary,
    accounts: {
      real: true,
      aliases: PROFILES.map((profile) => profile.alias),
      required: { method: "events_list", code: required.code },
      unknown: { method: "events_list", account: "nobodyhere", code: unknown.code },
      cursors: [{ method: "events_list", account: "work", other: "personal", code: "CURSOR_INVALID" }]
    },
    sources: {
      "affinity.meetings": {
        cases: [workFirst, limited, after, personal, empty, truncated, expired, crossed, unknownSource, unknownList, rate, unreadable],
        probe: { answer: answerOf(probe) }
      },
      "affinity.companies": {
        snapshot: { answer: answerOf(snapshot) },
        probe: { answer: answerOf(probe) }
      }
    },
    events: {
      emitted: ["changed"],
      status: answerOf(status)
    }
  }
}

/** A recorded answer, or the refusal text when a call refused. */
function answerOf(outcome: { readonly answer?: unknown; readonly refusal?: string }): unknown {
  if (outcome.refusal !== undefined) throw new Error(`the recording expected an answer and got ${outcome.refusal}`)
  return outcome.answer
}

describe("the conformance fixture", () => {
  test("matches what the handlers answer now", async () => {
    const recorded = await record()
    const text = `${JSON.stringify(recorded, null, 2)}\n`
    if (process.env["UPDATE_FIXTURES"] === "1") {
      writeFileSync(FIXTURE, text)
      return
    }
    const committed = readFileSync(FIXTURE, "utf8")
    expect(committed).toBe(text)
  }, 30_000)
})
