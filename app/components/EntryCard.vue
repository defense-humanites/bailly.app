<script setup lang="ts">
  import type { NuxtLinkProps } from "#app";
  import type { CardProps } from "@nuxt/ui";
  import type { Entry, EntryData } from "#shared/types/api";
  import { entryRoute, homonymAnchor } from "~/utils/entryUri";
  import { linkDefinition } from "~/utils/linkedEntries";

  type DisplayedEntry = Entry<"word" | "uri" | "excerpt"> & Partial<Pick<EntryData, "htmlDefinition">>;

  const props = defineProps<{
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
     * If enabled, the homonyms get no anchor (e.g. when several entries are
     * shown on the same page, where their numbers would repeat).
     */
    noAnchors?: boolean;
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

  /**
   * The definition's HTML, with its links (cf. `linkDefinition`), none if the
   * card is itself a link; the excerpt if there is no definition.
   */
  const content = (shown: DisplayedEntry): string =>
    shown.htmlDefinition ? linkDefinition(shown.htmlDefinition, { links: !props.link }) : shown.excerpt;

  /**
   * Follows the definition's internal links within the application, rather
   * than reloading the page (unless the user opens them elsewhere).
   */
  const onDefinitionClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element | null)?.closest("a[href]");
    const href = anchor?.getAttribute("href");
    if (!href?.startsWith("/") || anchor?.getAttribute("target")) return;
    event.preventDefault();
    void navigateTo(href);
  };

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
      class="definition font-serif font-semibold text-xl"
      :class="ui?.entry"
      @click="onDefinitionClick"
      v-html="content(shown)"
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
        v-if="!noAnchors"
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
