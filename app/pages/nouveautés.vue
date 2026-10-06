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
    description: "Une nouvelle application Bailly : des fonctions repensées, et quelques nouveautés attendues.",
  });

  const searchOptionsPanel = useSearchOptionsPanel();

  /**
   * A part of a news' text: a string, or a key naming a control, which it
   * points out (cf. `INLINE_BUTTON`).
   */
  type NewsPart = string | { key: string; icon: string; action: () => void };

  /**
   * The news of this version (at most eight), their texts here to be easily
   * reworded. The previous article (10 October 2024) is in the history of
   * the old application's repository.
   */
  const news: { icon: string; title: string; text: string | NewsPart[] }[] = [
    {
      icon: "i-lucide-bookmark",
      title: "Des signets mieux organisés.",
      text: "Donnez à vos étiquettes une couleur et une description, épinglez les plus utiles, triez-les, affichez les extraits des entrées ou leurs seules vedettes. Une suppression s'annule d'un geste. Vous pouvez aussi enregistrer vos signets dans un fichier, pour les conserver ou les importer ailleurs.",
    },
    {
      icon: "i-lucide-cloud",
      title: "Vos signets et vos préférences sur tous vos appareils.",
      text: "Activez la synchronisation sur un premier appareil, puis ajoutez les autres avec votre clé : un QR code à scanner, ou douze mots à saisir. Vos signets et vos réglages vous suivent alors de l'ordinateur au téléphone. Aucun compte à créer, et tout reste privé : vos données sont chiffrées avant même de quitter votre appareil.",
    },
    {
      icon: "i-lucide-link",
      title: "Des définitions reliées entre elles.",
      text: "Les mots grecs cités dans les définitions mènent à leurs entrées ; une forme qui peut relever de plusieurs entrées ouvre une page qui les propose toutes.",
    },
    {
      icon: "i-lucide-search",
      title: "Une recherche plus souple.",
      text: [
        "Les résultats distinguent mieux les correspondances exactes des autres entrées, et les options de recherche (position dans l'entrée, diacritiques, caractères jokers « ? » et « * ») sont désormais réunies dans un panneau, qui s'ouvre d'un clic sur le bouton des ",
        { key: "filtres", icon: "i-lucide-list-filter", action: searchOptionsPanel.open },
        ", au bout de la barre de recherche.",
      ],
    },
    {
      icon: "i-lucide-book-open",
      title: "Une lecture sur mesure.",
      text: "Choisissez parmi cinq polices grecques, et réglez la taille et la graisse du texte selon votre convenance. Vous ne lisez pas le grec ? Affichez-le en caractères latins dans des préférences.",
    },
    {
      icon: "i-lucide-palette",
      title: "Une interface rafraîchie.",
      text: "Une palette inspirée de la Grèce classique (le marbre des temples, la terre cuite des vases attiques, le bleu de l'Égée et l'or des offrandes), un thème sombre au noir lustré des céramiques, une barre de recherche toujours à portée de main et une mise en page pensée aussi bien pour les téléphones que pour les grands écrans.",
    },
  ];
</script>

<template>
  <article class="space-y-6">
    <!--
      The title, without a card (which would vie with the survey's and the
      contact's, beside it from `xl`): the news' eyebrow (the party popper,
      their icon, in their color, as the button leading here).
    -->
    <PageHeader
      :eyebrow="{ label: 'Nouveautés · octobre 2026', icon: 'i-lucide-party-popper' }"
      title="Une nouvelle application Bailly"
      subtitle="Des fonctions repensées, et quelques nouveautés attendues."
    />

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
              <template v-if="typeof item.text === 'string'">
                {{ item.text }}
              </template>
              <template
                v-for="(part, index) in item.text"
                v-else
                :key="index"
              >
                <!-- Inline, not to add spaces around the keys (e.g. before a comma). -->
                <span v-if="typeof part === 'string'">{{ part }}</span>
                <button
                  v-else
                  type="button"
                  :class="INLINE_BUTTON"
                  @click="part.action()"
                >
                  <UIcon
                    :name="part.icon"
                    class="size-4 shrink-0"
                  />{{ part.key }}
                </button>
              </template>
            </p>
          </div>
        </li>
      </ul>

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
              l'application&nbsp;: le questionnaire est anonyme et ne vous prendra qu'environ deux minutes.
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
              toute autre raison, vous pouvez
              <a
                href="mailto:contact@bailly.app"
                class="link"
              >nous joindre</a> par courriel. Et si l'application vous est utile,
              <!--
                PayPal's page directly, not the donation flow (`/soutenir`, not
                offered yet). Never broken: rather the next line, whole.
              -->
              <a
                :href="DONATION_URL"
                target="_blank"
                rel="noopener"
                class="link whitespace-nowrap"
              >participez aux frais</a> d'entretien pour en assurer la pérennité.
            </p>
          </aside>
        </div>
      </div>
    </div>
  </article>
</template>
