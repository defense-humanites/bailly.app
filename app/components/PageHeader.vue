<script setup lang="ts">
  defineProps<{
    /** The page's title. */
    title: string;
    /** A line under it, telling what the page holds. */
    subtitle?: string;
    /**
     * A line above it, in the Aegean blue, with an icon in a disc (e.g. the
     * news: « Nouveautés · octobre 2026 »).
     */
    eyebrow?: { label: string; icon: string };
  }>();
</script>

<!--
  The head of a text page (the news, the privacy page): an optional eyebrow,
  the title, a subtitle, a rule under them. One component, not to copy its
  classes from page to page.
-->
<template>
  <header class="border-b border-default pb-6">
    <p
      v-if="eyebrow"
      class="mb-4 flex items-center gap-2 text-sm font-semibold text-secondary"
    >
      <span class="grid size-8 place-items-center rounded-full bg-secondary/10 ring-1 ring-secondary/20">
        <UIcon
          :name="eyebrow.icon"
          class="size-4.5"
        />
      </span>
      {{ eyebrow.label }}
    </p>
    <h1 class="text-3xl/tight font-bold text-balance text-highlighted md:text-4xl/tight">
      {{ title }}
    </h1>
    <p
      v-if="subtitle"
      class="mt-3 text-xl text-pretty text-muted"
    >
      {{ subtitle }}
    </p>
  </header>
</template>
