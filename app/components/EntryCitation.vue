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

  const toast = useToast();

  /**
   * Copies a reference as HTML (its italics kept by word processors) and as
   * plain text (for the other applications, or a paste without formatting);
   * as plain text only where the clipboard takes no HTML.
   */
  const copy = async (reference: () => Citation): Promise<void> => {
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
      toast.add({ title: "Référence copiée", icon: "i-lucide-circle-check", color: "success" });
    } catch {
      toast.add({ title: "La référence n'a pas pu être copiée.", icon: "i-lucide-circle-alert", color: "error" });
    }
  };
</script>

<!--
  To cite the entry read: in the text or a note (three forms), and the work
  in the bibliography (four styles), each with a button copying it. Rendered
  in the browser only: the date of consultation is the reader's, and the
  choices are kept on the device.
-->
<template>
  <div class="space-y-4 text-sm">
    <ClientOnly>
      <section
        :aria-labelledby="entryHeadingId"
        class="space-y-2"
      >
        <h3
          :id="entryHeadingId"
          class="font-semibold text-highlighted"
        >
          Dans le texte ou en note
        </h3>
        <UTabs
          v-model="form"
          :items="formItems"
          :content="false"
          size="xs"
          color="neutral"
          variant="pill"
          class="w-full"
        />
        <!-- Our own references (their lemma escaped, cf. `utils/citation.ts`). -->
        <!-- eslint-disable vue/no-v-html -->
        <p
          class="font-serif text-default"
          v-html="entryReference.html"
        />
        <!-- eslint-enable vue/no-v-html -->
        <UButton
          label="Copier"
          icon="i-lucide-copy"
          size="xs"
          color="neutral"
          variant="outline"
          @click="copy(() => entryReference)"
        />
      </section>

      <section
        :aria-labelledby="workHeadingId"
        class="space-y-2"
      >
        <div class="flex items-center justify-between gap-2">
          <h3
            :id="workHeadingId"
            class="font-semibold text-highlighted"
          >
            En bibliographie
          </h3>
          <USelect
            v-model="style"
            :items="styleItems"
            size="xs"
            aria-label="Norme de la bibliographie"
            class="w-28"
          />
        </div>
        <!-- eslint-disable vue/no-v-html -->
        <p
          class="font-serif text-muted"
          v-html="workReference.html"
        />
        <!-- eslint-enable vue/no-v-html -->
        <UButton
          label="Copier"
          icon="i-lucide-copy"
          size="xs"
          color="neutral"
          variant="outline"
          @click="copy(() => workReference)"
        />
      </section>
    </ClientOnly>
  </div>
</template>
