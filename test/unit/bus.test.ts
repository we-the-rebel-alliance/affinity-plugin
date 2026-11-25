/**
 * The one nudge: a completed non-read `mcp:` call emits `changed` for its alias, through the bus `register` built.
 *
 * The hook is the only bus wiring in the plugin, and it is a tool-result hook that adds no model text: it returns
 * nothing and never changes the tool's answer. A read, a failed call and another plugin's tool emit nothing.
 */
import type { Bus } from "@we-the-rebel-alliance/plugin-contract/bus"
import { describe, expect, test } from "vitest"
import { CHANGED_CAPABILITY, CHANGED_REASON, changedTools, type HookContext, registerChangedHook } from "../../src/bus.ts"
import { manifest } from "../../src/manifest.ts"

/** A tool hook domain that captures the callback, so a test can drive it as the host would. */
function capturingHook() {
  const callbacks: ((event: unknown) => Promise<void>)[] = []
  const disposed: { count: number } = { count: 0 }
  return {
    disposed,
    ctx: {
      tool: {
        hook: async (_name: string, callback: (event: unknown) => Promise<void>) => {
          callbacks.push(callback)
          return {
            dispose: async () => {
              disposed.count++
            }
          }
        }
      }
    },
    async fire(event: unknown) {
      for (const callback of callbacks) await callback(event)
    }
  }
}

/** A bus that records what it was asked to emit, and answers the host's result. */
function recordingBus(result: Awaited<ReturnType<Bus["emit"]>> = { ok: true }): Bus & { readonly emitted: { readonly event: string; readonly data: unknown }[] } {
  const emitted: { event: string; data: unknown }[] = []
  return {
    name: "affinity",
    emitted,
    async emit(event, data) {
      emitted.push({ event, data })
      return result
    }
  }
}

describe("the changed hook", () => {
  test("covers every non-read vendor tool, per alias, and no read tool", () => {
    const tools = changedTools(["work", "personal"])
    const nonRead = Object.entries(manifest.methods).filter(([method, item]) => method.startsWith("mcp:") && item.class !== "read").length
    expect(tools.size).toBe(nonRead * 2)
    expect(nonRead).toBe(35)
    expect(tools.get("affinity-work_create_company")).toBe("work")
    expect(tools.get("affinity-personal_delete_note")).toBe("personal")
    expect(tools.get("affinity-work_merge_companies")).toBe("work")
    expect(tools.get("affinity-work_issue_entity_files_download_token")).toBe("work")
    expect(tools.has("affinity-work_get_meetings")).toBe(false)
    expect(tools.has("affinity-work_status")).toBe(false)
    expect(tools.has("lackey-work_create_company")).toBe(false)
  })

  test("emits one changed for a completed write, with the capability, the alias and the reason", async () => {
    const captured = capturingHook()
    const bus = recordingBus()
    const hook = await registerChangedHook(captured.ctx as unknown as HookContext, bus, ["work", "personal"])
    await captured.fire({ tool: "affinity-work_create_company", status: "completed" })
    expect(bus.emitted).toEqual([{ event: "changed", data: { capability: CHANGED_CAPABILITY, account: "work", reason: CHANGED_REASON } }])
    expect(CHANGED_CAPABILITY).toBe("affinity.meetings")
    expect(CHANGED_REASON).toBe("write")
    await hook.dispose()
    expect(captured.disposed.count).toBe(1)
  })

  test("emits nothing for a read, a failed call, another plugin's tool or a plain method", async () => {
    const captured = capturingHook()
    const bus = recordingBus()
    await registerChangedHook(captured.ctx as unknown as HookContext, bus, ["work", "personal"])
    await captured.fire({ tool: "affinity-work_get_meetings", status: "completed" })
    await captured.fire({ tool: "affinity-work_create_company", status: "error" })
    await captured.fire({ tool: "affinity-personal_update_note", status: "error" })
    await captured.fire({ tool: "lackey-work_create_company", status: "completed" })
    await captured.fire({ tool: "affinity_events_list", status: "completed" })
    expect(bus.emitted).toEqual([])
  })

  test("never fails a turn when the host cannot take the nudge", async () => {
    const captured = capturingHook()
    const bus = recordingBus({ ok: false, reason: "unavailable" })
    await registerChangedHook(captured.ctx as unknown as HookContext, bus, ["work"])
    await expect(captured.fire({ tool: "affinity-work_create_company", status: "completed" })).resolves.toBeUndefined()
    expect(bus.emitted).toHaveLength(1)
  })

  test("returns nothing, so the tool's answer is untouched", async () => {
    const captured = capturingHook()
    await registerChangedHook(captured.ctx as unknown as HookContext, recordingBus(), ["work"])
    await expect(captured.fire({ tool: "affinity-work_create_company", status: "completed" })).resolves.toBeUndefined()
  })
})
