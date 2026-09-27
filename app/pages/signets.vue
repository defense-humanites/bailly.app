<script setup lang="ts">
  useSeoMeta({
    title: "Signets",
    description:
      "Consultez et gérez vos favoris ainsi que vos étiquettes personnalisées.",
  });

  const bookmarksStore = useBookmarksStore();
  const { initialized, tags, starredEntries } = storeToRefs(bookmarksStore);

  const showButtonLabels = useButtonLabels();
</script>

<template>
  <div class="px-4 py-6 md:px-6 lg:py-12">
    <!--
      As wide as the header at most, with the same side margins (cf.
      `--header-*`): the content lines up with the header's title and menu.
      Where supported, the cards are laid out in lanes (masonry: each card
      goes, in order, into the shortest column), otherwise on a grid.
    -->
    <section
      class="mx-auto grid max-w-(--header-max-width) grid-cols-1 items-start gap-6 supports-[display:grid-lanes]:[display:grid-lanes] lg:grid-cols-2"
      :aria-busy="!initialized"
    >
      <header class="col-span-full flex gap-6 max-md:flex-col md:items-center xl:mb-6">
        <h1 class="grow font-sans text-3xl font-bold leading-normal">
          Mes signets
        </h1>

        <!--
          Actions: icons only (square buttons) below `xl`, as the header menu
          (the labels stay for screen readers and show in tooltips; cf.
          `useButtonLabels`).
        -->
        <aside class="flex items-center gap-x-3 xl:gap-x-6">
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
                variant="subtle"
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

          <CreateTag class="min-w-0 grow md:w-80 md:grow-0 xl:w-96" />
        </aside>
      </header>

      <!--
        Content, loaded from IndexedDB once the application is hydrated: until
        then (and on the server), placeholders keep the page from collapsing.
      -->
      <template v-if="initialized">
        <!-- Favorites -->
        <BookmarkGroup
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
          :key="tag.key"
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
