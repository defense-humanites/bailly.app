<script setup lang="ts">
  import type { InputMenuItem } from "@nuxt/ui";
  import type { LookupEntry } from "#shared/types/api";
  import { InputMode } from "~/enums";
  import { splitExcerpt } from "~/helpers";
  import type { SearchField } from "~/composables/useEntrySearch";
  import { entryRoute } from "~/utils/entryUri";
  import { convertSearchInput, hasWildcards, toLookupQuery, toSearchGreek, toSearchQuery } from "~/utils/searchInput";

  // (The input text is 16px on every screen (`text-base/6`, and `fixed`: no
  // `md:text-sm`): large enough to check the Greek diacritics as they are
  // typed, and, on mobile, the size below which iOS Safari zooms in when the
  // input gets the focus. The bar is thus 40px high, its buttons with it, in
  // the 56px of the header.)

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
    /** The entry's URI (for its tags). */
    uri?: string;
    /** Whether the entry is a homonym, under its common headword. */
    nested?: boolean;
  };

  const { query, result, resultQuery, status, pending } = useEntrySearch();
  const { position, diacriticSensitive, inputMode, isDefault: defaultOptions, reset: resetOptions } = useSearchOptions();

  const transliterating = computed((): boolean => inputMode.value === InputMode.Transliteration);

  const menu = useTemplateRef("menu");

  /**
   * The whole bar (input and options button): the results are positioned
   * against it, rather than against the input alone, to be exactly as wide.
   */
  const group = useTemplateRef("group");
  const groupElement = computed((): HTMLElement | undefined => group.value?.$el as HTMLElement | undefined);

  /**
   * Makes the input show `text` (the query just set), with the caret at
   * `caret` (by default, where it is).
   * @remarks When the query doesn't change (e.g. `α` + `)` → `α`), or while
   * the input has the focus, the input menu doesn't render its text again: it
   * is then updated here, and the input event keeps the input menu's own
   * search term in sync.
   */
  const syncInputText = (text: string, caret?: number): void => {
    const input = menu.value?.inputRef as HTMLInputElement | undefined;
    if (!input) return;

    void nextTick(() => {
      if (input.value !== text) {
        input.value = text;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (caret !== undefined) input.setSelectionRange(caret, caret);
    });
  };

  // The input text follows the input mode (e.g. `λόγος` ⇄ `lógos`).
  watch(inputMode, (mode) => {
    if (!query.value) return;
    query.value = convertSearchInput(query.value, mode);
    syncInputText(query.value);
  });

  /**
   * Whether the query has wildcards (cf. `hasWildcards`).
   */
  const wildcards = computed((): boolean => hasWildcards(toLookupQuery(query.value, inputMode.value)));

  /**
   * A reminder of the search options that aren't the default ones, and of the
   * wildcards, above the results (e.g. « Entrées finissant par « λογος » ·
   * diacritiques respectés »).
   */
  const optionsSummary = computed((): string => {
    const term = `« ${toSearchQuery(query.value)} »`;
    const parts = [
      {
        start: wildcards.value ? `Entrées commençant par ${term}` : "",
        contains: `Entrées contenant ${term}`,
        end: `Entrées finissant par ${term}`,
        exact: wildcards.value ? `Entrées correspondant à ${term}` : `Entrée identique à ${term}`,
      }[position.value],
      wildcards.value ? "? : une lettre, * : plusieurs" : "",
      diacriticSensitive.value ? "diacritiques respectés" : "",
    ].filter(Boolean);
    const summary = parts.join(" · ");
    return summary.charAt(0).toUpperCase() + summary.slice(1);
  });

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

    // Transliterated input is converted when looked up (cf. `toLookupQuery`).
    if (composing || transliterating.value) {
      query.value = value;
      return;
    }

    const input = menu.value?.inputRef as HTMLInputElement | undefined;
    const caret = input?.selectionStart ?? value.length;
    const converted = toSearchGreek(value);

    query.value = converted;

    if (converted !== value) {
      syncInputText(converted, toSearchGreek(value.slice(0, caret)).length);
    }
  };

  const onCompositionStart = (): void => {
    composing = true;
  };

  const onCompositionEnd = (event: CompositionEvent): void => {
    composing = false;
    onInput((event.target as HTMLInputElement).value);
  };

  /**
   * Delay (in ms) after which a lookup is slow: a loading indicator then
   * replaces the result count (a shorter wait isn't signaled, to avoid
   * flickering).
   */
  const SLOW_LOOKUP_DELAY = 400;

  /**
   * Whether the current lookup is slow (cf. `SLOW_LOOKUP_DELAY`).
   */
  const slow = ref(false);
  let slowTimer: ReturnType<typeof setTimeout> | undefined;

  watch(status, (value) => {
    clearTimeout(slowTimer);
    slow.value = false;
    if (value === "pending") {
      slowTimer = setTimeout(() => {
        slow.value = true;
      }, SLOW_LOOKUP_DELAY);
    }
  });

  onBeforeUnmount(() => {
    clearTimeout(slowTimer);
  });

  const clear = (): void => {
    query.value = "";
    (menu.value?.inputRef as HTMLInputElement | undefined)?.focus();
  };

  // Another component may ask for the focus (e.g. the about page's "Search a
  // word" button).
  watch(useSearchFocus().request, () => {
    (menu.value?.inputRef as HTMLInputElement | undefined)?.focus();
  });

  // The results' Greek may be transliterated (a preference).
  const greek = useGreek();

  const toItem = (
    entry: Pick<LookupEntry<SearchField>, SearchField> & { isMorpheus?: boolean },
    nested = false,
  ): ResultItem => ({
    nested,
    label: entry.excerpt,
    parts: splitExcerpt(entry.word, entry.excerpt),
    text: query.value,
    isMorpheus: entry.isMorpheus,
    uri: entry.uri,
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
          uri: entry.uri,
          onSelect: () => void navigateTo(entryRoute(entry.uri)),
        },
        // The homonyms are indented under their headword (cf. `ui.item`).
        ...entry.children.map(child => toItem(child, true)),
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

  /**
   * Whether the input isn't empty: the results then show up again when the
   * input gets the focus (or is clicked, e.g. after closing them with Escape).
   */
  const hasQuery = computed((): boolean => query.value.trim() !== "");

  const hasMorpheusResults = computed((): boolean =>
    Boolean(result.value?.entries.some(entry => entry.isMorpheus)),
  );

  /**
   * Whether the user dismissed the warning about morphological results.
   */
  const morpheusWarningDismissed = useDismissed("morpheusWarning");

  const hasMoreResults = computed(
    (): boolean => (result.value?.countAll ?? 0) > (result.value?.count ?? 0),
  );

  /**
   * Whether the highlighted result was chosen by the user (arrow keys,
   * pointer). The input menu highlights the first result by itself: that
   * highlight isn't shown, and Enter doesn't open it (cf. `onKeydown`).
   */
  const highlightChosen = ref(false);

  /**
   * Whether the results are shown: as requested by the input menu (typing,
   * focus, Escape…), as long as there is something to look up (not for an
   * empty input, nor a lone pending diacritic or capital mark).
   */
  const open = ref(false);
  const searchable = computed((): boolean => toLookupQuery(query.value, inputMode.value) !== "");

  /**
   * Whether Enter was pressed before the results of the query came.
   */
  let enterPending = false;

  watch([query, result], () => {
    highlightChosen.value = false;
  });

  watch(query, () => {
    enterPending = false;
  });

  /**
   * Enter without a chosen result: the only exact match (an entry, or
   * homonyms under their headword) is opened; otherwise, the first result is
   * highlighted, for a second Enter to open it.
   */
  const onEnter = (): void => {
    const exact = result.value?.entries.filter(entry => entry.isExact) ?? [];
    const input = menu.value?.inputRef as HTMLInputElement | undefined;

    if (exact.length === 1) {
      // The results don't close when the input loses the focus (the header
      // remains, unless the layout changes); the blur closes the mobile keyboard.
      open.value = false;
      input?.blur();
      void navigateTo(entryRoute(exact[0]!.uri));
    } else if (items.value.length) {
      highlightChosen.value = true;
    }
  };

  // Enter pressed before the results came: applied once they are those of
  // the query (cf. `resultQuery`).
  watch([pending, resultQuery], ([value]) => {
    if (enterPending && !value && resultQuery.value === query.value) {
      enterPending = false;
      onEnter();
    }
  });

  /**
   * Handles the keys typed in the input before the input menu (capture): the
   * first arrow key shows the highlighted (first) result rather than moving
   * past it, and Enter without a chosen result follows `onEnter`.
   */
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.target !== menu.value?.inputRef || event.isComposing || highlightChosen.value) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!items.value.length) return;
      event.preventDefault();
      event.stopPropagation();
      highlightChosen.value = true;
    } else if (event.key === "Enter" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      event.stopPropagation();
      if (pending.value || resultQuery.value !== query.value) enterPending = true;
      else onEnter();
    }
  };

  // A pointer moving over the results highlights them (the results are in a
  // portal: the list is found through the input's `aria-controls`).
  useEventListener(import.meta.client ? document : undefined, "pointermove", (event: PointerEvent) => {
    if (highlightChosen.value) return;
    const listId = (menu.value?.inputRef as HTMLInputElement | undefined)?.getAttribute("aria-controls");
    if (listId && (event.target as Element | null)?.closest(`#${CSS.escape(listId)}`)) {
      highlightChosen.value = true;
    }
  }, { passive: true });

  /**
   * The results' highlight is hidden until the user chooses one (cf.
   * `highlightChosen`), from the results container: the items aren't
   * rendered again when only their class changes. The results are exactly
   * as wide as the bar (cf. `groupElement`).
   */
  const contentClass = computed((): string => [
    "w-(--reka-combobox-trigger-width) max-h-[min(32rem,var(--reka-combobox-content-available-height))]",
    highlightChosen.value ? "" : "[&_[data-highlighted]]:before:bg-transparent! [&_[data-highlighted]]:text-default!",
  ].join(" "));
