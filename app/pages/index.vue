<script setup lang="ts">
  const searchFocus = useSearchFocus();

  /**
   * The search is the page's main action: its field gets the focus on
   * opening, except with a coarse pointer (a touch screen), where it would
   * bring up the virtual keyboard, and when it holds a search (e.g. back from
   * an entry), whose results would open again over the page.
   */
  onMounted(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) searchFocus.focus({ ifEmpty: true });
  });
  const { preference } = usePreferences();
  const transliterateGreek = preference("transliterateGreek");

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
    <!--
      Below `lg`, a grid: on mobile, the title first and the transliteration
      offer right under it, the donation's button last; on a tablet (`md`),
      the offer at the top right, beside the title. A column from `lg`. The
      order is CSS's only, the markup's being the same everywhere.
    -->
    <section class="@container grid grid-cols-1 justify-items-start gap-5 md:grid-cols-[minmax(0,1fr)_18rem] md:gap-x-10 lg:flex lg:flex-col lg:items-start">
      <UButton
        class="order-4 md:order-none md:col-start-1"
        to="/soutenir"
        size="sm"
        color="primary"
        variant="soft"
        icon="i-lucide-heart"
        label="Nous soutenir"
      />
      <!--
        The title on two lines from `lg`, its size following the column's
        width (`cqi`), so that the longest line, with the popover's button,
        fits in the widest reading font (GFS Artemisia: 17.8 times the font
        size); balanced below. The heading is named after its text only, not
        the button (`aria-labelledby`), which stays glued to « Bailly ».
      -->
      <h1
        aria-labelledby="titre-accueil"
        class="order-1 font-serif text-2xl/[1.25] font-bold text-balance md:order-none md:col-start-1 md:text-3xl/[1.25] lg:text-[length:min(2.25rem,5.6cqi)]"
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
      <p class="order-3 text-lg text-pretty text-muted md:order-none md:col-start-1">
        Une application libre et gratuite, pensée pour la lecture et la recherche (<NuxtLink
          :to="encodeURI('/à-propos')"
          class="underline decoration-dotted underline-offset-4 hover:text-primary"
        >en savoir plus</NuxtLink>).
      </p>
      <!--
        For the readers who don't read Greek: the transliteration preference,
        whose effect shows at once on the opened entry (and is saved).
      -->
      <div class="order-2 flex w-full items-start gap-3 rounded-lg bg-primary/8 px-4 py-3 ring-1 ring-primary/25 md:order-none md:col-start-2 md:row-span-3 md:row-start-1 md:self-start lg:mt-3 lg:w-auto lg:bg-default/60 lg:ring-default">
        <USwitch
          v-model="transliterateGreek"
          aria-labelledby="translitteration"
          aria-describedby="translitteration-help"
          class="mt-0.5"
        />
        <div class="text-sm">
          <p
            id="translitteration"
            class="font-medium"
          >
            Vous ne lisez pas le grec ?
          </p>
          <p
            id="translitteration-help"
            class="text-muted"
          >
            Affichez-le en caractères latins.
          </p>
        </div>
      </div>
    </section>

    <RandomOpening data-nosnippet />
  </div>
</template>
