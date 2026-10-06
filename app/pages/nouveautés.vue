<script setup lang="ts">
  import { SURVEY_URL } from "~/utils/survey";

  /**
   * The donation, on PayPal's page (as the former application), the same
   * button as the donation flow's (cf. `PaypalDonateButton`).
   */
  const { paypalDonateButtonId } = useRuntimeConfig().public;
  const DONATION_URL = `https://www.paypal.com/donate/?hosted_button_id=${paypalDonateButtonId}&locale.x=fr`;

  definePageMeta({
    layout: "single-column",
  });

  useSeoMeta({
    title: "Nouveautés",
    description: "L'application Bailly a été entièrement réécrite : ce qui change.",
  });

  /**
   * The news of this version (at most eight), their texts here to be easily
   * reworded. The previous article (10 October 2024) is in the history of
   * the old application's repository.
   */
  const news = [
    {
      icon: "i-lucide-sparkles",
      title: "Une interface entièrement repensée.",
      text: "Une palette inspirée de la Grèce classique, une barre de recherche toujours à portée de main, un thème sombre retravaillé et une mise en page pensée aussi bien pour les téléphones que pour les grands écrans.",
    },
    {
      icon: "i-lucide-link",
      title: "Des définitions reliées entre elles.",
      text: "Les mots grecs cités dans les définitions mènent à leurs entrées ; une forme qui peut relever de plusieurs entrées ouvre une page qui les propose toutes. Attendue de longue date, cette fonction demandait un travail de fond sur les données : elle est arrivée quelques jours avant cette nouvelle version.",
    },
    {
      icon: "i-lucide-search",
      title: "Une recherche plus souple.",
      text: "Les résultats distinguent les correspondances exactes des autres entrées. Les options de recherche (position dans l'entrée, diacritiques, caractères jokers « ? » et « * ») sont réunies dans un panneau, et l'historique garde les entrées que vous avez consultées. Le grec se saisit en bêta code ou en translittération.",
    },
    {
      icon: "i-lucide-book-open",
      title: "Une lecture à votre mesure.",
      text: "Choisissez la police du texte grec (Bailly Book, GFS Didot, Artemisia, Bodoni ou NeoHellenic), sa taille et sa graisse. Vous ne lisez pas le grec ? Affichez-le en caractères latins.",
    },
    {
      icon: "i-lucide-bookmark",
      title: "Des signets mieux organisés.",
      text: "Donnez à vos étiquettes une couleur et une description, épinglez les plus utiles, triez-les, affichez les extraits des entrées ou leurs seules vedettes. Une suppression s'annule d'un geste, et vos signets se sauvegardent dans un fichier.",
    },
    {
      icon: "i-lucide-cloud",
      title: "Vos signets et vos préférences sur tous vos appareils.",
      text: "La synchronisation ne demande aucun compte : vos données sont chiffrées sur votre appareil avant d'être envoyées, avec une clé de douze mots que vous seul détenez. Nous ne pouvons pas les lire.",
    },
    {
      icon: "i-lucide-shuffle",
      title: "Le Bailly ouvert au hasard.",
      text: "La page d'accueil ouvre le dictionnaire sur une entrée tirée au sort, entre ses voisines, pour le plaisir de feuilleter.",
    },
    {
      icon: "i-lucide-info",
      title: "L'histoire du texte, et vos données.",
      text: "La page « À propos » retrace le chemin du dictionnaire, de l'édition de 1935 au Bailly 2020 Hugo Chávez de Gérard Gréco et de son équipe ; la page « Vos données » détaille ce que l'application conserve, et où.",
    },
  ];
</script>

<template>
  <article class="space-y-6 [&_p_a]:text-primary [&_p_a]:underline [&_p_a]:underline-offset-2">
    <header>
      <h1 class="text-3xl font-bold">
        Une nouvelle application Bailly
      </h1>
      <p class="mt-2 text-muted">
        L'application Bailly a été entièrement réécrite. Voici ce qui
        change&nbsp;:
      </p>
    </header>

    <div class="relative space-y-6">
      <ul class="space-y-6">
        <li
          v-for="item in news"
          :key="item.title"
          class="flex gap-3"
        >
          <UIcon
            :name="item.icon"
            class="mt-0.5 size-5 shrink-0 text-primary"
          />
          <div>
            <h2 class="font-semibold">
              {{ item.title }}
            </h2>
            <p class="mt-1">
              {{ item.text }}
            </p>
          </div>
        </li>
      </ul>

      <p class="text-muted">
        &mdash; Antoine Boquet, le 4 octobre 2026.
      </p>

      <!--
        The survey and the contact: below the news; from `xl`, on the
        column's right (where it leaves room, as the privacy page's table of
        contents), beside the news, sticky under the header: the survey in
        view from the start.
      -->
      <div class="space-y-6 xl:absolute xl:start-full xl:top-0 xl:ms-12 xl:h-full xl:w-72">
        <div class="space-y-6 xl:sticky xl:top-[calc(var(--header-bottom)+1.5rem)]">
          <aside class="space-y-4 rounded-lg bg-secondary/5 p-4 ring-1 ring-secondary/20 md:p-6 xl:p-5">
            <p>
              <strong>Et ensuite&nbsp;?</strong> Aidez-nous à choisir les prochaines fonctions de
              l'application&nbsp;: le questionnaire est anonyme et prend environ deux minutes.
            </p>
            <UButton
              :to="SURVEY_URL"
              target="_blank"
              color="secondary"
              icon="i-lucide-clipboard-list"
              label="Répondre au questionnaire"
            />
          </aside>

          <aside class="rounded-lg bg-primary/5 p-4 ring-1 ring-primary/15 md:p-6 xl:p-5">
            <p>
              Si vous souhaitez nous faire part de votre avis ou nous contacter pour
              toute autre raison, vous pouvez nous joindre par
              <a href="mailto:contact@bailly.app">courriel</a>. Et si l'application vous est
              utile, vous pouvez aussi
              <!-- PayPal's page directly, not the donation flow (`/soutenir`, not offered yet). -->
              <a
                :href="DONATION_URL"
                target="_blank"
                rel="noopener"
              >nous soutenir</a>.
            </p>
          </aside>
        </div>
      </div>
    </div>
  </article>
</template>
