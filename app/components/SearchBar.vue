<script setup lang="ts">
  import type { InputMenuItem } from "@nuxt/ui";
  import type { LookupEntry } from "#shared/types/api";
  import { LocalStorageKey } from "~/enums";
  import { splitExcerpt } from "~/helpers";
  import type { SearchField } from "~/composables/useEntrySearch";
  import { entryRoute } from "~/utils/entryUri";
  import { toSearchGreek } from "~/utils/searchInput";

  type ResultItem = InputMenuItem & {
    /** The entry excerpt (or headword, for homonyms). */
    label: string;
    /** The excerpt, split around its headword. */
    parts?: ReturnType<typeof splitExcerpt>;
    /**
     * The item value: the current input text, which selecting the item thus
     * leaves unchanged (in `autocomplete` mode, the selected value becomes the
     * input text).
     */
    text?: string;
    isMorpheus?: boolean;
  };

  const { query, result, status, pending } = useEntrySearch();

  const menu = useTemplateRef("menu");

  /**
   * Whether the input method is composing (e.g. with dead keys): the input
   * must not be rewritten meanwhile.
   */
  let composing = false;

  /**
   * Converts the input (Beta Code, or Greek) into Greek, keeping the caret
   * where it was.
   * @remarks In `autocomplete` mode, the model is the input text (selecting a
   * result navigates by itself, cf. `onSelect`).
   */
  const onInput = (value: unknown): void => {
    if (typeof value !== "string") return;

    if (composing) {
      query.value = value;
      return;
    }

    const input = menu.value?.inputRef as HTMLInputElement | undefined;
    const caret = input?.selectionStart ?? value.length;
    const converted = toSearchGreek(value);

    query.value = converted;

    if (input && converted !== value) {
      const position = toSearchGreek(value.slice(0, caret)).length;
      void nextTick(() => {
        input.setSelectionRange(position, position);
      });
    }
  };

  const onCompositionStart = (): void => {
    composing = true;
  };

  const onCompositionEnd = (event: CompositionEvent): void => {
    composing = false;
    onInput((event.target as HTMLInputElement).value);
  };

  const clear = (): void => {
    query.value = "";
    (menu.value?.inputRef as HTMLInputElement | undefined)?.focus();
  };

  const toItem = (
    entry: Pick<LookupEntry<SearchField>, SearchField> & { isMorpheus?: boolean },
    className?: string,
  ): ResultItem => ({
    class: className,
    label: entry.excerpt,
    parts: splitExcerpt(entry.word, entry.excerpt),
    text: query.value,
    isMorpheus: entry.isMorpheus,
    // A homonym leads to its anchor in the entry page (e.g. `oudos#2`).
    onSelect: () => void navigateTo(entryRoute(entry.uri)),
  });

  /**
   * An entry, or its homonyms under their common headword (which leads to the
   * whole entry page).
   */
  const toItems = (entry: LookupEntry<SearchField>): ResultItem[] =>
    entry.children?.length
      ? [
        {
          label: entry.word,
          parts: { word: entry.word, rest: "" },
          text: query.value,
          isMorpheus: entry.isMorpheus,
          onSelect: () => void navigateTo(entryRoute(entry.uri)),
        },
        // The homonyms are indented under their headword.
        ...entry.children.map(child => toItem(child, "ps-5")),
      ]
      : [toItem(entry)];

  /**
   * Two groups: exact matches (the API sorts those found through their
   * inflected form last), then the other entries.
   */
  const items = computed((): ResultItem[][] => {
    // (No stale results for an empty input; an item value can't be empty either.)
    if (!query.value.trim()) return [];

    const entries = result.value?.entries ?? [];
    const exact = entries.filter(entry => entry.isExact);
    const others = entries.filter(entry => !entry.isExact);

    return [
      exact.length ? [{ type: "label", label: "Correspondances exactes" }, ...exact.flatMap(toItems)] : [],
      others.length ? [{ type: "label", label: exact.length ? "Autres entrées" : "Entrées" }, ...others.flatMap(toItems)] : [],
    ].filter(group => group.length) as ResultItem[][];
  });

  const hasMorpheusResults = computed((): boolean =>
    Boolean(result.value?.entries.some(entry => entry.isMorpheus)),
  );

  /**
   * Whether the user dismissed the warning about morphological results.
   * @remarks Same key as in the previous (Astro) application.
   */
  const morpheusWarningDismissed = useLocalStorage<boolean>(
    LocalStorageKey.DismissSearchBarMorphologicalResultsWarning,
    false,
  );

  const hasMoreResults = computed(
    (): boolean => (result.value?.countAll ?? 0) > (result.value?.count ?? 0),
  );
