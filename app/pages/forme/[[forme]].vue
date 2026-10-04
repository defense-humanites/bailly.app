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
      statusText: "Les entrées n'ont pas pu être chargées.",
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

  useSeoMeta({
    title: () => (form.value ? `${form.value} (graphie ambiguë)` : "Plusieurs entrées"),
    robots: "noindex",
  });

  /**
   * The entry in view: the last one whose top has passed a "reading line"
   * (a quarter of the window), the first one at the page's top, or the last
   * one at the bottom of a page that scrolled. It
   * is highlighted, and kept visible, in the lists of headwords.
   */
  const currentId = ref<string>();
  const bar = useTemplateRef<HTMLElement>("bar");
  const scroller = usePageScroller();
  const { y } = usePageScroll();

  const updateCurrent = (): void => {
    const elements = sections.value
      .map(({ id }) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (!elements.length) return;

    const box = scroller.value;
    // At the bottom of a page that scrolled (all the cards may fit).
    const atBottom = box ? box.scrollTop > 0 && box.clientHeight + box.scrollTop >= box.scrollHeight - 2 : false;
    // The reading line, lower than where a headword's link brings its card
    // (its scroll margin), on a short window too.
    const margin = Number.parseFloat(getComputedStyle(elements[0]!).scrollMarginTop) || 0;
    const readingLine = Math.max(window.innerHeight / 4, (box?.getBoundingClientRect().top ?? 0) + margin + 1);
    let current = elements[0]!;
    for (const element of elements) {
      if (element.getBoundingClientRect().top <= readingLine) current = element;
    }
    // At the page's top, the first one (all the cards may be in view).
    if (!box?.scrollTop) current = elements[0]!;
    currentId.value = atBottom ? elements.at(-1)!.id : current.id;
  };

  onMounted(updateCurrent);
  watch(y, () => requestAnimationFrame(updateCurrent));
  watch(currentId, (id) => {
    bar.value?.querySelector(`[href$="#${id}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
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

        <!-- From `xl`, the headwords in a column, to go from a card to another. -->
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
              <UButton
                :to="{ query: route.query, hash: `#${id}` }"
                :label="greek.text(entry.word)"
                :aria-current="currentId === id ? 'true' : undefined"
                :color="currentId === id ? 'primary' : 'neutral'"
                variant="ghost"
                block
                class="justify-start rounded-md font-serif"
                :class="currentId === id ? 'bg-primary/10 font-semibold' : 'text-muted hover:bg-(--app-page-hover)'"
              />
            </li>
          </ul>
        </nav>
      </div>
    </header>

    <!--
      Below `xl`, the headwords in a bar that sticks under the header (cf.
      `--header-bottom`), scrolling horizontally if needed.
    -->
    <nav
      v-if="sections.length > 1"
      ref="bar"
      aria-label="Accès rapide aux entrées"
      class="sticky top-(--header-bottom) z-10 -mx-2 mb-6 flex gap-2 overflow-x-auto bg-bar px-2 py-2 transition-[top] duration-300 ease-out motion-reduce:transition-none xl:hidden"
    >
      <UButton
        v-for="{ id, entry } in sections"
        :key="id"
        :to="{ query: route.query, hash: `#${id}` }"
        :label="greek.text(entry.word)"
        :aria-current="currentId === id ? 'true' : undefined"
        :color="currentId === id ? 'primary' : 'neutral'"
        :variant="currentId === id ? 'subtle' : 'outline'"
        class="shrink-0 font-serif text-xs/6"
      />
    </nav>

    <div
      ref="list"
      class="space-y-6"
    >
      <section
        v-for="{ id, entry } in sections"
        :id="id"
        :key="id"
        :aria-labelledby="`${id}-titre`"
        class="scroll-mt-[calc(var(--header-bottom)+4.5rem)] xl:scroll-mt-[calc(var(--header-bottom)+1.5rem)]"
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
