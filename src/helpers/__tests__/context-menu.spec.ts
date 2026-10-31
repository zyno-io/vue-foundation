import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { showContextMenu } from '../context-menu';

function createMouseEvent(x = 100, y = 100) {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const event = new MouseEvent('click', { clientX: x, clientY: y, bubbles: true });
    Object.defineProperty(event, 'currentTarget', { value: target });
    return { event, target };
}

/** The click a focused button fires on Enter/Space: no click count, no coordinates. */
function createKeyboardClick() {
    const target = document.createElement('button');
    document.body.appendChild(target);
    target.focus();

    const event = new MouseEvent('click', { detail: 0, bubbles: true });
    Object.defineProperty(event, 'currentTarget', { value: target });
    return { event, target };
}

afterEach(() => {
    document.body.innerHTML = '';
});

describe('showContextMenu', () => {
    it('creates overlay and menu elements', () => {
        const { event } = createMouseEvent();
        showContextMenu(event, { items: [{ title: 'Item 1', handler: vi.fn() }] });

        expect(document.querySelector('.vf-overlay')).not.toBeNull();
        expect(document.querySelector('.vf-context-menu')).not.toBeNull();
    });

    it('renders menu items', () => {
        const { event } = createMouseEvent();
        showContextMenu(event, {
            items: [
                { title: 'Edit', handler: vi.fn() },
                { title: 'Delete', handler: vi.fn() }
            ]
        });

        const items = document.querySelectorAll('.item');
        expect(items).toHaveLength(2);
        expect((items[0] as HTMLElement).innerText).toBe('Edit');
        expect((items[1] as HTMLElement).innerText).toBe('Delete');
    });

    it('renders separators', () => {
        const { event } = createMouseEvent();
        showContextMenu(event, {
            items: [{ title: 'A', handler: vi.fn() }, '-', { title: 'B', handler: vi.fn() }]
        });

        expect(document.querySelector('.separator')).not.toBeNull();
        expect(document.querySelectorAll('.item')).toHaveLength(2);
    });

    it('calls handler on item click', () => {
        const handler = vi.fn();
        const { event } = createMouseEvent();
        showContextMenu(event, { items: [{ title: 'Click Me', handler }] });

        const item = document.querySelector('.item') as HTMLElement;
        item.click();
        expect(handler).toHaveBeenCalled();
    });

    it('adds target classes', () => {
        const { event, target } = createMouseEvent();
        showContextMenu(event, { targetClass: 'custom', items: [] });

        expect(target.classList.contains('context-menu-active')).toBe(true);
        expect(target.classList.contains('custom')).toBe(true);
    });

    it('adds menu class', () => {
        const { event } = createMouseEvent();
        showContextMenu(event, { class: 'my-menu', items: [] });

        const menu = document.querySelector('.vf-context-menu') as HTMLElement;
        expect(menu.classList.contains('my-menu')).toBe(true);
    });

    it('closes menu on overlay click', () => {
        const { event, target } = createMouseEvent();
        showContextMenu(event, { targetClass: 'custom', items: [] });

        const overlay = document.querySelector('.vf-overlay') as HTMLElement;
        overlay.click();

        expect(document.querySelector('.vf-overlay')).toBeNull();
        expect(target.classList.contains('context-menu-active')).toBe(false);
        expect(target.classList.contains('custom')).toBe(false);
    });
});

