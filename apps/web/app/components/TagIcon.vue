<script setup lang="ts">
  /**
   * A tag's icon (a tag, or a pin for a pinned tag), with, for the active
   * tag, its mark (⊙, the active tag's sign, as the button that makes a tag
   * active) over the top right corner: three quarters as large, cut out of
   * the icon (`.active-mark-host`, a mask: whatever the background, a card's
   * tint or a highlighted row), a little lighter (75 %) to stand out from it.
   * Sized by its class, as is the mark (`--mark-size`, `--mark-top`,
   * `--mark-left`, in percents of the icon; by default 75 %, -30 %,
   * 58.75 %); « active » is for the caller to say to screen readers.
   */
  defineProps<{
    /** The icon. */
    name: string;
    /** Whether the tag is the active one. */
    active?: boolean;
  }>();
</script>

<template>
  <span
    data-tag-icon
    class="relative inline-block shrink-0"
  >
    <UIcon
      :name
      class="block size-full"
      :class="{ 'active-mark-host': active }"
    />
    <UIcon
      v-if="active"
      name="i-bailly-active"
      data-active-mark
      class="absolute top-(--mark-top,-30%) left-(--mark-left,58.75%) block size-(--mark-size,75%) opacity-75"
    />
  </span>
</template>
