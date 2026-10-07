<script setup lang="ts">
  import type { HeaderLink } from "~/components/AppHeader.vue";

  defineProps<{
    item: HeaderLink;
    /** Whether the link leads to the current page (shown in the main color). */
    current: boolean;
  }>();
</script>

<!--
  A link of the header's menu: the markup and classes of a Nuxt UI
  navigation menu's link (cf. `AppNavHorizontal`), without its component (a
  plain link costs far less to render on the server). Its label, hidden
  below `xl` (the link's accessible name), is shown then in a tooltip, set
  by the menu once the page is hydrated.
-->
<template>
  <NuxtLink
    :to="item.to"
    data-slot="link"
    class="group relative flex w-full items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium before:absolute before:inset-x-px before:inset-y-0 before:z-[-1] before:rounded-md before:outline-primary/25 hover:before:bg-(--app-page-hover)/50 focus:outline-none focus-visible:outline-none focus-visible:before:outline-3 max-md:p-2.5"
    :class="current ? 'text-primary' : 'text-muted transition-colors before:transition-colors hover:text-highlighted'"
  >
    <UIcon
      :name="item.icon"
      data-slot="linkLeadingIcon"
      class="size-5 shrink-0"
      :class="current ? 'text-primary' : 'text-dimmed transition-colors group-hover:text-default'"
    />
    <span
      data-slot="linkLabel"
      class="truncate max-xl:sr-only"
    >{{ item.label }}</span>
  </NuxtLink>
</template>
