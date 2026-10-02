<script setup lang="ts">
  import type { ApiEntryData, ApiRandomEntryData, ApiResponse, Entry, Siblings } from "#shared/types/api";
  import { toApiQuery } from "#shared/utils/api";

  type Shown = {
    entry: Entry<"word" | "uri" | "excerpt" | "htmlDefinition">;
    siblings: Siblings<"word" | "uri" | "excerpt">;
  };

  const { $api } = useNuxtApp();
  const greek = useGreek();

  const shown = ref<Shown | null>(null);
  const loading = ref(false);
  const failed = ref(false);

  /**
   * Opens the dictionary at random: a random entry, then the entry with its
   * neighbors (`/entry/random` doesn't give them). Fetched once the page is
   * mounted, so that each visit draws a new entry; the frame keeps its place
   * meanwhile.
   */
  async function draw(): Promise<void> {
    loading.value = true;
    failed.value = false;
    try {
      const random = await $api<ApiResponse<ApiRandomEntryData<"uri">>>("entry/random", {
        query: toApiQuery({ fields: ["uri"], lengthRange: [400, 700] }),
      });
      const { data } = await $api<ApiResponse<ApiEntryData<"word" | "uri" | "excerpt" | "htmlDefinition", "word" | "uri" | "excerpt">>>(
        `entry/${encodeURIComponent(random.data.entry.uri)}`,
        {
          query: toApiQuery({
            fields: ["word", "uri", "excerpt", "htmlDefinition"],
            siblings: true,
            siblingsFields: ["word", "uri", "excerpt"],
          }),
        },
      );
      const entry = data.entry as Shown["entry"];
      // A group of homonyms: its first entry.
      shown.value = { entry: entry.children?.[0] ?? entry, siblings: data.siblings ?? {} };
    } catch {
      failed.value = true;
    } finally {
      loading.value = false;
    }
  }

  onMounted(draw);

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
    aria-labelledby="au-hasard"
    class="flex flex-col"
  >
    <h2
      id="au-hasard"
      class="mb-4 text-center text-xs font-semibold tracking-[0.2em] text-muted uppercase"
    >
      Le Bailly ouvert au hasard
    </h2>

    <!-- The opened page, framed like the about page's hero: the neighbors above and below. -->
    <div class="rounded-xl border-2 border-terracotta-700 px-3 py-3 shadow-[inset_0_0_0_5px_var(--app-page-bg),inset_0_0_0_6px_var(--color-terracotta-700)] sm:px-5 sm:py-4 dark:border-terracotta-600 dark:shadow-[inset_0_0_0_5px_var(--app-page-bg),inset_0_0_0_6px_var(--color-terracotta-600)]">
      <template
        v-for="position in (['previous', 'main', 'next'] as const)"
        :key="position"
      >
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
            :ui="{
              root: 'h-full flex overflow-hidden bg-transparent shadow-none ring-0 rounded-none',
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
        icon="i-lucide-dices"
        label="Ouvrir à une autre page"
        :loading="loading"
        @click="draw"
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
