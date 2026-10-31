# Context Menu

A vanilla JS context menu with separator, submenu, and confirmation support.

## Import

```typescript
import { showContextMenu } from '@zyno-io/vue-foundation';
```

## `showContextMenu(event, config)`

Displays a context menu for `event.currentTarget`. From a pointer event it opens at the mouse position, toward whichever side of the cursor has room (right/below by preference); a menu taller than the viewport pins to it and scrolls internally. Clicking outside the menu closes it.

`event` may also be a `KeyboardEvent`, or the click a focused link or button fires on Enter/Space (`detail` 0, no coordinates). Such a menu has no cursor to open at: it opens below the target (above it when out of room) and focuses its first item.

```typescript
function handleRightClick(e: MouseEvent) {
    e.preventDefault();
    showContextMenu(e, {
        items: [
            { title: 'Edit', handler: () => editItem() },
            { title: 'Duplicate', handler: () => duplicateItem() },
            {
                title: 'Move to',
                items: [
                    { title: 'Inbox', handler: () => moveTo('inbox') },
                    { title: 'Archive', handler: () => moveTo('archive') }
                ]
            },
            '-', // separator
            {
                title: 'Delete',
                handler: () => deleteItem(),
                class: 'danger',
                shouldConfirm: true
            }
        ],
        class: 'my-menu',
        targetClass: 'menu-open'
    });
}
```

## Config

| Property      | Type                         | Description                                              |
| ------------- | ---------------------------- | -------------------------------------------------------- |
| `items`       | `(ContextMenuItem \| '-')[]` | Menu items and separators                                |
| `class`       | `string`                     | CSS class added to the `.vf-context-menu` element        |
| `targetClass` | `string`                     | CSS class added to the target element while menu is open |

## Menu Item

| Property        | Type                         | Description                                                |
| --------------- | ---------------------------- | ---------------------------------------------------------- |
| `title`         | `string`                     | Display text for the menu item                             |
| `handler`       | `() => void`                 | Callback executed when the item is clicked                 |
| `class`         | `string`                     | CSS class added to the item element                        |
| `shouldConfirm` | `boolean`                    | Requires a second click to confirm (see below)             |
| `items`         | `(ContextMenuItem \| '-')[]` | Child items — the item opens a submenu instead (see below) |

Use the string `'-'` in the `items` array to insert a visual separator between groups of items.

## Submenus

An item with `items` opens a flyout submenu on hover or click instead of running a handler (`handler` is ignored on such items). Submenus nest to any depth, position themselves beside their parent — flipping to the other side when out of room — and use the same viewport pinning/scrolling as the root menu. The parent item gets the `.has-submenu` class, a `.submenu-caret` element, and `.submenu-open` while its submenu is showing.

## Confirmation

When `shouldConfirm` is `true`, the first click changes the item text to "Confirm". Moving the mouse away from the item resets it to its original text. The handler is only executed on the second click.

## Keyboard

The open menu is keyboard-driven, however it was opened:

| Key               | Action                                                                |
| ----------------- | --------------------------------------------------------------------- |
| `↓` / `↑`         | Next / previous item, wrapping; from a pointer-opened menu, enters it |
| `Home` / `End`    | First / last item                                                     |
| `Enter` / `Space` | Activates the focused item (or opens its submenu)                     |
| `→` / `←`         | Opens the focused item's submenu / closes the current submenu         |
| `Escape`          | Closes the current submenu, or the menu from the root                 |
| `Tab`             | Closes the menu                                                       |

Keys are handled in the capture phase, so `Escape` closes the menu and not, say, a modal beneath it. Only the most recently opened menu takes keys, a held key's repeats are ignored (holding `Enter` on the opener won't pick an item), and a text field focused outside the menu keeps `Space`, `Home` and `End`.

Hovering an item focuses it, so the arrows continue from the pointer — once the mouse actually moves: a menu that opens, or scrolls, under a resting cursor keeps the keyboard's highlight. Moving focus closes any other item's submenu.

After the keyboard has been used, closing returns focus to the target if it was still in the menu. A pointer-only menu leaves focus as it was. A `shouldConfirm` item takes a second `Enter`, and resets when focus leaves it.

## Styling

Style the menu using the `.vf-context-menu` CSS class (`role="menu"`). Items use `.item` (`role="menuitem"`, focusable; submenu parents carry `aria-haspopup`/`aria-expanded`), separators use `.separator`, and items awaiting confirmation have the `.pending-confirm` class. Since hover and keyboard share the item focus, style `.item:focus` the same as `.item:hover` (and drop its outline) to get one highlight.

## Demo

<DemoContainer>
  <DemoContextMenu />
  <template #source>

<<< @/demos/components/DemoContextMenu.vue

  </template>
</DemoContainer>

<script setup>
import DemoContextMenu from '../demos/components/DemoContextMenu.vue';
</script>
