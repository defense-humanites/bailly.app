<script setup lang="ts">
  import { entryRoute } from "~/utils/entryUri";
  import { definitionLength } from "~/utils/definitionLength";

  definePageMeta({
    layout: "single-column",
  });

  const route = useRoute();

  /**
   * The entries the form may belong to (`?q=uri1,uri2`).
   */
  const uris = computed((): string[] => {
    const query = route.query.q;
    return (typeof query === "string" ? query : "")
      .split(",")
      .map(uri => uri.trim())
      .filter(Boolean)
      .slice(0, 30);
  });

  /**
   * The (ambiguous) form (`/forme/<forme>`; none for the former links which
   * didn't tell it).
   */
  const form = computed((): string | undefined => {
    const value = route.params.forme;
    return typeof value === "string" ? value.trim().slice(0, 50) || undefined : undefined;
  });

  const { data, error } = await useApiEntries(uris, {
    fields: ["word", "uri", "excerpt", "htmlDefinition"],
  });

  if (error.value) {
    throw createError({
      status: error.value.status ?? 500,
      message: "Les entrées n'ont pas pu être chargées.",
    });
  }

  const entries = computed(() => data.value?.entries ?? []);
  const missing = computed(() => data.value?.missing ?? []);

  // Nothing to choose for a single entry: its page.
  if (entries.value.length === 1 && !missing.value.length) {
    await navigateTo(entryRoute(entries.value[0]!.uri), { redirectCode: 302, replace: true });
  }

  // Greek may be transliterated (a preference).
  const greek = useGreek();

  const readingSize = usePreferences().preference("readingSize");

  /**
   * The text sizes of the reading sizes, relative to the normal one.
   */
  const SIZE_SCALE = { small: 15.5 / 14, normal: 1, large: 15.5 / 17, larger: 15.5 / 18.5 } as const;

  /**
   * Whether an entry's text exceeds its card (cut, faded): measured in the
   * browser (cf. `measure`); guessed by the server from the text's length
   * (about 450 characters at the normal size fill the card in the reading
   * width), so that a short entry isn't faded meanwhile.
   */
  const guessClipped = (entry: (typeof entries.value)[number]): boolean => {
    const length = [entry, ...(entry.children ?? [])]
      .reduce((total, { htmlDefinition }) => total + definitionLength(htmlDefinition), 0);
    return length > 450 * SIZE_SCALE[readingSize.value] ** 2;
  };

  const sections = computed(() => entries.value.map((entry, index) => ({ id: `entree-${index + 1}`, entry })));
  const countLabel = computed(() => `${entries.value.length} ${entries.value.length > 1 ? "entrées" : "entrée"}`);

  const measured = ref<Record<string, boolean>>({});
  const clipped = (id: string, entry: (typeof entries.value)[number]): boolean => measured.value[id] ?? guessClipped(entry);

  /**
   * Measures which texts exceed their card (the reading size, the width).
   */
  const measure = (): void => {
    const result: Record<string, boolean> = {};
    for (const { id } of sections.value) {
      const box = document.querySelector<HTMLElement>(`#${id} [data-clip]`);
      if (box) result[id] = box.scrollHeight > box.clientHeight + 1;
    }
    measured.value = result;
  };
  const list = useTemplateRef<HTMLElement>("list");
  useResizeObserver(list, measure);
  onMounted(measure);

  // The headwords are bold: their face is fetched with the page.
  usePreloadBoldFace();

  useSeoMeta({
    title: () => (form.value ? `${form.value} (graphie ambiguë)` : "Plusieurs entrées"),
    robots: "noindex",
  });

  /**
   * The entry in view, marked in the headwords' column (from `xl`; below,
   * the table of contents finds it by itself), cf. `useCurrentSection`.
   */
  const { currentId, follow } = useCurrentSection(() => sections.value.map(({ id }) => id));

  /**
   * Follows a headword's link: its card, once reached, is pointed out (as a
   * bookmarks' card, cf. `highlightCard`).
   */
  const pointOut = (id: string): void => {
    follow(id);
    const card = document.getElementById(id);
    if (card) highlightCard(card);
  };

  /**
   * The headwords' table of contents below `xl` (cf. `BookmarksToc`).
   */
  const toc = computed(() => sections.value.map(({ id, entry }) => ({ key: id, id, name: greek.text(entry.word), serif: true })));
</script>

