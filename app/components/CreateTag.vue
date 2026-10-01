<script setup lang="ts">
  import { IdbTags } from "~/idb";

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
    The text stops before the submit button, in the trailing slot (`pe-10`,
    `pe-28` with its label from `xl`, cf. `useButtonLabels`).
  -->
  <!--
    A field of the bookmarks page's menu bar (cf. `signets.vue`): square-
    cornered, without the search bar's pill shape and shadow, its background
    telling it from the bar's buttons.
  -->
  <UInput
    v-model="newTagName"
    size="xl"
    variant="soft"
    placeholder="Nouvelle étiquette"
    aria-label="Nom de la nouvelle étiquette"
    :maxlength="IdbTags.nameMaxLength"
    :class="{ 'animate-shake': isNewTagNameErrored }"
    :ui="{ base: 'h-full rounded-none shadow-none pe-10 xl:pe-28', leading: 'ps-1.5', trailing: 'pe-1.5' }"
    @keydown.enter="createTag"
  >
    <!-- Color picker -->
    <template #leading>
      <TagColorPicker
        v-model="newTagColor"
        label="Couleur de la nouvelle étiquette"
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
          :ui="{ base: 'max-xl:px-1.5', label: 'max-xl:sr-only' }"
          @click="createTag"
        />
      </UTooltip>
    </template>
  </UInput>
</template>
