<script setup lang="ts">
  import type { IconProps } from "@nuxt/ui";
  import { Color } from "~/enums";
  import type { IdbEntry, IdbTagWithKey } from "~/idb";
  import type { TagColorKey } from "~/idb/IdbTags";
  import { TailwindColorClasses } from "~/TailwindColorClasses";

  const bookmarksStore = useBookmarksStore();

  const props = defineProps<{
    /**
     * The tag that the bookmark group represents.
     */
    tag: Pick<IdbTagWithKey, "key" | "name" | "color">;
    /**
     * The entries that are part of the group.
     */
    entries: IdbEntry[];
    /**
     * An icon that overrides the default tag icon.
     */
    customIcon?: IconProps["name"];
    /**
     * Style variants affecting the appearance of the card.
     * @remarks Defaults to `translucent`.
     */
    variant?: "solid" | "translucent";
    /**
     * If enabled, make the tag data and its related entries editable.
     */
    editable?: boolean;
  }>();

  onMounted(() => {
    tagName.value = props.tag.name;
  });

  const bookmarkGroup = useTemplateRef("bookmark-group");
  const tagNameInput = useTemplateRef("tag-name-input");

  /**
   * Exists the edit mode when clicking outside the bookmark group.
   */
  onClickOutside(bookmarkGroup, () => {
    if (editableEditMode && !isTagColorPopoverOpen.value) exitEditMode();
  });

  /**
   * Adds shortcuts to exit the edit mode/blur the tag name input.
   */
  onKeyStroke(["Enter", "Escape"], () => {
    // Process shortcuts only if the edit mode is set and the tag color popover isn't open.
    if (editMode.value && !isTagColorPopoverOpen.value) {
      // Process the tag name input if it's active, otherwise exit the edit mode.
      if (tagNameInput.value?.inputRef === document.activeElement) {
        tagNameInput.value.inputRef?.blur();
        onUpdateTag();
      } else {
        exitEditMode();
      }
    }
  });
  /**
   * A model to handle the tag name change.
   */
  const tagName = defineModel<string>({ default: "" });
  /**
   * A boolean representing the state of the tag name input.
   */
  const isTagNameErrored = ref<boolean>(false);
  /**
   * The editable tag color.
   */
  const tagColor = ref<TagColorKey>(props.tag.color);
  /**
   * A boolean representing whether the tag color popover is open.
   */
  const isTagColorPopoverOpen = ref<boolean>(false);
  /**
   * A boolean representing whether the user can edit the tag data.
   */
  const editMode = ref<boolean>(false);

  /**
   * Updates the tag properties.
   */
  const onUpdateTag = async (): Promise<void> => {
    isTagNameErrored.value = false;

    if (tagName.value !== props.tag.name || tagColor.value !== props.tag.color) {
      const response = await bookmarksStore.updateTag(props.tag.key, {
        name: tagName.value,
        color: tagColor.value,
      });

      switch (response.state) {
        case "success":
          break;
        case "error":
          isTagNameErrored.value = true;
          tagName.value = props.tag.name;
          break;
      }
    }
  };

  const onDeleteTag = async (): Promise<void> => {
    await bookmarksStore.removeTag(props.tag.key);
  };

  const onDeleteEntry = async (entry: IdbEntry): Promise<void> => {
    // @fixme: find a better way to differentiate the favorites.
    if (props.tag.key === -1) {
      await bookmarksStore.unstarEntry(entry.uri);
    } else {
      await bookmarksStore.untagEntry(entry.uri, props.tag.key);
    }
  };

  /**
   * Returns the default tag icon or a custom icon (in that case, make sure the
   * icon uses its `solid` variant).
   */
  const icon = computed(() => {
    if (props.customIcon) {
      return !props.customIcon.endsWith("-solid")
        ? props.customIcon + "-solid"
        : props.customIcon;
    }
    return "i-heroicons-tag-solid";
  });

  /** Returns Tailwind color classes. */
  const color = computed(
    () =>
      new TailwindColorClasses(Color[tagColor.value], {
        variant: "translucent",
      }),
  );

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
    onUpdateTag();
  };

  const toggleEditMode = (): void => {
    editMode.value ? exitEditMode() : enterEditMode();
  };
</script>

<template>
  <UCard
    ref="bookmark-group"
    class="group"
    variant="bookmarkGroup"
    :ui="{
      root: color.classes(['bg', 'border']),
      header: 'flex justify-between !px-3 pb-0',
      body: '!p-3 text-default',
    }"
  >
    <!-- Tag data and actions -->
    <template #header>
      <div class="flex w-full h-8">
        <div
          class="flex grow items-center"
          :class="color.text()"
        >
          <!-- Edit tag data -->
          <div
            v-show="editableEditMode"
            class="contents"
          >
            <TagColorPicker
              ref="tag-color-picker"
              :selected="tagColor"
              @popover-state="(isOpen) => (isTagColorPopoverOpen = isOpen)"
              @pick-color="
                (colorKey) => {
                  tagColor = colorKey;
                  onUpdateTag();
                }
              "
            >
              <template #trigger="props">
                <UButton
                  :icon="props.icon"
                  size="xl"
                  variant="ghost"
                  color="neutral"
                  :class="props.class"
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
                base: `shadow-none px-2 py-1 text-2xl font-bold rounded-l-none rounded-r-full bg-white/60 hover:bg-white/90 focus:bg-white/90 ${color.text()}`,
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
            icon="i-heroicons-pencil"
            size="sm"
            variant="subtle"
            color="neutral"
            :ui="{ base: editMode ? `text-white ${color.classes([{ 'bg': { shade: 400, variant: 'solid' }, 'hover:bg': { shade: 400, variant: 'solid' } }, 'ring'])}` : `bg-white/50 hover:bg-white/90 active:bg-white/75 ${color.classes(['ring', 'text'])}` }"
            @click="toggleEditMode"
          />
          <UButton
            v-if="editableHasNoEntries"
            icon="i-heroicons-x-mark"
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
        class="sm:ml-9 font-semibold"
        :class="color.text()"
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
            icon="i-heroicons-x-mark"
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
              root: `bg-white/75 ${color.classes([
                'ring',
                'hover:ring',
                'text',
              ])} shadow-none`,
              entry: 'mx-3 my-1.5 line-clamp-4',
            }"
          />
        </div>
      </div>
    </template>
  </UCard>
</template>
