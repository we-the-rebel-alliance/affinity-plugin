import { describe, expect, test } from "vitest"
import { parseSkill } from "../../src/skills.ts"

const skill = (name: string, description: string, body: string) => `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`
const path = (name: string) => `/tmp/skills/${name}/SKILL.md`

describe("parseSkill", () => {
  test("reads the name, description and body of a valid skill", () => {
    const parsed = parseSkill("affinity", path("affinity"), skill("affinity", "Use Affinity.", "The body."))
    expect(parsed.id).toBe("affinity")
    expect(parsed.name).toBe("affinity")
    expect(parsed.description).toBe("Use Affinity.")
    expect(parsed.path).toBe(path("affinity"))
    expect(parsed.content).toBe("The body.")
  })

  test("refuses a name that is not its directory", () => {
    expect(() => parseSkill("affinity", path("affinity"), skill("other", "Use Affinity.", "The body."))).toThrow(/must be named "affinity"/)
  })

  test("refuses a missing description", () => {
    expect(() => parseSkill("affinity", path("affinity"), "---\nname: affinity\n---\n\nThe body.")).toThrow(/has no description/)
  })

  test("refuses an empty body", () => {
    expect(() => parseSkill("affinity", path("affinity"), "---\nname: affinity\ndescription: Use Affinity.\n---\n\n")).toThrow(/has an empty body/)
  })
})
