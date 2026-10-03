<script setup lang="ts">
  import type { CommandPaletteGroup, CommandPaletteItem, PopoverProps } from "@nuxt/ui";
  import type { IdbEntry, IdbTag, TagKey } from "~/idb";

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
   * in their order: the entry can be added to (or removed from) them in
   * the popover, where the names show in full.
   */
  const panelTags = computed(() => [
    ...tags.value.filter(tag => tag.key === currentTag.value?.key),
    ...tags.value.filter(tag => tag.key !== currentTag.value?.key),
  ]);

  const entryTagKeys = computed(() => new Set(bookmarksStore.tagKeysOf(props.entry.uri)));

  /**
   * From this number of tags, a field filters them in the panel (below, they
   * all show at once: about seven rows fit before it scrolls).
   */
  const FILTER_FROM = 8;
  const filterable = computed((): boolean => tags.value.length >= FILTER_FROM);
  /**
   * The filter field: without the search bar's shape (a pill with a shadow,
   * set for every `UInput` in app.config.ts).
   */
  const filterInput = { ui: { base: "rounded-none shadow-none" } };

  type TagItem = CommandPaletteItem & { key: TagKey; color: IdbTag["color"] };

  const tagItems = computed((): TagItem[] => panelTags.value.map(tag => ({ key: tag.key, label: tag.name, color: tag.color })));
  const tagGroups = computed((): CommandPaletteGroup[] => [{ id: "tags", items: tagItems.value }]);

  /**
   * The options selected: the tags the entry has (compared by key, `by`).
   */
  const selectedItems = computed((): TagItem[] => tagItems.value.filter(item => entryTagKeys.value.has(item.key)));

  /**
   * The panel's selection changed (a single option at a time): adds the entry
   * to the tag selected, or removes it from the tag unselected.
   * @remarks With `multiple`, the value is the list of the options selected
   * (Nuxt UI types it as a single one).
   */
  const onTagsChange = async (value: unknown): Promise<void> => {
    const selected = new Set((value as TagItem[]).map(item => item.key));
    for (const key of selected) if (!entryTagKeys.value.has(key)) await setTagged(key, true);
    for (const key of entryTagKeys.value) if (!selected.has(key)) await setTagged(key, false);
  };

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
    class="border border-default rounded-lg bg-default [&>button]:rounded-lg shadow-xs"
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

          <!--
            A list box of several choices (`UCommandPalette`, `multiple`):
            an option per tag, selected when the entry has it (its icon then
            filled, in the tag's color); a click, Enter or Space toggles it,
            without changing the current tag nor the order. From
            `FILTER_FROM` tags, a field filters them (ignoring case and
            accents), the arrows moving in the list. The list box has no name
            of its own (Reka's `ListboxContent` takes no attributes): the
            dialog is named, and the heading above it names the list.
          -->
          <UCommandPalette
            v-if="panelTags.length"
            :model-value="selectedItems"
            :groups="tagGroups"
            multiple
            by="key"
            highlight-on-hover
            :input="filterable && filterInput"
            placeholder="Filtrer les étiquettes"
            :autofocus="filterable"
            :fuse="{ resultLimit: 50, fuseOptions: { ignoreDiacritics: true } }"
            :ui="{
              input: '[&_input]:text-sm',
              viewport: 'max-h-72 p-0',
              item: 'rounded-md px-2 py-1.5 before:rounded-md data-highlighted:not-data-disabled:before:bg-elevated/50',
              itemTrailingIcon: 'hidden',
              empty: 'px-2 py-1.5 text-start text-sm',
            }"
            @update:model-value="onTagsChange"
          >
            <template #item-leading="{ item }">
              <UIcon
                :name="entryTagKeys.has(item.key) ? 'i-bailly-tag-filled' : 'i-lucide-tag'"
                :data-tag-color="item.color"
                class="size-5 shrink-0 text-tag-text"
              />
            </template>
            <template #item-trailing="{ item }">
              <!--
                In the tag's colors (lightest tint, its text color): it stays
                distinct from the row's hover background.
              -->
              <UBadge
                v-if="item.key === currentTag?.key"
                label="active"
                color="neutral"
                variant="soft"
                size="sm"
                :data-tag-color="item.color"
                class="bg-tag-100 text-tag-text ring ring-inset ring-tag-300/60"
              />
            </template>
            <template #empty>
              Aucune étiquette ne correspond.
            </template>
          </UCommandPalette>
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
