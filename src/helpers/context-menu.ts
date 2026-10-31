export interface ContextMenuItem {
    title: string;
    /** Runs when the item is clicked. Ignored when `items` is set. */
    handler?: () => void;
    class?: string;
    shouldConfirm?: boolean;
    /** Child items — the item opens a submenu on hover/click instead of running a handler. */
    items?: (ContextMenuItem | '-')[];
}

export interface ContextMenuConfig {
    targetClass?: string;
    class?: string;
    items: (ContextMenuItem | '-')[];
}

interface MenuHandle {
    el: HTMLElement;
    close: () => void;
}

/** A submenu item's opener: opens (or keeps) its submenu and returns the submenu's element. */
type SubmenuOpener = () => HTMLElement;

/** Key handlers of the open menus, latest last. Only the latest takes keys. */
const keyHandlers: ((e: KeyboardEvent) => void)[] = [];

/** Minimum gap between any menu edge and the viewport. */
const VIEWPORT_MARGIN = 8;
/** Submenus overlap their parent menu slightly so the hover path stays unbroken. */
const SUBMENU_OVERLAP = 2;

/**
 * Opens a context menu for `e.currentTarget`. From a pointer event it opens at the cursor; from the
 * keyboard (a key event, or the click a focused link/button fires on Enter/Space) it opens against
 * the target and focuses its first item. Either way the menu is keyboard-driven once open: arrows
 * move, Enter/Space activate, →/← open and close submenus, Escape and Tab close.
 */
