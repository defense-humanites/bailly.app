<script setup lang="ts">
  // The layout's classes (its margins) go to the content, not to the
  // scroller: a scroller's padding would offset what sticks in it.
  defineOptions({ inheritAttrs: false });

  const main = useTemplateRef<HTMLElement>("main");
  const scroller = usePageScroller();
  let forget: (() => void) | undefined;

  /**
   * Gives the focus to the scroller on each new page (not on opening, nor
   * while a field is being typed in, e.g. the search bar): the keyboard
   * (Space, arrows, Page Down) scrolls it at once, the window no longer
   * scrolling (cf. `usePageScroller`).
   */
  const focusScroller = (): void => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable)) return;
    main.value?.focus({ preventScroll: true });
  };

  const route = useRoute();
  watch(() => route.path, () => {
    void nextTick(focusScroller);
  });

  onMounted(() => {
    scroller.value = main.value;
    if (main.value) forget = rememberPageScroll(main.value);
    // Another layout's page (but not on opening).
    if (!useNuxtApp().isHydrating) focusScroller();
  });

  onBeforeUnmount(() => {
    forget?.();
    // (Another layout's may already be there.)
    if (scroller.value === main.value) scroller.value = null;
  });
</script>

<!--
  The layouts' main content, scrolling under the fixed header in its own box
  (cf. `usePageScroller`): the window never scrolls. The scrollbar's room is
  kept (`scrollbar-gutter`), as in the header: both are as wide (cf.
  `AppNavHorizontal`). What sticks in it sticks at its top (`--header-bottom:
  0`, cf. root.css). Its content is at least `--app-min-width` wide, its
  scrollbar's room included (`100vw - 100%`), and it then scrolls sideways.
  A container: what spans its whole width (`100cqw`, e.g. the bookmarks'
  table of contents' background) is exactly as wide.
-->
<template>
  <main
    id="page"
    ref="main"
    tabindex="-1"
    class="absolute inset-x-0 top-(--header-total) bottom-0 overflow-y-auto outline-none [container-type:inline-size] [--header-bottom:0px] [scrollbar-gutter:stable] print:static print:overflow-visible"
  >
    <div
      v-bind="$attrs"
      class="min-w-[calc(var(--app-min-width)-(100vw-100%))]"
    >
      <slot />
    </div>
  </main>
</template>
