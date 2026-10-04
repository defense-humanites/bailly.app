<script setup lang="ts">
  import type { NuxtError } from "#app";
  import type { ToasterProps } from "@nuxt/ui";

  const props = defineProps<{ error: NuxtError }>();

  /**
   * The messages of the application's own errors (cf. `createError` in the
   * pages), shown as they are; any other (Nuxt's, the server's, in English)
   * gives way to a general one.
   */
  const OWN_MESSAGES = new Set(["L'entrée n'a pas pu être chargée.", "Les entrées n'ont pas pu être chargées."]);

  const notFound = computed((): boolean => props.error.status === 404);

  const title = computed((): string => (notFound.value ? "Page introuvable" : "Une erreur est survenue"));

  const description = computed((): string => {
    if (notFound.value) return "Cette adresse ne mène à aucune entrée du dictionnaire ni à aucune page de l'application.";
    const message = props.error.statusText ?? "";
    return OWN_MESSAGES.has(message) ? `${message} Réessayez dans un instant.` : "La page n'a pas pu être affichée. Réessayez dans un instant.";
  });

  useSeoMeta({
    title,
    robots: "noindex",
  });

  // As the root component it replaces (`app.vue`): the head, the reading
  // preferences, the theme; and Nuxt UI's providers (`UApp`: tooltips of
  // the header's menu, toasts).
  useAppShell();
  const toaster: ToasterProps = { expand: false, progress: false };

  // Back home, the error cleared (the search bar's navigation clears it too).
  const goHome = () => clearError({ redirect: "/" });
</script>

<template>
  <!--
    On the pages' single column, under the header and its search bar: the
    way to go on.
  -->
  <UApp :toaster="toaster">
    <NuxtLayout name="single-column">
      <article class="space-y-6">
        <header>
          <UIcon
            :name="notFound ? 'i-lucide-search-x' : 'i-lucide-cloud-off'"
            class="mb-4 size-8 text-primary"
          />
          <h1 class="text-3xl font-bold">
            {{ title }}
          </h1>
          <p class="mt-2 text-muted">
            {{ description }}
          </p>
        </header>
        <p>
          Cherchez une entrée dans la barre de recherche, ou revenez à l'accueil,
          où le Bailly s'ouvre au hasard.
        </p>
        <UButton
          label="Retour à l'accueil"
          icon="i-lucide-house"
          color="primary"
          variant="soft"
          @click="goHome"
        />
      </article>
    </NuxtLayout>
  </UApp>
</template>
