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
  // The switches, labelled by their rows' texts (cf. `SettingsRow`).
  const transliterateId = useId();
  const inflectedFormsId = useId();

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
  // The bookmarks page's, also set there (cf. `BookmarksDisplayMenu`).
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
    // The theme too, a preference (cf. `useThemePreference`).
    resetPreferences();
    isResetConfirmationOpen.value = false;
  };

  /**
   * Segmented controls, as in the search options (two sizes below the
   * default, for compactness, with the text of the default size: easy to
   * read and to hit).
   */
  const cardUi = { header: "py-3 sm:py-3", body: "@container divide-y divide-default py-1 sm:py-1" };

  const radioUi = { legend: "sr-only", fieldset: "w-full", item: "flex-1 justify-center whitespace-nowrap", label: "text-sm" };
</script>

<!--
  Compact settings: a card per section, a row per setting (name and short
  help on the left, control on the right), so that they all show at once.
  One column (the reading width, centered) below `lg`; from `lg`, two
  columns, aligned with the header (as the bookmarks page): Synchronization,
  General and Search on the left, Reading (the tallest, with its preview),
  Bookmarks and the reset on the right. From `lg`, the cards are centered
  vertically in the window (without a visible title, they would seem crowded
  at its top).
-->
<template>
  <div class="px-4 py-6 md:px-6 lg:flex lg:min-h-[calc(100dvh-var(--header-total))] lg:flex-col lg:justify-center lg:pt-8 lg:pb-6">
    <div class="mx-auto grid w-full max-w-(--reading-width) grid-cols-1 items-start gap-6 lg:max-w-(--content-max-width) lg:grid-cols-2">
      <!--
        The title for screen readers only: the header's menu already shows
        the page (its link in the primary color), and the cards take the room.
      -->
      <h1 class="sr-only">
        Préférences
      </h1>

      <!--
        Two columns from `lg`, balanced (the tallest card, Reading, with
        Bookmarks and the reset, the shorter column; Synchronization, General
        and Search); below, one column in the order of the cards (`contents`,
        `order`).
      -->
      <div class="contents lg:flex lg:flex-col lg:gap-6">
        <!--
          The synchronization of the bookmarks and of the preferences, type
          by type (rather than a button by the title, as on the bookmarks
          page: the same button on two pages for one key was puzzling); first,
          in the Aegean blue of that button.
        -->
        <SyncCard
          class="order-1"
          :ui="cardUi"
        />

        <UCard
          as="section"
          aria-labelledby="settings-general"
          class="order-2"
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
          <SettingsRow
            label="Thème"
            :synced="synced('theme')"
          >
            <URadioGroup
              v-model="colorMode.preference"
              :items="themeItems"
              :legend="syncedLabel('Thème', 'theme')"
              variant="table"
              size="xs"
              orientation="horizontal"
              indicator="hidden"
              :ui="radioUi"
            />
          </SettingsRow>
          <SettingsRow
            label="Grec translittéré"
            description="Le grec en caractères latins, pour les non-hellénistes."
            :synced="synced('transliterateGreek')"
            :control="transliterateId"
            inline
          >
            <USwitch
              :id="transliterateId"
              v-model="transliterateGreek"
              :aria-label="syncedLabel('Grec translittéré', 'transliterateGreek')"
            />
          </SettingsRow>
        </UCard>

        <UCard
          as="section"
          aria-labelledby="settings-search"
          class="order-4"
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
            :control="inflectedFormsId"
            inline
          >
            <USwitch
              :id="inflectedFormsId"
              v-model="inflectedForms"
              :aria-label="syncedLabel('Formes fléchies', 'inflectedForms')"
            />
          </SettingsRow>
          <SettingsRow
            label="Saisie"
            :synced="synced('inputMode')"
          >
            <!-- The correspondence of the letters, in a window (as the published version's). -->
            <template #description>
              Le grec est toujours accepté.
              <UModal
                title="Table de correspondance"
                description="Les lettres grecques en beta code et en translittération."
                :ui="{ body: 'sm:p-6' }"
              >
                <button
                  type="button"
                  class="underline decoration-dotted underline-offset-3 hover:text-default focus-visible:outline-2 focus-visible:outline-(--ui-border-inverted)"
                >
                  Table de correspondance
                </button>
                <template #body>
                  <ConversionTable />
                </template>
              </UModal>
            </template>
            <URadioGroup
              v-model="inputMode"
              :items="inputModeItems"
              :legend="syncedLabel('Mode de saisie', 'inputMode')"
              variant="table"
              size="xs"
              orientation="horizontal"
              indicator="hidden"
              :ui="radioUi"
            />
          </SettingsRow>
        </UCard>
      </div>
      <div class="contents lg:flex lg:flex-col lg:gap-6">
        <UCard
          as="section"
          aria-labelledby="settings-reading"
          class="order-3"
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
            inline
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
              size="xs"
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
              size="xs"
              orientation="horizontal"
              indicator="hidden"
              :ui="radioUi"
            />
          </SettingsRow>
        </UCard>

        <UCard
          as="section"
          aria-labelledby="settings-bookmarks"
          class="order-5"
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
            description="Leur extrait, ou leur vedette."
            :synced="synced('bookmarksDisplay')"
          >
            <URadioGroup
              v-model="bookmarksDisplay"
              :items="bookmarksDisplayItems"
              :legend="syncedLabel('Affichage des entrées', 'bookmarksDisplay')"
              variant="table"
              size="xs"
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

        <!--
          A dangerous action: at the end, apart from the settings, discreet
          (neutral), confirmed; named after what it does (not « Réinitialiser
          les préférences »: the synchronization, on the page, is left as it
          is). In its window, « Annuler » and « Rétablir » at both ends: not to
          be hit for the other.
        -->
        <UModal
          v-model:open="isResetConfirmationOpen"
          title="Rétablir les réglages par défaut ?"
          :description="syncStore.syncedPreferences.length
            ? 'Le thème, la lecture, la recherche et les signets retrouveront leurs réglages par défaut, aussi sur vos autres appareils pour les préférences synchronisées. La synchronisation reste telle quelle.'
            : 'Le thème, la lecture, la recherche et les signets retrouveront leurs réglages par défaut. La synchronisation reste telle quelle.'"
          :ui="{ footer: 'justify-between' }"
        >
          <UButton
            label="Rétablir les réglages par défaut"
            icon="i-lucide-rotate-ccw"
            color="neutral"
            variant="ghost"
            class="order-6 justify-self-end hover:bg-(--app-page-hover) active:bg-(--app-page-hover) lg:self-end"
          />

          <template #footer>
            <UButton
              label="Annuler"
              color="neutral"
              variant="outline"
              @click="isResetConfirmationOpen = false"
            />
            <UButton
              label="Rétablir"
              color="error"
              @click="reset"
            />
          </template>
        </UModal>
      </div>
    </div>
  </div>
</template>
