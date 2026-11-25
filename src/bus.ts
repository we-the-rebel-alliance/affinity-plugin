/**
 * The plugin's one nudge: `changed`, emitted after one of Affinity's own tools completes a change.
 *
 * A pass-through write has no handler this plugin writes, so the only place it can nudge an app is the host's
 * `execute.after` tool hook (contract §10). One hook is registered, through `registration.bus`, which `register` builds
 * from its single RPC registration. The hook **adds no model text**: it returns nothing and never touches the tool's
 * answer, so a turn reads exactly what Affinity's tool said.
 *
 * Only a completed call nudges, and only a non-`read` `mcp:` method of this plugin's own servers; a read, a failed call
 * or another plugin's tool emits nothing.
 */
import type { Plugin } from "@opencode/plugin"
import { toolAction } from "@we-the-rebel-alliance/plugin-contract/access"
import type { Bus } from "@we-the-rebel-alliance/plugin-contract/bus"
import { serverName } from "./accounts.ts"
import { manifest } from "./manifest.ts"

/** The capability a change is reported against: the plugin's first source. */
export const CHANGED_CAPABILITY = "affinity.meetings"

/** The hook's reason line, for a log or a diagnostic; an app renders none of it. */
export const CHANGED_REASON = "write"

/** What the hook needs from the host: the tool hook domain. */
export interface HookContext {
  readonly tool: Pick<Plugin.Context["tool"], "hook">
}

/**
 * Every non-read `mcp:` method's effective tool id, and the alias whose server carries it. The ids are derived exactly
 * as OpenCode derives them, so a rule for one alias can never match another alias's tool.
 */
export function changedTools(aliases: readonly string[]): Map<string, string> {
  const byTool = new Map<string, string>()
  for (const [method, item] of Object.entries(manifest.methods)) {
    if (!method.startsWith("mcp:") || item.class === "read") continue
    for (const alias of aliases) byTool.set(toolAction(serverName(alias), method.slice("mcp:".length)), alias)
  }
  return byTool
}

/**
 * Register the one `execute.after` hook. It answers the hook's disposer, so setup can remove it with the registration.
 */
export async function registerChangedHook(ctx: HookContext, bus: Bus, aliases: readonly string[]): Promise<{ dispose(): Promise<void> }> {
  const byTool = changedTools(aliases)
  return ctx.tool.hook("execute.after", async (event) => {
    if (event.status !== "completed") return
    const account = byTool.get(event.tool)
    if (account === undefined) return
    await bus.emit("changed", { capability: CHANGED_CAPABILITY, account, reason: CHANGED_REASON })
  })
}
