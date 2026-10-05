<script setup lang="ts">
  import { FEATURES } from "#shared/utils/features";

  definePageMeta({
    layout: "single-column",
  });

  useSeoMeta({
    title: "Confidentialité",
    description: "Ce que Bailly.app garde de vos données, où, et pour combien de temps.",
  });

  /**
   * The gist, before the details.
   */
  const summary = [
    "Vos signets et votre historique sont enregistrés sur votre appareil.",
    "Aucun compte, aucun cookie de suivi, aucune publicité.",
    "Si vous synchronisez vos signets ou vos préférences, ils sont chiffrés sur votre appareil : nous ne pouvons pas les lire.",
    "La mesure d'audience ne dépose aucun cookie et ne conserve pas votre adresse IP.",
  ];

  /**
   * The details, a section per subject: its title with an icon (as the
   * summary's title, a step larger), its text in the standard size. A link
   * may lead to a title (e.g. `#synchronisation`): it stops under the header.
   */
  const HEADING = "flex scroll-mt-[calc(var(--header-bottom)+1.5rem)] items-center gap-2 text-lg font-bold";
  const HEADING_ICON = "size-5 shrink-0 text-primary";
  /**
   * The page's sections, for its table of contents (from `xl`, on the
   * column's right, as the ambiguous forms' headwords, cf. `forme`): the
   * summary, then the details (the donations once offered).
   */
  const sections = [
    { id: "en-bref", title: "En bref" },
    { id: "sur-votre-appareil", title: "Sur votre appareil" },
    { id: "preferences", title: "Préférences" },
    { id: "synchronisation", title: "Synchronisation" },
    { id: "adresses-ip", title: "Adresses IP" },
    { id: "recherches", title: "Recherches" },
    { id: "mesure-d-audience", title: "Mesure d'audience" },
    { id: "hebergement", title: "Hébergement" },
    ...(FEATURES.donations ? [{ id: "dons", title: "Dons" }] : []),
    { id: "contact", title: "Contact" },
  ];
  const { currentId, follow } = useCurrentSection(sections.map(({ id }) => id));

  /** The links in the text (as the about page's). */
  const LINK = "underline decoration-dotted underline-offset-4 hover:text-primary";
</script>

