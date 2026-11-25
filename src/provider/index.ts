/**
 * The one provider client: Affinity's hosted MCP server, reached through OpenCode's own executors.
 *
 * This module is the only place the endpoint is named. It calls Affinity's MCP tools for an alias's server through
 * `ctx.tool.list()` and `tool.execute`, so each call runs with the tool's own permission and the plugin holds no
 * credential. Names come from the contract's two rules (`accountName` for the server, `toolAction` for the tool id);
 * this module never writes one by hand.
 *
 * The provider refuses fast instead of waiting on a server that will not answer: a server that needs a sign-in is
 * `NEEDS_SIGN_IN`, one that is missing, disabled, failed or still connecting is `UNAVAILABLE` with its state and a next
 * step. Affinity's own failure is mapped to the contract's code: a rate limit or the firm's monthly quota is
 * `RATE_LIMITED`, a missing scope `SCOPE_MISSING`, a refused permission `PERMISSION_DENIED`, and anything else
 * `UNAVAILABLE`, one redacted line.
 */
import type { Plugin } from "@opencode/plugin"
import { type ToolContext, Error as ToolError } from "@opencode/plugin/promise/tool"
import { toolAction } from "@we-the-rebel-alliance/plugin-contract/access"
import { redactReason } from "@we-the-rebel-alliance/plugin-contract/accounts"
import { type MethodCall, RegisterError, refusal } from "@we-the-rebel-alliance/plugin-contract/register"
import { serverName } from "../accounts.ts"

/** Affinity's hosted MCP server. This is the only place the endpoint is named. */
const ENDPOINT = "https://mcp.affinity.co/mcp"

/** Affinity's one MCP server URL. Every alias reaches the same server; only its local name differs. */
export function mcpServerUrl(): string {
  return ENDPOINT
}

type Tool = Awaited<ReturnType<Plugin.Context["tool"]["list"]>>[number]
type Server = Awaited<ReturnType<Plugin.Context["mcp"]["list"]>>["data"][number]

/** What one vendor tool answered: its structured output, its text, or both. */
export type ToolResult = Awaited<ReturnType<Tool["execute"]>>

/** One alias's server, as the host reports it. */
export interface ServerState {
  /** The server name: `affinity`, or `affinity-<alias>`. */
  readonly name: string
  /** `missing` when the host lists no server under that name. */
  readonly state: "missing" | "connected" | "pending" | "needs_auth" | "failed" | "disabled"
  /** The host's own reason, unredacted; callers redact before showing it. */
  readonly reason?: string
}

/** What the provider needs from the host: its tool and MCP domains. */
export interface ProviderContext {
  readonly tool: Pick<Plugin.Context["tool"], "list">
  readonly mcp: Pick<Plugin.Context["mcp"], "list">
}

/** Affinity's own failure, in the contract's form. */
function vendorRefusal(error: ToolError, tool: string, account: string): RegisterError {
  const text = redactReason(error.message)
  if (/\b429\b|rate.?limit|quota/i.test(error.message)) {
    return new RegisterError(
      refusal(
        "RATE_LIMITED",
        `${tool} was refused for a rate limit or the firm's shared monthly API quota (${text})`,
        `Call it again later; if it says the monthly quota, ask an Affinity admin.`
      )
    )
  }
  if (/insufficient.?scope/i.test(error.message)) {
    return new RegisterError(
      refusal("SCOPE_MISSING", `the ${account} sign-in lacks a scope ${tool} needs (${text})`, "Sign in to Affinity again with the mcp scope, then try again.")
    )
  }
  return new RegisterError(refusal("UNAVAILABLE", `Affinity's ${tool} failed: ${text}`, "Try again; if it keeps failing, check the plugin's status."))
}

/** The state of one alias's server, read from the host's own list. */
async function serverState(ctx: ProviderContext, alias: string): Promise<ServerState> {
  const name = serverName(alias)
  const servers: readonly Server[] = (await ctx.mcp.list()).data
  const server = servers.find((entry) => entry.name === name)
  if (server === undefined) return { name, state: "missing" }
  const status = server.status
  if (status.status === "failed" || status.status === "needs_auth") return { name, state: status.status, reason: status.error }
  return { name, state: status.status }
}

/** A refusal for a server that cannot take a call, with the state and the next step a person needs. */
function serverRefusal(state: ServerState, alias: string): RegisterError {
  if (state.state === "needs_auth") {
    return new RegisterError(refusal("NEEDS_SIGN_IN", `the ${state.name} MCP server needs a sign-in`, `Run /connect and choose ${state.name}, then try again.`))
  }
  const reason =
    state.state === "missing" ? "the host lists no server under that name" : `the server is ${state.state}${state.reason === undefined ? "" : `: ${redactReason(state.reason)}`}`
  return new RegisterError(
    refusal("UNAVAILABLE", `the ${state.name} MCP server cannot take a call: ${reason}`, `Check options.accounts.${alias}, run /connect and choose ${state.name}, then try again.`)
  )
}

/** The tool context one handler call gives an MCP tool: the same session, agent, call id, cancellation and progress. */
function toolContext(call: MethodCall): ToolContext {
  return {
    sessionID: call.sessionID,
    agent: call.agent,
    messageID: call.messageID,
    id: call.id,
    signal: call.signal,
    progress: (update: Readonly<Record<string, unknown>>) => call.progress(update),
    // A call made from Code Mode reaches the vendor tool as one, so its executor behaves the same either way.
    codemode: call.door === "codemode"
  } as unknown as ToolContext
}

/** The provider one plugin instance uses. */
export interface Provider {
  /** One Affinity tool for one alias, or the contract refusal that stops the call. */
  call(alias: string, tool: string, input: Record<string, unknown>, call: MethodCall): Promise<ToolResult>
  /** One alias's server, as the host reports it. Reads no provider data. */
  serverState(alias: string): Promise<ServerState>
}

/** A fresh provider over the host's tool and MCP domains. */
export function createProvider(ctx: ProviderContext): Provider {
  const state = (alias: string) => serverState(ctx, alias)
  return {
    serverState: state,
    async call(alias, tool, input, call) {
      call.signal.throwIfAborted()
      const server = await state(alias)
      if (server.state !== "connected") throw serverRefusal(server, alias)
      const id = toolAction(server.name, tool)
      const found = (await ctx.tool.list()).find((entry) => entry.id === id)
      if (found === undefined) {
        throw new RegisterError(refusal("UNAVAILABLE", `OpenCode lists no ${id} tool for the ${server.name} server`, `Sign in to ${server.name} again and reload the plugin.`))
      }
      call.signal.throwIfAborted()
      try {
        return await found.execute(input as never, toolContext(call))
      } catch (error) {
        call.signal.throwIfAborted()
        if (error instanceof ToolError) {
          // A permission refusal carries a cause; Affinity's own failures do not.
          if (error.error !== undefined) {
            throw new RegisterError(
              refusal("PERMISSION_DENIED", `${id} was refused by a permission rule`, `Ask the person to allow ${id}, or use a session whose agent allows it.`)
            )
          }
          throw vendorRefusal(error, tool, alias)
        }
        const reason = redactReason(error instanceof Error ? error.message : String(error))
        throw new RegisterError(refusal("UNAVAILABLE", `${id} failed: ${reason}`, "Try again; if it keeps failing, check the plugin's status."))
      }
    }
  }
}
