<script setup lang="ts">
  import { type DonationResult, donationThanks } from "~/utils/donation";

  definePageMeta({
    layout: "single-column",
  });

  useSeoMeta({
    title: "Nous soutenir",
    description: "Soutenez Bailly.app, le dictionnaire grec-français en ligne, gratuit et sans publicité.",
  });

  /**
   * The thanks, once PayPal's window says the donation is done.
   */
  const thanks = ref<string>();

  const onComplete = (result: DonationResult): void => {
    thanks.value = donationThanks(result);
  };
</script>

<!--
  Why give (a first draft, to be rewritten by Antoine), then PayPal's
  donation button: the form opens in a PayPal window over the page, and the
  thanks show here once the donation is done. PayPal's return pages
  (`/soutenir/merci`, `/soutenir/annule`) are a fallback.
-->
<template>
  <article class="space-y-6">
    <h1 class="text-3xl leading-normal font-bold">
      Nous soutenir
    </h1>

    <UCard :ui="{ body: 'space-y-4 font-serif text-sm/7' }">
      <p>
        Bailly.app est gratuit, sans publicité, et le restera. L'application est
        développée bénévolement ; ses frais, eux, sont bien réels.
      </p>
      <p>Vos dons, reçus par l'association qui porte le projet, financent :</p>
      <ul class="list-disc space-y-1 ps-6">
        <li>l'hébergement de l'application et de son interface de programmation (serveurs, nom de domaine) ;</li>
        <li>le travail sur les données du dictionnaire : intégration des révisions, corrections, analyse morphologique ;</li>
        <li>les nouvelles fonctionnalités : synchronisation des signets, outils de lecture…</li>
      </ul>
      <p>
        Le don se fait par PayPal, avec un compte PayPal ou une carte bancaire,
        dans une fenêtre sécurisée : vos coordonnées bancaires ne nous sont
        jamais communiquées (voir <NuxtLink :to="encodeURI('/confidentialité')">vos données</NuxtLink>).
      </p>
    </UCard>

    <div
      aria-live="polite"
      class="space-y-4"
    >
      <template v-if="thanks">
        <UAlert
          color="success"
          variant="subtle"
          icon="i-lucide-heart"
          :title="thanks"
          description="Votre soutien fait vivre le Bailly en ligne."
        />
        <ResumeReading />
      </template>
      <PaypalDonateButton
        v-else
        @complete="onComplete"
      />
    </div>
  </article>
</template>
