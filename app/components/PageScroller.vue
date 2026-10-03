<script setup lang="ts">
  // The layout's classes (its margins) go to the content, not to the
  // scroller: a scroller's padding would offset what sticks in it.
  defineOptions({ inheritAttrs: false });

  const main = useTemplateRef<HTMLElement>("main");
  const scroller = usePageScroller();
  let forget: (() => void) | undefined;

  onMounted(() => {
    scroller.value = main.value;
    if (main.value) forget = rememberPageScroll(main.value);
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
-->
<template>
  <main
    id="page"
    ref="main"
    class="absolute inset-x-0 top-(--header-total) bottom-0 overflow-y-auto [--header-bottom:0px] [scrollbar-gutter:stable] print:static print:overflow-visible"
  >
    <div
      v-bind="$attrs"
      class="min-w-[calc(var(--app-min-width)-(100vw-100%))]"
    >
      <slot />
    </div>
  </main>
</template>
