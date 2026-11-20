# Database workspace

Step 05 is design-only. The working [MVP design package](../Docs/database/README.md) owns table scope, dictionary, constraints, transactions, finance, index and migration proposals.

`python database/design/verify-design.py` performs read-only standard-library structural/documentation checks. It does not connect to Oracle or execute SQL. Executable migrations, seeds, procedures and index scripts remain future work; original broad bootstrap/reference SQL stays preserved under Docs.

Step 06 adds [account preparation](provisioning/README.md), the server-only connection package and explicit live verification scripts. No target was designated; actual provisioning/connections remain blocked. No business migration is executable yet.
