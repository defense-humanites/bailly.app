<script setup lang="ts">
  import { formRoute } from "~/utils/linkedEntries";

  /*
   * The former address of the forms' pages (`/lecteur?q=…&forme=…`), kept
   * for the links already shared: redirected to the page of the form (cf.
   * `forme/[forme].vue`), whose entries the API finds from the form alone
   * (`q` is ignored). Without a form, no page: its entries, taken from the
   * address, couldn't be checked. The name awaits a reader of a tag's
   * entries.
   */
  const route = useRoute();
  const form = typeof route.query.forme === "string" ? route.query.forme.trim() : "";
  if (!form) {
    throw createError({
      status: 404,
      message: "La page demandée n'existe pas.",
    });
  }
  await navigateTo(formRoute(form), { redirectCode: 301, replace: true });
</script>

<template>
  <div />
</template>
