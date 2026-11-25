# Security policy

## Supported versions

The plugin follows the contract's version line: each release is a `vX.Y.Z` tag, and while it is `0.x` a minor release
may break. Only the latest release is supported.

## Reporting a vulnerability

Do not open a public issue. Use this repository's private vulnerability reporting (Security → Report a vulnerability).
Include:

- the plugin version and the OpenCode release;
- the call, with any credential and personal data removed;
- what you observed, and what you expected.

You will get an answer within seven days. If the report is accepted, a fix ships in a patch release, and the advisory
names the affected versions. If it is a contract issue rather than this plugin's, it is filed in
[plugin-contract](https://github.com/we-the-rebel-alliance/plugin-contract/issues) and this repository's advisory
points there.

## Scope

In scope: the plugin's code, its manifest, its skills and docs. Out of scope: Affinity's own service, OpenCode itself,
and a person who confirms a change they did not read. The plugin holds no credential; the vendor's MCP server does, and
its own security policy covers it.
