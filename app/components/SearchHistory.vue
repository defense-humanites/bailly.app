<script setup lang="ts">
  import type { PopoverProps } from "@nuxt/ui";
  import { splitExcerpt } from "~/helpers";
  import { entryRoute } from "~/utils/entryUri";

  const props = defineProps<{
    /** The search bar, whose width and position the panel takes. */
    reference?: HTMLElement;
  }>();

  const historyStore = useHistoryStore();
  const route = useRoute();

  /**
   * The panel (a dialog) is named after its trigger by Reka
   * (`aria-labelledby`); the `aria-label` is a fallback, for the trigger's
   * id may differ between the server and the client (then the reference is
   * broken, and the dialog would have no name).
   */
  const popoverContent = computed(() => ({
    "align": "start",
    "collisionPadding": 8,
    "reference": props.reference,
    "aria-label": "Entrées consultées récemment",
  }) as PopoverProps["content"]);

  const open = ref(false);
  const confirmingClear = ref(false);
  const list = useTemplateRef<HTMLUListElement>("list");

  // Greek may be transliterated (a preference).
  const greek = useGreek();

  const links = computed(() => historyStore.entries.map(entry => ({
    uri: entry.uri,
    ...splitExcerpt(entry.word, entry.excerpt),
    to: entryRoute(entry.uri),
  })));

  /**
   * The history is read when the panel opens (it changes on every entry
   * page), then the focus goes to the newest entry: the panel only had its
   * own focus so far.
   */
  watch(open, async (isOpen: boolean) => {
    if (!isOpen) {
      confirmingClear.value = false;
      return;
    }
    await historyStore.load();
    await nextTick();
    list.value?.querySelector<HTMLElement>("a")?.focus();
  });

  // Close the panel once an entry is chosen.
  watch(() => route.fullPath, () => {
    open.value = false;
  });

  /**
   * Moves the focus between the entries with the arrow keys.
   */
  function onKeydown(event: KeyboardEvent): void {
    const items = Array.from(list.value?.querySelectorAll<HTMLElement>("a") ?? []);
    if (!items.length) return;

    const index = items.indexOf(document.activeElement as HTMLElement);
    const last = items.length - 1;
    const target = {
      ArrowDown: index < 0 || index === last ? 0 : index + 1,
      ArrowUp: index <= 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key];

    if (target === undefined) return;
    event.preventDefault();
    items[target]?.focus();
  }

  async function clear(): Promise<void> {
    await historyStore.clear();
    confirmingClear.value = false;
  }
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="popoverContent"
    :ui="{ content: 'search-surface search-panel w-(--reka-popover-trigger-width) max-h-[min(32rem,var(--reka-popover-content-available-height))] overflow-y-auto p-1' }"
  >
    <!-- The same button as the options' one (cf. SearchOptions). -->
    <UButton
      color="neutral"
      variant="outline"
      size="lg"
      icon="i-lucide-history"
      class="relative w-12 shrink-0 justify-center before:absolute before:inset-y-px before:start-0 before:w-px before:bg-(--ui-border) hover:bg-(--search-hover) active:bg-(--search-active) data-[state=open]:bg-(--search-active) group-has-[input:focus-visible]/search:ring-primary"
      aria-label="Entrées consultées récemment"
    />

    <template #content>
      <div @keydown="onKeydown">
        <h2
          id="search-history-title"
          class="p-2 text-xs font-semibold uppercase tracking-wide text-muted"
        >
          Consultées récemment
        </h2>

        <p
          v-if="historyStore.loaded && !links.length"
          class="p-2 text-sm text-muted"
        >
          Aucune entrée consultée pour l'instant.
        </p>

        <!--
          The rows as the search's results (cf. `SearchBar`): their padding,
          and their highlight (hover, keyboard focus) on a pseudo-element
          inset by 1px, with the same transition.
        -->
        <ul
          v-else
          ref="list"
          class="isolate"
        >
          <li
            v-for="link in links"
            :key="link.uri"
          >
            <NuxtLink
              :to="link.to"
              class="relative flex items-start gap-2 p-2 text-sm text-default outline-none transition-colors before:absolute before:inset-px before:-z-1 before:rounded-md before:transition-colors hover:text-highlighted hover:before:bg-(--app-highlight) focus-visible:text-highlighted focus-visible:before:bg-(--app-highlight)"
            >
              <span class="line-clamp-2 grow font-serif text-sm/6"><span class="font-semibold">{{ greek.text(link.word) }}</span>{{ greek.text(link.rest) }}</span>
              <EntryBookmarkIndicator
                :uri="link.uri"
                class="mt-1"
              />
            </NuxtLink>
          </li>
        </ul>

        <!-- Clearing the history needs a confirmation, in place. -->
        <footer
          v-if="links.length"
          class="mt-1 flex min-h-9 items-center justify-end gap-2 border-t border-default px-1 pt-1"
        >
          <template v-if="confirmingClear">
            <span class="me-auto ps-1 text-sm text-muted">Effacer tout l'historique ?</span>
            <UButton
              label="Annuler"
              color="neutral"
              variant="ghost"
              size="sm"
              class="rounded-md"
              @click="confirmingClear = false"
            />
            <UButton
              label="Effacer"
              color="error"
              variant="soft"
              size="sm"
              class="rounded-md"
              @click="clear"
            />
          </template>
          <UButton
            v-else
            label="Effacer l'historique"
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            size="sm"
            class="rounded-md"
            @click="confirmingClear = true"
          />
        </footer>
      </div>
    </template>
  </UPopover>
</template>
