# @sportify/shared-config

Tooling-only configuration. The sole public export is ./typescript.json; no runtime entry point, environment values or secrets are exported. All workspace projects consume this config through a workspace:* development dependency. The config extends the repository strict baseline and is intended for this private monorepo.
