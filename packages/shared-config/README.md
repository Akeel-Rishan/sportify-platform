# @sportify/shared-config

Tooling-only configuration. The sole public export is ./typescript.json; no runtime entry point, environment values or secrets are exported. All workspace projects consume this config through a workspace:* development dependency. Strict defaults live in this self-contained export; the repository root config extends it. This avoids relative paths escaping through a node_modules workspace symlink in type-aware tooling.
