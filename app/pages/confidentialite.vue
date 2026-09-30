<script setup lang="ts">
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
    "Si vous synchronisez vos signets, ils sont chiffrés sur votre appareil : nous ne pouvons pas les lire.",
    "La mesure d'audience ne dépose aucun cookie et ne conserve pas votre adresse IP.",
  ];
</script>

<template>
  <article class="space-y-6">
    <header>
      <h1 class="text-3xl font-bold">
        Vos données
      </h1>
      <p class="mt-2 text-muted">
        Ce que Bailly.app garde de vos données, où, et pour combien de temps.
      </p>
    </header>

    <section
      aria-labelledby="en-bref"
      class="rounded-lg bg-primary/5 p-4 ring-1 ring-primary/15 md:p-6"
    >
      <h2
        id="en-bref"
        class="font-semibold"
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
      aria-label="En détail"
      class="space-y-4 font-serif text-sm/7"
    >
      <p>
        <strong>Sur votre appareil.</strong> Vos signets (étiquettes et favoris) et
        l'historique des entrées consultées sont enregistrés dans votre navigateur
        (IndexedDB), sur votre appareil seulement, jusqu'à ce que vous les effaciez.
        Certains navigateurs, Safari notamment, effacent d'eux-mêmes les données
        d'un site qui n'a pas été visité depuis quelques jours&nbsp;: exportez vos
        signets ou activez la synchronisation pour ne pas les perdre.
      </p>

      <p>
        <strong>Préférences.</strong> Vos préférences (police, taille du texte,
        translittération, recherche) sont gardées dans un cookie,
        déposé seulement lorsque vous modifiez un réglage et conservé treize mois.
        Notre serveur le lit pour afficher les pages avec vos réglages. Le thème et
        l'état de l'interface (étiquette active, avis masqués) sont gardés dans le
        stockage local de votre navigateur. Ces données ne contiennent aucun
        identifiant et ne servent qu'au fonctionnement de l'application.
      </p>

      <p>
        <strong>Synchronisation des signets.</strong> Si vous l'activez, vos signets
        sont chiffrés sur votre appareil avant d'être envoyés, avec une clé de
        douze mots que vous êtes seul à détenir. Aucun compte n'est nécessaire&nbsp;:
        notre serveur ne garde qu'une copie chiffrée de vos signets, qu'il ne peut
        pas lire, sans votre nom ni votre adresse électronique. Nous ne pouvons
        donc pas non plus retrouver une clé perdue. La copie en ligne est effacée
        après dix-huit mois sans aucune synchronisation (vos appareils gardent la
        leur), et ce qu'il en reste (l'identifiant du casier et ses dates) est
        supprimé après trois ans. Par mesure de protection contre les abus, un
        casier créé parmi de nombreux autres depuis une même adresse, le même jour,
        et jamais relu est effacé après trente jours&nbsp;; un usage ordinaire
        n'est pas concerné. Vous pouvez aussi effacer vos signets en ligne à tout
        moment, depuis la fenêtre de synchronisation.
      </p>

      <p>
        <strong>Adresses IP.</strong> Pour limiter les abus, notre serveur compte
        chaque jour les envois de synchronisation de chaque adresse IP. Il ne garde
        pas l'adresse elle-même, mais un pseudonyme (une empreinte renouvelée chaque
        jour), effacé après deux jours. Les journaux techniques de l'application ne
        contiennent ni adresse IP ni adresse des pages consultées.
      </p>

      <p>
        <strong>Recherches.</strong> Les recherches et les entrées du dictionnaire
        sont servies par notre API, qui ne conserve rien de vos recherches en
        dehors de ses journaux techniques (pouvant contenir votre adresse IP et
        les adresses demandées), effacés après vingt-quatre heures.
      </p>

      <p>
        <strong>Mesure d'audience.</strong> La fréquentation du site est mesurée par
        <a
          target="_blank"
          rel="noopener"
          href="https://docs.simpleanalytics.com/what-we-collect"
        >Simple Analytics</a>, qui ne dépose aucun cookie et n'utilise aucune
        technique équivalente (stockage local, empreinte du navigateur). Votre
        adresse IP n'est ni conservée ni enregistrée. Simple Analytics ne relève
        que des informations générales&nbsp;: la page consultée (sans ses
        paramètres), la page d'où vous venez, la langue, la taille de l'écran, le
        navigateur et le système sans leur version précise, le temps passé sur la
        page et son défilement, et le pays, déduit du fuseau horaire. Ses serveurs sont aux Pays-Bas, et le réglage
        «&nbsp;Ne pas suivre&nbsp;» (<em>Do Not Track</em>) de votre navigateur
        est respecté.
      </p>

      <p>
        <strong>Hébergement.</strong> L'application est hébergée par Cloudflare, qui
        achemine les requêtes et protège le site contre les abus&nbsp;; à ce titre,
        Cloudflare traite votre adresse IP, selon sa
        <a
          target="_blank"
          rel="noopener"
          href="https://www.cloudflare.com/privacypolicy/"
        >politique de confidentialité</a>.
      </p>

      <p>
        <strong>Dons.</strong> Les dons passent par PayPal&nbsp;: le formulaire de
        don est celui de PayPal, qui traite vos informations selon sa propre
        politique de confidentialité. Bailly.app n'a jamais accès à vos
        coordonnées bancaires.
      </p>

      <p>
        <strong>Contact.</strong> Pour toute question sur vos données, ou pour
        exercer vos droits (accès, rectification, effacement), écrivez à
        <a href="mailto:contact@bailly.app">contact@bailly.app</a>. Comme nous ne
        pouvons relier aucune copie en ligne à une personne, l'effacement de vos
        signets en ligne se fait depuis la fenêtre de synchronisation, avec votre
        clé.
      </p>
    </section>
  </article>
</template>
