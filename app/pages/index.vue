<template>
  <div class="mx-auto items-center px-6 sm:px-12 lg:flex lg:min-h-[calc(100dvh-(var(--spacing)*14))] lg:max-w-screen-lg lg:px-24 lg:pb-3 xl:px-0">
    <section class="my-6 sm:my-12 flex flex-col gap-2 lg:gap-4 xl:gap-6">
      <NuxtLink to="/soutenir">
        <UBadge
          class="rounded-full bg-primary/10 hover:bg-primary/15 text-primary transition-colors"
          size="lg"
          variant="soft"
        >❤️ Nous soutenir</UBadge>
      </NuxtLink>
      <h1 class="font-serif text-2xl/9 font-bold xl:text-[1.75rem]/10">
        Consultez le dictionnaire<br>grec&ndash;français d'Anatole&nbsp;Bailly
      </h1>
      <p class="font-serif text-base/7 xl:text-lg/8">
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
