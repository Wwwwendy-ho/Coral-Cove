"""CSS clean-up for the app's styles, editing only the rules it changes (everything else stays byte for byte).
   It works on the built index.html, where every style block is in order, then copies the changes back into
   src/css/ (tools/build.py --unbuild).
   unused  <class> ...   remove selectors that use any of these classes (and rules left with no selectors)
   dead                  remove declarations that a later rule with the identical selector, in the same
                         @media/@supports context, overrides (same property, not !important-protected)
   Usage: python3 cssedit.py unused cls1 cls2 ...  |  python3 cssedit.py dead  |  python3 cssedit.py keyframes"""
import os, re, subprocess, sys, tinycss2

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')

def blocks(html):
    for m in re.finditer(r'(<style[^>]*>)(.*?)</style>', html, re.S):
        yield m.start(2), m.group(2)

def scan_to(css, i, stop):
    """Index of the first character in `stop` at depth 0 from i, skipping strings, comments and brackets."""
    depth = 0; n = len(css)
    while i < n:
        c = css[i]
        if c == '/' and css.startswith('/*', i): i = css.index('*/', i + 2) + 2; continue
        if c in '"\'':
            j = i + 1
            while css[j] != c: j += 2 if css[j] == '\\' else 1
            i = j + 1; continue
        if c in '([': depth += 1
        elif c in ')]': depth -= 1
        elif depth == 0 and c in stop: return i
        i += 1
    return n

def rule_end(css, s):
    """End offset (after the closing brace) of the rule starting at s."""
    b = scan_to(css, s, '{'); depth = 0; i = b; n = len(css)
    while i < n:
        c = css[i]
        if c == '/' and css.startswith('/*', i): i = css.index('*/', i + 2) + 2; continue
        if c in '"\'':
            j = i + 1
            while css[j] != c: j += 2 if css[j] == '\\' else 1
            i = j + 1; continue
        if c == '{': depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0: return i + 1
        i += 1
    raise SystemExit('unclosed rule at %d' % s)

def split_rule(css, s, e):
    """(selector text, [declaration texts]) of the rule css[s:e], all as original text."""
    b = scan_to(css, s, '{'); sel = css[s:b]; body = css[b + 1:e - 1]
    parts = []; i = 0
    while i < len(body):
        j = scan_to(body, i, ';'); parts.append(body[i:j]); i = j + 1
    return sel, [x for x in parts if x.strip()]

def decl_name(d):
    t = re.sub(r'/\*.*?\*/', '', d, flags=re.S).strip()
    if ':' not in t: return None, False
    return t.split(':', 1)[0].strip().lower(), bool(re.search(r'!\s*important\s*$', t, re.I))

def rules_in(css):
    """Every qualified rule as (context, node, start, end) with character offsets in css."""
    lines = [0]
    for i, ch in enumerate(css):
        if ch == '\n': lines.append(i + 1)
    def off(node): return lines[node.source_line - 1] + node.source_column - 1
    out = []
    def walk(nodes, ctx):
        for n in nodes:
            if n.type == 'qualified-rule':
                s = off(n); e = rule_end(css, s)
                out.append((ctx, n, s, e))
            elif n.type == 'at-rule' and n.content is not None and n.lower_at_keyword in ('media', 'supports'):
                # positions inside an at-rule are relative to the whole stylesheet as well
                walk(tinycss2.parse_rule_list(n.content, skip_whitespace=False, skip_comments=False), ctx + '@' + ' '.join(tinycss2.serialize(n.prelude).split()))
    walk(tinycss2.parse_stylesheet(css, skip_whitespace=False, skip_comments=False), '')
    return out

def rebuild(css, s, e, keep):
    """The rule css[s:e] with the declarations i where keep(i) is false cut out of the original text, so the
       rule keeps its layout. A rule left with no declarations is removed ('')."""
    b = scan_to(css, s, '{'); body = css[b + 1:e - 1]
    segs = []; i = 0                      # (start, end-after-semicolon) of each declaration in body
    while i < len(body):
        j = scan_to(body, i, ';'); segs.append((i, min(j + 1, len(body)))); i = j + 1
    segs = [(a, z) for a, z in segs if body[a:z].strip(' \t\n;')]
    names = [decl_name(body[a:z].rstrip(';'))[0] for a, z in segs]
    real = [k for k, nm in enumerate(names) if nm]
    if not any(keep(n) for n, k in enumerate(real)): return ''
    out = body; cut = 0
    for n, k in enumerate(real):
        if keep(n): continue
        a, z = segs[k]; a -= cut; z -= cut
        # take the declaration, its semicolon and the spaces after it; leading spaces/newline stay
        lead = len(out[a:z]) - len(out[a:z].lstrip())
        a += lead
        while z < len(out) and out[z] in ' \t': z += 1
        out = out[:a] + out[z:]; cut += (z - a)
    # lines the cut left empty are dropped
    ls = out.split('\n')   # the first line is the rest of the '{' line and the last holds the indent before '}': both stay
    if len(ls) > 2: out = '\n'.join(ls[:1] + [l.rstrip() for l in ls[1:-1] if l.strip()] + ls[-1:])
    elif len(ls) == 1: out = re.sub(r'  +', ' ', out)
    return css[s:b + 1] + out + '}'

