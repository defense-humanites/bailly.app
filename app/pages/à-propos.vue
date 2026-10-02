<script setup lang="ts">
  useSeoMeta({
    title: "À propos",
    description: "Le dictionnaire grec-français d'Anatole Bailly, dans l'édition révisée Bailly 2020 Hugo Chávez : une application libre et gratuite pour le consulter.",
  });

  const searchFocus = useSearchFocus();

  /**
   * Key figures of the Bailly 2020 Hugo Chávez edition (after its notice).
   */
  const figures = [
    { value: "107 809", label: "entrées" },
    { value: "327 936", label: "références" },
    { value: "1 325", label: "auteurs cités" },
  ];

  const features = [
    {
      icon: "i-lucide-search",
      title: "Cherchez comme vous écrivez",
      text: "En grec, en beta code ou en translittération : tapez logos ou λόγος, les résultats s'affichent dès la première lettre.",
    },
    {
      icon: "i-lucide-sparkles",
      title: "Les formes fléchies aussi",
      text: "ἦλθον vous mène à ἔρχομαι : l'analyseur morphologique Morpheus retrouve le lemme d'une forme conjuguée ou déclinée.",
    },
    {
      icon: "i-lucide-bookmark",
      title: "Vos signets, sur tous vos appareils",
      text: "Classez vos entrées par étiquettes, et synchronisez-les, chiffrées, sans créer de compte.",
    },
    {
      icon: "i-lucide-book-open",
      title: "Une lecture à votre main",
      text: "Cinq polices, quatre tailles de texte, et la translittération du grec si vous le souhaitez.",
    },
  ];

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

  const resources = [
    { title: "Préface d'Anatole Bailly", href: "/documents/préface-anatole-bailly.pdf" },
    { title: "Abréviations et signes usuels", href: "/documents/abréviations-signes-usuels.pdf" },
    { title: "Liste des auteurs et des ouvrages", href: "/documents/liste-auteurs-ouvrages.pdf" },
    { title: "Mesures", href: "/documents/mesures.pdf" },
    { title: "Notice de l'édition 2020", href: "/documents/notice-édition-2020.pdf" },
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
  <div class="mx-auto max-w-(--content-max-width) px-4 md:px-6">
    <section class="flex flex-col items-center py-12 text-center md:py-20">
      <UIcon
        name="i-bailly-bailly"
        class="mb-4 size-32"
      />
      <h1 class="max-w-3xl font-serif text-[1.75rem]/[2.8125rem] font-bold text-balance md:text-4xl/[3.75rem]">
        Le dictionnaire grec-français d'Anatole&nbsp;Bailly, à portée de recherche
      </h1>
      <p class="mt-5 max-w-2xl text-lg text-pretty text-muted md:text-xl">
        Le texte révisé du <em>Bailly 2020 Hugo&nbsp;Chávez</em>, dans une application libre et
        gratuite, pensée pour la lecture et la recherche, sans compte ni publicité.
      </p>
      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <UButton
          size="xl"
          icon="i-lucide-search"
          label="Chercher un mot"
          @click="searchFocus.focus()"
        />
        <UButton
          to="/soutenir"
          size="xl"
          color="neutral"
          variant="outline"
          icon="i-lucide-heart"
          label="Nous soutenir"
        />
      </div>
      <dl class="mt-12 grid w-full max-w-2xl grid-cols-3 gap-4 border-t border-default pt-6">
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
    </section>

    <section
      aria-labelledby="atouts"
      class="py-10 md:py-14"
    >
      <h2
        id="atouts"
        class="mb-8 text-center text-2xl font-bold md:text-3xl"
      >
        Ce que l'application apporte au texte
      </h2>
      <ul class="grid gap-4 sm:grid-cols-2">
        <li
          v-for="feature in features"
          :key="feature.title"
        >
          <UCard class="h-full">
            <div class="flex items-center gap-3">
              <div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UIcon
                  :name="feature.icon"
                  class="size-5"
                />
              </div>
              <h3 class="font-semibold text-balance">
                {{ feature.title }}
              </h3>
            </div>
            <p class="mt-3 text-muted">
              {{ feature.text }}
            </p>
          </UCard>
        </li>
      </ul>
    </section>

    <section
      aria-labelledby="origine"
      class="py-10 md:py-14"
    >
      <h2
        id="origine"
        class="text-center text-2xl font-bold md:text-3xl"
      >
        D'où vient le texte
      </h2>
      <p class="mx-auto mt-2 max-w-2xl text-center text-muted">
        Trois ouvrages en un : le dictionnaire, son édition numérique, et l'application qui vous la
        présente. Suivez l'entrée ῥιπτός de l'un à l'autre.
      </p>

      <!--
        Each work in a bubble, on the left then on the right, joined by a
        winding path (from `md`); on mobile, the bubble is centered above the
        text, centered too, without a path.
      -->
      <ol class="mt-10 space-y-12 md:mx-auto md:max-w-4xl md:space-y-24">
        <li class="relative flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-12 md:even:flex-row-reverse">
          <!-- The winding path to the next work (from `md`). -->
          <div
            aria-hidden="true"
            class="contents"
          >
            <div class="absolute top-56 bottom-0 left-28 hidden border-s-2 border-dashed border-primary/40 md:block" />
            <div class="absolute top-full right-1/2 left-28 hidden h-12 rounded-bl-3xl border-b-2 border-s-2 border-dashed border-primary/40 md:block" />
            <div class="absolute top-[calc(100%+3rem-2px)] right-28 left-1/2 hidden h-12 rounded-tr-3xl border-e-2 border-t-2 border-dashed border-primary/40 md:block" />
          </div>
          <div class="size-40 shrink-0 md:size-56">
            <div class="relative size-full overflow-hidden rounded-full bg-white shadow-2xl ring-4 ring-primary/10 md:ring-8">
              <img
                src="/images/bailly-1935-rhiptos.webp"
                width="480"
                height="480"
                alt="L'entrée ῥιπτός dans l'édition de 1935 (fac-similé)."
                class="size-full"
              >
            </div>
          </div>
          <div class="min-w-0 flex-1 self-stretch max-md:text-center md:self-auto md:pt-6">
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
        </li>

        <li class="relative flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-12 md:even:flex-row-reverse">
          <!-- The winding path to the next work (from `md`). -->
          <div
            aria-hidden="true"
            class="contents"
          >
            <div class="absolute top-56 right-28 bottom-0 hidden border-e-2 border-dashed border-primary/40 md:block" />
            <div class="absolute top-full right-28 left-1/2 hidden h-12 rounded-br-3xl border-e-2 border-b-2 border-dashed border-primary/40 md:block" />
            <div class="absolute top-[calc(100%+3rem-2px)] right-1/2 left-28 hidden h-12 rounded-tl-3xl border-s-2 border-t-2 border-dashed border-primary/40 md:block" />
          </div>
          <div class="size-40 shrink-0 md:size-56">
            <div
              aria-hidden="true"
              class="flex size-full items-center justify-center overflow-hidden rounded-full bg-default shadow-2xl ring-4 ring-primary/10 md:ring-8"
            >
              <!-- eslint-disable vue/no-v-html -- A constant of this page. -->
              <div
                class="definition w-[10.4rem] shrink-0 font-serif [--reading-font-size:0.75rem] [--reading-font-weight:400] max-md:scale-[0.715]"
                v-html="rhiptos"
              />
              <!-- eslint-enable vue/no-v-html -->
            </div>
          </div>
          <div class="min-w-0 flex-1 self-stretch max-md:text-center md:self-auto md:pt-6">
            <h3 class="font-serif text-lg/8 font-bold">
              L'édition numérique <em>Bailly 2020 Hugo&nbsp;Chávez</em>
            </h3>
            <p class="mt-2 text-muted">
              Gérard Gréco et son équipe ont numérisé le texte, l'ont corrigé à la main d'après les
              ouvrages de référence, puis ont mis à jour les étymologies et la toponymie, et normalisé
              les références. C'est leur texte que vous lisez ici. Une
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
              Les erreurs du texte se signalent à l'équipe de M.&nbsp;Gréco, en précisant l'entrée et la
              version (Chávez).
            </p>
          </div>
        </li>

        <li class="relative flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-12 md:even:flex-row-reverse">
          <div class="size-40 shrink-0 md:size-56">
            <div
              aria-hidden="true"
              class="flex size-full items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-primary/15 to-(--ui-bg) shadow-2xl ring-4 ring-primary/10 md:ring-8"
            >
              <div class="w-[11.2rem] shrink-0 space-y-1.5 max-md:scale-[0.715]">
                <div class="flex items-center gap-1.5 rounded-full bg-default px-3 py-1.5 text-sm shadow-xs ring-1 ring-default">
                  <UIcon
                    name="i-lucide-search"
                    class="size-3.5 text-muted"
                  />
                  <span class="font-serif text-[0.6875rem]/5">ῥιπτ</span>
                  <span class="ms-auto rounded-full bg-elevated px-1.5 text-[0.625rem] text-muted">4</span>
                </div>
                <div class="rounded-md bg-default p-2 ring-1 ring-default">
                  <div class="flex items-center gap-1.5">
                    <span class="font-serif text-[0.6875rem]/5 font-bold">ῥιπτός</span>
                    <UIcon
                      name="i-bailly-star-filled"
                      class="ms-auto size-3.5 text-favorite"
                    />
                  </div>
                  <p class="line-clamp-2 font-serif text-[0.5625rem]/4 text-muted">
                    ή, όν, jeté, lancé : μόρος, Soph. Tr. 357, mort d'un homme qu'on lance…
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div class="min-w-0 flex-1 self-stretch max-md:text-center md:self-auto md:pt-6">
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
        </li>
      </ol>
    </section>

    <section
      aria-labelledby="ressources"
      class="py-10 md:py-14"
    >
      <h2
        id="ressources"
        class="mb-6 text-center text-2xl font-bold md:text-3xl"
      >
        Ressources
      </h2>
      <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <li
          v-for="resource in resources"
          :key="resource.href"
        >
          <UButton
            :to="resource.href"
            target="_blank"
            color="neutral"
            variant="ghost"
            icon="i-lucide-file-text"
            trailing-icon="i-lucide-arrow-up-right"
            :label="resource.title"
            class="w-full"
            :ui="{ trailingIcon: 'ms-auto' }"
          />
        </li>
      </ul>
    </section>

    <section
      aria-labelledby="credits"
      class="py-10 md:py-14"
    >
      <h2
        id="credits"
        class="mb-6 text-center text-2xl font-bold md:text-3xl"
      >
        Crédits et licences
      </h2>
      <ul class="grid gap-4 lg:grid-cols-3">
        <li
          v-for="credit in credits"
          :key="credit.title"
          class="rounded-lg bg-elevated/50 p-4 text-sm"
        >
          <h3 class="font-semibold">
            {{ credit.title }}
          </h3>
          <p class="mt-1">
            {{ credit.authors }}
          </p>
          <p class="mt-1 text-muted">
            {{ credit.licence }}
          </p>
          <p
            v-if="credit.note"
            class="mt-1 text-muted"
          >
            {{ credit.note }}
          </p>
          <p class="mt-2 flex gap-4">
            <a
              v-for="link in credit.links"
              :key="link.href"
              :href="link.href"
              target="_blank"
              rel="noopener"
            >{{ link.label }}</a>
          </p>
        </li>
      </ul>
    </section>

    <section class="my-10 rounded-2xl bg-linear-to-br from-primary/15 to-primary/5 p-6 md:p-10">
      <h2 class="font-serif text-lg/8 font-bold md:text-2xl/9">
        Un dictionnaire libre, porté par une association
      </h2>
      <p class="mt-2 max-w-2xl text-muted">
        Bailly.app est gratuit et le restera. Vos dons couvrent l'hébergement et le temps consacré à
        l'application.
      </p>
      <div class="mt-6 flex flex-wrap gap-3">
        <UButton
          to="/soutenir"
          size="lg"
          icon="i-lucide-heart"
          label="Nous soutenir"
        />
        <UButton
          to="mailto:contact@bailly.app"
          size="lg"
          color="neutral"
          variant="outline"
          icon="i-lucide-mail"
          label="Nous écrire"
        />
      </div>
    </section>

    <p class="pb-10 text-sm text-muted">
      <UIcon
        name="i-lucide-shield-check"
        class="me-1 inline size-4 align-[-0.125em]"
      />
      Ce que l'application garde de vos données, et où :
      <NuxtLink to="/confidentialite">confidentialité</NuxtLink>.
    </p>
  </div>
</template>
