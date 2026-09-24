<script setup lang="ts">
  import type { Entry } from "~/plugins/api";

  const entry = ref<Entry<"word" | "uri" | "excerpt" | "htmlDefinition"> | undefined>();

  const { data: payload } = await useApiRandomEntry({
    fields: ["word", "uri", "excerpt", "htmlDefinition"],
    lengthRange: [600, 700]
  });

  const children = entry.value?.children;
  entry.value = children?.length ? children.at(0) : payload.value?.data.entry;
</script>

<template>
  <EntryCard v-if="entry" :entry="entry?.children?.at(0) ?? entry" toolbar link :ui="{
    root: 'h-96 flex overflow-y-hidden',
    body: 'h-11/12 mask-b-from-85%',
  }" />
</template>
