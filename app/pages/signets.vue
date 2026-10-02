<script setup lang="ts">
  import type { TocGroup } from "~/components/BookmarksToc.vue";
  import type { TagKey } from "~/idb";

  useSeoMeta({
    title: "Signets",
    description:
      "Consultez et gérez vos favoris ainsi que vos étiquettes personnalisées.",
  });

  const bookmarksStore = useBookmarksStore();
  const { initialized, tags, starredEntries, currentTagKey, currentTag } = storeToRefs(bookmarksStore);

  /**
   * From this number of tags, a table of contents under the header leads to
   * their cards (below, they all show at a glance).
   */
  const TOC_FROM = 4;

  /**
   * The id of a group's card (the target of its link in the table of
   * contents).
   */
  const groupId = (key: string): string => (key === "favorites" ? "favoris" : `etiquette-${key}`);

  /**
   * The table of contents: the favorites, then the tags in their order, with
   * their number of entries.
   */
  /**
   * The tags as shown (cards, table of contents): the pinned ones first, then
   * the others as the user chose to sort them (cf. `TagSortMenu`).
   */
  const tagSort = useTagSort();
  const sortedTags = computed(() => sortTags(tags.value, tagSort.value, bookmarksStore.entriesOf));

  const toc = computed((): TocGroup[] => [
    { key: "favorites", id: groupId("favorites"), name: "Favoris", color: "Yellow", icon: "i-bailly-star-filled", count: starredEntries.value.length, active: true },
    ...sortedTags.value.map(tag => ({
      key: tag.key,
      id: groupId(tag.key),
      name: tag.name,
      color: tag.color,
      icon: "i-bailly-tag-filled",
      count: bookmarksStore.entriesOf(tag.key).length,
      active: tag.key === currentTagKey.value,
    })),
  ]);
  const showToc = computed((): boolean => initialized.value && tags.value.length >= TOC_FROM);

  /**
   * The tags to choose the active one from, in their order; from
   * `ACTIVE_FILTER_FROM` tags, the menu can be filtered.
   */
  const ACTIVE_FILTER_FROM = 8;
  const activeItems = computed(() => tags.value.map(tag => ({ label: tag.name, value: tag.key, color: tag.color })));
</script>

