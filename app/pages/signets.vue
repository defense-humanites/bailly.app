<script setup lang="ts">
  import type { TagKey } from "~/idb";

  useSeoMeta({
    title: "Signets",
    description:
      "Consultez et gérez vos favoris ainsi que vos étiquettes personnalisées.",
  });

  const bookmarksStore = useBookmarksStore();
  const { initialized, tags, starredEntries, currentTagKey, currentTag } = storeToRefs(bookmarksStore);

  const showButtonLabels = useButtonLabels();

  /**
   * From this number of tags, a table of contents under the header leads to
   * their cards (below, they all show at a glance).
   */
  const TOC_FROM = 6;

  /**
   * The id of a group's card (the target of its link in the table of
   * contents).
   */
  const groupId = (key: string): string => (key === "favorites" ? "favoris" : `etiquette-${key}`);

  /**
   * The table of contents: the favorites, then the tags in their order, with
   * their number of entries.
   */
  const toc = computed(() => [
    { key: "favorites", name: "Favoris", color: "Yellow", icon: "i-bailly-star-filled", count: starredEntries.value.length },
    ...tags.value.map(tag => ({ key: tag.key, name: tag.name, color: tag.color, icon: "i-bailly-tag-filled", count: bookmarksStore.entriesOf(tag.key).length })),
  ]);

  const entryCount = (count: number): string => (count < 2 ? "entrée" : "entrées");

  /**
   * The tags to choose the active one from, in their order; from
   * `ACTIVE_FILTER_FROM` tags, the menu can be filtered.
   */
  const ACTIVE_FILTER_FROM = 8;
  const activeItems = computed(() => tags.value.map(tag => ({ label: tag.name, value: tag.key, color: tag.color })));
  const activeLabelId = useId();
</script>

