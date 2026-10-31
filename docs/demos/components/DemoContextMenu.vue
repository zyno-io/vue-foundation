<template>
    <div>
        <div
            style="
                border: 1px dashed var(--vp-c-divider);
                border-radius: 8px;
                padding: 40px;
                text-align: center;
                max-width: 400px;
                user-select: none;
                cursor: context-menu;
            "
            @contextmenu="onContextMenu"
        >
            Right-click here to open the context menu
        </div>
        <p v-if="lastAction" style="margin-top: 12px; color: var(--vp-c-text-2)">Last action: {{ lastAction }}</p>
    </div>
</template>

<script lang="ts" setup>
import { showContextMenu } from '@zyno-io/vue-foundation';
import { ref } from 'vue';

const lastAction = ref('');

function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    showContextMenu(e, {
        items: [
            { title: 'This message', heading: true },
            { title: 'Reply', handler: () => (lastAction.value = 'Reply clicked') },
            { title: 'Forward', handler: () => (lastAction.value = 'Forward clicked') },
            {
                title: 'Move to',
                items: [
                    { title: 'Inbox', handler: () => (lastAction.value = 'Moved to Inbox') },
                    { title: 'Archive', handler: () => (lastAction.value = 'Moved to Archive') },
                    {
                        title: 'More…',
                        items: [
                            { title: 'Spam', handler: () => (lastAction.value = 'Moved to Spam') },
                            { title: 'Trash', handler: () => (lastAction.value = 'Moved to Trash') }
                        ]
                    }
                ]
            },
            {
                title: 'Delete message',
                handler: () => (lastAction.value = 'Message delete confirmed'),
                class: 'danger',
                shouldConfirm: true
            },
            '-',
            { title: 'Whole conversation', heading: true },
            { title: 'Mark all as read', handler: () => (lastAction.value = 'Conversation marked read') },
            { title: 'Mute', handler: () => (lastAction.value = 'Conversation muted') },
            {
                title: 'Delete conversation',
                handler: () => (lastAction.value = 'Conversation delete confirmed'),
                class: 'danger',
                shouldConfirm: true
            }
        ]
    });
}
</script>
