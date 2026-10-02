<script setup lang="ts">
  import type { ColorKey } from "~/enums";
  import { IdbTags, type IdbEntry, type IdbTagWithKey } from "~/idb";
  import { comparableTagName } from "~/idb/merge";

  const bookmarksStore = useBookmarksStore();

  const props = defineProps<{
    /**
     * The tag that the bookmark group represents.
     */
    tag: Pick<IdbTagWithKey, "key" | "name"> & Partial<Pick<IdbTagWithKey, "description" | "pinnedAt">> & { color: ColorKey };
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
  const descriptionLength = computed(() => Array.from(tagDescription.value).length);
  const descriptionLeft = computed(() => IdbTags.descriptionMaxLength - descriptionLength.value);
  /**
   * Whether the description field has the focus (its keys and count show).
   */
  const isDescriptionFocused = ref(false);
  /**
   * Why the description could not be saved (Enter), until it changes.
   */
  const descriptionFailure = ref<string>();
  watch(tagDescription, () => descriptionFailure.value = undefined);
  const descriptionErrorId = useId();
  const descriptionHintId = useId();
  /**
   * The card is a group named by its name (a heading) and described by its
   * description, read with it by screen readers.
   */
  const nameHeadingId = useId();
  const descriptionId = useId();

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
   * Why the name typed could not be saved (Enter in its field), until it
   * changes.
   */
  const nameFailure = ref<string>();
  watch(tagName, () => nameFailure.value = undefined);

  /**
   * Why the name typed cannot be used, as it is typed: taken by another tag
   * (case and diacritics ignored, as `IdbTags` does) or reserved.
   */
  const nameConflict = computed((): string | undefined => {
    const name = comparableTagName(tagName.value.trim());
    if (!name) return undefined;
    if (name === "favoris") return "Ce nom est réservé à la liste des favoris.";
    const homonym = bookmarksStore.tags.find(tag => tag.key !== props.tag.key && comparableTagName(tag.name) === name);
    return homonym && `L'étiquette « ${homonym.name} » existe déjà.`;
  });

  /**
   * The error shown on the name field (in edit mode), in a bubble under it.
   */
  const nameError = computed((): string | undefined =>
    editableEditMode.value ? nameFailure.value ?? nameConflict.value : undefined);
  const nameErrorId = useId();

  /**
   * Saves the name typed (Enter in its field): an error is shown on the
   * field, which keeps the focus and the name; otherwise, it is left.
   */
  const onSaveName = async (input: HTMLInputElement): Promise<void> => {
    if (!tagName.value.trim()) nameFailure.value = "Une étiquette doit être nommée.";
    if (nameError.value) return;
    if (tagName.value === props.tag.name) {
      input.blur();
      return;
    }
    const response = await bookmarksStore.updateTag(
      props.tag.key,
      { name: tagName.value, description: props.tag.description, color: IdbTags.isColorKey(props.tag.color) ? props.tag.color : undefined },
      { quiet: true },
    );
    if (response.state === "error") nameFailure.value = response.message;
    else input.blur();
  };

  const toast = useToast();

  /**
   * Whether the description is being saved (Enter): meanwhile, nothing else
   * saves the tag, and Escape leaves the edit mode (as once it is saved)
   * rather than cancelling what is being saved.
   */
  let savingDescription = false;

  /**
   * Updates the tag properties (leaving a field or the edit mode, picking a
   * color): a failure is reported by a toast, and the stored values come
   * back. A description removed (emptied, or by its clear button) is told
   * by a toast, which can bring it back.
   */
  const onUpdateTag = async (): Promise<void> => {
    if (savingDescription) return;
    if (
      tagName.value === props.tag.name
      && tagColor.value === props.tag.color
      && tagDescription.value.trim() === (props.tag.description ?? "")
    ) return;

    const removedDescription = props.tag.description && !tagDescription.value.trim() ? props.tag.description : undefined;
    const response = await bookmarksStore.updateTag(props.tag.key, {
      name: tagName.value,
      description: tagDescription.value,
      color: IdbTags.isColorKey(tagColor.value) ? tagColor.value : undefined,
    });

    if (response.state === "error") {
      tagName.value = props.tag.name;
      tagDescription.value = props.tag.description ?? "";
      tagColor.value = props.tag.color;
    } else if (removedDescription) {
      toast.add({
        title: "Description supprimée",
        icon: "i-lucide-circle-check",
        color: "success",
        actions: [{
          label: "Annuler",
          color: "neutral",
          variant: "outline",
          onClick: () => {
            void bookmarksStore.updateTag(props.tag.key, {
              name: props.tag.name,
              description: removedDescription,
              color: IdbTags.isColorKey(props.tag.color) ? props.tag.color : undefined,
            });
          },
        }],
      });
    }
  };

  /**
   * Saves the description (Enter in its field): a failure is told on the
   * field, which keeps the text and the focus; otherwise, it is left.
   */
  async function onSaveDescription(field: HTMLTextAreaElement): Promise<void> {
    if (tagDescription.value.trim() === (props.tag.description ?? "")) {
      field.blur();
      return;
    }
    const removed = Boolean(props.tag.description) && !tagDescription.value.trim();
    if (removed) {
      // As the clear button (with its toast).
      field.blur();
      return;
    }
    savingDescription = true;
    const response = await bookmarksStore.updateTag(
      props.tag.key,
      { name: props.tag.name, description: tagDescription.value, color: IdbTags.isColorKey(props.tag.color) ? props.tag.color : undefined },
      { quiet: true },
    );
    savingDescription = false;
    if (response.state === "error") descriptionFailure.value = response.message;
    else field.blur();
  }

  /**
   * Leaving the description field saves it (cf. `onUpdateTag`), unless a
   * failure is told on it.
   */
  function onDescriptionBlur(): void {
    isDescriptionFocused.value = false;
    if (!descriptionFailure.value) void onUpdateTag();
  }

  /**
   * Removes the description (its field's clear button).
   */
  const clearDescription = (): void => {
    tagDescription.value = "";
    isAddingDescription.value = false;
    void onUpdateTag();
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

  const onPickColor = (colorKey: ColorKey | undefined): void => {
    if (!colorKey) return;
    tagColor.value = colorKey;
    void onUpdateTag();
  };

  /**
   * The group icon: a custom one, a pin on a pinned tag (cf. `isPinned`), or
   * a (filled) tag.
   */
  const icon = computed((): string => {
    if (props.customIcon) return props.customIcon;
    return props.editable && props.tag.pinnedAt !== undefined ? "i-bailly-pin-filled" : "i-bailly-tag-filled";
  });

  const editableEditMode = computed(
    (): boolean => props.editable && editMode.value,
  );

  /**
   * Whether the group is the active tag (the one an entry's toolbar adds it
   * to in one click).
   */
  const isActive = computed((): boolean => props.editable && bookmarksStore.currentTagKey === props.tag.key);

  /**
   * Whether the tag is pinned (it comes first, whatever the sorting).
   */
  const isPinned = computed((): boolean => props.editable && props.tag.pinnedAt !== undefined);

  /**
   * Pins the tag, or unpins it. A pinned tag moves to the top: the page
   * follows it (smoothly, unless reduced motion), the user caring for it,
   * and points it out as from the table of contents (`highlightCard`); an
   * unpinned one, given up, is left to go.
   */
  async function togglePin(): Promise<void> {
    const pinning = !isPinned.value;
    const result = await bookmarksStore.pinTag(props.tag.key, pinning);
    if (!pinning || result.state !== "success") return;
    await nextTick();
    const element = unrefElement(bookmarkGroup);
    if (!(element instanceof HTMLElement)) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
    highlightCard(element);
  }

  /**
   * Out of edit mode, the actions show on hover, on focus (they stay in the
   * tab order: transparent, not hidden) and always on a touch screen (which
   * has no hover).
   */
  const revealed = computed((): string =>
    editMode.value ? "" : "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100");

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
      if (savingDescription) {
        if (event.key === "Escape") exitEditMode();
        return;
      }
      if (event.key === "Enter") {
        void onSaveDescription(field);
        return;
      }
      // Escape cancels: the description stored comes back (and an added one
      // goes); leaving the field then changes nothing.
      tagDescription.value = props.tag.description ?? "";
      if (!props.tag.description) isAddingDescription.value = false;
      field.blur();
    } else if (input && input === document.activeElement) {
      event.preventDefault();
      if (event.key === "Enter") {
        void onSaveName(input);
        return;
      }
      // Escape cancels: the name stored comes back.
      tagName.value = props.tag.name;
      input.blur();
      void onUpdateTag();
    } else if (event.key === "Escape" || !(event.target as Element | null)?.closest("button, a")) {
      // `Enter` on a button or a link activates it instead (e.g. the edit
      // button, which would otherwise exit the edit mode and enter it again).
      exitEditMode();
    }
  });

  /**
   * How the entries are shown (cf. `useBookmarksDisplay`): their excerpts, or
   * their headwords alone.
   */
  const display = useBookmarksDisplay();
  const headwordsOnly = computed((): boolean => display.value === "headwords");

  /**
   * A long group is collapsed: it shows its first `collapsedCount` entries
   * (three rows on two columns of excerpts, eight of headwords), and a
   * button reveals the others, from the next entry on (to save room, even
   * if it hides only one).
   * @remarks The cards keep a bounded height: on a grid (without masonry),
   * a row of cards takes the height of the highest one.
   */
  const collapsedCount = computed((): number => (headwordsOnly.value ? 16 : 6));
  const collapsible = computed((): boolean => props.entries.length > collapsedCount.value);
  /**
   * Whether all the entries of a collapsible group are shown (for the visit:
   * in memory only).
   */
  const expanded = ref<boolean>(false);
  const shownEntries = computed((): IdbEntry[] =>
    collapsible.value && !expanded.value ? props.entries.slice(0, collapsedCount.value) : props.entries,
  );
  const hiddenCount = computed((): number => props.entries.length - collapsedCount.value);

  /**
   * The quota of entries (cf. `utils/quotas.ts`), told under the entries
   * near it.
   */
  const { tagMaxItems } = useRuntimeConfig().public;
  const showsQuota = computed((): boolean => quotaShown(props.entries.length, tagMaxItems, "entries"));
  const nearQuota = computed((): boolean => quotaNear(props.entries.length, tagMaxItems));
  const quotaText = computed((): string => (props.entries.length >= tagMaxItems
    ? `Liste pleine : ${tagMaxItems} entrées au plus.`
    : `${props.entries.length} entrées sur ${tagMaxItems} au plus.`));

  const entryList = useTemplateRef<HTMLElement>("entry-list");
  const entryListId = useId();
  const expandToggle = useTemplateRef<{ $el: HTMLElement }>("expand-toggle");

  /**
   * Shows or hides the entries beyond the first ones. Once expanded from the
   * keyboard, the focus goes to the first entry revealed (where the button
   * was); once collapsed, the button is brought back into view if it went
   * above it (the card shrank under the reader).
   */
  const toggleExpanded = async (event: MouseEvent): Promise<void> => {
    expanded.value = !expanded.value;
    await nextTick();
    if (expanded.value) {
      // `detail` is 0 for a click from the keyboard (Enter, Space).
      if (event.detail === 0) {
        entryList.value?.children.item(collapsedCount.value)?.querySelector("a")?.focus({ preventScroll: true });
      }
    } else {
      expandToggle.value?.$el.scrollIntoView({ block: "nearest" });
    }
  };

  // Greek may be transliterated (a preference).
  const greek = useGreek();