<template>
  <div class="overflow-x-clip px-4 py-6 md:px-6 lg:py-12">
    <!--
      Clipped sideways: the table of contents' background spans the window
      (cf. `BookmarksToc`). `clip` (not `hidden`) keeps it sticky.
    -->
    <!--
      As the preferences page: on one column (below `lg`), as wide as the
      reading column, with the title above the actions (the field then takes
      the room left); on two, `--content-max-width` at most (the header, wider
      by the search bar's overhangs, steps out of its edges).
      Where supported, the cards are laid out in lanes (masonry: each card
      goes, in order, into the shortest column), otherwise on a grid.
    -->
    <section
      class="mx-auto grid max-w-(--reading-width) grid-cols-1 items-start gap-(--cards-gap) [--cards-gap:1.5rem] supports-[display:grid-lanes]:[display:grid-lanes] lg:max-w-(--content-max-width) lg:grid-cols-2"
      :class="{ '[--toc-height:3rem]': showToc }"
      :aria-busy="!initialized"
    >
      <!--
        The header: the title and the synchronization (a solid button, in the
        Aegean blue — `secondary`: the sea, and the sky of the "cloud" —, the
        page's main action), then a menu bar for the tags, in the style of an
        entry's toolbar (cf. `TagButtonGroup`): creating a tag, choosing the
        active one, sorting them, and the file (export, import: less used,
        within reach for whoever looks for it). Its fields are square-cornered,
        without the search bar's pill shape, their background telling them
        from its buttons (ghost). Below `lg`, the field takes the bar's first
        row. Icons only (square buttons) below `xl`, as the header menu (the
        labels stay for screen readers and show in tooltips; cf.
        `useButtonLabels`).
      -->
      <header class="col-span-full flex flex-col gap-5 xl:mb-2">
        <div class="flex items-center gap-x-3">
          <h1 class="grow font-sans text-3xl font-bold leading-normal">
            Mes signets
          </h1>

          <!-- Synchronization (its state, and its window) -->
          <SyncButton scope="bookmarks" />
        </div>

        <div
          role="group"
          aria-label="Étiquettes"
          class="flex flex-wrap overflow-hidden rounded-lg border border-default bg-default shadow-xs lg:flex-nowrap lg:gap-2 lg:overflow-visible lg:border-0 lg:bg-transparent lg:shadow-none"
        >
          <!--
            Below `lg`, one compact block on two lines (the field keeps a fair
            width): the field alone on the first (a border under it), the
            others side by side on the second (a border before each but the
            first). From `lg`, separate items
            (each framed, slightly apart) on one line, the fields sharing the
            width left by the buttons.
          -->
          <CreateTag class="h-11 min-w-0 basis-full border-default max-lg:border-b lg:basis-0 lg:grow lg:overflow-hidden lg:rounded-lg lg:border lg:bg-default lg:shadow-xs" />

          <!--
            The active tag (the one an entry's toolbar adds it to in one
            click), chosen from the page's top, wherever its card is. Shown
            before the bookmarks are loaded too (disabled, as when there is no
            tag): its place is kept.
          -->
          <div class="flex h-11 min-w-0 grow border-default lg:basis-0 lg:overflow-hidden lg:rounded-lg lg:border lg:bg-default lg:shadow-xs">
            <USelectMenu
              :model-value="currentTagKey ?? undefined"
              :items="activeItems"
              value-key="value"
              size="xl"
              color="neutral"
              variant="soft"
              :disabled="!activeItems.length"
              :placeholder="initialized ? 'Aucune étiquette' : undefined"
              :search-input="activeItems.length >= ACTIVE_FILTER_FROM && { placeholder: 'Filtrer…', ui: { base: 'rounded-none shadow-none' } }"
              aria-label="Étiquette active"
              class="h-full min-w-0 grow"
              :ui="{ base: `h-full gap-2 rounded-none ps-3 shadow-none focus-visible:-outline-offset-3 ${FIELD_BACKGROUND}`, leading: 'static shrink-0 ps-0' }"
              @update:model-value="(key: TagKey) => bookmarksStore.setCurrentTag(key)"
            >
              <template #leading>
                <!--
                  The mark of the active tag, in its color: the icon of the
                  cards' "Rendre active" (a selected radio button).
                -->
                <UIcon
                  name="i-lucide-circle-dot"
                  :data-tag-color="currentTag?.color"
                  class="size-5 shrink-0 text-tag-text"
                />
              </template>
              <template #item-leading="{ item }">
                <UIcon
                  name="i-bailly-tag-filled"
                  :data-tag-color="item.color"
                  class="size-5 shrink-0 text-tag-text"
                />
              </template>
            </USelectMenu>
          </div>

          <!-- Export, import -->
          <!-- Sorting -->
          <TagSortMenu class="flex h-11 border-s border-default lg:overflow-hidden lg:rounded-lg lg:border lg:bg-default lg:shadow-xs" />

          <BookmarksMenu class="flex h-11 border-s border-default lg:overflow-hidden lg:rounded-lg lg:border lg:bg-default lg:shadow-xs" />
        </div>
      </header>

      <!--
        Content, loaded from IndexedDB once the application is hydrated: until
        then (and on the server), placeholders keep the page from collapsing.
      -->
      <template v-if="initialized">
        <BookmarksToc
          v-if="showToc"
          :groups="toc"
        />

        <!-- Favorites -->
        <BookmarkGroup
          :id="groupId('favorites')"
          class="scroll-mt-[calc(var(--header-bottom)+var(--toc-height,0px)+var(--cards-gap))]"
          :tag="{
            key: 'favorites',
            name: 'Favoris',
            color: 'Yellow',
          }"
          :entries="starredEntries"
          favorites
          custom-icon="i-bailly-star-filled"
        >
          Ajoutez à cette liste les entrées que vous souhaitez retrouver
          facilement plus tard.
        </BookmarkGroup>

        <!-- Tags -->
        <BookmarkGroup
          v-for="tag in sortedTags"
          :id="groupId(tag.key)"
          :key="tag.key"
          class="scroll-mt-[calc(var(--header-bottom)+var(--toc-height,0px)+var(--cards-gap))]"
          :tag="tag"
          :entries="bookmarksStore.entriesOf(tag.key)"
          editable
        >
          Cette étiquette ne référence aucune entrée.
        </BookmarkGroup>
      </template>
      <template v-else>
        <USkeleton
          v-for="n in 2"
          :key="n"
          class="h-30 rounded-lg"
        />
      </template>
    </section>
  </div>
</template>