def apply(html, edit):
    out = []; last = 0; changed = 0
    bl = list(blocks(html))
    # edits are worked out last block first, so an edit function can carry state from later blocks to earlier ones
    all_edits = {base: edit(css) for base, css in reversed(bl)}
    for base, css in bl:
        edits = all_edits[base]   # list of (start, end, replacement)
        res = []; p = 0
        for s, e, rep in sorted(edits):
            res.append(css[p:s]); res.append('\x00' + rep + '\x00'); p = e; changed += 1
        res.append(css[p:])
        # a line an edit left with nothing but spaces is removed; then the markers go
        def tidy(l):   # a whole rule removed from the middle of a line: one space where it was, none at the ends
            l = re.sub(r'([ \t]*)\x00\x00([ \t]*)', lambda m: ' ' if m.group(1) and m.group(2) else '', l)
            return l.rstrip() if '\x00' in l or l != l.rstrip() and not l.strip() == '' else l
        lines = []
        for l in ''.join(res).split('\n'):
            if '\x00' not in l: lines.append(l); continue
            if not l.replace('\x00', '').strip(): continue      # the edit left nothing on this line
            lines.append(tidy(l))
        new = '\n'.join(lines)
        out.append(html[last:base]); out.append(new.replace('\x00', '')); last = base + len(css)
    out.append(html[last:])
    return ''.join(out), changed

def unused(classes):
    pat = re.compile(r'\.(' + '|'.join(re.escape(c) for c in classes) + r')(?![\w-])')
    def edit(css):
        eds = []
        for ctx, n, s, e in rules_in(css):
            b = scan_to(css, s, '{'); sels = []; i = s
            while i < b: j = scan_to(css[:b], i, ','); sels.append(css[i:j]); i = j + 1
            keep = [x for x in sels if not pat.search(x)]
            if len(keep) == len(sels): continue
            if not keep: eds.append((s, e, ''))
            else:
                gap = sels[-1][len(sels[-1].rstrip()):]   # whatever stood between the selectors and '{'
                eds.append((s, e, ','.join(keep).strip() + gap + css[b:e]))
        return eds
    return edit

MODERN = re.compile(r'dvh|svh|lvh|dvw|svw|lvw|color-mix|clamp[(]|min[(]|max[(]|env[(]|oklch|oklab|lab[(]|lch[(]|:has|@', re.I)

def dead():
    later = {}   # (context, selector) -> {property: set later with !important?}, shared across <style> blocks
    def edit(css):
        rs = rules_in(css)
        dead_ix = {}
        for idx in range(len(rs) - 1, -1, -1):
            ctx, n, s, e = rs[idx]
            sel, raw = split_rule(css, s, e)
            raw = [d for d in raw if decl_name(d)[0]]   # the same declarations rebuild() counts
            key = (ctx, ' '.join(re.sub(r'/\*.*?\*/', '', sel, flags=re.S).split()))
            seen = later.setdefault(key, {})   # prop -> set later with !important?
            ds = [decl_name(d) for d in raw]
            kill = set()
            # Only cross-rule overrides count. A property written twice inside one rule is kept: that is the
            # fallback pattern (height:100vh; height:100dvh), and older iPads need the first one.
            for i, (name, imp) in enumerate(ds):
                if name and name in seen and seen[name] is not None and (seen[name] or not imp): kill.add(i)
            for i, (name, imp) in enumerate(ds):
                if not name or i in kill: continue
                val = raw[i].split(':', 1)[1] if ':' in raw[i] else ''
                # a value using a newer feature may be dropped by an older browser, which then uses the earlier
                # value: never let such a value make an earlier one count as dead
                modern = MODERN.search(val)
                if name not in seen or seen[name] is None: seen[name] = None if modern else imp
                elif not modern: seen[name] = seen[name] or imp
            if kill: dead_ix[idx] = kill
        eds = []
        for idx, kill in dead_ix.items():
            ctx, n, s, e = rs[idx]
            eds.append((s, e, rebuild(css, s, e, lambda i, kill=kill: i not in kill)))
        return eds
    return edit

def empty_at_rules(html):
    """Removes @media/@supports blocks left with nothing inside (repeat for nested ones)."""
    pat = re.compile(r'[ \t]*@(media|supports)[^{};]*\{\s*\}[ \t]*\n?')
    n = 0
    while True:
        html, k = pat.subn('', html); n += k
        if not k: return html, n

def unused_keyframes(html):
    css = ''.join(m.group(2) for m in re.finditer(r'(<style[^>]*>)(.*?)</style>', html, re.S))
    code = re.sub(r'<style[^>]*>.*?</style>', ' ', html, flags=re.S)
    names = set(re.findall(r'@keyframes\s+([\w-]+)', css))
    used = set()
    for n in names:
        uses = len(re.findall(r'(?<![\w-])' + re.escape(n) + r'(?![\w-])', css)) - len(re.findall(r'@keyframes\s+' + re.escape(n) + r'(?![\w-])', css))
        if uses > 0 or re.search(r'(?<![\w-])' + re.escape(n) + r'(?![\w-])', code): used.add(n)
    return sorted(names - used)

if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in ('unused', 'dead', 'keyframes'): sys.exit(__doc__)
    build = os.path.join(ROOT, 'tools', 'build.py')
    subprocess.run([sys.executable, build, '--check'], check=True)   # don't overwrite src/ with a stale index.html
    f, mode = os.path.join(ROOT, 'index.html'), sys.argv[1]
    html = open(f, encoding='utf8').read()
    if mode == 'keyframes': print('unused @keyframes:', ' '.join(unused_keyframes(html))); sys.exit(0)
    html, n = apply(html, unused(sys.argv[2:]) if mode == 'unused' else dead())
    html, k = empty_at_rules(html)
    open(f, 'w', encoding='utf8').write(html)
    subprocess.run([sys.executable, build, '--unbuild'], check=True)
    print(mode, 'rules changed:', n, '· empty @media/@supports removed:', k)
