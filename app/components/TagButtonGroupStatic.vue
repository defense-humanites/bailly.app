<script setup lang="ts">
  /**
   * An entry's toolbar as the server renders it, until the page is
   * interactive (cf. `EntryCard`): the markup and classes of
   * `TagButtonGroup` (Nuxt UI's field group, popover and buttons, as they
   * render without bookmarks, which only the browser knows), written out
   * without their components, a large part of an entry page's server render
   * (cf. `audit-rendu-serveur.md`). Keep them in step with `TagButtonGroup`
   * (checked by `test/e2e/entry.spec.ts`). Its buttons do nothing meanwhile.
   */
  const BUTTON = "font-medium inline-flex items-center disabled:cursor-not-allowed aria-disabled:cursor-not-allowed disabled:opacity-75 aria-disabled:opacity-75 transition-colors rounded-full text-sm gap-1.5 not-only:first:rounded-e-none not-only:last:rounded-s-none not-last:not-first:rounded-none focus-visible:z-[1] text-default hover:bg-(--app-card-hover) active:bg-(--app-card-active) outline-inverted/25 focus-visible:outline-3 p-1.5";
</script>

<template>
  <div
    data-orientation="horizontal"
    class="inline-flex -space-x-px border border-default rounded-lg [&>button]:rounded-lg shadow-xs"
  >
    <button
      type="button"
      data-slot="base"
      aria-label="Toutes les étiquettes"
      :class="BUTTON"
    >
      <UIcon
        name="i-lucide-tags"
        data-slot="leadingIcon"
        class="shrink-0 size-5"
      />
    </button>
    <button
      type="button"
      data-slot="base"
      aria-label="Favori"
      aria-pressed="false"
      :class="[BUTTON, 'border-l border-default hover:text-favorite']"
    >
      <UIcon
        name="i-lucide-star"
        data-slot="leadingIcon"
        class="shrink-0 size-5"
      />
    </button>
  </div>
</template>
