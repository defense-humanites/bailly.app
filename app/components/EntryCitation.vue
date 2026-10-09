<script setup lang="ts">
  import {
    CITATION_STYLE_LABELS, CITATION_STYLES, ENTRY_CITATION_FORM_LABELS, ENTRY_CITATION_FORMS, entryCitation, isCitationStyle,
    isEntryCitationForm, workCitation, type Citation, type CitationStyle, type CitedEntry, type EntryCitationForm,
  } from "~/utils/citation";
  import { StorageKey } from "~/enums";

  const props = defineProps<{
    /** The entry cited (a homonym: the one read). */
    entry: CitedEntry;
    /** The data's version (the API's; `DATA_VERSION` otherwise). */
    version?: string;
  }>();

  /**
   * The form and the style last chosen, on this device (read once mounted:
   * the block is rendered in the browser only, cf. the template).
   */
  const storedForm = useLocalStorage<string>(StorageKey.CitationForm, "note", { writeDefaults: false, initOnMounted: true });
  const storedStyle = useLocalStorage<string>(StorageKey.CitationStyle, "apa", { writeDefaults: false, initOnMounted: true });
  const form = computed<EntryCitationForm>({
    get: () => (isEntryCitationForm(storedForm.value) ? storedForm.value : "note"),
    set: (value) => {
      storedForm.value = value;
    },
  });
  const style = computed<CitationStyle>({
    get: () => (isCitationStyle(storedStyle.value) ? storedStyle.value : "apa"),
    set: (value) => {
      storedStyle.value = value;
    },
  });

  const entryHeadingId = useId();
  const workHeadingId = useId();

  const formItems = ENTRY_CITATION_FORMS.map(value => ({ label: ENTRY_CITATION_FORM_LABELS[value], value }));
  const styleItems = CITATION_STYLES.map(value => ({ label: CITATION_STYLE_LABELS[value], value }));

  /**
   * The date of consultation: the reader's day (set in the browser, the
   * server's could be another), renewed when copying.
   */
  const accessed = ref(new Date());
  onMounted(() => {
    accessed.value = new Date();
  });

  const entryReference = computed((): Citation =>
    entryCitation(form.value, props.entry, style.value, { version: props.version, accessed: accessed.value }));
  const workReference = computed((): Citation =>
    workCitation(style.value, { version: props.version, accessed: accessed.value }));

  /** The two references, presented alike (cf. the template). */
  const parts = computed(() => [
    {
      key: "entry" as const,
      title: "Dans le texte ou en note",
      headingId: entryHeadingId,
      selectLabel: "Forme de la référence",
      items: formItems,
      value: form.value,
      choose: (value: unknown): void => {
        if (isEntryCitationForm(value)) form.value = value;
      },
      reference: entryReference.value,
    },
    {
      key: "work" as const,
      title: "En bibliographie",
      headingId: workHeadingId,
      selectLabel: "Norme de la bibliographie",
      items: styleItems,
      value: style.value,
      choose: (value: unknown): void => {
        if (isCitationStyle(value)) style.value = value;
      },
      reference: workReference.value,
    },
  ]);

  const toast = useToast();

  /**
   * The reference just copied (its button's icon a check for a moment), as
   * the synchronization's key (cf. `SyncDialog`).
   */
  const copied = ref<"entry" | "work">();
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Copies a reference as HTML (its italics kept by word processors) and as
   * plain text (for the other applications, or a paste without formatting);
   * as plain text only where the clipboard takes no HTML.
   */
  const copy = async (which: "entry" | "work"): Promise<void> => {
    const reference = (): Citation => (which === "entry" ? entryReference.value : workReference.value);
    accessed.value = new Date();
    const { text, html } = reference();
    try {
      if (typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        })]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      copied.value = which;
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => {
        copied.value = undefined;
      }, 2_000);
      toast.add({ title: "Référence copiée", icon: "i-lucide-circle-check", color: "success" });
    } catch {
      toast.add({ title: "La référence n'a pas pu être copiée.", icon: "i-lucide-circle-alert", color: "error" });
    }
  };
</script>

<!--
  To cite the entry read: in the text or a note (three forms), and the work
  in the bibliography (four styles), alike: a title, the form or style
  chosen in a select on its right, the reference in a box which a click
  copies (its button, for the keyboard, a check for a moment), as the
  synchronization's key (cf. `SyncDialog`). Rendered in the browser only:
  the date of consultation is the reader's, and the choices are kept on
  the device.
-->
<template>
  <div class="space-y-5 text-sm">
    <ClientOnly>
      <section
        v-for="part in parts"
        :key="part.key"
        :aria-labelledby="part.headingId"
        class="space-y-2"
      >
        <div class="flex items-center justify-between gap-2">
          <h3
            :id="part.headingId"
            class="font-semibold text-highlighted"
          >
            {{ part.title }}
          </h3>
          <USelect
            :model-value="part.value"
            :items="part.items"
            size="xs"
            :aria-label="part.selectLabel"
            class="w-36"
            @update:model-value="part.choose"
          />
        </div>
        <div class="relative">
          <!-- Our own references (their lemma escaped, cf. `utils/citation.ts`). -->
          <!-- eslint-disable vue/no-v-html -->
          <p
            class="cursor-pointer rounded-md bg-elevated p-3 pe-12 font-serif text-default transition-colors hover:bg-accented/60"
            title="Copier la référence"
            @click="copy(part.key)"
            v-html="part.reference.html"
          />
          <!-- eslint-enable vue/no-v-html -->
          <UButton
            :icon="copied === part.key ? 'i-lucide-check' : 'i-lucide-copy'"
            :aria-label="copied === part.key ? 'Référence copiée' : 'Copier la référence'"
            color="neutral"
            variant="ghost"
            size="sm"
            class="absolute end-1.5 top-1.5"
            @click="copy(part.key)"
          />
        </div>
      </section>
    </ClientOnly>
  </div>
</template>
