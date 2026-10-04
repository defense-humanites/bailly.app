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
   * the others as the user chose to sort them (cf. `BookmarksDisplayMenu`).
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
      icon: tag.pinnedAt === undefined ? "i-bailly-tag-filled" : "i-bailly-pin-filled",
      count: bookmarksStore.entriesOf(tag.key).length,
      active: tag.key === currentTagKey.value,
    })),
  ]);
  const showToc = computed((): boolean => initialized.value && tags.value.length >= TOC_FROM);

  /**
   * The introduction to the bookmarks, until the user dismisses it (on every
   * device whose preferences are synchronized, cf. `useDismissed`); with an
   * invitation to synchronize them while they aren't.
   */
  const introDismissed = useDismissed("bookmarksIntro");
  // (Its exposed `enabled` is unwrapped on the component's instance.)
  const syncButton = useTemplateRef<{ enabled: boolean }>("syncButton");
  const syncEnabled = computed((): boolean => syncButton.value?.enabled ?? false);

  /**
   * The tags to choose the active one from, in their order; from
   * `ACTIVE_FILTER_FROM` tags, the menu can be filtered.
   */
  const ACTIVE_FILTER_FROM = 8;
  const activeItems = computed(() => tags.value.map(tag => ({ label: tag.name, value: tag.key, color: tag.color })));
  /**
   * The active tag's key, once its tag is listed only: the field would show
   * the bare key otherwise (on a reload, the key is known before the tags
   * are loaded; a new tag, before it is listed).
   */
  const activeKey = computed(() => activeItems.value.some(item => item.value === currentTagKey.value) ? currentTagKey.value! : undefined);
</script>

