<script setup lang="ts">
  import type { RadioGroupItem } from "@nuxt/ui";
  import type { SearchPosition } from "~/utils/searchInput";

  const { position, diacriticSensitive, isDefault, reset } = useSearchOptions();

  const positionItems: RadioGroupItem[] = [
    { label: "Début", value: "start" },
    { label: "Contient", value: "contains" },
    { label: "Fin", value: "end" },
    { label: "Exact", value: "exact" },
  ];

  const positionHints: Record<SearchPosition, string> = {
    start: "Les entrées qui commencent par la saisie (λογ → λόγος, λογικός…).",
    contains: "Les entrées qui contiennent la saisie (λογ → ἀναλογία…).",
    end: "Les entrées qui se terminent par la saisie (λογος → διάλογος…).",
    exact: "L'entrée identique à la saisie, et ses formes fléchies.",
  };
</script>

<template>
  <UPopover :content="{ align: 'end', collisionPadding: 12 }">
    <!-- A dot on the button when an option isn't the default one. -->
    <UButton
      color="neutral"
      variant="outline"
      size="lg"
      class="shadow-xs"
      aria-label="Options de recherche"
    >
      <UChip
        :show="!isDefault"
        size="sm"
        inset
      >
        <UIcon
          name="i-lucide-list-filter"
          class="size-4"
        />
      </UChip>
    </UButton>

    <template #content>
      <form
        class="w-72 space-y-5 p-4"
        @submit.prevent
      >
        <fieldset>
          <legend class="mb-2 text-sm font-medium">
            Position dans l'entrée
          </legend>
          <URadioGroup
            v-model="position"
            :items="positionItems"
            variant="table"
            orientation="horizontal"
            indicator="hidden"
            size="sm"
            :ui="{ item: 'flex-1 justify-center' }"
          />
          <p class="mt-1.5 text-xs text-muted">
            {{ positionHints[position] }}
          </p>
        </fieldset>

        <USwitch
          v-model="diacriticSensitive"
          label="Tenir compte des diacritiques"
          description="Accents, esprits, iota souscrit… (p. ex. ἆρα ≠ ἄρα)."
          size="sm"
        />

        <div class="flex justify-end">
          <UButton
            label="Réinitialiser"
            color="neutral"
            variant="link"
            size="sm"
            :disabled="isDefault"
            @click="reset"
          />
        </div>
      </form>
    </template>
  </UPopover>
</template>