describe('positioning', () => {
    // jsdom has no layout, so give menus a fake rendered size.
    const menuSize = { width: 200, height: 300 };
    let originalOffsetWidth: PropertyDescriptor | undefined;
    let originalOffsetHeight: PropertyDescriptor | undefined;

    beforeEach(() => {
        originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
        originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
            configurable: true,
            get(this: HTMLElement) {
                return this.classList.contains('vf-context-menu') ? menuSize.width : 0;
            }
        });
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
            configurable: true,
            get(this: HTMLElement) {
                return this.classList.contains('vf-context-menu') ? menuSize.height : 0;
            }
        });
        window.innerWidth = 1024;
        window.innerHeight = 768;
        menuSize.width = 200;
        menuSize.height = 300;
    });

    afterEach(() => {
        if (originalOffsetWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
        if (originalOffsetHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
    });

    function getMenu() {
        return document.querySelector('.vf-context-menu') as HTMLElement;
    }

    it('opens below-right of the cursor when there is room', () => {
        const { event } = createMouseEvent(100, 100);
        showContextMenu(event, { items: [] });

        expect(getMenu().style.left).toBe('101px');
        expect(getMenu().style.top).toBe('101px');
    });

    it('flips above the cursor when there is no room below but room above', () => {
        const { event } = createMouseEvent(100, 700);
        showContextMenu(event, { items: [] });

        // Bottom edge lands at clientY - 1; top = 699 - 300.
        expect(getMenu().style.top).toBe('399px');
    });

    it('flips left of the cursor when near the right edge', () => {
        const { event } = createMouseEvent(950, 100);
        showContextMenu(event, { items: [] });

        // Right edge lands at clientX - 1; left = 949 - 200.
        expect(getMenu().style.left).toBe('749px');
    });

    it('slides up instead of overflowing when it fits neither side of the cursor', () => {
        menuSize.height = 600;
        const { event } = createMouseEvent(100, 400);
        showContextMenu(event, { items: [] });

        // 768 - 8 margin - 600.
        expect(getMenu().style.top).toBe('160px');
        expect(getMenu().style.maxHeight).toBe('');
    });

    it('opens below the target, not at a cursor, when opened from the keyboard', () => {
        const { event, target } = createKeyboardClick();
        target.getBoundingClientRect = () => ({ left: 40, right: 140, top: 50, bottom: 70 }) as DOMRect;
        showContextMenu(event, { items: [] });

        expect(getMenu().style.left).toBe('40px');
        expect(getMenu().style.top).toBe('71px');
    });

    it('flips a keyboard-opened menu above the target when there is no room below', () => {
        const { event, target } = createKeyboardClick();
        target.getBoundingClientRect = () => ({ left: 40, right: 140, top: 600, bottom: 620 }) as DOMRect;
        showContextMenu(event, { items: [] });

        // Bottom edge lands at top - 1; top = 599 - 300.
        expect(getMenu().style.top).toBe('299px');
    });

    it('pins to the viewport and scrolls when taller than the viewport', () => {
        menuSize.height = 900;
        const { event } = createMouseEvent(100, 400);
        showContextMenu(event, { items: [] });

        expect(getMenu().style.top).toBe('8px');
        expect(getMenu().style.maxHeight).toBe('752px');
        expect(getMenu().style.overflowY).toBe('auto');
    });
});

describe('headings', () => {
    const items = () => [
        { title: 'Contact', heading: true, class: 'section' },
        { title: 'Assign', handler: vi.fn() },
        '-' as const,
        { title: 'Conversation', heading: true, handler: vi.fn() },
        { title: 'Unassign', handler: vi.fn() }
    ];

    it('renders headings apart from items', () => {
        const { event } = createMouseEvent();
        showContextMenu(event, { items: items() });

        const headings = document.querySelectorAll<HTMLElement>('.vf-context-menu .heading');
        expect(Array.from(headings).map(h => h.innerText)).toEqual(['Contact', 'Conversation']);
        expect(headings[0]!.classList.contains('section')).toBe(true);
        expect(headings[0]!.classList.contains('item')).toBe(false);
        expect(headings[0]!.getAttribute('role')).toBe('presentation');
        expect(headings[0]!.hasAttribute('tabindex')).toBe(false);
        expect(document.querySelectorAll('.item')).toHaveLength(2);
    });

    it('keeps the menu open and runs nothing when a heading is clicked', () => {
        const { event } = createMouseEvent();
        const menuItems = items();
        showContextMenu(event, { items: menuItems });

        document.querySelectorAll<HTMLElement>('.heading')[1]!.click();

        expect(document.querySelector('.vf-context-menu')).not.toBeNull();
        expect((menuItems[3] as { handler: () => void }).handler).not.toHaveBeenCalled();
    });

    it('focuses the first real item from the keyboard and skips headings with the arrows', () => {
        const { event } = createKeyboardClick();
        showContextMenu(event, { items: items() });

        expect((document.activeElement as HTMLElement).innerText).toBe('Assign');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect((document.activeElement as HTMLElement).innerText).toBe('Unassign');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect((document.activeElement as HTMLElement).innerText).toBe('Assign');
    });
});

