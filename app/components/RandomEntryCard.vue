<script setup lang="ts">
  const { data: payload } = await useApiRandomEntry({
    fields: ["word", "uri", "excerpt", "htmlDefinition"],
    lengthRange: [600, 700],
  });

  /**
   * The random entry or, if it groups several entries, the first of them.
   */
  const entry = computed(() => {
    const randomEntry = payload.value?.data.entry;
    return randomEntry?.children?.[0] ?? randomEntry;
  });
</script>

<template>
  <EntryCard
    v-if="entry"
    :entry="entry"
    toolbar
    link
    :ui="{
      root: 'h-96 flex overflow-y-hidden',
      body: 'h-11/12 mask-b-from-85%',
    }"
  />
</template>
