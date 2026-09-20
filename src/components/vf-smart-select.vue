<!-- eslint-disable vue/no-v-html -->
<template>
    <div ref="el" class="vf-smart-select" :class="{ disabled: effectiveDisabled, open: shouldDisplayOptions }">
        <input
            ref="searchField"
            v-model="searchText"
            type="text"
            :disabled="effectiveDisabled"
            :class="{ nullable: !!nullTitle }"
            :placeholder="effectivePlaceholder"
            :required="required"
            :name="name"
            data-1p-ignore
            @keydown="handleKeyDown"
            @paste="handlePaste"
            @focus="handleInputFocused"
            @blur="handleInputBlurred"
        />
        <div v-if="shouldDisplayOptions" ref="optionsContainer" class="vf-smart-select-options" :class="{ grouped: isGrouped }">
            <div v-if="!isLoaded" class="no-results">Loading...</div>
            <template v-else>
                <div v-for="group in groupedOptions" :key="group.groupTitle" class="group">
                    <div v-if="group.groupTitle" class="group-title">
                        <slot name="group" :group="group.groupTitle">
                            {{ group.groupTitle }}
                        </slot>
                    </div>

                    <div
                        v-for="option in group.options"
                        :key="option.key"
                        class="option"
                        :class="[
                            highlightedOptionKey === option.key && 'highlighted',
                            option.ref && classForOption?.(option.ref),
                            option.key === CreateSymbol && 'create-option'
                        ]"
                        @mousemove="handleOptionHover(option)"
                        @mousedown="selectOption(option)"
                    >
                        <slot name="option" :option="option">
                            <div class="title" v-html="option.title" />
                            <div v-if="option.subtitle" class="subtitle" v-html="option.subtitle" />
                        </slot>
                    </div>
                    <div v-if="!effectiveOptions.length && searchText" class="no-results">
                        <slot name="no-results">
                            {{ effectiveNoResultsText }}
                        </slot>
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<script lang="ts" setup generic="T, V = T">
import { debounce, groupBy, isEqual, uniq } from 'lodash';
import Mark from 'mark.js';
import { computed, nextTick, onBeforeUnmount, onMounted, onUpdated, ref, watch } from 'vue';

import { isNotNullOrUndefined } from '@/helpers';

import type { VfSmartSelectOptionDescriptor } from './vf-smart-select.types';

const NullSymbol = Symbol('null');
const CreateSymbol = Symbol('create');

const VALID_KEYS = `\`1234567890-=[]\\;',./~!@#$%^&*()_+{}|:"<>?qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM`;

const COPIED_STYLES = [
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'font-variant',
    'letter-spacing',
    'word-spacing',
    'line-height',
    'text-align',
    'text-transform',
    'text-decoration',
    'text-indent',
    'text-shadow',
    'text-overflow',
    'text-rendering'
] as const;

/** Space left between the field and the options list. */
const OPTIONS_GAP = 2;
/** Space the options list keeps clear of the viewport edge it opens towards. */
const OPTIONS_VIEWPORT_MARGIN = 12;
/** Never squash the list below this, even where neither side has the room -- an all-but-invisible list is worse than one that overhangs. */
const OPTIONS_MIN_HEIGHT = 80;

function normalizeSearchText(value: unknown): string {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/gi, '');
}

const props = withDefaults(
    defineProps<{
        modelValue: V | null;
        loadingText?: string;
        loadOptions?: (searchText: string | null) => Promise<T[]>;
        options?: T[];
        prependOptions?: T[];
        appendOptions?: T[];
        onCreateItem?: (searchText: string) => void;
        preload?: boolean;
        remoteSearch?: boolean;
        searchFields?: (keyof T)[];
        placeholder?: string;
        keyField?: keyof T;
        keyExtractor?: (option: T) => string | symbol;
        valueField?: keyof T;
        valueExtractor?: (option: T) => V;
        labelField?: keyof T;
        groupField?: keyof T;
        groupFormatter?: (option: T) => string;
        formatter?: (option: T) => string;
        subtitleFormatter?: (option: T) => string;
        classForOption?: (option: T) => string;
        selectionFormatter?: (option: T) => string;
        nullTitle?: string;
        noResultsText?: string;
        disabled?: boolean;
        optionsListId?: string;
        debug?: boolean;
        required?: boolean;
        showCreateTextOnNewItem?: boolean;
        autoNext?: boolean;
        name?: string;
        autofocus?: boolean;
    }>(),
    {
        showCreateTextOnNewItem: true
    }
);

