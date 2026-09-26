<!--
  A single column of at most `--reading-width`: centered below `md`, with a
  minimal side margin aligned with the search bar (both clear the safe areas,
  e.g. a landscape notch, the same way, cf. `AppNavHorizontal`). From `md`, on
  the header's grid (cf. `grid-cols-header`): the column starts under the
  search bar, and extends under the menu while the bar is narrower than
  `--reading-width`; beyond, both have this width, the column under the bar.
-->
<template>
  <div>
    <AppHeader />
    <main class="px-safe-4 pt-6 pb-safe-6 md:mt-20 md:px-safe-6 lg:pt-12 lg:pb-safe-12">
      <div class="mx-auto max-w-(--reading-width) md:grid md:max-w-(--header-max-width) md:grid-cols-header md:px-(--header-inset)">
        <div class="min-w-0 md:col-start-2 md:col-end-4 md:max-w-(--reading-width) xl:col-end-3">
          <slot />
        </div>
      </div>
    </main>
  </div>
</template>
