<script setup lang="ts">
  import type { CitedEntry } from "~/utils/citation";

  defineProps<{
    /** The entry cited (a homonym: the one read). */
    entry: CitedEntry;
    /** The data's version (the API's). */
    version?: string;
  }>();

  /**
   * The window is mounted on its first opening only, not with the page:
   * hydrated with every card, its components weighed on the hydration's task
   * (cf. `audit-inp.md`). Without Reka's trigger, the focus goes back to the
   * button on closing.
   */
  const open = shallowRef(false);
  const mounted = shallowRef(false);
  const button = useTemplateRef("button");
  const show = (): void => {
    mounted.value = true;
    open.value = true;
  };
  const focusButton = (event: Event): void => {
    event.preventDefault();
    (button.value?.$el as HTMLElement | undefined)?.focus();
  };
</script>

<!--
  The citation in a window, opened by an icon at the end of an entry card's
  toolbar (the entry's tools, apart from the bookmarks' at its start),
  framed and hovered as the bookmarks' buttons, the frame around the button
  as theirs around them (cf. `TagButtonGroup`); on the entry page, a homonym's card citing that
  homonym, and on the home page's random entry.
-->
<template>
  <div
    data-toolbar-group
    class="rounded-lg border border-default bg-default shadow-xs"
  >
    <UButton
      ref="button"
      icon="i-lucide-quote"
      aria-label="Citer cette entrée"
      aria-haspopup="dialog"
      :aria-expanded="open"
      color="neutral"
      variant="ghost"
      class="rounded-md hover:bg-(--app-button-hover) active:bg-(--app-button-active) aria-expanded:bg-(--app-button-active)"
      @click="show"
    />
    <UModal
      v-if="mounted"
      v-model:open="open"
      title="Citer cette entrée"
      :content="{ onCloseAutoFocus: focusButton }"
      :ui="{ content: 'sm:max-w-lg lg:max-w-5xl' }"
    >
      <!-- The title after the button's icon. -->
      <template #title>
        <span class="flex items-center gap-2">
          <UIcon
            name="i-lucide-quote"
            class="size-5 shrink-0 text-muted"
          />
          Citer cette entrée
        </span>
      </template>
      <template #body>
        <EntryCitation
          :entry="entry"
          :version="version"
        />
      </template>
    </UModal>
  </div>
</template>
