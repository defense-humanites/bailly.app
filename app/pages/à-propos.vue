<script setup lang="ts">
  import Mentions from "~/components/pages/à-propos/mentions.vue";

  definePageMeta({
    layout: false,
  });

  useSeoMeta({
    title: "À propos",
    description: "Apprenez-en davantage sur le Bailly en ligne, un dictionnaire de référence numérisé.",
  });
</script>

<template>
  <NuxtLayout
    name="default"
    no-margin
  >
    <header
      class="relative flex h-1/3 justify-center bg-white shadow-2xl after:absolute after:inset-0 after:z-0 after:bg-[url('/bailly-illustration.webp')] after:bg-[length:200vw] after:bg-center after:md:bg-[length:150vw] after:xl:bg-[length:125vw] after:2xl:bg-cover dark:bg-neutral-900 dark:shadow-black/50 after:dark:opacity-50 after:dark:invert"
    >
      <img
        class="absolute -bottom-20 z-10 size-40 animate-rise drop-shadow-2xl [animation-duration:_.75s] xl:-bottom-24 xl:size-48"
        src="/favicon/favicon.svg"
        alt="Logo"
      >
    </header>

    <article class="m-auto mt-20 max-w-screen-md p-6 lg:py-12 xl:mt-24">
      <header class="mb-6 text-center">
        <h1 class="text-3xl font-bold xl:text-4xl">
          À propos d'un dictionnaire<br>
          de référence numérisé
        </h1>
      </header>

      <section
        class="space-y-3 rounded-lg border border-secondary-100 bg-white p-3 font-serif text-xl shadow-xl md:p-6 lg:space-y-6 dark:border-neutral-700/50 dark:bg-neutral-800 dark:shadow-neutral-950"
      >
        <Mentions
          class="rounded-lg bg-secondary-50 p-3 text-lg leading-tight text-secondary-900 dark:bg-neutral-900 dark:text-secondary-400"
        />

        <p>
          <strong>Le «&nbsp;Bailly.&nbsp;»</strong> Le dictionnaire d'Anatole Bailly
          est un ouvrage de référence incontournable pour les hellénistes francophones.
          Depuis sa parution initiale, en 1894, le «&nbsp;Bailly&nbsp;» a connu de
          nombreuses rééditions témoignant de son succès. Le texte que nous proposons
          ici est fondé sur la quatrième édition (1935), aujourd'hui passée dans le
          domaine public. Celui-ci a fait l'objet de révisions substantielles, que
          nous détaillons ci-dessous.
        </p>

        <p>
          <strong>Numérisation et révision.</strong> Cette application doit avant tout
          son existence au travail préalable de M. Gérard Gréco et de son équipe. En
          effet, le <em>«&nbsp;Bailly 2020 Hugo Chávez&nbsp;»</em>, que nous
          mettons à votre disposition, est le résultat d'une entreprise de
          numérisation et de révision sans précédent du dictionnaire d'Anatole
          Bailly. Il aura d'abord été nécessaire à M. Gréco et à son équipe de
          procéder à la numérisation du texte (procédé de reconnaissance optique
          des caractères ou <em>océrisation</em>), avant que de pouvoir
          entreprendre une fastidieuse étape de correction manuelle. Le texte de
          1935 n'étant pas exempt d'erreurs, un travail de correction, effectué à
          partir d'ouvrages de référence, s'est ensuite imposé. Enfin, l'équipe de
          M. Gréco a procédé à une mise à jour des étymologies et de la toponymie,
          ainsi qu'à la normalisation des références. Pour de plus amples détails
          au sujet de cette édition numérique, nous vous suggérons de vous
          reporter à sa <a
            href="/documents/notice-édition-2020.pdf"
            target="_blank"
          >notice</a>.
        </p>

        <p>
          <strong>Autres éditions numériques.</strong> Vous trouverez sur la page du
          projet de numérisation du «&nbsp;Bailly&nbsp;» une
          <a
            target="_blank"
            rel="noopener"
            href="http://gerardgreco.free.fr/spip.php?article24"
          >édition PDF</a>
          proposant une mise en page similaire à celle de l'ouvrage d'origine. Le
          <a
            target="_blank"
            rel="noopener"
            href="https://archive.org/details/BaillyDictionnaireGrecFrancais"
          >fac-similé</a>
          de l'édition de 1935 est par ailleurs disponible sur l'<em>Internet&nbsp;Archive</em>.
        </p>
      </section>

      <!-- Raw text, to be laid out with the rest of the page. -->
      <section
        id="donnees"
        class="mt-6 space-y-3 font-serif text-xl lg:space-y-6"
      >
        <h2 class="text-2xl font-bold">
          Vos données
        </h2>

        <p>
          <strong>Sur votre appareil.</strong> Vos signets (étiquettes et favoris) et
          l'historique des entrées consultées sont enregistrés dans votre navigateur
          (IndexedDB), sur votre appareil seulement, jusqu'à ce que vous les effaciez.
          Certains navigateurs, Safari notamment, effacent d'eux-mêmes les données
          d'un site qui n'a pas été visité depuis quelques jours&nbsp;: exportez vos
          signets ou activez la synchronisation pour ne pas les perdre.
        </p>

        <p>
          <strong>Paramètres.</strong> Vos paramètres (police, taille du texte,
          translittération, préférences de recherche) sont gardés dans un cookie,
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
          jour), effacé après deux jours. Nos journaux techniques ne contiennent ni
          adresse IP ni adresse des pages consultées.
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
      </section>
    </article>
  </NuxtLayout>
</template>
