<script setup lang="ts">
  import type { RadioGroupItem } from "@nuxt/ui";
  import { InputMode } from "~/enums";
  import { linkDefinition } from "~/utils/linkedEntries";
  import { READING_FONTS } from "~/utils/fonts";
  import type { ReadingSize } from "~/utils/preferences";

  useSeoMeta({
    title: "Paramètres",
    description: "Réglez l'affichage des entrées et la recherche selon vos préférences.",
  });

  const { preference, reset: resetPreferences } = usePreferences();
  const colorMode = useColorMode();

  // The search preferences are shared with the options of the search bar.
  const { inputMode, inflectedForms } = useSearchOptions();
  const readingFont = preference("readingFont");
  const readingSize = preference("readingSize");
  const transliterateGreek = preference("transliterateGreek");
  const greek = useGreek();
  const readingWeight = preference("readingWeight");

  const themeItems: RadioGroupItem[] = [
    { label: "Système", value: "system" },
    { label: "Clair", value: "light" },
    { label: "Sombre", value: "dark" },
  ];

  /**
   * The fonts (their names aren't shown in them: that would download them
   * all; the preview shows the chosen one).
   */
  const readingFontItems = Object.entries(READING_FONTS).map(([value, { label }]) => ({ label, value }));

  const readingSizeItems: RadioGroupItem[] = [
    { label: "Petite", value: "small" },
    { label: "Normale", value: "normal" },
    { label: "Grande", value: "large" },
    { label: "Très grande", value: "larger" },
  ];

  const letterSizes: Record<ReadingSize, string> = {
    small: "text-[0.6875rem]",
    normal: "text-[0.78125rem]",
    large: "text-sm",
    larger: "text-[0.96875rem]",
  };

  const readingWeightItems: RadioGroupItem[] = [
    { label: "Normale", value: "normal" },
    { label: "Appuyée", value: "bold" },
  ];

  const inputModeItems: RadioGroupItem[] = [
    { label: "Beta code", value: InputMode.BetaCode },
    { label: "Translittération", value: InputMode.Transliteration },
  ];

  /**
   * A short real entry (ὀψομανής), to preview the reading settings: long
   * enough to take two lines on a desktop screen whatever the font, weight and
   * size, so that the preview keeps its height when they change.
   */
  const preview = linkDefinition("<span class=\"entreea\"><span class=\"grec\">ὀψο·μανής,</span></span> <span class=\"des\">ής, ές</span>\n[<span class=\"grec\">ᾰ</span>] passionné pour la bonne chère,\ngourmet, <span class=\"aut\">Ath.</span> <span class=\"refpa\">464</span><span class=\"refpb\">e</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\"><a href=\"/opson\">ὄψον</a>, <a href=\"/mainomai\">μαίνομαι</a></span>.</div>\n", { links: false });

  /**
   * Resetting the settings is confirmed first (it can't be undone).
   */
  const isResetConfirmationOpen = ref(false);

  const reset = (): void => {
    resetPreferences();
    colorMode.preference = "system";
    isResetConfirmationOpen.value = false;
  };

  /**
   * Segmented controls, as in the search options.
   */
  const cardUi = { header: "py-3 sm:py-3", body: "@container divide-y divide-default py-1 sm:py-1" };

  const radioUi = { legend: "sr-only", fieldset: "w-full", item: "flex-1 justify-center whitespace-nowrap" };
</script>

<!--
  Compact settings: a card per section, a row per setting (name and short
  help on the left, control on the right), so that they all show at once.
  One column (the reading width, centered) below `lg`; from `lg`, two
  columns, aligned with the header (as the bookmarks page): General and
  Search on the left, Reading (the tallest, with its preview) on the right.
