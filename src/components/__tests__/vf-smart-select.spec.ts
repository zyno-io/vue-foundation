import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import VfSmartSelect from '../vf-smart-select.vue';

interface TestOption {
    id: number;
    name: string;
}

const options: TestOption[] = [
    { id: 1, name: 'Apple' },
    { id: 2, name: 'Banana' },
    { id: 3, name: 'Cherry' }
];

function mountSmartSelect(props: Record<string, unknown> = {}) {
    return mount(VfSmartSelect, {
        props: {
            modelValue: null,
            options,
            formatter: (o: TestOption) => o.name,
            keyField: 'id' as keyof TestOption,
            ...props
        },
        attachTo: document.body
    });
}

async function openDropdown(wrapper: ReturnType<typeof mountSmartSelect>) {
    await wrapper.find('input').trigger('focus');
    await wrapper.vm.$nextTick();
    vi.runAllTimers();
    await wrapper.vm.$nextTick();
    vi.runAllTimers();
    await wrapper.vm.$nextTick();
}

describe('VfSmartSelect', () => {
    afterEach(() => {
        vi.useRealTimers();
        document.querySelectorAll('.vf-smart-select-options').forEach(el => el.remove());
    });

    it('renders an input element', () => {
        const wrapper = mountSmartSelect();
        expect(wrapper.find('input').exists()).toBe(true);
    });

    it('shows placeholder when no value selected', () => {
        const wrapper = mountSmartSelect({ placeholder: 'Pick a fruit' });
        expect(wrapper.find('input').attributes('placeholder')).toBe('Pick a fruit');
    });

    it('shows nullTitle as placeholder when provided', () => {
        const wrapper = mountSmartSelect({ nullTitle: 'All fruits' });
        expect(wrapper.find('input').attributes('placeholder')).toBe('All fruits');
    });

    it('opens dropdown on focus', async () => {
        vi.useFakeTimers();
        const wrapper = mountSmartSelect();
        await openDropdown(wrapper);
        expect(wrapper.find('.vf-smart-select').classes()).toContain('open');
    });

    it('renders options when open', async () => {
        vi.useFakeTimers();
        const wrapper = mountSmartSelect({ debug: true });
        await openDropdown(wrapper);

        const optionEls = document.querySelectorAll('.vf-smart-select-options .option');
        expect(optionEls.length).toBe(3);
    });

    it('renders null option when nullTitle is provided', async () => {
        vi.useFakeTimers();
        const wrapper = mountSmartSelect({ nullTitle: 'None', debug: true });
        await openDropdown(wrapper);

        const optionEls = document.querySelectorAll('.vf-smart-select-options .option');
        expect(optionEls.length).toBe(4);
        expect(optionEls[0]?.textContent).toContain('None');
    });

    it('selects option on mousedown', async () => {
        vi.useFakeTimers();
        const wrapper = mountSmartSelect({ debug: true });
        await openDropdown(wrapper);

        const optionEls = document.querySelectorAll('.vf-smart-select-options .option');
        (optionEls[1] as HTMLElement)?.dispatchEvent(new Event('mousedown'));
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    });

    it('shows selected value in input', async () => {
        const wrapper = mountSmartSelect({
            modelValue: options[0],
            valueField: undefined,
            valueExtractor: undefined
        });
        await wrapper.vm.$nextTick();
        expect(wrapper.find('input').element.value).toBe('Apple');
    });

    it('disables input when disabled prop is true', () => {
        const wrapper = mountSmartSelect({ disabled: true });
        expect(wrapper.find('input').element.disabled).toBe(true);
        expect(wrapper.find('.vf-smart-select').classes()).toContain('disabled');
    });

    it('closes on Escape key', async () => {
        vi.useFakeTimers();
        const wrapper = mountSmartSelect({ debug: true });
        await openDropdown(wrapper);
        expect(wrapper.find('.vf-smart-select').classes()).toContain('open');

        await wrapper.find('input').trigger('keydown', { key: 'Escape' });
        vi.runAllTimers();
        await wrapper.vm.$nextTick();
    });

    it('filters options when searching', async () => {
        vi.useFakeTimers();
        const wrapper = mountSmartSelect({ debug: true });
        await openDropdown(wrapper);

        await wrapper.find('input').trigger('keydown', { key: 'a' });
        await wrapper.find('input').setValue('ap');
        vi.runAllTimers();
        await wrapper.vm.$nextTick();
        vi.runAllTimers();
        await wrapper.vm.$nextTick();

        const optionEls = document.querySelectorAll('.vf-smart-select-options .option');
        expect(optionEls.length).toBe(1);
        expect(optionEls[0]?.textContent).toContain('Apple');
    });

    it('filters using searchFields values', async () => {
        vi.useFakeTimers();
        const wrapper = mountSmartSelect({
            debug: true,
            searchFields: ['name'] as (keyof TestOption)[]
        });
        await openDropdown(wrapper);

        await wrapper.find('input').trigger('keydown', { key: 'a' });
        await wrapper.find('input').setValue('ap');
        vi.runAllTimers();
        await wrapper.vm.$nextTick();
        vi.runAllTimers();
        await wrapper.vm.$nextTick();

        const optionEls = document.querySelectorAll('.vf-smart-select-options .option');
        expect(optionEls.length).toBe(1);
        expect(optionEls[0]?.textContent).toContain('Apple');
    });

    it('updates create option text after pause and continued typing', async () => {
        vi.useFakeTimers();
        const wrapper = mountSmartSelect({
            debug: true,
            onCreateItem: vi.fn()
        });
        await openDropdown(wrapper);

        await wrapper.find('input').trigger('keydown', { key: 'x' });
        await wrapper.find('input').setValue('mang');
        vi.runAllTimers();
        await wrapper.vm.$nextTick();
        vi.runAllTimers();
        await wrapper.vm.$nextTick();

        const firstCreateOption = Array.from(document.querySelectorAll('.vf-smart-select-options .option')).find(option =>
            option.textContent?.includes('Create')
        );
        expect(firstCreateOption?.textContent).toContain('mang');

        await wrapper.find('input').trigger('keydown', { key: 'o' });
        await wrapper.find('input').setValue('mango');
        expect(wrapper.find('input').element.value).toBe('mango');
        vi.runAllTimers();
        await wrapper.vm.$nextTick();
        vi.runAllTimers();
        await wrapper.vm.$nextTick();

        const secondCreateOption = Array.from(document.querySelectorAll('.vf-smart-select-options .option')).find(option =>
            option.textContent?.includes('Create')
        );
        expect(secondCreateOption?.textContent).toContain('mango');
    });

    it('sets required attribute on input', () => {
        const wrapper = mountSmartSelect({ required: true });
        expect(wrapper.find('input').attributes('required')).toBeDefined();
    });

    it('sets name attribute on input', () => {
        const wrapper = mountSmartSelect({ name: 'fruit' });
        expect(wrapper.find('input').attributes('name')).toBe('fruit');
    });

    it('displays selected value when options arrive after modelValue is set', async () => {
        const wrapper = mount(VfSmartSelect, {
            props: {
                modelValue: 2,
                options: [] as TestOption[],
                formatter: (o: TestOption) => o.name,
                keyField: 'id' as keyof TestOption,
                valueField: 'id' as keyof TestOption
            },
            attachTo: document.body
        });
        await wrapper.vm.$nextTick();

        // Input should be blank since no options matched
        expect(wrapper.find('input').element.value).toBe('');

        // Simulate options arriving asynchronously
        await wrapper.setProps({ options });
        await wrapper.vm.$nextTick();

        // Now the selected value should be displayed
        expect(wrapper.find('input').element.value).toBe('Banana');
    });
    it('keeps typed search text when modelValue matches no option', async () => {
        vi.useFakeTimers();
        // 0 is a common "unset" sentinel for a required numeric id: non-null, but not a real option
        const wrapper = mountSmartSelect({
            debug: true,
            modelValue: 0,
            valueField: 'id' as keyof TestOption
        });
        await openDropdown(wrapper);

        await wrapper.find('input').trigger('keydown', { key: 'a' });
        await wrapper.find('input').setValue('a');
        vi.runAllTimers();
        await wrapper.vm.$nextTick();
        vi.runAllTimers();
        await wrapper.vm.$nextTick();

        expect(wrapper.find('input').element.value).toBe('a');
        const optionEls = document.querySelectorAll('.vf-smart-select-options .option');
        expect(optionEls.length).toBe(2);
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });

    it('keeps typed search text when options change while searching', async () => {
        vi.useFakeTimers();
        const wrapper = mountSmartSelect({
            debug: true,
            modelValue: 0,
            valueField: 'id' as keyof TestOption
        });
        await openDropdown(wrapper);

        await wrapper.find('input').trigger('keydown', { key: 'a' });
        await wrapper.find('input').setValue('an');
        vi.runAllTimers();
        await wrapper.vm.$nextTick();

        // e.g. a parent re-render handing down a fresh options array
        await wrapper.setProps({ options: [...options, { id: 4, name: 'Mango' }] });
        vi.runAllTimers();
        await wrapper.vm.$nextTick();

        expect(wrapper.find('input').element.value).toBe('an');
        const optionEls = document.querySelectorAll('.vf-smart-select-options .option');
        expect(optionEls.length).toBe(2);
    });

    it('clears search highlights once the search text is cleared', async () => {
        vi.useFakeTimers();
        const wrapper = mountSmartSelect({ debug: true });
        await openDropdown(wrapper);

        await wrapper.find('input').trigger('keydown', { key: 'a' });
        await wrapper.find('input').setValue('a');
        vi.runAllTimers();
        await wrapper.vm.$nextTick();
        vi.runAllTimers();
        await wrapper.vm.$nextTick();
        expect(document.querySelectorAll('.vf-smart-select-options mark').length).toBe(4);

        // the next keystroke re-marks against the new term rather than piling onto the old marks
        await wrapper.find('input').trigger('keydown', { key: 'n' });
        await wrapper.find('input').setValue('an');
        vi.runAllTimers();
        await wrapper.vm.$nextTick();
        vi.runAllTimers();
        await wrapper.vm.$nextTick();
        const marks = Array.from(document.querySelectorAll('.vf-smart-select-options mark'));
        expect(marks.map(mark => mark.textContent)).toEqual(['an', 'an']);

        await wrapper.find('input').trigger('keydown', { key: 'Backspace' });
        await wrapper.find('input').setValue('');
        vi.runAllTimers();
        await wrapper.vm.$nextTick();
        vi.runAllTimers();
        await wrapper.vm.$nextTick();

        expect(document.querySelectorAll('.vf-smart-select-options .option').length).toBe(3);
        expect(document.querySelectorAll('.vf-smart-select-options mark').length).toBe(0);
    });
    it('keeps text typed while a lazy remote load is in flight', async () => {
        vi.useFakeTimers();
        let resolveLoad!: (value: TestOption[]) => void;
        const wrapper = mount(VfSmartSelect, {
            props: {
                modelValue: 0,
                loadOptions: () => new Promise<TestOption[]>(resolve => (resolveLoad = resolve)),
                formatter: (o: TestOption) => o.name,
                keyField: 'id' as keyof TestOption,
                valueField: 'id' as keyof TestOption,
                debug: true
            },
            attachTo: document.body
        });
        await openDropdown(wrapper);

        // paste is allowed before the options are loaded, and it starts a search
        await wrapper.find('input').trigger('paste');
        await wrapper.find('input').setValue('ban');
        vi.runAllTimers();
        await wrapper.vm.$nextTick();

        resolveLoad(options);
        await wrapper.vm.$nextTick();
        await wrapper.vm.$nextTick();
        vi.runAllTimers();
        await wrapper.vm.$nextTick();

        expect(wrapper.find('input').element.value).toBe('ban');
        const optionEls = document.querySelectorAll('.vf-smart-select-options .option');
        expect(optionEls.length).toBe(1);
        expect(optionEls[0]?.textContent).toContain('Banana');
    });

    it('does not emit undefined when options arrive for an unmatched modelValue', async () => {
        const wrapper = mount(VfSmartSelect, {
            props: {
                modelValue: 0,
                options: undefined as TestOption[] | undefined,
                formatter: (o: TestOption) => o.name,
                keyField: 'id' as keyof TestOption,
                valueField: 'id' as keyof TestOption
            },
            attachTo: document.body
        });
        await wrapper.vm.$nextTick();

        await wrapper.setProps({ options });
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
        expect(wrapper.find('input').element.value).toBe('');
    });
});