<template>
  <div class="px-4 py-6 md:px-6 lg:py-12">
    <!--
      As the preferences page: on one column (below `lg`), as wide as the
      reading column, with the title above the actions (the field then takes
      the room left); on two, `--content-max-width` at most (the header, wider
      by the search bar's overhangs, steps out of its edges).
      Where supported, the cards are laid out in lanes (masonry: each card
      goes, in order, into the shortest column), otherwise on a grid.
    -->
    <section
      class="mx-auto grid max-w-(--reading-width) grid-cols-1 items-start gap-6 supports-[display:grid-lanes]:[display:grid-lanes] lg:max-w-(--content-max-width) lg:grid-cols-2"
      :aria-busy="!initialized"
    >
      <!--
        The header, on two levels: the collection (the title, its
        synchronization and its file), then, under a rule, the tags (creating
        one, choosing the active one, arranging them), above their table of
        contents.
        Solid buttons (the tags' cards use subtle ones: the page's actions
        stand apart from them), the synchronization in the Aegean blue
        (`secondary`: the sea, and the sky of the "cloud"). Icons only (square
        buttons) below `xl`, as the header menu (the labels stay for screen
        readers and show in tooltips; cf. `useButtonLabels`).
      -->
      <header class="col-span-full flex flex-col gap-5 xl:mb-2">
        <div class="flex items-center gap-x-3 xl:gap-x-6">
          <h1 class="grow font-sans text-3xl font-bold leading-normal">
            Mes signets
          </h1>

          <!-- Synchronization (its state, and its window) -->
          <BookmarksSyncButton />

          <!-- Export, import -->
          <BookmarksMenu />
        </div>

        <div
          role="group"
          aria-label="Étiquettes"
          class="flex flex-wrap items-center gap-3 border-t border-default pt-5 xl:gap-x-6"
        >
          <CreateTag class="min-w-0 grow basis-full md:basis-auto lg:w-80 lg:grow-0 xl:w-96" />

          <!--
            The active tag (the one an entry's toolbar adds it to in one
            click), chosen from the page's top, wherever its card is. Shown
            before the bookmarks are loaded too (disabled, as when there is no
            tag): its place is kept. As high as the field and the buttons, with
            the field's shadow.
          -->
          <div class="flex min-w-0 items-center gap-2 max-md:grow">
            <span
              :id="activeLabelId"
              class="shrink-0 text-sm text-muted"
            >Étiquette active</span>
            <USelectMenu
              :model-value="currentTagKey ?? undefined"
              :items="activeItems"
              value-key="value"
              size="xl"
              color="neutral"
              :disabled="!activeItems.length"
              :placeholder="initialized ? 'Aucune étiquette' : undefined"
              :search-input="activeItems.length >= ACTIVE_FILTER_FROM && { placeholder: 'Filtrer…' }"
              :aria-labelledby="activeLabelId"
              class="min-w-0 grow md:w-56 md:grow-0"
              :ui="{ base: 'h-11 rounded-full shadow-lg shadow-black/10' }"
              @update:model-value="(key: TagKey) => bookmarksStore.setCurrentTag(key)"
            >
              <template #leading>
                <UIcon
                  name="i-bailly-tag-filled"
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

          <!-- Order tags -->
          <UModal
            title="Arranger les étiquettes"
            :close="{ variant: 'outline', class: 'shadow-none' }"
          >
            <UTooltip
              text="Arranger"
              :disabled="showButtonLabels"
            >
              <UButton
                label="Arranger"
                icon="i-lucide-list-ordered"
                size="2xl"
                class="ms-auto"
                :ui="{ base: 'max-xl:px-2.5', label: 'max-xl:sr-only' }"
              />
            </UTooltip>
            <template #body>
              <TagListSortable
                :tags="tags"
                @reorder-tags="(orderedKeys) => bookmarksStore.reorderTags(orderedKeys)"
              />
            </template>
          </UModal>
        </div>
      </header>

      <!--
        Content, loaded from IndexedDB once the application is hydrated: until
        then (and on the server), placeholders keep the page from collapsing.
      -->
      <template v-if="initialized">
        <!--
          Table of contents: a link per group, in its colors, to its card
          (which clears the header); the active tag's with a stronger ring. On one column, a single row that scrolls
          sideways, to the edges of the screen; on two, it wraps.
        -->
        <nav
          v-if="tags.length >= TOC_FROM"
          aria-label="Sommaire des signets"
          class="col-span-full -mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:-mx-6 md:px-6 lg:mx-0 lg:overflow-visible lg:px-0"
        >
          <ul class="flex w-max gap-2 lg:w-auto lg:flex-wrap">
            <li
              v-for="group in toc"
              :key="group.key"
              :data-tag-color="group.color"
            >
              <!-- Named « Homère, 12 entrées » (the full name, the count spelled out). -->
              <NuxtLink
                :to="{ hash: `#${groupId(group.key)}` }"
                :aria-label="`${group.name}, ${group.count} ${entryCount(group.count)}${group.key === currentTagKey ? ', étiquette active' : ''}`"
                class="flex h-8 items-center gap-1.5 rounded-full bg-tag-100 ps-2.5 pe-3 text-sm text-tag-text ring-inset transition-colors hover:bg-tag-200/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tag-400"
                :class="group.key === currentTagKey ? 'ring-2 ring-tag-400' : 'ring ring-tag-300/60'"
              >
                <UIcon
                  :name="group.icon"
                  class="size-4 shrink-0"
                />
                <span class="max-w-48 truncate font-medium">{{ group.name }}</span>
                <span class="tabular-nums opacity-75">{{ group.count }}</span>
              </NuxtLink>
            </li>
          </ul>
        </nav>

        <!-- Favorites -->
        <BookmarkGroup
          :id="groupId('favorites')"
          class="scroll-mt-[calc(var(--header-bottom)+1.5rem)]"
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
          v-for="tag in tags"
          :id="groupId(tag.key)"
          :key="tag.key"
          class="scroll-mt-[calc(var(--header-bottom)+1.5rem)]"
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
