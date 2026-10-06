<script setup lang="ts">
  import type { Siblings } from "#shared/types/api";

  defineProps<{
    /** The entry's headword (as displayed). */
    word: string;
    /** The previous and next entries. */
    siblings: Siblings<"word" | "uri">;
    /** Whether the bar is shown (once the entry's title is out of sight). */
    shown: boolean;
    /** Whether the entry groups homonyms (an icon before the word). */
    homonyms?: boolean;
  }>();

  // Greek may be transliterated (a preference).
  const greek = useGreek();
</script>

<!--
  A compact bar (the headword, and arrows to the neighbouring entries) that
  appears under the header once the entry's title has scrolled out of sight
  (as the large titles of iOS), exactly as wide as the definition's card.
  It sticks in a zero-height wrapper, so that
  it takes no room in the page; hidden, it is out of the tab order and of
  the accessibility tree (`invisible`). The arrows' hover is the header
  menu's (`bg-elevated`, Nuxt UI's, is the bar's own color in the light
  theme).
-->
<template>
  <div class="pointer-events-none sticky top-(--header-bottom) z-20 h-0 transition-[top] duration-300 ease-out motion-reduce:transition-none">
    <nav
      aria-label="Navigation de l'entrée"
      class="pointer-events-auto flex h-10 items-center gap-2 border-b border-default bg-bar px-2 transition-[opacity,translate,visibility] duration-200 ease-out motion-reduce:transition-none"
      :class="shown ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0'"
    >
      <UButton
        v-if="siblings.previous"
        :to="`/${siblings.previous.uri}`"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="`Entrée précédente : ${greek.text(siblings.previous.word)}`"
        class="hover:bg-(--app-page-hover)/50 active:bg-(--app-page-hover)/50"
      />
      <span
        v-else
        class="size-8 shrink-0"
      />
      <span
        class="min-w-0 grow truncate text-center font-serif text-xs/6 font-bold"
        :lang="greek.lang.value"
      ><!-- Homonyms: a fan of cards, as in the page's title. --><UIcon
        v-if="homonyms"
        name="i-lucide-playing-cards-fan"
        class="me-1 inline-block size-4 align-[-0.2em] text-muted"
      />{{ word }}</span>
      <UButton
        v-if="siblings.next"
        :to="`/${siblings.next.uri}`"
        icon="i-lucide-arrow-right"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="`Entrée suivante : ${greek.text(siblings.next.word)}`"
        class="hover:bg-(--app-page-hover)/50 active:bg-(--app-page-hover)/50"
      />
      <span
        v-else
        class="size-8 shrink-0"
      />
    </nav>
  </div>
</template>
