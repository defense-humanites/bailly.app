<script setup lang="ts">
  import type { SearchResultItem } from "~/utils/searchResults";

  defineProps<{
    /** The result. */
    item: SearchResultItem;
    /** Whether it is highlighted (and shown so). */
    highlighted: boolean;
  }>();

  const greek = useGreek();
</script>

<!--
  A result of the search bar (cf. `SearchResults`): its excerpt, its
  headword first, in bold (a homonym's number after it, as in its
  definition), on two lines at most; its tags, and whether the
  morphological analysis found it. Nuxt UI's input menu's classes; a
  homonym indented under its headword. Rendered again only when the result
  or its highlight change.
-->
<template>
  <div
    role="option"
    :aria-selected="highlighted"
    :data-highlighted="highlighted || undefined"
    :data-index="item.index"
    class="group relative flex w-full items-start gap-2 p-2 text-sm text-default transition-colors outline-none select-none before:absolute before:inset-px before:z-[-1] before:rounded-md before:transition-colors data-highlighted:text-highlighted data-highlighted:before:bg-(--app-highlight)"
    :class="{ 'ps-5': item.nested }"
  >
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="line-clamp-2 whitespace-normal">
        <span
          class="font-serif text-sm/6"
          :data-nested="item.nested || undefined"
        ><span class="font-semibold">{{ greek.text(item.word) }}<sup
          v-if="item.homonym"
          class="ms-px"
        >{{ item.homonym }}</sup></span>{{ greek.text(item.rest) }}</span>
      </span>
    </span>
    <span class="ms-auto inline-flex items-center gap-2">
      <EntryBookmarkIndicator :uri="item.uri" />
      <UIcon
        v-if="item.isMorpheus"
        name="i-lucide-sparkles"
        class="size-4 shrink-0 text-primary"
        aria-label="Trouvé par l'analyse morphologique"
      />
    </span>
  </div>
</template>
