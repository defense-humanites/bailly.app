<script setup lang="ts">
  const bookmarksStore = useBookmarksStore();
  const showButtonLabels = useButtonLabels();
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
  <!--
    The text stops before the submit button, in the trailing slot (`pe-12`,
    `pe-28` with its label from `xl`, cf. `useButtonLabels`).
  -->
  <UInput
    v-model="newTagName"
    size="2xl"
    placeholder="Nouvelle étiquette"
    aria-label="Nom de la nouvelle étiquette"
    :class="{ 'animate-shake': isNewTagNameErrored }"
    :ui="{ root: 'w-96', base: 'pe-12 xl:pe-28', leading: 'ps-1.5', trailing: 'pe-1.5' }"
    @keydown.enter="createTag"
  >
    <!-- Color picker -->
    <template #leading>
      <TagColorPicker
        :selected="newTagColor"
        label="Couleur de la nouvelle étiquette"
        @pick-color="(colorKey) => (newTagColor = colorKey)"
      />
    </template>

    <!-- Submit button -->
    <template #trailing>
      <UTooltip
        text="Ajouter"
        :disabled="showButtonLabels"
      >
        <UButton
          :disabled="!newTagName.length"
          label="Ajouter"
          size="md"
          variant="soft"
          color="secondary"
          icon="i-lucide-plus"
          :ui="{ base: 'shadow-none', label: 'max-xl:sr-only' }"
          @click="createTag"
        />
      </UTooltip>
    </template>
  </UInput>
</template>
