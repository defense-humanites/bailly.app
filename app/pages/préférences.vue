<script setup lang="ts">
  import type { RadioGroupItem } from "@nuxt/ui";
  import { InputMode } from "~/enums";
  import { linkDefinition } from "~/utils/linkedEntries";
  import { READING_FONTS } from "~/utils/fonts";
  import { PREVIEW_ENTRIES } from "~/utils/previewEntries";
  import { DEFAULT_PREFERENCES, type ReadingSize, type SyncablePreference } from "~/utils/preferences";

  useSeoMeta({
    title: "Préférences",
    description: "Réglez l'affichage des entrées et la recherche selon vos préférences.",
  });

  const { preference, reset: resetPreferences } = usePreferences();
  const syncStore = useSyncStore();

  /**
   * Whether a preference is synchronized with the other devices (shown by a
   * small cloud, once the settings of the synchronization are loaded).
   */
  const synced = (key: SyncablePreference): boolean => syncStore.loaded && syncStore.syncedPreferences.includes(key);

  /**
   * The accessible name of a control, telling whether it is synchronized.
   */
  const syncedLabel = (label: string, key: SyncablePreference): string =>
    synced(key) ? `${label} (réglage synchronisé avec vos autres appareils)` : label;
  const colorMode = useColorMode();

  // The search preferences are shared with the options of the search bar.
  const { inputMode, inflectedForms } = useSearchOptions();
  const readingFont = preference("readingFont");
  const readingSize = preference("readingSize");
  const transliterateGreek = preference("transliterateGreek");
  const greek = useGreek();
  const readingWeight = preference("readingWeight");
  // The bookmarks page's, also set there (cf. `BookmarksDisplayMenu`,
  // `TagSortMenu`).
  const bookmarksDisplay = preference("bookmarksDisplay");
  const tagSort = preference("tagSort");

  const bookmarksDisplayItems: RadioGroupItem[] = BOOKMARKS_DISPLAYS.map(value => ({ label: BOOKMARKS_DISPLAY_LABELS[value], value }));
  const tagSortItems = TAG_SORTS.map(value => ({ label: TAG_SORT_LABELS[value], value }));

  const themeItems: RadioGroupItem[] = [
    { label: "Système", value: "system" },
    { label: "Clair", value: "light" },
    { label: "Sombre", value: "dark" },
  ];

  /**
   * The fonts (their names aren't shown in them: that would download them
   * all; the preview shows the chosen one).
   */
  const readingFontItems = Object.entries(READING_FONTS)
    .map(([value, { label }]) => ({ label, value }))
    .sort((a, b) =>
      Number(b.value === DEFAULT_PREFERENCES.readingFont) - Number(a.value === DEFAULT_PREFERENCES.readingFont)
      || a.label.localeCompare(b.label, "fr"));

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
   * A short real entry to preview the reading settings, drawn at each visit
   * (cf. `utils/previewEntries.ts`): on the server, then kept by the
   * hydration (the same markup), and drawn again on a later visit in the app.
   */
  const previewIndex = useState("preferences-preview", () => Math.floor(Math.random() * PREVIEW_ENTRIES.length));
  if (import.meta.client && !useNuxtApp().isHydrating) {
    previewIndex.value = Math.floor(Math.random() * PREVIEW_ENTRIES.length);
  }
  const preview = computed(() => linkDefinition(PREVIEW_ENTRIES[previewIndex.value]!.html, { links: false }));

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
  Search on the left, Reading (the tallest, with its preview) and Bookmarks
  on the right.