describe('submenus', () => {
    function menus() {
        return document.querySelectorAll('.vf-context-menu');
    }

    function showWithSubmenu(handler = vi.fn()) {
        const { event } = createMouseEvent();
        showContextMenu(event, {
            items: [
                { title: 'Leaf', handler: vi.fn() },
                { title: 'Parent', items: [{ title: 'Child', handler }] }
            ]
        });
        return document.querySelectorAll('.item')[1] as HTMLElement;
    }

    it('renders a caret on items with children', () => {
        const parentItem = showWithSubmenu();
        expect(parentItem.classList.contains('has-submenu')).toBe(true);
        expect(parentItem.querySelector('.submenu-caret')).not.toBeNull();
    });

    it('opens the submenu on hover and marks the item open', () => {
        const parentItem = showWithSubmenu();
        parentItem.dispatchEvent(new MouseEvent('mouseenter'));

        expect(menus()).toHaveLength(2);
        expect(parentItem.classList.contains('submenu-open')).toBe(true);
    });

    it('opens the submenu on click without closing the menu', () => {
        const parentItem = showWithSubmenu();
        parentItem.click();

        expect(document.querySelector('.vf-overlay')).not.toBeNull();
        expect(menus()).toHaveLength(2);
    });

    it('runs a submenu item handler on click', () => {
        const handler = vi.fn();
        const parentItem = showWithSubmenu(handler);
        parentItem.dispatchEvent(new MouseEvent('mouseenter'));

        const childItem = menus()[1].querySelector('.item') as HTMLElement;
        childItem.click();
        expect(handler).toHaveBeenCalled();
    });

    it('closes the submenu when a sibling item is hovered', () => {
        const parentItem = showWithSubmenu();
        parentItem.dispatchEvent(new MouseEvent('mouseenter'));
        expect(menus()).toHaveLength(2);

        const siblingItem = document.querySelectorAll('.item')[0] as HTMLElement;
        siblingItem.dispatchEvent(new MouseEvent('mouseenter'));
        expect(menus()).toHaveLength(1);
        expect(parentItem.classList.contains('submenu-open')).toBe(false);
    });

    it('closes submenus with the rest of the menu on overlay click', () => {
        const parentItem = showWithSubmenu();
        parentItem.dispatchEvent(new MouseEvent('mouseenter'));

        (document.querySelector('.vf-overlay') as HTMLElement).click();
        expect(menus()).toHaveLength(0);
    });
});

describe('confirmation flow', () => {
    it('requires two clicks for confirm items', () => {
        const handler = vi.fn();
        const { event } = createMouseEvent();
        showContextMenu(event, {
            items: [{ title: 'Delete', handler, shouldConfirm: true }]
        });

        const item = document.querySelector('.item') as HTMLElement;

        item.click();
        expect(handler).not.toHaveBeenCalled();
        expect(item.classList.contains('pending-confirm')).toBe(true);
        expect(item.innerText).toBe('Confirm');

        item.click();
        expect(handler).toHaveBeenCalled();
    });

    it('resets on mouseleave', () => {
        const handler = vi.fn();
        const { event } = createMouseEvent();
        showContextMenu(event, {
            items: [{ title: 'Delete', handler, shouldConfirm: true }]
        });

        const item = document.querySelector('.item') as HTMLElement;
        item.click();
        expect(item.innerText).toBe('Confirm');

        item.dispatchEvent(new MouseEvent('mouseleave'));
        expect(item.classList.contains('pending-confirm')).toBe(false);
        expect(item.innerText).toBe('Delete');
    });
});

