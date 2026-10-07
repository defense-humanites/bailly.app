<script setup lang="ts">
  defineProps<{
    /** The neighbouring entry's page. */
    to: string;
    /** Its headword (as shown). */
    word: string;
    direction: "previous" | "next";
  }>();
</script>

<!--
  A link of the entry page's title row, to the previous or next entry: the
  markup and classes of a Nuxt UI navigation menu's link (cf. `[uri].vue`),
  without its component (a plain link costs far less to render on the
  server). Its word is hidden below `sm` (the link's accessible name keeps
  it); its tooltip is set by the page once hydrated.
-->
<template>
  <NuxtLink
    :to="to"
    :aria-label="`${direction === 'previous' ? 'Entrée précédente' : 'Entrée suivante'} : ${word}`"
    data-slot="link"
    class="group relative flex w-full items-center gap-1.5 px-2.5 py-1.5 font-serif text-base/7 font-bold text-muted transition-colors before:absolute before:inset-x-px before:inset-y-0 before:z-[-1] before:rounded-md before:outline-inverted/25 before:transition-colors hover:text-highlighted hover:before:bg-(--app-page-hover)/50 focus:outline-none focus-visible:outline-none focus-visible:before:outline-3"
    :class="direction === 'next' && 'justify-end text-right'"
  >
    <UIcon
      v-if="direction === 'previous'"
      name="i-lucide-arrow-left"
      data-slot="linkLeadingIcon"
      class="size-5 shrink-0 text-dimmed transition-colors group-hover:text-default"
    />
    <span
      data-slot="linkLabel"
      class="truncate grow max-sm:sr-only"
    >{{ word }}</span>
    <span
      v-if="direction === 'next'"
      data-slot="linkTrailing"
      class="ms-auto inline-flex items-center gap-1.5"
    >
      <UIcon
        name="i-lucide-arrow-right"
        data-slot="linkTrailingIcon"
        class="size-5 shrink-0"
      />
    </span>
  </NuxtLink>
</template>
