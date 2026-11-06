<script setup lang="ts">
  import { formRoute } from "~/utils/linkedEntries";

  /*
   * The former address of the forms' pages (`/lecteur?q=…&forme=…`, or
   * `?items=…`), kept for the links already shared: redirected to the page
   * of the form (cf. `forme/[[forme]].vue`). The name awaits a reader of a
   * tag's entries.
   */
  const route = useRoute();
  const query = route.query.q ?? route.query.items;
  const form = route.query.forme;
  await navigateTo(
    formRoute(typeof query === "string" ? query.split(",") : [], typeof form === "string" && form.trim() ? form.trim() : undefined),
    { redirectCode: 301, replace: true },
  );
</script>

<template>
  <div />
</template>
