<script setup lang="ts">
  import { renderSVG } from "uqr";
  import type { SyncSections } from "~/stores/sync";
  import { DEFAULT_SYNCED_PREFERENCES, SYNCABLE_PREFERENCES, type SyncablePreference } from "~/utils/preferences";

  const open = defineModel<boolean>("open", { default: false });

  const props = defineProps<{
    /**
     * The type of data of the page that opens the window: only it is shown
     * (the key, common to both, synchronizes the other where it is enabled).
     */
    scope: "bookmarks" | "preferences";
    /**
     * A key received through a link (`/signets#sync=…`, `/préférences#sync=…`),
     * to join.
     */
    linkSecret?: Uint8Array<ArrayBuffer> | null;
  }>();

  /**
   * The words of the window, after its type of data.
   */
  const texts = computed(() => props.scope === "bookmarks"
    ? {
      data: "vos signets",
      Data: "Vos signets",
      encrypted: "Vos signets sont chiffrés sur l'appareil avant d'être envoyés",
      upToDate: "Signets à jour",
      synced: "Signets synchronisés.",
      intro: "Retrouvez vos signets sur tous vos appareils (ordinateur, téléphone…), sans créer de compte.",
      joined: "Vos signets de cet appareil et ceux de vos autres appareils seront réunis.",
      add: "Synchroniser aussi vos signets",
      addDescription: "Avec la clé de vos préférences : vos signets de cet appareil et ceux de vos autres appareils seront réunis.",
      disabled: "Synchronisation des signets désactivée sur cet appareil",
      stopDevice: "Vos signets restent sur cet appareil, et en ligne pour vos autres appareils. Pour réactiver la synchronisation, il faudra la clé : les signets en ligne seront alors rétablis sur cet appareil, même ceux que vous y auriez supprimés entre-temps.",
      stopDeviceKept: "Vos signets restent sur cet appareil, et en ligne pour vos autres appareils. Pour les synchroniser de nouveau : « Synchroniser aussi vos signets » ; les signets en ligne seront alors rétablis sur cet appareil, même ceux que vous y auriez supprimés entre-temps.",
      otherStays: "Vos préférences restent synchronisées.",
      status: "Pour retrouver vos signets sur un autre appareil (téléphone, tablette…), ajoutez-le avec votre clé. Pensez aussi à la sauvegarder hors du navigateur.",
      emptied: "Faute d'activité, le serveur avait effacé vos signets en ligne : ceux de cet appareil les remplacent. Vos autres appareils y ajouteront les leurs à leur prochaine synchronisation.",
    }
    : {
      data: "vos préférences",
      Data: "Vos préférences",
      encrypted: "Vos préférences sont chiffrées sur l'appareil avant d'être envoyées",
      upToDate: "Préférences à jour",
      synced: "Préférences synchronisées.",
      intro: "Retrouvez vos préférences sur tous vos appareils (ordinateur, téléphone…), sans créer de compte.",
      joined: "Les préférences choisies seront les mêmes sur cet appareil et sur vos autres appareils : le réglage le plus récent l'emporte.",
      add: "Synchroniser aussi vos préférences",
      addDescription: "Avec la clé de vos signets : les préférences choisies seront les mêmes sur vos appareils.",
      disabled: "Synchronisation des préférences désactivée sur cet appareil",
      stopDevice: "Vos préférences restent réglées sur cet appareil, et en ligne pour vos autres appareils.",
      stopDeviceKept: "Vos préférences restent réglées sur cet appareil, et en ligne pour vos autres appareils.",
      otherStays: "Vos signets restent synchronisés.",
      status: "Pour retrouver vos préférences sur un autre appareil (téléphone, tablette…), ajoutez-le avec votre clé. Pensez aussi à la sauvegarder hors du navigateur.",
      emptied: "Faute d'activité, le serveur avait effacé vos préférences en ligne : celles de cet appareil les remplacent.",
    });

  /**
   * The preferences that can be synchronized, as offered.
   */
  const preferenceLabels: Record<SyncablePreference, { label: string; description?: string }> = {
    transliterateGreek: { label: "Grec translittéré" },
    readingFont: { label: "Police" },
    readingSize: { label: "Taille du texte" },
    readingWeight: { label: "Graisse du texte" },
    inflectedForms: { label: "Formes fléchies" },
    inputMode: { label: "Saisie", description: "Beta code ou translittération : selon le clavier de chaque appareil." },
  };

  type View = "intro" | "join" | "key" | "status" | "stop" | "delete";

  /**
   * The number of words of a key (cf. `~/sync/key`, loaded only to join: it
   * contains the list of words).
   */
  const SYNC_KEY_WORD_COUNT = 12;

  const syncStore = useSyncStore();
  const {
    enabled,
    syncedBookmarks,
    syncedPreferences,
    remoteSections,
    status,
    error,
    errorNeedsAction,
    errorSection,
    clockWrong,
    clockSkew,
    lastSyncedAt,
    supported,
  } = storeToRefs(syncStore);

  /**
   * Whether the latest synchronization failed for the type of data of the
   * window (the other may be the only one concerned).
   */
  const scopeError = computed(() => status.value === "error" && (errorSection.value === null || errorSection.value === props.scope));

  /**
   * The latest error of the synchronization, if it concerns the type of data
   * of the window.
   */
  const scopedError = computed(() => (errorSection.value === null || errorSection.value === props.scope ? error.value : null));

  /**
   * Whether this device synchronizes the type of data of the window (the key
   * may synchronize the other one only).
   */
  const scopeEnabled = computed(() => (props.scope === "bookmarks" ? syncedBookmarks.value : syncedPreferences.value.length > 0));

  /**
   * The preferences chosen: those synchronized, once enabled (changed at
   * once); otherwise, those offered checked.
   */
  const chosenPreferences = ref<SyncablePreference[]>([...DEFAULT_SYNCED_PREFERENCES]);
  const preferenceItems = computed(() => SYNCABLE_PREFERENCES.map((value) => {
    // At least one: to synchronize none, the synchronization is stopped.
    const last = chosenPreferences.value.length === 1 && chosenPreferences.value[0] === value;
    return {
      value,
      ...preferenceLabels[value],
      ...(last ? { description: "Au moins une préférence reste cochée : pour n'en synchroniser aucune, arrêtez la synchronisation." } : {}),
      disabled: last,
    };
  }));

  /**
   * The preferences on two columns, in the order of the preferences page
   * (row by row); on one on a small screen.
   */
  const preferencesUi = { fieldset: "grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2" };

  /**
   * The types of data to synchronize once the window's is enabled: added to
   * those this device synchronizes, if any (e.g. when the key is replaced).
   */
  const sectionsToSync = (): SyncSections => {
    const current = enabled.value
      ? { bookmarks: syncedBookmarks.value, preferences: syncedPreferences.value }
      : { bookmarks: false, preferences: [] };
    return props.scope === "bookmarks"
      ? { ...current, bookmarks: true }
      : { ...current, preferences: [...chosenPreferences.value] };
  };

  /**
   * Changes the preferences synchronized, once enabled.
   */
  const setPreferences = (keys: SyncablePreference[]) => {
    chosenPreferences.value = keys;
    if (!scopeEnabled.value || !keys.length) return;
    // One change at a time (the latest changes are sent first, cf. `setSections`).
    void run(async () => {
      const result = await syncStore.setSections({ bookmarks: syncedBookmarks.value, preferences: keys });
      if (result.state === "error") actionError.value = result.message;
    });
  };

  /**
   * How wrong this device's clock seems, e.g. « 3 jours » (cf. `clockWrong`).
   */
  const clockGap = computed(() => {
    const hours = Math.round(Math.abs(clockSkew.value) / 3_600_000);
    return hours >= 48 ? `${Math.round(hours / 24)} jours` : `${hours} heures`;
  });
  const toast = useToast();

  const view = ref<View>("intro");
  const words = ref<string[]>([]);
  const busy = ref(false);

  /**
   * Whether the key is shown from the state of the synchronization (to add a
   * device), rather than right after enabling it (to keep it first).
   */
  const keyFromStatus = ref(false);

  /**
   * Whether the words (and the QR code) are shown: from the state of the
   * synchronization, only once asked (someone may see the screen, e.g. a
   * shared computer); right after enabling it, at once.
   */
  const keyRevealed = ref(true);

  /**
   * The two uses of the key: adding a device (the QR code and the words,
   * shown on the screen) and keeping it (the recovery kit, a copy: without
   * showing it).
   */
  type KeyTab = "device" | "save";
  const keyTab = ref<KeyTab>("save");
  // Keeping the key comes first (the first step, after enabling); the labels
  // are short enough for one line on mobile.
  const keyTabs = [
    { label: "Sauvegarder", value: "save" },
    { label: "Ajouter un appareil", value: "device" },
  ];

  /**
   * Shows the key: right after enabling the synchronization, to keep it
   * first; from its state, to add a device or keep it.
   */
  // Leaving a tab hides the key again: shown only while asked for.
  watch(keyTab, () => {
    keyRevealed.value = false;
  });

  const showKey = async (fromStatus = false, tab: KeyTab = "save"): Promise<void> => {
    words.value = await syncStore.words();
    keyFromStatus.value = fromStatus;
    keyTab.value = tab;
    await nextTick();
    keyRevealed.value = !fromStatus;
    view.value = "key";
  };

  const titles = computed((): Record<View, string> => ({
    intro: props.scope === "bookmarks" ? "Synchroniser vos signets" : "Synchroniser vos préférences",
    join: "Rejoindre la synchronisation",
    key: "Votre clé de synchronisation",
    status: props.scope === "bookmarks" ? "Synchronisation des signets" : "Synchronisation des préférences",
    stop: "Arrêter la synchronisation ?",
    delete: "Supprimer vos données en ligne ?",
  }));

  /**
   * The error of an action, explained to the user.
   */
  const actionError = ref<string | null>(null);

  /**
   * Runs an action of the window: busy meanwhile, and any unexpected error
   * shown (rather than nothing happening).
   */
  const run = async (action: () => Promise<void>): Promise<void> => {
    busy.value = true;
    actionError.value = null;
    try {
      await action();
    } catch (e: unknown) {
      console.error(e);
      actionError.value = `Une erreur inattendue est survenue. ${texts.value.Data} restent sur cet appareil.`;
    } finally {
      busy.value = false;
    }
  };

  const enable = () => run(async () => {
    const result = await syncStore.enable(sectionsToSync());
    if (result.state === "error") {
      actionError.value = result.message;
      return;
    }
    await showKey();
  });

  /**
   * Adds the type of data of the window to those this device synchronizes
   * with its key.
   */
  const addScope = () => run(async () => {
    const result = await syncStore.setSections(sectionsToSync());
    linkKey.value = null;
    if (result.state === "error") {
      actionError.value = result.message;
      // Enabled all the same (e.g. offline: synchronized later).
      if (scopeEnabled.value) view.value = "status";
      return;
    }
    toast.add({ title: "Synchronisation activée", icon: "i-lucide-circle-check", color: "success" });
    view.value = "status";
  });

  /* Joining: the words typed (or pasted), or the key of a link. */

  const joinText = ref("");
  const joinError = ref<string | null>(null);
  const keyModule = ref<typeof import("~/sync/key") | null>(null);

  watch(view, async (value) => {
    if (value === "join" && !keyModule.value) keyModule.value = await import("~/sync/key");
  }, { immediate: true });

  const typedWords = computed(() => keyModule.value?.splitWords(joinText.value) ?? []);
  /**
   * The first word typed that is not in the list: the last one too, while it
   * is being typed, as soon as no word of the list starts like it (more
   * letters would not make it one).
   */
  const unknownWord = computed(() => {
    const module = keyModule.value;
    if (!module) return null;
    const words = typedWords.value;
    const typing = /\s$/.test(joinText.value) ? -1 : words.length - 1;
    return words.find((word, i) => (i === typing ? !module.suggestWords(word, 1).length : !module.resolveWord(word))) ?? null;
  });

  /**
   * Whether the words typed make a key that can be tried: twelve words, each
   * recognized (its first 4 letters suffice, cf. `resolveWord`), so that the
   * key can be sent as soon as the last one is (its checksum is checked
   * then).
   */
  const keyReady = computed(() => {
    const module = keyModule.value;
    return Boolean(module)
      && typedWords.value.length === SYNC_KEY_WORD_COUNT
      && typedWords.value.every(word => module!.resolveWord(word));
  });

  /**
   * Enter sends the key once it is ready, instead of starting a new line
   * (the words may be separated by line breaks); Shift+Enter still does.
   */
  const onJoinEnter = (event: KeyboardEvent): void => {
    // Safari ends a composition with an Enter whose `isComposing` is false,
    // but whose `keyCode` is 229 (its only sign).
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- See above.
    const composing = event.isComposing || event.keyCode === 229;
    if (!keyReady.value || event.shiftKey || composing || busy.value) return;
    event.preventDefault();
    (event.target as HTMLTextAreaElement).form?.requestSubmit();
  };

  /**
   * The key of the link, while it has not been used: once joined (or once
   * the user goes elsewhere in the window), "J'ai déjà une clé" asks for the
   * words.
   */
  const linkKey = shallowRef<Uint8Array<ArrayBuffer> | null>(null);

  watch(view, (value) => {
    if (value !== "join") linkKey.value = null;
  });

  /**
   * Whether the key of the link is already this device's (for this type, or
   * the other one only: this one is then added).
   */
  const sameKey = computed(() => Boolean(linkKey.value && enabled.value && syncStore.hasKey(linkKey.value)));

  /**
   * Joins with the words typed or the key of the link (which replaces this
   * device's key, if any, once the first synchronization succeeded).
   */
  const join = () => run(async () => {
    joinError.value = null;
    const result = await syncStore.join(linkKey.value ?? typedWords.value, sectionsToSync());
    if (result.state === "error") {
      joinError.value = result.message;
      return;
    }
    linkKey.value = null;
    toast.add({
      title: "Synchronisation activée",
      // The key is valid, but the server had emptied its locker.
      description: result.data.emptied
        ? texts.value.emptied
        : undefined,
      icon: "i-lucide-circle-check",
      color: "success",
      duration: result.data.emptied ? 15_000 : undefined,
    });
    view.value = "status";
  });

  /* The key, outside of the browser. */

  const link = computed(() => (import.meta.client ? syncStore.link(window.location.origin, props.scope) : null));
  const qrCode = computed(() => (view.value === "key" && link.value
    ? renderSVG(link.value, { border: 2, ecc: "M", whiteColor: "#fff", blackColor: "#000" })
    : ""));

  const numberedWords = (): string =>
    words.value.map((word, i) => `${String(i + 1).padStart(2, " ")}. ${word}`).join("\n");

  const downloadRecoveryKit = (): void => {
    const text = [
      "Bailly.app — clé de synchronisation",
      "",
      numberedWords(),
      "",
      "Pour retrouver vos signets ou vos préférences sur un autre appareil :",
      "ouvrez Bailly.app, page « Signets » ou « Préférences », bouton",
      "« Synchronisation » > « J'ai déjà une clé », puis saisissez ces douze",
      "mots dans l'ordre.",
      ...(link.value ? ["", "Ou ouvrez ce lien sur l'autre appareil :", link.value] : []),
      "",
      "Gardez ce document en lieu sûr : qui possède ces mots peut lire et",
      "modifier vos signets et vos préférences.",
      "",
      "La copie en ligne est effacée après 18 mois sans aucune synchronisation",
      "(vos appareils gardent la leur).",
      "",
    ].join("\n");

    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bailly-cle-de-synchronisation.txt";
    anchor.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  };

  /**
   * Whether the words have just been copied (shown for a moment).
   */
  const copied = ref(false);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  const copyWords = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(words.value.join(" "));
      copied.value = true;
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => {
        copied.value = false;
      }, 2_000);
      toast.add({ title: "Clé copiée", icon: "i-lucide-circle-check", color: "success" });
    } catch {
      toast.add({ title: "La clé n'a pas pu être copiée.", icon: "i-lucide-circle-alert", color: "error" });
    }
  };

  const canShare = import.meta.client && typeof navigator.share === "function";
  const shareWords = async (): Promise<void> => {
    try {
      await navigator.share({ title: "Clé de synchronisation de Bailly.app", text: numberedWords() });
    } catch {
      // Cancelled.
    }
  };

  /* Status. */

  const now = useNow({ interval: 30_000 });
  const relativeTime = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

  /**
   * When the latest synchronization happened, e.g. « il y a 5 minutes » (the
   * date beyond a day), updated as time goes by.
   */
  const lastSync = computed((): string | null => {
    if (!lastSyncedAt.value) return null;
    const minutes = Math.round((now.value.getTime() - lastSyncedAt.value) / 60_000);
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return relativeTime.format(-minutes, "minute");
    if (minutes < 24 * 60) return relativeTime.format(-Math.round(minutes / 60), "hour");
    return `le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(lastSyncedAt.value)}`;
  });

  /**
   * Whether a synchronization has been running for a moment: the short ones
   * (most of them) don't change the state shown.
   */
  const syncingShown = ref(false);
  let syncingTimer: ReturnType<typeof setTimeout> | undefined;
  watch(status, (value) => {
    clearTimeout(syncingTimer);
    if (value === "syncing") {
      syncingTimer = setTimeout(() => {
        syncingShown.value = true;
      }, 400);
    } else {
      syncingShown.value = false;
    }
  });

  onBeforeUnmount(() => {
    clearTimeout(syncingTimer);
  });

  /**
   * The outcome of a synchronization asked by the user, shown on its button:
   * running (at least a moment, even when it is quick), then done or failed
   * for a moment.
   */
  const manualSync = ref<"idle" | "running" | "done" | "failed">("idle");
  let manualSyncTimer: ReturnType<typeof setTimeout> | undefined;

  const syncNow = async (): Promise<void> => {
    clearTimeout(manualSyncTimer);
    manualSync.value = "running";
    const [ok] = await Promise.all([
      syncStore.sync({ force: true }),
      new Promise((resolve) => {
        setTimeout(resolve, 600);
      }),
    ]);
    manualSync.value = ok ? "done" : "failed";
    manualSyncTimer = setTimeout(() => {
      manualSync.value = "idle";
    }, 2_000);
  };

  onBeforeUnmount(() => {
    clearTimeout(manualSyncTimer);
  });

  /**
   * What stopping the synchronization concerns: this device only, or every
   * device (the locker is then deleted from the server).
   */
  const stopScope = ref<"device" | "everywhere">("device");

  /**
   * Whether this device synchronizes the other type of data too (it goes on
   * when the window's is stopped on this device).
   */
  const otherEnabled = computed(() => (props.scope === "bookmarks" ? syncedPreferences.value.length > 0 : syncedBookmarks.value));

  const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

  /**
   * What the locker holds, as last read (the deletion deletes it all).
   */
  const onlineData = computed((): string => {
    const bookmarks = remoteSections.value.includes("bookmarks") || syncedBookmarks.value;
    const preferences = remoteSections.value.includes("preferences") || syncedPreferences.value.length > 0;
    if (bookmarks && preferences) return "vos signets et vos préférences";
    return preferences ? "vos préférences" : "vos signets";
  });

  const stopItems = computed(() => [
    {
      value: "device",
      label: "Sur cet appareil seulement",
      description: otherEnabled.value ? `${texts.value.stopDeviceKept} ${texts.value.otherStays}` : texts.value.stopDevice,
    },
    {
      value: "everywhere",
      label: "Sur tous vos appareils",
      description: `${onlineData.value === "vos préférences" ? "Vos préférences sont supprimées" : `${capitalize(onlineData.value)} sont supprimés`} du serveur, et la synchronisation s'arrête sur tous vos appareils. Chacun d'eux garde ses données. Utile aussi si quelqu'un a pu voir votre clé : réactivez ensuite la synchronisation, avec une nouvelle clé.`,
    },
  ]);

  /**
   * Stops the synchronization on this device; for every device, a second
   * confirmation is asked first (the online copy is deleted).
   */
  const stop = (): void => {
    if (stopScope.value === "device") void disable();
    else view.value = "delete";
  };

  const disable = () => run(async () => {
    const other = otherEnabled.value;
    await syncStore.disable(props.scope);
    toast.add({
      title: other ? texts.value.disabled : "Synchronisation désactivée sur cet appareil",
      icon: "i-lucide-circle-check",
      color: "success",
    });
    view.value = "intro";
  });

  // Each opening starts from the state of the synchronization (declared last:
  // it runs at once when the window is created open, e.g. from a link).
  watch(open, (isOpen) => {
    if (!isOpen) return;
    joinText.value = "";
    joinError.value = null;
    actionError.value = null;
    linkKey.value = props.linkSecret ?? null;
    stopScope.value = "device";
    chosenPreferences.value = syncedPreferences.value.length ? [...syncedPreferences.value] : [...DEFAULT_SYNCED_PREFERENCES];
    view.value = linkKey.value ? "join" : scopeEnabled.value ? "status" : "intro";
  }, { immediate: true });

  const deleteRemote = async (): Promise<void> => {
    busy.value = true;
    try {
      const result = await syncStore.deleteRemote();
      if (result.state === "error") {
        toast.add({ title: result.message, icon: "i-lucide-circle-alert", color: "error" });
        return;
      }
      toast.add({ title: "Données supprimées du serveur", icon: "i-lucide-circle-check", color: "success" });
      view.value = "intro";
    } finally {
      busy.value = false;
    }
  };
