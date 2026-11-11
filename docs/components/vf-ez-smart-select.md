# VfEzSmartSelect

Simplified wrapper around VfSmartSelect for string enum or key-value options.

## Import

```typescript
import { VfEzSmartSelect } from '@zyno-io/vue-foundation';
```

## Basic Usage

```vue
<!-- Array of strings -->
<VfEzSmartSelect v-model="status" :options="['active', 'inactive', 'pending']" null-title="All statuses" />

<!-- Key-value object -->
<VfEzSmartSelect v-model="role" :options="{ admin: 'Administrator', user: 'Regular User', guest: 'Guest' }" placeholder="Select role..." />
```

## Props

| Prop          | Type                                | Description                           |
| ------------- | ----------------------------------- | ------------------------------------- |
| `modelValue`  | `T \| null`                         | Selected value (v-model)              |
| `options`     | `{ [key in T]: string } \| T[]`     | Options as object map or string array |
| `nullTitle`   | `string`                            | Text for deselect option              |
| `placeholder` | `string`                            | Input placeholder                     |
| `formatter`   | `(label: string, key: T) => string` | Custom label formatter                |
| `name`        | `string`                            | HTML name attribute                   |

## Slots

Labels are rendered as text. For rich option content, use the `option` slot; it is forwarded to the inner `VfSmartSelect`. `option.title` is the formatted label and `option.ref` is `{ value, label }` for that entry. `no-results` is forwarded too.

```vue
<VfEzSmartSelect v-model="status" :options="{ active: 'Active', paused: 'Paused' }">
    <template #option="{ option }">
        <span :class="`dot dot--${option.ref.value}`" />
        {{ option.title }}
    </template>
</VfEzSmartSelect>
```

## Demo

<DemoContainer>
  <DemoVfEzSmartSelect />
  <template #source>

<<< @/demos/components/DemoVfEzSmartSelect.vue

  </template>
</DemoContainer>

<script setup>
import DemoVfEzSmartSelect from '../demos/components/DemoVfEzSmartSelect.vue';
</script>