export function showContextMenu(e: MouseEvent | KeyboardEvent, config: ContextMenuConfig) {
    globalThis.getSelection()?.removeAllRanges();

    const wrapperEl = document.createElement('div');
    wrapperEl.classList.add('vf-overlay');
    wrapperEl.addEventListener('click', closeMenu);
    wrapperEl.addEventListener('contextmenu', e => e.preventDefault());
    document.body.appendChild(wrapperEl);

    const target = e.currentTarget as HTMLElement;
    target.classList.add('context-menu-active');

    if (config.targetClass) {
        target.classList.add(config.targetClass);
    }

    const submenuOpeners = new WeakMap<HTMLElement, SubmenuOpener>();
    const submenuParents = new WeakMap<HTMLElement, { itemEl: HTMLElement; close: () => void }>();

    const fromKeyboard = isKeyboardOpen(e);
    // Whether the pointer is driving. Off from a keyboard open and after each handled key, until the
    // mouse really moves: `mouseenter` also fires when a menu appears, or scrolls, under a resting cursor.
    let pointerActive = !fromKeyboard;
    wrapperEl.addEventListener('mousemove', () => (pointerActive = true), true);
    // Whether to hand focus back to the target on close: only once the keyboard has been in play.
    let keyboardUsed = fromKeyboard;

    const rootMenu = buildMenu(config.items);
    wrapperEl.appendChild(rootMenu.el);

    if (fromKeyboard) {
        // No cursor: below the target, left edges aligned, flipping above it when out of room.
        const rect = target.getBoundingClientRect();
        placeHorizontally(rootMenu.el, rect.left, rect.right);
        placeVertically(rootMenu.el, rect.bottom + 1, rect.top - 1);
    } else {
        // Rightward/downward from the cursor by preference, flipping to the other
        // side of it when out of room; a menu too tall for either side pins to the
        // viewport and scrolls.
        const { clientX, clientY } = e as MouseEvent;
        placeHorizontally(rootMenu.el, clientX + 1, clientX - 1);
        placeVertically(rootMenu.el, clientY + 1, clientY - 1);
    }
    freezeWidth(rootMenu.el);

    // Capture phase, so Escape closes the menu rather than whatever sits beneath it (a modal).
    keyHandlers.push(onKeyDown);
    document.addEventListener('keydown', onKeyDown, true);
    if (fromKeyboard) focusItem(rootMenu.el, 0);

    function buildMenu(items: (ContextMenuItem | '-')[]): MenuHandle {
        const menuEl = document.createElement('div');
        menuEl.classList.add('vf-context-menu');
        menuEl.setAttribute('role', 'menu');
        menuEl.style.position = 'absolute';

        if (config.class) {
            menuEl.classList.add(config.class);
        }

        // At most one submenu is open per menu; hovering anything else in this
        // menu closes it (and, recursively, its descendants).
        let openChild: { itemEl: HTMLElement; handle: MenuHandle } | null = null;

        const closeChild = () => {
            if (!openChild) return;
            openChild.handle.close();
            openChild.itemEl.classList.remove('submenu-open');
            openChild.itemEl.setAttribute('aria-expanded', 'false');
            openChild = null;
        };

        /** Runs `enter` when the pointer enters `el` — or first really moves over it after keys. */
        const onPointerEnter = (el: HTMLElement, enter: () => void) => {
            el.addEventListener('mouseenter', () => pointerActive && enter());
            el.addEventListener('mousemove', () => document.activeElement !== el && enter());
        };

        items.forEach(item => {
            if (item == '-') {
                const separatorEl = document.createElement('div');
                separatorEl.classList.add('separator');
                separatorEl.setAttribute('role', 'separator');
                separatorEl.addEventListener('mouseenter', () => pointerActive && closeChild());
                menuEl.appendChild(separatorEl);
                return;
            }

            const itemEl = document.createElement('div');
            itemEl.classList.add('item');
            itemEl.setAttribute('role', 'menuitem');
            itemEl.tabIndex = -1;
            itemEl.style.userSelect = 'none';
            itemEl.innerText = item.title;
            menuEl.appendChild(itemEl);

            // The pointer and the keyboard share one highlight: hovering an item focuses it, so the
            // arrows carry on from wherever the mouse left off. Focus, however it arrives, closes
            // any other item's submenu.
            const focusItemEl = () => itemEl.focus({ preventScroll: true });

            if (item.class) {
                itemEl.classList.add(item.class);
            }

            if (item.items?.length) {
                itemEl.classList.add('has-submenu');
                itemEl.setAttribute('aria-haspopup', 'menu');
                itemEl.setAttribute('aria-expanded', 'false');

                const caretEl = document.createElement('span');
                caretEl.classList.add('submenu-caret');
                caretEl.innerText = '›';
                caretEl.style.marginLeft = 'auto';
                caretEl.style.paddingLeft = '12px';
                itemEl.appendChild(caretEl);

                const openSubmenu = (): HTMLElement => {
                    if (openChild?.itemEl === itemEl) return openChild.handle.el;
                    closeChild();
                    const handle = buildMenu(item.items!);
                    // Submenus attach to the overlay, not the parent menu — a
                    // scrolling parent would otherwise clip them.
                    wrapperEl.appendChild(handle.el);
                    positionSubmenu(handle.el, itemEl, menuEl);
                    freezeWidth(handle.el);
                    itemEl.classList.add('submenu-open');
                    itemEl.setAttribute('aria-expanded', 'true');
                    openChild = { itemEl, handle };
                    submenuParents.set(handle.el, { itemEl, close: closeChild });
                    return handle.el;
                };
                submenuOpeners.set(itemEl, openSubmenu);

                itemEl.addEventListener('focus', () => openChild?.itemEl !== itemEl && closeChild());
                onPointerEnter(itemEl, () => {
                    focusItemEl();
                    openSubmenu();
                });
                itemEl.addEventListener('click', e => {
                    // Parents only reveal their children; the menu stays open.
                    e.stopPropagation();
                    openSubmenu();
                });
                return;
            }

            itemEl.addEventListener('focus', closeChild);
            onPointerEnter(itemEl, focusItemEl);

            if (item.shouldConfirm) {
                itemEl.addEventListener('click', e => confirmAction(e, itemEl, () => item.handler?.()));
                itemEl.addEventListener('blur', () => resetConfirm(itemEl));
            } else {
                itemEl.addEventListener('click', () => item.handler?.());
            }
        });

        return {
            el: menuEl,
            close: () => {
                closeChild();
                menuEl.remove();
            }
        };
    }

    function positionSubmenu(menuEl: HTMLElement, itemEl: HTMLElement, parentMenuEl: HTMLElement) {
        const itemRect = itemEl.getBoundingClientRect();
        const parentRect = parentMenuEl.getBoundingClientRect();
        // Cancel the menu's own padding so its first item lines up with the parent item.
        const paddingTop = parseFloat(getComputedStyle(menuEl).paddingTop) || 0;
        placeHorizontally(menuEl, parentRect.right - SUBMENU_OVERLAP, parentRect.left + SUBMENU_OVERLAP);
        placeVertically(menuEl, itemRect.top - paddingTop, itemRect.bottom + paddingTop);
    }

    function closeMenu() {
        document.removeEventListener('keydown', onKeyDown, true);
        const at = keyHandlers.indexOf(onKeyDown);
        if (at >= 0) keyHandlers.splice(at, 1);
        if (!wrapperEl.isConnected) return;

        if (config.targetClass) {
            target.classList.remove(config.targetClass);
        }

        target.classList.remove('context-menu-active');

        // After keyboard use, hand focus back to the target if it was still in the menu — not if the
        // chosen item moved it somewhere on purpose. A pointer-only menu leaves focus as it was.
        const hadFocus = wrapperEl.contains(document.activeElement);
        wrapperEl.remove();
        if (keyboardUsed && hadFocus && target.isConnected) target.focus({ preventScroll: true });
    }

    function onKeyDown(e: KeyboardEvent) {
        // The overlay was removed from under us (not through closeMenu): stand down.
        if (!wrapperEl.isConnected) return closeMenu();
        // A menu opened over this one has the keys.
        if (keyHandlers[keyHandlers.length - 1] !== onKeyDown) return;

        const focused = document.activeElement as HTMLElement | null;
        const itemEl = focused && wrapperEl.contains(focused) && focused.classList.contains('item') ? focused : null;
        const menuEl = itemEl?.parentElement ?? null;
        // Focus still in a field outside the menu: leave it the keys it edits with.
        const typing = !itemEl && isEditable(focused);

        switch (e.key) {
            case 'ArrowDown':
            case 'ArrowUp':
            case 'Home':
            case 'End': {
                if (typing && (e.key === 'Home' || e.key === 'End')) return;
                // Nothing focused yet (opened by the pointer): start in the innermost open menu.
                const menu = menuEl ?? (wrapperEl.lastElementChild as HTMLElement);
                const items = menuItems(menu);
                const at = itemEl ? items.indexOf(itemEl) : -1;
                focusItem(menu, stepIndex(e.key, at, items.length));
                break;
            }
            case 'ArrowRight': {
                const open = itemEl && submenuOpeners.get(itemEl);
                if (!open) return;
                focusItem(open(), 0);
                break;
            }
            case 'ArrowLeft': {
                const parent = menuEl && submenuParents.get(menuEl);
                if (!parent) return;
                parent.close();
                parent.itemEl.focus();
                break;
            }
            case 'Enter':
            case ' ': {
                if (!itemEl && typing && e.key === ' ') return;
                // A held key's repeats, or nothing in the menu focused: swallow it rather than
                // activate an item off the press that opened the menu, or whatever is focused
                // beneath the overlay (say, the link that opened it).
                if (e.repeat || !itemEl) break;
                const open = submenuOpeners.get(itemEl);
                if (open) focusItem(open(), 0);
                else itemEl.click();
                break;
            }
            case 'Escape': {
                // Out of a submenu first; the whole menu from the root.
                const parent = menuEl && submenuParents.get(menuEl);
                if (parent) {
                    parent.close();
                    parent.itemEl.focus();
                } else {
                    closeMenu();
                }
                break;
            }
            case 'Tab':
                closeMenu();
                break;
            default:
                return;
        }

        keyboardUsed = true;
        pointerActive = false;
        e.preventDefault();
        e.stopPropagation();
    }

    function confirmAction(e: MouseEvent, itemEl: HTMLElement, handler: () => void) {
        if (itemEl.classList.contains('pending-confirm')) {
            return handler();
        }

        const originalContent = itemEl.innerHTML;
        itemEl.classList.add('pending-confirm');
        itemEl.innerText = 'Confirm';

        const onMouseLeave = () => {
            resetConfirm(itemEl);
            itemEl.removeEventListener('mouseleave', onMouseLeave);
        };

        confirmOriginals.set(itemEl, originalContent);
        itemEl.addEventListener('mouseleave', onMouseLeave);
        e.stopPropagation();
    }
}

