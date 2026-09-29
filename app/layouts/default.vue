<!--
  The main content is at least as high as the window under the header (from
  `md`), and grows with the page: a fixed height would bound the layout's box,
  and with it the sticky header, which would then scroll away with a long
  page (e.g. the about page).
-->
<template>
  <div>
    <AppHeader />
    <main class="px-safe pb-safe md:min-h-[calc(100dvh-(var(--spacing)*14))]">
      <slot />
    </main>
  </div>
</template>