<template>
  <div class="relative">
    <!--
      The entries a form may belong to, to choose one: a card each, its text
      cut and faded when long (as the home page's random entry), the whole
      card a link to the entry. The cards stay under the search bar, as an
      entry on its page; the title and the headwords lie on their right from
      `xl` (where the column leaves room), above them below.
    -->
    <header class="mb-6 xl:absolute xl:start-full xl:top-0 xl:ms-12 xl:mb-0 xl:h-full xl:w-56">
      <div class="xl:sticky xl:top-[calc(var(--header-bottom)+1.5rem)]">
        <h1
          v-if="form"
          class="font-serif text-2xl/9 font-bold"
        >
          {{ greek.text(form) }}
        </h1>
        <h1
          v-else
          class="text-2xl font-bold"
        >
          Plusieurs entrées
        </h1>
        <p
          v-if="entries.length"
          class="mt-1 text-muted"
        >
          <template v-if="form">
            Graphie ambiguë · {{ countLabel }}
          </template>
          <template v-else>
            {{ countLabel }}
          </template>
        </p>

        <UAlert
          v-if="missing.length"
          class="mt-4"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          role="status"
          :description="`${missing.length > 1 ? 'Entrées introuvables' : 'Entrée introuvable'} : ${missing.join(', ')}.`"
        />
        <p
          v-else-if="!entries.length"
          class="mt-4 text-muted"
        >
          Aucune entrée à afficher.
        </p>

        <!--
          From `xl`, the headwords in a column: links to their cards (pointed
          out once reached), the one in view marked, in neutral colors.
        -->
        <nav
          v-if="sections.length > 1"
          aria-label="Accès rapide aux entrées"
          class="mt-6 hidden xl:block"
        >
          <ul class="space-y-1">
            <li
              v-for="{ id, entry } in sections"
              :key="id"
            >
              <NuxtLink
                :to="{ query: route.query, hash: `#${id}` }"
                :aria-current="currentId === id ? 'location' : undefined"
                class="block truncate rounded-md px-2.5 py-1.5 font-serif text-sm transition-colors focus-visible:outline-2 focus-visible:outline-(--ui-border-inverted)"
                :class="currentId === id ? 'bg-accented/50 font-semibold text-highlighted' : 'text-muted hover:bg-accented/50 hover:text-highlighted'"
                @click="pointOut(id)"
              >{{ greek.text(entry.word) }}</NuxtLink>
            </li>
          </ul>
        </nav>
      </div>
    </header>

    <!--
      Below `xl`, the headwords in a table of contents as the bookmarks'
      (sticky under the header, scrolling sideways), in neutral colors: no
      entry's bar (whose title and arrows tell the entry read and lead to its
      neighbours).
    -->
    <BookmarksToc
      v-if="sections.length > 1"
      :groups="toc"
      label="Accès rapide aux entrées"
      class="mb-6 xl:hidden"
    />

    <div
      ref="list"
      class="space-y-6"
    >
      <section
        v-for="{ id, entry } in sections"
        :id="id"
        :key="id"
        :aria-labelledby="`${id}-titre`"
        class="rounded-lg [--card-highlight:var(--ui-color-neutral-400)] scroll-mt-[calc(var(--header-bottom)+4.5rem)] xl:scroll-mt-[calc(var(--header-bottom)+1.5rem)]"
      >
        <h2
          :id="`${id}-titre`"
          class="sr-only"
        >
          {{ greek.text(entry.word) }}
        </h2>
        <!--
          The card, a link to the entry (its definition without links); the
          arrow of the entries' links in its corner, where an entry's
          toolbar would be.
        -->
        <NuxtLink
          :to="entryRoute(entry.uri)"
          :aria-label="`Ouvrir l'entrée ${greek.text(entry.word)}`"
          class="group block rounded-lg bg-default ring ring-default transition-shadow hover:shadow-md hover:ring-accented focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <div
            data-clip
            class="max-h-80 overflow-hidden"
            :class="{ 'mask-b-from-70%': clipped(id, entry) }"
          >
            <EntryCard
              :entry="entry"
              no-links
              no-anchors
              :ui="{ root: 'bg-transparent shadow-none ring-0' }"
            >
              <template #aside>
                <UIcon
                  name="i-lucide-arrow-up-right"
                  class="size-5 text-dimmed transition-colors group-hover:text-primary"
                />
              </template>
            </EntryCard>
          </div>
        </NuxtLink>
      </section>
    </div>
  </div>
</template>