const emit = defineEmits<{
    optionsLoaded: [T[]];
    'update:modelValue': [V];
}>();

defineExpose({
    addRemoteOption
});

const el = ref<HTMLDivElement>();
const searchField = ref<HTMLInputElement>();
const optionsContainer = ref<HTMLDivElement>();

/** Side the open list has committed to; null until it has had real content to measure. Deliberately not reactive -- it's written from onUpdated. */
let optionsDisplayAbove: boolean | null = null;
/** Whether the open list currently carries search-term marks. Not reactive -- it's bookkeeping for onUpdated. */
let hasSearchMarks = false;

const isLoading = ref(false);
const remoteOptions = ref<T[]>();
const isSearching = ref(false);
const searchText = ref('');
const filteringSearchText = ref('');
const selectedOption = ref<T | null>(null);
const selectedOptionTitle = ref<string | null>(null);
const shouldDisplayOptions = ref(false);
const highlightedOptionKey = ref<string | symbol | null>(null);
const shouldShowCreateOption = ref(false);
const shouldShowCreateTextOnNewItem = computed(() => props.showCreateTextOnNewItem);

const isLoaded = computed(() => !!(props.options || remoteOptions.value));
const loadedOptions = computed(() => props.options ?? remoteOptions.value ?? []);

const effectivePrependOptions = computed(() => props.prependOptions ?? []);
const effectiveAppendOptions = computed(() => props.appendOptions ?? []);
const effectiveDisabled = computed(() => !!props.disabled || (!isLoaded.value && !props.loadOptions));
const effectiveLoadingText = computed(() => props.loadingText || '...');
const effectivePlaceholder = computed(() => {
    if (!isLoaded.value) {
        if (!props.loadOptions) return effectiveLoadingText.value;
        if (props.preload) return effectiveLoadingText.value;
        if (props.modelValue && (props.valueField || props.valueExtractor)) {
            return effectiveLoadingText.value;
        }
    }
    if (props.nullTitle) return props.nullTitle;
    return props.placeholder || '';
});
const effectiveNoResultsText = computed(() => props.noResultsText || 'No options match your search.');

const effectiveValueExtractor = computed(() => {
    if (props.valueExtractor) return props.valueExtractor;
    if (props.valueField) return (option: T) => option[props.valueField!];
    return null;
});
const effectiveKeyExtractor = computed(() => {
    if (props.keyExtractor) return props.keyExtractor;
    if (props.keyField) return (option: T) => String(option[props.keyField!]);
    if (effectiveValueExtractor.value) return (option: T) => String(effectiveValueExtractor.value!(option));
    return null;
});
const effectiveGroupFormatter = computed(() => {
    if (props.groupFormatter) return props.groupFormatter;
    if (props.groupField) return (option: T) => String(option[props.groupField!]);
    return null;
});
const effectiveFormatter = computed(() => {
    if (props.formatter) return props.formatter;
    if (props.labelField) return (option: T) => String(option[props.labelField!]);
    return (option: T) => String(option);
});
const effectiveSelectionFormatter = computed(() => {
    if (props.selectionFormatter) return props.selectionFormatter;
    return effectiveFormatter.value;
});

const allOptions = computed(() => [...effectivePrependOptions.value, ...loadedOptions.value, ...effectiveAppendOptions.value]);
const isGrouped = computed(() => !!(props.groupField || props.groupFormatter));

const optionsDescriptors = computed(() => {
    return allOptions.value.map((option, index) => {
        const group = effectiveGroupFormatter.value?.(option);
        const title = effectiveFormatter.value(option);
        const subtitle = props.subtitleFormatter?.(option);
        const strippedTitle = normalizeSearchText(title);
        const strippedSubtitle = normalizeSearchText(subtitle);

        const searchContent = [];
        if (props.searchFields) {
            props.searchFields.forEach(field => {
                if (option[field]) {
                    searchContent.push(normalizeSearchText(option[field]));
                }
            });
        } else {
            searchContent.push(strippedTitle);
            if (strippedSubtitle) {
                searchContent.push(strippedSubtitle);
            }
        }

        return {
            key: effectiveKeyExtractor.value?.(option) ?? String(index),
            group,
            title,
            subtitle,
            searchContent: searchContent.join(' '),
            ref: option
        } as VfSmartSelectOptionDescriptor<T>;
    });
});

