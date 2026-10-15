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
  framed and hovered as the bookmarks' buttons (`bg-elevated`, cf.
  `TagButtonGroup`); on the entry page, a homonym's card citing that
  homonym, and on the home page's random entry.
-->
<template>
  <UModal
    title="Citer cette entrée"
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <UButton
      icon="i-lucide-quote"
      aria-label="Citer cette entrée"
      color="neutral"
      variant="ghost"
      data-toolbar-group
      class="rounded-lg border border-default bg-default shadow-xs hover:bg-elevated active:bg-elevated data-[state=open]:bg-elevated"
    />
    <template #body>
      <EntryCitation
        :entry="entry"
        :version="version"
      />
    </template>
  </UModal>
</template>
