<script setup lang="ts">
  const searchFocus = useSearchFocus();
</script>

<template>
  <div class="mx-auto grid max-w-(--content-max-width) items-center gap-10 px-4 py-8 md:px-6 md:py-12 lg:min-h-[calc(100dvh-(var(--spacing)*14))] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-10">
    <section class="flex flex-col items-start gap-5">
      <h1 class="font-serif text-[1.75rem]/[1.25] font-bold text-balance md:text-4xl/[1.25]">
        Le dictionnaire grec-français d'Anatole&nbsp;Bailly
      </h1>
      <p class="text-lg text-pretty text-muted">
        Dans l'édition révisée <em>Bailly 2020 Hugo&nbsp;Chávez</em>, libre et gratuite, pensée pour
        la lecture et la recherche.
        <NuxtLink
          to="/à-propos"
          class="underline decoration-dotted underline-offset-4 hover:text-primary"
        >D'où vient le texte&nbsp;?</NuxtLink>
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <UButton
          size="lg"
          icon="i-lucide-search"
          label="Chercher un mot"
          @click="searchFocus.focus()"
        />
        <UButton
          to="/soutenir"
          size="lg"
          color="neutral"
          variant="ghost"
          icon="i-lucide-heart"
          label="Nous soutenir"
        />
      </div>
    </section>

    <RandomOpening data-nosnippet />
  </div>
</template>