<template>
  <article class="space-y-8">
    <header>
      <h1 class="text-3xl font-bold">
        Vos données
      </h1>
      <p class="mt-2 text-muted font-semibold">
        Ce que Bailly.app garde de vos données, où, et pour combien de temps.
      </p>
    </header>

    <div class="relative space-y-8">
      <!--
        From `xl`, the table of contents on the column's right (where it
        leaves room), from the summary down (the title and its line, a block
        of their own, have nothing beside them), sticky under the header:
        links to the sections, the one in view marked, in neutral colors (as
        the ambiguous forms' headwords). Below, none: the page reads from top
        to bottom.
      -->
      <nav
        aria-labelledby="sommaire"
        class="absolute start-full top-0 ms-12 hidden h-full w-56 xl:block"
      >
        <div class="sticky top-[calc(var(--header-bottom)+1.5rem)]">
          <p
            id="sommaire"
            class="mb-2 px-2.5 text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Sommaire
          </p>
          <ul class="space-y-1">
            <li
              v-for="{ id, title } in sections"
              :key="id"
            >
              <NuxtLink
                :to="{ hash: `#${id}` }"
                :aria-current="currentId === id ? 'location' : undefined"
                class="block truncate rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-(--ui-border-inverted)"
                :class="currentId === id ? 'bg-accented/50 font-semibold text-highlighted' : 'text-muted hover:bg-accented/50 hover:text-highlighted'"
                @click="follow(id)"
              >{{ title }}</NuxtLink>
            </li>
          </ul>
        </div>
      </nav>

      <section
        aria-labelledby="en-bref"
        class="rounded-lg bg-primary/5 p-4 ring-1 ring-primary/15 md:p-6"
      >
        <h2
          id="en-bref"
          class="scroll-mt-[calc(var(--header-bottom)+1.5rem)] font-semibold"
        >
          En bref
        </h2>
        <ul class="mt-3 space-y-2">
          <li
            v-for="point in summary"
            :key="point"
            class="flex gap-2"
          >
            <UIcon
              name="i-lucide-check"
              class="mt-1 size-4 shrink-0 text-primary"
            />
            {{ point }}
          </li>
        </ul>
      </section>

      <section
        aria-labelledby="sur-votre-appareil"
        class="space-y-3"
      >
        <h2
          id="sur-votre-appareil"
          :class="HEADING"
        >
          <UIcon
            name="i-lucide-monitor-smartphone"
            :class="HEADING_ICON"
          />
          Sur votre appareil
        </h2>
        <p>
          Vos signets et l'historique des entrées consultées sont
          enregistrés dans votre navigateur (IndexedDB), sur votre appareil seulement, jusqu'à ce
          que vous les effaciez. Certains navigateurs effacent parfois d'eux-mêmes les données des
          sites, par exemple quand l'espace de stockage vient à manquer&nbsp;: exportez vos
          signets ou activez la synchronisation pour ne pas les perdre.
        </p>
      </section>

      <section
        aria-labelledby="preferences"
        class="space-y-3"
      >
        <h2
          id="preferences"
          :class="HEADING"
        >
          <UIcon
            name="i-lucide-sliders-horizontal"
            :class="HEADING_ICON"
          />
          Préférences
        </h2>
        <p>
          Vos préférences (thème, police, taille et graisse du texte, translittération, recherche,
          affichage des signets) sont gardées dans un cookie, déposé seulement lorsque vous
          modifiez un réglage et conservé treize mois. Notre serveur le lit pour afficher les
          pages avec vos réglages. Le thème est aussi gardé dans un second cookie, conservé un an,
          pour que les pages s'affichent dans le bon thème dès leur chargement.
        </p>
        <p>
          L'état de l'interface (étiquette active, avis masqués) est gardé dans le stockage local
          de votre navigateur. Ces données ne contiennent aucun identifiant et ne servent qu'au
          fonctionnement de l'application.
        </p>
        <p>
          La date de chaque modification de vos préférences est aussi gardée dans votre
          navigateur, pour leur synchronisation si vous l'activez&nbsp;; le cookie peut alors être
          déposé ou modifié pour appliquer un réglage fait sur un autre de vos appareils.
        </p>
      </section>

      <section
        aria-labelledby="synchronisation"
        class="space-y-3"
      >
        <h2
          id="synchronisation"
          :class="HEADING"
        >
          <UIcon
            name="i-lucide-cloud-upload"
            :class="HEADING_ICON"
          />
          Synchronisation
        </h2>
        <p>
          Si vous l'activez, vos signets, les préférences que vous choisissez de synchroniser, ou
          les deux, sont chiffrés sur votre appareil avant d'être envoyés, avec une clé de douze
          mots que vous êtes seul à détenir. Aucun compte n'est nécessaire&nbsp;: notre serveur
          n'en garde qu'une copie chiffrée, qu'il ne peut pas lire, sans votre nom ni votre
          adresse électronique. Nous ne pouvons donc pas non plus retrouver une clé perdue.
        </p>
        <ul class="list-disc space-y-2 ps-5 marker:text-muted">
          <li>
            La copie en ligne est effacée après dix-huit mois sans aucune synchronisation (vos
            appareils gardent la leur), et ce qu'il en reste (l'identifiant du casier et ses
            dates) est supprimé après trois ans.
          </li>
          <li>
            Par mesure de protection contre les abus, un casier créé parmi de nombreux autres
            depuis une même adresse, le même jour, et jamais relu est effacé après trente
            jours&nbsp;; un usage ordinaire n'est pas concerné.
          </li>
          <li>
            Vous pouvez aussi effacer vos données en ligne à tout moment, depuis la fenêtre de
            synchronisation.
          </li>
        </ul>
        <p>
          Un cookie, sans identifiant, retient seulement que la synchronisation est activée sur
          cet appareil (et pour quelles données), afin d'afficher d'emblée le bon bouton&nbsp;; il
          est déposé quand vous l'activez et retiré quand vous la désactivez.
        </p>
      </section>

      <section
        aria-labelledby="adresses-ip"
        class="space-y-3"
      >
        <h2
          id="adresses-ip"
          :class="HEADING"
        >
          <UIcon
            name="i-lucide-fingerprint"
            :class="HEADING_ICON"
          />
          Adresses IP
        </h2>
        <p>
          Pour limiter les abus, notre serveur compte chaque jour les envois de synchronisation de
          chaque adresse IP. Il ne garde pas l'adresse elle-même, mais un pseudonyme (une
          empreinte renouvelée chaque jour), effacé après deux jours. Les journaux techniques de
          l'application ne contiennent ni adresse IP ni adresse des pages consultées.
        </p>
      </section>

      <section
        aria-labelledby="recherches"
        class="space-y-3"
      >
        <h2
          id="recherches"
          :class="HEADING"
        >
          <UIcon
            name="i-lucide-search"
            :class="HEADING_ICON"
          />
          Recherches
        </h2>
        <p>
          Les recherches et les entrées du dictionnaire sont servies par notre API, qui ne
          conserve rien de vos recherches en dehors de ses journaux techniques (pouvant contenir
          votre adresse IP et les adresses demandées). La rétention de ces journaux est éphémère,
          puisque seules les 1.500 dernières lignes sont conservées.
        </p>
      </section>

      <section
        aria-labelledby="mesure-d-audience"
        class="space-y-3"
      >
        <h2
          id="mesure-d-audience"
          :class="HEADING"
        >
          <UIcon
            name="i-lucide-chart-column"
            :class="HEADING_ICON"
          />
          Mesure d'audience
        </h2>
        <p>
          La fréquentation du site est mesurée par
          <a
            target="_blank"
            rel="noopener"
            href="https://docs.simpleanalytics.com/what-we-collect"
            :class="LINK"
          >Simple Analytics</a>, qui ne dépose aucun cookie et n'utilise aucune technique
          équivalente (stockage local, empreinte du navigateur). Votre adresse IP n'est ni
          conservée ni enregistrée.
        </p>
        <p>
          Simple Analytics ne relève que des informations générales&nbsp;: la page consultée
          (sans ses paramètres), la page d'où vous venez, la langue, la taille de l'écran, le
          navigateur et le système sans leur version précise, le temps passé sur la page et son
          défilement, et le pays, déduit du fuseau horaire. Ses serveurs sont aux Pays-Bas, et le
          réglage «&nbsp;Ne pas suivre&nbsp;» (<em>Do Not Track</em>) de votre navigateur est
          respecté.
        </p>
      </section>

      <section
        aria-labelledby="hebergement"
        class="space-y-3"
      >
        <h2
          id="hebergement"
          :class="HEADING"
        >
          <UIcon
            name="i-lucide-server"
            :class="HEADING_ICON"
          />
          Hébergement
        </h2>
        <p>
          L'application est hébergée par Cloudflare, qui achemine les requêtes et protège le site
          contre les abus&nbsp;; à ce titre, Cloudflare traite votre adresse IP, selon sa
          <a
            target="_blank"
            rel="noopener"
            href="https://www.cloudflare.com/privacypolicy/"
            :class="LINK"
          >politique de confidentialité</a>.
        </p>
        <p>
          Pour distinguer les visites des robots, Cloudflare peut déposer un cookie de sécurité
          (<code>__cf_bm</code>), strictement nécessaire&nbsp;: propre à ce site, chiffré, il ne
          sert pas au suivi et expire après trente minutes d'inactivité.
        </p>
      </section>

      <!-- Once the donations are offered (cf. `FEATURES`). -->
      <section
        v-if="FEATURES.donations"
        aria-labelledby="dons"
        class="space-y-3"
      >
        <h2
          id="dons"
          :class="HEADING"
        >
          <UIcon
            name="i-lucide-heart"
            :class="HEADING_ICON"
          />
          Dons
        </h2>
        <p>
          Les dons passent par PayPal&nbsp;: le formulaire de don est celui de PayPal, qui traite
          vos informations selon sa propre politique de confidentialité. Bailly.app n'a jamais
          accès à vos coordonnées bancaires.
        </p>
      </section>

      <section
        aria-labelledby="contact"
        class="space-y-3"
      >
        <h2
          id="contact"
          :class="HEADING"
        >
          <UIcon
            name="i-lucide-mail"
            :class="HEADING_ICON"
          />
          Contact
        </h2>
        <p>
          Pour toute question sur vos données, ou pour exercer vos droits (accès, rectification,
          effacement), écrivez à
          <a
            href="mailto:contact@bailly.app"
            :class="LINK"
          >contact@bailly.app</a>. Comme nous ne pouvons relier aucune copie en ligne à une
          personne, l'effacement de vos données en ligne se fait depuis la fenêtre de
          synchronisation, avec votre clé.
        </p>
      </section>
    </div>
  </article>
</template>