const effectiveOptions = computed(() => {
    let options = [...optionsDescriptors.value];

    if (isSearching.value) {
        const strippedSearchText = normalizeSearchText(filteringSearchText.value);

        if (strippedSearchText.length) {
            options = options.filter(option => option.searchContent!.includes(strippedSearchText));
            if (shouldShowCreateOption.value) {
                const hasExactMatch = options.find(option => option.searchContent === strippedSearchText) !== undefined;
                if (!hasExactMatch) {
                    options.push({
                        key: CreateSymbol,
                        title: shouldShowCreateTextOnNewItem.value
                            ? 'Create <strong>' + searchText.value.trim() + '</strong>...'
                            : searchText.value.trim()
                    });
                }
            }
        }
    } else if (props.nullTitle) {
        options.unshift({
            key: NullSymbol,
            title: props.nullTitle
        });
    }

    return options;
});

const groupedOptions = computed(() => {
    if (!isGrouped.value) {
        return [
            {
                groupTitle: '',
                options: effectiveOptions.value
            }
        ];
    }

    const groupTitles = uniq(effectiveOptions.value.map(option => option.group ?? ''));
    const groupedOptions = groupBy(effectiveOptions.value, option => option.group ?? '');
    return groupTitles.map(groupTitle => ({
        groupTitle,
        options: groupedOptions[groupTitle!]
    }));
});

// watch props
watch(
    () => props.modelValue,
    () => handleValueChanged()
);

// watch data

watch(optionsDescriptors, () => {
    if (shouldDisplayOptions.value) {
        setTimeout(highlightInitialOption, 0);
    }
});

const updateFilteringSearchText = debounce(() => {
    filteringSearchText.value = searchText.value;
}, 150);

watch(searchText, () => {
    // don't disable searching here if it's remote search, as that will need to be done after the fetch
    if (isSearching.value && !props.remoteSearch && !searchText.value.trim().length) {
        isSearching.value = false;
    }

    updateFilteringSearchText();
});

watch(shouldDisplayOptions, () => {
    if (shouldDisplayOptions.value) {
        setTimeout(handleOptionsDisplayed, 0);
    } else {
        isSearching.value = false;
        hasSearchMarks = false;
        searchText.value = selectedOptionTitle.value ?? '';

        if (optionsContainer.value) {
            optionsContainer.value.style.visibility = 'hidden';
        }
    }
});

// a modelValue that arrived before its options -- or a non-null "unset" placeholder such as 0 that
// never matches anything -- is still pending, so each new option list (or extractor) is another chance
// to resolve it. this deliberately watches the unfiltered list: effectiveOptions changes on every search
// keystroke, and re-running the value sync from there wiped whatever the user had just typed
watch([allOptions, effectiveValueExtractor], () => {
    if (props.modelValue !== null && !isNotNullOrUndefined(selectedOption.value)) {
        handleValueChanged({ preserveSearchText: isSearching.value });
    }
});

watch(effectiveOptions, () => {
    if (
        (highlightedOptionKey.value !== null || isSearching.value) &&
        !effectiveOptions.value.find(option => option.key == highlightedOptionKey.value)
    ) {
        highlightedOptionKey.value = effectiveOptions.value[0]?.key ?? NullSymbol;
    }
});

onMounted(async () => {
    shouldShowCreateOption.value = props.onCreateItem !== undefined;

    if (props.loadOptions && props.preload) {
        await loadInitialRemoteOptions();
    }

    // if we have a value, but we don't have options and we use a specific field for the value,
    // then the value is not something we can pass through the formatter.
    // thus, we have to wait to parse the value and render the value later.
    else if (!props.options && !props.loadOptions && (props.valueField || props.valueExtractor)) {
        // do nothing & let the placeholder formatter handle it
    } else {
        handleValueChanged();
    }

    watch(selectedOption, () => {
        const effectiveValue =
            isNotNullOrUndefined(selectedOption.value) && effectiveValueExtractor.value !== null
                ? effectiveValueExtractor.value(selectedOption.value)
                : selectedOption.value;
        if (!isEqual(props.modelValue, effectiveValue)) {
            emit('update:modelValue', effectiveValue);
        }
    });

    if (props.remoteSearch) {
        watch(searchText, debounce(reloadOptionsIfSearching, 250));
    }

    if (props.autofocus) {
        nextTick(() => {
            searchField.value?.focus();
        });
    }
});

