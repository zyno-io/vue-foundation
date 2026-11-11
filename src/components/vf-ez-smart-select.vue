<template>
    <VfSmartSelect
        v-model="selectedItem"
        :options="computedOpts"
        :formatter="ezFormatter"
        :null-title="nullTitle"
        :placeholder="placeholder"
        :name="name"
    >
        <!-- Forwarded only when given, so the inner select keeps its own default rendering otherwise. -->
        <template v-if="$slots.option" #option="slotProps">
            <slot name="option" v-bind="slotProps" />
        </template>
        <template v-if="$slots['no-results']" #no-results>
            <slot name="no-results" />
        </template>
    </VfSmartSelect>
</template>

<script lang="ts" setup generic="T extends string">
import { isEqual } from 'lodash';
import { computed, ref, watch } from 'vue';

import VfSmartSelect from './vf-smart-select.vue';

interface IComputedOption {
    value: T;
    label: string;
}

const props = defineProps<{
    modelValue: T | null | undefined;
    nullTitle?: string;
    placeholder?: string;
    options: { [key in T]: string } | T[];
    formatter?: (label: string, key: T) => string;
    name?: string;
}>();

const computedOpts = computed(() => {
    return Array.isArray(props.options)
        ? props.options.map(o => ({ value: o, label: String(o) }))
        : Object.entries(props.options).map(([value, label]) => ({
              value: value as T,
              label: label as string
          }));
});

const ezFormatter = computed(() => {
    if (props.formatter) {
        return (o: IComputedOption) => props.formatter!(o.label, o.value);
    }
    return (o: IComputedOption) => o.label;
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: T | null): void;
}>();

const selectedItem = ref<IComputedOption | null>(computedOpts.value.find(o => o.value === props.modelValue) ?? null);
watch(
    () => props.modelValue,
    value => {
        selectedItem.value = computedOpts.value.find(o => o.value === value) ?? null;
    }
);
watch(selectedItem, value => {
    const emitValue = value ? computedOpts.value.find(o => isEqual(o, value))?.value : null;
    emit('update:modelValue', emitValue ?? null);
});
</script>