<template>
  <div class="px-4 py-6 md:px-6 lg:pt-8 lg:pb-12">
    <!--
      As the preferences page: on one column (below `lg`), as wide as the
      reading column, with the title above the actions (the field then takes
      the room left); on two, `--content-max-width` at most (the header, wider
      by the search bar's overhangs, steps out of its edges).
      Where supported, the cards are laid out in lanes (masonry: each card
      goes, in order, into the shortest column), otherwise on a grid. Columns
      whose heights differ by less than 2.5rem count as equal
      (`flow-tolerance`, 1em by default): the order reads more regularly, and
      a card that grows a little (a description added) seldom sends the
      next ones to other columns.
    -->
    <section
      class="mx-auto grid max-w-(--reading-width) grid-cols-1 items-start gap-(--cards-gap) [--cards-gap:1.5rem] supports-[display:grid-lanes]:[display:grid-lanes] supports-[display:grid-lanes]:[flow-tolerance:2.5rem] lg:max-w-(--content-max-width) lg:grid-cols-2"
      :class="{ '[--toc-height:3rem]': showToc }"
      :aria-busy="!initialized"
    >
      <!--
        The header: the title (for screen readers only), then a menu bar, in
        the style of an entry's toolbar (cf. `TagButtonGroup`): creating a
        tag, choosing the active one, the display (the entries, the sorting of
        the tags), the files (export, import: less used, within reach for
        whoever looks for it) and, last, the synchronization (in the Aegean
        blue — `secondary`: the sea, and the sky of the "cloud" —, the page's
        main action, cf. `SyncButton`). Its fields are square-cornered, without the search bar's pill
        shape, their background telling them from its buttons (ghost). Below `lg`, the field takes the bar's first
        row. Icons only (square buttons) below `xl`, as the header menu (the
        labels stay for screen readers and show in tooltips; cf.
        `useButtonLabels`).
      -->
      <header class="col-span-full flex flex-col xl:mb-2">
        <!--
          The title for screen readers only, as on the preferences page: the
          header's menu already shows the page, and the bookmarks take the
          room.
        -->
        <h1 class="sr-only">
          Mes signets
        </h1>

        <div
          role="group"
          aria-label="Étiquettes"
          class="flex flex-wrap rounded-lg border border-default bg-default shadow-xs [--field-inner-radius:calc(var(--radius-lg)-1px)] lg:flex-nowrap lg:gap-2 lg:border-0 lg:bg-transparent lg:shadow-none"
        >
          <!--
            Below `lg`, one compact block on two lines (the field keeps a fair
            width): the field alone on the first (a border under it), the
            others side by side on the second (a border before each but the
            first). From `lg`, separate items
            (each framed, slightly apart) on one line, the fields sharing the
            width left by the buttons.
          -->
          <CreateTag class="h-11 min-w-0 basis-full border-default max-lg:rounded-t-(--field-inner-radius) max-lg:border-b lg:basis-0 lg:grow lg:overflow-hidden lg:rounded-lg lg:border lg:bg-default lg:shadow-xs" />

          <!--
            The active tag (the one an entry's toolbar adds it to in one
            click), chosen from the page's top, wherever its card is. Shown
            before the bookmarks are loaded too (disabled, as when there is no
            tag): its place is kept.
          -->
          <div
            class="flex h-11 min-w-0 grow basis-24 border-default max-lg:rounded-bl-(--field-inner-radius) lg:basis-0 lg:overflow-hidden lg:rounded-lg lg:border lg:bg-default lg:shadow-xs"
            :class="FIELD_HALO"
          >
            <USelectMenu
              :model-value="activeKey"
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
              :ui="{ base: `h-full gap-2 rounded-none ps-3 shadow-none focus-visible:outline-transparent max-lg:rounded-bl-(--field-inner-radius) ${FIELD_BACKGROUND}`, leading: 'static shrink-0 ps-0' }"
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

          <!-- Display: the entries, the sorting of the tags -->
          <BookmarksDisplayMenu class="flex h-11 border-s border-default lg:overflow-hidden lg:rounded-lg lg:border lg:bg-default lg:shadow-xs" />

          <!-- Export, import -->
          <BookmarksMenu class="flex h-11 border-s border-default lg:overflow-hidden lg:rounded-lg lg:border lg:bg-default lg:shadow-xs" />

          <!-- Synchronization (its state, and its window) -->
          <SyncButton
            ref="syncButton"
            scope="bookmarks"
            class="flex h-11 border-s border-default max-lg:overflow-hidden max-lg:rounded-br-(--field-inner-radius) lg:overflow-hidden lg:rounded-lg lg:border lg:bg-default lg:shadow-xs"
          />
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

        <!--
          The introduction, a card before the favorites (on their left from
          `lg`), laid out as theirs (sizes, margins), told from them by its
          terracotta, its bookmark's outline, its title and text in a normal weight:
          what the bookmarks are, and, while they aren't synchronized, that
          they can be (the bar's button). Dismissed by its button.
        -->
        <UCard
          v-if="!introDismissed"
          role="group"
          aria-labelledby="signets-intro"
          variant="bookmarkGroup"
          :ui="{
            root: 'bg-[color-mix(in_srgb,var(--color-terracotta-200)_50%,var(--app-page-bg))] border-terracotta-300/50 dark:bg-[color-mix(in_srgb,var(--color-terracotta-900)_50%,var(--app-page-bg))] dark:border-terracotta-800/60',
            header: 'flex !px-3 pb-0',
            body: '!p-3',
          }"
        >
          <template #header>
            <div class="flex min-h-8 w-full items-start gap-3 text-terracotta-700 dark:text-terracotta-400">
              <div class="flex min-w-0 grow items-start">
                <UIcon
                  name="i-lucide-bookmark"
                  class="mx-2 mt-1 size-6 shrink-0"
                />
                <h2
                  id="signets-intro"
                  class="ml-2 min-w-0 grow py-0.5 pe-2 text-xl/7 font-normal md:py-0 md:text-2xl/8"
                >
                  Vos signets
                </h2>
              </div>
              <UTooltip text="Masquer">
                <UButton
                  icon="i-lucide-x"
                  size="sm"
                  variant="subtle"
                  color="neutral"
                  aria-label="Masquer la présentation des signets"
                  :ui="{ base: 'bg-default/50 hover:bg-default/90 active:bg-default/75 ring-terracotta-300/50 text-terracotta-700/75 hover:text-terracotta-700 dark:ring-terracotta-800/60 dark:text-terracotta-400/75 dark:hover:text-terracotta-400' }"
                  @click="introDismissed = true"
                />
              </UTooltip>
            </div>
          </template>
          <p class="ms-12 text-terracotta-700 dark:text-terracotta-400">
            Depuis la barre d'outils d'une entrée, ajoutez-la à vos favoris ou rangez-la sous
            une étiquette : vous la retrouverez ici.
            <template v-if="!syncEnabled">
              Vos signets restent sur cet appareil ; synchronisez-les pour les retrouver sur vos
              autres appareils.
            </template>
          </p>
        </UCard>

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
