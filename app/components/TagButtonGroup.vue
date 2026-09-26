<script setup lang="ts">
  import type { IdbEntry } from "~/idb";

  const bookmarksStore = useBookmarksStore();
  const { currentTag, tags } = storeToRefs(bookmarksStore);

  const props = defineProps<{
    /**
     * The entry on which to perform actions.
     */
    entry: IdbEntry;
  }>();

  /**
   * A boolean representing whether the current entry has been starred.
   * @remarks Derived from the store, so that it stays correct once the store
   * is initialized and when the entry is (un)starred elsewhere.
   */
  const starred = computed((): boolean => bookmarksStore.isStarred(props.entry.uri));
  /**
   * A boolean representing whether the current entry belongs to the current tag.
   */
  const taggedAsCurrent = computed((): boolean =>
    currentTag.value !== null
    && bookmarksStore.tagKeysOf(props.entry.uri).includes(currentTag.value.key),
  );

  /**
   * The tags other than the current one, in the user's order: the entry can
   * be added to (or removed from) them in a popover.
   */
  const otherTags = computed(() => tags.value.filter(tag => tag.key !== currentTag.value?.key));

  const entryTagKeys = computed(() => new Set(bookmarksStore.tagKeysOf(props.entry.uri)));

  const setTagged = async (tagKey: number, tagged: boolean): Promise<void> => {
    if (tagged) {
      await bookmarksStore.tagEntry(props.entry, tagKey);
    } else {
      await bookmarksStore.untagEntry(props.entry.uri, tagKey);
    }
  };

  const handleTagChange = async (): Promise<void> => {
    const currentTagKey = currentTag.value?.key;
    if (currentTagKey === undefined) return;

    if (taggedAsCurrent.value) {
      await bookmarksStore.untagEntry(props.entry.uri, currentTagKey);
    } else {
      await bookmarksStore.tagEntry(props.entry, currentTagKey);
    }
  };

  const toggleStar = async (): Promise<void> => {
    if (starred.value) {
      await bookmarksStore.unstarEntry(props.entry.uri);
    } else {
      await bookmarksStore.starEntry(props.entry);
    }
  };
</script>

<template>
  <UFieldGroup
    orientation="horizontal"
    class="border border-neutral-200 rounded-lg [&>button]:rounded-lg shadow-xs [&>button]:shadow-none"
  >
    <!--
      The other tags: a checkbox for each, with the tag's icon in its color,
      and a link to the bookmarks page, where the tags are managed.
    -->
    <UPopover :content="{ align: 'start', collisionPadding: 12 }">
      <UButton
        icon="i-lucide-circle-ellipsis"
        color="neutral"
        variant="ghost"
        class="data-[state=open]:bg-elevated"
        aria-label="Autres étiquettes"
      />

      <template #content>
        <section
          class="w-64 max-w-[calc(var(--app-width)-2rem)] p-1"
          aria-labelledby="other-tags-title"
        >
          <h2
            id="other-tags-title"
            class="px-2 pt-1.5 pb-1 text-xs uppercase tracking-wide text-muted"
          >
            Autres étiquettes
          </h2>

          <ul
            v-if="otherTags.length"
            class="max-h-72 overflow-y-auto"
          >
            <li
              v-for="tag in otherTags"
              :key="tag.key"
            >
              <UCheckbox
                :model-value="entryTagKeys.has(tag.key)"
                color="neutral"
                class="rounded-md px-2 py-1.5 hover:bg-elevated/50"
                :ui="{ container: 'h-6', wrapper: 'min-w-0', label: 'flex items-center gap-2 font-normal' }"
                @update:model-value="setTagged(tag.key, $event === true)"
              >
                <template #label>
                  <UIcon
                    name="i-bailly-tag-filled"
                    class="size-4 shrink-0 text-tag-600"
                    :data-tag-color="tag.color"
                  />
                  <span class="truncate">{{ tag.name }}</span>
                </template>
              </UCheckbox>
            </li>
          </ul>
          <p
            v-else
            class="px-2 py-1.5 text-sm text-muted"
          >
            {{ tags.length ? "Aucune autre étiquette." : "Aucune étiquette pour l'instant." }}
          </p>

          <footer class="mt-1 border-t border-default px-1 pt-1">
            <UButton
              to="/signets"
              label="Gérer les étiquettes"
              icon="i-lucide-tags"
              color="neutral"
              variant="ghost"
              size="sm"
              class="w-full"
            />
          </footer>
        </section>
      </template>
    </UPopover>

    <!-- Toggle current tag -->
    <UButton
      v-if="currentTag"
      :label="currentTag.name"
      :icon="taggedAsCurrent ? 'i-bailly-tag-filled' : 'i-lucide-tag'"
      :data-tag-color="currentTag.color"
      :class="taggedAsCurrent ? 'text-tag-600' : 'hover:text-tag-700'"
      :ui="{
        label:
          'max-w-8 overflow-hidden whitespace-nowrap mask-r-from-50% mask-r-to-100% text-clip text-xs tracking-tighter',
      }"
      color="neutral"
      variant="ghost"
      @click="handleTagChange"
    />

    <!-- Toggle star -->
    <UButton
      :icon="starred ? 'i-bailly-star-filled' : 'i-lucide-star'"
      color="neutral"
      variant="ghost"
      :class="starred ? 'text-primary-400' : 'hover:text-primary-400'"
      :ui="{ base: 'border-l border-neutral-200' }"
      @click="toggleStar"
    />
  </UFieldGroup>
</template>
