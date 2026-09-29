<script setup lang="ts">
  import { renderSVG } from "uqr";

  const open = defineModel<boolean>("open", { default: false });

  const props = defineProps<{
    /**
     * A key received through a link (`/signets#sync=…`), to join.
     */
    linkSecret?: Uint8Array<ArrayBuffer> | null;
  }>();

  type View = "intro" | "join" | "key" | "status" | "stop" | "delete";

  /**
   * The number of words of a key (cf. `~/sync/key`, loaded only to join: it
   * contains the list of words).
   */
  const SYNC_KEY_WORD_COUNT = 12;

  const syncStore = useSyncStore();
  const { enabled, status, error, errorNeedsAction, clockWrong, clockSkew, lastSyncedAt, supported } = storeToRefs(syncStore);

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

  const titles: Record<View, string> = {
    intro: "Synchroniser vos signets",
    join: "Rejoindre la synchronisation",
    key: "Votre clé de synchronisation",
    status: "Synchronisation des signets",
    stop: "Arrêter la synchronisation ?",
    delete: "Supprimer les signets en ligne ?",
  };

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
      actionError.value = "Une erreur inattendue est survenue. Vos signets restent sur cet appareil.";
    } finally {
      busy.value = false;
    }
  };

  const enable = () => run(async () => {
    const result = await syncStore.enable();
    if (result.state === "error") {
      actionError.value = result.message;
      return;
    }
    await showKey();
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
   * The first word typed that is not in the list (the last one only once
   * followed by another).
   */
  const unknownWord = computed(() => {
    const module = keyModule.value;
    if (!module) return null;
    const complete = /\s$/.test(joinText.value) ? typedWords.value : typedWords.value.slice(0, -1);
    return complete.find(word => !module.resolveWord(word)) ?? null;
  });

  /**
   * Whether the key of the link is already this device's.
   */
  /**
   * The key of the link, while it has not been used: once joined (or once
   * the user goes elsewhere in the window), "J'ai déjà une clé" asks for the
   * words.
   */
  const linkKey = shallowRef<Uint8Array<ArrayBuffer> | null>(null);

  watch(view, (value) => {
    if (value !== "join") linkKey.value = null;
  });

  const sameKey = computed(() => Boolean(linkKey.value && enabled.value && syncStore.hasKey(linkKey.value)));

  /**
   * Joins with the words typed or the key of the link (which replaces this
   * device's key, if any, once the first synchronization succeeded).
   */
  const join = () => run(async () => {
    joinError.value = null;
    const result = await syncStore.join(linkKey.value ?? typedWords.value);
    if (result.state === "error") {
      joinError.value = result.message;
      return;
    }
    linkKey.value = null;
    toast.add({
      title: "Synchronisation activée",
      // The key is valid, but the server had emptied its locker.
      description: result.data.emptied
        ? "Faute d'activité, le serveur avait effacé vos signets en ligne : ceux de cet appareil les remplacent. Vos autres appareils y ajouteront les leurs à leur prochaine synchronisation."
        : undefined,
      icon: "i-lucide-circle-check",
      color: "success",
      duration: result.data.emptied ? 15_000 : undefined,
    });
    view.value = "status";
  });

  /* The key, outside of the browser. */

  const link = computed(() => (import.meta.client ? syncStore.link(window.location.origin) : null));
  const qrCode = computed(() => (view.value === "key" && link.value
    ? renderSVG(link.value, { border: 2, ecc: "M", whiteColor: "#fff", blackColor: "#000" })
    : ""));

  const numberedWords = (): string =>
    words.value.map((word, i) => `${String(i + 1).padStart(2, " ")}. ${word}`).join("\n");

  const downloadRecoveryKit = (): void => {
    const text = [
      "Bailly.app — clé de synchronisation des signets",
      "",
      numberedWords(),
      "",
      "Pour retrouver vos signets sur un autre appareil : ouvrez Bailly.app, page",
      "« Signets », bouton « Synchronisation » > « J'ai déjà une clé », puis",
      "saisissez ces douze mots dans l'ordre.",
      ...(link.value ? ["", "Ou ouvrez ce lien sur l'autre appareil :", link.value] : []),
      "",
      "Gardez ce document en lieu sûr : qui possède ces mots peut lire et",
      "modifier vos signets.",
      "",
      "La copie en ligne de vos signets est effacée après 18 mois sans aucune",
      "synchronisation (vos appareils gardent la leur).",
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
   * device (the bookmarks are then deleted from the server).
   */
  const stopScope = ref<"device" | "everywhere">("device");

  const stopItems = [
    {
      value: "device",
      label: "Sur cet appareil seulement",
      description: "Vos signets restent sur cet appareil, et en ligne pour vos autres appareils. Pour réactiver la synchronisation, il faudra la clé : les signets en ligne seront alors rétablis sur cet appareil, même ceux que vous y auriez supprimés entre-temps.",
    },
    {
      value: "everywhere",
      label: "Sur tous vos appareils",
      description: "Vos signets sont supprimés du serveur, et la synchronisation s'arrête sur tous vos appareils. Chacun d'eux garde ses signets. Utile aussi si quelqu'un a pu voir votre clé : réactivez ensuite la synchronisation, avec une nouvelle clé.",
    },
  ];

  /**
   * Stops the synchronization on this device; for every device, a second
   * confirmation is asked first (the online copy is deleted).
   */
  const stop = (): void => {
    if (stopScope.value === "device") void disable();
    else view.value = "delete";
  };

  const disable = () => run(async () => {
    await syncStore.disable();
    toast.add({ title: "Synchronisation désactivée sur cet appareil", icon: "i-lucide-circle-check", color: "success" });
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
    view.value = linkKey.value ? "join" : enabled.value ? "status" : "intro";
  }, { immediate: true });

  const deleteRemote = async (): Promise<void> => {
    busy.value = true;
    try {
      const result = await syncStore.deleteRemote();
      if (result.state === "error") {
        toast.add({ title: result.message, icon: "i-lucide-circle-alert", color: "error" });
        return;
      }
      toast.add({ title: "Signets supprimés du serveur", icon: "i-lucide-circle-check", color: "success" });
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
            v-if="actionError ?? error"
            :color="actionError ? 'error' : 'warning'"
            variant="subtle"
            :icon="actionError ? 'i-lucide-circle-alert' : 'i-lucide-info'"
            :title="actionError ?? error ?? undefined"
          />
          <p>
            Retrouvez vos signets sur tous vos appareils (ordinateur, téléphone…), sans créer de compte.
          </p>
          <p>
            Une <strong>clé de douze mots</strong> relie vos appareils. Vos signets sont chiffrés sur l'appareil
            avant d'être envoyés : sans la clé, personne ne peut les lire, pas même Bailly.app.
          </p>
          <p class="text-muted">
            La copie en ligne est effacée après 18 mois sans aucune synchronisation.
          </p>
        </template>

        <!-- Join -->
        <template v-else-if="view === 'join'">
          <p v-if="sameKey">
            Cet appareil est déjà synchronisé avec la clé de ce lien.
          </p>
          <p v-else-if="linkKey">
            Activer la synchronisation sur cet appareil avec la clé de ce lien ? Vos signets de cet appareil
            et ceux de vos autres appareils seront réunis.
          </p>
          <p v-else>
            Vos signets de cet appareil et ceux de vos autres appareils seront réunis.
          </p>
          <UAlert
            v-if="enabled && !sameKey"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Cet appareil est déjà synchronisé avec une autre clé."
            description="Ses signets seront désormais synchronisés avec la nouvelle clé."
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
              <UTextarea
                v-model="joinText"
                :rows="3"
                autoresize
                autocomplete="off"
                autocapitalize="none"
                spellcheck="false"
                class="w-full"
                :ui="{ base: 'text-base md:text-sm' }"
              />
            </UFormField>
            <p class="text-muted tabular-nums">
              {{ typedWords.length }} mot{{ typedWords.length > 1 ? "s" : "" }} sur {{ SYNC_KEY_WORD_COUNT }}
            </p>
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
                Qui voit ces mots peut lire et modifier vos signets.<br>
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
              <strong>hors du navigateur</strong> : elle permet de retrouver vos signets si ce navigateur les
              efface, et d'activer la synchronisation sur vos autres appareils.
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
              :name="syncingShown ? 'i-lucide-refresh-cw' : status === 'error' ? 'i-lucide-cloud-off' : 'i-lucide-cloud-check'"
              class="size-6 shrink-0"
              :class="[syncingShown && 'animate-spin motion-reduce:animate-none', status === 'error' ? 'text-warning' : 'text-success']"
            />
            <div class="min-w-0 grow">
              <p class="font-semibold">
                {{ syncingShown ? "Synchronisation en cours…" : status === "error" ? "Synchronisation en attente" : "Signets à jour" }}
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
            >{{ manualSync === "done" ? "Signets synchronisés." : manualSync === "failed" ? "La synchronisation n'a pas abouti." : "" }}</span>
          </div>
          <UAlert
            v-if="status === 'error' && error"
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
          <p class="text-muted">
            Pour retrouver vos signets sur un autre appareil (téléphone, tablette…), ajoutez-le avec votre clé.
            Pensez aussi à la sauvegarder hors du navigateur.
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
            v-if="stopScope === 'device' && status === 'error'"
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
            <li>La copie en ligne de vos signets sera effacée, sans retour possible.</li>
            <li>La synchronisation s'arrêtera sur tous vos appareils, et cette clé ne pourra plus servir.</li>
            <li>Chaque appareil garde ses signets.</li>
          </ul>
        </template>
      </div>
    </template>

    <template
      v-if="supported"
      #footer
    >
      <!--
        The two ways in, apart and as visible: a new key, or the key of
        another device.
      -->
      <template v-if="view === 'intro'">
        <UButton
          label="J'ai déjà une clé"
          icon="i-lucide-key-round"
          color="secondary"
          class="justify-center max-sm:w-full sm:me-auto"
          @click="view = 'join'"
        />
        <UButton
          label="Activer la synchronisation"
          icon="i-lucide-refresh-cw"
          class="justify-center max-sm:w-full"
          :loading="busy"
          @click="enable"
        />
      </template>

      <template v-else-if="view === 'join'">
        <UButton
          :label="linkKey ? 'Annuler' : 'Retour'"
          color="neutral"
          variant="outline"
          @click="linkKey ? (open = false) : (view = enabled ? 'status' : 'intro')"
        />
        <UButton
          v-if="sameKey"
          label="Voir la synchronisation"
          @click="view = 'status'"
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
          :disabled="typedWords.length !== SYNC_KEY_WORD_COUNT"
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
