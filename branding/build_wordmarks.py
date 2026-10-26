"""Builds the HumanAudit wordmark concepts from stroke-constructed glyphs (no live text)."""
# lowercase, baseline y=0, x-height 100, ascender 160. glyph = (path, width, dots)
LOW = {
 'h': ("M0 -160V0M0 -50A50 50 0 0 1 100 -50V0", 100, []),
 'u': ("M0 -100V-50A50 50 0 0 0 100 -50M100 -100V0", 100, []),
 'm': ("M0 -100V0M0 -60A40 40 0 0 1 80 -60V0M80 -60A40 40 0 0 1 160 -60V0", 160, []),
 'a': ("M0 -50A50 50 0 1 1 100 -50A50 50 0 1 1 0 -50M100 -100V0", 100, []),
 'n': ("M0 -100V0M0 -50A50 50 0 0 1 100 -50V0", 100, []),
 'd': ("M0 -50A50 50 0 1 1 100 -50A50 50 0 1 1 0 -50M100 -160V0", 100, []),
 'i': ("M0 -100V0", 0, [(0, -148, 15)]),
 't': ("M26 -140V-22A22 22 0 0 0 48 0M0 -100H62", 62, []),
}
CAP = {  # cap height 120
 'H': ("M0 -120V0M100 -120V0M0 -60H100", 100),
 'U': ("M0 -120V-50A50 50 0 0 0 100 -50V-120", 100),
 'M': ("M0 0V-120L55 -30L110 -120V0", 110),
 'A': ("M0 0L55 -120L110 0M22 -48H88", 110),
 'N': ("M0 0V-120L100 0V-120", 100),
 'D': ("M0 -120V0H40A60 60 0 0 0 40 -120Z", 100),
 'I': ("M0 -120V0", 0),
 'T': ("M0 -120H100M50 -120V0", 100),
}
def svg(title, w, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} 256" width="{w}" height="256" role="img" aria-labelledby="t">'
            f'<title id="t">{title}</title>\n{body}\n</svg>\n')

def lay(word, glyphs, gap, x, sw, base):
    out = []
    for ch in word:
        d, wd, *rest = glyphs[ch]
        dots = rest[0] if rest else []
        g = f'<path d="{d}" fill="none" stroke="#000" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" transform="translate({x} {base})"/>'
        for cx, cy, r in dots:
            g += f'<circle cx="{x+cx}" cy="{base+cy}" r="{r}" fill="#000"/>'
        out.append(g)
        x += wd + gap
    return out, x - gap

def wordmark(parts, pad=40, wgap=70):
    """parts: list of (word, glyphs, gap, stroke); words joined with a fixed gap."""
    x, items = pad, []
    for i, (word, gl, gap, sw) in enumerate(parts):
        if i: x += wgap
        g, x = lay(word, gl, gap, x, sw, 190)
        items += g
    return items, x + pad

# M: single weight, i-dot = a head
items, w = wordmark([("human", LOW, 46, 20), ("audit", LOW, 46, 20)])
open('m-wordmark.svg','w').write(svg('human audit wordmark', w, '\n'.join(items)))
# N: light human + heavy audit
items, w = wordmark([("human", LOW, 50, 11), ("audit", LOW, 44, 26)])
open('n-weight-contrast.svg','w').write(svg('human audit weight contrast', w, '\n'.join(items)))
# O: tracked caps + double rule
pad = 40
items, w = wordmark([("HUMAN", CAP, 56, 16), ("AUDIT", CAP, 56, 16)], pad, 130)
y1, y2 = 190 + 34, 190 + 52
for y in (y1, y2):
    items.append(f'<path d="M{pad} {y}H{w-pad}" stroke="#000" stroke-width="7" stroke-linecap="round"/>')
open('o-double-rule.svg','w').write(svg('HUMAN AUDIT double rule', w, '\n'.join(items)))
print('ok')
