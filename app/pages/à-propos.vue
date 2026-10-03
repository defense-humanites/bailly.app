<script setup lang="ts">
  /*
   * The hero is a cover: the header's items are hidden while the page is at
   * its top (cf. `AppNavHorizontal`), its height and background framing it.
   */
  definePageMeta({ headerCover: true });

  useSeoMeta({
    title: "À propos",
    description: "Le dictionnaire grec-français d'Anatole Bailly, révisé par Gérard Gréco et son équipe : une application libre et gratuite pour le consulter.",
  });

  const searchFocus = useSearchFocus();

  /**
   * Key figures of the 2020 digital edition (after its notice).
   */
  const figures = [
    { value: "107 809", label: "entrées" },
    { value: "327 936", label: "références" },
    { value: "1 325", label: "auteurs cités" },
  ];

  /**
   * The search demonstration: the same word typed in each input mode.
   */
  const searchInputs = [
    { mode: "grec", text: "φυσις" },
    { mode: "beta code", text: "fusis" },
    { mode: "translittération", text: "phusis" },
  ];

  /**
   * The bookmarks demonstration: the favorites and some tags, as pills of the
   * table of contents of the bookmarks page (filled there for an active group).
   */
  const bookmarkPills = [
    { name: "Favoris", color: "Yellow", icon: "i-bailly-star-filled", count: 8, filled: false },
    { name: "Homère", color: "Blue", icon: "i-bailly-tag-filled", count: 12, filled: false },
    { name: "Tragédie", color: "Orange", icon: "i-bailly-tag-filled", count: 5, filled: false },
    { name: "Vocabulaire", color: "Green", icon: "i-bailly-tag-filled", count: 23, filled: false },
  ];

  /**
   * The features, each shown with a small demonstration (in the template).
   */
  const features = {
    search: {
      title: "Cherchez comme vous écrivez",
      text: "En grec, en beta code ou en translittération : les résultats s'affichent dès la première lettre.",
    },
    inflected: {
      title: "Les formes fléchies aussi",
      text: "L'analyseur morphologique Morpheus retrouve le lemme d'une forme conjuguée ou déclinée.",
    },
    bookmarks: {
      title: "Vos signets, sur tous vos appareils",
      text: "Classez vos entrées par étiquettes, et synchronisez-les, chiffrées, sans créer de compte.",
    },
    reading: {
      title: "Une lecture à votre main",
      text: "Cinq polices, quatre tailles de texte, et la translittération du grec si vous le souhaitez.",
    },
  };

  /**
   * The entry ῥιπτός, as the 2020 edition gives it (cf. its scan from 1935).
   */
  const rhiptos = `<span class="entreea"><span class="grec">ῥιπτός,</span></span> <span class="des">ή, όν,</span> jeté,
lancé : <span class="grec">μόρος</span>, <span class="aut">Soph.</span> <span class="oeuv">Tr.</span> <span class="refch">357,</span>
mort d'un homme qu'on lance (du haut d'un rocher).
<div class="etymor"><span class="etiqetymor">Étym.</span> <span class="ital">vb. de</span> <span class="grec">ῥίπτω</span>.</div>`;

  /**
   * The errors of the text go to the team of the 2020 edition, with the entry
   * and the version (as its notice asks).
   */
  const reportTextError = `mailto:numerisation.gaffiot@hotmail.fr?subject=${encodeURIComponent("Bailly 2020 Chávez : erreur dans l'entrée …")}`;

  /**
   * The documents of `public/documents/`, with their number of pages and their
   * size (in kB), to say what one downloads.
   */
  const resources = [
    { title: "Préface d'Anatole Bailly", href: "/documents/préface-anatole-bailly.pdf", pages: 6, size: 75 },
    { title: "Abréviations et signes usuels", href: "/documents/abréviations-signes-usuels.pdf", pages: 5, size: 49 },
    { title: "Liste des auteurs et des ouvrages", href: "/documents/liste-auteurs-ouvrages.pdf", pages: 59, size: 319 },
    { title: "Mesures", href: "/documents/mesures.pdf", pages: 7, size: 77 },
    { title: "Notice de l'édition 2020", href: "/documents/notice-édition-2020.pdf", pages: 6, size: 85 },
  ];

  type Link = { label: string; href: string };

  const credits: { title: string; authors: string; licence: string; links: Link[]; note?: string }[] = [
    {
      title: "Application Bailly.app",
      authors: "Antoine Boquet & Benjamin Georges",
      licence: "GNU Affero General Public License (AGPL-3.0-or-later)",
      links: [
        { label: "Licence", href: "/COPYING" },
        { label: "Code source", href: "https://github.com/defense-humanites/bailly.app" },
      ],
    },
    {
      title: "Bailly 2020 Hugo Chávez",
      authors: "Gérard Gréco, André Charbonnet, Mark De Wilde, Bernard Maréchal et al.",
      licence: "Creative Commons Attribution – Pas d'Utilisation Commerciale – Pas de Modification (CC BY-NC-ND 4.0)",
      links: [
        { label: "Licence", href: "https://creativecommons.org/licenses/by-nc-nd/4.0/deed.fr" },
        { label: "Source", href: "http://gerardgreco.free.fr/spip.php?article24" },
      ],
      note: "Version des données : 28 février 2023.",
    },
    {
      title: "Analyseur morphologique Morpheus",
      authors: "Gregory Crane et al., pour l'université Tufts",
      licence: "Creative Commons Attribution-ShareAlike 3.0 United States (CC BY-SA 3.0 US)",
      links: [
        { label: "Licence", href: "https://creativecommons.org/licenses/by-sa/3.0/us/deed.en" },
        { label: "Code source", href: "https://github.com/PerseusDL/morpheus" },
      ],
    },
  ];
