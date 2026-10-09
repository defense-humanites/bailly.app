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
  The citation in a window, opened by an icon at an entry card's top, beside
  the bookmarks' toolbar (framed alike, but apart: it isn't about
  bookmarks), hovered as it (`bg-elevated`, cf. `TagButtonGroup`); on the
  entry page, at every width (the column on the right,
  from `xl`, is the outline's), and on the home page's random entry.
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
      class="rounded-lg border border-default shadow-xs hover:bg-elevated active:bg-elevated data-[state=open]:bg-elevated"
    />
    <template #body>
      <EntryCitation
        :entry="entry"
        :version="version"
      />
    </template>
  </UModal>
</template>
