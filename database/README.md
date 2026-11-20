# Database workspace

Step 05 is design-only. The working [MVP design package](../Docs/database/README.md) owns table scope, dictionary, constraints, transactions, finance, index and migration proposals.

`python database/design/verify-design.py` performs read-only standard-library structural/documentation checks. It does not connect to Oracle or execute SQL. Executable migrations, seeds, procedures and index scripts remain future work; original broad bootstrap/reference SQL stays preserved under Docs.
