<script setup lang="ts">
  import {
    biblatexEntry, biblatexFileName, biblatexWork, bibKey, CITATION_STYLE_LABELS, CITATION_STYLES, citedLemma, clipboardHtml, ENTRY_CITATION_FORMS, entryCitation,
    entryCitationFormLabel, isCitationStyle, isEntryCitationForm, WORK_BIB_KEY, workCitation, type Citation, type CitationStyle, type CitedEntry, type EntryCitationForm,
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
  const storedScope = useLocalStorage<string>(StorageKey.CitationBiblatex, "entry", { writeDefaults: false, initOnMounted: true });
  const storedTab = useLocalStorage<string>(StorageKey.CitationTab, "text", { writeDefaults: false, initOnMounted: true });

  /**
   * The tab: the references for a word processor (`text`), or the BibLaTeX
   * records (`bib`); each reader needing one only, the last one opened.
   */
  const tab = computed<"text" | "bib">({
    get: () => (storedTab.value === "bib" ? "bib" : "text"),
    set: (value) => {
      storedTab.value = value;
    },
  });
  const tabItems = [{ label: "Traitement de texte", value: "text" }, { label: "LaTeX et Zotero", value: "bib" }];
  const chooseTab = (value: string | number): void => {
    if (value === "text" || value === "bib") tab.value = value;
  };
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

  const NBSP = " ";

  /** What the BibLaTeX record cites: the entry, or the dictionary (cf. `biblatexWork`). */
  const scope = computed<"entry" | "work">({
    get: () => (storedScope.value === "work" ? "work" : "entry"),
    set: (value) => {
      storedScope.value = value;
    },
  });
  const scopeItems = [{ label: "Cette entrée", value: "entry" }, { label: "L'ouvrage", value: "work" }];
  const chooseScope = (value: unknown): void => {
    if (value === "entry" || value === "work") scope.value = value;
  };

  const entryHeadingId = useId();
  const workHeadingId = useId();
  const biblatexHeadingId = useId();

  /**
   * The style's select, opened from the author-date form's mention (a focus
   * alone would show nothing after a click).
   */
  const styleOpen = ref(false);

  // The author-date form named after the style (« Dans le texte » in MLA).
  const formItems = computed(() => ENTRY_CITATION_FORMS.map(value => ({ label: entryCitationFormLabel(value, style.value), value })));
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
      items: formItems.value,
      value: form.value,
      open: undefined,
      setOpen: undefined,
      // The author-date form follows the bibliography's style: said above
      // the reference, the style's name leading to its select.
      followsStyle: form.value === "authorDate",
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
      open: styleOpen.value,
      setOpen: (open: boolean): void => {
        styleOpen.value = open;
      },
      followsStyle: false,
      choose: (value: unknown): void => {
        if (isCitationStyle(value)) style.value = value;
      },
      reference: workReference.value,
    },
  ]);

  /**
   * Temporary (from October 2026, to be removed around December): the
   * formats were checked on universities' guides, not on the official
   * manuals; the readers who use them may tell us. The subject says the
   * style and the entry, as the reports of the text's errors (`à-propos.vue`).
   */
  const reportUrl = computed(() =>
    `mailto:contact@bailly.app?subject=${encodeURIComponent(`Citation ${CITATION_STYLE_LABELS[style.value]} : ${citedLemma(props.entry)}`)}`);

  /**
   * The entry, or the dictionary, as a BibLaTeX record (cf. `biblatexEntry`,
   * `biblatexWork`): to paste in a `.bib` file, or downloaded as one (which
   * LaTeX, Zotero, JabRef… read).
   */
  const biblatex = computed((): string => {
    const context = { version: props.version, accessed: accessed.value };
    return scope.value === "work" ? biblatexWork(context) : biblatexEntry(props.entry, context);
  });

  /**
   * The record's lines, a field's wrapped lines indented: under its value
   * (after its brace, the names aligned, cf. `biblatexEntry`), or by a
   * little on a phone (the value would have no room).
   */
  const biblatexLines = computed(() => biblatex.value.split("\n").map(text => ({
    text,
    field: text.startsWith(" "),
    style: { "--hang": `${text.indexOf("{") + 1}ch` },
  })));

  const downloadBiblatex = (): void => {
    accessed.value = new Date();
    const url = URL.createObjectURL(new Blob([`${biblatex.value}\n`], { type: "application/x-bibtex;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = biblatexFileName(scope.value === "work" ? WORK_BIB_KEY : bibKey(props.entry));
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  };

  const toast = useToast();

  /**
   * Copies a reference as HTML (its italics kept by word processors) and as
   * plain text (for the other applications, or a paste without formatting);
   * as plain text only where the clipboard takes no HTML. Whether it could
   * (cf. `CopyBox`).
   */
  const copy = async (which: "entry" | "work" | "biblatex"): Promise<boolean> => {
    const reference = (): Citation => {
      if (which === "biblatex") return { text: biblatex.value, html: "" };
      return which === "entry" ? entryReference.value : workReference.value;
    };
    accessed.value = new Date();
    const { text, html } = reference();
    try {
      if (html && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([clipboardHtml(html, navigator.vendor === "Apple Computer, Inc.")], { type: "text/html" }),
        })]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      toast.add({ title: "Référence copiée", icon: "i-lucide-circle-check", color: "success" });
      return true;
    } catch {
      toast.add({ title: "La référence n'a pas pu être copiée.", icon: "i-lucide-circle-alert", color: "error" });
      return false;
    }
  };
</script>

<!--
  To cite the entry read: in the text or a note (three forms), and the work
  in the bibliography (four styles), alike: a title, the form or style
  chosen in a select on its right, the reference in a box which a click
  copies (`CopyBox`, as the synchronization's key). In a tab of its own,
  for LaTeX or a reference manager, the entry or the work as a BibLaTeX
  record: the same box (copied as plain text, in a monospace font, its
  whole height), its file to download beside its explanation. Rendered in
  the browser only:
  the date of consultation is the reader's, and the choices are kept on
  the device.
-->
<template>
  <div class="space-y-5 text-sm">
    <ClientOnly>
      <UTabs
        :model-value="tab"
        :items="tabItems"
        :content="false"
        size="sm"
        class="w-full"
        @update:model-value="chooseTab"
      />
      <div
        v-if="tab === 'text'"
        class="space-y-5"
      >
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
              :open="part.open"
              :items="part.items"
              size="xs"
              :aria-label="part.selectLabel"
              class="w-36"
              @update:model-value="part.choose"
              @update:open="part.setOpen"
            />
          </div>
          <div
            v-if="part.followsStyle"
            class="flex gap-2 text-muted"
          >
            <UIcon
              name="i-lucide-info"
              class="mt-0.5 size-4 shrink-0"
            />
            <span>
              Suit la norme choisie pour la bibliographie,
              <!-- Never the style's name alone on a line. -->
              <span class="whitespace-nowrap">ci-dessous{{ NBSP }}:
                <button
                  type="button"
                  class="link cursor-pointer text-default"
                  @click="styleOpen = true"
                >{{ CITATION_STYLE_LABELS[style] }}</button>.</span>
            </span>
          </div>
          <CopyBox
            label="Copier la référence"
            copied-label="Référence copiée"
            :copy="() => copy(part.key)"
          >
            <!-- Our own references (their lemma escaped, cf. `utils/citation.ts`). -->
            <!-- eslint-disable vue/no-v-html -->
            <p
              class="font-serif text-default"
              v-html="part.reference.html"
            />
          <!-- eslint-enable vue/no-v-html -->
          </CopyBox>
        </section>
      </div>
      <section
        v-else
        :aria-labelledby="biblatexHeadingId"
        class="space-y-2"
      >
        <div class="flex items-center justify-between gap-2">
          <h3
            :id="biblatexHeadingId"
            class="font-semibold text-highlighted"
          >
            En BibLaTeX
          </h3>
          <USelect
            :model-value="scope"
            :items="scopeItems"
            size="xs"
            aria-label="Objet de l'entrée BibLaTeX"
            class="w-36"
            @update:model-value="chooseScope"
          />
        </div>
        <div class="flex items-start justify-between gap-3">
          <p class="text-muted">
            Pour LaTeX ou un gestionnaire de références (Zotero, JabRef, Mendeley…).
          </p>
          <UButton
            icon="i-lucide-download"
            label="Fichier .bib"
            color="neutral"
            variant="outline"
            size="xs"
            class="shrink-0 rounded-md"
            aria-label="Télécharger le fichier BibLaTeX"
            @click="downloadBiblatex"
          />
        </div>
        <CopyBox
          label="Copier l'entrée BibLaTeX"
          copied-label="Entrée BibLaTeX copiée"
          :copy="() => copy('biblatex')"
        >
          <pre class="font-mono text-xs/5 whitespace-pre-wrap wrap-anywhere text-default"><span
            v-for="(line, index) in biblatexLines"
            :key="index"
            class="block"
            :class="{ 'ps-[4ch] -indent-[4ch] sm:[padding-inline-start:var(--hang)] sm:[text-indent:calc(-1*var(--hang))]': line.field }"
            :style="line.style"
          >{{ line.text }}</span></pre>
        </CopyBox>
      </section>
      <!--
        Temporary, cf. `reportUrl`. Set apart as the synchronization key's
        warning (`SyncDialog`).
      -->
      <p class="flex gap-2 border-t border-default pt-4 text-muted">
        <UIcon
          name="i-lucide-message-circle"
          class="mt-0.5 size-4 shrink-0"
        />
        <span>
          Un format vous paraît inexact&nbsp;?
          <a
            :href="reportUrl"
            class="link"
          >Écrivez-nous</a>.
        </span>
      </p>
    </ClientOnly>
  </div>
</template>
