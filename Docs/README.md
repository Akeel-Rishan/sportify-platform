# SPORTIFY documentation

Current stage, 20 November 2026: **Step 04 API foundation awaiting user verification**. The API now has versioned response/error conventions, server-owned request IDs, safe structured logs, runtime DTO validation and application-only health/readiness endpoints. Step 03 quality tooling, static web foundation and idle worker remain in place. Business workflows and Oracle are not connected. The Step 01 baseline below remains the requirements reference; see [progress](planning/progress.md) for executed checks and limitations.

The workspace already uses `Docs/`. Keep that spelling in paths and links, including on case-sensitive Linux systems; it is the existing equivalent of the requested `docs/` directory. Original uploads remain in place. There is no `docs/source/` directory.

## Working baseline

| Document                                                           | Purpose                                                                    |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [MVP scope](planning/mvp-scope.md)                                 | First-release capabilities, actors, workflows and boundaries               |
| [Requirements traceability](planning/requirements-traceability.md) | Stable requirements, source sections, ownership and verification           |
| [Decision register](planning/decision-register.md)                 | Established direction, conflicts and unapproved recommendations            |
| [Development roadmap](planning/development-roadmap.md)             | Dependency-ordered steps and completion gates                              |
| [Definition of done](quality/definition-of-done.md)                | Evidence required to call work complete                                    |
| [Product quality bar](design/product-quality-bar.md)               | Concrete visual, responsive, accessibility and localization standards      |
| [Progress and audit evidence](planning/progress.md)                | Repository inventory, checks, review checklist and next-step prerequisites |
| [Project working instructions](../CLAUDE.md)                       | Rules for subsequent implementation steps                                  |
| [Toolchain](architecture/toolchain.md)                             | Pinned versions, compatibility, module boundaries and ARM64 evidence       |
| [Local setup](development/local-setup.md)                          | Install, develop, build and stop the scaffold                              |

API guides: [conventions](api/conventions.md), [safe errors](api/errors.md), and [health/readiness](api/health-and-readiness.md).

## Source register

Step 03 guides: [environment configuration](development/environment-configuration.md), [testing and commands](development/testing.md), and [CI checks](quality/ci-checks.md).

The short source codes below are used with exact section numbers in the planning documents. They name supplied documents, not external verification of their claims.

| Code    | Source and location                                                                                                                                                                                                            | Reading evidence                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| PRD     | [Master product requirements](01-product-requirements-document.md.pdf)                                                                                                                                                         | All 51 pages read in this conversation                                        |
| MVP     | [MVP scope and business workflows](02-mvp-scope-business-workflows.md.pdf)                                                                                                                                                     | All 29 pages read                                                             |
| ARCH    | [Technical architecture](03-technical-architecture.md.pdf)                                                                                                                                                                     | All 53 pages read                                                             |
| SCHEMA  | [Oracle schema overview](04-oracle-database-schema.md.pdf)                                                                                                                                                                     | All 8 pages read                                                              |
| DB      | [Detailed database specification](SPORTIFY_Database_Design_Package_v1.0/SPORTIFY_Database_Schema_Specification.md)                                                                                                             | Full Markdown read                                                            |
| SQL-001 | [Bootstrap DDL and seeds](SPORTIFY_Database_Design_Package_v1.0/001_sportify_schema.sql)                                                                                                                                       | Full SQL read; 61 table definitions; not executed against Oracle              |
| SQL-002 | [Schema verification queries](SPORTIFY_Database_Design_Package_v1.0/002_verify_schema.sql)                                                                                                                                     | Full SQL read; not executed against Oracle                                    |
| API     | [API specification](SPORTIFY_API_Contract_Package_v1.0/SPORTIFY_API_Specification_v1.0.md) and [PDF edition](SPORTIFY_API_Contract_Package_v1.0/SPORTIFY_API_Specification_v1.0.pdf)                                           | Full Markdown and 21-page PDF reviewed                                        |
| OAS     | [OpenAPI contract](SPORTIFY_API_Contract_Package_v1.0/openapi.yaml)                                                                                                                                                            | All operations and components reviewed; 101 operations, 78 paths, 100 schemas |
| UX      | [UX research, flows and wireframes](SPORTIFY_UX_Design_Package_v1.0/SPORTIFY_UX_Research_User_Flows_Wireframes_v1.0.md) and [PDF edition](SPORTIFY_UX_Design_Package_v1.0/SPORTIFY_UX_Research_User_Flows_Wireframes_v1.0.pdf) | Full Markdown and 12-page PDF reviewed; 16 wireframes                         |

Database diagrams: [core](SPORTIFY_Database_Design_Package_v1.0/SPORTIFY_ERD_01_Core.mmd), [booking and payments](SPORTIFY_Database_Design_Package_v1.0/SPORTIFY_ERD_02_Booking_Payments.mmd), [platform and website](SPORTIFY_Database_Design_Package_v1.0/SPORTIFY_ERD_03_Platform_Website.mmd).

Separate user flows: [owner onboarding](SPORTIFY_UX_Design_Package_v1.0/user_flows/01_business_owner_onboarding.mmd), [guest booking](SPORTIFY_UX_Design_Package_v1.0/user_flows/02_customer_booking.mmd), [manual booking](SPORTIFY_UX_Design_Package_v1.0/user_flows/03_receptionist_manual_booking.mmd), [payment recording](SPORTIFY_UX_Design_Package_v1.0/user_flows/04_payment_recording.mmd), [cancellation](SPORTIFY_UX_Design_Package_v1.0/user_flows/05_booking_cancellation.mmd), [tenant/subscription administration](SPORTIFY_UX_Design_Package_v1.0/user_flows/06_super_admin_tenant_subscription.mmd).

All 21 uploaded files are present. The four required PDFs total 141 pages; all six PDFs total 174 pages. The UX package is now available and is no longer a missing reference. The UX personas and usability targets are hypotheses and proposed goals, not completed user research.

## Requirements precedence and decision status

1. Explicit user instructions and the confirmed Step 01 MVP baseline govern this work.
2. MVP determines first-release scope. PRD supplies product intent and the future roadmap; a broader PRD feature does not override an MVP exclusion.
3. ARCH and SCHEMA/DB supply implementation details. Disagreements between them must be recorded, not silently resolved.
4. API/OAS and UX provide integration and screen-level detail within that scope. Their inconsistencies remain open decisions. An API payload or wireframe alone does not authorize a scope change.
5. Source documents remain historical inputs. Record agreed amendments in the decision register and subsequently update affected contracts deliberately; do not overwrite uploads to hide differences.

Use these labels consistently:

| Label                | Meaning                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Source requirement   | Statement found in a named source section; it can still conflict with another source                                |
| Established baseline | Direction explicitly confirmed by the user's Step 01 request; listed as D-IDs                                       |
| Proposed resolution  | Recommendation for an open Q-ID; not approved and not a license to implement it                                     |
| Approved decision    | A later resolution with recorded user approval, date and affected requirements; no Q-ID has this status yet         |
| Implemented behavior | Working code with linked verification evidence; Step 02 covers foundation processes only, not business requirements |

The traceability file owns requirement IDs and implementation status; the decision register owns reconciliation; the roadmap owns step gates; progress owns audit evidence. Cross-reference these rather than maintaining competing copies of their status.