</script>

<template>
  <!--
    The options button is attached to the input, not in its trailing slot:
    Nuxt UI renders that slot in a button (the menu trigger), where another
    button would be invalid.
  -->
  <!--
    The focus halo (outline) and ring of the input surround the whole bar,
    options button included: the input's own halo would stop short of it.
    The input isn't raised when focused (unlike in other field groups), so
    that the button's neutral left edge remains the divider (cf. SearchOptions).
  -->
  <UFieldGroup
    ref="group"
    class="group/search rounded-full outline-primary/25 has-[input:focus-visible]:outline-3"
    @keydown.capture="onKeydown"
  >
    <UInputMenu
      ref="menu"
      :open="open && searchable"
      class="w-full"
      :model-value="query"
      mode="autocomplete"
      :open-on-focus="hasQuery"
      :open-on-click="hasQuery"
      value-key="text"
      :items="items"
      ignore-filter
      icon="i-lucide-search"
      :placeholder="transliterating ? 'anazētéō…' : 'ἀναζητέω…'"
      :aria-label="`Rechercher une entrée (${transliterating ? 'translittération' : 'beta code'} ou grec)`"
      size="lg"
      fixed
      autocapitalize="off"
      autocomplete="off"
      autocorrect="off"
      spellcheck="false"
      enterkeyhint="search"
      :lang="transliterating ? 'grc-Latn' : 'grc'"
      :content="{ align: 'start', collisionPadding: 12, reference: groupElement }"
      :ui="{
        root: 'has-focus-visible:z-auto',
        base: 'shadow-xs text-base/6 focus-visible:outline-transparent',
        content: contentClass,
        // The homonyms' indent comes from their label (`data-nested`), not from
        // an item class: the input menu reuses its items by position without
        // updating their class, which then stuck to the next results.
        item: 'items-start has-[[data-nested]]:ps-5',
        itemLabel: 'whitespace-normal line-clamp-2',
        itemTrailingIcon: 'hidden',
        label: 'text-xs uppercase tracking-wide text-muted',
      }"
      @update:open="open = $event"
      @update:model-value="onInput"
      @compositionstart="onCompositionStart"
      @compositionend="onCompositionEnd"
    >
      <!-- The clear button replaces the search icon once the input isn't empty. -->
      <template #leading>
        <UButton
          v-if="query"
          icon="i-lucide-x"
          color="neutral"
          variant="link"
          size="sm"
          class="p-0"
          :ui="{ leadingIcon: 'size-5' }"
          aria-label="Effacer la recherche"
          @click.stop="clear"
        />
        <UIcon
          v-else
          name="i-lucide-search"
          class="size-5 shrink-0 text-dimmed"
        />
      </template>

      <!--
        The result count (instead of the menu chevron), or a loading indicator
        when the lookup is slow. The previous count remains meanwhile. The
        wrapper is always rendered: an empty slot would fall back to the chevron.
      -->
      <template #trailing>
        <span class="flex items-center">
          <UBadge
            v-if="query && (slow || result)"
            color="neutral"
            variant="soft"
            size="sm"
            class="min-w-6 justify-center"
            :aria-label="slow ? 'Recherche en cours' : undefined"
          >
            <UIcon
              v-if="slow"
              name="i-lucide-loader-circle"
              class="size-3.5 animate-spin"
            />
            <template v-else>
              {{ result?.countAll }}
            </template>
          </UBadge>
        </span>
      </template>

      <template #content-top>
        <p
          v-if="(!defaultOptions || wildcards) && toSearchQuery(query)"
          class="flex shrink-0 items-center gap-2 px-2.5 pt-2 text-xs text-muted"
        >
          <UIcon
            name="i-lucide-list-filter"
            class="size-3.5 shrink-0"
          />
          <span class="grow">{{ optionsSummary }}</span>
          <UButton
            v-if="!defaultOptions"
            label="Réinitialiser"
            color="neutral"
            variant="link"
            size="xs"
            class="p-0"
            @click="resetOptions"
          />
        </p>
        <UAlert
          v-if="hasMorpheusResults && !morpheusWarningDismissed"
          class="m-1.5 w-auto shrink-0"
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
          class="font-serif text-xs/6"
          :data-nested="item.nested || undefined"
        ><span class="font-semibold">{{ greek.text(item.parts.word) }}</span>{{ greek.text(item.parts.rest) }}</span>
        <template v-else>
          {{ greek.text(item.label) }}
        </template>
      </template>

      <!-- The entry's tags, and whether it was found by the morphological analysis. -->
      <template #item-trailing="{ item }">
        <span class="flex items-center gap-2">
          <EntryBookmarkIndicator
            v-if="item.uri"
            :uri="item.uri"
          />
          <UIcon
            v-if="item.isMorpheus"
            name="i-lucide-sparkles"
            class="size-4 shrink-0 text-primary"
            aria-label="Trouvé par l'analyse morphologique"
          />
        </span>
      </template>

      <template #empty="{ searchTerm }">
        <span v-if="pending">Recherche…</span>
        <span v-else-if="status === 'error'">La recherche a échoué. Veuillez réessayer.</span>
        <span v-else>Aucun résultat pour « {{ searchTerm }} ».</span>
      </template>

      <template #content-bottom>
        <p
          v-if="hasMoreResults"
          class="shrink-0 border-t border-default p-2 text-center text-sm text-muted"
        >
          Précisez votre recherche pour voir les {{ result?.countAll }} résultats.
        </p>
      </template>
    </UInputMenu>
    <SearchHistory :reference="groupElement" />
    <SearchOptions :wildcards="wildcards" />
  </UFieldGroup>
</template>
