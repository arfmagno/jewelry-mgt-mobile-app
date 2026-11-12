# Design system & accessibility

## Look

The palette follows the system appearance setting:

| Token | Noir & Gold (dark) | Ivory & Gold (light) |
|---|---|---|
| background | `#0E0D0B` | `#F7F3EA` |
| surface | `#181612` | `#FFFDF8` |
| text | `#F4EFE4` | `#1C1A16` |
| text muted | `#A39E93` | `#5E584D` |
| accent (gold) | `#D4AF37` | `#7A5C14` |
| on accent | `#0E0D0B` | `#FFFDF8` |
| border (inputs) | `#6E6455` | `#8C8577` |
| danger | `#F28B82` | `#B3261E` |

The light theme uses a deeper antique gold, because bright gold on ivory fails contrast.

- **Type**: Cormorant Garamond for headings, Inter for body, labels and figures. Figures use tabular numerals.
- **Spacing**: 4 / 8 / 12 / 16 / 24 / 32. Radii are 6 / 10 / 16.

Tokens live in `mobile/src/theme/tokens.ts`. Components never hard-code colours.

## Accessibility (WCAG 2.2 AA)

| Requirement | How it is met |
|---|---|
| Contrast (1.4.3, 1.4.11) | Every text pair is at least 4.5:1 and input borders and focus rings at least 3:1, in both themes |
| Target size (2.5.8) | Every touch target is at least 48 dp (`TOUCH_TARGET`); icon buttons use `hitSlop` |
| Text resize (1.4.4) | Font scaling always on; layouts wrap instead of truncating; display headings are capped at 1.6× so they stay on screen |
| Use of colour (1.4.1) | Status pills, sync state and selected chips always carry text or an icon as well as colour |
| Name, role, value (4.1.2) | Buttons, radios (choice chips), switches and pickers expose role, label and state; icon-only buttons have spoken labels |
| Labels (3.3.2) | Every input has a visible label, with required fields marked in text and hints below |
| Error identification (3.3.1) | Field errors appear next to the field as one live, polite alert with an icon and text |
| Status messages (4.1.3) | Validation summaries and finished AI designs are announced; field errors and the report year use live regions |
| Charts | Report bars are decorative; each month is one accessible element that reads its exact figures |
| Motion | With the system *reduce motion* setting on, modals open without sliding and images appear without fading |

Automated checks: `mobile/src/components/__tests__` asserts roles, labels, states and error announcements with React Native Testing Library.

## Responsive layout

`useLayout()` derives layout from the window size and font scale:

| Width | Behaviour |
|---|---|
| < 600 dp | Single column; tab labels below icons |
| ≥ 600 dp | Paired fields and detail cards side by side (`Columns`); tab labels beside icons |
| Card grids | 1 → 2 → 3 → 4 columns as width allows; fewer when the user's font scale is large |

Forms and detail pages are capped at a 760 dp readable width and centred. Orientation is unlocked.
