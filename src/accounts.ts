/**
 * Affinity's accounts: one vendor MCP server per alias, and the profile each alias carries.
 *
 * The mechanism is `mcp` (contract §5): Affinity's server holds the credentials, and OpenCode keys its OAuth per server.
 * The names come from the contract's one rule, `<name>` for `default` and `<name>-<alias>` otherwise, so a person signs
 * in and a tool is permitted under one name. The server URL is named once, in `provider/`.
 */
import { accountName } from "@we-the-rebel-alliance/plugin-contract/accounts"
import { mcpServerUrl } from "./provider/index.ts"

/** The plugin's name, as every derived id, server and action spells it. */
export const PLUGIN_NAME = "affinity"

/**
 * The scopes Affinity's sign-in challenge asks for: changes, reads and a refresh token. Pinned so that a changed or
 * missing challenge cannot drop `offline_access`. The plugin sets no client id of its own: without a profile's
 * `clientId`, OpenCode signs in with its own client metadata document.
 */
export const OAUTH_SCOPE = "mcp mcp.read offline_access"

/** One alias's profile, from `options.accounts.<alias>`. */
export interface AffinityProfile {
  /** The client ID of the organisation's own Public OAuth app in Affinity, a UUID. */
  readonly clientId?: string
}

/** The profile of one alias, read from the raw option without trusting its shape. */
export function profileOf(raw: unknown): AffinityProfile {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {}
  const clientId = (raw as Record<string, unknown>).clientId
  return typeof clientId === "string" && clientId !== "" ? { clientId } : {}
}

/** The MCP server name for one alias. */
export function serverName(alias: string): string {
  return accountName(PLUGIN_NAME, alias)
}

/**
 * The vendor MCP server config for one alias. `oauth` carries the pinned scope, and the profile's `clientId` when it has
 * one: with it OpenCode signs in as the organisation's own OAuth app, and without it the server sets no client id, so
 * OpenCode's own client metadata works. The server's name is the alias's, derived by `registerAccounts`; the URL is the
 * same for every alias.
 */
export function serverConfig(profile: AffinityProfile): Record<string, unknown> {
  return {
    type: "remote",
    url: mcpServerUrl(),
    oauth: profile.clientId === undefined ? { scope: OAUTH_SCOPE } : { client_id: profile.clientId, scope: OAUTH_SCOPE }
  }
}
