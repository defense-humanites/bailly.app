<script setup lang="ts">
  import type { Siblings } from "#shared/types/api";
  import type { OutlineItem, SenseStep } from "~/utils/sensePath";

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
    /** A long entry's outline (cf. `entryOutline`), or none. */
    outline?: OutlineItem[];
    /** The sense being read, for the outline. */
    current?: Element | null;
  }>();

  const emit = defineEmits<{
    /** An item of the outline chosen. */
    select: [item: OutlineItem];
  }>();

  // Greek may be transliterated (a preference).
  const greek = useGreek();

  /** From `xl`, the outline is in a column beside the card. */
  const wide = useMediaQuery("(min-width: 80rem)");

  const outlineOpen = ref(false);
  const select = (item: OutlineItem): void => {
    outlineOpen.value = false;
    emit("select", item);
  };

  /*
   * The focus back on the line once the outline closed, without scrolling:
   * a focus that scrolls (the popover's) would stop the page's smooth scroll
   * to the sense chosen.
   */
  const outlineTrigger = useTemplateRef<HTMLButtonElement>("outlineTrigger");
  const restoreFocus = (event: Event): void => {
    event.preventDefault();
    outlineTrigger.value?.focus({ preventScroll: true });
  };
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
  theme), with the moderately rounded corners of the line's (and of the
  outline's items), not round. The outline's popover has the cards'
  background: its items take the cards' hover and active colors.
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
        class="rounded-md hover:bg-(--app-nav-hover) active:bg-(--app-nav-active)"
      />
      <span
        v-else
        class="size-8 shrink-0"
      />
      <!--
        Below `xl` (where the outline has a column of its own), for a long
        entry, the line opens the entry's outline (cf. `EntryOutline`): the
        senses to go to, the one being read marked. Narrower than the card it
        opens over, on a phone too (1 rem within its edges): 24 rem at most.
      -->
      <UPopover
        v-if="outline?.length && !wide"
        v-model:open="outlineOpen"
        :content="{ side: 'bottom', align: 'center', sideOffset: 6, onCloseAutoFocus: restoreFocus }"
        :ui="{ content: '[--app-page-hover:var(--app-card-hover)] [--app-page-active:var(--app-card-active)] w-[min(24rem,calc(100vw-4rem))] max-h-[min(32rem,var(--reka-popover-content-available-height))] overflow-y-auto p-1.5' }"
      >
        <button
          ref="outlineTrigger"
          type="button"
          aria-label="Sommaire de l'entrée"
          class="flex h-8 min-w-0 grow items-center justify-center gap-1 rounded-md px-1.5 transition-colors hover:bg-(--app-nav-hover) focus-visible:outline-2 focus-visible:outline-(--ui-border-inverted) aria-expanded:bg-(--app-nav-active)"
        >
          <EntryCompactPath
            :word="word"
            :homonyms="homonyms"
            :path="path"
          />
          <UIcon
            name="i-lucide-chevron-down"
            class="size-3.5 shrink-0 text-dimmed"
          />
        </button>
        <template #content>
          <EntryOutline
            :items="outline"
            :current="current ?? null"
            @select="select"
          />
        </template>
      </UPopover>
      <EntryCompactPath
        v-else
        class="grow"
        :word="word"
        :homonyms="homonyms"
        :path="path"
      />
      <UButton
        v-if="siblings.next"
        :to="`/${siblings.next.uri}`"
        icon="i-lucide-arrow-right"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="`Entrée suivante : ${greek.text(siblings.next.word)}`"
        class="rounded-md hover:bg-(--app-nav-hover) active:bg-(--app-nav-active)"
      />
      <span
        v-else
        class="size-8 shrink-0"
      />
    </nav>
  </div>
</template>
