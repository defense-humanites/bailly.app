<script setup lang="ts">
  import type { CommandPaletteGroup, CommandPaletteItem, PopoverProps } from "@nuxt/ui";
  import type { IdbEntry, IdbTag, TagKey } from "~/idb";
  import { LazyUCommandPalette } from "#components";

  /*
   * The toolbar's buttons: a shade darker when hovered, two when pressed
   * or open, as every button (`--app-button-hover`, `--app-button-active`,
   * cf. `root.css`); the tags' panel raised above
   * the interface (`--app-panel-bg`), as the search's panels.
   * Kept in step with `TagButtonGroupStatic` and `EntryCitationButton`.
   */
  const TOOLBAR_HOVER = "hover:bg-(--app-button-hover) active:bg-(--app-button-active)";

  const bookmarksStore = useBookmarksStore();
  const { currentTag, initialized, tags } = storeToRefs(bookmarksStore);

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
   * Whether the current tag's button fades in: when it comes in after the
   * toolbar's first render (on a full load, the bookmarks are read once the
   * page is interactive), rather than appearing at once; not when it is
   * already there (a page opened in the app). Not with reduced motion.
   */
  const fadeCurrentTag = ref(false);
  onMounted(() => {
    if (currentTag.value) return;
    const stop = watch(currentTag, (tag) => {
      if (!tag) return;
      fadeCurrentTag.value = true;
      stop();
    });
  });

  /**
   * Whether the buttons' colors may change with a transition: not until the
   * bookmarks are loaded and drawn (two frames later), or a starred entry's
   * star, at first the text's color, turned yellow under the eyes on a full
   * load (and the current tag's button its tag's color). Their colors change
   * with a transition when the user acts.
   */
  const settled = ref(false);
  onMounted(() => {
    const settle = (): void => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        settled.value = true;
      }));
    };
    if (initialized.value) {
      settled.value = true;
      return;
    }
    const stop = watch(initialized, (ready) => {
      if (!ready) return;
      stop();
      settle();
    });
  });

  /**
   * The panel (a dialog) is named after its trigger by Reka
   * (`aria-labelledby`); the `aria-label` is a fallback, for the trigger's
   * id may differ between the server and the client (then the reference is
   * broken, and the dialog would have no name).
   *
   * Kept within the pages' scroller (cf. `PageScroller`), under the header,
   * and below an entry's compact bar (2.5 rem, cf. `EntryCompactBar`): its
   * boundary, rather than the window's (the panel is in the body). Hidden
   * once its trigger has scrolled away under them (`hideWhenDetached`),
   * rather than staying over the header.
   */
  const pageScroller = usePageScroller();
  const COMPACT_BAR_HEIGHT = 40;
  const COLLISION_PADDING = 12;
  const popoverContent = computed(() => ({
    "align": "end",
    "collisionBoundary": pageScroller.value,
    "collisionPadding": { top: COMPACT_BAR_HEIGHT + COLLISION_PADDING, right: COLLISION_PADDING, bottom: COLLISION_PADDING, left: COLLISION_PADDING },
    "hideWhenDetached": true,
    "aria-label": "Toutes les étiquettes",
  }) as PopoverProps["content"]);

  /**
   * All the tags, the current one first (marked « active »), then the others
   * in the bookmarks page's order (the pinned ones first, then as the user
   * chose to sort them, cf. `sortTags`): the entry can be added to (or
   * removed from) them in the popover, where the names show in full. The
   * order is kept while the panel is open: adding the entry to a tag would
   * otherwise move it (sorted by the latest addition, or by number of
   * entries) from under the pointer.
   */
  const tagSort = useTagSort();
  const orderedTags = computed(() => {
    const sorted = sortTags(tags.value, tagSort.value, bookmarksStore.entriesOf);
    return [
      ...sorted.filter(tag => tag.key === currentTag.value?.key),
      ...sorted.filter(tag => tag.key !== currentTag.value?.key),
    ];
  });
  const panelOpen = ref(false);
  const frozenOrder = shallowRef<TagKey[] | null>(null);
  watch(panelOpen, (open) => {
    frozenOrder.value = open ? orderedTags.value.map(tag => tag.key) : null;
  });
  const panelTags = computed(() => {
    const order = frozenOrder.value;
    if (!order) return orderedTags.value;
    const rank = new Map(order.map((key, i) => [key, i]));
    // A tag created meanwhile (in another tab) comes last.
    return [...tags.value].sort((a, b) => (rank.get(a.key) ?? order.length) - (rank.get(b.key) ?? order.length));
  });

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

  /**
   * The filter's options, defined once: an object written in the template is
   * a new one at each render (unless the compiler hoists it, as in the
   * build), and the palette, its search redone, highlighted its first option
   * (the current tag) after each change, away from the one under the pointer.
   */
  const fuseOptions = { resultLimit: 50, fuseOptions: { ignoreDiacritics: true } };

  /*
   * The panel's list (`UCommandPalette`, with Fuse.js) in a file of its own
   * (`LazyUCommandPalette`): not among the scripts every page loads at first
   * (about 10 KB compressed). Fetched once the page is ready, idle, so that
   * the panel opens with it at once (its focus as before): by the async
   * component's own loader (`prefetchComponents` only reaches the global
   * components, which Nuxt UI's are not: it did nothing).
   */
  onNuxtReady(() => {
    void (LazyUCommandPalette as { __asyncLoader?: () => Promise<unknown> }).__asyncLoader?.();
  });

  type TagItem = CommandPaletteItem & { key: TagKey; color: IdbTag["color"]; pinned: boolean };

  const tagItems = computed((): TagItem[] => panelTags.value.map(tag => ({ key: tag.key, label: tag.name, color: tag.color, pinned: tag.pinnedAt !== undefined })));
  const tagGroups = computed((): CommandPaletteGroup[] => [{ id: "tags", items: tagItems.value }]);

  /**
   * The options selected: the tags the entry has (compared by key, `by`).
   * Set at once on a click or a key (the palette's own action), then only
   * when the tags the entry has differ: a new selection coming later, once
   * the change saved, made the palette highlight the first selected option
   * (or the first one, when none is), away from the one under the pointer.
   */
  const selectedItems = shallowRef<TagItem[]>([]);
  watch([tagItems, entryTagKeys], () => {
    const items = tagItems.value.filter(item => entryTagKeys.value.has(item.key));
    const keys = new Set(selectedItems.value.map(item => item.key));
    if (items.length !== keys.size || items.some(item => !keys.has(item.key))) selectedItems.value = items;
  }, { immediate: true });

  /**
   * The panel's selection changed (a single option at a time): adds the entry
   * to the tag selected, or removes it from the tag unselected.
   * @remarks With `multiple`, the value is the list of the options selected
   * (Nuxt UI types it as a single one).
   */
  const onTagsChange = async (value: unknown): Promise<void> => {
    selectedItems.value = value as TagItem[];
    const selected = new Set(selectedItems.value.map(item => item.key));
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
  <!--
    In the card's header (cf. `EntryCard`): a framed group of buttons, ruled
    between them, on the cards' background (the header is tinted), as the
    entry's tools at the other end (cf. `EntryCitationButton`). The rules'
    color is set on every button, ruled or not: otherwise, when the current
    tag's button comes in first (once the bookmarks are loaded), the next
    button's new rule fades in from the text's color (the buttons'
    `transition-colors`), a dark line flashing in the light theme.
  -->
  <div
    data-toolbar-group
    class="flex min-w-0 items-center rounded-lg border border-default bg-default shadow-xs [&>*]:border-default [&>*+*]:border-s [&>button]:rounded-none [&>:first-child]:rounded-s-md [&>:last-child]:rounded-e-md"
    :class="{ '[&_button]:transition-none': !settled }"
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
        :class="[TOOLBAR_HOVER, taggedAsCurrent ? 'text-tag-text' : 'hover:text-tag-text', fadeCurrentTag && 'animate-[fade-in_200ms_ease-out] motion-reduce:animate-none']"
        :ui="{ label: 'max-w-36 truncate text-xs tracking-tight sm:max-w-56' }"
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
    <UPopover
      v-model:open="panelOpen"
      :content="popoverContent"
      :ui="{ content: 'bg-(--app-panel-bg)' }"
    >
      <UButton
        icon="i-lucide-tags"
        color="neutral"
        variant="ghost"
        :class="[TOOLBAR_HOVER, 'data-[state=open]:bg-(--app-button-active)']"
        aria-label="Toutes les étiquettes"
      />

      <template #content>
        <div class="group/tags w-64 max-w-[calc(var(--app-width)-2rem)] p-1">
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
          <LazyUCommandPalette
            v-if="panelTags.length"
            :model-value="selectedItems"
            :groups="tagGroups"
            multiple
            by="key"
            highlight-on-hover
            :input="filterable && filterInput"
            placeholder="Filtrer les étiquettes"
            :autofocus="filterable"
            :fuse="fuseOptions"
            :ui="{
              input: '[&_input]:text-sm',
              viewport: 'max-h-72 p-0',
              item: 'rounded-md px-2 py-1.5 before:rounded-md data-highlighted:not-data-disabled:before:bg-(--app-panel-highlight) group-has-[footer_a:hover]/tags:before:bg-transparent!',
              itemTrailingIcon: 'hidden',
              empty: 'px-2 py-1.5 text-start text-sm',
            }"
            @update:model-value="onTagsChange"
          >
            <!--
              A tag, or a pin for a pinned tag (as in the bookmarks page's
              table of contents and active tag's menu): filled when the entry
              has it.
            -->
            <template #item-leading="{ item }">
              <UIcon
                :name="item.pinned
                  ? (entryTagKeys.has(item.key) ? 'i-bailly-pin-filled' : 'i-lucide-pin')
                  : (entryTagKeys.has(item.key) ? 'i-bailly-tag-filled' : 'i-lucide-tag')"
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
          </LazyUCommandPalette>
          <p
            v-else
            class="px-2 py-1.5 text-sm text-muted"
          >
            Aucune étiquette pour l'instant.
          </p>

          <!--
            The link to the bookmarks, as the tags above it: their size,
            padding and highlight (`--app-panel-highlight`); hovered, the
            list's highlight (on its first tag from the start, as Reka
            highlights it) is hidden, one highlight at a time.
          -->
          <footer class="mt-1 border-t border-default px-1 pt-1">
            <NuxtLink
              to="/signets"
              class="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-highlighted transition-colors hover:bg-(--app-panel-highlight) focus-visible:bg-(--app-panel-highlight) focus-visible:outline-none"
            >
              <UIcon
                name="i-lucide-bookmark"
                class="size-5 shrink-0"
              />
              Gérer les étiquettes
            </NuxtLink>
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
        :class="[TOOLBAR_HOVER, starred ? 'text-favorite' : 'hover:text-favorite']"
        @click="toggleStar"
      />
    </UTooltip>
  </div>
</template>
