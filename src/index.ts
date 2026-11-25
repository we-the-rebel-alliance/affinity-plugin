/**
 * The plugin's server entry: one `register` call wires its methods through the contract's doors, and the `accounts`
 * module registers one Affinity MCP server per alias.
 *
 * Affinity's MCP tools stay its own: the manifest declares them as `mcp:<tool>` rows and no code here writes a
 * pass-through tool. The plugin's own work is its two reads (`events_list`, `probe`), its `status`, and one tool hook
 * that nudges apps after a write completes.
 */
import { Plugin } from "@opencode/plugin"
import { accountsOf, registerAccounts } from "@we-the-rebel-alliance/plugin-contract/accounts"
import { assertHost, register } from "@we-the-rebel-alliance/plugin-contract/register"
import { profileOf, serverConfig } from "./accounts.ts"
import { registerChangedHook } from "./bus.ts"
import { createHandlers } from "./handlers/index.ts"
import { manifest } from "./manifest.ts"
import { createProvider } from "./provider/index.ts"

export default Plugin.define({
  id: manifest.plugin.name,
  async setup(ctx) {
    assertHost(ctx, manifest)
    const options = (ctx.options ?? {}) as Record<string, unknown>
    const accounts = await registerAccounts(ctx, {
      manifest,
      options,
      server: (account) => serverConfig(profileOf(account.profile))
    })
    const plan = accountsOf(manifest, options)
    const registration = await register(
      ctx,
      manifest,
      createHandlers({
        provider: createProvider(ctx),
        hostVersion: ctx.app.version,
        accountProblems: [...accounts.problems, ...(plan.ok ? [] : plan.problems)],
        profiles: plan.ok ? plan.value.accounts : []
      })
    )
    const hook = await registerChangedHook(
      ctx,
      registration.bus,
      accounts.accounts.map((account) => account.alias)
    )
    return async () => {
      await hook.dispose()
      await registration.dispose()
    }
  }
})
