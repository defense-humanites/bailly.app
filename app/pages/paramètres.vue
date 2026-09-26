<script setup lang="ts">
  import type { RadioGroupItem } from "@nuxt/ui";
  import { InputMode } from "~/enums";
  import { linkDefinition } from "~/utils/linkedEntries";
  import type { ReadingSize } from "~/utils/preferences";

  definePageMeta({
    layout: "single-column",
  });

  useSeoMeta({
    title: "Paramètres",
    description: "Réglez l'affichage des entrées et la recherche selon vos préférences.",
  });

  const { preference, reset: resetPreferences } = usePreferences();
  const showButtonLabels = useButtonLabels();
  const colorMode = useColorMode();

  // The search preferences are shared with the options of the search bar.
  const { inputMode, inflectedForms } = useSearchOptions();
  const readingSize = preference("readingSize");
  const readingWeight = preference("readingWeight");

  const themeItems: RadioGroupItem[] = [
    { label: "Système", value: "system" },
    { label: "Clair", value: "light" },
    { label: "Sombre", value: "dark" },
  ];

  const readingSizeItems: RadioGroupItem[] = [
    { label: "Petite", value: "small" },
    { label: "Normale", value: "normal" },
    { label: "Grande", value: "large" },
    { label: "Très grande", value: "larger" },
  ];

  const letterSizes: Record<ReadingSize, string> = {
    small: "text-sm",
    normal: "text-base",
    large: "text-lg",
    larger: "text-xl",
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
   * A short real entry (λογοτέχνης), to preview the reading settings.
   */
  const preview = linkDefinition("<span class=\"entreea\"><span class=\"grec\">λογο·τέχνης,</span></span> <span class=\"gens\">ου</span>\n<span class=\"art\">(<span class=\"grec\"><a href=\"/ho_(1)\">ὁ</a></span>)</span> habile\nartisan de paroles, <span class=\"aut\">Rhét.</span> (<span class=\"refch\">W. 2, 90</span>).\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\">λ. <a href=\"/technê\">τέχνη</a></span>.</div>\n", { links: false });

  const reset = (): void => {
    resetPreferences();
    colorMode.preference = "system";
  };

  /**
   * Segmented controls, as in the search options.
   */
  const radioUi = { legend: "sr-only", fieldset: "w-full", item: "flex-1 justify-center whitespace-nowrap" };
</script>

<!--
  Compact settings: a card per section, a row per setting (name and short
  help on the left, control on the right), so that they all show at once.
-->
<template>
  <div class="space-y-6">
    <header class="flex items-center justify-between gap-3">
      <h1 class="text-3xl leading-normal font-bold">
        Paramètres
      </h1>
      <UTooltip
        text="Réinitialiser les paramètres"
        :disabled="showButtonLabels"
      >
        <UButton
          label="Réinitialiser"
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="ghost"
          aria-label="Réinitialiser les paramètres"
          :ui="{ label: 'max-xl:sr-only' }"
          @click="reset"
        />
      </UTooltip>
    </header>

    <section aria-labelledby="settings-general">
      <h2
        id="settings-general"
        class="mb-1.5 text-lg font-semibold"
      >
        Général
      </h2>
      <UCard :ui="{ body: '@container divide-y divide-default py-1 sm:py-1' }">
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
          description="Le grec en caractères latins, pour les non-hellénistes (bientôt)."
          disabled
        >
          <USwitch
            :model-value="false"
            disabled
            aria-label="Grec translittéré"
          />
        </SettingsRow>
      </UCard>
    </section>

    <section aria-labelledby="settings-reading">
      <h2
        id="settings-reading"
        class="mb-1.5 text-lg font-semibold"
      >
        Lecture
      </h2>
      <UCard :ui="{ body: '@container divide-y divide-default py-1 sm:py-1' }">
        <!-- The preview follows the settings below. -->
        <!-- eslint-disable vue/no-v-html -->
        <div
          class="definition py-3 font-serif"
          aria-label="Aperçu"
          role="figure"
          v-html="preview"
        />
        <!-- eslint-enable vue/no-v-html -->
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
                class="font-serif leading-none"
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
    </section>

    <section aria-labelledby="settings-search">
      <h2
        id="settings-search"
        class="mb-1.5 text-lg font-semibold"
      >
        Recherche
      </h2>
      <UCard :ui="{ body: '@container divide-y divide-default py-1 sm:py-1' }">
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
    </section>
  </div>
</template>