const confirmOriginals = new WeakMap<HTMLElement, string>();

/** Puts a confirm item awaiting its second activation back to its own title. */
function resetConfirm(itemEl: HTMLElement) {
    if (!itemEl.classList.contains('pending-confirm')) return;
    itemEl.classList.remove('pending-confirm');
    itemEl.innerHTML = confirmOriginals.get(itemEl) ?? itemEl.innerHTML;
}

/**
 * Whether the menu was opened from the keyboard, so has no pointer position: a key event, or the
 * synthetic click a focused link or button fires on Enter/Space (no click count, no coordinates).
 */
function isKeyboardOpen(e: MouseEvent | KeyboardEvent): boolean {
    if (!('clientX' in e)) return true;
    return e.type === 'click' && e.detail === 0 && e.clientX === 0 && e.clientY === 0;
}

/** Where an arrow/Home/End key moves the focus among `count` items, from `at` (-1: none yet). */
function stepIndex(key: string, at: number, count: number): number {
    if (key === 'Home') return 0;
    if (key === 'End') return count - 1;
    if (key === 'ArrowDown') return (at + 1) % count;
    return at <= 0 ? count - 1 : at - 1;
}

function isEditable(el: Element | null): boolean {
    return el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

function menuItems(menuEl: HTMLElement): HTMLElement[] {
    return Array.from(menuEl.children).filter((el): el is HTMLElement => el.classList.contains('item'));
}

function focusItem(menuEl: HTMLElement, index: number) {
    menuItems(menuEl)[index]?.focus();
}

/**
 * Places the menu with its left edge at preferredLeft. When it would overflow
 * the right of the viewport, its right edge flips to flippedRight instead (the
 * other side of the cursor or parent menu); either way the result is clamped
 * inside the viewport.
 */
function placeHorizontally(menuEl: HTMLElement, preferredLeft: number, flippedRight: number) {
    const viewportWidth = window.innerWidth;
    const menuWidth = menuEl.offsetWidth;

    let left = preferredLeft;
    if (left + menuWidth > viewportWidth - VIEWPORT_MARGIN && flippedRight - menuWidth >= VIEWPORT_MARGIN) {
        left = flippedRight - menuWidth;
    }
    left = Math.min(left, viewportWidth - VIEWPORT_MARGIN - menuWidth);
    left = Math.max(left, VIEWPORT_MARGIN);

    menuEl.style.left = left + 'px';
}

/**
 * Places the menu with its top edge at preferredTop. When it would overflow the
 * bottom of the viewport, its bottom edge flips to flippedBottom if the menu
 * fits above; otherwise it slides up as far as needed, and a menu taller than
 * the viewport itself pins to the top margin and scrolls internally.
 */
function placeVertically(menuEl: HTMLElement, preferredTop: number, flippedBottom: number) {
    const viewportHeight = window.innerHeight;
    const menuHeight = menuEl.offsetHeight;

    let top = preferredTop;
    if (top + menuHeight > viewportHeight - VIEWPORT_MARGIN) {
        if (flippedBottom - menuHeight >= VIEWPORT_MARGIN) {
            top = flippedBottom - menuHeight;
        } else {
            top = viewportHeight - VIEWPORT_MARGIN - menuHeight;
        }
    }
    if (top < VIEWPORT_MARGIN) {
        top = VIEWPORT_MARGIN;
        menuEl.style.maxHeight = viewportHeight - VIEWPORT_MARGIN * 2 + 'px';
        menuEl.style.overflowY = 'auto';
    }

    menuEl.style.top = top + 'px';
}

/** Locks the rendered width so confirm-swaps ("Confirm") don't shrink the menu. */
function freezeWidth(menuEl: HTMLElement) {
    setTimeout(() => {
        menuEl.style.width = menuEl.offsetWidth + 'px';
    }, 50);
}
