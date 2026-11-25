/**
 * The one handler table, by the method's name in the manifest.
 *
 * Only the plugin's own three methods have handlers. Every one of Affinity's 103 MCP tools is a pass-through method in
 * the manifest: the vendor's server owns its tool, so `register` refuses a handler for it and this table has none.
 */
import type { AccountProfile } from "@we-the-rebel-alliance/plugin-contract/accounts"
import type { HandlerTable } from "@we-the-rebel-alliance/plugin-contract/register"
import type { Provider } from "../provider/index.ts"
import { eventsHandler } from "./events.ts"
import { probeHandler } from "./probe.ts"
import { statusHandler } from "./status.ts"

/** What the table needs, from what setup already built. */
export interface HandlerParts {
  readonly provider: Provider
  /** `ctx.app.version`, read once in setup. */
  readonly hostVersion: string
  /** What registering the accounts, or reading their options, could not do. */
  readonly accountProblems: readonly string[]
  /** What reading the bundled skills could not do, one sentence each. */
  readonly skillProblems?: readonly string[] | undefined
  /** The aliases and profiles the options name. */
  readonly profiles: readonly AccountProfile[]
  /** The clock; tests fix it. */
  readonly now?: (() => number) | undefined
}

/** The handler table, built once per plugin instance. */
export function createHandlers(parts: HandlerParts): HandlerTable {
  const now = parts.now ?? Date.now
  return {
    status: statusHandler({
      provider: parts.provider,
      hostVersion: parts.hostVersion,
      problems: parts.accountProblems,
      skillProblems: parts.skillProblems,
      profiles: parts.profiles
    }),
    events_list: eventsHandler({ provider: parts.provider, now }),
    probe: probeHandler(parts.provider)
  }
}