onBeforeUnmount(() => {
    optionsContainer.value?.remove();
    updateFilteringSearchText.cancel();
});

async function loadInitialRemoteOptions() {
    await reloadOptions(true);
    handleValueChanged({ preserveSearchText: isSearching.value });
    if (remoteOptions.value) emit('optionsLoaded', remoteOptions.value);
}

async function reloadOptions(invokeValueChanged = false) {
    const effectiveSearchText = props.remoteSearch && isSearching.value && searchText.value.length ? searchText.value : null;
    isLoading.value = true;
    remoteOptions.value = (await props.loadOptions?.(effectiveSearchText)) ?? [];
    isLoading.value = false;
    if (invokeValueChanged) handleValueChanged({ preserveSearchText: isSearching.value });
    setHighlightedOptionKey();
}

function reloadOptionsIfSearching() {
    if (isSearching.value) {
        reloadOptions();
        isSearching.value = searchText.value.trim().length > 0;
    }
}

function handleKeyDown(e: KeyboardEvent) {
    if (e.key == 'Escape') {
        e.stopPropagation();
        (e.target as HTMLInputElement).blur();
        focusNextInput();
        return;
    }

    if (e.key == 'ArrowLeft' || e.key == 'ArrowRight') return;
    if (e.key == 'Tab') return;

    if (!isLoaded.value) {
        if (!isSearching.value) e.preventDefault();
        return;
    }

    if (e.key == 'ArrowUp' || e.key == 'ArrowDown') {
        e.preventDefault();
        return incrementHighlightedOption(e.key == 'ArrowUp' ? -1 : 1);
    }

    if (e.key == 'PageUp' || e.key == 'PageDown') {
        e.preventDefault();
        return incrementHighlightedOption(e.key == 'PageUp' ? -10 : 10);
    }

    if (e.key == 'Home' || e.key == 'End') {
        e.preventDefault();
        return incrementHighlightedOption(e.key == 'Home' ? -Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER);
    }

    if (e.key == 'Enter') {
        e.preventDefault();
        const highlightedOption = effectiveOptions.value.find(option => option.key == highlightedOptionKey.value);
        if (highlightedOption) return selectOption(highlightedOption);
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (searchText.value.length > 1) {
            isSearching.value = true;
        }
        return;
    }

    if (!e.metaKey && VALID_KEYS.includes(e.key)) {
        isSearching.value = true;
    }
}

function handlePaste() {
    isSearching.value = true;
}

function handleInputFocused() {
    setHighlightedOptionKey();
    shouldDisplayOptions.value = true;
    setTimeout(() => searchField.value?.select(), 0);
}

function setHighlightedOptionKey(useFirstItemAsFallback?: boolean) {
    if (selectedOption.value) {
        highlightedOptionKey.value = getOptionKey(selectedOption.value);
    } else if (useFirstItemAsFallback) {
        highlightedOptionKey.value = effectiveOptions.value?.[0]?.key ?? NullSymbol;
    } else if (props.nullTitle) {
        highlightedOptionKey.value = NullSymbol;
    }
}

function getOptionKey(option: T): string | symbol {
    if (effectiveKeyExtractor.value) {
        return effectiveKeyExtractor.value(option);
    }

    return getOptionDescriptor(option)?.key ?? '';
}

function getOptionDescriptor(option: T) {
    const matchedRef = effectiveOptions.value.find(o => o.ref === option);
    if (matchedRef) {
        return matchedRef;
    }

    // didn't find an object match, so we'll try a content match. a couple reasons:
    // 1) the initial selection may have come from an owning object and the object as a whole may differ from the full content list
    // 2) for reasons I've yet to determine, the prepend options, although they are wrapped by proxies and have identical content,
    //    are not the same proxy object as selectedOption once assigned -- even though the loaded data *is* the same. I've tried
    //    setting them as reactive using the same method (via data props rather than computed) and it didn't change anything.
    //    therefore, falling back to an isEqual check here when there's no equal object
    const matcher = props.keyExtractor ? (a: T, b: T) => props.keyExtractor!(a) === props.keyExtractor!(b) : isEqual;
    const matchedObj = effectiveOptions.value.find(o => matcher(o.ref!, option));
    if (matchedObj) {
        return matchedObj;
    }

    return null;
}

