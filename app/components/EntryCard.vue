<script setup lang="ts">
  import { splitExcerpt } from "~/helpers";
  import type { NuxtLinkProps } from "#app";
  import type { CardProps } from "@nuxt/ui";
  import type { Entry, EntryData } from "#shared/types/api";
  import { entryRoute, homonymAnchor, numberHeadword } from "~/utils/entryUri";
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
     * If enabled, the definition has no links (e.g. when the card is inside
     * a link of its own: links can't be nested).
     */
    noLinks?: boolean;
    /**
     * `NuxtLink` prefetching options (only applies if the `link` property is enabled).
     * @remarks Defaults to `interaction`.
     */
    prefetchOn?: NuxtLinkProps["prefetchOn"];
    /**
     * The link's `rel` (only applies if the `link` property is enabled), e.g.
     * `nofollow` for an entry drawn at random (cf. `RandomOpening`).
     */
    linkRel?: string;
    /**
     * Extended Nuxt UI theming for the card component.
     */
    ui?: CardProps["ui"] & { entry?: string };
  }>();

  /**
   * The definition's HTML, with its links (cf. `linkDefinition`), none if the
   * card is itself a link. Greek may be transliterated (cf. `useGreek`).
   * @remarks Without a definition, the excerpt is shown as text: it may come
   * from IndexedDB (bookmarks imported or synchronized), which must never be
   * rendered as HTML.
   */
  const greek = useGreek();

  /**
   * The card's theme, its header (the toolbar) tinted, its framed groups of
   * buttons at the same distance from its four edges, at every width (Nuxt
   * UI's `sm:px-6` overridden).
   */
  const cardUi = computed((): CardProps["ui"] => ({
    ...props.ui,
    header: ["p-2 sm:px-2 bg-elevated/50", props.ui?.header].filter(Boolean).join(" "),
  }));

  /**
   * An excerpt split around its headword (or, not known yet, the word).
   */
  const excerptParts = (shown: DisplayedEntry) => splitExcerpt(shown.word, shown.excerpt || shown.word);

  /**
   * A homonym's headword followed by its number (cf. `numberHeadword`), in
   * its entry's page as alone (e.g. a bookmark of `oudos#2`).
   */
  const definitionHtml = (shown: DisplayedEntry, htmlDefinition: string): string => {
    const number = homonymAnchor(shown.uri);
    const html = linkDefinition(htmlDefinition, { links: !props.link && !props.noLinks });
    return greek.html(number ? numberHeadword(html, number) : html);
  };

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

  /**
   * The first card (of the homonyms, if any), where the `aside` slot goes.
   */
  const firstCard = computed((): DisplayedEntry => props.entry.children?.[0] ?? props.entry);

  defineSlots<{
    /** At the top right of the (first) card, the text wrapping around it (e.g. an icon). */
    aside?: () => unknown;
    /**
     * The entry's tools, at the end of each card's toolbar (e.g. the
     * citation), for the entry of that card (a homonym: its own).
     */
    tools?: (props: { entry: DisplayedEntry }) => unknown;
  }>();
</script>

<template>
  <DefineEntry v-slot="{ entry: shown }">
    <!-- The definition's HTML comes from our own API (never from IndexedDB). -->
    <!-- eslint-disable vue/no-v-html -->
    <div
      v-if="shown.htmlDefinition"
      class="definition font-serif"
      :class="ui?.entry"
      @click="onDefinitionClick"
      v-html="definitionHtml(shown, shown.htmlDefinition)"
    />
    <!-- eslint-enable vue/no-v-html -->
    <div
      v-else
      class="definition font-serif"
      :class="ui?.entry"
    >
      <!--
        Its headword emphasized, as in the search results and the history
        (cf. `splitExcerpt`); a bookmark whose excerpt is not known yet: its
        word.
      --><span class="font-semibold">{{ greek.text(excerptParts(shown).word) }}</span>{{ greek.text(excerptParts(shown).rest) }}
    </div>
  </DefineEntry>

  <DefineEntryCard v-slot="{ entry: shown }">
    <UCard
      :class="{ '[&>[data-slot=body]]:p-0': link }"
      :ui="cardUi"
    >
      <!--
        The toolbar, in the card's header, on its own line above the
        definition (which keeps the card's whole width): the bookmarks' tools
        at the start (the current tag, all the tags, the star), the entry's
        tools at the end (e.g. the citation), each a framed group; the header
        tinted, the card's rule under it (`UCard`'s header). Interactive once
        the page is hydrated (its state, the bookmarks, only exists in the
        browser); before, and on the server, its markup alone, much lighter
        to render (cf. `TagButtonGroupStatic`).
      -->
      <template
        v-if="toolbar || $slots.tools"
        #header
      >
        <div class="flex items-center justify-between gap-2">
          <ClientOnly v-if="toolbar">
            <TagButtonGroup :entry="shown" />
            <template #fallback>
              <TagButtonGroupStatic />
            </template>
          </ClientOnly>
          <div
            v-if="$slots.tools"
            class="ms-auto flex items-center gap-2"
          >
            <slot
              name="tools"
              :entry="shown"
            />
          </div>
        </div>
      </template>

      <div
        v-if="$slots.aside && shown.uri === firstCard.uri"
        class="float-right ms-3"
      >
        <slot name="aside" />
      </div>

      <!--
        A card as a link: its padding on the definition (the link's child);
        under a toolbar (the home page's random entry, whose header has no
        rule), the text close to it.
      -->
      <NuxtLink
        v-if="link"
        :class="[shown.htmlDefinition ? '[&>*]:p-4 [&>*]:sm:p-6' : '', { '[&>*]:pt-2 [&>*]:sm:pt-2': toolbar }]"
        :to="entryRoute(shown.uri)"
        :rel="linkRel"
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
      anchor is offset to clear the header and the sticky title of the entry
      page (about 3.5rem): the router's scroll ignores
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
        class="absolute top-[calc(-1*(var(--header-bottom)+3.5rem))]"
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
