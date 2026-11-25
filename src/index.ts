/**
 * The plugin's server entry: one `register` call wires its methods through the contract's doors, and the `accounts`
 * module registers one Affinity MCP server per alias. The two skills are read from `skills/<id>/SKILL.md` and
 * registered through `ctx.skill.transform`.
 *
 * Affinity's MCP tools stay its own: the manifest declares them as `mcp:<tool>` rows and no code here writes a
 * pass-through tool. The plugin's own work is its two reads (`events_list`, `probe`) and its `status`. It installs no
 * per-request hook: it makes no write of its own and receives no webhook, so there is no nudge to emit.
 */
import { Plugin } from "@opencode/plugin"
import { accountsOf, registerAccounts } from "@we-the-rebel-alliance/plugin-contract/accounts"
import { assertHost, register } from "@we-the-rebel-alliance/plugin-contract/register"
import { profileOf, serverConfig } from "./accounts.ts"
import { createHandlers } from "./handlers/index.ts"
import { manifest } from "./manifest.ts"
import { createProvider } from "./provider/index.ts"
import { loadSkills } from "./skills.ts"

export default Plugin.define({
  id: manifest.plugin.name,
  async setup(ctx) {
    assertHost(ctx, manifest)
    const options = (ctx.options ?? {}) as Record<string, unknown>
    const { skills, problems: skillProblems } = await loadSkills()
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
        skillProblems,
        profiles: plan.ok ? plan.value.accounts : []
      })
    )
    const skillRegistration = await ctx.skill.transform((editor) => {
      for (const skill of skills) editor.add(skill)
    })
    return async () => {
      await skillRegistration.dispose()
      await registration.dispose()
    }
  }
})
