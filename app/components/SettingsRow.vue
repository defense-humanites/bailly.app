<script setup lang="ts">
  defineProps<{
    /** The setting's name. */
    label: string;
    /** A short help, one line at most. */
    description?: string;
    /** Whether the setting isn't available (yet). */
    disabled?: boolean;
  }>();
</script>

<!--
  A setting: its name (and a short help) on the left, its control on the
  right; the control goes under them in a narrow card.
-->
<template>
  <div
    class="flex flex-col gap-2 py-2.5 @md:flex-row @md:items-center @md:justify-between @md:gap-6"
    :class="{ 'opacity-75': disabled }"
  >
    <div class="min-w-0">
      <p
        class="font-medium"
        aria-hidden="true"
      >
        {{ label }}
      </p>
      <p
        v-if="description"
        class="text-sm text-muted"
      >
        {{ description }}
      </p>
    </div>
    <div class="shrink-0">
      <slot />
    </div>
  </div>
</template>
