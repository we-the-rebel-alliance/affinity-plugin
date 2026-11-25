/**
 * What the unit tests share: one handler call as the register makes it, and the handler table over a fake transport.
 */
import { accountsOf } from "@we-the-rebel-alliance/plugin-contract/accounts"
import type { Bus } from "@we-the-rebel-alliance/plugin-contract/bus"
import type { MethodCall } from "@we-the-rebel-alliance/plugin-contract/register"
import { createHandlers } from "../../src/handlers/index.ts"
import { manifest } from "../../src/manifest.ts"
import { createProvider } from "../../src/provider/index.ts"
import { type FakeOptions, fakeContext, NOW } from "../conformance/fake.ts"
import { named, type TestHandlers } from "../support/handlers.ts"

/** The two aliases every test uses. */
export const ACCOUNTS = { work: {}, personal: {} }

/** The profiles, through the contract's own reader. */
export function profiles() {
  const plan = accountsOf(manifest, { accounts: ACCOUNTS })
  if (!plan.ok) throw new Error(plan.problems.join("; "))
  return plan.value.accounts
}

/** The handler table for arbitrary parts, named. */
export function tableFor(parts: Parameters<typeof createHandlers>[0]): TestHandlers {
  return named(createHandlers(parts))
}

/** A bus that records what it emitted, and answers as the host does. */
export function recordingBus(): Bus & { readonly emitted: { readonly event: string; readonly data: unknown }[] } {
  const emitted: { event: string; data: unknown }[] = []
  return {
    name: "affinity",
    emitted,
    async emit(event, data) {
      emitted.push({ event, data })
      return { ok: true }
    }
  }
}

/** One handler call, as the register makes it. */
export function callOf(
  account: string,
  options: {
    readonly signal?: AbortSignal
    readonly unguarded?: () => Promise<{ readonly ok: true; readonly agents: readonly string[] } | { readonly ok: false; readonly error: string }>
    readonly bus?: Bus
  } = {}
): MethodCall {
  return {
    sessionID: "ses_test",
    agent: "build",
    messageID: "msg_test",
    id: "call_test",
    signal: options.signal ?? new AbortController().signal,
    progress: async () => undefined,
    account,
    bus: options.bus ?? recordingBus(),
    unguardedAgents: options.unguarded ?? (async () => ({ ok: true as const, agents: [] })),
    door: "rpc"
  }
}

/** The handler table over one fake Affinity, with the calls it saw. */
export function handlersFor(options: FakeOptions = {}): { readonly calls: ReturnType<typeof fakeContext>["calls"]; readonly handlers: TestHandlers } {
  const fake = fakeContext(options)
  return {
    calls: fake.calls,
    handlers: named(
      createHandlers({
        provider: createProvider(fake.ctx),
        hostVersion: "2.4.1",
        accountProblems: [],
        profiles: profiles(),
        now: () => options.now ?? NOW
      })
    )
  }
}

/** The message of the refusal a call threw, or a failed assertion. */
export async function refusalOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  throw new Error("the call answered instead of refusing")
}

export { NOW }
