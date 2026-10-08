<script setup lang="ts">
  import { InputMode } from "~/enums";
  import { handOffSearch } from "~/utils/searchHandoff";

  /**
   * The search bar as the server renders it, until the page is interactive
   * (cf. `AppNavHorizontal`): the markup and classes of `SearchBar` (Nuxt
   * UI's field group, input menu and buttons) written out, without their
   * components, which were a large part of every page's server render (cf.
   * `audit-rendu-serveur.md`). Keep them in step with `SearchBar` (checked by
   * `test/e2e/search.spec.ts`).
   *
   * Meanwhile, the bar is a form: Enter looks the input up as a whole form on
   * the server (`/recherche`, cf. `server/routes/recherche.get.ts`); and what
   * is typed is handed to the search bar replacing it (cf. `handOffSearch`).
   */
  const { inputMode } = useSearchOptions();
  const transliterating = computed((): boolean => inputMode.value === InputMode.Transliteration);

  const input = useTemplateRef("input");

  onBeforeUnmount(() => {
    if (input.value) handOffSearch(input.value);
  });

  /** The bar's buttons (history, options), as `SearchHistory`'s and `SearchOptions`'. */
  const BUTTON = "font-medium inline-flex items-center disabled:cursor-not-allowed aria-disabled:cursor-not-allowed disabled:opacity-75 aria-disabled:opacity-75 transition-colors rounded-full shadow-xs text-sm gap-2 not-only:first:rounded-e-none not-only:last:rounded-s-none not-last:not-first:rounded-none focus-visible:z-[1] ring ring-inset ring-accented text-default bg-default disabled:bg-default aria-disabled:bg-default outline-inverted/25 focus-visible:outline-3 focus-visible:ring-inverted relative w-12 shrink-0 justify-center before:absolute before:inset-y-px before:start-0 before:w-px before:bg-(--ui-border) hover:bg-(--search-hover) active:bg-(--search-hover) group-has-[input:focus-visible]/search:ring-primary";
</script>

<template>
  <form
    action="/recherche"
    method="get"
    role="search"
    data-orientation="horizontal"
    class="relative inline-flex -space-x-px search-bar group/search rounded-full outline-primary/25 has-[input:focus-visible]:outline-3"
  >
    <div
      dir="ltr"
      data-slot="root"
      class="relative inline-flex items-center group has-focus-visible:z-auto w-full"
    >
      <input
        ref="input"
        name="q"
        type="text"
        autocomplete="off"
        data-slot="base"
        class="transition-colors rounded-full px-3 py-2 gap-2 text-highlighted bg-default ring ring-inset ring-accented w-full border-0 placeholder:text-dimmed group-not-only:group-first:rounded-e-none group-not-only:group-last:rounded-s-none group-not-last:group-not-first:rounded-none outline-primary/25 focus-visible:outline-3 focus-visible:ring-primary ps-10 pe-10 shadow-xs text-base/6 focus-visible:outline-transparent"
        :aria-label="`Rechercher une entrée (${transliterating ? 'translittération' : 'beta code'} ou grec)`"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        enterkeyhint="search"
        :lang="transliterating ? 'grc-Latn' : 'grc'"
        :placeholder="transliterating ? 'anazētéō…' : 'ἀναζητέω…'"
      >
      <span
        data-slot="leading"
        class="absolute inset-y-0 start-0 flex items-center ps-3"
      >
        <UIcon
          name="i-lucide-search"
          class="size-5 shrink-0 text-dimmed"
        />
      </span>
      <input
        v-if="transliterating"
        type="hidden"
        name="mode"
        :value="InputMode.Transliteration"
      >
    </div>
    <button
      type="button"
      data-slot="base"
      aria-label="Entrées consultées récemment"
      :class="[BUTTON, 'p-2']"
    >
      <UIcon
        name="i-lucide-history"
        class="shrink-0 size-5"
        data-slot="leadingIcon"
      />
    </button>
    <button
      type="button"
      data-slot="base"
      aria-label="Options de recherche"
      :class="[BUTTON, 'px-3 py-2 [--card-highlight:var(--ui-primary)]']"
    >
      <div
        data-slot="root"
        class="relative inline-flex items-center justify-center shrink-0"
      >
        <UIcon
          name="i-lucide-list-filter"
          class="size-5"
        />
      </div>
    </button>
  </form>
</template>
