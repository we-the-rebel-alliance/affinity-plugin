# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.0.0 (unreleased)

### Added

- `events_list` is a tool the model sees, not only a tools-RPC method: `affinity_events_list` in the `affinity`
  namespace and `tools.affinity.events_list` in Code Mode. It uses the source method's input, description and output,
  runs as the calling session and agent, and remains available over `affinity.crm.tools` for scripts and consumers.

### Changed

- The plugin requires OpenCode `>=2.4.1 <2.5.0` and is tested on 2.4.1 only. The old host matrix, per-version test
  installs and code paths for earlier releases are gone.
- The package is `@we-the-rebel-alliance/affinity-plugin` at `0.0.0`; every install line, link and source constant
  names the new repository and its `master` branch.
- The namespace line and the two skill descriptions are the plugin standard's fixed-context text: at most 400
  characters for the namespace and 300 for each description.

### Removed

- The Jelly guide and every Jelly-only paragraph in the README, docs, agent guide and skills. The `jelly` and `sources`
  package keys stay until the plugin-contract v0 adoption replaces them.
- The deprecated `deniedTools` status field; `destructiveTools` is the one name.

[Keep a Changelog]: https://keepachangelog.com/en/1.1.0/
[Semantic Versioning]: https://semver.org/spec/v2.0.0.html