</script>

<template>
  <div>
    <!--
      The hero, framed like a title page: a thick and a thin rule, in the cloth of
      the icon. It fills the window under the header: on mobile, with equal
      margins all around; from `md`, right under the header, so that the search
      bar is as far from the frame as from the top of the window (cf.
      `--header-height`), its side and bottom margins (4rem) matching the top
      one, header included. Its height
      uses `svh`, so that it does not change when the mobile browser bars
      collapse; its content scales with the window height, and the frame grows
      rather than letting it overflow (e.g. a phone in landscape).
    -->
    <div class="p-4 md:px-16 md:pt-0 md:pb-16">
      <section class="flex min-h-[calc(100svh-(6.5rem+1px)-2rem)] flex-col items-center rounded-xl border-2 border-terracotta-700 px-3 pt-[clamp(1rem,3svh,3rem)] pb-[clamp(0.25rem,1svh,1rem)] text-center shadow-[inset_0_0_0_5px_var(--app-page-bg),inset_0_0_0_6px_var(--color-terracotta-700)] md:min-h-[calc(100svh-var(--header-height)-4rem)] md:px-8 dark:border-terracotta-700 dark:shadow-[inset_0_0_0_5px_var(--app-page-bg),inset_0_0_0_6px_var(--color-terracotta-700)]">
        <div class="my-auto flex w-full flex-col items-center">
          <UIcon
            name="i-bailly-bailly"
            class="mb-[clamp(0.5rem,2svh,1.25rem)] size-[clamp(3rem,7svh,5rem)] shrink-0 md:size-[clamp(4rem,13svh,8rem)]"
          />
          <h1 class="max-w-3xl font-serif text-2xl/[1.3] font-bold text-balance max-[25rem]:text-[1.375rem]/[1.3] md:text-4xl/[1.3]">
            Le dictionnaire grec-français d'Anatole&nbsp;Bailly, à portée de recherche
          </h1>
          <p class="mt-[clamp(0.5rem,2svh,1.25rem)] max-w-2xl text-base text-pretty text-muted md:text-xl">
            Le texte révisé par Gérard Gréco et son équipe, dans une application libre et
            gratuite, pensée pour la lecture et la recherche, sans compte ni publicité.
          </p>
          <div class="mt-[clamp(1.25rem,4svh,2rem)] flex flex-wrap justify-center gap-2 md:gap-3">
            <UButton
              size="lg"
              icon="i-lucide-search"
              label="Chercher un mot"
              class="max-sm:px-2.5 max-[23.5rem]:gap-1.5 max-[23.5rem]:px-2 md:text-base"
              :ui="{ leadingIcon: 'md:size-6' }"
              @click="searchFocus.focus()"
            />
            <UButton
              to="/soutenir"
              size="lg"
              color="neutral"
              variant="outline"
              icon="i-lucide-heart"
              label="Nous soutenir"
              class="max-sm:px-2.5 max-[23.5rem]:gap-1.5 max-[23.5rem]:px-2 md:text-base"
              :ui="{ leadingIcon: 'md:size-6' }"
            />
          </div>
          <dl class="mt-[clamp(0.75rem,3.5svh,3rem)] grid w-full max-w-2xl grid-cols-3 gap-4 border-t border-terracotta-700/35 dark:border-terracotta-600/40 pt-[clamp(0.75rem,2.5svh,1.5rem)]">
            <div
              v-for="figure in figures"
              :key="figure.label"
              class="flex flex-col-reverse"
            >
              <dt class="text-sm text-muted">
                {{ figure.label }}
              </dt>
              <dd class="font-serif text-lg/8 font-bold md:text-2xl/9">
                {{ figure.value }}
              </dd>
            </div>
          </dl>
        </div>
        <!--
          The rest of the page is below the fold: an invitation to scroll
          (smoothly, through the router: cf. `router.options.ts`; a plain
          `#atouts` would be a native jump).
        -->
        <UButton
          :to="{ hash: '#atouts' }"
          variant="link"
          color="neutral"
          size="sm"
          trailing-icon="i-lucide-chevron-down"
          label="En savoir plus"
          class="hero-cue mt-[clamp(0.25rem,1.5svh,1.5rem)] shrink-0 flex-col gap-0 text-muted max-md:py-0"
          :ui="{ trailingIcon: 'size-4 md:size-5' }"
        />
      </section>
    </div>

    <div class="mx-auto max-w-(--content-max-width) px-4 md:px-6">
      <section
        aria-labelledby="atouts"
        class="chapter py-10 md:py-14"
      >
        <h2
          id="atouts"
          class="mb-8 scroll-mt-[calc(var(--header-bottom)+1.5rem)] text-center font-serif text-2xl/9 font-bold md:text-3xl/10"
        >
          Ce que l'application apporte au texte
        </h2>
        <ul class="grid gap-4 sm:grid-cols-2">
          <li class="flex flex-col rounded-lg bg-default p-5 ring-1 ring-default">
            <div
              aria-hidden="true"
              class="mb-4 flex h-32 items-center justify-center rounded-md bg-page ring-1 ring-default"
            >
              <div class="flex items-center">
                <div class="grid grid-cols-[auto_auto] items-center gap-x-1.5 gap-y-2 sm:gap-x-2">
                  <template
                    v-for="input in searchInputs"
                    :key="input.mode"
                  >
                    <span class="text-end text-[0.6875rem] text-dimmed sm:text-xs">{{ input.mode }}</span>
                    <span class="flex h-6 items-center rounded-full bg-default px-3 text-sm ring-1 ring-accented">{{ input.text }}</span>
                  </template>
                </div>
                <!-- A brace (drawn: thick arms, thin tips) as high as the inputs (rows of 1.5rem, gaps of 0.5rem), its point at the middle (44). -->
                <svg
                  viewBox="0 0 16 88"
                  class="ms-1 me-2 h-22 w-4 shrink-0 text-dimmed sm:ms-2 sm:me-3"
                  fill="currentColor"
                >
                  <path d="M3.00 1.80L3.39 1.93L3.75 2.03L4.09 2.14L4.40 2.25L4.69 2.37L4.96 2.50L5.21 2.64L5.44 2.78L5.65 2.94L5.85 3.10L6.03 3.27L6.19 3.45L6.35 3.63L6.49 3.83L6.62 4.03L6.75 4.25L6.86 4.48L6.97 4.72L7.08 4.98L7.18 5.25L7.27 5.54L7.35 5.84L7.43 6.16L7.51 6.49L7.58 6.84L7.64 7.21L7.69 7.59L7.75 7.99L7.79 8.41L7.83 8.84L7.87 9.28L7.90 9.75L7.92 10.23L7.95 10.72L7.96 11.23L7.98 11.75L7.99 12.29L7.99 12.85L8.00 13.42L8.00 14.00L8.00 15.20L8.01 16.39L8.02 17.57L8.03 18.74L8.05 19.90L8.08 21.05L8.11 22.19L8.15 23.31L8.20 24.41L8.25 25.50L8.32 26.57L8.39 27.62L8.48 28.65L8.57 29.66L8.68 30.65L8.80 31.62L8.93 32.56L9.07 33.47L9.23 34.36L9.40 35.22L9.59 36.05L9.80 36.86L10.02 37.63L10.26 38.37L10.51 39.08L10.79 39.75L11.09 40.39L11.41 40.98L11.75 41.55L12.11 42.07L12.50 42.54L12.92 42.97L13.36 43.35L13.83 43.68L14.31 43.95L14.82 44.16L15.35 44.31L15.89 44.39L16.44 44.40L17.00 44.30L17.00 43.70L16.53 43.55L16.10 43.41L15.71 43.23L15.35 43.02L15.02 42.78L14.71 42.51L14.42 42.20L14.15 41.86L13.88 41.48L13.64 41.06L13.40 40.60L13.18 40.10L12.97 39.57L12.77 38.99L12.59 38.38L12.42 37.73L12.26 37.04L12.11 36.32L11.97 35.57L11.85 34.78L11.73 33.96L11.63 33.11L11.53 32.23L11.45 31.33L11.38 30.40L11.31 29.44L11.25 28.46L11.20 27.45L11.16 26.42L11.12 25.37L11.09 24.31L11.07 23.22L11.05 22.12L11.03 21.00L11.02 19.86L11.01 18.71L11.01 17.55L11.00 16.38L11.00 15.19L11.00 14.00L11.00 13.40L10.99 12.81L10.98 12.23L10.96 11.66L10.93 11.10L10.90 10.56L10.85 10.03L10.81 9.51L10.75 9.00L10.68 8.51L10.61 8.02L10.53 7.55L10.43 7.10L10.33 6.65L10.21 6.22L10.08 5.80L9.95 5.39L9.79 5.00L9.63 4.61L9.45 4.25L9.25 3.90L9.05 3.56L8.82 3.24L8.58 2.94L8.33 2.66L8.05 2.39L7.77 2.15L7.47 1.93L7.15 1.73L6.82 1.56L6.48 1.41L6.13 1.28L5.77 1.18L5.40 1.10L5.02 1.05L4.64 1.02L4.24 1.01L3.84 1.03L3.42 1.08L3.00 1.20ZM3.00 86.20L3.39 86.07L3.75 85.97L4.09 85.86L4.40 85.75L4.69 85.63L4.96 85.50L5.21 85.36L5.44 85.22L5.65 85.06L5.85 84.90L6.03 84.73L6.19 84.55L6.35 84.37L6.49 84.17L6.62 83.97L6.75 83.75L6.86 83.52L6.97 83.28L7.08 83.02L7.18 82.75L7.27 82.46L7.35 82.16L7.43 81.84L7.51 81.51L7.58 81.16L7.64 80.79L7.69 80.41L7.75 80.01L7.79 79.59L7.83 79.16L7.87 78.72L7.90 78.25L7.92 77.77L7.95 77.28L7.96 76.77L7.98 76.25L7.99 75.71L7.99 75.15L8.00 74.58L8.00 74.00L8.00 72.80L8.01 71.61L8.02 70.43L8.03 69.26L8.05 68.10L8.08 66.95L8.11 65.81L8.15 64.69L8.20 63.59L8.25 62.50L8.32 61.43L8.39 60.38L8.48 59.35L8.57 58.34L8.68 57.35L8.80 56.38L8.93 55.44L9.07 54.53L9.23 53.64L9.40 52.78L9.59 51.95L9.80 51.14L10.02 50.37L10.26 49.63L10.51 48.92L10.79 48.25L11.09 47.61L11.41 47.02L11.75 46.45L12.11 45.93L12.50 45.46L12.92 45.03L13.36 44.65L13.83 44.32L14.31 44.05L14.82 43.84L15.35 43.69L15.89 43.61L16.44 43.60L17.00 43.70L17.00 44.30L16.53 44.45L16.10 44.59L15.71 44.77L15.35 44.98L15.02 45.22L14.71 45.49L14.42 45.80L14.15 46.14L13.88 46.52L13.64 46.94L13.40 47.40L13.18 47.90L12.97 48.43L12.77 49.01L12.59 49.62L12.42 50.27L12.26 50.96L12.11 51.68L11.97 52.43L11.85 53.22L11.73 54.04L11.63 54.89L11.53 55.77L11.45 56.67L11.38 57.60L11.31 58.56L11.25 59.54L11.20 60.55L11.16 61.58L11.12 62.63L11.09 63.69L11.07 64.78L11.05 65.88L11.03 67.00L11.02 68.14L11.01 69.29L11.01 70.45L11.00 71.62L11.00 72.81L11.00 74.00L11.00 74.60L10.99 75.19L10.98 75.77L10.96 76.34L10.93 76.90L10.90 77.44L10.85 77.97L10.81 78.49L10.75 79.00L10.68 79.49L10.61 79.98L10.53 80.45L10.43 80.90L10.33 81.35L10.21 81.78L10.08 82.20L9.95 82.61L9.79 83.00L9.63 83.39L9.45 83.75L9.25 84.10L9.05 84.44L8.82 84.76L8.58 85.06L8.33 85.34L8.05 85.61L7.77 85.85L7.47 86.07L7.15 86.27L6.82 86.44L6.48 86.59L6.13 86.72L5.77 86.82L5.40 86.90L5.02 86.95L4.64 86.98L4.24 86.99L3.84 86.97L3.42 86.92L3.00 86.80Z" />
                </svg>
                <span class="font-serif text-lg font-bold sm:text-xl">φύσις</span>
              </div>
            </div>
            <h3 class="font-semibold">
              {{ features.search.title }}
            </h3>
            <p class="mt-1 text-muted">
              {{ features.search.text }}
            </p>
          </li>
          <li class="flex flex-col rounded-lg bg-default p-5 ring-1 ring-default">
            <div
              aria-hidden="true"
              class="mb-4 flex h-32 items-center justify-center rounded-md bg-page ring-1 ring-default"
            >
              <!-- The results the API gives for ορνιθα: the lemma ὄρνις, and two entries beginning so. -->
              <div class="flex items-center gap-3">
                <span class="font-serif text-lg">ὄρνιθα</span>
                <UIcon
                  name="i-lucide-arrow-right"
                  class="size-4 text-dimmed"
                />
                <div class="flex flex-col gap-1.5">
                  <span class="font-serif text-sm text-dimmed">ὀρνιθάριον</span>
                  <span class="flex items-center gap-1.5 font-serif text-lg font-bold">ὄρνις<UIcon
                    name="i-lucide-sparkles"
                    class="size-4 text-primary"
                  /></span>
                  <span class="font-serif text-sm text-dimmed">ὀρνίθαρχος</span>
                </div>
              </div>
            </div>
            <h3 class="font-semibold">
              {{ features.inflected.title }}
            </h3>
            <p class="mt-1 text-muted">
              {{ features.inflected.text }}
            </p>
          </li>
          <li class="flex flex-col rounded-lg bg-default p-5 ring-1 ring-default">
            <div
              aria-hidden="true"
              class="mb-4 flex h-32 items-center justify-center rounded-md bg-page ring-1 ring-default"
            >
              <ul class="flex max-w-72 flex-wrap items-center justify-center gap-2">
                <li
                  v-for="pill in bookmarkPills"
                  :key="pill.name"
                  :data-tag-color="pill.color"
                  class="flex h-8 items-center gap-1.5 rounded-full ps-2.5 pe-3 text-sm"
                  :class="pill.filled ? 'bg-tag-text text-tag-100' : 'bg-tag-100 text-tag-text ring ring-tag-300/60 ring-inset'"
                >
                  <UIcon
                    :name="pill.icon"
                    class="size-4 shrink-0"
                  />
                  <span class="font-medium">{{ pill.name }}</span>
                  <span class="tabular-nums opacity-75">{{ pill.count }}</span>
                </li>
              </ul>
            </div>
            <h3 class="font-semibold">
              {{ features.bookmarks.title }}
            </h3>
            <p class="mt-1 text-muted">
              {{ features.bookmarks.text }}
            </p>
          </li>
          <li class="flex flex-col rounded-lg bg-default p-5 ring-1 ring-default">
            <div
              aria-hidden="true"
              class="mb-4 flex h-32 items-center justify-center rounded-md bg-page ring-1 ring-default"
            >
              <div class="flex flex-col items-center gap-2">
                <div
                  v-for="(row, index) in [fontSpecimens.fonts.slice(0, 2), fontSpecimens.fonts.slice(2)]"
                  :key="index"
                  class="flex items-end gap-5"
                >
                  <div
                    v-for="font in row"
                    :key="font.name"
                    class="flex flex-col items-center"
                  >
                    <svg
                      :viewBox="`0 ${fontSpecimens.viewBoxTop} ${font.width} ${fontSpecimens.viewBoxHeight}`"
                      :style="{ width: `${font.width / 1000 * 1.25}rem` }"
                      class="h-8 fill-current"
                    >
                      <path :d="font.d" />
                    </svg>
                    <span class="text-xs text-dimmed">{{ font.name }}</span>
                  </div>
                </div>
              </div>
            </div>
            <h3 class="font-semibold">
              {{ features.reading.title }}
            </h3>
            <p class="mt-1 text-muted">
              {{ features.reading.text }}
            </p>
          </li>
        </ul>
      </section>

      <section
        aria-labelledby="origine"
        class="chapter chapter-framed py-10 md:py-14"
      >
        <h2
          id="origine"
          class="text-center font-serif text-2xl/9 font-bold md:text-3xl/10"
        >
          D'où vient le texte
        </h2>
        <p class="mx-auto mt-2 max-w-2xl text-center text-muted">
          Trois ouvrages en un : le dictionnaire, son édition numérique, et l'application qui vous la
          présente. Voici la même entrée, ῥιπτός, dans chacun d'eux.
        </p>

        <!--
          A triptych: the entry in its three states, side by side from `lg`
          (one above the other below, the panel beside its legend from `md`),
          under two headings, the text (the first two) and the application.
        -->
        <div class="mt-10 grid gap-x-8 gap-y-10 lg:grid-cols-3 lg:gap-y-6">
          <p class="flex flex-col items-center text-xs font-semibold tracking-[0.2em] text-muted uppercase -mb-4 lg:col-span-2 lg:row-start-1 lg:mb-0">
            Le texte
            <span
              aria-hidden="true"
              class="mt-2 h-2 w-full rounded-t-md border-x border-t border-(--rule-color)/60 lg:w-[calc(100%+0.75rem)]"
            />
          </p>

          <article class="flex flex-col gap-6 md:grid md:grid-cols-[16rem_minmax(0,1fr)] md:items-start md:gap-8 lg:flex lg:col-start-1 lg:row-start-2">
            <div class="mx-auto aspect-[4/3] w-full max-w-sm bg-white overflow-hidden rounded-lg border border-(--rule-color) shadow-[0_0_0_4px_var(--app-page-bg),0_0_0_6px_var(--rule-color)] md:max-w-none">
              <img
                src="/images/bailly-1935-rhiptos.webp"
                width="480"
                height="480"
                alt="L'entrée ῥιπτός dans l'édition de 1935 (fac-similé)."
                class="size-full object-cover"
              >
            </div>
            <div class="min-w-0 max-md:text-center">
              <h3 class="font-serif text-lg/8 font-bold">
                Le dictionnaire d'Anatole Bailly
              </h3>
              <p class="mt-2 text-muted">
                L'ouvrage de référence des hellénistes francophones, paru en 1894 et maintes fois
                réédité. Le texte de sa quatrième édition (1935) est passé dans le domaine public ; son
                <a
                  href="https://archive.org/details/BaillyDictionnaireGrecFrancais"
                  target="_blank"
                  rel="noopener"
                >fac-similé</a> est disponible sur l'<em>Internet Archive</em>.
              </p>
            </div>
          </article>

          <article class="flex flex-col gap-6 md:grid md:grid-cols-[16rem_minmax(0,1fr)] md:items-start md:gap-8 lg:flex lg:col-start-2 lg:row-start-2">
            <div
              aria-hidden="true"
              class="mx-auto flex aspect-[4/3] w-full max-w-sm items-center justify-center bg-default p-4 overflow-hidden rounded-lg border border-(--rule-color) shadow-[0_0_0_4px_var(--app-page-bg),0_0_0_6px_var(--rule-color)] md:max-w-none"
            >
              <!-- eslint-disable vue/no-v-html -- A constant of this page. -->
              <div
                class="definition max-w-[17rem] font-serif [--reading-font-size:0.875rem] [--reading-font-weight:400]"
                v-html="rhiptos"
              />
              <!-- eslint-enable vue/no-v-html -->
            </div>
            <div class="min-w-0 max-md:text-center">
              <h3 class="font-serif text-lg/8 font-bold">
                L'édition numérique de Gérard Gréco
              </h3>
              <p class="mt-2 text-muted">
                Gérard Gréco et son équipe ont numérisé le texte, l'ont corrigé à la main d'après les
                ouvrages de référence, puis ont mis à jour les étymologies et la toponymie, et normalisé
                les références ; ils l'ont intitulée <em>Bailly 2020 Hugo&nbsp;Chávez</em>. C'est leur texte que vous lisez ici. Une
                <a
                  href="http://gerardgreco.free.fr/spip.php?article24"
                  target="_blank"
                  rel="noopener"
                >édition PDF</a>, mise en page comme l'ouvrage d'origine, est disponible sur le site du
                projet.
              </p>
              <div class="mt-4 flex flex-wrap gap-2 *:max-w-full max-md:justify-center">
                <UButton
                  :to="reportTextError"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-flag"
                  label="Signaler une erreur"
                />
                <UButton
                  to="/documents/notice-édition-2020.pdf"
                  target="_blank"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-file-text"
                  label="Notice de l'édition"
                />
              </div>
              <p class="mt-2 text-sm text-muted">
                Les erreurs du texte se signalent à l'équipe de M.&nbsp;Gréco, en précisant l'entrée
                concernée.
              </p>
            </div>
          </article>

          <p class="flex flex-col items-center text-xs font-semibold tracking-[0.2em] text-muted uppercase -mb-4 lg:col-start-3 lg:row-start-1 lg:mb-0">
            L'application
            <span
              aria-hidden="true"
              class="mt-2 h-2 w-full rounded-t-md border-x border-t border-(--rule-color)/60 lg:w-[calc(100%+0.75rem)]"
            />
          </p>

          <article class="flex flex-col gap-6 md:grid md:grid-cols-[16rem_minmax(0,1fr)] md:items-start md:gap-8 lg:flex lg:col-start-3 lg:row-start-2">
            <div
              aria-hidden="true"
              class="mx-auto flex aspect-[4/3] w-full max-w-sm items-center justify-center bg-linear-to-br from-primary/10 to-(--ui-bg) overflow-hidden rounded-lg border border-(--rule-color) shadow-[0_0_0_4px_var(--app-page-bg),0_0_0_6px_var(--rule-color)] md:max-w-none"
            >
              <div class="w-56 space-y-2">
                <div class="flex items-center gap-2 rounded-full bg-default px-3 py-1.5 text-sm shadow-xs ring-1 ring-default">
                  <UIcon
                    name="i-lucide-search"
                    class="size-4 text-muted"
                  />
                  <span class="font-serif">ῥιπτ</span>
                  <span class="ms-auto rounded-full bg-elevated px-1.5 text-xs text-muted">4</span>
                </div>
                <div class="rounded-md bg-default p-2.5 ring-1 ring-default">
                  <div class="flex items-center gap-1.5">
                    <span class="font-serif text-sm font-bold">ῥιπτός</span>
                    <UIcon
                      name="i-bailly-star-filled"
                      class="ms-auto size-4 text-favorite"
                    />
                  </div>
                  <p class="line-clamp-2 font-serif text-xs/5 text-muted">
                    ή, όν, jeté, lancé : μόρος, Soph. Tr. 357, mort d'un homme qu'on lance…
                  </p>
                </div>
              </div>
            </div>
            <div class="min-w-0 max-md:text-center">
              <h3 class="font-serif text-lg/8 font-bold">
                L'application Bailly.app
              </h3>
              <p class="mt-2 text-muted">
                Nous ne modifions pas le texte : nous le rendons consultable, avec la recherche,
                l'analyse des formes fléchies, les signets et les réglages de lecture. L'application est
                un logiciel libre.
              </p>
              <div class="mt-4 flex flex-wrap gap-2 *:max-w-full max-md:justify-center">
                <UButton
                  to="mailto:contact@bailly.app"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-message-circle"
                  label="Signaler un problème"
                />
                <UButton
                  to="https://github.com/defense-humanites/bailly.app"
                  target="_blank"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-code"
                  label="Code source"
                />
              </div>
            </div>
          </article>
        </div>
      </section>

      <section
        aria-labelledby="ressources"
        class="chapter py-10 md:py-14"
      >
        <h2
          id="ressources"
          class="mb-6 text-center font-serif text-2xl/9 font-bold md:text-3xl/10"
        >
          Ressources
        </h2>
        <ol class="mx-auto max-w-2xl">
          <li
            v-for="resource in resources"
            :key="resource.href"
          >
            <a
              :href="resource.href"
              target="_blank"
              class="group flex flex-col py-1.5 sm:flex-row sm:items-baseline sm:gap-2"
            >
              <span class="font-serif text-base/7 group-hover:text-primary">{{ resource.title }}</span>
              <span
                aria-hidden="true"
                class="hidden min-w-6 flex-1 translate-y-[-0.3em] border-b-2 border-dotted border-dimmed/60 sm:block"
              />
              <span class="shrink-0 text-sm text-muted tabular-nums">
                PDF · {{ resource.pages }}<span aria-hidden="true">&nbsp;p.</span><span class="sr-only">&nbsp;pages</span> · {{ resource.size }}&nbsp;Ko
              </span>
            </a>
          </li>
        </ol>
      </section>

      <section
        aria-labelledby="credits"
        class="chapter pt-10 pb-16 md:pt-14 md:pb-20"
      >
        <h2
          id="credits"
          class="mb-6 text-center font-serif text-2xl/9 font-bold md:text-3xl/10"
        >
          Crédits et licences
        </h2>
        <div class="colophon mx-auto max-w-xl text-center font-serif text-sm/6">
          <div
            v-for="credit in credits"
            :key="credit.title"
          >
            <h3 class="font-bold tracking-wide [font-variant-caps:all-small-caps]">
              {{ credit.title }}
            </h3>
            <p>{{ credit.authors }}</p>
            <p class="text-muted">
              {{ credit.licence }}
            </p>
            <p
              v-if="credit.note"
              class="text-muted"
            >
              {{ credit.note }}
            </p>
            <p class="mt-1 flex justify-center gap-4 font-sans">
              <a
                v-for="link in credit.links"
                :key="link.href"
                :href="link.href"
                target="_blank"
                rel="noopener"
                class="underline decoration-dotted underline-offset-4 hover:text-primary"
              >{{ link.label }}</a>
            </p>
          </div>
          <p class="text-muted">
            Ce que l'application garde de vos données, et où :
            <NuxtLink
              to="/confidentialite"
              class="underline decoration-dotted underline-offset-4 hover:text-primary"
            >confidentialité</NuxtLink>.
          </p>
        </div>
      </section>
    </div>

    <section
      aria-labelledby="soutien"
      class="cloth relative py-16 text-center text-terracotta-100 md:py-20"
    >
      <div
        aria-hidden="true"
        class="absolute inset-x-0 top-3 h-[6px] border-t-2 border-b border-gold-300/70"
      />
      <div
        aria-hidden="true"
        class="absolute inset-x-0 bottom-3 h-[6px] border-t border-b-2 border-gold-300/70"
      />
      <div class="mx-auto max-w-(--content-max-width) px-4 md:px-6">
        <h2
          id="soutien"
          class="text-gilt font-serif text-2xl/9 font-bold text-balance md:text-[1.75rem]/10"
        >
          Un dictionnaire libre, porté par une association
        </h2>
        <p class="mx-auto mt-3 max-w-2xl text-pretty">
          Bailly.app est gratuit et le restera. Vos dons couvrent l'hébergement et le temps consacré à
          l'application.
        </p>
        <div class="mt-8 flex flex-wrap justify-center gap-3">
          <UButton
            to="/soutenir"
            size="lg"
            color="warning"
            icon="i-lucide-heart"
            label="Nous soutenir"
            class="gilt-button text-terracotta-900"
          />
          <UButton
            to="mailto:contact@bailly.app"
            size="lg"
            color="neutral"
            variant="outline"
            icon="i-lucide-mail"
            label="Nous écrire"
            class="bg-transparent text-gold-100 ring-gold-200/60 hover:bg-white/10"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* An asterism between the chapters. */
