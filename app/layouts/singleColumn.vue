<template>
  <div>
    <AppHeader />
    <main class="md:mt-20 py-6 lg:py-12 xl:grid xl:grid-cols-12">
      <div class="w-full max-w-screen-sm xl:col-span-6 xl:col-start-3">
        <slot />
      </div>
    </main>
  </div>
</template>
