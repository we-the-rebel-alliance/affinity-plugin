/**
 * The built bundle's accounts on the real OpenCode 2.4.1 host, in an empty project with an isolated HOME and XDG
 * directories.
 *
 * The mechanism is `mcp`, so every account is one server the host itself lists: `affinity` for `default` and
 * `affinity-<alias>` for a named alias. The options are injected the way the kit's `createHost` injects them, by
 * wrapping the loaded definition's `setup`; everything else is the real host. No Affinity sign-in exists here, so a
 * server may be pending or need auth: the test asserts the registration the person's configuration produces, not a
 * live connection.
 */
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Plugin } from "@opencode/plugin"
import { waitForActivation } from "@we-the-rebel-alliance/plugin-contract/kit"
import { afterAll, beforeAll, describe, expect, test } from "vitest"

const HOME_KEYS = ["HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_DATA_HOME", "XDG_STATE_HOME"] as const
type HomeKey = (typeof HOME_KEYS)[number]

/** The host's own answer, structurally: the SDK's client type leaves this domain untyped here. */
interface ListedServer {
  readonly name: string
}
interface ListedPlugin {
  readonly id?: string | undefined
  readonly state: { readonly status: string }
}

let home = ""
const previous = new Map<HomeKey, string | undefined>()

beforeAll(async () => {
  home = await mkdtemp(join(tmpdir(), "affinity-mcp-home-"))
  for (const key of HOME_KEYS) previous.set(key, process.env[key])
  process.env["HOME"] = home
  process.env["XDG_CONFIG_HOME"] = join(home, "config")
  process.env["XDG_CACHE_HOME"] = join(home, "cache")
  process.env["XDG_DATA_HOME"] = join(home, "data")
  process.env["XDG_STATE_HOME"] = join(home, "state")
})

afterAll(async () => {
  for (const key of HOME_KEYS) {
    const value = previous.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  await rm(home, { recursive: true, force: true })
})

/** The definition with the options a person's configuration would give it, the way the kit's `createHost` does. */
function withOptions(definition: Plugin.Plugin, options: Readonly<Record<string, unknown>>): Plugin.Plugin {
  return {
    id: definition.id,
    setup: (context) =>
      definition.setup(
        new Proxy(context, {
          get: (target, property, receiver) => (property === "options" ? options : Reflect.get(target, property, receiver))
        })
      )
  }
}

/** Boots the real host in a fresh empty project, and answers the plugin's own MCP servers it lists. */
async function registered(options: Readonly<Record<string, unknown>>): Promise<string[]> {
  const project = await mkdtemp(join(tmpdir(), "affinity-mcp-project-"))
  const { OpenCode } = await import("@opencode/sdk")
  const loaded = (await import(new URL("../../dist/index.js", import.meta.url).href)) as { readonly default: Plugin.Plugin }
  const host = await OpenCode.create({
    plugins: [withOptions(loaded.default, options)],
    config: { directory: project },
    app: { name: "opencode", version: "2.4.1" },
    log: { level: "error", emit: () => undefined }
  })
  try {
    const session = await host.sessions.create({ location: { directory: project }, agent: "build", permissions: [] })
    await host.sessions.prompt({ sessionID: session.id, text: "activate the accounts test", delivery: "queue" }).catch(() => undefined)
    await waitForActivation({
      isActive: async () => {
        const list = (await host.plugin.list({ location: { directory: project } })) as { readonly data: readonly ListedPlugin[] }
        return list.data.some((entry) => entry.id === "affinity" && entry.state.status === "active")
      },
      timeoutMs: 30_000
    })
    const listed = (await host.mcp.list({ location: { directory: project } })) as { readonly data: readonly ListedServer[] }
    return listed.data
      .map((server) => server.name)
      .filter((name) => name === "affinity" || name.startsWith("affinity-"))
      .sort()
  } finally {
    await host.close()
    await rm(project, { recursive: true, force: true })
  }
}

describe("the built plugin's accounts on OpenCode 2.4.1", () => {
  test("registers the default server as affinity when no accounts are configured", async () => {
    expect(await registered({})).toEqual(["affinity"])
  }, 60_000)

  test("registers one server per alias, and no default, when aliases are configured", async () => {
    expect(await registered({ accounts: { work: {}, personal: {} } })).toEqual(["affinity-personal", "affinity-work"])
  }, 60_000)
})
