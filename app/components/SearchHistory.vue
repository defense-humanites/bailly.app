<script setup lang="ts">
  import { splitExcerpt } from "~/helpers";
  import { entryRoute } from "~/utils/entryUri";

  const props = defineProps<{
    /** The search bar, whose width and position the panel takes. */
    reference?: HTMLElement;
  }>();

  const historyStore = useHistoryStore();
  const route = useRoute();

  const open = ref(false);
  const confirmingClear = ref(false);
  const list = useTemplateRef<HTMLUListElement>("list");

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
    :content="{ align: 'start', collisionPadding: 12, reference: props.reference }"
    :ui="{ content: 'w-(--reka-popover-trigger-width) max-h-[min(32rem,var(--reka-popover-content-available-height))] overflow-y-auto p-1' }"
  >
    <!-- The same button as the options' one (cf. SearchOptions). -->
    <UButton
      color="neutral"
      variant="outline"
      size="lg"
      icon="i-lucide-history"
      class="relative w-12 shrink-0 justify-center shadow-xs before:absolute before:inset-y-0 before:start-0 before:w-px before:bg-(--ui-border-accented) data-[state=open]:bg-elevated group-has-[input:focus-visible]/search:ring-primary"
      aria-label="Entrées consultées récemment"
    />

    <template #content>
      <section
        aria-labelledby="search-history-title"
        @keydown="onKeydown"
      >
        <h2
          id="search-history-title"
          class="px-2 pt-1.5 pb-1 text-xs uppercase tracking-wide text-muted"
        >
          Consultées récemment
        </h2>

        <p
          v-if="historyStore.loaded && !links.length"
          class="px-2 py-1.5 text-sm text-muted"
        >
          Aucune entrée consultée pour l'instant.
        </p>

        <ul
          v-else
          ref="list"
        >
          <li
            v-for="link in links"
            :key="link.uri"
          >
            <NuxtLink
              :to="link.to"
              class="block rounded-md px-2 py-1.5 text-sm outline-none hover:bg-elevated/50 focus-visible:bg-elevated"
            >
              <span class="line-clamp-2 font-serif text-base"><span class="font-semibold">{{ link.word }}</span>{{ link.rest }}</span>
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
              @click="confirmingClear = false"
            />
            <UButton
              label="Effacer"
              color="error"
              variant="soft"
              size="sm"
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
            @click="confirmingClear = true"
          />
        </footer>
      </section>
    </template>
  </UPopover>
</template>