function handleInputBlurred() {
    if (props.debug) return;

    if (!searchText.value.length && props.nullTitle) {
        selectedOption.value = null;
        selectedOptionTitle.value = null;
    }

    shouldDisplayOptions.value = false;
}

function handleOptionsDisplayed() {
    if (!isLoaded.value) loadInitialRemoteOptions();
    if (props.optionsListId) optionsContainer.value?.setAttribute('id', props.optionsListId);
    teleportOptionsContainer();
}

function teleportOptionsContainer() {
    const optionsEl = optionsContainer.value!;
    const styles = window.getComputedStyle(el.value!);

    for (const key of COPIED_STYLES) {
        optionsEl.style.setProperty(key, styles.getPropertyValue(key));
    }

    // move it before measuring: shrink-to-fit resolves against the containing block, so the list
    // is a different shape inside the field than it is on the body, and placement depends on it
    document.body.appendChild(optionsEl);

    optionsDisplayAbove = null;
    positionOptionsContainer();

    optionsEl.style.visibility = 'visible';

    setTimeout(highlightInitialOption, 0);
}

/**
 * Anchors the teleported list to the field, opening it above instead of below when below would
 * squash it -- a field near the bottom of the viewport (a modal footer, say) otherwise gets a
 * sliver of a list clamped to whatever few pixels are left underneath it.
 *
 * Re-run on every update while open, so the list stays anchored as remote options arrive and as
 * searching filters them; when it opens upwards its height is what holds it against the field.
 */
function positionOptionsContainer() {
    const optionsEl = optionsContainer.value;
    if (!optionsEl || optionsEl.parentElement !== document.body) return;

    const elRect = el.value!.getBoundingClientRect();
    const authoredMaxHeight = window.getComputedStyle(el.value!).maxHeight;
    const hasAuthoredMaxHeight = !!authoredMaxHeight && authoredMaxHeight != 'none';

    optionsEl.style.minWidth = elRect.width + 'px';

    const spaceBelow = Math.max(0, window.innerHeight - elRect.bottom - OPTIONS_GAP - OPTIONS_VIEWPORT_MARGIN);
    const spaceAbove = Math.max(0, elRect.top - OPTIONS_GAP - OPTIONS_VIEWPORT_MARGIN);

    // scrollHeight is the content height whether or not a max-height clamp is already in effect,
    // so this measurement doesn't inherit the clamp we applied on a previous pass
    const naturalHeight = optionsEl.scrollHeight + (optionsEl.offsetHeight - optionsEl.clientHeight);

    // a max-height authored on the field has always won over the viewport clamp
    const applyMaxHeight = (side: boolean) => {
        if (!hasAuthoredMaxHeight) {
            optionsEl.style.maxHeight = Math.max(side ? spaceAbove : spaceBelow, OPTIONS_MIN_HEIGHT) + 'px';
        }
    };

    let displayAbove = resolveDisplayAbove(naturalHeight, spaceAbove, spaceBelow);
    applyMaxHeight(displayAbove);

    // the clamp has a floor, and an authored max-height skips it altogether, so the list can still
    // come out taller than the room above it. opening there anyway would bury the field under the
    // list -- the user couldn't see what they were typing, and a click where the field appears to
    // be would land on an option. below keeps the field visible and puts the overhang in the
    // direction the page can actually scroll.
    if (displayAbove && optionsEl.offsetHeight > spaceAbove) {
        displayAbove = false;
        applyMaxHeight(displayAbove);
    }

    commitDisplayAbove(displayAbove);

    // read back the height the clamp actually produced -- opening upwards is anchored on it
    const targetTop = displayAbove
        ? Math.max(OPTIONS_VIEWPORT_MARGIN, elRect.top - OPTIONS_GAP - optionsEl.offsetHeight)
        : elRect.bottom + OPTIONS_GAP;

    optionsEl.style.top = targetTop + window.scrollY + 'px';
    optionsEl.style.left = elRect.x + window.scrollX + 'px';
}

/**
 * Which side to open on. Held for the lifetime of the opening once the list has had real options
 * to measure: re-deciding it per update would fling the list back and forth across the field as
 * searching shrinks it past whatever fits below.
 *
 * The commitment only gives way if the side it chose has since stopped being usable at all.
 */
