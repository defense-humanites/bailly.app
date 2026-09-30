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
   * The panel (a dialog) is named after its trigger by Reka
   * (`aria-labelledby`); the `aria-label` is a fallback, for the trigger's
   * id may differ between the server and the client (then the reference is
   * broken, and the dialog would have no name).
   */
  const popoverContent = { "align": "end", "collisionPadding": 12, "aria-label": "Toutes les étiquettes" } as PopoverProps["content"];

  /**
   * All the tags, the current one first (marked « active »), then the others
   * in the user's order: the entry can be added to (or removed from) them in
   * the popover, where the names show in full.
   */
  const panelTags = computed(() => [
    ...tags.value.filter(tag => tag.key === currentTag.value?.key),
    ...tags.value.filter(tag => tag.key !== currentTag.value?.key),
  ]);

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
      The current tag, in one click (the most frequent action while reading):
      the beginning of its name (more of it from `sm`), in full in the
      tooltip, which says what a click does, and in the panel. Toggle buttons:
      a constant name, the state in `aria-pressed`.
    -->
    <UTooltip
      v-if="currentTag"
      :text="taggedAsCurrent ? `Retirer de « ${currentTag.name} »` : `Ajouter à « ${currentTag.name} »`"
    >
      <UButton
        :label="currentTag.name"
        :aria-label="`Étiquette active : ${currentTag.name}`"
        :aria-pressed="taggedAsCurrent"
        :icon="taggedAsCurrent ? 'i-bailly-tag-filled' : 'i-lucide-tag'"
        :data-tag-color="currentTag.color"
        :class="taggedAsCurrent ? 'text-tag-text' : 'hover:text-tag-text'"
        :ui="{ label: 'max-w-12 truncate text-xs tracking-tight sm:max-w-24' }"
        color="neutral"
        variant="ghost"
        @click="handleTagChange"
      />
    </UTooltip>

    <!--
      After the current tag, as a split button (its action, then the choice
      among all the tags): the two icon buttons stay in place at the
      toolbar's end, whatever the length of the current tag's name; the panel
      is aligned on its button's end. It lists all the tags, the current one
      first: a toggle button for each, whose icon, in the tag's color, is
      filled when the entry has the tag, and a link to the bookmarks page,
      where the tags are managed (with the bookmarks' icon, as in the header
      menu). The items of a panel have moderately rounded corners
      (`rounded-md`), as the history's and the menus' items, rather than the
      buttons' pill shape.
    -->
    <UPopover :content="popoverContent">
      <UButton
        icon="i-lucide-tags"
        color="neutral"
        variant="ghost"
        class="data-[state=open]:bg-elevated"
        aria-label="Toutes les étiquettes"
      />

      <template #content>
        <div class="w-64 max-w-[calc(var(--app-width)-2rem)] p-1">
          <h2
            class="px-2 pt-1.5 pb-1 text-xs uppercase tracking-wide text-muted"
          >
            Étiquettes
          </h2>

          <ul
            v-if="panelTags.length"
            class="max-h-72 overflow-y-auto"
          >
            <li
              v-for="tag in panelTags"
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
                :ui="{ leadingIcon: 'text-tag-text', label: 'grow text-start' }"
                @click="setTagged(tag.key, !entryTagKeys.has(tag.key))"
              >
                <template
                  v-if="tag.key === currentTag?.key"
                  #trailing
                >
                  <!--
                    In the tag's colors (lightest tint, its text color): it
                    stays distinct from the row's hover background.
                  -->
                  <UBadge
                    label="active"
                    color="neutral"
                    variant="soft"
                    size="sm"
                    class="bg-tag-100 text-tag-text ring ring-inset ring-tag-300/60"
                  />
                </template>
              </UButton>
            </li>
          </ul>
          <p
            v-else
            class="px-2 py-1.5 text-sm text-muted"
          >
            Aucune étiquette pour l'instant.
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

    <!-- Toggle star -->
    <UTooltip :text="starred ? 'Retirer des favoris' : 'Ajouter aux favoris'">
      <UButton
        :icon="starred ? 'i-bailly-star-filled' : 'i-lucide-star'"
        aria-label="Favori"
        :aria-pressed="starred"
        color="neutral"
        variant="ghost"
        :class="starred ? 'text-favorite' : 'hover:text-favorite'"
        :ui="{ base: 'border-l border-default' }"
        @click="toggleStar"
      />
    </UTooltip>
  </UFieldGroup>
</template>