-->
<template>
  <div class="px-4 py-6 md:px-6 lg:pt-8 lg:pb-6">
    <div class="mx-auto grid max-w-(--reading-width) grid-cols-1 items-start gap-6 lg:max-w-(--content-max-width) lg:grid-cols-2">
      <!-- The title, and the synchronization of the preferences. -->
      <div class="flex items-center justify-between gap-4 lg:col-span-2">
        <h1 class="text-3xl leading-normal font-bold">
          Préférences
        </h1>
        <SyncButton scope="preferences" />
      </div>

      <!--
        Two columns from `lg`, balanced (the tallest card, Reading, with
        Bookmarks; General and Search with the reset); below, one column in
        the order of the cards (`contents`, `order`).
      -->
      <div class="contents lg:flex lg:flex-col lg:gap-6">
        <UCard
          as="section"
          aria-labelledby="settings-general"
          class="order-1"
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
            :synced="synced('transliterateGreek')"
          >
            <USwitch
              v-model="transliterateGreek"
              :aria-label="syncedLabel('Grec translittéré', 'transliterateGreek')"
            />
          </SettingsRow>
        </UCard>

        <UCard
          as="section"
          aria-labelledby="settings-search"
          class="order-3"
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
            :synced="synced('inflectedForms')"
          >
            <USwitch
              v-model="inflectedForms"
              :aria-label="syncedLabel('Formes fléchies', 'inflectedForms')"
            />
          </SettingsRow>
          <SettingsRow
            label="Saisie"
            description="Le grec est toujours accepté."
            :synced="synced('inputMode')"
          >
            <URadioGroup
              v-model="inputMode"
              :items="inputModeItems"
              :legend="syncedLabel('Mode de saisie', 'inputMode')"
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
          title="Réinitialiser les préférences ?"
          :description="syncStore.syncedPreferences.length
            ? 'Le thème, la lecture, la recherche et les signets retrouveront leurs réglages par défaut. Les préférences synchronisées seront aussi réinitialisées sur vos autres appareils.'
            : 'Le thème, la lecture, la recherche et les signets retrouveront leurs réglages par défaut.'"
          :ui="{ footer: 'justify-end' }"
        >
          <UButton
            label="Réinitialiser les préférences"
            icon="i-lucide-rotate-ccw"
            color="error"
            variant="ghost"
            class="order-5 justify-self-end lg:self-start"
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
      <div class="contents lg:flex lg:flex-col lg:gap-6">
        <UCard
          as="section"
          aria-labelledby="settings-reading"
          class="order-2"
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
          <SettingsRow
            label="Police"
            :synced="synced('readingFont')"
          >
            <USelect
              v-model="readingFont"
              :items="readingFontItems"
              :aria-label="syncedLabel('Police', 'readingFont')"
              class="w-48"
            />
          </SettingsRow>
          <SettingsRow
            label="Taille du texte"
            :synced="synced('readingSize')"
          >
            <!-- A letter at each size, rather than words (too wide on mobile). -->
            <URadioGroup
              v-model="readingSize"
              :items="readingSizeItems"
              :legend="syncedLabel('Taille du texte', 'readingSize')"
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
          <SettingsRow
            label="Graisse du texte"
            :synced="synced('readingWeight')"
          >
            <URadioGroup
              v-model="readingWeight"
              :items="readingWeightItems"
              :legend="syncedLabel('Graisse du texte', 'readingWeight')"
              variant="table"
              orientation="horizontal"
              indicator="hidden"
              :ui="radioUi"
            />
          </SettingsRow>
        </UCard>

        <UCard
          as="section"
          aria-labelledby="settings-bookmarks"
          class="order-4"
          :ui="cardUi"
        >
          <template #header>
            <h2
              id="settings-bookmarks"
              class="flex items-center gap-2 text-lg font-semibold"
            >
              <UIcon
                name="i-lucide-bookmark"
                class="size-5 shrink-0 text-muted"
              />
              Signets
            </h2>
          </template>
          <SettingsRow
            label="Affichage des entrées"
            description="Leur extrait, ou leur seule vedette."
            :synced="synced('bookmarksDisplay')"
          >
            <URadioGroup
              v-model="bookmarksDisplay"
              :items="bookmarksDisplayItems"
              :legend="syncedLabel('Affichage des entrées', 'bookmarksDisplay')"
              variant="table"
              orientation="horizontal"
              indicator="hidden"
              :ui="radioUi"
            />
          </SettingsRow>
          <SettingsRow
            label="Tri des étiquettes"
            description="Les étiquettes épinglées restent en tête."
            :synced="synced('tagSort')"
          >
            <USelect
              v-model="tagSort"
              :items="tagSortItems"
              :aria-label="syncedLabel('Tri des étiquettes', 'tagSort')"
              class="w-48"
            />
          </SettingsRow>
        </UCard>
      </div>
    </div>
  </div>
</template>