describe('keyboard', () => {
    let listeners: (() => void)[] = [];
    afterEach(() => {
        listeners.forEach(remove => remove());
        listeners = [];
        // Close anything a test left open, so its document keydown listener goes too.
        document.querySelectorAll<HTMLElement>('.vf-overlay').forEach(el => el.click());
    });

    function press(key: string, init: KeyboardEventInit = {}) {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
        (document.activeElement ?? document.body).dispatchEvent(event);
        return event;
    }

    function focusedTitle() {
        return (document.activeElement as HTMLElement).innerText;
    }

    const items = (handler = vi.fn()) => [
        { title: 'One', handler },
        '-' as const,
        { title: 'Two', handler: vi.fn() },
        { title: 'Three', handler: vi.fn() }
    ];

    it('focuses the first item when opened from the keyboard', () => {
        const { event } = createKeyboardClick();
        showContextMenu(event, { items: items() });

        expect(focusedTitle()).toBe('One');
        expect(document.querySelector('.vf-context-menu')!.getAttribute('role')).toBe('menu');
        expect(document.activeElement!.getAttribute('role')).toBe('menuitem');
    });

    it('opens from a key event', () => {
        const target = document.createElement('button');
        document.body.appendChild(target);
        const event = new KeyboardEvent('keydown', { key: 'ContextMenu' });
        Object.defineProperty(event, 'currentTarget', { value: target });
        showContextMenu(event, { items: items() });

        expect(focusedTitle()).toBe('One');
    });

    it('leaves a pointer-opened menu unfocused until an arrow key', () => {
        const { event } = createMouseEvent();
        showContextMenu(event, { items: items() });
        expect(document.activeElement).toBe(document.body);

        press('ArrowDown');
        expect(focusedTitle()).toBe('One');
    });

    it('moves with the arrows, skipping separators and wrapping, and jumps with Home/End', () => {
        const { event } = createKeyboardClick();
        showContextMenu(event, { items: items() });

        press('ArrowDown');
        expect(focusedTitle()).toBe('Two');
        press('ArrowDown');
        press('ArrowDown');
        expect(focusedTitle()).toBe('One');
        press('ArrowUp');
        expect(focusedTitle()).toBe('Three');
        press('Home');
        expect(focusedTitle()).toBe('One');
        press('End');
        expect(focusedTitle()).toBe('Three');
    });

    it('activates the focused item with Enter or Space, closes, and refocuses the target', () => {
        const handler = vi.fn();
        const { event, target } = createKeyboardClick();
        showContextMenu(event, { items: items(handler) });

        const enter = press('Enter');
        expect(handler).toHaveBeenCalledTimes(1);
        expect(enter.defaultPrevented).toBe(true);
        expect(document.querySelector('.vf-overlay')).toBeNull();
        expect(document.activeElement).toBe(target);

        showContextMenu(event, { items: items(handler) });
        press(' ');
        expect(handler).toHaveBeenCalledTimes(2);
    });

    it('leaves focus where the chosen item put it', () => {
        const input = document.createElement('input');
        document.body.appendChild(input);
        const { event } = createKeyboardClick();
        showContextMenu(event, { items: [{ title: 'Edit', handler: () => input.focus() }] });

        press('Enter');
        expect(document.activeElement).toBe(input);
    });

    it('swallows Enter with nothing in the menu focused', () => {
        const { event } = createMouseEvent();
        showContextMenu(event, { items: items() });

        expect(press('Enter').defaultPrevented).toBe(true);
        expect(document.querySelector('.vf-overlay')).not.toBeNull();
    });

    it('closes on Escape without letting it reach listeners beneath', () => {
        const beneath = vi.fn();
        document.addEventListener('keydown', beneath);
        listeners.push(() => document.removeEventListener('keydown', beneath));
        const { event, target } = createKeyboardClick();
        showContextMenu(event, { items: items() });

        press('Escape');
        expect(document.querySelector('.vf-overlay')).toBeNull();
        expect(document.activeElement).toBe(target);
        expect(beneath).not.toHaveBeenCalled();

        // Closed: keys pass through again.
        press('Escape');
        expect(beneath).toHaveBeenCalledTimes(1);
    });

    it('closes on Tab', () => {
        const { event } = createKeyboardClick();
        showContextMenu(event, { items: items() });

        press('Tab');
        expect(document.querySelector('.vf-overlay')).toBeNull();
    });

    it('opens a submenu with → or Enter and leaves it with ← or Escape', () => {
        const child = vi.fn();
        const { event } = createKeyboardClick();
        showContextMenu(event, {
            items: [
                { title: 'Leaf', handler: vi.fn() },
                { title: 'Parent', items: [{ title: 'Child', handler: child }] }
            ]
        });
        const menus = () => document.querySelectorAll('.vf-context-menu');

        press('ArrowDown');
        expect(document.activeElement!.getAttribute('aria-haspopup')).toBe('menu');
        press('ArrowRight');
        expect(menus()).toHaveLength(2);
        expect(focusedTitle()).toBe('Child');

        press('ArrowLeft');
        expect(menus()).toHaveLength(1);
        expect(focusedTitle()).toContain('Parent');

        press('Enter');
        expect(focusedTitle()).toBe('Child');
        press('Escape');
        expect(menus()).toHaveLength(1);
        expect(document.querySelector('.vf-overlay')).not.toBeNull();

        press('ArrowRight');
        press('Enter');
        expect(child).toHaveBeenCalled();
        expect(document.querySelector('.vf-overlay')).toBeNull();
    });

    it('focuses an item on hover, so the arrows continue from it', () => {
        const { event } = createMouseEvent();
        showContextMenu(event, { items: items() });

        document.querySelectorAll('.item')[1]!.dispatchEvent(new MouseEvent('mouseenter'));
        expect(focusedTitle()).toBe('Two');
        press('ArrowDown');
        expect(focusedTitle()).toBe('Three');
    });

    it('confirms with a second Enter, and resets when the focus moves on', () => {
        const handler = vi.fn();
        const { event } = createKeyboardClick();
        showContextMenu(event, {
            items: [
                { title: 'Delete', handler, shouldConfirm: true },
                { title: 'Keep', handler: vi.fn() }
            ]
        });

        press('Enter');
        expect(focusedTitle()).toBe('Confirm');
        press('ArrowDown');
        expect(document.querySelector('.item')!.classList.contains('pending-confirm')).toBe(false);
        expect((document.querySelector('.item') as HTMLElement).innerText).toBe('Delete');

        press('ArrowUp');
        press('Enter');
        press('Enter');
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("ignores a held key's repeats, so holding Enter on the opener doesn't pick an item", () => {
        const handler = vi.fn();
        const { event } = createKeyboardClick();
        showContextMenu(event, { items: items(handler) });

        expect(press('Enter', { repeat: true }).defaultPrevented).toBe(true);
        expect(handler).not.toHaveBeenCalled();
        expect(document.querySelector('.vf-overlay')).not.toBeNull();
    });

    it('ignores a hover the pointer did not make until the mouse moves', () => {
        const { event } = createKeyboardClick();
        showContextMenu(event, { items: items() });
        const two = document.querySelectorAll('.item')[1]!;

        // The menu appeared under a resting cursor.
        two.dispatchEvent(new MouseEvent('mouseenter'));
        expect(focusedTitle()).toBe('One');

        two.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
        expect(focusedTitle()).toBe('Two');

        // Keys hand the highlight back to the keyboard until the next real move.
        press('ArrowDown');
        document.querySelector('.item')!.dispatchEvent(new MouseEvent('mouseenter'));
        expect(focusedTitle()).toBe('Three');
    });

    it('closes a hover-opened submenu when the keyboard moves on', () => {
        const { event } = createMouseEvent();
        showContextMenu(event, {
            items: [
                { title: 'Leaf', handler: vi.fn() },
                { title: 'Parent', items: [{ title: 'Child', handler: vi.fn() }] }
            ]
        });
        const parent = document.querySelectorAll('.item')[1] as HTMLElement;

        parent.dispatchEvent(new MouseEvent('mouseenter'));
        expect(parent.getAttribute('aria-expanded')).toBe('true');
        press('ArrowDown');
        expect(focusedTitle()).toBe('Leaf');
        expect(document.querySelectorAll('.vf-context-menu')).toHaveLength(1);
        expect(parent.classList.contains('submenu-open')).toBe(false);
        expect(parent.getAttribute('aria-expanded')).toBe('false');
    });

    it('leaves focus alone when a pointer-only menu closes', () => {
        const { event, target } = createMouseEvent();
        target.tabIndex = 0;
        showContextMenu(event, { items: items() });

        const one = document.querySelector('.item') as HTMLElement;
        one.dispatchEvent(new MouseEvent('mouseenter'));
        one.click();
        expect(document.activeElement).not.toBe(target);
    });

    it('gives the keys to the latest menu only', () => {
        const first = vi.fn();
        const second = vi.fn();
        showContextMenu(createKeyboardClick().event, { items: [{ title: 'A1', handler: first }] });
        showContextMenu(createKeyboardClick().event, {
            items: [
                { title: 'B1', handler: vi.fn() },
                { title: 'B2', handler: second }
            ]
        });

        press('ArrowDown');
        expect(focusedTitle()).toBe('B2');
        press('Enter');
        expect(second).toHaveBeenCalled();
        expect(first).not.toHaveBeenCalled();

        // With the second closed, the first takes them again.
        press('ArrowDown');
        expect(focusedTitle()).toBe('A1');
    });

    it('leaves an outside field its editing keys', () => {
        const input = document.createElement('input');
        document.body.appendChild(input);
        const { event } = createMouseEvent();
        showContextMenu(event, { items: items() });
        input.focus();

        expect(press(' ').defaultPrevented).toBe(false);
        expect(press('Home').defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(input);

        press('ArrowDown');
        expect(focusedTitle()).toBe('One');
    });
});
