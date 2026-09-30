<script setup lang="ts">
  import { colorNames } from "~/enums";
  import { IdbTags, type TagColorKey } from "~/idb";

  const props = defineProps<{
    /**
     * The picker's accessible name, also the trigger's, completed with the
     * selected color (e.g. "Couleur de l'étiquette : bleu").
     */
    label?: string;
  }>();

  /**
   * The selected color (the default one, gray slate, when there is none).
   */
  const color = defineModel<TagColorKey>();
  /**
   * Whether the popover is open.
   */
  const open = defineModel<boolean>("open", { default: false });

  /**
   * The swatches per row: two rows of five.
   */
  const COLUMNS = 5;
  const colors = IdbTags.colorKeysByHue;
  const icon = "i-bailly-tag-filled";

  const current = computed((): TagColorKey => color.value ?? "Slate");
  const label = computed((): string => props.label ?? "Couleur");

  /**
   * The trigger's attributes: its accessible name, and the selected color's
   * palette for its icon (`text-tag-text`). A custom trigger (the `trigger`
   * slot) binds them with `v-bind`.
   */
  const triggerAttrs = computed(() => ({
    "aria-label": `${label.value} : ${colorNames[current.value]}`,
    "data-tag-color": current.value,
    "class": "text-tag-text",
  }));

  /**
   * The swatch that has the focus, and the one under the pointer: the name
   * under the swatches follows them, then shows the selected color.
   */
  const focused = ref<TagColorKey>();
  const pointed = ref<TagColorKey>();
  const shownName = computed((): string => {
    const name = colorNames[pointed.value ?? focused.value ?? current.value];
    return name.charAt(0).toUpperCase() + name.slice(1);
  });

  const listbox = useTemplateRef<HTMLElement>("listbox");

  /**
   * The focus goes to the selected swatch when the popover opens (not to the
   * first one).
   */
  function onOpenAutoFocus(event: Event): void {
    event.preventDefault();
    void nextTick(() => listbox.value?.querySelector<HTMLElement>("[aria-selected=true]")?.focus());
  }

  watch(open, (isOpen) => {
    if (!isOpen) focused.value = pointed.value = undefined;
  });

  /**
   * Moves the focus between the swatches (they are one tab stop): the arrows
   * in the grid (wrapping around), Home and End. Enter and Space pick the
   * focused color (a click on the button).
   */
  function onKeydown(event: KeyboardEvent): void {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS };
    const index = colors.indexOf(focused.value ?? current.value);
    let next: number | undefined;
    if (event.key in moves) next = (index + moves[event.key]! + colors.length) % colors.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = colors.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    listbox.value?.querySelectorAll<HTMLElement>("[role=option]")[next]?.focus();
  }

  /**
   * Selects a color and closes the popover (the focus goes back to the
   * trigger).
   */
  function pick(colorKey: TagColorKey): void {
    color.value = colorKey;
    open.value = false;
  }
</script>

<!--
  A color among the tags' ten, as swatches in the order of the color wheel.
  Picking one closes the popover: the swatches are thus the options of a list
  box (a radio group would pick at each arrow key), one tab stop, the arrows
  moving between them. All share the colors' identity shade (500); the
  selected one has a ring and a check, so that it does not rely on the color
  only. The name of the color pointed at, focused or selected is written under
  them (close hues, e.g. teal and sky, are hard to tell apart).
-->
<template>
  <UPopover
    v-model:open="open"
    :arrow="{ rounded: true, width: 16, height: 8 }"
    :content="{ onOpenAutoFocus }"
    :ui="{ content: 'p-3', arrow: 'fill-(--ui-bg)' }"
  >
    <slot
      name="trigger"
      :icon="icon"
      :attrs="triggerAttrs"
    >
      <UButton
        :icon="icon"
        color="neutral"
        variant="outline"
        v-bind="triggerAttrs"
        :ui="{ base: 'shadow-none' }"
      />
    </slot>

    <template #content>
      <div
        ref="listbox"
        role="listbox"
        :aria-label="label"
        class="grid grid-cols-5 gap-3 p-1"
        @keydown="onKeydown"
        @pointerleave="pointed = undefined"
      >
        <button
          v-for="colorKey in colors"
          :key="colorKey"
          type="button"
          role="option"
          :data-tag-color="colorKey"
          :aria-label="colorNames[colorKey]"
          :aria-selected="colorKey === current"
          :tabindex="colorKey === (focused ?? current) ? 0 : -1"
          class="flex size-9 cursor-pointer items-center justify-center rounded-full bg-tag-500 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-[5px] focus-visible:outline-(--ui-text-highlighted) motion-reduce:transition-none"
          :class="{ 'ring-2 ring-tag-500 ring-offset-2 ring-offset-(--ui-bg)': colorKey === current }"
          @click="pick(colorKey)"
          @focus="focused = colorKey"
          @blur="focused = undefined"
          @pointerenter="pointed = colorKey"
        >
          <UIcon
            v-if="colorKey === current"
            name="i-lucide-check"
            class="size-5 text-tag-900"
          />
        </button>
      </div>
      <!-- For sight: the swatches carry their names for screen readers. -->
      <p
        class="mt-2 text-center text-sm text-muted"
        aria-hidden="true"
      >
        {{ shownName }}
      </p>
    </template>
  </UPopover>
</template>
