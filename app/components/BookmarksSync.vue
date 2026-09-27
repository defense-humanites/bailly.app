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
   * The name under which password managers save the key.
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

  const enable = async (): Promise<void> => {
    busy.value = true;
    try {
      await syncStore.enable();
      await showKey();
    } finally {
      busy.value = false;
    }
  };

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

  const join = async (): Promise<void> => {
    busy.value = true;
    joinError.value = null;
    try {
      const result = await syncStore.join(props.linkSecret ?? typedWords.value);
      if (result.state === "error") {
        joinError.value = result.message;
        return;
      }
      toast.add({ title: "Synchronisation activée", icon: "i-lucide-circle-check", color: "success" });
      view.value = "status";
    } finally {
      busy.value = false;
    }
  };

  /**
   * Replaces the key of this device by the key of a link.
   */
  const replaceKey = async (): Promise<void> => {
    await syncStore.disable();
    await join();
  };

  /* The key, outside of the browser. */

  const link = computed(() => (import.meta.client ? syncStore.link(window.location.origin) : null));
  const qrCode = computed(() => (view.value === "key" && link.value
    ? renderSVG(link.value, { border: 2, ecc: "M", whiteColor: "#fff", blackColor: "#000" })
    : ""));

  const numberedWords = (): string =>
    words.value.map((word, i) => `${String(i + 1).padStart(2, " ")}. ${word}`).join("\n");

  /**
   * Chrome's API to save credentials (absent from the DOM types).
   */
  type PasswordCredentialConstructor = new (data: { id: string; password: string; name?: string }) => Credential;

  /**
   * Offers to save the key in the password manager: the form's submission
   * (the browsers' cue), and Chrome's API.
   */
  const saveToPasswordManager = async (): Promise<void> => {
    const PasswordCredential = (window as unknown as { PasswordCredential?: PasswordCredentialConstructor }).PasswordCredential;
    if (PasswordCredential) {
      try {
        await navigator.credentials.store(new PasswordCredential({
          id: CREDENTIAL_NAME,
          password: words.value.join(" "),
          name: "Clé de synchronisation de Bailly.app",
        }));
      } catch {
        // Refused, or unavailable: the form's submission remains.
      }
    }
    toast.add({
      title: "Enregistrement proposé au navigateur",
      description: "Si votre gestionnaire de mots de passe ne l'a pas proposé, copiez la clé ou téléchargez le kit de récupération.",
      icon: "i-lucide-key-round",
    });
  };

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

  const copyWords = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(words.value.join(" "));
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

  const disable = async (): Promise<void> => {
    await syncStore.disable();
    toast.add({ title: "Synchronisation désactivée sur cet appareil", icon: "i-lucide-circle-check", color: "success" });
    view.value = "intro";
  };

  // Each opening starts from the state of the synchronization (declared last:
  // it runs at once when the window is created open, e.g. from a link).
  watch(open, (isOpen) => {
    if (!isOpen) return;
    joinText.value = "";
    joinError.value = null;
    view.value = props.linkSecret ? "join" : enabled.value ? "status" : "intro";
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
            v-if="error"
            color="warning"
            variant="subtle"
            icon="i-lucide-info"
            :title="error"
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
          <template v-if="linkSecret">
            <p>
              Activer la synchronisation sur cet appareil avec la clé de ce lien ? Vos signets de cet appareil
              et ceux de vos autres appareils seront réunis.
            </p>
            <UAlert
              v-if="enabled"
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              title="Cet appareil est déjà synchronisé avec une autre clé."
              description="Ses signets seront désormais synchronisés avec la nouvelle clé."
            />
          </template>
          <form
            v-else
            id="sync-join"
            class="space-y-2"
            @submit.prevent="join"
          >
            <UFormField
              :label="`Les ${SYNC_KEY_WORD_COUNT} mots de votre clé`"
              help="Dans l'ordre, séparés par des espaces. Accents et majuscules sont facultatifs ; les 4 premières lettres de chaque mot suffisent."
              :error="joinError ?? (unknownWord ? `« ${unknownWord} » n'est pas un mot de la liste.` : undefined)"
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
            v-if="linkSecret && joinError"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="joinError"
          />
        </template>

        <!-- The key -->
        <template v-else-if="view === 'key'">
          <p>
            Conservez cette clé <strong>hors du navigateur</strong> : elle permet d'activer la synchronisation
            sur vos autres appareils, et de retrouver vos signets si ce navigateur les efface.
          </p>
          <ol
            class="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md bg-elevated p-3 font-medium sm:grid-cols-3"
            aria-label="Les 12 mots de la clé"
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
            <!--
              A form with a login and a password: submitting it is the cue for
              the browsers to offer to save the key in their password manager.
            -->
            <form
              class="contents"
              @submit.prevent="saveToPasswordManager"
            >
              <input
                type="text"
                name="username"
                autocomplete="username"
                :value="CREDENTIAL_NAME"
                readonly
                tabindex="-1"
                aria-hidden="true"
                class="sr-only"
              >
              <input
                type="password"
                name="password"
                autocomplete="new-password"
                :value="words.join(' ')"
                readonly
                tabindex="-1"
                aria-hidden="true"
                class="sr-only"
              >
              <UButton
                type="submit"
                label="Enregistrer dans le gestionnaire de mots de passe"
                icon="i-lucide-key-round"
                variant="outline"
                block
              />
            </form>
            <UButton
              label="Télécharger le kit de récupération"
              icon="i-lucide-file-down"
              variant="outline"
              block
              @click="downloadRecoveryKit"
            />
            <div class="flex gap-2">
              <UButton
                label="Copier les mots"
                icon="i-lucide-copy"
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
          </div>
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
            synchronisation, il faudra la clé.
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
          :label="linkSecret ? 'Annuler' : 'Retour'"
          color="neutral"
          variant="outline"
          @click="linkSecret ? (open = false) : (view = enabled ? 'status' : 'intro')"
        />
        <UButton
          v-if="linkSecret && enabled"
          label="Remplacer la clé"
          :loading="busy"
          @click="replaceKey"
        />
        <UButton
          v-else-if="linkSecret"
          label="Activer"
          :loading="busy"
          @click="join"
        />
        <UButton
          v-else
          type="submit"
          form="sync-join"
          label="Rejoindre"
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
          @click="syncStore.sync()"
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
