"""Read-only structural checks of Step 05 Markdown against supplied source SQL.

Uses Python's standard library only. Does not execute SQL or connect to a database.
The Markdown dictionary/register remain authoritative; there is no second model.
"""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / "Docs/database"
SOURCE = ROOT / "Docs/SPORTIFY_Database_Design_Package_v1.0/001_sportify_schema.sql"


def read(path):
    return path.read_text(encoding="utf-8")


def cells(line):
    return [part.strip().strip("`") for part in line.strip().strip("|").split("|")]


def columns(value):
    return tuple(part.strip() for part in value.split(","))


def ensure(condition, explanation):
    if not condition:
        raise ValueError(explanation)


def sections(text):
    return {
        name: body
        for name, body in re.findall(
            r"^## ([A-Z][A-Z_]+)\n(.*?)(?=^## |\Z)", text, re.M | re.S
        )
    }


source_tables = {
    name.upper(): body
    for name, body in re.findall(r"CREATE TABLE (\w+) \(\n(.*?)\n\);", read(SOURCE), re.S)
}
dispositions = {}
for line in read(DOC / "mvp-table-scope.md").splitlines():
    row = cells(line)
    if len(row) == 5 and row[0] in source_tables:
        ensure(row[0] not in dispositions, f"Duplicate disposition: {row[0]}")
        dispositions[row[0]] = row
ensure(set(dispositions) == set(source_tables), "Every source table needs one disposition")
included = {name for name, row in dispositions.items() if row[2] == "MVP"}
deferred = set(source_tables) - included
dictionary = {}
for table, body in sections(read(DOC / "data-dictionary.md")).items():
    dictionary[table] = {}
    for line in body.splitlines():
        row = cells(line)
        if len(row) == 8 and re.fullmatch(r"[A-Z][A-Z0-9_]+", row[0]):
            ensure(all(row), f"Incomplete column definition: {table}.{row[0]}")
            ensure(row[2] in {"Y", "N"}, f"Invalid nullability: {table}.{row[0]}")
            ensure(row[0] not in dictionary[table], f"Duplicate column: {table}.{row[0]}")
            dictionary[table][row[0]] = {"type": row[1], "nullable": row[2] == "Y"}
    ensure(dictionary[table], f"Empty dictionary: {table}")
    for label in ["Purpose/module:", "Ownership:", "PK:", "Public key:", "Tenant path:",
                  "Relationships/cardinality:", "Lifecycle/retention/deletion:", "Sensitivity:"]:
        ensure(label in body, f"Missing table metadata: {table} {label}")
ensure(set(dictionary) == included | {"INVITATION_LOCATIONS", "SUBSCRIPTION_FEATURE_SNAPSHOTS"},
       "Dictionary must match MVP boundary and explicit additions")
for table in included:
    source_columns = set(re.findall(r"^    (\w+)\s+(?:NUMBER|VARCHAR2|CHAR|TIMESTAMP|DATE|CLOB)\b",
                                   source_tables[table], re.M))
    ensure({c.upper() for c in source_columns} <= set(dictionary[table]),
           f"Source column omitted without disposition: {table}")

keys, foreign_keys, names = {}, [], set()
register = read(DOC / "relationships-and-constraints.md")
for line in register.splitlines():
    row = cells(line)
    if len(row) != 7 or row[2] not in {"PK", "UK", "FK"}:
        continue
    table, name, kind, child, parent, target, origin = row
    ensure(name not in names, f"Duplicate named key/FK: {name}")
    names.add(name)
    ensure(table in dictionary, f"Unknown child: {table}")
    cols = columns(child)
    ensure(set(cols) <= set(dictionary[table]), f"Unknown key/FK column: {name}")
    if kind in {"PK", "UK"}:
        keys.setdefault(table, []).append((name, kind, cols))
        if kind == "PK":
            ensure(all(not dictionary[table][c]["nullable"] for c in cols),
                   f"Nullable PK: {name}")
    else:
        foreign_keys.append((name, table, cols, parent, columns(target)))
for table in dictionary:
    ensure(sum(k[1] == "PK" for k in keys.get(table, [])) == 1, f"Need one PK: {table}")
for name, child, cols, parent, target in foreign_keys:
    ensure(parent in dictionary, f"Unknown FK parent: {name}")
    ensure(len(cols) == len(target), f"FK arity: {name}")
    ensure(any(k[2] == target for k in keys[parent]), f"Missing exact parent key: {name}")
    for a, b in zip(cols, target):
        ensure(dictionary[child][a]["type"] == dictionary[parent][b]["type"],
               f"Incompatible FK types: {name}")
    if parent in dispositions and dispositions[parent][1] == "Tenant-owned":
        if child != "AUTH_SESSIONS":
            ensure("TENANT_ID" in cols and "TENANT_ID" in target,
                   f"Missing tenant FK component: {name}")
for table, row in dispositions.items():
    if row[2] == "MVP" and row[1] == "Tenant-owned":
        ensure(not dictionary[table]["TENANT_ID"]["nullable"], f"Nullable tenant: {table}")
for table in {"INVITATION_LOCATIONS", "SUBSCRIPTION_FEATURE_SNAPSHOTS"}:
    ensure(not dictionary[table]["TENANT_ID"]["nullable"], f"Nullable new tenant: {table}")

slot = "RESOURCE_SLOT_RESERVATIONS"
ensure(any(k[1] == "PK" and k[2] == ("TENANT_ID", "RESOURCE_ID", "SLOT_START_UTC")
           for k in keys[slot]), "Slot PK changed")
