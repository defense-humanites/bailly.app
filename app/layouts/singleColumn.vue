<!--
  A single column of at most `screen-sm`: centered below `md`, with a minimal
  side margin aligned with the search bar. From `md`, on the header's grid
  (cf. `grid-cols-header`): the column starts under the search bar, and may
  extend under the menu when the bar is narrower; from `xl`, it lies exactly
  under the bar.
-->
<template>
  <div>
    <AppHeader />
    <main class="px-4 py-6 md:mt-20 md:px-6 lg:py-12">
      <div class="mx-auto max-w-screen-sm md:grid md:max-w-(--header-max-width) md:grid-cols-header md:px-(--header-inset)">
        <div class="min-w-0 md:col-start-2 md:col-end-4 md:max-w-screen-sm xl:col-end-3">
          <slot />
        </div>
      </div>
    </main>
  </div>
</template>
