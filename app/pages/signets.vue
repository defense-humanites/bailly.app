<script setup lang="ts">
  useSeoMeta({
    title: "Signets",
    description:
      "Consultez et gérez vos favoris ainsi que vos étiquettes personnalisées.",
  });

  const bookmarksStore = useBookmarksStore();
  const { tags, taggedEntries, starredEntries } = storeToRefs(bookmarksStore);
</script>

<template>
  <div class="mx-auto p-6 md:p-12 2xl:max-w-screen-2xl">
    <section class="grid grid-flow-row-dense grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
      <header class="col-span-full flex gap-6 max-md:flex-col xl:mb-6">
        <h1 class="grow font-sans text-3xl font-bold leading-normal">
          Mes signets
        </h1>

        <!-- Actions -->
        <aside class="flex items-center gap-x-3 xl:gap-x-6">
          <!-- Order tags -->
          <UModal
            title="Arranger les étiquettes"
            :close="{ variant: 'outline', class: 'shadow-none' }"
          >
            <UButton
              label="Arranger"
              icon="i-heroicons-queue-list"
              size="2xl"
              variant="subtle"
            />
            <template #body>
              <TagListSortable
                :tags="tags"
                @reorder-tags="(orderedKeys) => bookmarksStore.reorderTags(orderedKeys)"
              />
            </template>
          </UModal>

          <CreateTag />
        </aside>
      </header>

      <!-- Content -->
      <ClientOnly>
        <!-- Favorites -->
        <BookmarkGroup
          :tag="{
            key: -1,
            name: 'Favoris',
            color: 'Yellow',
          }"
          :entries="starredEntries"
          favorites
          custom-icon="i-heroicons-star"
        >
          Ajoutez à cette liste les entrées que vous souhaitez retrouver
          facilement plus tard.
        </BookmarkGroup>

        <!-- Tags -->
        <BookmarkGroup
          v-for="tag in tags"
          :key="tag.key"
          :tag="tag"
          :entries="taggedEntries.filter((entry) => entry.tagKey === tag.key)"
          editable
        >
          Cette étiquette ne référence aucune entrée.
        </BookmarkGroup>
      </ClientOnly>
    </section>
  </div>
</template>