for parent, owner in [("BOOKING_ITEMS", "BOOKING_ITEM_ID"),
                      ("BOOKING_HOLD_ITEMS", "HOLD_ITEM_ID")]:
    ensure(any(c == slot and p == parent and cols == ("TENANT_ID", owner, "RESOURCE_ID")
               for _, c, cols, p, _ in foreign_keys), "Missing resource-safe slot ownership")
normalized = re.sub(r"\s+", " ", register.lower())
for expression in ["booking_item_id is not null and hold_item_id is null",
                   "booking_item_id is null and hold_item_id is not null"]:
    ensure(expression in normalized, "Missing explicit XOR branch")

dependencies = {table: set() for table in dictionary}
for _, child, _, parent, _ in foreign_keys:
    if child != parent:
        dependencies[child].add(parent)
ordered = []
while dependencies:
    ready = sorted(table for table, parents in dependencies.items() if not parents)
    if "SCHEMA_MIGRATIONS" in ready:
        ready.remove("SCHEMA_MIGRATIONS")
        ready.insert(0, "SCHEMA_MIGRATIONS")
    ensure(ready, "Unexplained FK dependency cycle")
    ordered.extend(ready)
    dependencies = {t: p - set(ready) for t, p in dependencies.items() if t not in ready}

index_count = 0
for table, body in sections(read(DOC / "index-plan.md")).items():
    signatures, leading = set(), []
    for line in body.splitlines():
        row = cells(line)
        if len(row) != 5 or row[1] not in {"Y", "N"}:
            continue
        ensure(row[3], f"Index needs a query purpose: {row[0]}")
        signature = re.sub(r"\s+", "", row[2]).upper()
        ensure(signature not in signatures, f"Duplicate exact index/key expression: {table} {row[0]}")
        signatures.add(signature)
        if re.fullmatch(r"[A-Z_, ]+", row[2].upper()):
            leading.append(columns(row[2].upper()))
        index_count += 1
    for name, child, cols, _, _ in foreign_keys:
        if child == table:
            ensure(any(index[:len(cols)] == cols for index in leading), f"Unindexed FK: {name}")

entities = set()
for diagram in DOC.glob("erd-*.md"):
    text = read(diagram)
    ensure(text.count("```mermaid") == 1 and "erDiagram" in text, f"Missing ERD: {diagram}")
    defined = set(re.findall(r"^\s+([A-Z][A-Z_]+) \{", text, re.M))
    ensure(defined <= set(dictionary), f"Unknown/deferred ERD entity: {diagram}")
    for parent, child in re.findall(r"^\s+([A-Z_]+) [|o}{-]+ ([A-Z_]+) :", text, re.M):
        ensure(parent in defined and child in defined, f"Undeclared ERD entity: {diagram}")
        ensure(any(c == child and p == parent for _, c, _, p, _ in foreign_keys),
               f"ERD edge lacks FK: {parent} -> {child}")
    for table, attrs in re.findall(r"^\s+([A-Z][A-Z_]+) \{\n(.*?)^\s+\}", text, re.M | re.S):
        for datatype, column in re.findall(r"^\s+(\w+) ([A-Z_]+)", attrs, re.M):
            ensure(column in dictionary[table], f"Unknown ERD column: {table}.{column}")
            ensure(dictionary[table][column]["type"].split("(")[0].lower() == datatype,
                   f"ERD datatype mismatch: {table}.{column}")
    entities |= defined
ensure(entities == set(dictionary), "ERDs omit included tables")

for document in [*DOC.glob("*.md"), ROOT / "Docs/README.md",
                 ROOT / "Docs/planning/decision-register.md",
                 ROOT / "Docs/planning/requirements-traceability.md",
                 ROOT / "Docs/planning/progress.md"]:
    text = read(document)
    prose = re.sub(r"```.*?```", "", text, flags=re.S)
    prose = re.sub(r"`[^`\n]+`", "", prose)
    requirements = set(re.findall(r"REQ-\d{3}", read(ROOT / "Docs/planning/requirements-traceability.md")))
    for first, last in re.findall(r"REQ-(\d{3})(?:-(?:REQ-)?(\d{3}))?", text):
        for number in range(int(first), int(last or first) + 1):
            ensure(f"REQ-{number:03}" in requirements, f"Unknown requirement in {document.name}")
    for target in re.findall(r"\]\(([^)]+)\)", prose):
        if re.match(r"https?://|#", target):
            continue
        path, _, fragment = target.partition("#")
        resolved = document.parent / path
        ensure(resolved.exists(), f"Broken Markdown target: {document.name}: {target}")
        if fragment and resolved.suffix == ".md":
            body = read(resolved)
            anchors = set(re.findall(r'<a id="([^"]+)"', body))
            for heading in re.findall(r"^#+ (.+)$", body, re.M):
                slug = re.sub(r"[^\w\s-]", "", heading.lower()).replace(" ", "-")
                anchors.add(slug)
            ensure(fragment in anchors, f"Broken Markdown anchor: {target}")

print(f"PASS: {len(source_tables)} catalog dispositions; {len(included)} included + 2 additions; "
      f"{len(deferred)} deferred; {len(dictionary)} dictionaries; "
      f"{sum(len(c) for c in dictionary.values())} columns; {len(foreign_keys)} compatible FKs")
print(f"PASS: tenant keys, slot PK/XOR/resource owners, FK index coverage, "
      f"{index_count} index/key paths, acyclic dependencies, ERD entities/edges/columns and Markdown links")
print("Proposed creation order (self FKs added after creation): " + ", ".join(ordered))
print("NOT RUN: Oracle DDL, constraint enforcement, concurrency, query plans, driver/TLS or privileges")
