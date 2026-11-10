<script setup lang="ts">
  import type { SearchResultGroup } from "~/utils/searchResults";

  const props = defineProps<{
    /** Whether the panel shows. */
    open: boolean;
    /** The search bar, the panel's anchor: below it, exactly as wide. */
    anchor: HTMLElement | undefined;
    /** The search field, which a pointer down outside the panel spares. */
    field: HTMLElement | undefined;
    /** The list box's id (the field's `aria-controls`). */
    listId: string;
    /** The results, in groups. */
    groups: SearchResultGroup[];
    /** The highlighted result's index, shown (-1: none). */
    highlighted: number;
    /** A reminder of the search options, above the results (if any). */
    summary?: string;
    /** Whether the options may be reset (a button after the reminder). */
    resettable?: boolean;
    /** Whether the warning about the morphological analysis shows. */
    warning?: boolean;
    /** What the panel says without results (searching, failed, none). */
    empty?: string;
    /** Below the results, how many others were found (if any). */
    footer?: string;
  }>();

  const emit = defineEmits<{
    /** A result pointed at (its index). */
    point: [index: number];
    /** A result chosen (its index). */
    select: [index: number];
    /** The panel dismissed (a pointer down outside it and the field). */
    dismiss: [];
    reset: [];
    dismissWarning: [];
  }>();

  const panel = useTemplateRef<HTMLElement>("panel");
  const viewport = useTemplateRef<HTMLElement>("viewport");

  /**
   * The panel's place: fixed, 8 px below the bar, exactly as wide, at most
   * 32 rem high and within the visible viewport (above a phone's keyboard),
   * 8 px from its bottom. In the body: the header, which holds the bar,
   * hides what overflows it (cf. `AppNavHorizontal`). Measured as it opens,
   * then as the viewport or the bar change, once a frame (the header is
   * fixed and the window never scrolls: the bar only moves with them).
   */
  const SIDE_OFFSET = 8;
  const COLLISION_PADDING = 8;
  const place = shallowRef<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const measure = (): void => {
    const bar = props.anchor;
    if (!bar) return;
    const { left, bottom, width } = bar.getBoundingClientRect();
    const top = bottom + SIDE_OFFSET;
    const viewportBottom = window.visualViewport
      ? window.visualViewport.offsetTop + window.visualViewport.height
      : window.innerHeight;
    place.value = { left, top, width, maxHeight: Math.max(0, viewportBottom - top - COLLISION_PADDING) };
  };
  let frame = 0;
  const remeasure = (): void => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      measure();
    });
  };
  const target = import.meta.client ? window : undefined;
  useEventListener(target, "resize", remeasure, { passive: true });
  useEventListener(import.meta.client ? window.visualViewport : undefined, "resize", remeasure, { passive: true });
  useResizeObserver(() => props.anchor, remeasure);
  watch(() => props.open, (open) => {
    if (open) measure();
  }, { immediate: true });
  onBeforeUnmount(() => {
    cancelAnimationFrame(frame);
  });

  const panelStyle = computed(() => place.value && {
    left: `${place.value.left}px`,
    top: `${place.value.top}px`,
    width: `${place.value.width}px`,
    maxHeight: `min(32rem, ${place.value.maxHeight}px)`,
  });

  /**
   * A pointer down outside the panel and the field dismisses it; a touch,
   * on its click only (not when it scrolls the page).
   */
  const outside = (target: EventTarget | null): boolean =>
    target instanceof Node && !panel.value?.contains(target) && !props.field?.contains(target);
  useEventListener(import.meta.client ? document : undefined, "pointerdown", (event: PointerEvent) => {
    if (!props.open || !outside(event.target)) return;
    if (event.pointerType !== "touch") {
      emit("dismiss");
      return;
    }
    document.addEventListener("click", (click) => {
      if (outside(click.target)) emit("dismiss");
    }, { once: true, capture: true });
  }, { capture: true });

  /**
   * The highlighted result kept in view (the arrow keys; `scroll-py-1`: 4 px
   * from the list's edges; the panel is fixed: only the list scrolls), the
   * first one with its group's label; the list at its top for new results.
   */
  watch(() => props.highlighted, async (index) => {
    if (index < 0) return;
    await nextTick();
    if (index === 0 && viewport.value) viewport.value.scrollTop = 0;
    else document.getElementById(`${props.listId}-${index}`)?.scrollIntoView({ block: "nearest" });
  });
  watch(() => props.groups, () => {
    if (viewport.value) viewport.value.scrollTop = 0;
  });

  /**
   * The result under the pointer (its index, -1 if none): the list handles
   * the pointer for its results, rendered again only when they change.
   */
  const optionIndex = (event: Event): number => {
    const option = (event.target as Element | null)?.closest<HTMLElement>("[role=option]");
    return Number(option?.dataset.index ?? -1);
  };
  const onPointerMove = (event: PointerEvent): void => {
    const index = optionIndex(event);
    if (index >= 0 && index !== props.highlighted) emit("point", index);
  };
  const onClick = (event: MouseEvent): void => {
    const index = optionIndex(event);
    if (index >= 0) emit("select", index);
  };
