/**
 * `probe`: who is signed in for one account alias, from Affinity's own `get_current_user` call, and nothing else.
 *
 * The owner is provider-confirmed: Affinity names the user, so the id is `affinity:user:<id>` and no `verified` field
 * says otherwise. The label is the person's name and their organisation; an email address is never part of an answer.
 * The scopes are the grant's own, so a read-only sign-in can be told apart before a change is planned.
 */
import { PROBE_SCHEMA, probeResult } from "@we-the-rebel-alliance/plugin-contract/events"
import { type MethodHandler, RegisterError, refusal } from "@we-the-rebel-alliance/plugin-contract/register"
import { type CurrentUser, readCurrentUser } from "../provider/answers.ts"
import type { Provider } from "../provider/index.ts"

/** The one source every page and probe names. */
export const SOURCE = "affinity"
/** The most characters an owner label may take. */
const LABEL_MAX = 200

/** At most `max` characters, never splitting a surrogate pair. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const code = text.charCodeAt(max - 1)
  return text.slice(0, code >= 0xd800 && code <= 0xdbff ? max - 1 : max)
}

/** The owner of a sign-in: the Affinity user's id, and a label of their name and organisation. */
export function ownerOf(user: CurrentUser): { readonly id: string; readonly label: string } {
  const label = user.name !== undefined && user.tenantName !== undefined ? `${user.name} (${user.tenantName})` : (user.name ?? user.tenantName ?? "Affinity user")
  return { id: clip(`affinity:user:${user.userId}`, 320), label: clip(label, LABEL_MAX) }
}

/** The grant's scopes, as `probe` may list them: different lines, at most 64, each at most 256 characters. */
function scopesOf(user: CurrentUser): readonly string[] {
  const scopes = new Set<string>()
  for (const scope of user.scopes ?? []) {
    const line = scope.trim()
    if (line !== "" && line.length <= 256) scopes.add(line)
    if (scopes.size >= 64) break
  }
  return [...scopes]
}

/** The `probe` handler. */
export function probeHandler(provider: Provider): MethodHandler {
  return {
    description: "Read who is signed in to Affinity for one account alias, and the sign-in's scopes, without reading any recorded data.",
    input: { type: "object", properties: {}, additionalProperties: false },
    output: PROBE_SCHEMA,
    async run(_input, call) {
      const answer = await provider.call(call.account, "get_current_user", {}, call)
      const user = readCurrentUser(answer)
      if (user === undefined) {
        throw new RegisterError(
          refusal(
            "UNAVAILABLE",
            "Affinity's get_current_user did not name the organisation, the signed-in user and their address",
            "Try again; if it keeps failing, check the plugin's status."
          )
        )
      }
      const scopes = scopesOf(user)
      return probeResult({ source: SOURCE, account: call.account, owner: ownerOf(user) }, scopes.length === 0 ? {} : { scopes })
    }
  }
}
