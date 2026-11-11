# VfSmartSelect

Advanced searchable select component with filtering, keyboard navigation, grouping, and async data loading.

## Import

```typescript
import { VfSmartSelect } from '@zyno-io/vue-foundation';
```

## Basic Usage

```vue
<VfSmartSelect v-model="selectedUser" :options="users" :label-field="'name'" :value-field="'id'" placeholder="Select a user..." null-title="None" />
```

## Props

| Prop                      | Type                                       | Description                                          |
| ------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| `modelValue`              | `V \| null`                                | Selected value (v-model)                             |
| `options`                 | `T[]`                                      | Static options array                                 |
| `loadOptions`             | `(search: string \| null) => Promise<T[]>` | Async option loader                                  |
| `preload`                 | `boolean`                                  | Load options immediately on mount                    |
| `remoteSearch`            | `boolean`                                  | Reload options on each search (debounced 250ms)      |
| `keyField`                | `keyof T`                                  | Field used as unique key                             |
| `keyExtractor`            | `(option: T) => string \| symbol`          | Custom key extraction                                |
| `valueField`              | `keyof T`                                  | Field used as the emitted value                      |
| `valueExtractor`          | `(option: T) => V`                         | Custom value extraction                              |
| `labelField`              | `keyof T`                                  | Field displayed as option text                       |
| `formatter`               | `(option: T) => string`                    | Custom display formatter (rendered as text)          |
| `selectionFormatter`      | `(option: T) => string`                    | Custom formatter for the selected value in the input |
| `subtitleFormatter`       | `(option: T) => string`                    | Format subtitle text below option (rendered as text) |
| `classForOption`          | `(option: T) => string`                    | CSS class per option                                 |
| `groupField`              | `keyof T`                                  | Field to group options by                            |
| `groupFormatter`          | `(option: T) => string`                    | Custom group label formatter                         |
| `searchFields`            | `(keyof T)[]`                              | Fields to search (defaults to title + subtitle)      |
| `prependOptions`          | `T[]`                                      | Options prepended to the list                        |
| `appendOptions`           | `T[]`                                      | Options appended to the list                         |
| `onCreateItem`            | `(text: string) => void`                   | Enable "Create ..." option when no match             |
| `showCreateTextOnNewItem` | `boolean`                                  | Show "Create \<text\>..." label (default: `true`)    |
| `nullTitle`               | `string`                                   | Text for the null/deselect option                    |
| `noResultsText`           | `string`                                   | Text when search has no matches                      |
| `placeholder`             | `string`                                   | Input placeholder text                               |
| `loadingText`             | `string`                                   | Placeholder while loading                            |
| `disabled`                | `boolean`                                  | Disable the select                                   |
| `required`                | `boolean`                                  | HTML required attribute                              |
| `name`                    | `string`                                   | HTML name attribute                                  |
| `autoNext`                | `boolean`                                  | Focus next input after selection                     |
| `debug`                   | `boolean`                                  | Keep options open on blur (development aid)          |

## Events

| Event               | Description                                |
| ------------------- | ------------------------------------------ |
| `update:modelValue` | Emitted when the selected value changes    |
| `optionsLoaded`     | Emitted after async options finish loading |

## Slots

```vue
<VfSmartSelect v-model="value" :options="items">
    <!-- Custom option rendering -->
    <template #option="{ option }">
        <div class="custom-option">
            <img :src="option.ref.avatar" />
            <span>{{ option.title }}</span>
        </div>
    </template>

    <!-- Custom group header -->
    <template #group="{ group }">
        <strong>{{ group }}</strong>
    </template>

    <!-- Custom no-results message -->
    <template #no-results>
        No matches. Try a different search.
    </template>
</VfSmartSelect>
```

## Exposed Methods

```typescript
const selectRef = ref();
selectRef.value.addRemoteOption(newOption); // Add option to remote options list
```

## Features

- Search text highlighting via mark.js
- Keyboard navigation (Arrow keys, Page Up/Down, Home/End, Enter, Escape)
- Option list teleported to body for proper z-index stacking
- Opens below the field, flipping above it when below is too cramped (e.g. a field in a modal footer), and stays anchored as the list resizes
- Automatic scroll management for highlighted options

## Demos

### Basic (label-field + value-field)

<DemoContainer>
  <DemoVfSmartSelect />
  <template #source>

<<< @/demos/components/DemoVfSmartSelect.vue

  </template>
</DemoContainer>

### Grouped with null-title (deselect)

<DemoContainer>
  <DemoSmartSelectGrouped />
  <template #source>

<<< @/demos/components/DemoSmartSelectGrouped.vue

  </template>
</DemoContainer>

### Full object value (no value-field)

When `value-field` is omitted, the entire option object is emitted as the model value.

<DemoContainer>
  <DemoSmartSelectObject />
  <template #source>

<<< @/demos/components/DemoSmartSelectObject.vue

  </template>
</DemoContainer>

### Custom formatter + value-extractor

Use `formatter` and `value-extractor` functions instead of field names for full control.

<DemoContainer>
  <DemoSmartSelectFormatter />
  <template #source>

<<< @/demos/components/DemoSmartSelectFormatter.vue

  </template>
</DemoContainer>

### Preselected value

<DemoContainer>
  <DemoSmartSelectPreselected />
  <template #source>

<<< @/demos/components/DemoSmartSelectPreselected.vue

  </template>
</DemoContainer>

### Delayed options (loading state)

When `options` is initially undefined, the select shows
`loading-text` until options are provided.

<DemoContainer>
  <DemoSmartSelectDelayed />
  <template #source>

<<< @/demos/components/DemoSmartSelectDelayed.vue

  </template>
</DemoContainer>

### Async loadOptions

Use `load-options` for async data fetching. With `preload`,
options load on mount. Without it, they load on first open.

<DemoContainer>
  <DemoSmartSelectAsync />
  <template #source>

<<< @/demos/components/DemoSmartSelectAsync.vue

  </template>
</DemoContainer>

### Create item

Pass `on-create-item` to allow creating new options when no search match is found.

<DemoContainer>
  <DemoSmartSelectCreate />
  <template #source>

<<< @/demos/components/DemoSmartSelectCreate.vue

  </template>
</DemoContainer>

### Disabled

<DemoContainer>
  <DemoSmartSelectDisabled />
  <template #source>

<<< @/demos/components/DemoSmartSelectDisabled.vue

  </template>
</DemoContainer>

<script setup>
import DemoVfSmartSelect from '../demos/components/DemoVfSmartSelect.vue';
import DemoSmartSelectGrouped from '../demos/components/DemoSmartSelectGrouped.vue';
import DemoSmartSelectObject from '../demos/components/DemoSmartSelectObject.vue';
import DemoSmartSelectFormatter from '../demos/components/DemoSmartSelectFormatter.vue';
import DemoSmartSelectPreselected from '../demos/components/DemoSmartSelectPreselected.vue';
import DemoSmartSelectDelayed from '../demos/components/DemoSmartSelectDelayed.vue';
import DemoSmartSelectAsync from '../demos/components/DemoSmartSelectAsync.vue';
import DemoSmartSelectCreate from '../demos/components/DemoSmartSelectCreate.vue';
import DemoSmartSelectDisabled from '../demos/components/DemoSmartSelectDisabled.vue';
</script>
