<script setup lang="ts">
  defineProps<{
    /** The setting's name. */
    label: string;
    /** A short help, one line at most. */
    description?: string;
    /** Whether the setting isn't available (yet). */
    disabled?: boolean;
    /** Whether the setting is synchronized with the other devices. */
    synced?: boolean;
    /**
     * The id of the control that the name and the help label (a switch): a
     * click on them toggles it, as on the switch.
     */
    control?: string;
  }>();
</script>

<!--
  A setting: its name (and a short help) on the left, its control on the
  right; the control goes under them in a narrow card. For a switch
  (`control`), the name and the help are its label.
-->
<template>
  <div
    class="flex flex-col gap-2 py-2.5 @md:flex-row @md:items-center @md:justify-between @md:gap-6"
    :class="{ 'opacity-75': disabled }"
  >
    <component
      :is="control ? 'label' : 'div'"
      :for="control"
      class="min-w-0"
      :class="{ 'cursor-pointer': control && !disabled }"
    >
      <p class="flex items-center gap-1.5 font-medium">
        <span aria-hidden="true">{{ label }}</span>
        <!--
          Synchronized: a small cloud (for screen readers, the control's name
          says it, cf. the preferences page).
        -->
        <UTooltip
          v-if="synced"
          text="Synchronisée avec vos autres appareils"
        >
          <span
            data-synced
            aria-hidden="true"
            class="flex"
          >
            <UIcon
              name="i-lucide-cloud"
              class="size-4 shrink-0 text-muted"
            />
          </span>
        </UTooltip>
      </p>
      <p
        v-if="description || $slots.description"
        class="text-sm text-muted"
      >
        <slot name="description">
          {{ description }}
        </slot>
      </p>
    </component>
    <div class="shrink-0">
      <slot />
    </div>
  </div>
</template>