</script>

<!--
  The results of the search bar, in a panel below it (cf. `SearchBar`, which
  keeps the focus in its field and tells the highlighted result by
  `aria-activedescendant`): the reminder of the search options and the
  warning about the morphological analysis above them, the count below;
  each result a line of its excerpt (its headword first, in bold), its tags
  and whether the morphological analysis found it. As Nuxt UI's input menu
  drew them, which this replaces: rendered again only when the results or
  the highlighted one change, never as a letter is typed (cf. the INP of the
  search bar, `audit-inp-frappe-10-novembre.md`). A pointer down in the panel
  keeps the focus in the field.
-->
<template>
  <Teleport to="body">
    <Transition
      enter-active-class="animate-[scale-in_100ms_var(--ease-out)]"
      leave-active-class="animate-[scale-out_100ms_var(--ease-out)]"
    >
      <div
        v-if="open && panelStyle"
        ref="panel"
        data-search-results
        class="search-surface search-panel fixed flex origin-top-left flex-col overflow-hidden rounded-md bg-default shadow-lg ring ring-default"
        :style="panelStyle"
        @pointerdown.prevent
      >
        <p
          v-if="summary"
          class="flex shrink-0 items-center gap-2 px-2.5 pt-2 text-xs text-muted"
        >
          <UIcon
            name="i-lucide-list-filter"
            class="size-3.5 shrink-0"
          />
          <span class="grow">{{ summary }}</span>
          <UButton
            v-if="resettable"
            label="Réinitialiser"
            color="neutral"
            variant="link"
            size="xs"
            class="p-0"
            @click="emit('reset')"
          />
        </p>
        <!--
          In gold, as the sparkles marking these results; its text in the
          alert's color mixed with the text's, as the notice of the
          application installed on iOS (`InstalledOnIosNotice`).
        -->
        <UAlert
          v-if="warning"
          class="m-1.5 w-auto shrink-0"
          icon="i-lucide-sparkles"
          color="warning"
          variant="soft"
          :ui="{ description: 'text-[color-mix(in_oklab,var(--ui-warning)_55%,var(--ui-text-highlighted))] opacity-100' }"
          description="Les résultats issus de l'analyse morphologique, signalés par une icône scintillante, peuvent être lacunaires."
          close
          @update:open="emit('dismissWarning')"
        />
        <div
          v-if="!groups.length"
          role="status"
          class="p-3 text-center text-sm text-muted"
        >
          {{ empty }}
        </div>
        <div
          :id="listId"
          ref="viewport"
          role="listbox"
          aria-label="Résultats"
          class="relative flex-1 scroll-py-1 divide-y divide-default overflow-y-auto"
          @pointermove="onPointerMove"
          @click="onClick"
        >
          <div
            v-for="group in groups"
            :key="group.key"
            role="group"
            :aria-labelledby="`${listId}-${group.key}`"
            class="isolate p-1"
          >
            <div
              :id="`${listId}-${group.key}`"
              class="gap-2 p-2 text-xs font-semibold tracking-wide text-muted uppercase"
            >
              {{ group.label }}
            </div>
            <SearchResultOption
              v-for="item in group.items"
              :id="`${listId}-${item.index}`"
              :key="item.key"
              :item="item"
              :highlighted="item.index === highlighted"
            />
          </div>
        </div>
        <!-- Below the results, how many others were found (cf. `SearchBar`). -->
        <p
          v-if="footer"
          class="shrink-0 border-t border-default p-2 text-center text-sm text-muted"
        >
          {{ footer }}
        </p>
      </div>
    </Transition>
  </Teleport>
</template>