function resolveDisplayAbove(naturalHeight: number, spaceAbove: number, spaceBelow: number) {
    const committed = optionsDisplayAbove;
    if (committed !== null && (committed ? spaceAbove : spaceBelow) >= OPTIONS_MIN_HEIGHT) return committed;

    return naturalHeight > spaceBelow && spaceAbove > spaceBelow;
}

/**
 * Records the side to hold to -- but only once there are real options behind the measurement.
 * A "Loading..." box, or a list carrying nothing but a null-title/prepended row while the options
 * it belongs to are still on their way, would otherwise commit the list to the side that scrap of
 * content happened to fit -- which is how an async select ends up squashed below with the whole
 * viewport free above it, the very bug this placement pass exists to fix.
 */
function commitDisplayAbove(displayAbove: boolean) {
    if (loadedOptions.value.length) {
        optionsDisplayAbove = displayAbove;
    }
}

function highlightInitialOption() {
    if (!isLoaded.value) return;
    if (!highlightedOptionKey.value) return;
    const highlightedOptionIdx = effectiveOptions.value.findIndex(option => option.key == highlightedOptionKey.value);
    const containerEl = optionsContainer.value!;
    const highlightedOptionEl = containerEl?.querySelectorAll('.option')[highlightedOptionIdx] as HTMLElement;
    if (!highlightedOptionEl) return;
    containerEl.scrollTop = highlightedOptionEl.offsetTop;
}

function handleOptionHover(option: VfSmartSelectOptionDescriptor<T>) {
    highlightedOptionKey.value = option ? option.key : null;
}

function incrementHighlightedOption(increment: number) {
    const highlightedOptionIdx = effectiveOptions.value.findIndex(option => option.key == highlightedOptionKey.value);
    let targetOptionIdx = highlightedOptionIdx + increment;

    if (targetOptionIdx < 0) targetOptionIdx = 0;
    else if (targetOptionIdx >= effectiveOptions.value.length) targetOptionIdx = effectiveOptions.value.length - 1;

    if (highlightedOptionIdx == targetOptionIdx) return;

    highlightedOptionKey.value = effectiveOptions.value[targetOptionIdx]!.key;

    const containerEl = optionsContainer.value!;
    const targetOptionEl = containerEl?.querySelectorAll('.option')[targetOptionIdx] as HTMLElement;
    if (!targetOptionEl) return;

    if (targetOptionEl.offsetTop < containerEl.scrollTop) {
        containerEl.scrollTop = targetOptionEl.offsetTop;
    } else if (targetOptionEl.offsetTop + targetOptionEl.offsetHeight > containerEl.scrollTop + containerEl.clientHeight) {
        containerEl.scrollTop = targetOptionEl.offsetTop + targetOptionEl.offsetHeight - containerEl.clientHeight;
    }
}

function selectOption(option: VfSmartSelectOptionDescriptor<T>) {
    isSearching.value = false;

    if (option.key === NullSymbol) {
        searchText.value = '';
        selectedOption.value = null;
        selectedOptionTitle.value = null;
    } else if (option.key === CreateSymbol) {
        const createText = searchText.value.trim();
        searchText.value = '';
        selectedOption.value = null;
        selectedOptionTitle.value = null;
        props.onCreateItem?.(createText);
    } else {
        const selectedDecoratedOption = optionsDescriptors.value.find(decoratedOption => decoratedOption.key == option.key);
        const realOption = selectedDecoratedOption!.ref;
        selectedOption.value = realOption!;
        selectedOptionTitle.value = effectiveSelectionFormatter.value(realOption!);
        searchText.value = selectedOptionTitle.value ?? '';
    }

    searchField.value?.blur();
    focusNextInput();
}

/**
 * Syncs the selection to props.modelValue. The field text follows the selection too, unless the caller
 * says the user is mid-search -- then the text is theirs, and closing the list restores the title.
 */
function handleValueChanged({ preserveSearchText = false } = {}) {
    if (props.modelValue !== null) {
        // a miss stays null rather than becoming undefined: the selection watcher would read that as
        // a change and push undefined into the parent's v-model
        selectedOption.value = effectiveValueExtractor.value
            ? (allOptions.value.find(o => props.modelValue === effectiveValueExtractor.value!(o)) ?? null)
            : props.modelValue;
        selectedOptionTitle.value = isNotNullOrUndefined(selectedOption.value) ? effectiveSelectionFormatter.value(selectedOption.value) : null;
    } else {
        selectedOption.value = null;
        selectedOptionTitle.value = null;
    }

    if (!preserveSearchText) {
        searchText.value = selectedOptionTitle.value ?? '';
    }
}

