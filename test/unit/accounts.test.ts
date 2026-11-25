/**
 * Accounts: one Affinity MCP server per alias, the profile's optional client id, and the two account refusals.
 *
 * The names come from the contract's one rule, so a person signs in and a tool is permitted under the same name, and a
 * rule for one alias can never reach another alias's tools.
 */
import { accountName, accountsOf, resolveAccount } from "@we-the-rebel-alliance/plugin-contract/accounts"
import { describe, expect, test } from "vitest"
import { OAUTH_SCOPE, profileOf, serverConfig, serverName } from "../../src/accounts.ts"
import { manifest } from "../../src/manifest.ts"

const CLIENT_ID = "5d8b4c1e-7a2f-4d3b-9c6e-1f0a2b3c4d5e"

/** The accounts plan for one options value. */
function plan(options: Record<string, unknown>) {
  const checked = accountsOf(manifest, options)
  if (!checked.ok) throw new Error(checked.problems.join("; "))
  return checked.value
}

describe("account names", () => {
  test("derive one MCP server per alias from the plugin's one name", () => {
    expect(accountName("affinity", "default")).toBe("affinity")
    expect(accountName("affinity", "work")).toBe("affinity-work")
    expect(serverName("default")).toBe("affinity")
    expect(serverName("work")).toBe("affinity-work")
    expect(serverName("personal")).toBe("affinity-personal")
  })

  test("sign in with the pinned scope and no client id unless the profile names one", () => {
    expect(OAUTH_SCOPE).toBe("mcp mcp.read offline_access")
    expect(serverConfig({}).oauth).toEqual({ scope: OAUTH_SCOPE })
    expect(serverConfig(profileOf({ clientId: CLIENT_ID })).oauth).toEqual({ client_id: CLIENT_ID, scope: OAUTH_SCOPE })
    // A client id that is not a string is ignored, never sent.
    expect(profileOf({ clientId: 42 })).toEqual({})
    expect(profileOf(undefined)).toEqual({})
    expect(profileOf({ clientId: "" })).toEqual({})
  })
})

describe("the accounts plan", () => {
  test("is one default account without an accounts option", () => {
    const value = plan({})
    expect(value.mechanism).toBe("mcp")
    expect(value.accounts).toEqual([{ alias: "default" }])
    expect(resolveAccount(value.accounts, {})).toMatchObject({ ok: true, alias: "default" })
  })

  test("serves several aliases at once, each with its own profile", () => {
    const value = plan({ accounts: { work: {}, personal: { clientId: CLIENT_ID } } })
    expect(value.accounts.map((account) => account.alias)).toEqual(["work", "personal"])
    expect(value.accounts[1]?.profile).toEqual({ clientId: CLIENT_ID })
  })

  test("refuses an alias that breaks the rule, naming its path", () => {
    const checked = accountsOf(manifest, { accounts: { Work: {} } })
    expect(checked.ok).toBe(false)
  })

  test("asks which alias with two accounts, and names the aliases", () => {
    const value = plan({ accounts: { work: {}, personal: {} } })
    const missing = resolveAccount(value.accounts, {})
    expect(missing.ok).toBe(false)
    if (!missing.ok) {
      expect(missing.code).toBe("ACCOUNT_REQUIRED")
      expect(missing.next).toContain("work")
      expect(missing.next).toContain("personal")
    }
  })

  test("refuses an alias the plugin does not serve", () => {
    const value = plan({ accounts: { work: {}, personal: {} } })
    const unknown = resolveAccount(value.accounts, { account: "nobodyhere" })
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.code).toBe("ACCOUNT_UNKNOWN")
  })
})
