<script setup lang="ts">
  definePageMeta({
    layout: "single-column",
  });

  // PayPal's return page after a donation (a fallback to the thanks shown on
  // `/soutenir`): nothing is read from the URL (anyone could forge it).
  useSeoMeta({
    title: "Merci pour votre don",
    robots: "noindex",
  });
</script>

<template>
  <article class="space-y-6">
    <h1 class="text-3xl leading-normal font-bold">
      Merci pour votre don !
    </h1>
    <p class="font-serif text-lg">
      Votre soutien fait vivre le Bailly en ligne. PayPal vous a envoyé un reçu
      par courriel.
    </p>
    <ResumeReading />
  </article>
</template>
