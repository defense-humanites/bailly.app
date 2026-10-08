<script setup lang="ts">
  import type { Siblings } from "#shared/types/api";
  import type { SenseStep } from "~/utils/sensePath";

  defineProps<{
    /** The entry's headword (as displayed). */
    word: string;
    /** The previous and next entries. */
    siblings: Siblings<"word" | "uri">;
    /** Whether the bar is shown (once the entry's title is out of sight). */
    shown: boolean;
    /** Whether the entry groups homonyms (an icon before the word). */
    homonyms?: boolean;
    /** The path to the sense being read (cf. `sensePath`), after the word. */
    path?: SenseStep[];
  }>();

  // Greek may be transliterated (a preference).
  const greek = useGreek();
</script>

<!--
  A compact bar (the headword and the path to the sense being read, and
  arrows to the neighbouring entries) that
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
      <!--
        The path: the numbers in the primary color, as in the definition, the
        sense's label in muted italics. Too long, it is truncated, the word
        kept (but longer than the whole bar): the path is the line that
        truncates, its ellipsis in the label's style (that of the line). A
        new path replaces the former one at once, without a fade (more
        disturbing than helpful). Its first space a no-break one: a flex
        item's leading space is dropped.
      -->
      <span class="flex min-w-0 grow items-baseline justify-center font-serif text-xs/6 font-bold"><span
        class="max-w-full shrink-0 truncate"
        :lang="greek.lang.value"
      ><!-- Homonyms: a fan of cards, as in the page's title. --><UIcon
        v-if="homonyms"
        name="i-lucide-playing-cards-fan"
        class="me-1 inline-block size-4 align-[-0.2em] text-muted"
      />{{ word }}</span><span
        v-if="path?.length"
        lang="fr"
        class="min-w-0 truncate font-normal text-muted italic"
      ><span
        class="text-dimmed not-italic"
        aria-hidden="true"
      >{{ "\u00A0· " }}</span><template
        v-for="(step, index) in path"
        :key="index"
      ><span
        v-if="index"
        class="text-dimmed not-italic"
        aria-hidden="true"
      >{{ " › " }}</span><span class="font-bold text-primary not-italic">{{ step.number }}</span><template v-if="step.label">{{ ` ${step.label}` }}</template></template></span></span>
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
