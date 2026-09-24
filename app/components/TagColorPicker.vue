<script setup lang="ts">
  import { Color } from "~/enums";
  import { IdbTags, type TagColorKey } from "~/idb/IdbTags";
  import { TailwindColorClasses } from "~/TailwindColorClasses";

  const emit = defineEmits<{
    (e: "popoverState", isOpen: boolean): void;
    (e: "pickColor", colorKey: TagColorKey): void;
  }>();

  const props = defineProps<{
    /**
     * The tag color key selected by the parent component.
     */
    selected?: TagColorKey;
  }>();

  watch(
    /**
     * Updates the selected color key when `props.selected` changes.
     */
    () => props.selected,
    (newValue) => {
      if (newValue) selected.value = newValue;
    }
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
  const icon: string = "i-heroicons-tag-solid";
  /**
   * Gets the Tailwind color classes for each defined color key.
   */
  const colors = IdbTags.colorKeys.map((key) => {
    const colorClasses = new TailwindColorClasses(Color[key]);
    return {
      key: key,
      base: colorClasses.classes(["bg", "hover:bg", "border", "hover:border"]),
      selected: colorClasses.classes([
        { bg: { shade: 500 }, border: { shade: 500 } },
      ]),
      colorClasses: colorClasses,
    };
  });
  /**
   * Gets the color classes for the currently selected color.
   */
  const selectedColorClasses = computed(() =>
    colors.find((item) => item.key === selected.value)?.colorClasses
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
  <UPopover v-model:open="open" :arrow="{ rounded: true, width: 16, height: 8 }"
    :ui="{ content: 'z-99 p-3', arrow: 'fill-white' }">
    <slot name="trigger" :icon="icon" :class="selectedColorClasses?.text()">
      <UButton :icon="icon" color="neutral" variant="outline" :class="selectedColorClasses?.text()"
        :ui="{ 'base': 'shadow-none' }" />
    </slot>

    <template #content>
      <div class="grid grid-cols-4 gap-1.5">
        <span v-for="color in colors" @click="pickColor(color.key)" class="p-3 rounded-full border transition-colors"
          :class="color.key === selected ? color.selected : color.base" />
      </div>
    </template>
  </UPopover>
</template>
