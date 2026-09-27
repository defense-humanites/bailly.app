<script setup lang="ts">
  import type { ColorKey } from "~/enums";
  import { IdbTags, type IdbEntry, type IdbTagWithKey } from "~/idb";

  const bookmarksStore = useBookmarksStore();

  const props = defineProps<{
    /**
     * The tag that the bookmark group represents.
     */
    tag: Pick<IdbTagWithKey, "key" | "name"> & { color: ColorKey };
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
  const tagNameInput = useTemplateRef("tag-name-input");

  /**
   * The editable tag name.
   */
  const tagName = ref<string>(props.tag.name);
  /**
   * A boolean representing the state of the tag name input.
   */
  const isTagNameErrored = ref<boolean>(false);
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

  /**
   * Updates the tag properties.
   */
  const onUpdateTag = async (): Promise<void> => {
    isTagNameErrored.value = false;

    if (tagName.value === props.tag.name && tagColor.value === props.tag.color) return;

    const response = await bookmarksStore.updateTag(props.tag.key, {
      name: tagName.value,
      color: IdbTags.isColorKey(tagColor.value) ? tagColor.value : undefined,
    });

    if (response.state === "error") {
      isTagNameErrored.value = true;
      tagName.value = props.tag.name;
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
    void onUpdateTag();
  };

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

    // Process the tag name input if it's active, otherwise exit the edit mode.
    const input = tagNameInput.value?.inputRef as HTMLInputElement | undefined;
    if (input && input === document.activeElement) {
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
      root: 'bg-tag-200/50 border-tag-300/50',
      header: 'flex justify-between !px-3 pb-0',
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
        <div
          class="flex min-w-0 grow items-start text-tag-600"
        >
          <!-- Edit tag data -->
          <div
            v-show="editableEditMode"
            class="contents"
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
                    base: `rounded-l-full rounded-r-none ${isTagColorPopoverOpen ? 'bg-white/90 hover:bg-white/90 active:bg-white/90' : 'bg-white/60 hover:bg-white/90 active:bg-white/90'}`,
                  }"
                />
              </template>
            </TagColorPicker>

            <UInput
              ref="tag-name-input"
              v-model="tagName"
              aria-label="Nom de l'étiquette"
              size="xl"
              variant="none"
              class="min-w-0 grow"
              :class="{ 'animate-shake': isTagNameErrored }"
              :ui="{
                base: `shadow-none px-2 py-1 text-2xl font-bold rounded-l-none rounded-r-full bg-white/60 hover:bg-white/90 focus:bg-white/90 text-tag-600`,
              }"
            />
          </div>

          <!-- Display tag data -->
          <div
            v-show="!editableEditMode"
            class="contents"
          >
            <UIcon
              :name="icon"
              class="mx-2 mt-1 size-6 shrink-0"
            />
            <span class="ml-2 min-w-0 text-2xl font-bold wrap-break-word">{{ tagName }}</span>
          </div>
        </div>

        <!--
          Actions: the edit button, and in edit mode the tag deletion. Out of
          edit mode, they show on hover, on focus (they stay in the tab order:
          transparent, not hidden) and always on a touch screen (which has no
          hover).
        -->
        <span
          class="flex h-8 items-center gap-3"
          :class="editMode ? '' : 'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100'"
        >
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
            :ui="{ base: editMode ? 'text-white bg-tag-400 hover:bg-tag-400 ring-tag-300/50' : 'bg-white/50 hover:bg-white/90 active:bg-white/75 ring-tag-300/50 text-tag-600/75 hover:text-tag-600' }"
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
    </template>

    <!-- Content -->
    <template v-if="!entries.length">
      <p
        class="sm:ml-9 font-semibold text-tag-600"
      >
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
              root: 'bg-white/75 ring-tag-300/50 hover:ring-tag-400 text-tag-600 shadow-none',
              entry: 'mx-3 my-1.5 line-clamp-4',
            }"
          />
        </div>
      </div>
    </template>
  </UCard>
</template>
