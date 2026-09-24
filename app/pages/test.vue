<script setup lang="ts">
  const { data } = await useFetch("/api/bookmarks");
</script>

<template>
  <pre>{{ data.tags }}</pre>
  data.tags[0].name = {{ data.tags[0].name }}
</template>
