// Every string the model reads must be honest under the default, where every tool runs without asking, and must keep
// to the fixed-context budget: the namespace line is at most 400 characters and each skill description at most 300.
import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { NAMESPACE_DESCRIPTION } from "../../src/constants.js"
import { parseSkill, SKILLS_DIR } from "../../src/skills.js"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const read = (path: string) => readFileSync(join(ROOT, path), "utf8")

/** Every sentence the model is given: the namespace, the skills, the Jelly line. */
export function modelTexts(): [string, string][] {
  const jelly = JSON.parse(read("package.json")) as { jelly: { summary: string } }
  return [
    ["src/constants.ts (namespace)", NAMESPACE_DESCRIPTION],
    ["package.json (jelly summary)", jelly.jelly.summary],
    ...readdirSync(join(ROOT, "skills")).map((name): [string, string] => [`skills/${name}/SKILL.md`, read(`skills/${name}/SKILL.md`)]),
  ]
}

/** A claim that a tool asks, waits for approval, or is off. */
const CLAIM = /(?:(?:a|each|every|any|the) (?:tool|tools|change|changes|export|exports|pin|pins|write|writes|delete|deletes|merge|merges|call|calls) (?:asks?|ask) (?:the user|first|you|before|each time|every time|for (?:each|every))|(?:tools|changes|exports|writes|pins|deletes|merges) (?:ask|asks) (?:the user|first|you|before|each time|every time|for (?:each|every))|it asks? (?:the user|first)|asks? (?:the user )?(?:before|each time|every time|for (?:each|every))|may ask|(?:is|are) off|(?:the user|you) approv|\bpermission prompt (?:is|shows)\b|\bprompt (?:is|shows) (?:the user's|your)\b)/iu
/** The value that makes such a claim true. */
const VALUE = /\baccess\b|\bask-changes\b|\bread-only\b/u

describe("the text the model is given", () => {
  test("says a tool asks or is off only in a sentence that names the value", () => {
    for (const [file, text] of modelTexts()) {
      for (const sentence of text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter(Boolean)) {
        if (!CLAIM.test(sentence)) continue
        expect({ file, sentence, namesValue: VALUE.test(sentence) }).toEqual({ file, sentence, namesValue: true })
      }
    }
  })

  test("keeps the fixed-context budget: namespace <= 400 characters and each skill description <= 300", () => {
    expect(NAMESPACE_DESCRIPTION.length).toBeGreaterThan(0)
    expect(NAMESPACE_DESCRIPTION.length).toBeLessThanOrEqual(400)
    for (const name of readdirSync(SKILLS_DIR)) {
      const text = read(`skills/${name}/SKILL.md`)
      const description = parseSkill(name, join(SKILLS_DIR, name, "SKILL.md"), text).description ?? ""
      expect({ name, over: description.length > 300 }).toEqual({ name, over: false })
    }
  })
})
