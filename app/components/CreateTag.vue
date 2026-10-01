<script setup lang="ts">
  import { IdbTags } from "~/idb";
  import { comparableTagName } from "~/idb/merge";

  // The field is the popover's anchor (cf. the template): it gets the
  // attributes.
  defineOptions({ inheritAttrs: false });

  const bookmarksStore = useBookmarksStore();
  const { newTagColor, tags } = storeToRefs(bookmarksStore);
  const hintId = useId();
  const errorId = useId();

  /**
   * A model to handle a new tag name creation.
   */
  const newTagName = defineModel<string>({ default: "" });

  /**
   * Why the last creation failed, until the name changes.
   */
  const failure = ref<string>();
  watch(newTagName, () => failure.value = undefined);

  /**
   * Why the name typed cannot be used, before Enter is pressed: taken by a tag
   * (case and diacritics ignored, as `IdbTags` does) or reserved.
   */
  const conflict = computed((): string | undefined => {
    const name = comparableTagName(newTagName.value.trim());
    if (!name) return undefined;
    if (name === "favoris") return "Ce nom est réservé à la liste des favoris.";
    const homonym = tags.value.find(tag => comparableTagName(tag.name) === name);
    return homonym && `L'étiquette « ${homonym.name} » existe déjà.`;
  });

  /**
   * The error shown on the field, in a bubble under it.
   */
  const error = computed((): string | undefined => failure.value ?? conflict.value);

  const createTag = async (event: Event): Promise<void> => {
    if (!newTagName.value || error.value) return;

    const response = await bookmarksStore.createTag(
      { name: newTagName.value, color: newTagColor.value },
      { quiet: true },
    );

    if (response.state === "success") {
      newTagName.value = "";
      if (event.target instanceof HTMLInputElement) event.target.blur();
    } else {
      failure.value = response.message;
    }
  };
</script>

<template>
  <!--
    A field of the bookmarks page's menu bar (cf. `signets.vue`): square-
    cornered, without the search bar's pill shape and shadow, its background
    telling it from the bar's buttons. No submit button: Enter adds the tag
    (the return key of a touch keyboard, `enterkeyhint`), as the key drawn at
    its end says; brighter once there is a name to add.

    An error is shown where the eyes are: the field in red, an alert instead
    of the key, the message in a bubble under it (over the page: nothing
    moves), read by screen readers from a live region (the bubble is hidden
    from them). Shown as soon as the name typed is taken, and when a creation
    fails; gone once the name changes.
  -->
  <UPopover
    :open="!!error"
    :dismissible="false"
    :content="{ side: 'bottom', align: 'start', sideOffset: 6, onOpenAutoFocus: (event: Event) => event.preventDefault(), onCloseAutoFocus: (event: Event) => event.preventDefault() }"
    :ui="{ content: 'px-3 py-2 text-sm text-error' }"
  >
    <template #anchor>
      <UInput
        v-bind="$attrs"
        v-model="newTagName"
        size="xl"
        variant="soft"
        :color="error ? 'error' : 'neutral'"
        :highlight="!!error"
        placeholder="Nouvelle étiquette"
        aria-label="Nom de la nouvelle étiquette"
        :aria-describedby="`${errorId} ${hintId}`"
        :aria-invalid="!!error"
        enterkeyhint="done"
        :maxlength="IdbTags.nameMaxLength"
        :ui="{ base: 'h-full rounded-none shadow-none', leading: 'ps-1.5', trailing: 'pe-3' }"
        @keydown.enter="createTag"
      >
        <!-- Color picker -->
        <template #leading>
          <TagColorPicker
            v-model="newTagColor"
            label="Couleur de la nouvelle étiquette"
          />
        </template>

        <!-- Enter adds the tag; or why it cannot -->
        <template #trailing>
          <UIcon
            v-if="error"
            name="i-lucide-circle-alert"
            aria-hidden="true"
            class="size-5 text-error"
          />
          <UKbd
            v-else
            value="enter"
            size="lg"
            aria-hidden="true"
            class="transition-opacity"
            :class="newTagName.length ? 'opacity-100' : 'opacity-50'"
          />
          <span
            :id="hintId"
            class="sr-only"
          >Entrée pour ajouter</span>
          <span
            :id="errorId"
            role="status"
            class="sr-only"
          >{{ error }}</span>
        </template>
      </UInput>
    </template>

    <template #content>
      <p aria-hidden="true">
        {{ error }}
      </p>
    </template>
  </UPopover>
</template>
