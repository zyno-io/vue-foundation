import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import VfEzSmartSelect from '../vf-ez-smart-select.vue';

async function openDropdown(wrapper: ReturnType<typeof mount>) {
    await wrapper.find('input').trigger('focus');
    await wrapper.vm.$nextTick();
    vi.runAllTimers();
    await wrapper.vm.$nextTick();
    vi.runAllTimers();
    await wrapper.vm.$nextTick();
}

describe('VfEzSmartSelect', () => {
    afterEach(() => {
        vi.useRealTimers();
        document.querySelectorAll('.vf-smart-select-options').forEach(el => el.remove());
    });

    it('renders with object options', async () => {
        vi.useFakeTimers();
        const wrapper = mount(VfEzSmartSelect, {
            props: {
                modelValue: null,
                options: { apple: 'Apple', banana: 'Banana' } as Record<string, string>,
                debug: true
            },
            attachTo: document.body
        });

        await openDropdown(wrapper);
        const optionEls = document.querySelectorAll('.vf-smart-select-options .option');
        expect(optionEls.length).toBe(2);
    });

    it('forwards the option slot to the inner select', async () => {
        vi.useFakeTimers();
        const wrapper = mount(VfEzSmartSelect, {
            props: {
                modelValue: null,
                options: { apple: 'Apple', banana: 'Banana' } as Record<string, string>
            },
            slots: {
                option: `<template #option="{ option }"><em class="custom">{{ option.ref.value }}:{{ option.title }}</em></template>`
            },
            attachTo: document.body
        });

        await openDropdown(wrapper);
        const custom = [...document.querySelectorAll('.vf-smart-select-options .option .custom')].map(el => el.textContent);
        expect(custom).toEqual(['apple:Apple', 'banana:Banana']);
        expect(document.querySelector('.vf-smart-select-options .option .title')).toBeNull();
    });

    it('renders option labels as text when no slot is given', async () => {
        vi.useFakeTimers();
        const hostile = '<img src=x onerror="window.__vfPwned = true">';
        const wrapper = mount(VfEzSmartSelect, {
            props: {
                modelValue: null,
                options: { a: hostile } as Record<string, string>
            },
            attachTo: document.body
        });

        await openDropdown(wrapper);
        const list = document.querySelector('.vf-smart-select-options')!;
        expect(list.querySelector('img')).toBeNull();
        expect(list.querySelector('.option .title')!.textContent).toBe(hostile);
    });

    it('renders with array options', async () => {
        vi.useFakeTimers();
        const wrapper = mount(VfEzSmartSelect, {
            props: {
                modelValue: null,
                options: ['Red', 'Green', 'Blue'] as string[],
                debug: true
            },
            attachTo: document.body
        });

        await openDropdown(wrapper);
        const optionEls = document.querySelectorAll('.vf-smart-select-options .option');
        expect(optionEls.length).toBe(3);
    });

    it('shows selected value in input', async () => {
        const wrapper = mount(VfEzSmartSelect, {
            props: {
                modelValue: 'banana',
                options: { apple: 'Apple', banana: 'Banana' } as Record<string, string>
            },
            attachTo: document.body
        });

        await wrapper.vm.$nextTick();
        expect(wrapper.find('input').element.value).toBe('Banana');
    });

    it('shows nullTitle as placeholder', () => {
        const wrapper = mount(VfEzSmartSelect, {
            props: {
                modelValue: null,
                options: ['A', 'B'] as string[],
                nullTitle: 'All items'
            },
            attachTo: document.body
        });

        expect(wrapper.find('input').attributes('placeholder')).toBe('All items');
    });

    it('applies custom formatter', async () => {
        const wrapper = mount(VfEzSmartSelect, {
            props: {
                modelValue: 'us',
                options: { us: 'United States', uk: 'United Kingdom' } as Record<string, string>,
                formatter: (label: string, key: string) => `${label} (${key.toUpperCase()})`
            },
            attachTo: document.body
        });

        await wrapper.vm.$nextTick();
        expect(wrapper.find('input').element.value).toBe('United States (US)');
    });

    it('passes placeholder to smart select', () => {
        const wrapper = mount(VfEzSmartSelect, {
            props: {
                modelValue: null,
                options: ['A'] as string[],
                placeholder: 'Choose...'
            },
            attachTo: document.body
        });

        expect(wrapper.find('input').attributes('placeholder')).toBe('Choose...');
    });
});
