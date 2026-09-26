<!--
  A single column of at most `--reading-width`: centered below `lg`, with a
  minimal side margin aligned with the search bar on mobile (both clear the
  safe areas, e.g. a landscape notch, the same way, cf. `AppNavHorizontal`).
  From `lg`, on the header's grid (cf. `grid-cols-header`), where the search
  bar has room for `--reading-width`: the column lies exactly under the bar.
-->
<template>
  <div>
    <AppHeader />
    <main class="px-safe-4 pt-6 pb-safe-6 md:px-safe-6 lg:pt-12 lg:pb-safe-12">
      <div class="mx-auto max-w-(--reading-width) lg:grid lg:max-w-(--header-max-width) lg:grid-cols-header">
        <div class="min-w-0 lg:col-start-2 lg:col-end-3 lg:max-w-(--reading-width)">
          <slot />
        </div>
      </div>
    </main>
  </div>
</template>
