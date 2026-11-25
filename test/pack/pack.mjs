/**
 * The packed tarball: what `npm pack` publishes, and that the extracted entry loads.
 *
 * `npm pack` reads `files` in package.json, so this proves the dist entry, both skills, the three icons, the README and
 * the licence are in the package a person installs — and that nothing the repository keeps for development is. The
 * extracted entry is imported from a directory inside the repository, so module resolution reaches the repository's own
 * `node_modules` for the host's `@opencode/*` externals.
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const work = join(root, ".pack-test")

/** Fail with one line, so a person reads what is missing rather than a stack. */
function check(condition, message) {
  if (!condition) {
    console.error(`pack: ${message}`)
    process.exit(1)
  }
}

rmSync(work, { recursive: true, force: true })
mkdirSync(work, { recursive: true })
try {
  const packed = execFileSync("npm", ["pack", "--json", "--pack-destination", work], { cwd: root, encoding: "utf8" })
  const info = JSON.parse(packed)[0]
  check(typeof info?.filename === "string", "npm pack named no tarball")
  execFileSync("tar", ["-xzf", join(work, info.filename), "-C", work])

  const pkgDir = join(work, "package")
  const required = [
    "dist/index.js",
    "skills/affinity/SKILL.md",
    "skills/affinity-write/SKILL.md",
    "assets/icon.svg",
    "assets/icon-128.png",
    "assets/icon-256.png",
    "README.md",
    "LICENSE",
    "package.json"
  ]
  for (const file of required) check(existsSync(join(pkgDir, file)), `${file} is not in the tarball`)
  for (const file of ["src", "test", "node_modules", "tsconfig.json", "biome.json", "fixtures"]) {
    check(!existsSync(join(pkgDir, file)), `${file} is in the tarball, and development files are not published`)
  }

  const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"))
  check(pkg.name === "@we-the-rebel-alliance/affinity-plugin", `the tarball's package is ${String(pkg.name)}`)
  check(pkg.version === "0.0.1", `the tarball's version is ${String(pkg.version)}`)
  check(pkg.capabilities?.plugin?.name === "affinity", "the tarball carries no affinity manifest")
  check(pkg.exports?.["./server"] === "./dist/index.js", "the tarball names no ./server entry")
  check(pkg.dependencies === undefined, "the tarball declares runtime dependencies")

  const module = await import(pathToFileURL(join(pkgDir, "dist/index.js")).href)
  check(module.default?.id === "affinity", `the extracted entry exports ${String(module.default?.id ?? module.default)}`)

  console.log(`pack: ${info.filename} carries the entry, both skills, the icons, README and LICENSE, and its ${String(module.default?.id ?? "?")} plugin loads`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
