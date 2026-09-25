<!--
  A single column of at most `screen-sm`, centered, with a minimal side margin
  aligned with the header (its search bar on mobile, its floating row from
  `md`). From `xl`, the column is placed on a 12-column grid.
-->
<template>
  <div>
    <AppHeader />
    <main class="px-4 py-6 md:mt-20 md:px-6 lg:py-12 xl:grid xl:grid-cols-12">
      <div class="mx-auto w-full max-w-screen-sm xl:col-span-6 xl:col-start-3 xl:mx-0">
        <slot />
      </div>
    </main>
  </div>
</template>
