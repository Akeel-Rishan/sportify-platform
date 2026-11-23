# Step 09 approved website and hostname storage rules

**Structural policy approved under D-24; storage installed and Oracle-verified under D-27.** [Current gates](step09-verification.md). The disposition matrix defers DOMAINS and DOMAIN_VERIFICATIONS. WEBSITE_SETTINGS.SUBDOMAIN_SLUG is the sole approved platform-host routing source; no competing domain ownership table is introduced.

WEBSITE_THEMES is platform-owned metadata. WEBSITE_SETTINGS belongs to a tenant/business through a composite FK, with one configuration per business, selected theme and DRAFT/PUBLISHED/UNPUBLISHED state. Publishing requires a timestamp at storage level; complete setup, an enabled approved theme and safe content remain future application validation. One MVP theme is intended, but no theme code/asset is approved for a deterministic seed yet. The catalog is deliberately empty.

## Approved host reservation policy

Normalize before storage to a lowercase ASCII DNS label of at most 63 characters, excluding leading/trailing hyphens. The database rejects uppercase and invalid/non-ASCII characters rather than silently normalizing them. It rejects admin, api and dashboard. Deployment-specific reserved names may be added only through reviewed validation and forward constraints where needed. The unconditional unique slug key reserves a label across DRAFT, PUBLISHED and UNPUBLISHED rows and across all tenants. No magic tenant, nullable ownership escape, custom domain or alternate active-host uniqueness is used.

Unpublishing retains the reservation. Rename, deletion, retirement/reassignment and hostname reuse workflows remain disabled/unimplemented until an explicit policy is approved. A label row neither verifies DNS nor authorizes a supplied Host/Forwarded header; later trusted-host parsing and tenant-safe caching must enforce that boundary. There is no DNS, certificate, routing API or rendering change in this step.

## Content, locales and media

Configuration uses existing relational branding/contact/display fields, not arbitrary theme JSON, scripts, executable HTML or a page builder. Supported presentation locales remain English/Sinhala/Tamil, inherited through the existing tenant language setting; no new localization system or rewrite of applied tenant constraints is introduced. Backend boundary validation must restrict supported locales and validate safe URLs/content before saving.

WEBSITE_MEDIA records stable relative object keys, content type, byte size, sort and lifecycle metadata. Tenant/business/location/resource references preserve the composite ownership chain. SQL rejects absolute/signed URLs, query strings, backslashes and dot-traversal segments as canonical object keys. That check does not verify the object's existence, authorization, media format or malware status. No credentials or signed URL is stored as canonical identity.

Later upload services must validate/re-encode permitted images, check size and MIME signatures, scan as needed, authorize storage access and generate short-lived signed URLs. Deactivate metadata before a separately authorized deletion/reconciliation process; do not delete an object referenced by published content. Numeric storage retention and irreversible purge are not approved or implemented. Schema owner privileges can still alter/delete these rows; current API/worker object grants remain none.
