<script setup lang="ts">
  import type { PopoverProps } from "@nuxt/ui";
  import type { IdbEntry, TagKey } from "~/idb";

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
  /**
   * The panel (a dialog) is named after its trigger by Reka
   * (`aria-labelledby`); the `aria-label` is a fallback, for the trigger's
   * id may differ between the server and the client (then the reference is
   * broken, and the dialog would have no name).
   */
  const popoverContent = { "align": "start", "collisionPadding": 12, "aria-label": "Autres étiquettes" } as PopoverProps["content"];

  const otherTags = computed(() => tags.value.filter(tag => tag.key !== currentTag.value?.key));

  const entryTagKeys = computed(() => new Set(bookmarksStore.tagKeysOf(props.entry.uri)));

  const setTagged = async (tagKey: TagKey, tagged: boolean): Promise<void> => {
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
    class="border border-default rounded-lg [&>button]:rounded-lg shadow-xs"
  >
    <!--
      The other tags: a toggle button for each, whose icon, in the tag's
      color, is filled when the entry has the tag (as the current tag's
      button), and a link to the bookmarks page, where the tags are managed
      (with the bookmarks' icon, as in the header menu). The items of a panel
      have moderately rounded corners (`rounded-md`), as the history's and the
      menus' items, rather than the buttons' pill shape.
    -->
    <UPopover :content="popoverContent">
      <UButton
        icon="i-lucide-tags"
        color="neutral"
        variant="ghost"
        class="data-[state=open]:bg-elevated"
        aria-label="Autres étiquettes"
      />

      <template #content>
        <div class="w-64 max-w-[calc(var(--app-width)-2rem)] p-1">
          <h2
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
              <UButton
                :label="tag.name"
                :icon="entryTagKeys.has(tag.key) ? 'i-bailly-tag-filled' : 'i-lucide-tag'"
                :aria-pressed="entryTagKeys.has(tag.key)"
                :data-tag-color="tag.color"
                color="neutral"
                variant="ghost"
                class="w-full rounded-md hover:bg-elevated/50"
                :ui="{ leadingIcon: 'text-tag-text' }"
                @click="setTagged(tag.key, !entryTagKeys.has(tag.key))"
              />
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
              icon="i-lucide-bookmark"
              color="neutral"
              variant="ghost"
              size="sm"
              class="w-full rounded-md"
            />
          </footer>
        </div>
      </template>
    </UPopover>

    <!-- Toggle current tag -->
    <UButton
      v-if="currentTag"
      :label="currentTag.name"
      :icon="taggedAsCurrent ? 'i-bailly-tag-filled' : 'i-lucide-tag'"
      :data-tag-color="currentTag.color"
      :class="taggedAsCurrent ? 'text-tag-text' : 'hover:text-tag-text'"
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
      :class="starred ? 'text-favorite' : 'hover:text-favorite'"
      :ui="{ base: 'border-l border-default' }"
      @click="toggleStar"
    />
  </UFieldGroup>
</template>
