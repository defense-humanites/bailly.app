<script setup lang="ts">
  import type { NuxtLinkProps } from "#app";
  import type { CardProps } from "@nuxt/ui";
  import type { Entry } from "~/plugins/api";
  import type { Optional } from "~/types";

  const props = defineProps<{
    /**
     * The displayed entry (usually fetched from the API or IndexedDB).
     * @remarks If the `htmlDefinition` is omitted, the `excerpt` will be displayed instead.
     */
    entry: Entry<"word" | "uri" | "excerpt"> & Optional<Entry, "htmlDefinition">;
    /**
     * If enabled, display the tag toolbar.
     */
    toolbar?: boolean;
    /**
     * If enabled, make the card a link pointing to the entry page.
     */
    link?: boolean;
    /**
     * `NuxtLink` prefetching options (only applies if the `link` property is enabled).
     */
    prefetchOn?: NuxtLinkProps["prefetchOn"];
    /**
     * Extended Nuxt UI theming for the card component.
     */
    ui?: CardProps["ui"] & { entry?: string };
  }>();

  const [DefineEntry, ReuseEntry] = createReusableTemplate<{
    entry: typeof props.entry;
  }>();

  const [DefineEntryCard, ReuseEntryCard] = createReusableTemplate<{
    entry: typeof props.entry;
  }>();
</script>

<template>
  <DefineEntry v-slot="{ entry }">
    <div
      class="font-serif font-semibold text-xl"
      :class="ui?.entry"
      v-html="entry.htmlDefinition ?? entry.excerpt"
    />
  </DefineEntry>

  <DefineEntryCard v-slot="{ entry }">
    <UCard
      :class="{ '[&>*]:p-0': link }"
      :ui="ui"
    >
      <TagButtonGroup
        v-if="toolbar"
        :entry="entry"
        class="relative float-right"
        :class="[link ? 'right-3 top-3' : '-right-3 -top-3']"
      />

      <NuxtLink
        v-if="link"
        :class="[link && entry.htmlDefinition ? '[&>*]:p-4 [&>*]:sm:p-6' : '']"
        :to="`/${entry.uri}`"
        prefetch-on="interaction"
      >
        <ReuseEntry :entry="entry" />
      </NuxtLink>

      <ReuseEntry
        v-else
        :entry="entry"
      />
    </UCard>
  </DefineEntryCard>

  <div
    v-if="entry.children"
    class="flex flex-col gap-6"
  >
    <ReuseEntryCard
      v-for="childEntry in entry.children"
      :entry="childEntry"
      as="article"
    />
  </div>

  <ReuseEntryCard
    v-else
    :entry="entry"
  />
</template>
