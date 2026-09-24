<script setup lang="ts">
  const props = defineProps<{
    noMargin?: boolean;
  }>();
</script>

<template>
  <AppHeader />
  <main class="pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
    :class="[props.noMargin ? 'h-dvh' : 'h-[calc(100dvh-(var(--spacing)*20))] mt-20']">
    <slot />
  </main>
</template>
