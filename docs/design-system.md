# Design system & accessibility

## Look

The palette follows the phone's appearance by default; Settings can fix it to Ivory (light) or Noir (dark) on this device.

| Token | Noir & Champagne (dark) | Ivory & Gold (light) |
|---|---|---|
| background | `#141210` | `#FAF8F3` |
| surface | `#1C1A17` | `#FFFFFF` |
| text | `#F2EDE4` | `#17150F` |
| text muted | `#A8A196` | `#5F594E` |
| accent (gold type) | `#CDB27A` | `#80631B` |
| on accent | `#141210` | `#FFFFFF` |
| ink (primary fills) | `#CDB27A` | `#17150F` |
| gold (hairlines) | `#8C7748` | `#B8933A` |
| border (inputs) | `#776E61` | `#8C8577` |
| danger | `#F28B82` | `#B3261E` |

The dark theme is a warm espresso rather than pure black, with a soft champagne gold; its primary buttons and the add button are champagne with dark type. The light theme uses a deeper antique gold for type, because bright gold on ivory fails contrast.

- **Type**: Cormorant Garamond for headings, piece names, client names and prices (lining figures, so "18K" never reads "ı8K"). Inter for body text and fields. Codes, statuses and list headings are small spaced capitals.
- **Flat and restrained**: no gradients or shadows. Primary buttons are solid ink with small spaced capitals; secondary buttons are an ink outline. Corners are nearly square.
- **Gold** is kept to type and fine lines: codes, section labels, hairlines around thumbnails and monograms. The add button in the tab bar is an ink disc with a fine cross; it opens a menu sheet of the records you can add.
- **Pieces without photos** sit on a plain tinted panel with a line drawing of the piece.
- **Quiet chrome**: pieces are shown like a catalogue (picture, then name and price, no box). Orders, clients and other lists are open rows divided by hairlines, like a ledger. Detail pages are spec sheets: label on the left, value on the right. A status is a small dot and a word. Screen headers are small capitals; the page carries the large title.
- **Spacing**: 4 / 8 / 12 / 16 / 24 / 32. Radii are 2 / 4 / 6, so chips, tiles and buttons read as nearly square. Selected chips and tiles are filled or outlined in ink with a check.
- **Illustrations**: line drawings of each jewelry type, stone cut, and polished-metal swatches (`components/illustrations.tsx`) drive the pickers. They are decorative; every one sits next to its name in text.
- **Guided entry**: adding a piece is split into short steps (type, metal, sizes, stones, costs, finish) with a progress bar, and the running cost is always visible on the costs step.

Tokens live in `mobile/src/theme/tokens.ts`. Components never hard-code colours.

## Accessibility (WCAG 2.2 AA)

| Requirement | How it is met |
|---|---|
| Contrast (1.4.3, 1.4.11) | Every text pair is at least 4.5:1 and input borders and focus rings at least 3:1, in both themes |
| Target size (2.5.8) | Every touch target is at least 48 dp (`TOUCH_TARGET`); icon buttons use `hitSlop` |
| Text resize (1.4.4) | Font scaling always on; layouts wrap instead of truncating; display headings are capped at 1.6× so they stay on screen; tab labels shrink slightly rather than cut off. See the [pieces](screenshots/pieces-large-text.png) and [orders](screenshots/orders-large-text.png) at 150% text |
| Use of colour (1.4.1) | Status pills, sync state and selected chips always carry text or an icon as well as colour |
| Name, role, value (4.1.2) | Buttons, radios (choice chips and picture tiles), checkboxes (multi-select tiles), switches, counters and pickers expose role, label and state; icon-only buttons have spoken labels |
| Labels (3.3.2) | Every input has a visible label, with required fields marked in text and hints below |
| Error identification (3.3.1) | Field errors appear next to the field as one live, polite alert with an icon and text |
| Status messages (4.1.3) | Validation summaries and finished AI designs are announced; field errors and the report year use live regions; each reply from the order assistant is announced as it arrives |
| Conversation | In *Describe an order*, every suggestion is a real button that reads its details (code, description, cost), your own messages read as "You: …", and the order summary reads one line at a time. Typing can be replaced by the keyboard's microphone |
| Charts | Report bars are decorative; each month is one accessible element that reads its exact figures |
| Motion | With the system *reduce motion* setting on, modals open without sliding, tabs change without sliding and images appear without fading |
| Gestures (2.5.1) | Swiping sideways between tabs is a shortcut; every page is also reachable with a single tap on the tab bar or the section tabs |

Automated checks: `mobile/src/components/__tests__` asserts roles, labels, states and error announcements with React Native Testing Library.

## Responsive layout

`useLayout()` derives layout from the window size and font scale:

| Width | Behaviour |
|---|---|
| < 600 dp | Single column; tab labels below icons |
| ≥ 600 dp | Paired fields and detail cards side by side (`Columns`); tab labels beside icons |
| Card grids | 1 → 2 → 3 → 4 columns as width allows; fewer when the user's font scale is large |

Forms and detail pages are capped at a 760 dp readable width and centred. Orientation is unlocked.
