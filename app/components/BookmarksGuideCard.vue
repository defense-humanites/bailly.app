<script setup lang="ts">
  defineProps<{
    /** The card's title. */
    title: string;
    /** Its icon, before the title. */
    icon: string;
    /** The title's id (the card's name). */
    titleId: string;
    /**
     * A tint telling the card's subject: the synchronization's Aegean blue
     * (`secondary`), as its card on the preferences page (cf. `SyncCard`).
     */
    tint?: "secondary";
  }>();

  /**
   * The marble background (`--guide-bg`); tinted, a glow of the color in
   * the bottom left corner over it, and a border of the color.
   */
  const BACKGROUND = "[--guide-bg:color-mix(in_srgb,var(--color-marble-200)_30%,var(--app-page-bg))] dark:[--guide-bg:color-mix(in_srgb,var(--color-marble-900)_50%,var(--app-page-bg))] bg-(--guide-bg)";
  const NEUTRAL = "border-marble-300/40 dark:border-marble-800/60";
  const SECONDARY = "[--guide-tint:color-mix(in_oklab,var(--guide-bg)_88%,var(--ui-color-secondary-500))] dark:[--guide-tint:color-mix(in_oklab,var(--guide-bg)_80%,var(--ui-color-secondary-500))] bg-[radial-gradient(ellipse_at_bottom_left,var(--guide-bg)_70%,var(--guide-tint))] border-secondary/20";

  defineEmits<{
    /** The user dismissed the card. */
    dismiss: [];
  }>();
</script>

<!--
  A card of the bookmarks page's guide (cf. `signets.vue`), before the
  favorites, laid out as theirs (sizes, margins), told from them by its marble
  (neutral), its text in a medium weight (its icon and its bold title as the
  cards'). Dismissed by its button.
-->
<template>
  <UCard
    role="group"
    :aria-labelledby="titleId"
    variant="bookmarkGroup"
    :ui="{
      root: `${BACKGROUND} ${tint === 'secondary' ? SECONDARY : NEUTRAL}`,
      header: 'flex !px-3 pb-0',
      body: '!p-3',
    }"
  >
    <template #header>
      <div class="flex min-h-8 w-full items-start gap-3 text-marble-700 dark:text-marble-400">
        <div class="flex min-w-0 grow items-start">
          <UIcon
            :name="icon"
            class="mx-2 mt-1 size-6 shrink-0"
          />
          <h2
            :id="titleId"
            class="ml-2 min-w-0 grow py-0.5 pe-2 text-xl/7 font-bold md:py-0 md:text-2xl/8"
          >
            {{ title }}
          </h2>
        </div>
        <UTooltip text="Masquer">
          <UButton
            icon="i-lucide-x"
            size="sm"
            variant="subtle"
            color="neutral"
            :aria-label="`Masquer « ${title} »`"
            :ui="{ base: 'bg-default/50 hover:bg-default/90 active:bg-default/75 ring-marble-300/50 text-marble-700/75 hover:text-marble-700 dark:ring-marble-800/60 dark:text-marble-400/75 dark:hover:text-marble-400' }"
            @click="$emit('dismiss')"
          />
        </UTooltip>
      </div>
    </template>
    <div class="ms-12 font-medium text-marble-700 dark:text-marble-400">
      <slot />
    </div>
  </UCard>
</template>
