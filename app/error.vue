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
    const message = props.error.message;
    return OWN_MESSAGES.has(message) ? message : "La page n'a pas pu être affichée.";
  });

  /**
   * Any other error than a missing page may not pass by itself (e.g. a
   * browser lacking a function, as on iOS 16, issue #10): the reader is
   * asked to try again, and to write to us if it lasts, the page's address
   * in the subject.
   */
  const route = useRoute();
  const contactHref = computed((): string => {
    let path = route.path;
    try {
      path = decodeURI(path);
    } catch {
      // A malformed address: kept as it is.
    }
    return `mailto:contact@bailly.app?subject=${encodeURIComponent(`Erreur sur la page ${path}`)}`;
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

  /**
   * A failure while the application starts in the browser (e.g. a plugin,
   * as with `URL.canParse` on iOS 16, issue #10) renders this page in place
   * of the page served, whose markup Vue then leaves in place after its own
   * (a hydration mismatch): the two showed one over the other (the pages
   * scroll in fixed boxes). What isn't this page's is removed from the
   * application's root.
   */
  const article = useTemplateRef("article");
  onMounted(() => {
    const root = document.getElementById("__nuxt");
    for (const child of [...root?.children ?? []]) {
      if (!child.contains(article.value)) child.remove();
    }
  });
</script>

<template>
  <!--
    On the pages' single column, under the header and its search bar (its
    navigation clears the error).
  -->
  <UApp :toaster="toaster">
    <NuxtLayout name="single-column">
      <article
        ref="article"
        class="space-y-6"
      >
        <header>
          <UIcon
            :name="notFound ? 'i-lucide-search-x' : 'i-lucide-triangle-alert'"
            class="mb-4 size-8 text-primary"
          />
          <h1 class="text-3xl font-bold">
            {{ title }}
          </h1>
          <p class="mt-2 text-lg text-muted font-medium">
            {{ description }}
            <template v-if="!notFound">
              Réessayez, et si le problème persiste,
              <a
                :href="contactHref"
                class="link"
              >écrivez-nous</a>.
            </template>
          </p>
        </header>
      </article>
    </NuxtLayout>
  </UApp>
</template>
