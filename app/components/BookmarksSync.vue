<script setup lang="ts">
  import { renderSVG } from "uqr";

  const open = defineModel<boolean>("open", { default: false });

  const props = defineProps<{
    /**
     * A key received through a link (`/signets#sync=…`), to join.
     */
    linkSecret?: Uint8Array<ArrayBuffer> | null;
  }>();

  type View = "intro" | "join" | "key" | "status" | "disable" | "delete";

  /**
   * The number of words of a key (cf. `~/sync/key`, loaded only to join: it
   * contains the list of words).
   */
  const SYNC_KEY_WORD_COUNT = 12;

  const syncStore = useSyncStore();
  const { enabled, status, error, lastSyncedAt, supported } = storeToRefs(syncStore);
  const toast = useToast();

  const view = ref<View>("intro");
  const words = ref<string[]>([]);
  const busy = ref(false);

  /**
   * The name suggested for the key in a password manager.
   * @remarks The key is not saved there by the page: the browsers only save
   * what the user types in a login form (Chrome's `PasswordCredential` does
   * not prompt reliably either). The user copies the words instead.
   */
  const CREDENTIAL_NAME = "Bailly.app (synchronisation des signets)";

  const showKey = async (): Promise<void> => {
    words.value = await syncStore.words();
    view.value = "key";
  };

  const titles: Record<View, string> = {
    intro: "Synchroniser vos signets",
    join: "Rejoindre la synchronisation",
    key: "Votre clé de synchronisation",
    status: "Synchronisation des signets",
    disable: "Désactiver la synchronisation sur cet appareil ?",
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
    toast.add({ title: "Synchronisation activée", icon: "i-lucide-circle-check", color: "success" });
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
      "« Signets », menu « Sauvegarde des signets » > « Synchroniser… » >",
      "« J'ai déjà une clé », puis saisissez ces 12 mots dans l'ordre.",
      ...(link.value ? ["", "Ou ouvrez ce lien sur l'autre appareil :", link.value] : []),
      "",
      "Gardez ce document en lieu sûr : qui possède ces mots peut lire et",
      "modifier vos signets.",
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

  const lastSync = computed(() => (lastSyncedAt.value
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(lastSyncedAt.value)
    : null));

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
            Une <strong>clé de 12 mots</strong> relie vos appareils. Vos signets sont chiffrés sur l'appareil
            avant d'être envoyés : sans la clé, personne ne peut les lire, pas même Bailly.app.
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
              :label="`Les ${SYNC_KEY_WORD_COUNT} mots de votre clé`"
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

        <!-- The key -->
        <template v-else-if="view === 'key'">
          <p>
            Conservez cette clé <strong>hors du navigateur</strong> : elle permet d'activer la synchronisation
            sur vos autres appareils, et de retrouver vos signets si ce navigateur les efface.
          </p>
          <!-- A click on the words copies them (the button, for the keyboard). -->
          <div class="relative">
            <ol
              class="grid cursor-pointer grid-cols-2 gap-x-4 gap-y-1.5 rounded-md bg-elevated p-3 pe-12 font-medium transition-colors hover:bg-accented/60 sm:grid-cols-3"
              aria-label="Les 12 mots de la clé"
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

          <div class="flex items-center gap-4">
            <!-- eslint-disable vue/no-v-html -- A generated SVG. -->
            <div
              class="size-28 shrink-0 overflow-hidden rounded-md"
              role="img"
              aria-label="QR code de la clé"
              v-html="qrCode"
            />
            <!-- eslint-enable vue/no-v-html -->
            <p class="text-muted">
              Sur votre téléphone, scannez ce code avec l'appareil photo : la synchronisation s'y activera.
            </p>
          </div>

          <div class="flex flex-col gap-2">
            <UButton
              label="Télécharger le kit de récupération"
              icon="i-lucide-file-down"
              variant="outline"
              block
              @click="downloadRecoveryKit"
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
          <p class="text-muted">
            Pour la garder dans votre gestionnaire de mots de passe, copiez les mots et collez-les dans une
            nouvelle entrée (identifiant : « {{ CREDENTIAL_NAME }} »).
          </p>
        </template>

        <!-- Enabled -->
        <template v-else-if="view === 'status'">
          <p class="flex items-center gap-2">
            <UIcon
              :name="status === 'syncing' ? 'i-lucide-refresh-cw' : status === 'error' ? 'i-lucide-cloud-off' : 'i-lucide-cloud-check'"
              class="size-5 shrink-0"
              :class="[status === 'syncing' && 'animate-spin', status === 'error' ? 'text-warning' : 'text-success']"
            />
            <span>
              Synchronisation activée sur cet appareil.
              <span
                v-if="lastSync"
                class="text-muted"
              >Dernière synchronisation : {{ lastSync }}.</span>
            </span>
          </p>
          <UAlert
            v-if="status === 'error' && error"
            color="warning"
            variant="subtle"
            icon="i-lucide-cloud-off"
            :title="error"
            description="Vos modifications seront envoyées dès que possible."
          />
        </template>

        <template v-else-if="view === 'disable'">
          <p>
            Vos signets restent sur cet appareil, et en ligne pour vos autres appareils. Pour réactiver la
            synchronisation, il faudra la clé : les signets en ligne seront alors rétablis sur cet appareil,
            même ceux que vous y auriez supprimés entre-temps.
          </p>
        </template>

        <template v-else-if="view === 'delete'">
          <p>
            Vos signets seront supprimés du serveur et la synchronisation s'arrêtera sur tous vos appareils.
            Chacun d'eux garde ses signets.
          </p>
        </template>
      </div>
    </template>

    <template
      v-if="supported"
      #footer
    >
      <template v-if="view === 'intro'">
        <UButton
          label="J'ai déjà une clé"
          variant="outline"
          @click="view = 'join'"
        />
        <UButton
          label="Activer la synchronisation"
          icon="i-lucide-refresh-cw"
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
          label="J'ai conservé ma clé"
          @click="view = 'status'"
        />
      </template>

      <template v-else-if="view === 'status'">
        <UButton
          label="Supprimer les signets en ligne"
          color="error"
          variant="ghost"
          class="me-auto"
          @click="view = 'delete'"
        />
        <UButton
          label="Désactiver"
          color="neutral"
          variant="outline"
          @click="view = 'disable'"
        />
        <UButton
          label="Afficher ma clé"
          variant="outline"
          @click="showKey"
        />
        <UButton
          label="Synchroniser"
          icon="i-lucide-refresh-cw"
          :loading="status === 'syncing'"
          @click="syncStore.sync({ force: true })"
        />
      </template>

      <template v-else-if="view === 'disable'">
        <UButton
          label="Annuler"
          color="neutral"
          variant="outline"
          @click="view = 'status'"
        />
        <UButton
          label="Désactiver"
          :loading="busy"
          @click="disable"
        />
      </template>

      <template v-else-if="view === 'delete'">
        <UButton
          label="Annuler"
          color="neutral"
          variant="outline"
          @click="view = 'status'"
        />
        <UButton
          label="Supprimer"
          color="error"
          :loading="busy"
          @click="deleteRemote"
        />
      </template>
    </template>
  </UModal>
</template>
