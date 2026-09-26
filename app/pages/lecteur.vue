<script setup lang="ts">
  import { entryRoute } from "~/utils/entryUri";

  definePageMeta({
    layout: "single-column",
  });

  const route = useRoute();

  /**
   * The entries to show (`?q=uri1,uri2`, or `?items=…` as in former links).
   */
  const uris = computed((): string[] => {
    const query = route.query.q ?? route.query.items;
    return (typeof query === "string" ? query : "")
      .split(",")
      .map(uri => uri.trim())
      .filter(Boolean)
      .slice(0, 30);
  });

  /**
   * The (ambiguous) form whose link led to the reader (`?forme=…`).
   */
  const form = computed((): string | undefined => {
    const value = route.query.forme;
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

  // The reader is useless for a single entry: its page shows it.
  if (entries.value.length === 1 && !missing.value.length) {
    await navigateTo(entryRoute(entries.value[0]!.uri), { redirectCode: 302, replace: true });
  }

  // Greek may be transliterated (a preference).
  const greek = useGreek();

  const sections = computed(() => entries.value.map((entry, index) => ({ id: `entree-${index + 1}`, entry })));

  const countLabel = computed(() => `${entries.value.length} ${entries.value.length > 1 ? "entrées" : "entrée"}`);

  useSeoMeta({
    title: () => (form.value ? `${form.value} (graphie ambiguë)` : "Lecteur"),
    robots: "noindex",
  });

  /**
   * The entry being read: the last one whose top has passed a "reading line"
   * (a quarter of the window), or the last one at the bottom of the page. It
   * is highlighted, and kept visible, in the bar of headwords.
   */
  const currentId = ref<string>();
  const bar = useTemplateRef<HTMLElement>("bar");
  const { y } = useWindowScroll();

  const updateCurrent = (): void => {
    const elements = sections.value
      .map(({ id }) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (!elements.length) return;

    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    const readingLine = window.innerHeight / 4;
    let current = elements[0]!;
    for (const element of elements) {
      if (element.getBoundingClientRect().top <= readingLine) current = element;
    }
    currentId.value = atBottom ? elements.at(-1)!.id : current.id;
  };

  onMounted(updateCurrent);
  watch(y, () => requestAnimationFrame(updateCurrent));
  watch(currentId, (id) => {
    bar.value?.querySelector(`[href$="#${id}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
</script>

<template>
  <div>
    <header class="mb-6">
      <template v-if="form">
        <h1 class="font-serif text-3xl font-bold">
          {{ greek.text(form) }}
        </h1>
        <p class="mt-1 text-muted">
          Graphie ambiguë<template v-if="entries.length > 1">
            · {{ countLabel }}
          </template>
        </p>
      </template>
      <template v-else>
        <h1 class="text-2xl font-bold">
          Lecteur
        </h1>
        <p
          v-if="entries.length"
          class="mt-1 text-muted"
        >
          {{ countLabel }}
        </p>
      </template>

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
    </header>

    <!--
      The headwords, to go from an entry to another: a bar that sticks under
      the header (cf. `--header-bottom`), scrolling horizontally if needed.
    -->
    <nav
      v-if="sections.length > 1"
      ref="bar"
      aria-label="Accès rapide aux entrées"
      class="sticky top-(--header-bottom) z-10 -mx-2 mb-6 flex gap-2 overflow-x-auto bg-white/95 px-2 py-2 backdrop-blur-sm transition-[top] duration-300 ease-out motion-reduce:transition-none"
    >
      <UButton
        v-for="{ id, entry } in sections"
        :key="id"
        :to="{ query: route.query, hash: `#${id}` }"
        :label="greek.text(entry.word)"
        :aria-current="currentId === id ? 'true' : undefined"
        :color="currentId === id ? 'primary' : 'neutral'"
        :variant="currentId === id ? 'subtle' : 'outline'"
        class="shrink-0 font-serif text-base"
      />
    </nav>

    <div class="space-y-16">
      <section
        v-for="{ id, entry } in sections"
        :id="id"
        :key="id"
        :aria-labelledby="`${id}-titre`"
        class="scroll-mt-[calc(var(--header-bottom)+4.5rem)]"
      >
        <header class="mb-4 flex items-center gap-3">
          <h2
            :id="`${id}-titre`"
            class="font-serif text-2xl font-bold"
          >
            {{ greek.text(entry.word) }}
          </h2>
          <UButton
            :to="entryRoute(entry.uri)"
            icon="i-lucide-arrow-up-right"
            color="neutral"
            variant="ghost"
            class="ms-auto"
            :aria-label="`Ouvrir l'entrée ${greek.text(entry.word)}`"
          />
        </header>
        <EntryCard
          :entry="entry"
          toolbar
          no-anchors
        />
      </section>
    </div>
  </div>
</template>
