<script setup lang="ts">
  const props = defineProps<{
    /** The entry's URI. */
    uri: string;
  }>();

  const bookmarksStore = useBookmarksStore();
  const { tags, currentTagKey } = storeToRefs(bookmarksStore);

  /**
   * The entry's tags, in their order.
   */
  const entryTags = computed(() => {
    const keys = new Set(bookmarksStore.tagKeysOf(props.uri));
    return tags.value.filter(tag => keys.has(tag.key));
  });

  /**
   * The tag shown: the current one if the entry has it, otherwise the first
   * one in their order.
   */
  const shownTag = computed(() =>
    entryTags.value.find(tag => tag.key === currentTagKey.value) ?? entryTags.value[0],
  );

  const starred = computed((): boolean => bookmarksStore.isStarred(props.uri));

  const others = computed((): number => entryTags.value.length - 1);

  const names = computed((): string => entryTags.value.map(tag => tag.name).join(", "));
</script>

<!--
  Whether an entry is a favorite (a star), then its tags, in a line of
  results: the icon of one tag, in its color, and a chip with the number of
  the others (e.g. "+2"). All the tags' names are read by screen readers,
  and shown on hover.
-->
<template>
  <span
    v-if="starred || shownTag"
    class="inline-flex shrink-0 items-center gap-1.5"
  >
    <template v-if="starred">
      <UIcon
        name="i-bailly-star-filled"
        class="size-4 text-favorite"
      />
      <span class="sr-only">(favori)</span>
    </template>
    <span
      v-if="shownTag"
      class="inline-flex"
      :title="names"
    >
      <!-- Read by screen readers as the list of the names instead. -->
      <span
        aria-hidden="true"
        class="inline-flex"
      >
        <UChip
          :show="others > 0"
          :text="`+${others}`"
          color="neutral"
          :ui="{ base: 'h-3.5 min-w-3.5 px-0.5 text-[10px] leading-none' }"
        >
          <UIcon
            name="i-bailly-tag-filled"
            class="size-4 text-tag-text"
            :data-tag-color="shownTag.color"
          />
        </UChip>
      </span>
      <span class="sr-only">(étiquettes : {{ names }})</span>
    </span>
  </span>
</template>
