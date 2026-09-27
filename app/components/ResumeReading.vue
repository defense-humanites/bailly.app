<script setup lang="ts">
  import { entryRoute } from "~/utils/entryUri";

  /**
   * The last viewed entry (from the history), once read in the browser; the
   * home page until then, or without history. The button itself doesn't
   * change (no layout shift): only its link.
   */
  const historyStore = useHistoryStore();
  const to = computed(() => {
    const last = historyStore.entries[0];
    return last ? entryRoute(last.uri) : "/";
  });

  onMounted(() => {
    void historyStore.load();
  });
</script>

<template>
  <UButton
    :to="to"
    label="Reprendre la lecture"
    icon="i-lucide-book-open"
    color="neutral"
    variant="outline"
  />
</template>
