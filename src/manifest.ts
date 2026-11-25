/**
 * The installed package's identity and manifest, read from `package.json` beside the built entry.
 *
 * `capabilities` is the one manifest (contract §4). The register, the catalog and the conformance kit all read it from
 * disk; this module only points at it, so no copy of the manifest lives in the source.
 */
import { readFileSync } from "node:fs"
import type { Manifest } from "@we-the-rebel-alliance/plugin-contract/manifest"

interface Package {
  readonly name: string
  readonly version: string
  readonly capabilities: Manifest
}

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as Package

/** The plugin's one manifest. */
export const manifest: Manifest = pkg.capabilities
/** The installed package's version, as `status` reports it. */
export const version: string = pkg.version
/** The package name every page names. */
export const PACKAGE: string = pkg.name
