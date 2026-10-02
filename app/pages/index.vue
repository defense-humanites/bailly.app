<script setup lang="ts">
  const searchFocus = useSearchFocus();

  /**
   * The edition's popover: opened by a click or a tap, and by hovering it with
   * a mouse (closed shortly after leaving it, so that the pointer can reach
   * the popover's link).
   */
  const editionOpen = ref(false);
  let closing: ReturnType<typeof setTimeout> | undefined;
  let hovered = false;

  function hover(event: PointerEvent, open: boolean): void {
    if (event.pointerType !== "mouse") return;
    clearTimeout(closing);
    if (open) {
      hovered = !editionOpen.value || hovered;
      editionOpen.value = true;
    } else {
      closing = setTimeout(() => (editionOpen.value = false), 200);
    }
  }

  /**
   * Opened by hovering, the popover leaves the focus where it is; opened by a
   * click, a tap or the keyboard, it moves it to its link.
   */
  function onOpenAutoFocus(event: Event): void {
    if (hovered) event.preventDefault();
  }

  watch(editionOpen, (open) => {
    if (!open) hovered = false;
  });
</script>

<template>
  <div class="mx-auto grid max-w-(--content-max-width) items-center gap-10 px-4 py-8 md:px-6 md:py-12 lg:min-h-[calc(100dvh-(var(--spacing)*14))] lg:grid-cols-2 lg:gap-12 lg:py-10">
    <section class="@container flex flex-col items-start gap-5">
      <!--
        The title on two lines from `lg`, its size following the column's
        width (`cqi`), so that the longest line, with the popover's button,
        fits in the widest reading font (GFS Artemisia: 17.8 times the font
        size); balanced below. The heading is named after its text only, not
        the button (`aria-labelledby`), which stays glued to « Bailly ».
      -->
      <h1
        aria-labelledby="titre-accueil"
        class="font-serif text-[1.75rem]/[1.25] font-bold text-balance md:text-4xl/[1.25] lg:text-[length:min(2.25rem,5.6cqi)]"
      >
        <span id="titre-accueil">Consultez le dictionnaire <br class="max-lg:hidden">grec–français d'Anatole&nbsp;Bailly</span><span class="whitespace-nowrap">&nbsp;<UPopover
          v-model:open="editionOpen"
          :content="{ side: 'top', sideOffset: 6, onOpenAutoFocus }"
          arrow
        >
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-circle-help"
            aria-label="L'édition du texte"
            class="size-[0.7em] rounded-full p-0 align-[-0.05em] text-[1em] text-dimmed hover:text-default"
            :ui="{ leadingIcon: 'size-full' }"
            @pointerenter="hover($event, true)"
            @pointerleave="hover($event, false)"
          />
          <template #content>
            <p
              class="max-w-72 p-3 font-sans text-sm font-normal text-pretty"
              @pointerenter="hover($event, true)"
              @pointerleave="hover($event, false)"
            >
              Le texte est celui de l'édition numérique de Gérard Gréco et de son équipe, que ses
              auteurs ont intitulée <em>Bailly 2020 Hugo&nbsp;Chávez</em>.
              <NuxtLink
                :to="{ path: '/à-propos', hash: '#origine' }"
                class="underline decoration-dotted underline-offset-4 hover:text-primary"
              >En savoir plus</NuxtLink>
            </p>
          </template>
        </UPopover></span>
      </h1>
      <p class="text-lg text-pretty text-muted">
        Une application libre et gratuite, pensée pour la lecture et la recherche.
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