.chapter + .chapter {
  position: relative;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 50%;
    width: 1.5rem;
    height: 1.25rem;
    translate: -50% -50%;
    background-color: var(--rule-color);
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 20'%3E%3Cg stroke='black' stroke-width='1.3' stroke-linecap='round'%3E%3Cpath d='M12 1.6v6.8M9.06 3.3l5.88 3.4M9.06 6.7l5.88-3.4'/%3E%3Cpath d='M6 11.6v6.8M3.06 13.3l5.88 3.4M3.06 16.7l5.88-3.4'/%3E%3Cpath d='M18 11.6v6.8M15.06 13.3l5.88 3.4M15.06 16.7l5.88-3.4'/%3E%3C/g%3E%3C/svg%3E") center / contain no-repeat;
  }
}

/* The colophon: its entries separated by a small lozenge. */
.colophon > * + * {
  margin-top: 1.25rem;

  &::before {
    content: "";
    display: block;
    width: 0.375rem;
    height: 0.375rem;
    margin: 0 auto 1.25rem;
    rotate: 45deg;
    background-color: var(--rule-color);
  }
}

/* The ornaments are in the cloth of the icon, like the hero frame. */
.chapter {
  --rule-color: var(--color-terracotta-700);
}

:global(.dark) .chapter {
  --rule-color: var(--color-terracotta-600);
}

