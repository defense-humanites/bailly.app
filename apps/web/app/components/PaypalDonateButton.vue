<script setup lang="ts">
  import type { DonationResult } from "~/utils/donation";

  type DonateSdk = {
    Donation: {
      Button: (options: {
        env: string;
        hosted_button_id: string;
        image: { src: string; alt: string; title: string };
        onComplete: (params: DonationResult) => void;
      }) => { render: (selector: string) => void };
    };
  };

  const emit = defineEmits<{
    /** The donation is done (the result comes from PayPal's script). */
    complete: [result: DonationResult];
  }>();

  const SDK_URL = "https://www.paypalobjects.com/donate/sdk/donate-sdk.js";

  const { paypalDonateButtonId, paypalEnv } = useRuntimeConfig().public;

  /**
   * The donation page on PayPal's site: without JavaScript, or if the script
   * can't load (e.g. blocked by an extension).
   */
  const hostedUrl = `https://www.paypal.com/donate/?hosted_button_id=${paypalDonateButtonId}&locale.x=fr_FR`;

  const container = useTemplateRef<HTMLElement>("container");
  const state = ref<"loading" | "ready" | "failed">("loading");

  /**
   * Loads PayPal's script once (on this page only: it isn't part of the
   * application's bundle, nor loaded elsewhere).
   */
  let sdk: Promise<DonateSdk> | undefined;
  const loadSdk = (): Promise<DonateSdk> => {
    const loaded = (window as unknown as { PayPal?: DonateSdk }).PayPal;
    if (loaded) return Promise.resolve(loaded);
    sdk ??= new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SDK_URL;
      script.setAttribute("charset", "UTF-8"); // As in PayPal's integration code.
      script.async = true;
      script.onload = () => {
        const paypal = (window as unknown as { PayPal?: DonateSdk }).PayPal;
        if (paypal) resolve(paypal);
        else reject(new Error("PayPal's Donate SDK didn't load."));
      };
      script.onerror = () => {
        reject(new Error("PayPal's Donate SDK didn't load."));
      };
      document.head.append(script);
    });
    return sdk;
  };

  onMounted(async () => {
    // The SDK renders into an element given by selector: an id set on the
    // client only (an id from `useId` may differ between server and client).
    container.value!.id = `paypal-donate-${Math.random().toString(36).slice(2)}`;
    try {
      const paypal = await loadSdk();
      paypal.Donation.Button({
        env: paypalEnv,
        hosted_button_id: paypalDonateButtonId,
        image: {
          src: new URL("/images/donate-button.svg", window.location.origin).href,
          alt: "Faire un don avec PayPal",
          title: "Faire un don avec PayPal",
        },
        onComplete: (params) => {
          emit("complete", params);
        },
      }).render(`#${container.value!.id}`);
      state.value = "ready";
    } catch {
      state.value = "failed";
    }
  });
</script>

<!--
  PayPal's donation button (Donate SDK): the donation form opens in a
  PayPal window over the page, and the page is told once it is done. Its
  place is reserved while the script loads (no layout shift); if the script
  can't load, or without JavaScript, a link to PayPal's donation page.
-->
<template>
  <div class="flex min-h-12 items-center">
    <div
      v-show="state === 'ready'"
      ref="container"
      class="[&_img]:h-12 [&_img]:w-auto"
    />
    <USkeleton
      v-if="state === 'loading'"
      class="h-12 w-54 rounded-full"
    />
    <UButton
      v-else-if="state === 'failed'"
      :to="hostedUrl"
      target="_blank"
      icon="i-lucide-heart"
      trailing-icon="i-lucide-external-link"
      label="Faire un don sur le site de PayPal"
      size="xl"
    />
    <noscript>
      <a :href="hostedUrl">Faire un don sur le site de PayPal</a>
    </noscript>
  </div>
</template>
