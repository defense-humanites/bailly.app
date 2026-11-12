<script setup lang="ts">
  import { InputMode } from "~/enums";
  import { entryRoute } from "~/utils/entryUri";
  import { formatCount } from "~/utils/numbers";
  import { takeSearchHandoff } from "~/utils/searchHandoff";
  import { convertSearchInput, hasWildcards, toLookupQuery, toSearchGreek, toSearchQuery, toTransliteratedInput } from "~/utils/searchInput";
  import { searchResultGroups, type SearchResultItem } from "~/utils/searchResults";

  // (The input text is 16px on every screen (`text-base/6`): large enough to
  // check the Greek diacritics as they are typed, and, on mobile, the size
  // below which iOS Safari zooms in when the input gets the focus. The bar is
  // thus 40px high, its buttons with it, in the header (56px on mobile,
  // `--header-height` from `md`).)

  const { query, result, resultQuery, status, pending } = useEntrySearch();
  const { position, diacriticSensitive, inputMode, placeholder, isDefault: defaultOptions, reset: resetOptions } = useSearchOptions();

  const transliterating = computed((): boolean => inputMode.value === InputMode.Transliteration);

  const input = useTemplateRef<HTMLInputElement>("input");
  const field = useTemplateRef<HTMLElement>("field");

  /**
   * The whole bar (input and options button): the results are positioned
   * against it, rather than against the input alone, to be exactly as wide.
   */
  const group = useTemplateRef("group");
  const groupElement = computed((): HTMLElement | undefined => group.value?.$el as HTMLElement | undefined);

  /** The results' list box (the input's `aria-controls`). */
  const listId = useId();

  /**
   * Makes the input show `text` (the query just set, or being set), with the
   * caret at `caret` (by default, where it is). The input isn't bound to the
   * query (its text is the user's while typing, the query following it once
   * painted, cf. `setQueryAfterPaint`): the query set otherwise (cleared,
   * converted, handed over) is written here.
   */
  const syncInputText = (text: string, caret?: number): void => {
    const element = input.value;
    if (!element) return;

    void nextTick(() => {
      if (element.value !== text) element.value = text;
      if (caret !== undefined) element.setSelectionRange(caret, caret);
    });
  };

  // The input text follows the input mode (e.g. `λόγος` ⇄ `lógos`).
  watch(inputMode, (mode) => {
    finishTyping();
    if (!query.value) return;
    query.value = convertSearchInput(query.value, mode);
    syncInputText(query.value);
  });

  /**
   * The Greek query to look up (cf. `toLookupQuery`).
   */
  const lookupQuery = computed((): string => toLookupQuery(query.value, inputMode.value));

  /**
   * Whether the query has wildcards (cf. `hasWildcards`).
   */
  const wildcards = computed((): boolean => hasWildcards(lookupQuery.value));

  /**
   * A reminder of the search options that aren't the default ones, and of the
   * wildcards, above the results (e.g. « Entrées finissant par « λογος » ·
   * diacritiques respectés »).
   */
  const optionsSummary = computed((): string | undefined => {
    if ((defaultOptions.value && !wildcards.value) || !toSearchQuery(query.value)) return undefined;
    const term = `«\u00a0${toSearchQuery(query.value)}\u00a0»`;
    const parts = [
      {
        start: wildcards.value ? `Entrées commençant par ${term}` : "",
        contains: `Entrées contenant ${term}`,
        end: `Entrées finissant par ${term}`,
        exact: wildcards.value ? `Entrées correspondant à ${term}` : `Entrée identique à ${term}`,
      }[position.value],
      wildcards.value ? "?\u00a0: une lettre, *\u00a0: plusieurs" : "",
      diacriticSensitive.value ? "diacritiques respectés" : "",
    ].filter(Boolean);
    const summary = parts.join(" · ");
    return summary.charAt(0).toUpperCase() + summary.slice(1);
  });

  /**
   * Whether the results are asked for (typing, focus, Escape…), and whether
   * there is something to look up (not for an empty input, nor a lone
   * pending diacritic or capital mark); cf. `shown`.
   */
  const open = ref(false);
  const searchable = computed((): boolean => lookupQuery.value !== "");

  /**
   * Whether the input method is composing.
   */
  let composing = false;

  /**
   * The query typed, set once the letter is painted (with the results to
   * open, if any): what it changes (the results shown again, the panel
   * opened at the first letter, the bar's count and buttons) then happens
   * after the paint that answers the keystroke, in a task of its own, rather
   * than delaying it (the INP of the search bar, on mobile). Several letters
   * within a frame set the last one. `flushQuery` sets it at once, before
   * what reads it (Enter, the arrow keys).
   */
  let pendingQuery: { value: string; open: boolean } | null = null;
  const flushQuery = (): void => {
    if (!pendingQuery) return;
    const { value, open: opens } = pendingQuery;
    pendingQuery = null;
    query.value = value;
    if (opens) open.value = true;
  };
  const setQueryAfterPaint = (value: string, opens: boolean): void => {
    const scheduled = pendingQuery !== null;
    pendingQuery = { value, open: opens || (pendingQuery?.open ?? false) };
    if (scheduled) return;
    requestAnimationFrame(() => {
      const channel = new MessageChannel();
      channel.port1.onmessage = flushQuery;
      channel.port2.postMessage(null);
    });
  };

  /**
   * Whether the input may be converted while the input method composes: when
   * it has Beta Code (Latin letters, diacritics `/\=()+|`, capital mark `*`):
   * keyboards of Android compose whole words (ended by a space or a
   * suggestion, never in a search): their Beta Code is converted character
   * by character (rewriting the input ends the composition; the keyboard
   * starts another one with the next character). A dead key (a desktop
   * keyboard: `^`, `¨`, `´`, `` ` ``, `~`, `'`, `"`…, none of them Beta Code)
   * composes a lone mark, left alone until its letter comes.
   */
  const convertibleWhileComposing = (value: string): boolean => /[a-z/\\=()+|*]/i.test(value);

  /**
   * Converts the input (Beta Code, or Greek) into Greek, keeping the caret
   * where it was; transliterated, only the circumflex of eta and omega into
   * a macron (cf. `toTransliteratedInput`), the rest converted when looked
   * up (cf. `toLookupQuery`), at once even while composing (an Android
   * keyboard's word; a dead key's lone mark has nothing to convert). The
   * results open (as typing asks).
   */
  const onInput = (): void => {
    const element = input.value;
    if (!element) return;
    const value = element.value;

    if (composing && !transliterating.value && !convertibleWhileComposing(value)) {
      setQueryAfterPaint(value, true);
      return;
    }

    const convert = transliterating.value ? toTransliteratedInput : toSearchGreek;
    const caret = element.selectionStart ?? value.length;
    const converted = convert(value);

    setQueryAfterPaint(converted, true);

    if (converted !== value) {
      syncInputText(converted, caret === value.length ? converted.length : convert(value.slice(0, caret)).length);
    }
  };

  const onCompositionStart = (): void => {
    composing = true;
  };

  /**
   * The composition ended: its text converted as a whole (a dead key's mark
   * with its letter; what a browser that doesn't tell the text composed,
   * e.g. Samsung Internet, typed meanwhile).
   */
  const onCompositionEnd = (): void => {
    composing = false;
    onInput();
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

  /**
   * A search handed over by a home page's tip (`useSearchFocus`), typed in
   * the field letter by letter, a keystroke every `TYPING_STEP` ms (its
   * conversion included: `lo/` shows « λό »), at once if motion is reduced.
   * Only the input's text is animated: the query is set at once (a single
   * lookup, of the whole word: no partial forms looked up, nor analyzed),
   * the results and their count shown once it is typed (`typing`). A key,
   * a pointer down in the field, or another request ends it: the whole
   * text then shows, the caret at its end.
   */
  const TYPING_STEP = 80;
  const reducedMotion = usePreferredReducedMotion();
  const typing = ref(false);
  let typingTimer: ReturnType<typeof setTimeout> | undefined;
  const cancelTyping = (): void => {
    clearTimeout(typingTimer);
    typing.value = false;
  };
  const finishTyping = (): void => {
    if (!typing.value) return;
    cancelTyping();
    const element = input.value;
    if (!element) return;
    element.value = query.value;
    element.setSelectionRange(query.value.length, query.value.length);
  };
  const typeSearch = (text: string): void => {
    cancelTyping();
    pendingQuery = null;
    const convert = (value: string): string => transliterating.value ? toTransliteratedInput(value) : toSearchGreek(value);
    query.value = convert(text);
    open.value = true;
    const element = input.value;
    if (!element || reducedMotion.value === "reduce") {
      syncInputText(query.value, query.value.length);
      return;
    }
    // What the field shows after each keystroke (a diacritic changes its
    // letter), the last one the query.
    const steps: string[] = [];
    for (let end = 1; end <= text.length; end++) {
      const shown = end === text.length ? query.value : convert(text.slice(0, end));
      if (shown !== steps.at(-1)) steps.push(shown);
    }
    typing.value = true;
    let step = 0;
    const next = (): void => {
      const value = steps[step++] ?? query.value;
      element.value = value;
      element.setSelectionRange(value.length, value.length);
      if (step < steps.length) typingTimer = setTimeout(next, TYPING_STEP);
      else typing.value = false;
    };
    next();
  };
  onBeforeUnmount(cancelTyping);

  const clear = (): void => {
    cancelTyping();
    pendingQuery = null;
    query.value = "";
    syncInputText("");
    input.value?.focus();
  };

  // The query of a search bar mounted again (the entry's layout, once
  // hydrated): its text in the input.
  onMounted(() => {
    if (query.value && input.value) input.value.value = query.value;
  });

  // What was typed in the server's search bar, before the page was
  // interactive (cf. `SearchBarStatic`): converted as typing does, the caret
  // and the focus where they were (the results then show).
  onMounted(() => {
    const handoff = takeSearchHandoff();
    if (!handoff) return;

    if (handoff.focused) {
      input.value?.focus({ preventScroll: true });
      open.value = true;
    }
    handoff.keeper?.remove();

    if (handoff.text) {
      const convert = (text: string): string => transliterating.value ? toTransliteratedInput(text) : toSearchGreek(text);
      query.value = convert(handoff.text);
      syncInputText(query.value, convert(handoff.text.slice(0, handoff.caret)).length);
    }
  });

  // Another component may ask for the focus (e.g. the about page's "Search a
  // word" button, the home page as it opens), possibly with a search to type
  // (a home page's tip), possibly before the search bar is mounted.
  const searchFocus = useSearchFocus();
  const onFocusRequest = (): void => {
    const request = searchFocus.take();
    if (!request || (request.ifEmpty && hasQuery.value)) return;
    input.value?.focus();
    // A search to type (converted as typing does), its results shown.
    if (request.text) typeSearch(request.text);
  };
  watch(searchFocus.request, onFocusRequest);
  onMounted(onFocusRequest);

  /**
   * Whether the input isn't empty: the results then show up again when the
   * input gets the focus (or is clicked, e.g. after closing them with Escape).
   */
  const hasQuery = computed((): boolean => query.value.trim() !== "");

  /**
   * Whether a search was answered (its results, or its failure) since the
   * input was last empty: until then, there is nothing to show, neither the
   * results of an earlier search nor a « Recherche… » (e.g. at the first
   * search); a slow search is told by the bar's count (cf. `slow`). After
   * that, the results of the previous letters remain until the next ones
   * come.
   */
  const answered = ref(hasQuery.value && result.value !== null);
  watch(hasQuery, (has) => {
    if (!has) answered.value = false;
  });
  watch([result, status], ([, value]) => {
    if (hasQuery.value && (value === "success" || value === "error")) answered.value = true;
  });

  /**
   * The bar's panels (results, history, options), one giving way to another
   * (cf. `SearchPanels`): the results, asked for while another panel is in
   * the page, wait for it to be gone (`allowed`). Their panel in the page
   * while shown or closing (`present`).
   */
  const panels = createSearchPanels();
  provide(searchPanelsKey, panels);
  const present = ref(false);
  const close = (): void => {
    open.value = false;
  };
  panels.register("results", { present, close });
  const onResultsClosed = (): void => {
    present.value = false;
    panels.gone("results");
  };
  const allowed = ref(true);
  const wanted = computed((): boolean => open.value && searchable.value && answered.value && !typing.value);
  watch(wanted, async (want) => {
    if (!want || !panels.othersPresent("results")) return;
    allowed.value = false;
    await panels.switchTo("results");
    allowed.value = true;
  }, { flush: "sync" });

  /**
   * Whether the results are shown: asked for, something to look up, an
   * answer to show (cf. `answered`), a tip's search typed (cf.
   * `typeSearch`), and no other panel in their place.
   */
  const shown = computed((): boolean => wanted.value && allowed.value);
  watch(shown, (value) => {
    if (value) present.value = true;
  }, { immediate: true });

  /**
   * A pointer down on the bar for another panel than the one open (the
   * field for the results, a button for its panel): a switch, the closing
   * shortened from the start (the open panel closes on the pointer down).
   */
  const onBarPointerDown = (event: PointerEvent): void => {
    const target = event.target as Element | null;
    const button = target?.closest<HTMLElement>("[data-search-panel]");
    const name = (button?.dataset.searchPanel ?? (field.value?.contains(target) ? "results" : undefined)) as SearchPanelName | undefined;
    if (name && panels.othersPresent(name)) panels.markSwitch();
  };

  /**
   * The results, in their groups (cf. `searchResultGroups`): none until a
   * search is answered (cf. `answered`). They change with the result (and
   * not as letters are typed): the list is only rendered again then.
   */
  const groups = computed(() => (answered.value ? searchResultGroups(result.value?.entries ?? []) : []));
  const results = computed((): SearchResultItem[] => groups.value.flatMap(group => group.items));

  const hasMorpheusResults = computed((): boolean =>
    Boolean(result.value?.entries.some(entry => entry.isMorpheus)),
  );

  /**
   * Whether the user dismissed the warning about morphological results.
   */
  const morpheusWarningDismissed = useDismissed("morpheusWarning");

  /**
   * Below the results shown (the API's first ones, `count`), how many others
   * were found (`countAll` beyond them), which a more precise search brings:
   * on one line on a phone (from 360 px or so).
   */
  const footer = computed((): string | undefined => {
    const others = (result.value?.countAll ?? 0) - (result.value?.count ?? 0);
    if (others <= 0) return undefined;
    return `+ ${formatCount(others)} ${others === 1 ? "autre résultat" : "autres résultats"} (affinez votre recherche)`;
  });

  /**
   * What the panel says without results: about the search answered last
   * (`resultQuery`), the next one pending meanwhile (cf. `answered`).
   */
  const emptyText = computed((): string => {
    if (status.value === "error") return "La recherche a échoué. Veuillez réessayer.";
    return `Aucun résultat pour «\u00a0${resultQuery.value}\u00a0».`;
  });

  /**
   * The highlighted result (its index; -1: none), chosen by the user (arrow
   * keys, pointer): none for new results, Enter then following `onEnter`.
   */
  const highlighted = ref(-1);

  watch([query, result], () => {
    highlighted.value = -1;
  });

  /**
   * Whether Enter was pressed before the results of the query came.
   */
  let enterPending = false;

  watch(query, () => {
    enterPending = false;
  });

  /**
   * Opens a result: its entry page (a homonym, its anchor in it), the results
   * closed and the input left (the blur closes a mobile keyboard; the
   * results remain, shown again as the input gets the focus).
   */
  const openResult = (uri: string): void => {
    open.value = false;
    input.value?.blur();
    void navigateTo(entryRoute(uri));
  };

  const select = (index: number): void => {
    const item = results.value[index];
    if (item) openResult(item.uri);
  };

  /** A result pointed at: highlighted. */
  const point = (index: number): void => {
    highlighted.value = index;
  };

  /**
   * Enter without a chosen result: the only exact match (an entry, or
   * homonyms under their headword) is opened; otherwise, the first result is
   * highlighted, for a second Enter to open it.
   */
  const onEnter = (): void => {
    const exact = result.value?.entries.filter(entry => entry.isExact) ?? [];

    if (exact.length === 1) {
      openResult(exact[0]!.uri);
    } else if (results.value.length) {
      highlighted.value = 0;
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
   * The keys of a combobox (APG): the arrows open the results, or move
   * through them (the first press highlights the first result), without
   * wrapping; Enter opens the highlighted result, or follows `onEnter`;
   * Escape closes the results. The other keys are the input's (Home and End
   * move the caret).
   */
  const onKeydown = (event: KeyboardEvent): void => {
    finishTyping();
    if (event.isComposing) return;
    flushQuery();

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!shown.value) {
        if (!hasQuery.value) return;
        open.value = true;
      }
      if (!results.value.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      highlighted.value = highlighted.value < 0 ? 0 : Math.min(results.value.length - 1, Math.max(0, highlighted.value + step));
    } else if (event.key === "Enter" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (shown.value && highlighted.value >= 0) select(highlighted.value);
      else if (pending.value || resultQuery.value !== query.value) enterPending = true;
      else onEnter();
    } else if (event.key === "Escape" && shown.value) {
      event.preventDefault();
      event.stopPropagation();
      open.value = false;
    }
  };

  /** The results shown again as the input gets the focus, or is clicked. */
  const reopen = (): void => {
    if (hasQuery.value) open.value = true;
  };

  /** The highlighted result, for screen readers. */
  const activeDescendant = computed((): string | undefined =>
    shown.value && highlighted.value >= 0 ? `${listId}-${highlighted.value}` : undefined,
  );
</script>

<template>
  <!--
    The options button is attached to the input. The focus halo (outline)
    and ring of the input surround the whole bar, options button included:
    the input's own halo would stop short of it. The input isn't raised when
    focused (unlike in other field groups), so that the button's neutral
    left edge remains the divider (cf. SearchOptions).

    The field and its results: a combobox (APG), the focus staying in the
    input, the highlighted result told by `aria-activedescendant`; drawn as
    Nuxt UI's input menu drew them (its classes, kept in step with
    `SearchBarStatic`), which this replaces, with the results in a panel of
    their own (cf. `SearchResults`).
  -->
  <UFieldGroup
    ref="group"
    role="search"
    class="search-bar group/search rounded-full outline-primary/25 has-[input:focus-visible]:outline-3"
    @pointerdown.capture="onBarPointerDown"
  >
    <div
      ref="field"
      class="group relative inline-flex w-full items-center has-focus-visible:z-auto"
    >
      <!--
        Without its native appearance: Safari on iOS 16 drew its own field
        over the ring (a bar without its border, buttons aside). The halo is
        the whole bar's (cf. `UFieldGroup`), not the input's: its outline
        transparent at rest too, not only once focused, or its color faded
        out (`transition-colors`), a halo flashing over the input.
      -->
      <input
        ref="input"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="shown"
        :aria-controls="listId"
        :aria-activedescendant="activeDescendant"
        :aria-label="`Rechercher une entrée (${transliterating ? 'translittération' : 'beta code'} ou grec)`"
        :lang="transliterating ? 'grc-Latn' : 'grc'"
        :placeholder="placeholder"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        enterkeyhint="search"
        class="w-full appearance-none rounded-full border-0 bg-default py-2 ps-10 pe-10 text-base/6 text-highlighted shadow-xs ring ring-accented outline-transparent transition-colors ring-inset placeholder:text-dimmed group-not-only:group-first:rounded-e-none group-not-only:group-last:rounded-s-none group-not-last:group-not-first:rounded-none focus-visible:ring-primary focus-visible:outline-3"
        @input="onInput"
        @compositionstart="onCompositionStart"
        @pointerdown="finishTyping"
        @compositionend="onCompositionEnd"
        @keydown="onKeydown"
        @focus="reopen"
        @click="reopen"
      >
      <!-- The clear button replaces the search icon once the input isn't empty. -->
      <span
        class="absolute inset-y-0 start-0 flex items-center ps-3"
      >
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
      </span>
      <!--
        The result count, or a loading indicator when the lookup is slow. The
        previous count remains meanwhile.
      -->
      <span
        data-slot="trailing"
        class="absolute inset-y-0 end-0 flex items-center pe-3"
      >
        <UBadge
          v-if="query && !typing && (slow || (answered && result))"
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
            {{ formatCount(result?.countAll ?? 0) }}
          </template>
        </UBadge>
      </span>
    </div>
    <SearchHistory :reference="groupElement" />
    <SearchOptions :wildcards="wildcards" />
    <SearchResults
      :open="shown"
      :anchor="groupElement"
      :field="field ?? undefined"
      :list-id="listId"
      :groups="groups"
      :highlighted="highlighted"
      :summary="optionsSummary"
      :resettable="!defaultOptions"
      :warning="hasMorpheusResults && !morpheusWarningDismissed"
      :empty="emptyText"
      :footer="footer"
      @point="point"
      @select="select"
      @dismiss="open = false"
      @closed="onResultsClosed"
      @reset="resetOptions"
      @dismiss-warning="morpheusWarningDismissed = true"
    />
  </UFieldGroup>
</template>