</script>

<template>
  <UModal
    v-model:open="open"
    :title="titles[view]"
    :ui="{ footer: 'justify-end flex-wrap' }"
  >
    <template #body>
      <div class="space-y-4 text-sm">
        <UAlert
          v-if="!supported"
          color="warning"
          variant="subtle"
          icon="i-lucide-shield-alert"
          title="La synchronisation demande une connexion sécurisée (https)."
        />

        <!-- Not enabled -->
        <template v-else-if="view === 'intro'">
          <UAlert
            v-if="actionError ?? scopedError"
            :color="actionError ? 'error' : 'warning'"
            variant="subtle"
            :icon="actionError ? 'i-lucide-circle-alert' : 'i-lucide-info'"
            :title="actionError ?? scopedError ?? undefined"
          />
          <p>
            {{ texts.intro }}
          </p>
          <p v-if="!enabled">
            Une <strong>clé de douze mots</strong> relie vos appareils. {{ texts.encrypted }} : sans la clé,
            personne ne peut les lire, pas même Bailly.app.
          </p>

          <!-- The preferences to synchronize. -->
          <UCheckboxGroup
            v-if="scope === 'preferences'"
            :model-value="chosenPreferences"
            :items="preferenceItems"
            :ui="preferencesUi"
            legend="Préférences à synchroniser"
            @update:model-value="(keys) => setPreferences(keys as SyncablePreference[])"
          />

          <!-- The key already synchronizes the other type: this one is added. -->
          <button
            v-if="enabled"
            type="button"
            class="flex w-full items-start gap-3 rounded-lg bg-primary/10 p-4 text-start ring-1 ring-primary/25 transition-colors hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-75"
            :disabled="busy"
            @click="addScope"
          >
            <UIcon
              :name="busy ? 'i-lucide-loader-circle' : 'i-lucide-cloud-upload'"
              class="mt-0.5 size-6 shrink-0 text-primary"
              :class="{ 'animate-spin': busy }"
            />
            <span>
              <span class="block font-semibold text-highlighted">{{ texts.add }}</span>
              <span class="mt-1 block text-muted">{{ texts.addDescription }}</span>
            </span>
          </button>

          <!--
            The two ways in, as tiles: each explains itself, and is large and
            apart enough not to be touched for the other.
          -->
          <div
            v-else
            class="grid gap-4 sm:grid-cols-2"
          >
            <button
              type="button"
              class="flex items-start gap-3 rounded-lg bg-primary/10 p-4 text-start ring-1 ring-primary/25 transition-colors hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-75"
              :disabled="busy"
              @click="enable"
            >
              <UIcon
                :name="busy ? 'i-lucide-loader-circle' : 'i-lucide-cloud-upload'"
                class="mt-0.5 size-6 shrink-0 text-primary"
                :class="{ 'animate-spin': busy }"
              />
              <span>
                <span class="block font-semibold text-highlighted">Activer la synchronisation</span>
                <span class="mt-1 block text-muted">Première fois : une clé est créée pour cet appareil et vos
                  autres appareils.</span>
              </span>
            </button>
            <button
              type="button"
              class="flex items-start gap-3 rounded-lg bg-secondary/10 p-4 text-start ring-1 ring-secondary/25 transition-colors hover:bg-secondary/15 focus-visible:outline-2 focus-visible:outline-secondary disabled:opacity-75"
              :disabled="busy"
              @click="view = 'join'"
            >
              <UIcon
                name="i-lucide-key-round"
                class="mt-0.5 size-6 shrink-0 text-secondary"
              />
              <span>
                <span class="block font-semibold text-highlighted">J'ai déjà une clé</span>
                <span class="mt-1 block text-muted">Déjà activée sur un autre appareil : saisissez sa clé ou
                  scannez son QR code.</span>
              </span>
            </button>
          </div>

          <p class="flex gap-2 text-muted">
            <UIcon
              name="i-lucide-calendar-clock"
              class="mt-0.5 size-4 shrink-0"
            />
            <span>La copie en ligne est effacée après 18 mois sans aucune synchronisation.</span>
          </p>
        </template>

        <!-- Join -->
        <template v-else-if="view === 'join'">
          <p v-if="sameKey && scopeEnabled">
            Cet appareil est déjà synchronisé avec la clé de ce lien.
          </p>
          <p v-else-if="sameKey">
            Cet appareil synchronise déjà {{ scope === "bookmarks" ? "ses préférences" : "ses signets" }} avec la clé de ce
            lien. {{ texts.addDescription }}
          </p>
          <p v-else-if="linkKey">
            Activer la synchronisation sur cet appareil avec la clé de ce lien ? {{ texts.joined }}
          </p>
          <p v-else>
            {{ texts.joined }}
          </p>
          <UAlert
            v-if="enabled && !sameKey"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Cet appareil est déjà synchronisé avec une autre clé."
            description="Ses données seront désormais synchronisées avec la nouvelle clé."
          />
          <form
            v-if="!linkKey"
            id="sync-join"
            class="space-y-2"
            @submit.prevent="join"
          >
            <UFormField
              label="Les douze mots de votre clé"
              help="Dans l'ordre, séparés par des espaces. Accents et majuscules sont facultatifs ; les 4 premières lettres de chaque mot suffisent."
              :error="joinError ?? actionError ?? (unknownWord ? `« ${unknownWord} » n'est pas un mot de la liste.` : undefined)"
            >
              <!--
                Once the key is ready, the key drawn at the bottom right says
                that Enter sends it (a hint, not a button: the form's button
                is there; always there, transparent until then, so that the
                text keeps its width).
              -->
              <UTextarea
                v-model="joinText"
                :rows="3"
                autoresize
                autocomplete="off"
                autocapitalize="none"
                spellcheck="false"
                :enterkeyhint="keyReady ? 'go' : 'enter'"
                class="w-full"
                :ui="{ base: 'text-base md:text-sm', trailing: 'items-end pointer-events-none' }"
                @keydown.enter="onJoinEnter"
              >
                <template #trailing>
                  <UKbd
                    value="enter"
                    size="lg"
                    aria-hidden="true"
                    data-key-ready-hint
                    class="transition-opacity"
                    :class="keyReady ? 'opacity-100' : 'opacity-0'"
                  />
                </template>
              </UTextarea>
            </UFormField>
            <p class="text-muted tabular-nums">
              {{ typedWords.length }} mot{{ typedWords.length > 1 ? "s" : "" }} sur {{ SYNC_KEY_WORD_COUNT }}
            </p>
            <!-- For screen readers, the key drawn in the field, once ready. -->
            <span
              role="status"
              class="sr-only"
            >{{ keyReady ? "Clé complète : appuyez sur Entrée pour rejoindre." : "" }}</span>
          </form>
          <UAlert
            v-if="linkKey && (joinError ?? actionError)"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="joinError ?? actionError ?? undefined"
          />
        </template>

        <!-- The key: to add a device, or to keep it -->
        <template v-else-if="view === 'key'">
          <UTabs
            v-model="keyTab"
            :items="keyTabs"
            :content="false"
            class="w-full"
          />

          <!-- Add a device: the QR code and the words, on the screen -->
          <template v-if="keyTab === 'device'">
            <p>
              Sur votre autre appareil, scannez ce QR code avec l'appareil photo, ou saisissez les douze mots
              (« Synchronisation » > « J'ai déjà une clé »).
            </p>
            <!-- Hidden until asked: whoever sees the words can read and change the bookmarks. -->
            <div
              v-if="!keyRevealed"
              class="flex flex-col items-center gap-3 rounded-md bg-elevated p-6 text-center"
            >
              <UIcon
                name="i-lucide-eye-off"
                class="size-8 text-muted"
              />
              <p>
                Qui voit ces mots peut lire et modifier vos signets et vos préférences.<br>
                Ne les affichez pas si quelqu'un peut voir votre écran.
              </p>
              <UButton
                label="Afficher la clé"
                icon="i-lucide-eye"
                @click="keyRevealed = true"
              />
            </div>
            <template v-else>
              <!-- eslint-disable vue/no-v-html -- A generated SVG. -->
              <div
                class="mx-auto size-40 overflow-hidden rounded-md"
                role="img"
                aria-label="QR code de la clé"
                v-html="qrCode"
              />
              <!-- eslint-enable vue/no-v-html -->
              <!-- A click on the words copies them (the button, for the keyboard). -->
              <div class="relative">
                <ol
                  class="grid cursor-pointer grid-cols-2 gap-x-4 gap-y-1.5 rounded-md bg-elevated p-3 pe-12 font-medium transition-colors hover:bg-accented/60 sm:grid-cols-3"
                  aria-label="Les douze mots de la clé"
                  title="Copier les mots"
                  @click="copyWords"
                >
                  <li
                    v-for="(word, i) in words"
                    :key="i"
                    class="flex gap-1.5"
                  >
                    <span class="w-5 text-right text-muted tabular-nums">{{ i + 1 }}.</span>
                    <span>{{ word }}</span>
                  </li>
                </ol>
                <UButton
                  :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
                  :aria-label="copied ? 'Mots copiés' : 'Copier les mots'"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  class="absolute end-1.5 top-1.5"
                  @click="copyWords"
                />
              </div>
            </template>
          </template>

          <!-- Keep the key: without showing it on the screen -->
          <template v-else>
            <p>
              Votre clé est une suite de <strong>douze mots</strong>, à garder dans l'ordre. Conservez-la
              <strong>hors du navigateur</strong> : elle permet de retrouver {{ texts.data }} si ce navigateur
              les efface, et d'activer la synchronisation sur vos autres appareils.
            </p>
            <div class="flex flex-col gap-2">
              <UButton
                label="Télécharger le kit de récupération"
                icon="i-lucide-file-down"
                variant="outline"
                block
                @click="downloadRecoveryKit"
              />
              <UButton
                :label="copied ? 'Clé copiée' : 'Copier la clé'"
                :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
                variant="outline"
                block
                @click="copyWords"
              />
              <UButton
                v-if="canShare"
                label="Partager"
                icon="i-lucide-share"
                variant="outline"
                block
                @click="shareWords"
              />
            </div>
          </template>

          <p class="flex gap-2 border-t border-default pt-4 text-muted">
            <UIcon
              name="i-lucide-shield-alert"
              class="mt-0.5 size-4 shrink-0"
            />
            <span>
              Quelqu'un a pu voir votre clé ? Arrêtez la synchronisation sur tous vos appareils, puis
              réactivez-la : une nouvelle clé sera créée.
            </span>
          </p>
        </template>

        <!-- Enabled -->
        <template v-else-if="view === 'status'">
          <!-- The state; a synchronization can be run at once (they are automatic). -->
          <div class="flex items-center gap-3 rounded-md bg-elevated p-3">
            <UIcon
              :name="syncingShown ? 'i-lucide-refresh-cw' : scopeError ? 'i-lucide-cloud-off' : 'i-lucide-cloud-check'"
              class="size-6 shrink-0"
              :class="[syncingShown && 'animate-spin motion-reduce:animate-none', scopeError ? 'text-warning' : 'text-success']"
            />
            <div class="min-w-0 grow">
              <p class="font-semibold">
                {{ syncingShown ? "Synchronisation en cours…" : scopeError ? "Synchronisation en attente" : texts.upToDate }}
              </p>
              <p class="text-muted">
                Synchronisation activée sur cet appareil.
                <template v-if="lastSync">
                  Dernière synchronisation : {{ lastSync }}.
                </template>
              </p>
            </div>
            <UTooltip :text="manualSync === 'done' ? 'Synchronisé' : 'Synchroniser maintenant'">
              <UButton
                :icon="manualSync === 'done' ? 'i-lucide-check' : manualSync === 'failed' ? 'i-lucide-circle-alert' : 'i-lucide-refresh-cw'"
                aria-label="Synchroniser maintenant"
                :color="manualSync === 'done' ? 'success' : manualSync === 'failed' ? 'warning' : 'neutral'"
                variant="ghost"
                :loading="manualSync === 'running'"
                :disabled="status === 'syncing' && manualSync !== 'running'"
                @click="syncNow"
              />
            </UTooltip>
            <!-- The outcome, for screen readers. -->
            <span
              class="sr-only"
              role="status"
            >{{ manualSync === "done" ? texts.synced : manualSync === "failed" ? "La synchronisation n'a pas abouti." : "" }}</span>
          </div>
          <UAlert
            v-if="scopeError && error"
            color="warning"
            variant="subtle"
            icon="i-lucide-cloud-off"
            :title="error"
            :description="errorNeedsAction ? undefined : 'Vos modifications seront envoyées dès que possible.'"
          />
          <UAlert
            v-if="clockWrong"
            color="warning"
            variant="subtle"
            icon="i-lucide-clock-alert"
            :title="`L'horloge de cet appareil semble ${clockSkew > 0 ? 'en retard' : 'en avance'} de ${clockGap}.`"
            description="Réglez sa date et son heure : sinon, ses changements ou ceux de vos autres appareils pourraient être ignorés."
          />
          <UAlert
            v-if="actionError"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="actionError"
          />
          <!-- The preferences synchronized, changed at once. -->
          <UCheckboxGroup
            v-if="scope === 'preferences'"
            :model-value="chosenPreferences"
            :items="preferenceItems"
            :ui="preferencesUi"
            legend="Préférences synchronisées"
            :disabled="busy"
            @update:model-value="(keys) => setPreferences(keys as SyncablePreference[])"
          />
          <p class="text-muted">
            {{ texts.status }}
          </p>
        </template>

        <!-- Stop: on this device only, or everywhere -->
        <template v-else-if="view === 'stop'">
          <URadioGroup
            v-model="stopScope"
            :items="stopItems"
            variant="card"
            legend="Arrêter la synchronisation"
            :ui="{ legend: 'sr-only', fieldset: 'gap-2' }"
          />
          <UAlert
            v-if="stopScope === 'device' && scopeError"
            color="warning"
            variant="subtle"
            icon="i-lucide-cloud-off"
            title="La dernière synchronisation n'a pas abouti."
            description="Les changements faits sur cet appareil depuis ne seront pas envoyés à vos autres appareils."
          />
        </template>

        <!-- Stop everywhere: the second confirmation -->
        <template v-else-if="view === 'delete'">
          <ul class="list-disc space-y-1.5 ps-5">
            <li>La copie en ligne de {{ onlineData }} sera effacée, sans retour possible.</li>
            <li>La synchronisation s'arrêtera sur tous vos appareils, et cette clé ne pourra plus servir.</li>
            <li>Chaque appareil garde ses données.</li>
          </ul>
        </template>
      </div>
    </template>

    <template
      v-if="supported && view !== 'intro'"
      #footer
    >
      <template v-if="view === 'join'">
        <UButton
          :label="linkKey ? 'Annuler' : 'Retour'"
          color="neutral"
          variant="outline"
          @click="linkKey ? (open = false) : (view = scopeEnabled ? 'status' : 'intro')"
        />
        <UButton
          v-if="sameKey && scopeEnabled"
          label="Voir la synchronisation"
          @click="view = 'status'"
        />
        <UButton
          v-else-if="sameKey"
          :label="texts.add"
          :loading="busy"
          @click="addScope"
        />
        <UButton
          v-else-if="linkKey && enabled"
          label="Remplacer la clé"
          :loading="busy"
          @click="join"
        />
        <UButton
          v-else-if="linkKey"
          label="Activer"
          :loading="busy"
          @click="join"
        />
        <UButton
          v-else
          type="submit"
          form="sync-join"
          :label="enabled ? 'Remplacer la clé' : 'Rejoindre'"
          :loading="busy"
          :disabled="!keyReady"
        />
      </template>

      <template v-else-if="view === 'key'">
        <UButton
          :label="keyFromStatus ? 'Retour' : 'J\'ai conservé ma clé'"
          :color="keyFromStatus ? 'neutral' : 'primary'"
          :variant="keyFromStatus ? 'outline' : 'solid'"
          @click="view = 'status'"
        />
      </template>

      <template v-else-if="view === 'status'">
        <UButton
          label="Arrêter la synchronisation…"
          color="neutral"
          variant="ghost"
          class="me-auto"
          @click="view = 'stop'"
        />
        <UButton
          label="Ma clé"
          icon="i-lucide-key-round"
          @click="showKey(true, 'device')"
        />
      </template>

      <template v-else-if="view === 'stop'">
        <UButton
          label="Annuler"
          color="neutral"
          variant="outline"
          @click="view = 'status'"
        />
        <UButton
          :label="stopScope === 'device' ? 'Désactiver sur cet appareil' : 'Continuer…'"
          :loading="busy"
          @click="stop"
        />
      </template>

      <!--
        The deletion is not where "Continuer…" was: a double click can't
        confirm it.
      -->
      <template v-else-if="view === 'delete'">
        <UButton
          label="Supprimer définitivement"
          color="error"
          class="me-auto"
          :loading="busy"
          @click="deleteRemote"
        />
        <UButton
          label="Retour"
          color="neutral"
          variant="outline"
          @click="view = 'stop'"
        />
      </template>
    </template>
  </UModal>
</template>