function addRemoteOption(option: T) {
    remoteOptions.value!.unshift(option);
}

function focusNextInput() {
    if (!props.autoNext) return;

    let parent = el.value?.parentElement;
    while (parent && parent.tagName !== 'FORM' && parent.tagName !== 'BODY') {
        parent = parent.parentElement;
    }
    if (!parent) return;

    const allFocusableElements = parent.querySelectorAll('input, button, textarea, select, [tabindex]:not([tabindex="-1"])');
    if (!allFocusableElements) return;

    const currentInputIndex = Array.from(allFocusableElements).findIndex(el => el === searchField.value);
    const nextInput = allFocusableElements[currentInputIndex + 1] as HTMLElement;
    if (nextInput) setTimeout(() => nextInput.focus(), 0);
}

/**
 * Strips the marks an earlier pass left in an option row. This is the unwrap-and-normalize that
 * mark.js's own unmark() performs, minus the NodeIterator walk it drives it with -- that walk leans
 * on iterator quirks not every DOM implementation reproduces (happy-dom, which the unit tests run
 * in, silently finds nothing), and a plain query is all the job needs.
 */
function unmarkElement(el: HTMLElement) {
    el.querySelectorAll('mark[data-markjs]').forEach(mark => {
        const parent = mark.parentNode;
        if (!parent) return;
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
        parent.normalize();
    });
}

onUpdated(() => {
    if (!shouldDisplayOptions.value) return;

    // the list just changed size -- re-anchor it before anything reads its position
    positionOptionsContainer();

    const optionRows = () => optionsContainer.value?.querySelectorAll<HTMLElement>('.option:not(.create-option)') ?? [];

    if (!isSearching.value || !filteringSearchText.value) {
        // the search ended with the list still open (text cleared, say). the rows Vue kept are the
        // same nodes the last pass marked, and their vnodes haven't changed, so the marks stay put
        // until someone takes them off
        if (hasSearchMarks) {
            optionRows().forEach(unmarkElement);
            hasSearchMarks = false;
            positionOptionsContainer();
        }
        return;
    }

    const terms = filteringSearchText.value
        .trim()
        .replace(/[^a-z0-9 -]/gi, '')
        .split(' ');
    const optionEls = optionRows();
    optionEls.forEach(el => {
        unmarkElement(el);
        new Mark(el).mark(terms, {
            done: () => {
                // fix spaces around marks getting stripped
                el.innerHTML = el.innerHTML.replace(/ <mark /g, '&nbsp;<mark ').replace(/<\/mark> /g, '</mark>&nbsp;');
            }
        });
    });

    hasSearchMarks = optionEls.length > 0;

    // marking rewrites the option titles, and the non-breaking spaces it leaves behind can rewrap
    // one onto an extra line -- so the height everything above was anchored on is now out of date
    positionOptionsContainer();
});
</script>

<style lang="scss">
.vf-smart-select {
    position: relative;

    input {
        width: 100%;
        padding-right: 24px !important;

        &.nullable::placeholder {
            color: #000;
        }
    }

    &:after {
        content: ' ';
        display: block;
        position: absolute;
        top: 50%;
        right: 8px;
        margin-top: -3px;
        width: 0;
        height: 0;
        border-style: solid;
        border-width: 5px 5px 0 5px;
        border-color: #333333 transparent transparent transparent;
        pointer-events: none;
    }

    &.open:after {
        margin-top: -4px;
        border-width: 0 5px 5px 5px;
        border-color: transparent transparent #333333 transparent;
    }

    &:not(.disabled) {
        input {
            cursor: pointer;
        }
    }

    &.disabled:after {
        opacity: 0.4;
    }
}

.vf-smart-select-options {
    visibility: hidden;
    position: absolute;
    min-height: 20px;
    border: 1px solid #e8e8e8;
    background: white;
    overflow: auto;
    z-index: 101;

    .group-title {
        padding: 5px 8px;
        color: #999;
    }

    .option,
    .no-results {
        padding: 5px 8px;
    }

    .option {
        cursor: pointer;

        &.highlighted {
            background-color: #f5f5f5;
        }
    }
}
</style>
