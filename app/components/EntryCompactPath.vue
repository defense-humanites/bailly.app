<script setup lang="ts">
  import type { SenseStep } from "~/utils/sensePath";

  defineProps<{
    /** The entry's headword (as displayed). */
    word: string;
    /** Whether the entry groups homonyms (an icon before the word). */
    homonyms?: boolean;
    /** The number of the homonym being read (in superscript, as after its
        headword in the text), or none. */
    homonym?: string;
    /** The path to the sense being read (cf. `sensePath`), after the word. */
    path?: SenseStep[];
  }>();

  // Greek may be transliterated (a preference).
  const greek = useGreek();
</script>

<!--
  The compact bar's line (cf. `EntryCompactBar`): the headword, and the
  path to the sense being read.
  The path: the numbers in the primary color, as in the definition, the
  sense's label in muted italics. Too long, it is truncated, the word
  kept (but longer than the whole bar): the path is the line that
  truncates, its ellipsis in the label's style (that of the line). A
  new path replaces the former one at once, without a fade (more
  disturbing than helpful). Its first space a no-break one: a flex
  item's leading space is dropped.
-->
<template>
  <span class="flex min-w-0 items-baseline justify-center font-serif text-xs/6 font-bold"><span
    class="max-w-full shrink-0 truncate"
    :lang="greek.lang.value"
  ><!-- Homonyms: a fan of cards, as in the page's title. --><UIcon
    v-if="homonyms"
    name="i-lucide-playing-cards-fan"
    class="me-1 inline-block size-4 align-[-0.2em]"
  />{{ word }}<sup
    v-if="homonym"
    class="ms-px"
  >{{ homonym }}</sup></span><span
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
  >{{ " › " }}</span><UIcon
    v-if="step.arrow"
    name="i-bailly-arrow"
    class="inline-block h-[0.6em] w-[1.65em] align-[0.05em] text-primary"
  /><span
    v-else
    class="font-bold text-primary not-italic"
  >{{ step.number }}</span><template v-if="step.label">{{ ` ${step.label}` }}</template></template></span></span>
</template>
