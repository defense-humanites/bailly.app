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
      :class="[props.noMargin ? 'h-dvh' : 'md:h-[calc(100dvh-(var(--spacing)*14))]']"
    >
      <slot />
    </main>
  </div>
</template>
