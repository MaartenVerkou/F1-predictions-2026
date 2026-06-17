## Why

The header menu currently mixes navigation, account state, language, and theme controls with inconsistent visual treatments. On phone-sized layouts this makes the menu order less useful, while on desktop the signed-in text reads more like status copy than a normal account control.

## What Changes

- Reorder the collapsed header menu so admin users see Admin first, then Dashboard, Account, Language, and Theme.
- Replace the desktop "signed in as" account copy with a normal account icon/action.
- Keep Dashboard visible with icon plus label when space allows.
- Make header navigation, language, and theme controls share consistent hover, focus, and active/selected styling.
- Avoid the harsh red active treatment for selected header menu controls in dark mode.

## Capabilities

### New Capabilities
- `header-navigation`: Header navigation and utility controls across desktop and collapsed phone layouts.

### Modified Capabilities
- None.

## Impact

- Affected files: `views/partials/header.ejs`, `public/styles.css`, locale strings if needed, and Playwright coverage for header behavior.
- No database, API, authentication, or deployment contract changes.
