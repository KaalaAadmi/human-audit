# HumanAudit logo

Weight-contrast wordmark: **human** (light, the person) over/next to **audit** (heavy, the review), on a rounded gradient tile.
Source: `build_logo.py` (+ `build_wordmarks.py` for the hand-built letters). Run `python3 build_logo.py` to regenerate. Finished files are in `dist/`.

## Colour
Default theme is **dark**, to match the app (carbon canvas, off-white text, emerald accent).

| Role | Hex | Why |
|---|---|---|
| Gradient start (top-left) | `#115E59` | Deep emerald, same hue family as the app's `bioGreen` |
| Gradient end (bottom-right) | `#0C0D10` | The app's canvas carbon, so the icon melts into the UI |
| Wordmark | `#F4F4F5` | The app's `textPrimary`; 6.9:1 on the light end, 17.7:1 on the dark end |
| Flat brand colour | `#34D399` | `dist/ha-wordmark-mono-34d399.svg` for one-colour uses |

The light end keeps the tile edge visible on dark wallpapers. Android's themed (monochrome) icon is the same wordmark in one flat colour, tinted by the system.

**Bright alternate** (`bright/`): emerald `#6EE7B7` to aqua `#22D3EE` with carbon ink (12.7:1 / 10.8:1). Regenerate it with `THEME=bright python3 build_logo.py`. Use it where a dark tile would vanish, such as a dark store page.

## Files
| File | Use |
|---|---|
| `ha-icon.svg` | Rounded tile: web, docs, presentations, social avatar |
| `ha-icon-fullbleed.svg` | Square, no rounding: the iOS/Android store icon (the OS applies its own mask) |
| `ha-horizontal.svg` | Pill lockup for headers and store banners |
| `ha-small.svg`, `favicon.ico` | 32 px and below: bold "a" only. The full wordmark is unreadable that small. |
| `ha-android-*.svg` | Adaptive icon layers (foreground, gradient background, themed monochrome) |
| `ha-wordmark-{black,white,mono-34d399}.svg` | One-colour versions, no tile |

## Rules
- Minimum size for the full wordmark: 48 px tile. Below that use `ha-small.svg`.
- Clear space: at least the height of the "a" on every side.
- Do not recolour the wordmark or add outlines or shadows. On the dark tile it is always off-white; on the bright tile always carbon.
- The thin "human" disappears under about 40 px, so never use the wordmark below that.

## Caveats
- Letters are hand-drawn paths, not a licensed typeface. This is not trademark clearance.
- Gradient master: the skill's audit flags gradients as weaker in print. Use the one-colour files for print and embroidery.
