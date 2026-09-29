<script setup lang="ts">
  import { colorNames } from "~/enums";
  import { IdbTags, type TagColorKey } from "~/idb";

  const emit = defineEmits<{
    (e: "popoverState", isOpen: boolean): void;
    (e: "pickColor", colorKey: TagColorKey): void;
  }>();

  const props = defineProps<{
    /**
     * The tag color key selected by the parent component.
     */
    selected?: TagColorKey;
    /**
     * The trigger's accessible name, completed with the selected color
     * (e.g. "Couleur de l'étiquette" → "Couleur de l'étiquette : bleu").
     */
    label?: string;
  }>();

  watch(
    /**
     * Updates the selected color key when `props.selected` changes.
     */
    () => props.selected,
    (newValue) => {
      if (newValue) selected.value = newValue;
    },
  );

  /**
   * A boolean that controls the state of the popover.
   */
  const open = ref<boolean>(false);
  /**
   * The color key selected by default.
   */
  const selectedDefault: TagColorKey = "Slate";
  /**
   * The currently selected color key.
   */
  const selected = ref<TagColorKey>(props.selected ?? selectedDefault);
  /**
   * The icon to display in the 'trigger' slot.
   */
  const icon: string = "i-bailly-tag-filled";
  /**
   * The trigger's accessible name.
   */
  const triggerLabel = computed(
    (): string => `${props.label ?? "Couleur"} : ${colorNames[selected.value]}`,
  );

  watch(open, (open) => {
    emit("popoverState", open);
  });

  /**
   * Updates and emits the selected color key.
   * @param tagColorKey A color that can be associated with a tag.
   */
  const pickColor = (tagColorKey: TagColorKey): void => {
    open.value = false;
    selected.value = tagColorKey;
    emit("pickColor", tagColorKey);
  };
</script>

<template>
  <UPopover
    v-model:open="open"
    :arrow="{ rounded: true, width: 16, height: 8 }"
    :ui="{ content: 'z-99 p-3', arrow: 'fill-(--ui-bg)' }"
  >
    <!--
      The trigger must carry `data-tag-color="color"` for `class` to apply,
      and `aria-label="label"`.
    -->
    <slot
      name="trigger"
      :icon="icon"
      :color="selected"
      :label="triggerLabel"
      class="text-tag-600"
    >
      <UButton
        :icon="icon"
        :aria-label="triggerLabel"
        color="neutral"
        variant="outline"
        :data-tag-color="selected"
        class="text-tag-600"
        :ui="{ base: 'shadow-none' }"
      />
    </slot>

    <template #content>
      <div class="grid grid-cols-4 gap-1.5">
        <button
          v-for="colorKey in IdbTags.colorKeys"
          :key="colorKey"
          type="button"
          :data-tag-color="colorKey"
          class="p-3 rounded-full border transition-colors cursor-pointer"
          :class="colorKey === selected
            ? 'bg-tag-500 border-tag-500'
            : 'bg-tag-200 hover:bg-tag-300 border-tag-300 hover:border-tag-400'"
          :aria-label="colorNames[colorKey]"
          :aria-pressed="colorKey === selected"
          @click="pickColor(colorKey)"
        />
      </div>
    </template>
  </UPopover>
</template>
