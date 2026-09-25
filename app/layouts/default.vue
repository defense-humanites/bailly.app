<script setup lang="ts">
  const props = defineProps<{
    noMargin?: boolean;
  }>();
</script>

<template>
  <div>
    <AppHeader />
    <main
      class="px-safe pb-safe"
      :class="[props.noMargin ? 'h-dvh' : 'md:h-[calc(100dvh-(var(--spacing)*20))] md:mt-20']"
    >
      <slot />
    </main>
  </div>
</template>
