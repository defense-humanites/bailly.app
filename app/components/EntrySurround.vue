<script setup lang="ts">
  import type { EntryData, Siblings } from "#shared/types/api";
  import { splitExcerpt } from "~/helpers";
  import { entryRoute } from "~/utils/entryUri";

  type Sibling = Pick<EntryData, "word" | "uri" | "excerpt">;

  const props = defineProps<{
    /** The entries before and after the displayed one. */
    siblings: Siblings<"word" | "uri" | "excerpt">;
  }>();

  /**
   * The previous and next entries, with their full headword and the rest of
   * their excerpt (empty for homonyms, whose excerpt is the headword).
   */
  // Greek may be transliterated (a preference).
  const greek = useGreek();

  const links = computed(() => ([
    ["previous", props.siblings.previous],
    ["next", props.siblings.next],
  ] as const).flatMap(([direction, entry]: readonly ["previous" | "next", Sibling | undefined]) => entry
    ? [{
      direction,
      word: entry.word,
      rest: splitExcerpt(entry.word, entry.excerpt).rest.replace(/^[\s,.;:·]+/u, ""),
      to: entryRoute(entry.uri),
    }]
    : []));
</script>

<!--
  Links to the previous and next entries at the end of the article, with
  their full headword (the header's arrows only show an icon on mobile), so
  that the reader can go on without scrolling back up.
-->
<template>
  <nav
    v-if="links.length"
    aria-label="Entrées voisines"
    class="grid grid-cols-2 gap-3 sm:gap-4"
  >
    <ULink
      v-for="link in links"
      :key="link.direction"
      :to="link.to"
      raw
      class="group block min-w-0 rounded-lg border border-default bg-default/75 px-4 py-3 outline-primary/25 transition-colors hover:border-accented hover:bg-default focus-visible:border-primary focus-visible:outline-3"
      :class="link.direction === 'next' ? 'col-start-2 text-end' : ''"
    >
      <span
        class="flex items-center gap-1.5 text-xs text-muted"
        :class="link.direction === 'next' ? 'flex-row-reverse' : ''"
      >
        <UIcon
          :name="link.direction === 'next' ? 'i-lucide-arrow-right' : 'i-lucide-arrow-left'"
          class="size-4 shrink-0 transition-[color,translate] ease-out group-hover:text-primary motion-reduce:transition-none"
          :class="link.direction === 'next' ? 'group-active:translate-x-0.5' : 'group-active:-translate-x-0.5'"
        />
        {{ link.direction === "next" ? "Entrée suivante" : "Entrée précédente" }}
      </span>
      <span
        class="mt-1 block truncate font-serif text-lg font-bold text-highlighted"
        :lang="greek.lang.value"
      >{{ greek.text(link.word) }}</span>
      <span
        v-if="link.rest"
        class="line-clamp-2 font-serif text-sm text-muted"
      >{{ greek.text(link.rest) }}</span>
    </ULink>
  </nav>
</template>
