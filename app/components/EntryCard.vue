<script setup lang="ts">
  import type { NuxtLinkProps } from "#app";
  import type { CardProps } from "@nuxt/ui";
  import type { Entry, EntryData } from "#shared/types/api";
  import { entryRoute, homonymAnchor } from "~/utils/entryUri";

  type DisplayedEntry = Entry<"word" | "uri" | "excerpt"> & Partial<Pick<EntryData, "htmlDefinition">>;

  defineProps<{
    /**
     * The displayed entry (usually fetched from the API or IndexedDB).
     * @remarks If the `htmlDefinition` is omitted, the `excerpt` will be displayed instead.
     */
    entry: DisplayedEntry;
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
     * @remarks Defaults to `interaction`.
     */
    prefetchOn?: NuxtLinkProps["prefetchOn"];
    /**
     * Extended Nuxt UI theming for the card component.
     */
    ui?: CardProps["ui"] & { entry?: string };
  }>();

  const [DefineEntry, ReuseEntry] = createReusableTemplate<{
    entry: DisplayedEntry;
  }>();

  const [DefineEntryCard, ReuseEntryCard] = createReusableTemplate<{
    entry: DisplayedEntry;
  }>();
</script>

<template>
  <DefineEntry v-slot="{ entry: shown }">
    <!-- The dictionary HTML comes from our own API. -->
    <!-- eslint-disable vue/no-v-html -->
    <div
      class="font-serif font-semibold text-xl"
      :class="ui?.entry"
      v-html="shown.htmlDefinition ?? shown.excerpt"
    />
    <!-- eslint-enable vue/no-v-html -->
  </DefineEntry>

  <DefineEntryCard v-slot="{ entry: shown }">
    <UCard
      :class="{ '[&>*]:p-0': link }"
      :ui="ui"
    >
      <TagButtonGroup
        v-if="toolbar"
        :entry="shown"
        class="relative float-right"
        :class="[link ? 'right-3 top-3' : '-right-3 -top-3']"
      />

      <NuxtLink
        v-if="link"
        :class="[shown.htmlDefinition ? '[&>*]:p-4 [&>*]:sm:p-6' : '']"
        :to="entryRoute(shown.uri)"
        :prefetch-on="prefetchOn ?? 'interaction'"
      >
        <ReuseEntry :entry="shown" />
      </NuxtLink>

      <ReuseEntry
        v-else
        :entry="shown"
      />
    </UCard>
  </DefineEntryCard>

  <div
    v-if="entry.children?.length"
    class="flex flex-col gap-6"
  >
    <!--
      Each homonym is anchored by its number (e.g. `oudos#2` → `#2`). The
      anchor is offset to clear the fixed header: the router's scroll ignores
      `scroll-margin-top` for ids starting with a digit (`#2` isn't a valid
      CSS selector).
    -->
    <div
      v-for="(childEntry, index) in entry.children"
      :key="childEntry.uri"
      class="relative"
    >
      <span
        :id="homonymAnchor(childEntry.uri) ?? String(index + 1)"
        class="absolute -top-24"
        aria-hidden="true"
      />
      <ReuseEntryCard :entry="childEntry" />
    </div>
  </div>

  <ReuseEntryCard
    v-else
    :entry="entry"
  />
</template>
