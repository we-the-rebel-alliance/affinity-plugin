import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import type { Plugin } from "@opencode/plugin"
import { describe, expect, test } from "vitest"
import { readSkills, registerSkills } from "../../src/skills.ts"

const root = fileURLToPath(new URL("../..", import.meta.url))

/** A temporary `skills/` directory holding one file per entry. */
async function fixture(files: Readonly<Record<string, string>>): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "affinity-skills-"))
  for (const [name, text] of Object.entries(files)) {
    await mkdir(join(directory, name), { recursive: true })
    await writeFile(join(directory, name, "SKILL.md"), text)
  }
  return directory
}

describe("the bundled skills", () => {
  test("are read with their frontmatter name, description and body", () => {
    const skills = readSkills()
    expect(skills.map((skill) => skill.id)).toEqual(["affinity", "affinity-write"])

    const read = skills.find((skill) => skill.id === "affinity")
    if (read === undefined) throw new Error("the affinity skill is missing")
    expect(read.name).toBe("affinity")
    expect(read.description).toMatch(/^Read the firm's Affinity CRM: companies/)
    expect(read.description).toMatch(/Not for another CRM, a calendar or a notes app\.$/)
    expect(read.content).toMatch(/^# Reading Affinity\n/)
    expect(read.content).not.toContain("---")
    expect(read.path).toBe(join(root, "skills", "affinity", "SKILL.md"))

    const change = skills.find((skill) => skill.id === "affinity-write")
    if (change === undefined) throw new Error("the affinity-write skill is missing")
    expect(change.name).toBe("affinity-write")
    expect(change.description).toMatch(/^Before any change in the firm's Affinity CRM: create or update/)
    expect(change.content).toMatch(/^# Changing Affinity\n/)
    expect(change.path).toBe(join(root, "skills", "affinity-write", "SKILL.md"))
  })
})

describe("YAML frontmatter", () => {
  test("folds and keeps block scalars as YAML specifies", async () => {
    const cases = [
      ["folded", ">", "first line second line\n"],
      ["literal", "|", "first line\nsecond line\n"],
      ["folded-strip", ">-", "first line second line"],
      ["literal-strip", "|-", "first line\nsecond line"]
    ] as const
    for (const [name, marker, expected] of cases) {
      const directory = await fixture({ [name]: `---\nname: ${name}\ndescription: ${marker}\n  first line\n  second line\n---\n\n# Body\n` })
      try {
        expect(readSkills(directory)[0]?.description).toBe(expected)
      } finally {
        await rm(directory, { recursive: true, force: true })
      }
    }
  })

  test("refuses an empty description, a marker-only description and invalid YAML", async () => {
    const empty = await fixture({ empty: "---\nname: empty\ndescription: >\n---\n\n# Body\n" })
    try {
      expect(() => readSkills(empty)).toThrow(/has no frontmatter description/)
    } finally {
      await rm(empty, { recursive: true, force: true })
    }
    const markers = [
      ["folded", ">"],
      ["literal", "|"],
      ["folded-strip", ">-"],
      ["literal-strip", "|-"]
    ] as const
    for (const [name, marker] of markers) {
      const directory = await fixture({ [name]: `---\nname: ${name}\ndescription: '${marker}'\n---\n\n# Body\n` })
      try {
        expect(() => readSkills(directory)).toThrow(/only a block marker/)
      } finally {
        await rm(directory, { recursive: true, force: true })
      }
    }
    const broken = await fixture({ broken: "---\nname: broken\ndescription: [unclosed\n---\n\n# Body\n" })
    try {
      expect(() => readSkills(broken)).toThrow(/has frontmatter that is not valid YAML/)
    } finally {
      await rm(broken, { recursive: true, force: true })
    }
  })
})

describe("a skill file", () => {
  test("must have the frontmatter shape the plugin registers", async () => {
    const cases: readonly [string, Readonly<Record<string, string>>, RegExp][] = [
      ["no frontmatter", { broken: "# Broken\n" }, /SCHEMA_VIOLATION: skills\/broken\/SKILL.md has no frontmatter\. Next step: /],
      ["no name", { broken: "---\ndescription: A description.\n---\n\n# Body\n" }, /has no frontmatter name/],
      ["another name", { broken: "---\nname: other\ndescription: A description.\n---\n\n# Body\n" }, /names "other", not its directory "broken"/],
      ["no description", { broken: "---\nname: broken\n---\n\n# Body\n" }, /has no frontmatter description/],
      ["empty content", { broken: "---\nname: broken\ndescription: A description.\n---\n\n" }, /has no content below its frontmatter/]
    ]
    for (const [name, files, expected] of cases) {
      const directory = await fixture(files)
      try {
        expect(() => readSkills(directory), name).toThrow(expected)
      } finally {
        await rm(directory, { recursive: true, force: true })
      }
    }
    const missing = await fixture({ empty: "" })
    try {
      await rm(join(missing, "empty", "SKILL.md"))
      expect(() => readSkills(missing)).toThrow(/skills\/empty\/SKILL.md is missing/)
    } finally {
      await rm(missing, { recursive: true, force: true })
    }
    const none = await mkdtemp(join(tmpdir(), "affinity-skills-"))
    try {
      expect(() => readSkills(none)).toThrow(/skills\/ holds no <name>\/SKILL\.md/)
    } finally {
      await rm(none, { recursive: true, force: true })
    }
  })
})

describe("registerSkills", () => {
  test("adds every checked skill and returns a disposer", async () => {
    const added: { id: string; name: string; description: string; path: string; content: string }[] = []
    let disposed = false
    const context = {
      skill: {
        async transform(callback: (editor: { add: (skill: (typeof added)[number]) => void }) => void) {
          callback({ add: (skill) => added.push(skill) })
          return {
            async dispose() {
              disposed = true
            }
          }
        }
      }
    } as unknown as Plugin.Context
    const registration = await registerSkills(context)
    expect(added.map((skill) => skill.id)).toEqual(["affinity", "affinity-write"])
    for (const skill of added) {
      expect(skill.name).toBe(skill.id)
      expect(skill.description.trim()).not.toBe("")
      expect(skill.content.trim()).not.toBe("")
      expect(skill.path).toBe(join(root, "skills", skill.id, "SKILL.md"))
    }
    await registration.dispose()
    expect(disposed).toBe(true)
  })
})
