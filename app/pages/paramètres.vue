<script setup lang="ts">
  import type { RadioGroupItem } from "@nuxt/ui";

  definePageMeta({
    layout: "single-column",
  });

  useSeoMeta({
    title: "Paramètres",
    description: "Réglez les paramètres d'affichage et de recherche en fonction de vos préférences.",
  });

  const displayLayoutOptions: RadioGroupItem[] = [
    {
      label: "Horizontal",
      value: "horizontal",
    },
    {
      label: "Vertical",
      value: "vertical",
    },
  ];

  const displayThemeOptions: RadioGroupItem[] = [
    {
      label: "Système",
      value: "system",
    },
    {
      label: "Clair",
      value: "light",
    },
    {
      label: "Foncé",
      value: "dark",
    },
  ];

  const searchInputModeOptions = ref<RadioGroupItem[]>([
    {
      label: "Beta code",
      value: "betaCode",
    },
    {
      label: "Translittération",
      value: "transliteration",
    },
  ]);

  const searchLemmatizationOptions = ref<RadioGroupItem[]>([
    {
      label: "Désactivé",
      value: "disabled",
    },
    {
      default: true,
      label: "Activé",
      value: "enabled",
    },
  ]);
</script>

<template>
  <form class="space-y-6 lg:space-y-12">
    <h1 class="text-3xl leading-normal font-bold">
      Paramètres
    </h1>

    <section>
      <h2>Affichage</h2>
      <fieldset>
        <fieldset>
          <legend>Disposition</legend>
          <p>
            ...
          </p>
          <URadioGroup
            variant="table"
            orientation="horizontal"
            default-value="horizontal"
            :items="displayLayoutOptions"
          />
        </fieldset>
      </fieldset>

      <fieldset>
        <fieldset>
          <legend>Thème</legend>
          <p>
            Lorsque l'option <em>système</em> est active, le thème sélectionné suit
            auto&shy;mati&shy;que&shy;ment les préférences d'affichage de votre appareil.
          </p>
          <URadioGroup
            variant="table"
            orientation="horizontal"
            default-value="system"
            :items="displayThemeOptions"
          />
        </fieldset>
      </fieldset>
    </section>

    <section>
      <h2>Recherche</h2>
      <fieldset>
        <fieldset>
          <legend>Mode de saisie</legend>
          <p>
            Le « beta code » non accentué instaure une équivalence arbitraire
            entre les caractères latins et grecs, tandis que la saisie
            translittérée correspond à la manière usuelle de présenter du grec à
            l'usage d'un public non helléniste.
          </p>
          <p>
            Voyez la
            <ModalLink
              client:load
              label="table de correspondance"
              modal-title="Table de correspondance"
            >
              <template #modalContent>
                <ConversionChart />
              </template>
            </ModalLink>.
          </p>
          <URadioGroup
            variant="table"
            orientation="horizontal"
            default-value="betaCode"
            :items="searchInputModeOptions"
          />
        </fieldset>
      </fieldset>
      <fieldset>
        <fieldset>
          <legend>Lemmatisation</legend>
          <p>
            Lorsque la lemmatisation est active, les formes fléchies peuvent
            produire des résultats de recherche.
          </p>
          <URadioGroup
            variant="table"
            orientation="horizontal"
            default-value="enabled"
            :items="searchLemmatizationOptions"
          />
        </fieldset>
      </fieldset>
    </section>

    <!-- <section>
      <h2>Accessibiltié</h2>
      <fieldset>
        <fieldset>
          <legend>Romanisation du grec</legend>
          <RadioGroup
            groupName="settings-display-greek-transliteration"
            options={greekRomanizationOptions}
            storageKey={LocalStorageKey.EnableGreekRomanization}
          />
        </fieldset>
      </fieldset>
    </section> -->
  </form>
</template>

<style scoped>
  @reference "~/assets/css/main.css";

  section {
    @apply space-y-6;
  }

  section h2 {
    @apply text-2xl;
    @apply font-semibold;
  }

  section>fieldset {
    @apply p-3 lg:p-6;
    @apply bg-white dark:bg-neutral-800;
    @apply rounded-lg;
    @apply shadow-xl;
  }

  fieldset p {
    @apply mb-1.5;
    @apply text-sm sm:text-base;
  }

  legend {
    @apply h-auto;
    @apply mb-1.5 lg:mb-3;
    @apply text-xl;
    @apply font-semibold;
  }
</style>
