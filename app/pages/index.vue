<template>
  <div class="mx-auto items-center px-6 sm:px-12 lg:flex lg:h-full lg:max-w-screen-lg lg:px-24 lg:pb-3 xl:px-0">
    <section class="my-6 sm:my-12 flex flex-col gap-2 lg:gap-4 xl:gap-6">
      <a
        target="_blank"
        href="https://www.paypal.com/donate/?hosted_button_id=HFBZZVKRBE7HY&locale.x=fr"
      >
        <UBadge
          class="rounded-full bg-rose-100 dark:bg-rose-600 hover:bg-rose-200 dark:hover:bg-rose-500 text-rose-700 dark:text-rose-100 transition-colors"
          size="lg"
          variant="soft"
        >❤️ Nous soutenir</UBadge>
      </a>
      <h1 class="font-serif text-3xl font-bold xl:text-4xl">
        Consultez le dictionnaire<br>grec&ndash;français d'Anatole&nbsp;Bailly
      </h1>
      <p class="font-serif text-xl xl:text-2xl">
        Dans l'édition Bailly 2020 Hugo&nbsp;Chávez (<a href="/à-propos">à&nbsp;propos</a>).
      </p>
    </section>

    <aside
      class="flex-1 mx-6 pb-6 sm:pb-12 lg:pb-0"
      data-nosnippet
    >
      <ClientOnly>
        <template #fallback>
          <UCard class="h-96">
            <div class="grid gap-6">
              <USkeleton class="h-3 w-full" />
              <USkeleton class="h-3 w-11/12" />
              <USkeleton class="h-3 w-full" />
              <USkeleton class="h-3 w-11/12" />
              <USkeleton class="h-3 w-full" />
              <USkeleton class="h-3 w-11/12" />
              <USkeleton class="h-3 w-full" />
              <USkeleton class="h-3 w-11/12" />
              <USkeleton class="h-3 w-full" />
              <USkeleton class="h-3 w-6/12" />
            </div>
          </UCard>
        </template>

        <RandomEntryCard />
      </ClientOnly>
    </aside>
  </div>
</template>
