<script setup lang="ts">
  import type { CitedEntry } from "~/utils/citation";

  defineProps<{
    /** The entry cited (a homonym: the one read). */
    entry: CitedEntry;
    /** The data's version (the API's). */
    version?: string;
  }>();
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
    <UModal
      title="Citer cette entrée"
      :ui="{ content: 'sm:max-w-lg' }"
    >
      <UButton
        icon="i-lucide-quote"
        aria-label="Citer cette entrée"
        color="neutral"
        variant="ghost"
        class="rounded-md hover:bg-(--app-button-hover) active:bg-(--app-button-active) data-[state=open]:bg-(--app-button-active)"
      />
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
