# Calliper UI

The source of truth is `app/globals.css`. Tailwind utilities map to the same CSS variables. Workspace layouts are in `app/forge.css`; shared buttons and fields live in `components/ui`.

## Meaning before decoration

- **Accent** (`#2B5C8A`): actions, links, selection, focus and neutral information. Never use it to mean passed or completed.
- **Success** (`#15803D`): verified evidence, completed review, compatible capability checks and successful saves.
- **Warning** (`#92400E`): pending measurements, unverified evidence, open screening concerns and potential matches. Finding severity is a priority, not a failed manufacturability verdict; all priorities retain their text labels and use warning.
- **Danger** (`#B91C1C`): rejected suggestions, dismissed findings, incompatible matches, failed saves and destructive controls.
- **Ink**, **paper**, **surface**: content, page background and elevated panels. Secondary text, borders and disabled controls derive from ink opacity.

Every status includes a readable label or icon. Drawing markers pair their number with a warning icon and expose priority and review state in their accessible name and tooltip. `role="status"` announces content; it does not imply success (loading and counts also use it).

Use `Button` variants for actions. Primary/secondary/outline/ghost/link use accent; destructive uses danger. Disabled controls use the disabled token. A confirm action stays accent until the result is known.

## Layout

Spacing: 8, 16, 24, 32, 48, 64px (`--space-1` through `--space-6`). Use 32px card padding, 48px between sections and 64px for page spacing; reduce padding on small screens. Dense drawing controls may use smaller optical adjustments.

Radii: 6px inputs, 10px buttons/badges, 20px cards/panels/modals. Keep Inter as the only bundled font.

## Contrast

Contrast against paper / white:

| Token | Paper | White |
| --- | ---: | ---: |
| Ink | 15.39 | 16.91 |
| Accent | 6.37 | 7.00 |
| Success | 4.56 | 5.02 |
| Warning | 6.45 | 7.09 |
| Danger | 5.89 | 6.47 |

The exact success green loses normal-text contrast on its translucent fill. Filled success labels therefore use ink text and a subtle green border; unfilled success text keeps the exact green. Do not lighten semantic text or fade reviewed annotations. Always check actual composed backgrounds, not just token swatches.

Blue anchors the main navigation, selected view controls and drawing toolbar. Paper is reserved for the page background; white panels use continuous clipped surfaces. Evidence sections use white and a border rather than nested paper fills. Table corners clip their headers and rows; badges are inline flex elements so fills do not form jagged wrapped edges.
