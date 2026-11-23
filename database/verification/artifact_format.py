"""Read the declared index-expression list format; never execute SQL."""

def split_expressions(value):
    parts = []
    start = 0
    depth = 0
    quoted = False
    index = 0
    while index < len(value):
        char = value[index]
        if char == "'":
            if quoted and index + 1 < len(value) and value[index + 1] == "'":
                index += 2
                continue
            quoted = not quoted
        elif not quoted:
            if char == '(':
                depth += 1
            elif char == ')':
                depth -= 1
                assert depth >= 0, 'Unbalanced declared expression.'
            elif char == ',' and depth == 0:
                parts.append(value[start:index].strip())
                start = index + 1
        index += 1
    assert not quoted and depth == 0, 'Unbalanced declared expression.'
    parts.append(value[start:].strip())
    assert all(parts), 'Empty declared expression.'
    return parts