-->
<template>
  <div class="px-4 py-6 md:px-6 lg:py-12">
    <div class="mx-auto grid max-w-(--reading-width) grid-cols-1 items-start gap-6 lg:max-w-(--header-max-width) lg:grid-cols-2 lg:grid-rows-[auto_auto_1fr_auto]">
      <h1 class="text-3xl leading-normal font-bold lg:col-span-2">
        Paramètres
      </h1>

      <UCard
        as="section"
        aria-labelledby="settings-general"
        class="lg:col-start-1 lg:row-start-2"
        :ui="cardUi"
      >
        <template #header>
          <h2
            id="settings-general"
            class="flex items-center gap-2 text-lg font-semibold"
          >
            <UIcon
              name="i-lucide-settings-2"
              class="size-5 shrink-0 text-muted"
            />
            Général
          </h2>
        </template>
        <SettingsRow label="Thème">
          <URadioGroup
            v-model="colorMode.preference"
            :items="themeItems"
            legend="Thème"
            variant="table"
            orientation="horizontal"
            indicator="hidden"
            :ui="radioUi"
          />
        </SettingsRow>
        <SettingsRow
          label="Grec translittéré"
          description="Le grec en caractères latins, pour les non-hellénistes."
        >
          <USwitch
            v-model="transliterateGreek"
            aria-label="Grec translittéré"
          />
        </SettingsRow>
      </UCard>

      <UCard
        as="section"
        aria-labelledby="settings-reading"
        class="lg:col-start-2 lg:row-span-2 lg:row-start-2"
        :ui="cardUi"
      >
        <template #header>
          <h2
            id="settings-reading"
            class="flex items-center gap-2 text-lg font-semibold"
          >
            <UIcon
              name="i-lucide-book-open"
              class="size-5 shrink-0 text-muted"
            />
            Lecture
          </h2>
        </template>
        <!-- The preview follows the settings below. -->
        <!-- eslint-disable vue/no-v-html -->
        <div
          class="definition py-3 font-serif"
          aria-label="Aperçu"
          role="figure"
          v-html="greek.html(preview)"
        />
        <!-- eslint-enable vue/no-v-html -->
        <SettingsRow label="Police">
          <USelect
            v-model="readingFont"
            :items="readingFontItems"
            aria-label="Police"
            class="w-48"
          />
        </SettingsRow>
        <SettingsRow label="Taille du texte">
          <!-- A letter at each size, rather than words (too wide on mobile). -->
          <URadioGroup
            v-model="readingSize"
            :items="readingSizeItems"
            legend="Taille du texte"
            variant="table"
            orientation="horizontal"
            indicator="hidden"
            :ui="{ ...radioUi, item: 'flex-1 justify-center items-center px-4' }"
          >
            <template #label="{ item }">
              <span
                class="font-serif leading-5"
                :class="letterSizes[item.value as ReadingSize]"
                aria-hidden="true"
              >A</span>
              <span class="sr-only">{{ item.label }}</span>
            </template>
          </URadioGroup>
        </SettingsRow>
        <SettingsRow label="Graisse du texte">
          <URadioGroup
            v-model="readingWeight"
            :items="readingWeightItems"
            legend="Graisse du texte"
            variant="table"
            orientation="horizontal"
            indicator="hidden"
            :ui="radioUi"
          />
        </SettingsRow>
      </UCard>

      <UCard
        as="section"
        aria-labelledby="settings-search"
        class="lg:col-start-1 lg:row-start-3"
        :ui="cardUi"
      >
        <template #header>
          <h2
            id="settings-search"
            class="flex items-center gap-2 text-lg font-semibold"
          >
            <UIcon
              name="i-lucide-search"
              class="size-5 shrink-0 text-muted"
            />
            Recherche
          </h2>
        </template>
        <SettingsRow
          label="Formes fléchies"
          description="Chercher aussi les formes déclinées ou conjuguées (analyse morphologique)."
        >
          <USwitch
            v-model="inflectedForms"
            aria-label="Formes fléchies"
          />
        </SettingsRow>
        <SettingsRow
          label="Saisie"
          description="Le grec est toujours accepté."
        >
          <URadioGroup
            v-model="inputMode"
            :items="inputModeItems"
            legend="Mode de saisie"
            variant="table"
            orientation="horizontal"
            indicator="hidden"
            :ui="radioUi"
          />
        </SettingsRow>
      </UCard>

      <!-- A dangerous action: at the end, apart from the settings, confirmed. -->
      <UModal
        v-model:open="isResetConfirmationOpen"
        title="Réinitialiser les paramètres ?"
        description="Le thème, la lecture et les préférences de recherche retrouveront leurs valeurs par défaut."
        :ui="{ footer: 'justify-end' }"
      >
        <UButton
          label="Réinitialiser les paramètres"
          icon="i-lucide-rotate-ccw"
          color="error"
          variant="ghost"
          class="justify-self-end lg:col-span-2"
        />

        <template #footer>
          <UButton
            label="Annuler"
            color="neutral"
            variant="outline"
            @click="isResetConfirmationOpen = false"
          />
          <UButton
            label="Réinitialiser"
            color="error"
            @click="reset"
          />
        </template>
      </UModal>
    </div>
  </div>
</template>
