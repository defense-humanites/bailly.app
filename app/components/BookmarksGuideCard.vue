<script setup lang="ts">
  defineProps<{
    /** The card's title. */
    title: string;
    /** Its icon, before the title. */
    icon: string;
    /** The title's id (the card's name). */
    titleId: string;
    /**
     * A tint telling the card's subject: the application's terracotta
     * (`primary`, its signature: the bookmarks, among its most valuable
     * features), or the synchronization's Aegean blue (`secondary`, as its
     * card on the preferences page, cf. `SyncCard`).
     */
    tint?: "primary" | "secondary";
  }>();

  /**
   * The surface, as the news' asides (the survey's, the contact's): tinted,
   * a pale background and a border of the color; neutral, the bookmarks'
   * cards' (the variant's).
   */
  const SURFACE = {
    neutral: "",
    primary: "bg-primary/5 border-primary/15",
    secondary: "bg-secondary/5 border-secondary/20",
  };
  /**
   * The close button's ring and cross: in the card's color, as the buttons
   * of the bookmarks' cards in their tag's (cf. `BookmarkGroup`).
   */
  const CLOSE = {
    neutral: "ring-marble-300/50 dark:ring-marble-800/60 text-marble-700/75 hover:text-marble-700 dark:text-marble-400/75 dark:hover:text-marble-400",
    primary: "ring-primary/50 dark:ring-primary/40 text-primary/75 hover:text-primary",
    secondary: "ring-secondary/50 dark:ring-secondary/40 text-secondary/75 hover:text-secondary",
  };
  /**
   * The icon and the title in the card's color (the accent, as readable as
   * the text: `--ui-primary`, `--ui-secondary`), as the bookmarks' cards'
   * in their tag's (cf. `BookmarkGroup`).
   */
  const TITLE = {
    neutral: "",
    primary: "text-primary",
    secondary: "text-secondary",
  };

  defineEmits<{
    /** The user dismissed the card. */
    dismiss: [];
  }>();
</script>

<!--
  A card of the bookmarks page's guide (cf. `signets.vue`), before the
  favorites, laid out as theirs (sizes, margins), told from them by its marble
  (neutral), its text in a normal weight (its icon and its bold title as the
  cards'). Dismissed by its button.
-->
<template>
  <UCard
    role="group"
    :aria-labelledby="titleId"
    variant="bookmarkGroup"
    :ui="{
      root: SURFACE[tint ?? 'neutral'],
      header: 'flex !px-3 pb-0',
      body: '!p-3',
    }"
  >
    <template #header>
      <div class="flex min-h-8 w-full items-start gap-3 text-marble-700 dark:text-marble-400">
        <div
          class="flex min-w-0 grow items-start"
          :class="TITLE[tint ?? 'neutral']"
        >
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
            :ui="{ base: `bg-default/50 hover:bg-default/90 active:bg-default/75 ${CLOSE[tint ?? 'neutral']}` }"
            @click="$emit('dismiss')"
          />
        </UTooltip>
      </div>
    </template>
    <div class="ms-3 sm:ms-12 text-marble-700 dark:text-marble-400">
      <slot />
    </div>
  </UCard>
</template>
