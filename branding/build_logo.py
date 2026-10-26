"""HumanAudit logo: weight-contrast wordmark on a rounded gradient tile. Reuses glyphs from build_wordmarks.py."""
from build_wordmarks import LOW, lay

import os
THEME = os.environ.get('THEME', 'dark')
if THEME == 'dark':
    INK = '#F4F4F5'                # app textPrimary: one flat colour, like the monochrome cut
    G1, G2 = '#115E59', '#0C0D10'  # deep emerald (top-left) -> app canvas carbon; INK contrast 6.9 / 17.7. Light end keeps the tile edge visible on dark wallpapers
else:
    INK = '#0C0D10'                # app canvas colour
    G1, G2 = '#6EE7B7', '#22D3EE'  # emerald -> aqua; INK contrast 12.7 / 10.8
GRAD = (f'<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">'
        f'<stop offset="0" stop-color="{G1}"/><stop offset="1" stop-color="{G2}"/></linearGradient></defs>')

def word(w, gap, sw, scale, cx, base):
    """Centre a word on cx at the given baseline. Returns (svg, width)."""
    els, right = lay(w, LOW, gap, 0, sw, 0)
    g = f'<g transform="translate({cx - right * scale / 2:.1f} {base:.1f}) scale({scale:.4f})" stroke="{INK}" fill="{INK}">' \
        + ''.join(e.replace('stroke="#000"', f'stroke="{INK}"').replace('fill="#000"', f'fill="{INK}"') for e in els) + '</g>'
    return g, right

def icon(name, rx, human_sw=18, audit_sw=26, title='HumanAudit app icon', W=700, bg='tile', ink=None):
    """bg: 'tile' gradient rect | 'none' transparent | 'only' gradient with no text (Android adaptive layers)."""
    N = 1024
    _, wh = word('human', 50, human_sw, 1, 0, 0)
    _, wa = word('audit', 44, audit_sw, 1, 0, 0)
    s1, s2 = W / wh, W / wa              # both words fill the same width: small light over big heavy
    h1, h2, gap = 160 * s1, 160 * s2, 64
    top = (N - (h1 + gap + h2)) / 2 - 10  # optical centre sits a touch above geometric
    b1 = top + h1; b2 = b1 + gap + h2
    g1, _ = word('human', 50, human_sw, s1, N / 2, b1)
    g2, _ = word('audit', 44, audit_sw, s2, N / 2, b2)
    if ink: g1, g2 = g1.replace(INK, ink), g2.replace(INK, ink)
    rect = f'<rect width="{N}" height="{N}" rx="{rx}" fill="url(#bg)"/>\n' if bg != 'none' else ''
    text = f'{g1}\n{g2}\n' if bg != 'only' else ''
    open(name, 'w').write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N} {N}" width="{N}" height="{N}" role="img" aria-labelledby="t">'
        f'<title id="t">{title}</title>\n{GRAD if bg != "none" else ""}\n{rect}{text}</svg>\n')

def horizontal(name, H=420, pad=110):
    """Canvas width follows the text so nothing clips; padding is equal on all sides optically."""
    _, wh = word('human', 50, 14, 1, 0, 0)
    _, wa = word('audit', 44, 26, 1, 0, 0)
    s = 1.0; gap = 80
    total = (wh + gap + wa) * s
    W = round(total + 2 * pad)
    base = H / 2 + 80 * s - 10
    g1, _ = word('human', 50, 14, s, pad + wh * s / 2, base)
    g2, _ = word('audit', 44, 26, s, pad + (wh + gap) * s + wa * s / 2, base)
    open(name, 'w').write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-labelledby="t">'
        f'<title id="t">HumanAudit logo</title>\n{GRAD}\n<rect width="{W}" height="{H}" rx="{H // 2 - 20}" fill="url(#bg)"/>\n{g1}\n{g2}\n</svg>\n')

icon('ha-icon.svg', rx=228)                                   # rounded tile: brand, web, presentations
icon('ha-icon-fullbleed.svg', rx=0)                           # square: iOS/Android icon (the OS applies the mask)
horizontal('ha-horizontal.svg')
# Android adaptive icon: 108dp canvas, only the centre ~61% is guaranteed visible, so the wordmark is narrower.
icon('ha-android-foreground.svg', rx=0, bg='none', W=540, title='HumanAudit adaptive foreground')
icon('ha-android-background.svg', rx=0, bg='only', title='HumanAudit adaptive background')
icon('ha-android-monochrome.svg', rx=0, bg='none', W=540, ink='#000000', title='HumanAudit themed icon')
print('ok')

def small(name):
    """Small-size cut (favicon / <=32px): a bold 'a' (the audit weight) on the tile. Heavier or larger reads as a camera; lighter loses its counter at 16px."""
    N = 256; sc = 0.85
    els, w = lay('a', LOW, 0, 0, 34, 0)
    g = (f'<g transform="translate({(N - w * sc) / 2:.1f} {N / 2 + 50 * sc:.1f}) scale({sc})">'
         + ''.join(e.replace('#000', INK) for e in els) + '</g>')
    open(name, 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N} {N}" width="{N}" height="{N}"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{G1}"/><stop offset="1" stop-color="{G2}"/></linearGradient></defs>'
        f'<rect width="{N}" height="{N}" rx="58" fill="url(#bg)"/>{g}</svg>\n')
small('ha-small.svg')
