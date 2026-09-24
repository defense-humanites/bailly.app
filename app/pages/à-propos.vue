<script setup lang="ts">
  import Mentions from '~/components/pages/à-propos/mentions.vue';

  definePageMeta({
    layout: false,
  });

  useSeoMeta({
    title: "À propos",
    description: "Apprenez-en davantage sur le Bailly en ligne, un dictionnaire de référence numérisé."
  });
</script>

<template>
  <NuxtLayout name="default" noMargin>
    <header
      class="relative flex h-1/3 justify-center bg-white shadow-2xl after:absolute after:inset-0 after:z-0 after:bg-[url('/bailly-illustration.webp')] after:bg-[length:200vw] after:bg-center after:md:bg-[length:150vw] after:xl:bg-[length:125vw] after:2xl:bg-cover dark:bg-neutral-900 dark:shadow-black/50 after:dark:opacity-50 after:dark:invert">
      <img
        class="absolute -bottom-20 z-10 size-40 animate-rise drop-shadow-2xl [animation-duration:_.75s] xl:-bottom-24 xl:size-48"
        src="/favicon/favicon.svg" alt="Logo" />
    </header>

    <article class="m-auto mt-20 max-w-screen-md p-6 lg:py-12 xl:mt-24">
      <header class="mb-6 text-center">
        <h1 class="text-3xl font-bold xl:text-4xl">
          À propos d'un dictionnaire<br />
          de référence numérisé
        </h1>
      </header>

      <section
        class="space-y-3 rounded-lg border border-secondary-100 bg-white p-3 font-serif text-xl shadow-xl md:p-6 lg:space-y-6 dark:border-neutral-700/50 dark:bg-neutral-800 dark:shadow-neutral-950">
        <Mentions
          class="rounded-lg bg-secondary-50 p-3 text-lg leading-tight text-secondary-900 dark:bg-neutral-900 dark:text-secondary-400" />

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
          reporter à sa <a href="/documents/notice-édition-2020.pdf" target="_blank">notice</a>.
        </p>

        <p>
          <strong>Autres éditions numériques.</strong> Vous trouverez sur la page du
          projet de numérisation du «&nbsp;Bailly&nbsp;» une
          <a target="_blank" rel="noopener" href="http://gerardgreco.free.fr/spip.php?article24">édition PDF</a>
          proposant une mise en page similaire à celle de l'ouvrage d'origine. Le
          <a target="_blank" rel="noopener"
            href="https://archive.org/details/BaillyDictionnaireGrecFrancais">fac-similé</a>
          de l'édition de 1935 est par ailleurs disponible sur l'<em>Internet&nbsp;Archive</em>.
        </p>
      </section>
    </article>
  </NuxtLayout>
</template>