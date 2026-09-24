<script setup lang="ts">
  const bookmarksStore = useBookmarksStore();
  const { newTagColor } = storeToRefs(bookmarksStore);

  /**
   * A model to handle a new tag name creation.
   */
  const newTagName = defineModel<string>({ default: "" });
  /**
   * A boolean representing the state of a new tag name creation.
   */
  const isNewTagNameErrored = ref<boolean>(false);

  const createTag = async (event: Event): Promise<void> => {
    isNewTagNameErrored.value = false;

    if (newTagName.value) {
      const response = await bookmarksStore.createTag({
        name: newTagName.value,
        color: newTagColor.value,
      });

      switch (response.state) {
        case "success":
          newTagName.value = "";
          if (event.target instanceof HTMLInputElement) event.target.blur();
          break;
        case "error":
          isNewTagNameErrored.value = true;
          break;
      }
    }
  };
</script>

<template>
  <UInput
    v-model="newTagName"
    size="2xl"
    :class="{ 'animate-shake': isNewTagNameErrored }"
    :ui="{ root: 'w-96', leading: 'ps-1.5', trailing: 'pe-1.5' }"
    @keydown.enter="createTag"
  >
    <!-- Color picker -->
    <template #leading>
      <TagColorPicker
        :selected="newTagColor"
        @pick-color="(colorKey) => (newTagColor = colorKey)"
      />
    </template>

    <!-- Submit button -->
    <template #trailing>
      <UButton
        :disabled="!newTagName.length"
        size="md"
        variant="soft"
        color="secondary"
        icon="i-heroicons-plus"
        :ui="{ base: 'shadow-none' }"
        @click="createTag"
      >
        Ajouter
      </UButton>
    </template>
  </UInput>
</template>
