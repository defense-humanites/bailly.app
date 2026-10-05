<script setup lang="ts">
  import { FEATURES } from "#shared/utils/features";

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
      On mobile, a grid: the title first and the transliteration offer right
      under it (the news and the donation are the header's icons, cf.
      `AppNavHorizontal`).
      On a tablet (`md`), the offer floats on the right, the donation's
      button, the title and the text around it. A column from `lg`. The
      order is CSS's only, the markup's being the same everywhere.
    -->
    <section class="@container grid grid-cols-1 justify-items-start gap-5 md:block lg:flex lg:flex-col lg:items-start">
      <!--
        For the readers who don't read Greek: the transliteration preference,
        whose effect shows at once on the opened entry (and is saved). First
        in the markup, to float on the right on a tablet (the title and the
        text around it); last in the column from `lg`. The whole block is
        the switch's label: a click anywhere toggles it (the focus stays on
        the switch, its name and description given by the texts' ids).
      -->
      <label class="order-2 flex w-full cursor-pointer items-start gap-3 rounded-lg bg-default/60 px-4 py-3 ring-1 ring-default transition-colors pointer-fine:hover:bg-default md:order-none md:float-right md:mb-4 md:ms-8 md:w-72 lg:float-none lg:order-last lg:m-0 lg:mt-3 lg:w-auto">
        <USwitch
          v-model="transliterateGreek"
          aria-labelledby="translitteration"
          aria-describedby="translitteration-help"
          class="mt-0.5"
        />
        <span class="block text-sm">
          <span
            id="translitteration"
            class="block font-medium"
          >
            Vous ne lisez pas le grec ?
          </span>
          <span
            id="translitteration-help"
            class="block text-muted"
          >
            Affichez-le en caractères latins.
          </span>
        </span>
      </label>
      <!--
        The news and the donation (on mobile, the header's icons), once
        offered (cf. `FEATURES`).
      -->
      <div
        v-if="FEATURES.news || FEATURES.donations"
        class="flex gap-2 max-md:hidden md:mb-5 lg:mb-0"
      >
        <UButton
          v-if="FEATURES.news"
          :to="encodeURI('/nouveautés')"
          size="sm"
          color="secondary"
          variant="soft"
          icon="i-lucide-party-popper"
          label="Nouveautés"
        />
        <UButton
          v-if="FEATURES.donations"
          to="/soutenir"
          size="sm"
          color="primary"
          variant="soft"
          icon="i-lucide-heart"
          label="Nous soutenir"
        />
      </div>
      <!--
        The title on two lines from `lg`, its size following the column's
        width (`cqi`), so that the longest line, with the popover's button,
        fits in the widest reading font (GFS Artemisia: 17.8 times the font
        size); balanced below. The heading is named after its text only, not
        the button (`aria-labelledby`), which stays glued to « Bailly ».
      -->
      <h1
        aria-labelledby="titre-accueil"
        class="order-1 font-serif text-2xl/[1.25] font-bold text-balance md:order-none md:mb-5 md:text-3xl/[1.25] lg:mb-0 lg:text-[length:min(2.25rem,5.6cqi)]"
      >
        <span id="titre-accueil">Consultez le dictionnaire <br class="max-lg:hidden">grec-français d'Anatole&nbsp;Bailly</span><span class="whitespace-nowrap">&nbsp;<UPopover
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
                :to="{ path: encodeURI('/à-propos'), hash: '#origine' }"
                class="underline decoration-dotted underline-offset-4 hover:text-primary"
              >En savoir plus</NuxtLink>
            </p>
          </template>
        </UPopover></span>
      </h1>
      <p class="order-3 text-lg text-pretty text-muted md:order-none">
        Une application libre et gratuite, pensée pour la lecture et la recherche (<NuxtLink
          :to="encodeURI('/à-propos')"
          class="underline decoration-dotted underline-offset-4 hover:text-primary"
        >en savoir plus</NuxtLink>).
      </p>
    </section>

    <RandomOpening data-nosnippet />
  </div>
</template>