/*
 * The origin's frames (double, as the hero's): a shade darker in the dark
 * theme, as the hero's and the random entry's (cf. `RandomOpening`).
 */
:global(.dark) .chapter-framed {
  --rule-color: var(--color-terracotta-700);
}

/* The scroll invitation bounces a few times once the page is shown. */
.hero-cue {
  animation: hero-cue-bounce 1.4s ease-in-out 0.8s 2 both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

@keyframes hero-cue-bounce {
  0%,
  25%,
  55%,
  85%,
  100% {
    transform: translateY(0);
  }

  40% {
    transform: translateY(-0.5rem);
  }

  70% {
    transform: translateY(-0.25rem);
  }
}

/* The luminous gold of the icon. */
.text-gilt {
  background: linear-gradient(#f2e2a4, #e8c967 55%, #cda43c);
  background-clip: text;
  color: transparent;
}

/* A gilt button on the cloth. */
.gilt-button {
  background: linear-gradient(#f2e2a4, #e8c967 55%, #cda43c);
  text-shadow: 0 1px 0 rgb(255 255 255 / 0.35);

  &:hover,
  &:active {
    background: linear-gradient(#f5e8b6, #ecd17c 55%, #d6af4a);
  }
}

/* The binding cloth of the icon: terracotta, with faint fibers. */
.cloth {
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9 0.035' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.6 1.1'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)' opacity='0.18'/%3E%3C/svg%3E"),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.035 0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 -1.6 1.1'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)' opacity='0.08'/%3E%3C/svg%3E"),
    linear-gradient(var(--color-terracotta-700), var(--color-terracotta-800));
}
</style>