</script>

<template>
  <UCard
    ref="bookmark-group"
    role="group"
    :aria-labelledby="nameHeadingId"
    :aria-describedby="tagDescription && !showsDescriptionField ? descriptionId : undefined"
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
          <div
            class="col-start-1 row-start-1 flex min-w-0 items-start"
            :class="{ invisible: editableEditMode }"
          >
            <UIcon
              :name="icon"
              class="mx-2 mt-1 size-6 shrink-0"
            />
            <span
              :id="nameHeadingId"
              role="heading"
              aria-level="2"
              class="ml-2 min-w-0 grow py-0.5 pe-2 text-xl/7 font-bold wrap-break-word md:py-0 md:text-2xl/8"
            >{{ tag.name }}<!--
              The active tag, marked after its name (as in an entry's panel).
            --><UBadge
              v-if="isActive"
              label="active"
              color="neutral"
              variant="soft"
              size="sm"
              class="ms-2 -translate-y-0.5 bg-default/60 align-middle font-medium text-tag-text ring ring-inset ring-tag-300/60"
            /></span>
          </div>

          <!-- Edit tag data -->
          <div
            v-show="editableEditMode"
            class="col-start-1 row-start-1 flex min-w-0 items-start"
          >
            <!--
              The color and the name, one field on one line (Enter validates),
              in the name's text: its height comes from the same padding and
              line height as the name (32 px), rather than from a fixed
              height, in which each browser centres the text its own way.
              Its ring goes round the whole field, color included: the focus
              ring, whichever part has the keyboard focus (which part shows by
              its lighter background), and the ring of a name that cannot be
              used, told as for a new tag (cf. `CreateTag`): a red ring, the
              message in a bubble under the field and in a live region.
            -->
            <UPopover
              :open="!!nameError"
              :dismissible="false"
              :content="{ side: 'bottom', align: 'start', sideOffset: 6, onOpenAutoFocus: (event: Event) => event.preventDefault(), onCloseAutoFocus: (event: Event) => event.preventDefault() }"
              :ui="{ content: 'px-3 py-2 text-sm text-error' }"
            >
              <template #anchor>
                <div
                  class="flex min-w-0 grow rounded-full"
                  :class="nameError ? 'ring-2 ring-error' : 'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-tag-300'"
                >
                  <TagColorPicker
                    v-model:open="isTagColorPopoverOpen"
                    :model-value="IdbTags.isColorKey(tagColor) ? tagColor : undefined"
                    label="Couleur de l'étiquette"
                    @update:model-value="onPickColor"
                  >
                    <template #trigger="{ icon: triggerIcon, attrs }">
                      <UButton
                        v-bind="attrs"
                        :icon="triggerIcon"
                        size="xl"
                        variant="ghost"
                        color="neutral"
                        :ui="{
                          base: `h-8 w-10 justify-center rounded-l-full rounded-r-none focus-visible:outline-none focus-visible:bg-default/90 ${isTagColorPopoverOpen ? 'bg-default/90 hover:bg-default/90 active:bg-default/90' : 'bg-default/60 hover:bg-default/90 active:bg-default/90'}`,
                        }"
                      />
                    </template>
                  </TagColorPicker>
                  <input
                    ref="tag-name-input"
                    v-model="tagName"
                    type="text"
                    aria-label="Nom de l'étiquette"
                    :aria-describedby="nameErrorId"
                    :aria-invalid="!!nameError"
                    :maxlength="IdbTags.nameMaxLength"
                    class="min-w-0 grow rounded-r-full bg-default/60 px-2 py-0.5 text-xl/7 font-bold text-tag-text hover:bg-default/90 focus:bg-default/90 focus:outline-none md:py-0 md:text-2xl/8"
                  >
                </div>
              </template>
              <template #content>
                <p aria-hidden="true">
                  {{ nameError }}
                </p>
              </template>
            </UPopover>
            <span
              :id="nameErrorId"
              role="status"
              class="sr-only"
            >{{ nameError }}</span>
          </div>
        </div>

        <!--
          Actions: out of edit mode, the choice of the active tag (on the
          other tags) and the pin (pressed on a pinned tag, whose icon is a
          pin); in edit mode, in their place, adding a description (none
          yet) and the tag deletion; last, in the corner and at the same place in both modes,
          the edit button, which toggles the mode. Out of edit mode, they show
          on hover, on focus and on a touch screen (`revealed`).
        -->
        <!--
          Their place is reserved for three buttons on a tag (two on the
          favorites): the name wraps alike in both modes.
        -->
        <span
          class="flex h-8 shrink-0 items-center justify-end gap-3"
          :class="editable ? 'min-w-[7.5rem]' : 'min-w-[4.75rem]'"
        >
          <UTooltip
            v-if="editable && !editMode && !isActive"
            text="Rendre active"
          >
            <UButton
              icon="i-lucide-circle-dot"
              size="sm"
              variant="subtle"
              color="neutral"
              :class="revealed"
              :aria-label="`Rendre active ${groupName}`"
              :ui="{ base: 'bg-default/50 hover:bg-default/90 active:bg-default/75 ring-tag-300/50 text-tag-text/75 hover:text-tag-text' }"
              @click="bookmarksStore.setCurrentTag(tag.key)"
            />
          </UTooltip>
          <UTooltip
            v-if="editable && !editMode"
            :text="isPinned ? 'Désépingler' : 'Épingler en tête'"
          >
            <UButton
              icon="i-lucide-pin"
              size="sm"
              variant="subtle"
              color="neutral"
              :aria-label="`Épingler ${groupName}`"
              :aria-pressed="isPinned"
              :class="revealed"
              :ui="{ base: isPinned ? 'bg-default/90 hover:bg-default active:bg-default/75 ring-tag-300 text-tag-text' : 'bg-default/50 hover:bg-default/90 active:bg-default/75 ring-tag-300/50 text-tag-text/75 hover:text-tag-text' }"
              @click="togglePin"
            />
          </UTooltip>
          <UTooltip
            v-if="editableEditMode && !showsDescriptionField"
            text="Ajouter une description"
          >
            <UButton
              icon="i-lucide-text-cursor-input"
              size="sm"
              variant="subtle"
              color="neutral"
              aria-label="Ajouter une description"
              :ui="{ base: 'bg-default/50 hover:bg-default/90 active:bg-default/75 ring-tag-300/50 text-tag-text/75 hover:text-tag-text' }"
              @click="addDescription"
            />
          </UTooltip>
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
            :class="revealed"
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
        field with the same text, spacing and size (text, never HTML), with a
        button to remove it. The card doesn't grow in edit mode (with
        `grid-lanes`, the cards after it could change columns): a description
        is added from the actions.
      -->
      <p
        v-if="tagDescription && !showsDescriptionField"
        :id="descriptionId"
        class="ms-10 mt-1 px-2 py-1 text-sm/5 whitespace-pre-line wrap-break-word text-tag-text"
        v-text="tagDescription"
      />
      <!--
        While it has the focus, the keys (Enter saves, Shift+Enter goes to the
        line) and the count of its characters show in a bubble under it (over
        the page: the card doesn't grow). A description that cannot be saved
        (Enter) is told in its place, as for a name: a red ring, the message
        in the bubble and in a live region; the field keeps the text and the
        focus.
      -->
      <div
        v-else-if="showsDescriptionField"
        class="ms-10 mt-1"
      >
        <UPopover
          :open="!!descriptionFailure || isDescriptionFocused"
          :dismissible="false"
          :content="{ side: 'bottom', align: 'start', sideOffset: 6, onOpenAutoFocus: (event: Event) => event.preventDefault(), onCloseAutoFocus: (event: Event) => event.preventDefault() }"
          :ui="{ content: 'px-3 py-2 text-sm' }"
        >
          <template #anchor>
            <div class="relative">
              <textarea
                ref="description-input"
                v-model="tagDescription"
                rows="1"
                :maxlength="IdbTags.descriptionMaxLength"
                aria-label="Description de l'étiquette"
                :aria-describedby="`${descriptionErrorId} ${descriptionHintId}`"
                :aria-invalid="!!descriptionFailure"
                placeholder="Description"
                class="block w-full resize-none overflow-hidden rounded-lg bg-default/60 py-1 ps-2 pe-8 text-sm/5 text-tag-text placeholder:text-tag-text/60 hover:bg-default/90 focus:bg-default/90 focus:outline-none focus-visible:ring-2"
                :class="descriptionFailure ? 'ring-2 ring-error focus-visible:ring-error' : 'focus-visible:ring-tag-300'"
                @focus="isDescriptionFocused = true"
                @blur="onDescriptionBlur"
              />
              <UTooltip text="Supprimer la description">
                <UButton
                  icon="i-lucide-x"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  aria-label="Supprimer la description"
                  class="absolute end-1 top-1 text-tag-text/75 hover:bg-default hover:text-tag-text"
                  @click="clearDescription"
                />
              </UTooltip>
            </div>
          </template>
          <template #content>
            <p
              v-if="descriptionFailure"
              aria-hidden="true"
              class="text-error"
            >
              {{ descriptionFailure }}
            </p>
            <p
              v-else
              aria-hidden="true"
              class="flex items-center gap-x-1.5 text-xs text-muted"
            >
              <span class="flex items-center gap-1"><UKbd
                value="enter"
                size="sm"
              /> pour enregistrer</span>
              <span>·</span>
              <span class="flex items-center gap-1"><UKbd
                value="shift"
                size="sm"
              /><UKbd
                value="enter"
                size="sm"
              /> pour aller à la ligne</span>
              <span
                class="ms-3 tabular-nums"
                :class="{ 'font-semibold text-highlighted': descriptionLeft < 30 }"
              >{{ descriptionLength }}/{{ IdbTags.descriptionMaxLength }}</span>
            </p>
          </template>
        </UPopover>
        <span
          :id="descriptionErrorId"
          role="status"
          class="sr-only"
        >{{ descriptionFailure }}</span>
        <!-- The keys and the count, for screen readers. -->
        <span
          :id="descriptionHintId"
          class="sr-only"
        >Entrée pour enregistrer, Maj+Entrée pour aller à la ligne ; {{ descriptionLength }} caractères sur {{ IdbTags.descriptionMaxLength }} au plus.</span>
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
      <!--
        The headwords alone: on two columns (even on mobile: they are short),
        each a link in the tag's colors, its excerpt in a tooltip; in edit
        mode, its removal button at its end.
      -->
      <ul
        v-if="headwordsOnly"
        :id="entryListId"
        ref="entry-list"
        class="grid grid-cols-2 gap-2"
      >
        <li
          v-for="entry in shownEntries"
          :key="entry.uri"
          class="relative flex min-w-0"
        >
          <UTooltip
            :text="greek.text(entry.excerpt)"
            :disabled="!entry.excerpt || editMode"
            :delay-duration="500"
            :content="{ side: 'top' }"
            :ui="{ content: 'max-w-80 h-auto', text: 'line-clamp-4 whitespace-normal font-serif' }"
          >
            <NuxtLink
              :to="entryRoute(entry.uri)"
              :lang="greek.lang.value"
              class="block min-w-0 grow truncate rounded-lg bg-default/75 px-3 py-1 font-serif text-[0.96875rem]/6 font-bold text-tag-text ring ring-tag-300/50 ring-inset transition-colors hover:ring-tag-400 focus-visible:outline-2 focus-visible:outline-tag-400"
              :class="{ 'pe-9': editMode }"
            >{{ greek.text(entry.word) }}</NuxtLink>
          </UTooltip>
          <UButton
            v-if="editMode"
            class="absolute end-1 top-1/2 -translate-y-1/2"
            icon="i-lucide-x"
            size="xs"
            color="error"
            variant="subtle"
            :aria-label="`Retirer « ${greek.text(entry.word)} » ${favorites ? 'des favoris' : `de l'étiquette « ${tag.name} »`}`"
            @click="onDeleteEntry(entry)"
          />
        </li>
      </ul>
      <!-- Two columns when the card is wide enough (not on mobile). -->
      <div
        v-else
        :id="entryListId"
        ref="entry-list"
        class="grid grid-cols-1 gap-3 @sm:grid-cols-2"
      >
        <div
          v-for="entry in shownEntries"
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

          <!--
            The excerpts follow the reading font, not its size nor its weight
            (as the search results and the history): the normal size and
            weight, set on the reading variables (the arrow follows them).
          -->
          <EntryCard
            :entry="entry"
            link
            prefetch-on="visibility"
            :ui="{
              root: 'bg-default/75 ring-tag-300/50 hover:ring-tag-400 text-tag-text shadow-none',
              entry: 'mx-3 my-1.5 line-clamp-4 [--reading-font-size:0.96875rem] [--reading-font-weight:400]',
            }"
          />
        </div>
      </div>
      <!--
        Under the entries, on the width of the list, in the tag's colors (as
        the card's other buttons), rounded as the entries' cards. It clears the header when brought back
        into view.
      -->
      <UButton
        v-if="collapsible"
        ref="expand-toggle"
        :label="expanded ? 'Réduire' : hiddenCount === 1 ? 'Voir l’autre' : `Voir les ${hiddenCount} autres`"
        :trailing-icon="expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        :aria-expanded="expanded"
        :aria-controls="entryListId"
        variant="subtle"
        color="neutral"
        block
        class="mt-3 scroll-mt-[calc(var(--header-bottom)+var(--toc-height,0px)+0.75rem)]"
        :ui="{ base: 'rounded-lg bg-default/50 hover:bg-default/90 active:bg-default/75 ring-tag-300/50 text-tag-text/75 hover:text-tag-text' }"
        @click="toggleExpanded"
      />
      <p
        v-if="showsQuota"
        class="mt-2 text-end text-xs text-tag-text"
        :class="nearQuota ? 'font-semibold' : 'opacity-75'"
      >
        {{ quotaText }}
      </p>
    </template>
  </UCard>
</template>
