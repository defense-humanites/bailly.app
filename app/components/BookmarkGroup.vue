<script setup lang="ts">
  import type { ColorKey } from "~/enums";
  import { IdbTags, type IdbEntry, type IdbTagWithKey } from "~/idb";

  const bookmarksStore = useBookmarksStore();

  const props = defineProps<{
    /**
     * The tag that the bookmark group represents.
     */
    tag: Pick<IdbTagWithKey, "key" | "name"> & Partial<Pick<IdbTagWithKey, "description">> & { color: ColorKey };
    /**
     * The entries that are part of the group.
     */
    entries: IdbEntry[];
    /**
     * If enabled, the group represents the favorites (starred entries)
     * rather than a tag.
     */
    favorites?: boolean;
    /**
     * An icon that overrides the default tag icon.
     */
    customIcon?: string;
    /**
     * If enabled, make the tag data and its related entries editable.
     */
    editable?: boolean;
  }>();

  const bookmarkGroup = useTemplateRef("bookmark-group");
  const tagNameInput = useTemplateRef<HTMLInputElement>("tag-name-input");
  const descriptionInput = useTemplateRef<HTMLTextAreaElement>("description-input");

  /**
   * The editable tag name.
   */
  const tagName = ref<string>(props.tag.name);
  /**
   * A boolean representing the state of the tag name input.
   */
  const isTagNameErrored = ref<boolean>(false);
  /**
   * The editable tag description.
   */
  const tagDescription = ref<string>(props.tag.description ?? "");
  /**
   * Whether the description field is shown in edit mode without a stored
   * description (after « Ajouter une description »).
   */
  const isAddingDescription = ref<boolean>(false);
  /**
   * The characters left in the description, shown near the limit.
   */
  const descriptionLeft = computed(() => IdbTags.descriptionMaxLength - Array.from(tagDescription.value).length);

  // The description field grows with its text, as the description it
  // replaces (wrapped alike): the card keeps its size in the edit mode.
  useTextareaAutosize({ element: descriptionInput, input: tagDescription });
  /**
   * The editable tag color.
   */
  const tagColor = ref<ColorKey>(props.tag.color);
  /**
   * A boolean representing whether the tag color popover is open.
   */
  const isTagColorPopoverOpen = ref<boolean>(false);
  /**
   * A boolean representing whether the user can edit the group: the tag data
   * (if `editable`) and the entries it contains.
   */
  const editMode = ref<boolean>(false);
  /**
   * A boolean representing whether the tag deletion confirmation is open.
   */
  const isDeleteConfirmationOpen = ref<boolean>(false);

  // The bookmarks do not change while the tag is being edited.
  useBookmarksHold(editMode);

  /**
   * Keeps the editable values in sync with the stored tag.
   */
  watch(() => props.tag.name, (name) => {
    tagName.value = name;
  });
  watch(() => props.tag.color, (color) => {
    tagColor.value = color;
  });
  watch(() => props.tag.description, (description) => {
    tagDescription.value = description ?? "";
  });

  /**
   * Updates the tag properties.
   */
  const onUpdateTag = async (): Promise<void> => {
    isTagNameErrored.value = false;

    if (
      tagName.value === props.tag.name
      && tagColor.value === props.tag.color
      && tagDescription.value.trim() === (props.tag.description ?? "")
    ) return;

    const response = await bookmarksStore.updateTag(props.tag.key, {
      name: tagName.value,
      description: tagDescription.value,
      color: IdbTags.isColorKey(tagColor.value) ? tagColor.value : undefined,
    });

    if (response.state === "error") {
      isTagNameErrored.value = true;
      tagName.value = props.tag.name;
      tagDescription.value = props.tag.description ?? "";
      tagColor.value = props.tag.color;
    }
  };

  /**
   * Deletes the tag (its entries, if any, are detached from it), once the
   * user has confirmed it.
   */
  const onDeleteTag = async (): Promise<void> => {
    const response = await bookmarksStore.removeTag(props.tag.key);
    if (response.state === "success") isDeleteConfirmationOpen.value = false;
  };

  const onDeleteEntry = async (entry: IdbEntry): Promise<void> => {
    if (props.favorites) {
      await bookmarksStore.unstarEntry(entry.uri);
    } else {
      await bookmarksStore.untagEntry(entry.uri, props.tag.key);
    }
  };

  const onPickColor = (colorKey: ColorKey): void => {
    tagColor.value = colorKey;
    void onUpdateTag();
  };

  /**
   * The group icon: a custom one, or a (filled) tag.
   */
  const icon = computed((): string => props.customIcon ?? "i-bailly-tag-filled");

  const editableEditMode = computed(
    (): boolean => props.editable && editMode.value,
  );

  /**
   * The group's name, for accessible names.
   */
  const groupName = computed(
    (): string => props.favorites ? "les favoris" : `l'étiquette « ${props.tag.name} »`,
  );

  /**
   * The consequence of the tag deletion, for its confirmation.
   */
  const deleteDescription = computed((): string => {
    const count = props.entries.length;
    if (!count) return "Cette étiquette ne référence aucune entrée.";
    return count === 1
      ? "L'entrée qu'elle référence ne sera plus étiquetée ainsi."
      : `Les ${count} entrées qu'elle référence ne seront plus étiquetées ainsi.`;
  });

  const enterEditMode = (): void => {
    editMode.value = true;
  };

  const exitEditMode = (): void => {
    editMode.value = false;
    isAddingDescription.value = false;
    void onUpdateTag();
  };

  /**
   * Shows the description field (the tag has none yet), and focuses it.
   */
  const addDescription = async (): Promise<void> => {
    isAddingDescription.value = true;
    await nextTick();
    descriptionInput.value?.focus();
  };

  /**
   * Whether the description field is shown (in edit mode).
   */
  const showsDescriptionField = computed(
    (): boolean => editableEditMode.value && (Boolean(props.tag.description) || isAddingDescription.value),
  );

  const toggleEditMode = (): void => {
    if (editMode.value) exitEditMode();
    else enterEditMode();
  };

  /**
   * Whether an overlay of the group (the tag color popover, the deletion
   * confirmation) is open: the edit mode shortcuts then leave it alone.
   */
  const isOverlayOpen = computed(
    (): boolean => isTagColorPopoverOpen.value || isDeleteConfirmationOpen.value,
  );

  /**
   * Exits the edit mode when clicking outside the bookmark group.
   */
  onClickOutside(bookmarkGroup, () => {
    if (editMode.value && !isOverlayOpen.value) exitEditMode();
  });

  /**
   * Adds shortcuts to exit the edit mode/blur the tag name input.
   */
  onKeyStroke(["Enter", "Escape"], (event) => {
    // Process shortcuts only if the edit mode is set and no overlay is open.
    if (!editMode.value || isOverlayOpen.value) return;

    // Process the tag name input or the description field if one is active
    // (Shift+Enter goes to the line in the description), otherwise exit the
    // edit mode.
    const input = tagNameInput.value;
    const field = descriptionInput.value;
    if (field && field === document.activeElement) {
      if (event.key === "Enter" && event.shiftKey) return;
      event.preventDefault();
      field.blur();
      void onUpdateTag();
    } else if (input && input === document.activeElement) {
      event.preventDefault();
      input.blur();
      void onUpdateTag();
    } else if (event.key === "Escape" || !(event.target as Element | null)?.closest("button, a")) {
      // `Enter` on a button or a link activates it instead (e.g. the edit
      // button, which would otherwise exit the edit mode and enter it again).
      exitEditMode();
    }
  });

  // Greek may be transliterated (a preference).
  const greek = useGreek();
