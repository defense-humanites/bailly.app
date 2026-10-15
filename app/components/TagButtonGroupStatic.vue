<script setup lang="ts">
  /**
   * An entry's toolbar as the server renders it, until the page is
   * interactive (cf. `EntryCard`): the markup and classes of
   * `TagButtonGroup` (Nuxt UI's popover and buttons, side by side, as they
   * render without bookmarks, which only the browser knows), written out
   * without their components, a large part of an entry page's server render
   * (cf. `audit-rendu-serveur.md`). Keep them in step with `TagButtonGroup`
   * (checked by `test/e2e/entry.spec.ts`). Its buttons do nothing meanwhile.
   */
  const BUTTON = "font-medium inline-flex items-center disabled:cursor-not-allowed aria-disabled:cursor-not-allowed disabled:opacity-75 aria-disabled:opacity-75 transition-colors rounded-full text-sm gap-1.5 text-default outline-inverted/25 focus-visible:outline-3 hover:disabled:bg-transparent dark:hover:disabled:bg-transparent hover:aria-disabled:bg-transparent dark:hover:aria-disabled:bg-transparent p-1.5 hover:bg-(--app-button-hover) active:bg-(--app-button-active)";
</script>

<template>
  <div
    data-toolbar-group
    class="flex min-w-0 items-center rounded-lg border border-default bg-default shadow-xs [&>*+*]:border-s [&>*+*]:border-default [&>button]:rounded-none [&>:first-child]:rounded-s-md [&>:last-child]:rounded-e-md"
  >
    <button
      type="button"
      data-slot="base"
      aria-label="Toutes les étiquettes"
      :class="[BUTTON, 'data-[state=open]:bg-(--app-button-active)']"
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
      :class="[BUTTON, 'hover:text-favorite']"
    >
      <UIcon
        name="i-lucide-star"
        data-slot="leadingIcon"
        class="shrink-0 size-5"
      />
    </button>
  </div>
</template>
