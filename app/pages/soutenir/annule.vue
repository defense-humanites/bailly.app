<script setup lang="ts">
  definePageMeta({
    layout: "single-column",
  });

  // PayPal's return page when a donation is cancelled.
  useSeoMeta({
    title: "Don annulé",
    robots: "noindex",
  });
</script>

<template>
  <article class="space-y-6">
    <h1 class="text-3xl leading-normal font-bold">
      Don annulé
    </h1>
    <p class="font-serif text-sm/7">
      Votre don n'a pas été effectué : aucun montant n'a été prélevé.
    </p>
    <p class="font-serif text-sm/7">
      Vous pouvez aussi nous aider autrement : en nous signalant une erreur dans
      une entrée, ou en parlant de Bailly.app autour de vous.
    </p>
    <div class="flex flex-wrap gap-3">
      <UButton
        to="/soutenir"
        label="Réessayer"
        icon="i-lucide-heart"
      />
      <ResumeReading />
    </div>
  </article>
</template>
