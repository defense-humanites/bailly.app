<script setup lang="ts">
  import { InputMode, StorageKey } from "~/enums";

  /**
   * A part of a tip's text: words, a key of the keyboard (`kbd`), or an
   * example of a search (`search`), a button typing it in the field.
   */
  type TipPart = string | { kbd: string } | { search: string };

  /**
   * A tip on the home page: a feature of the application, drawn at random
   * among those that apply (e.g. beta code, unless typing in
   * transliteration; the keyboard's arrows with a fine pointer; the
   * synchronization, unless the bookmarks are synchronized), not the one
   * shown last time; with an action when one shows it, after the sentence
   * (a button with its icon, as in the news, in gold: `INLINE_BUTTON_GOLD`).
   */
  type Tip = {
    id: string;
    text: TipPart[];
    /**
     * An example of a search, typed in the field (`search`); a page
     * (`to`); the search's options (`options`); or the citation's button
     * of the entry drawn at random beside it, pointed out (`citation`).
     */
    action?: { label: string; icon: string; search?: string; to?: string; options?: true; citation?: true };
    when?: () => boolean;
  };

  const { inputMode, inflectedForms } = useSearchOptions();
  const searchFocus = useSearchFocus();
  const optionsPanel = useSearchOptionsPanel();
  // Whether the bookmarks are synchronized already (the cookie, known at
  // once; the store, once it has read IndexedDB).
  const syncHint = useCookie<unknown>(SYNC_HINT_COOKIE, syncHintCookieOptions);
  const syncStore = useSyncStore();
  const bookmarksSynchronized = (): boolean => syncStore.enabled || parseSyncHint(syncHint.value).includes("bookmarks");

  const SEARCH_ICON = "i-lucide-search";

  const TIPS: Tip[] = [
    {
      id: "citation",
      text: ["Citez une entrée en APA, MLA, ISO 690 ou Chicago."],
      action: { label: "Citer", icon: "i-lucide-quote", citation: true },
    },
    { id: "zotero", text: ["Enregistrez une entrée d'un clic avec Zotero."] },
    {
      id: "betacode",
      text: ["Tapez le grec en beta code : ", { search: "lo/gos" }, " donne λόγος."],
      when: () => inputMode.value !== InputMode.Transliteration,
    },
    {
      id: "inflected",
      text: ["Une forme fléchie mène à son lemme."],
      action: { label: "ἔλυσα", icon: SEARCH_ICON, search: "ἔλυσα" },
      when: () => inflectedForms.value,
    },
    {
      id: "wildcards",
      text: ["Jokers : ", { kbd: "?" }, " remplace une lettre, ", { kbd: "*" }, " plusieurs."],
      action: { label: "λ?γος", icon: SEARCH_ICON, search: "λ?γος" },
    },
    {
      id: "options",
      text: ["Cherchez une terminaison, avec ou sans accents."],
      action: { label: "Options", icon: "i-lucide-list-filter", options: true },
    },
    {
      id: "sync",
      text: ["Vos signets sur tous vos appareils, sans compte."],
      action: { label: "Synchroniser", icon: "i-lucide-cloud", to: "/signets" },
      when: () => !bookmarksSynchronized(),
    },
    {
      id: "arrows",
      text: ["Les touches ", { kbd: "←" }, " et ", { kbd: "→" }, " mènent aux entrées voisines."],
      when: () => window.matchMedia("(pointer: fine)").matches,
    },
    {
      id: "fonts",
      text: ["Lisez le grec dans la police de votre choix."],
      action: { label: "Préférences", icon: "i-lucide-sliders-horizontal", to: encodeURI("/préférences") },
    },
  ];

  /**
   * Drawn in the browser, once hydrated (the server's page the same for
   * all); its room kept until then (no layout shift).
   */
  const lastTip = useLocalStorage<string>(StorageKey.LastTip, "", { writeDefaults: false, initOnMounted: true });
  const tip = shallowRef<Tip>();
  onMounted(() => {
    const candidates = TIPS.filter(({ id, when }) => id !== lastTip.value && (when?.() ?? true));
    tip.value = candidates[Math.floor(Math.random() * candidates.length)];
    if (tip.value) lastTip.value = tip.value.id;
  });

  /** The citation's window opened after its button is pointed out (ms). */
  const CITATION_DELAY = 600;

  const search = (text: string): void => {
    searchFocus.focus({ text });
  };

  /**
   * The action of a tip without a page: a search typed, the search's
   * options opened, or the random entry's citation button pointed out in
   * gold, as the tip, then its window opened, once the eye has found it
   * (when its outline is at its brightest, cf. `card-highlight`); the focus
   * back on it when closed. Nothing if the entry is not shown yet.
   */
  const act = (action: NonNullable<Tip["action"]>): void => {
    if (action.search) {
      search(action.search);
      return;
    }
    if (action.options) {
      optionsPanel.open();
      return;
    }
    const button = document.querySelector<HTMLElement>("[data-random-opening] [data-citation]");
    if (!button) return;
    button.style.setProperty("--card-highlight", "var(--ui-warning)");
    revealThen(button, () => {
      pointOut(button);
      setTimeout(() => {
        button.querySelector("button")?.click();
      }, CITATION_DELAY);
    });
  };
</script>

<!--
  In gold (700, 6.2:1 on the page; 300 in the dark theme), as its bulb,
  without a frame: the color sets it apart. The column's whole width; its
  room one line high from a tablet, two on a phone (the tip centred in
  it), its lines a little apart (24 px), a button on the second one not
  too close to the first. The bulb, the same for every tip, facing its
  first line.
-->
<template>
  <div
    class="flex w-full items-center text-sm/6 text-(--ui-color-warning-700) max-md:min-h-12 md:min-h-6 dark:text-(--ui-color-warning-300)"
    :class="tip ? 'opacity-100 transition-opacity duration-300' : 'opacity-0'"
  >
    <p
      v-if="tip"
      class="flex items-start gap-2"
    >
      <UIcon
        name="i-lucide-lightbulb"
        class="mt-1 size-4 shrink-0 text-warning"
      />
      <span>
        <template
          v-for="(part, index) in tip.text"
          :key="index"
        >
          <template v-if="typeof part === 'string'">{{ part }}</template>
          <UKbd
            v-else-if="'kbd' in part"
            :value="part.kbd"
            class="align-[0.1em]"
          />
          <button
            v-else
            type="button"
            :class="INLINE_BUTTON_GOLD"
            :aria-label="`Rechercher « ${part.search} »`"
            @click="search(part.search)"
          >
            <UIcon
              :name="SEARCH_ICON"
              class="size-4 shrink-0"
            />{{ part.search }}
          </button>
        </template>
        <template v-if="tip.action">
          {{ " " }}<NuxtLink
            v-if="tip.action.to"
            :to="tip.action.to"
            :class="INLINE_BUTTON_GOLD"
          >
            <UIcon
              :name="tip.action.icon"
              class="size-4 shrink-0"
            />{{ tip.action.label }}
          </NuxtLink>
          <button
            v-else
            type="button"
            :class="INLINE_BUTTON_GOLD"
            :aria-label="tip.action.search ? `Rechercher « ${tip.action.search} »` : undefined"
            @click="act(tip.action)"
          >
            <UIcon
              :name="tip.action.icon"
              class="size-4 shrink-0"
            />{{ tip.action.label }}
          </button>
        </template>
      </span>
    </p>
  </div>
</template>
