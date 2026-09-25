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
   * A boolean representing whether the user can edit the tag data.
   */
  const editMode = ref<boolean>(false);

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

  const onDeleteTag = async (): Promise<void> => {
    await bookmarksStore.removeTag(props.tag.key);
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

  const editableHasNoEntries = computed(
    (): boolean => props.editable && !props.entries.length,
  );

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
   * Exits the edit mode when clicking outside the bookmark group.
   */
  onClickOutside(bookmarkGroup, () => {
    if (editableEditMode.value && !isTagColorPopoverOpen.value) exitEditMode();
  });

  /**
   * Adds shortcuts to exit the edit mode/blur the tag name input.
   */
  onKeyStroke(["Enter", "Escape"], () => {
    // Process shortcuts only if the edit mode is set and the tag color popover isn't open.
    if (!editableEditMode.value || isTagColorPopoverOpen.value) return;

    // Process the tag name input if it's active, otherwise exit the edit mode.
    const input = tagNameInput.value?.inputRef as HTMLInputElement | undefined;
    if (input && input === document.activeElement) {
      input.blur();
      void onUpdateTag();
    } else {
      exitEditMode();
    }
  });
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
      body: '!p-3 text-default',
    }"
  >
    <!-- Tag data and actions -->
    <template #header>
      <div class="flex w-full h-8">
        <div
          class="flex grow items-center text-tag-600"
        >
          <!-- Edit tag data -->
          <div
            v-show="editableEditMode"
            class="contents"
          >
            <TagColorPicker
              :selected="IdbTags.isColorKey(tagColor) ? tagColor : undefined"
              @popover-state="(isOpen) => (isTagColorPopoverOpen = isOpen)"
              @pick-color="onPickColor"
            >
              <template #trigger="trigger">
                <UButton
                  :icon="trigger.icon"
                  :data-tag-color="trigger.color"
                  size="xl"
                  variant="ghost"
                  color="neutral"
                  :class="trigger.class"
                  :ui="{
                    base: `shadow-none rounded-l-full rounded-r-none ${isTagColorPopoverOpen ? 'bg-white/90 hover:bg-white/90 active:bg-white/90' : 'bg-white/60 hover:bg-white/90 active:bg-white/90'}`,
                  }"
                />
              </template>
            </TagColorPicker>

            <UInput
              ref="tag-name-input"
              v-model="tagName"
              size="xl"
              variant="none"
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
              class="mx-2 size-6"
            />
            <span class="ml-2 text-2xl font-bold">{{ tagName }}</span>
          </div>
        </div>

        <!-- Actions -->
        <span
          class="flex items-center gap-3 group-hover:visible"
          :class="[editMode ? '' : 'invisible']"
        >
          <UButton
            icon="i-lucide-pencil"
            size="sm"
            variant="subtle"
            color="neutral"
            :ui="{ base: editMode ? 'text-white bg-tag-400 hover:bg-tag-400 ring-tag-300/50' : 'bg-white/50 hover:bg-white/90 active:bg-white/75 ring-tag-300/50 text-tag-600' }"
            @click="toggleEditMode"
          />
          <UButton
            v-if="editableHasNoEntries"
            icon="i-lucide-x"
            size="sm"
            color="error"
            :variant="editMode ? 'solid' : 'subtle'"
            @click="onDeleteTag"
          />
        </span>
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
      <div class="grid grid-cols-2 gap-3">
        <div
          v-for="entry in entries"
          :key="entry.uri"
          class="group/item relative"
        >
          <UButton
            class="absolute top-1.5 right-1.5 z-50 invisible"
            :class="[editMode ? 'group-hover/item:visible' : '']"
            icon="i-lucide-x"
            size="xs"
            color="error"
            variant="subtle"
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
