<script setup lang="ts">
  const props = defineProps<{
    /** What a click copies, said by its title and its button (e.g. « Copier la clé »). */
    label: string;
    /** Its button's name once copied, for a moment (e.g. « Clé copiée »). */
    copiedLabel: string;
    /** Copies; whether it could (its message, a toast, the caller's). */
    copy: () => Promise<boolean>;
  }>();

  /** Just copied: the button's icon a check, for a moment. */
  const copied = ref(false);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  onBeforeUnmount(() => {
    clearTimeout(copiedTimer);
  });

  const onCopy = async (): Promise<void> => {
    if (!(await props.copy())) return;
    copied.value = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copied.value = false;
    }, 2_000);
  };
</script>

<!--
  A text to copy (the synchronization's key, a citation's reference): in a
  box which a click copies, its button (for the keyboard) in its corner, its
  icon a check for a moment once copied. Hovered, the box darkens, its button
  too (on the box's color, without a shade of its own).
-->
<template>
  <div class="group relative">
    <div
      class="cursor-pointer rounded-md bg-elevated p-3 pe-12 transition-colors group-hover:bg-accented/60"
      :title="label"
      @click="onCopy"
    >
      <slot />
    </div>
    <UButton
      :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
      :aria-label="copied ? copiedLabel : label"
      color="neutral"
      variant="ghost"
      size="sm"
      class="absolute end-1.5 top-1.5 hover:bg-transparent active:bg-transparent"
      @click="onCopy"
    />
  </div>
</template>