</script>

<template>
  <UInputMenu
    ref="menu"
    :model-value="query"
    mode="autocomplete"
    value-key="text"
    :items="items"
    ignore-filter
    icon="i-lucide-search"
    :loading="pending"
    placeholder="ἀναζητέω…"
    aria-label="Rechercher une entrée (beta code ou grec)"
    size="lg"
    autocapitalize="off"
    autocomplete="off"
    autocorrect="off"
    spellcheck="false"
    enterkeyhint="search"
    lang="grc"
    :content="{ align: 'start', collisionPadding: 12 }"
    :ui="{
      base: 'shadow-xs',
      content: 'w-[min(40rem,calc(100dvw-2rem))] max-h-[min(32rem,var(--reka-combobox-content-available-height))]',
      item: 'items-start',
      itemLabel: 'whitespace-normal line-clamp-2',
      itemTrailingIcon: 'hidden',
      label: 'text-xs uppercase tracking-wide text-muted',
    }"
    @update:model-value="onInput"
    @compositionstart="onCompositionStart"
    @compositionend="onCompositionEnd"
  >
    <!-- Result count and clear button (instead of the menu chevron). -->
    <template #trailing>
      <span class="flex items-center gap-1.5">
        <UBadge
          v-if="query && result && !pending"
          :label="String(result.countAll)"
          color="neutral"
          variant="soft"
          size="sm"
        />
        <UButton
          v-if="query"
          icon="i-lucide-x"
          color="neutral"
          variant="link"
          size="sm"
          aria-label="Effacer la recherche"
          @click.stop="clear"
        />
      </span>
    </template>

    <template #content-top>
      <UAlert
        v-if="hasMorpheusResults && !morpheusWarningDismissed"
        class="m-1.5 w-auto"
        icon="i-lucide-sparkles"
        color="neutral"
        variant="soft"
        description="Les résultats issus de l'analyse morphologique, signalés par une icône scintillante, peuvent être lacunaires. Gardez l'esprit critique !"
        close
        @update:open="morpheusWarningDismissed = true"
      />
    </template>

    <template #item-label="{ item }">
      <span
        v-if="item.parts"
        class="font-serif text-base"
      ><span class="font-semibold">{{ item.parts.word }}</span>{{ item.parts.rest }}</span>
      <template v-else>
        {{ item.label }}
      </template>
    </template>

    <template #item-trailing="{ item }">
      <UIcon
        v-if="item.isMorpheus"
        name="i-lucide-sparkles"
        class="size-4 shrink-0 text-primary"
        aria-label="Trouvé par l'analyse morphologique"
      />
    </template>

    <template #empty="{ searchTerm }">
      <span v-if="!searchTerm.trim()">Saisissez un mot en beta code (p. ex. <em>logos</em>) ou en grec.</span>
      <span v-else-if="pending">Recherche…</span>
      <span v-else-if="status === 'error'">La recherche a échoué. Veuillez réessayer.</span>
      <span v-else>Aucun résultat pour « {{ searchTerm }} ».</span>
    </template>

    <template #content-bottom>
      <p
        v-if="hasMoreResults"
        class="p-2 text-center text-sm text-muted border-t border-default"
      >
        Précisez votre recherche pour voir les {{ result?.countAll }} résultats.
      </p>
    </template>
  </UInputMenu>
</template>
