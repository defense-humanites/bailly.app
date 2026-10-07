<script setup lang="ts">
  import type { ApiRandomEntryData, ApiResponse, Entry, RandomEntryParams, Siblings } from "#shared/types/api";
  import { toApiQuery } from "#shared/utils/api";

  type Shown = {
    entry: Entry<"word" | "uri" | "excerpt" | "htmlDefinition">;
    siblings: Siblings<"word" | "uri" | "excerpt">;
  };

  const { $api } = useNuxtApp();
  const greek = useGreek();
  const { preference } = usePreferences();
  const readingWeight = preference("readingWeight");
  const { apiHost } = useRuntimeConfig().public;

  /**
   * The query of a random entry with its neighbors.
   */
  const RANDOM_QUERY = toApiQuery({
    fields: ["word", "uri", "excerpt", "htmlDefinition"],
    lengthRange: [400, 700],
    siblings: true,
    siblingsFields: ["word", "uri", "excerpt"],
  } satisfies RandomEntryParams<"word" | "uri" | "excerpt" | "htmlDefinition", "word" | "uri" | "excerpt">);

  /**
   * The preloaded request, as an absolute URL: the very same for the preload
   * link and the first fetch, which takes the preloaded response only if
   * their URLs are identical. The next draws must not take it: a browser
   * may keep serving a preloaded response to the requests of its URL (seen
   * in Safari: the same entry again, the button seeming to do nothing).
   */
  const url = new URL("entry/random", apiHost.endsWith("/") ? apiHost : `${apiHost}/`);
  url.search = new URLSearchParams(RANDOM_QUERY).toString();
  const RANDOM_ENTRY = url.href;

  /*
   * The page served preloads it: the browser fetches the entry while it
   * loads the scripts, rather than once the page is interactive. Not on a
   * navigation within the application, where the fetch starts at once (the
   * link would only add a request).
   */
  if (import.meta.server) {
    useHead({ link: [{ rel: "preload", as: "fetch", href: RANDOM_ENTRY, crossorigin: "anonymous" }] });
  }

  const shown = ref<Shown | null>(null);
  const loading = ref(false);
  const failed = ref(false);

  /*
   * Its links (the entry, its neighbors) are `nofollow`: drawn at random,
   * they shouldn't weigh as the home page's links do for the search engines
   * (which run the page's script, and would see them), nor show under the
   * site in their results.
   */

  /**
   * Loads the faces of the reading font an entry uses (its text, its bold
   * headwords, its italics), for at most 3 s (the time `fonts.css` lets a
   * face keep its text invisible): the entry is shown once they have come,
   * rather than its lines moving as each face arrives (a layout shift, on
   * slow networks).
   */
  function loadFaces(): Promise<unknown> {
    const family = readingFamily();
    if (!family) return Promise.resolve();
    const text = readingWeight.value === "bold" ? "bold" : "normal";
    const faces = [text, "bold", `italic ${text}`].map(face => document.fonts.load(`${face} 1em ${family}`, "α").catch(() => {}));
    return Promise.race([Promise.all(faces), new Promise(resolve => setTimeout(resolve, 3000))]);
  }

  /**
   * Opens the dictionary at random: a random entry with its neighbors, in a
   * single request. Fetched once the page is mounted, so that each visit
   * draws a new entry; the frame keeps its place meanwhile, until the entry
   * and its faces have come.
   * @param preloaded Whether to take the preloaded response (the first draw):
   *   the next ones are requested at another URL (the same query, its commas
   *   not encoded), bypassing the browser's caches.
   */
  async function draw(preloaded = false): Promise<void> {
    loading.value = true;
    failed.value = false;
    try {
      const [{ data }] = await Promise.all([
        preloaded
          ? $api<ApiResponse<ApiRandomEntryData<"word" | "uri" | "excerpt" | "htmlDefinition", "word" | "uri" | "excerpt">>>(RANDOM_ENTRY)
          : $api<ApiResponse<ApiRandomEntryData<"word" | "uri" | "excerpt" | "htmlDefinition", "word" | "uri" | "excerpt">>>("entry/random", { query: RANDOM_QUERY, cache: "no-store" }),
        loadFaces(),
      ]);
      // A group of homonyms: its first entry.
      shown.value = { entry: data.entry.children?.[0] ?? data.entry, siblings: data.siblings ?? {} };
    } catch {
      failed.value = true;
    } finally {
      loading.value = false;
    }
  }

  onMounted(() => draw(true));

  /**
   * A neighbor's excerpt without its word, which it starts with, possibly with
   * syllable dots (e.g. « ποη·φάγος » for ποηφάγος).
   */
  const rest = (sibling: { word: string; excerpt: string }): string => {
    let read = 0;
    let matched = 0;
    while (read < sibling.excerpt.length && matched < sibling.word.length) {
      const char = sibling.excerpt[read];
      if (char === sibling.word[matched]) matched++;
      else if (char !== "·" && char !== "‧") return sibling.excerpt;
      read++;
    }
    return matched === sibling.word.length
      ? sibling.excerpt.slice(read).replace(/^[\s,]+/, "")
      : sibling.excerpt;
  };
