<script setup lang="ts">
  import { deferMount } from "~/utils/deferredMount";

  /**
   * As Nuxt's `ClientOnly` (the fallback on the server and while hydrating,
   * the default slot then), but the default slot mounted in a task of its
   * own after the hydration (cf. `deferMount`), in the order of `priority`
   * (lowest first): the hydration's task stays short (cf. `audit-inp.md`).
   * After a navigation in the application, the default slot at once.
   */
  const props = withDefaults(defineProps<{
    /** The order of the deferred mounts (lowest first). */
    priority?: number;
  }>(), { priority: 0 });

  const nuxtApp = useNuxtApp();
  const shown = shallowRef(import.meta.client && !nuxtApp.isHydrating);
  let cancel: (() => void) | undefined;
  onMounted(() => {
    if (shown.value) return;
    cancel = deferMount(() => {
      shown.value = true;
    }, props.priority);
  });
  onBeforeUnmount(() => cancel?.());
</script>

<template>
  <slot v-if="shown" />
  <slot
    v-else
    name="fallback"
  />
</template>
