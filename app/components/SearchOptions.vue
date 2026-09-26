<script setup lang="ts">
  import type { RadioGroupItem } from "@nuxt/ui";
  import { InputMode } from "~/enums";
  import { isLemmatizable } from "~/utils/searchInput";

  const props = defineProps<{
    /** Whether the query has wildcards (no inflected forms then). */
    wildcards?: boolean;
  }>();

  const { position, diacriticSensitive, inputMode, inflectedForms, isDefault, reset } = useSearchOptions();

  const lemmatizable = computed((): boolean => isLemmatizable(position.value, props.wildcards));

  const positionItems: RadioGroupItem[] = [
    { label: "Début", value: "start" },
    { label: "Contient", value: "contains" },
    { label: "Fin", value: "end" },
    { label: "Exact", value: "exact" },
  ];

  /**
   * Inflected forms can't be looked up for a part of a word, nor with
   * wildcards: the switch is then disabled.
   */
  const inflectedFormsLabel = computed((): string =>
    lemmatizable.value ? "Formes fléchies" : "Formes fléchies (sans objet)",
  );

  const inputModeItems: RadioGroupItem[] = [
    { label: "Beta code", value: InputMode.BetaCode },
    { label: "Translittération", value: InputMode.Transliteration },
  ];

  /**
   * Compact rows: a label on the left, the control on the right.
   */
  const radioUi = { legend: "sr-only", fieldset: "w-full", item: "flex-1 justify-center py-1 px-2" };
  const switchUi = { root: "flex-row-reverse items-center justify-between gap-3", wrapper: "ms-0", label: "text-sm font-normal" };
</script>

<template>
  <UPopover :content="{ align: 'end', collisionPadding: 12 }">
    <!--
      A dot on the button when an option isn't the default one; a background
      while the panel is open. When the input
      has the focus, the button's ring takes its color, except on the left
      edge (a pseudo-element): the divider stays neutral.
    -->
    <UButton
      color="neutral"
      variant="outline"
      size="lg"
      class="relative w-12 shrink-0 justify-center before:absolute before:inset-y-0 before:start-0 before:w-px before:bg-(--ui-border-accented) data-[state=open]:bg-elevated group-has-[input:focus-visible]/search:ring-primary"
      aria-label="Options de recherche"
    >
      <UChip
        :show="!isDefault"
        size="sm"
        inset
      >
        <UIcon
          name="i-lucide-list-filter"
          class="size-5"
        />
      </UChip>
    </UButton>

    <!--
      Compact rows (label, control). The options first, then, below a line,
      the preferences (stored: cf. the settings page). In a narrow panel
      (below 18rem, at the application's minimum width), the labels of the
      radio groups go above them.
    -->
    <template #content>
      <form
        class="@container w-[min(22rem,calc(var(--app-width)-2rem))] space-y-2.5 p-3 text-sm"
        @submit.prevent
      >
        <div class="flex h-5 items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wide text-muted">Options</span>
          <UButton
            v-if="!isDefault"
            label="Réinitialiser"
            color="neutral"
            variant="link"
            size="xs"
            class="p-0"
            @click="reset"
          />
        </div>

        <div>
          <div class="flex flex-col gap-1 @2xs:flex-row @2xs:items-center @2xs:gap-3">
            <span
              class="shrink-0 @2xs:w-24"
              aria-hidden="true"
            >Position</span>
            <URadioGroup
              v-model="position"
              :items="positionItems"
              legend="Position dans l'entrée"
              variant="table"
              orientation="horizontal"
              indicator="hidden"
              size="xs"
              class="grow"
              :ui="radioUi"
            />
          </div>
          <p class="mt-1 text-xs text-muted @2xs:ps-27">
            <kbd>?</kbd> une lettre · <kbd>*</kbd> plusieurs
          </p>
        </div>

        <USwitch
          v-model="diacriticSensitive"
          label="Diacritiques"
          size="sm"
          :ui="switchUi"
        />

        <USeparator />

        <USwitch
          v-model="inflectedForms"
          :label="inflectedFormsLabel"
          :disabled="!lemmatizable"
          size="sm"
          :ui="switchUi"
        />

        <div class="flex flex-col gap-1 @2xs:flex-row @2xs:items-center @2xs:gap-3">
          <span
            class="shrink-0 @2xs:w-24"
            aria-hidden="true"
          >Saisie</span>
          <URadioGroup
            v-model="inputMode"
            :items="inputModeItems"
            legend="Mode de saisie"
            variant="table"
            orientation="horizontal"
            indicator="hidden"
            size="xs"
            class="grow"
            :ui="radioUi"
          />
        </div>
      </form>
    </template>
  </UPopover>
</template>
