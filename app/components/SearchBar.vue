<script setup lang="ts">
  import type { InputMenuItem } from "@nuxt/ui";
  import type { LookupEntry } from "#shared/types/api";
  import { InputMode, LocalStorageKey } from "~/enums";
  import { splitExcerpt } from "~/helpers";
  import type { SearchField } from "~/composables/useEntrySearch";
  import { entryRoute } from "~/utils/entryUri";
  import { convertSearchInput, toSearchGreek, toSearchQuery } from "~/utils/searchInput";

  // (The input text is 16px on mobile, `max-md:text-base`: below, iOS Safari
  // zooms in when the input gets the focus.)

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
  const { position, diacriticSensitive, inputMode, isDefault: defaultOptions, reset: resetOptions } = useSearchOptions();

  const transliterating = computed((): boolean => inputMode.value === InputMode.Transliteration);

  const menu = useTemplateRef("menu");

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
   * A reminder of the search options that aren't the default ones, above the
   * results (e.g. « Entrées finissant par « λογος » · diacritiques respectés »).
   */
  const optionsSummary = computed((): string => {
    const term = `« ${toSearchQuery(query.value)} »`;
    const parts = [
      {
        start: "",
        contains: `Entrées contenant ${term}`,
        end: `Entrées finissant par ${term}`,
        exact: `Entrée identique à ${term}`,
      }[position.value],
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
  <UFieldGroup class="group/search rounded-full outline-primary/25 has-[input:focus-visible]:outline-3">
    <UInputMenu
      ref="menu"
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
      autocapitalize="off"
      autocomplete="off"
      autocorrect="off"
      spellcheck="false"
      enterkeyhint="search"
      :lang="transliterating ? 'grc-Latn' : 'grc'"
      :content="{ align: 'start', collisionPadding: 12 }"
      :ui="{
        root: 'has-focus-visible:z-auto',
        base: 'shadow-xs max-md:text-base focus-visible:outline-transparent',
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
      <!-- The clear button replaces the search icon once the input isn't empty. -->
      <template #leading>
        <UButton
          v-if="query"
          icon="i-lucide-x"
          color="neutral"
          variant="link"
          size="sm"
          class="p-0 shadow-none"
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
          v-if="!defaultOptions && toSearchQuery(query)"
          class="flex items-center gap-2 px-2.5 pt-2 text-xs text-muted"
        >
          <UIcon
            name="i-lucide-list-filter"
            class="size-3.5 shrink-0"
          />
          <span class="grow">{{ optionsSummary }}</span>
          <UButton
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
        <span v-if="!toSearchQuery(searchTerm)">Saisissez un mot {{ transliterating ? "translittéré" : "en beta code" }} (p. ex. <em>{{ transliterating ? "lógos" : "logos" }}</em>) ou en grec.</span>
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
    <SearchOptions />
  </UFieldGroup>
</template>