</script>

<template>
  <UCard
    ref="bookmark-group"
    class="group"
    :data-tag-color="tagColor"
    variant="bookmarkGroup"
    :ui="{
      // The tint of the tag, opaque (mixed with the page's background, as it
      // was seen through): the page's motif no longer shows under the text.
      root: 'bg-[color-mix(in_srgb,var(--tag-200)_50%,var(--app-page-bg))] border-tag-300/50',
      header: 'flex flex-col !px-3 pb-0',
      body: '@container !p-3 text-default',
    }"
  >
    <!-- Tag data and actions -->
    <!--
      A long tag name wraps: the row grows (`min-h-8`), the icon and the
      actions staying on its first line.
    -->
    <template #header>
      <div class="flex min-h-8 w-full items-start gap-3">
        <!--
          The name and its field share one cell: in edit mode, the name stays
          in the layout, invisible, so that the card keeps its height (a long
          name gives way to a field on one line, with some room under it).
        -->
        <div class="grid min-w-0 grow text-tag-text">
          <!-- Display tag data -->
          <!--
            In edit mode, « Ajouter une description » widens the actions: the
            hidden name spreads under them, to keep its wrapping.
          -->
          <div
            class="col-start-1 row-start-1 flex min-w-0 items-start"
            :class="{ 'invisible': editableEditMode, '-me-8': editableEditMode && !showsDescriptionField }"
          >
            <UIcon
              :name="icon"
              class="mx-2 mt-1 size-6 shrink-0"
            />
            <span class="ml-2 min-w-0 grow py-0.5 pe-2 text-xl/7 font-bold wrap-break-word md:py-0 md:text-2xl/8">{{ tag.name }}</span>
          </div>

          <!-- Edit tag data -->
          <div
            v-show="editableEditMode"
            class="col-start-1 row-start-1 flex min-w-0 items-start"
          >
            <TagColorPicker
              :selected="IdbTags.isColorKey(tagColor) ? tagColor : undefined"
              label="Couleur de l'étiquette"
              @popover-state="(isOpen) => (isTagColorPopoverOpen = isOpen)"
              @pick-color="onPickColor"
            >
              <template #trigger="trigger">
                <UButton
                  :icon="trigger.icon"
                  :data-tag-color="trigger.color"
                  :aria-label="trigger.label"
                  size="xl"
                  variant="ghost"
                  color="neutral"
                  :class="trigger.class"
                  :ui="{
                    base: `h-8 w-10 justify-center rounded-l-full rounded-r-none ${isTagColorPopoverOpen ? 'bg-default/90 hover:bg-default/90 active:bg-default/90' : 'bg-default/60 hover:bg-default/90 active:bg-default/90'}`,
                  }"
                />
              </template>
            </TagColorPicker>

            <!--
              A field on one line (Enter validates), in the name's text: its
              height comes from the same padding and line height as the name
              (32 px), rather than from a fixed height, in which each browser
              centres the text its own way.
            -->
            <input
              ref="tag-name-input"
              v-model="tagName"
              type="text"
              aria-label="Nom de l'étiquette"
              :maxlength="IdbTags.nameMaxLength"
              class="min-w-0 grow rounded-r-full bg-default/60 px-2 py-0.5 text-xl/7 font-bold text-tag-text hover:bg-default/90 focus:bg-default/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-tag-300 md:py-0 md:text-2xl/8"
              :class="{ 'animate-shake': isTagNameErrored }"
            >
          </div>
        </div>

        <!--
          Actions: the edit button, and in edit mode the tag deletion. Out of
          edit mode, they show on hover, on focus (they stay in the tab order:
          transparent, not hidden) and always on a touch screen (which has no
          hover).
        -->
        <!--
          Their place is reserved for two buttons (the edit mode adds the
          deletion): the name wraps alike in both modes.
        -->
        <span
          class="flex h-8 min-w-[4.75rem] shrink-0 items-center justify-end gap-3"
          :class="editMode ? '' : 'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100'"
        >
          <UButton
            v-if="editableEditMode && !showsDescriptionField"
            icon="i-lucide-text"
            size="sm"
            variant="subtle"
            color="neutral"
            aria-label="Ajouter une description"
            :ui="{ base: 'bg-default/50 hover:bg-default/90 active:bg-default/75 ring-tag-300/50 text-tag-text/75 hover:text-tag-text' }"
            @click="addDescription"
          />
          <UButton
            v-if="editableEditMode"
            icon="i-lucide-trash-2"
            size="sm"
            color="error"
            variant="subtle"
            :aria-label="`Supprimer ${groupName}`"
            @click="isDeleteConfirmationOpen = true"
          />
          <UButton
            icon="i-lucide-pencil"
            size="sm"
            variant="subtle"
            color="neutral"
            :aria-label="`Modifier ${groupName}`"
            :aria-pressed="editMode"
            :ui="{ base: editMode ? 'text-white bg-tag-400 hover:bg-tag-400 ring-tag-300/50' : 'bg-default/50 hover:bg-default/90 active:bg-default/75 ring-tag-300/50 text-tag-text/75 hover:text-tag-text' }"
            @click="toggleEditMode"
          />
        </span>

        <UModal
          v-if="editable"
          v-model:open="isDeleteConfirmationOpen"
          :title="`Supprimer ${groupName} ?`"
          :description="deleteDescription"
          :ui="{ footer: 'justify-end' }"
        >
          <template #footer>
            <UButton
              label="Annuler"
              color="neutral"
              variant="outline"
              @click="isDeleteConfirmationOpen = false"
            />
            <UButton
              label="Supprimer"
              color="error"
              @click="onDeleteTag"
            />
          </template>
        </UModal>
      </div>

      <!--
        The description, under the name and aligned with it; in edit mode, a
        field with the same text, spacing and size (text, never HTML).
      -->
      <p
        v-if="tagDescription && !showsDescriptionField"
        class="ms-10 mt-1 px-2 py-1 text-sm/5 whitespace-pre-line wrap-break-word text-tag-text"
        v-text="tagDescription"
      />
      <div
        v-else-if="showsDescriptionField"
        class="relative ms-10 mt-1"
      >
        <textarea
          ref="description-input"
          v-model="tagDescription"
          rows="1"
          :maxlength="IdbTags.descriptionMaxLength"
          aria-label="Description de l'étiquette"
          :aria-description="`${IdbTags.descriptionMaxLength} caractères au plus ; Maj+Entrée pour aller à la ligne`"
          placeholder="Description"
          class="block w-full resize-none overflow-hidden rounded-lg bg-default/60 px-2 py-1 text-sm/5 text-tag-text placeholder:text-tag-text/60 hover:bg-default/90 focus:bg-default/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-tag-300"
          @blur="onUpdateTag"
        />
        <span
          v-if="descriptionLeft < 30"
          class="pointer-events-none absolute end-2 bottom-1 rounded bg-default/90 px-1 text-xs text-tag-text tabular-nums"
          aria-hidden="true"
        >{{ descriptionLeft }}</span>
      </div>
    </template>

    <!-- Content -->
    <template v-if="!entries.length">
      <!-- Aligned with the name (as the description). -->
      <p class="ms-12 font-semibold text-tag-text">
        <slot />
      </p>
    </template>
    <template v-else>
      <!-- Two columns when the card is wide enough (not on mobile). -->
      <div class="grid grid-cols-1 gap-3 @sm:grid-cols-2">
        <div
          v-for="entry in entries"
          :key="entry.uri"
          class="group/item relative"
        >
          <!-- Shown on every entry in edit mode (not only on hover). -->
          <UButton
            v-if="editMode"
            class="absolute top-1.5 right-1.5 z-50"
            icon="i-lucide-x"
            size="xs"
            color="error"
            variant="subtle"
            :aria-label="`Retirer « ${greek.text(entry.word)} » ${favorites ? 'des favoris' : `de l'étiquette « ${tag.name} »`}`"
            @click="onDeleteEntry(entry)"
          />

          <EntryCard
            :entry="entry"
            link
            prefetch-on="visibility"
            :ui="{
              root: 'bg-default/75 ring-tag-300/50 hover:ring-tag-400 text-tag-text shadow-none',
              entry: 'mx-3 my-1.5 line-clamp-4',
            }"
          />
        </div>
      </div>
    </template>
  </UCard>
</template>
