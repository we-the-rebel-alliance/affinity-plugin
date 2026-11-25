/**
 * `status`: what the plugin is, which host it runs on, and one entry per account alias.
 *
 * It reads no provider data: each alias's state is the state of its own MCP server, as the host reports it
 * (contract §11). The answer is built by `statusAnswer` from the manifest, the two versions, the account states, the
 * problems setup recorded and the agents whose rules no longer carry every generated rule — so the handler keeps no
 * state of its own.
 */
import { type AccountProfile, type AccountSignal, accountStatuses, redactReason, STATUS_SCHEMA, statusAnswer } from "@we-the-rebel-alliance/plugin-contract/accounts"
import type { MethodHandler } from "@we-the-rebel-alliance/plugin-contract/register"
import { manifest, version } from "../manifest.ts"
import type { Provider, ServerState } from "../provider/index.ts"

/** What the status handler needs, taken from what setup already built. */
export interface StatusParts {
  readonly provider: Provider
  /** `ctx.app.version`, read once in setup. */
  readonly hostVersion: string
  /** What registering the accounts could not do. */
  readonly problems: readonly string[]
  /** The aliases and profiles the options name. */
  readonly profiles: readonly AccountProfile[]
}

/** One alias's signal, from its server's state. A server that is connecting is ready: the host is still working on it. */
function signalOf(state: ServerState): AccountSignal {
  if (state.state === "connected" || state.state === "pending") return { state: "ready" }
  if (state.state === "needs_auth") return { state: "needs_sign_in" }
  const reason = state.state === "missing" ? "no MCP server is registered under this name" : (state.reason ?? `the MCP server is ${state.state}`)
  return { state: "error", reason }
}

/** The `status` handler. */
export function statusHandler(parts: StatusParts): MethodHandler {
  return {
    description: "Read the plugin's state, its OpenCode range and one entry per account alias, without reading any Affinity data.",
    input: { type: "object", properties: {}, additionalProperties: false },
    output: STATUS_SCHEMA,
    async run(_input, call) {
      const problems = [...parts.problems]
      const signals: Record<string, AccountSignal> = {}
      for (const profile of parts.profiles) {
        try {
          const signal = signalOf(await parts.provider.serverState(profile.alias))
          signals[profile.alias] = signal
          // An alias in error is a plugin problem too, so the answer's own state says so and its next step is the reason.
          if (signal.state === "error") problems.push(redactReason(`${profile.alias}: ${signal.reason ?? "the account is in error"}`))
        } catch (error) {
          const reason = redactReason(error instanceof Error ? error.message : String(error))
          signals[profile.alias] = { state: "error", reason }
          problems.push(redactReason(`${profile.alias}: ${reason}`))
        }
      }
      return statusAnswer({
        manifest,
        version,
        hostVersion: parts.hostVersion,
        accounts: accountStatuses(parts.profiles, signals),
        problems,
        unguardedAgents: await call.unguardedAgents()
      })
    }
  }
}