</script>

<template>
  <section
    aria-label="Le Bailly ouvert au hasard"
    class="flex flex-col"
  >
    <!-- The opened page, framed like the about page's hero: the neighbors above and below. -->
    <div class="rounded-xl border-2 border-terracotta-700 px-3 py-3 shadow-[inset_0_0_0_5px_var(--app-page-bg),inset_0_0_0_6px_var(--color-terracotta-700)] sm:px-5 sm:py-4 dark:border-terracotta-700 dark:shadow-[inset_0_0_0_5px_var(--app-page-bg),inset_0_0_0_6px_var(--color-terracotta-700)]">
      <template
        v-for="position in (['previous', 'main', 'next'] as const)"
        :key="position"
      >
        <!--
          The entry lies on the page's background, not on a card: the hovered
          buttons of its toolbar take the cards' background (`bg-default`),
          a shade lighter than the page in both themes (`bg-elevated` is as
          dark as the page in the light theme, much lighter in the dark one).
        -->
        <div
          v-if="position === 'main'"
          class="h-80 border-y border-terracotta-700/25 py-2 dark:border-terracotta-600/30"
          :aria-busy="loading"
        >
          <EntryCard
            v-if="shown"
            :entry="shown.entry"
            toolbar
            link
            link-rel="nofollow"
            :ui="{
              root: 'h-full flex overflow-hidden bg-transparent shadow-none ring-0 rounded-none [--ui-bg-elevated:var(--ui-bg)]',
              body: 'h-full mask-b-from-80%',
            }"
          />
          <p
            v-else-if="failed"
            class="flex h-full items-center justify-center p-4 text-center text-muted"
          >
            L'entrée n'a pas pu être chargée.
          </p>
          <div
            v-else
            class="grid gap-4 p-4"
          >
            <USkeleton class="h-4 w-1/3" />
            <USkeleton
              v-for="n in 6"
              :key="n"
              class="h-3"
              :class="n % 2 ? 'w-full' : 'w-11/12'"
            />
          </div>
        </div>
        <div
          v-else
          class="h-12 py-1.5"
        >
          <NuxtLink
            v-if="shown?.siblings[position]"
            :to="entryRoute(shown.siblings[position].uri)"
            rel="nofollow"
            :aria-label="`${position === 'previous' ? 'Entrée précédente' : 'Entrée suivante'} : ${greek.text(shown.siblings[position].word)}`"
            class="block rounded-md px-4 py-1 opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100"
          >
            <span class="line-clamp-1 font-serif text-sm/6"><strong>{{ greek.text(shown.siblings[position].word) }}</strong> <span class="text-muted">{{ greek.text(rest(shown.siblings[position])) }}</span></span>
          </NuxtLink>
        </div>
      </template>
    </div>

    <div class="mt-4 flex justify-center">
      <UButton
        color="neutral"
        variant="ghost"
        class="hover:bg-(--app-page-hover) active:bg-(--app-page-hover)"
        icon="i-lucide-dices"
        label="Ouvrir à une autre page"
        :loading="loading"
        @click="draw()"
      />
    </div>
    <p
      class="sr-only"
      role="status"
    >
      {{ failed ? "L'entrée n'a pas pu être chargée." : shown ? `Entrée ouverte : ${greek.text(shown.entry.word)}` : "" }}
    </p>
  </section>
</template>
