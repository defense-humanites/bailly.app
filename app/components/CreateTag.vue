<script setup lang="ts">
  import { IdbTags } from "~/idb";
  import { comparableTagName } from "~/idb/merge";

  // The field is the popover's anchor (cf. the template): it gets the
  // attributes.
  defineOptions({ inheritAttrs: false });

  const bookmarksStore = useBookmarksStore();
  const { newTagColor, tags } = storeToRefs(bookmarksStore);
  const hintId = useId();
  const errorId = useId();

  /**
   * A model to handle a new tag name creation.
   */
  const newTagName = defineModel<string>({ default: "" });

  /**
   * Why the last creation failed, until the name changes.
   */
  const failure = ref<string>();
  watch(newTagName, () => failure.value = undefined);

  /**
   * Why the name typed cannot be used, before Enter is pressed: taken by a tag
   * (case and diacritics ignored, as `IdbTags` does) or reserved.
   */
  /**
   * The quota of tags (cf. `utils/quotas.ts`): their number, shown at the
   * end of the field.
   */
  const { maxTags } = useRuntimeConfig().public;
  const showsQuota = computed((): boolean => quotaShown(tags.value.length, maxTags, "tags"));
  const nearQuota = computed((): boolean => quotaNear(tags.value.length, maxTags));

  const conflict = computed((): string | undefined => {
    const name = comparableTagName(newTagName.value.trim());
    if (!name) return undefined;
    if (tags.value.length >= maxTags) return `Vous avez atteint le nombre maximal d'étiquettes (${maxTags}).`;
    if (name === "favoris") return "Ce nom est réservé à la liste des favoris.";
    const homonym = tags.value.find(tag => comparableTagName(tag.name) === name);
    return homonym && `L'étiquette « ${homonym.name} » existe déjà.`;
  });

  /**
   * The error shown on the field, in a bubble under it.
   */
  const error = computed((): string | undefined => failure.value ?? conflict.value);

  const createTag = async (event: Event): Promise<void> => {
    if (!newTagName.value || error.value) return;

    const response = await bookmarksStore.createTag(
      { name: newTagName.value, color: newTagColor.value },
      { quiet: true },
    );

    if (response.state === "success") {
      newTagName.value = "";
      if (event.target instanceof HTMLInputElement) event.target.blur();
    } else {
      failure.value = response.message;
    }
  };
</script>

<template>
  <!--
    A field of the bookmarks page's menu bar (cf. `signets.vue`): square-
    cornered, without the search bar's pill shape and shadow, its background
    telling it from the bar's buttons. No submit button: Enter adds the tag
    (the return key of a touch keyboard, `enterkeyhint`), as the key drawn at
    its end says; brighter once there is a name to add.

    An error is shown where the eyes are: the field in red, an alert instead
    of the key, the message in a bubble under it (over the page: nothing
    moves), read by screen readers from a live region (the bubble is hidden
    from them). Shown as soon as the name typed is taken, and when a creation
    fails; gone once the name changes.
  -->
  <UPopover
    :open="!!error"
    :dismissible="false"
    :content="{ side: 'bottom', align: 'start', sideOffset: 6, onOpenAutoFocus: (event: Event) => event.preventDefault(), onCloseAutoFocus: (event: Event) => event.preventDefault() }"
    :ui="{ content: 'px-3 py-2 text-sm text-error' }"
  >
    <template #anchor>
      <UInput
        v-bind="$attrs"
        v-model="newTagName"
        size="xl"
        variant="soft"
        :color="error ? 'error' : 'neutral'"
        :highlight="!!error"
        placeholder="Nouvelle étiquette"
        aria-label="Nom de la nouvelle étiquette"
        :aria-describedby="`${errorId} ${hintId}`"
        :aria-invalid="!!error"
        enterkeyhint="done"
        :maxlength="IdbTags.nameMaxLength"
        :class="[FIELD_HALO, { 'outline-error/25': error }]"
        :ui="{ base: `h-full rounded-none shadow-none pe-24 focus-visible:outline-transparent max-lg:rounded-t-(--field-inner-radius) ${FIELD_BACKGROUND}`, leading: 'ps-1.5', trailing: 'gap-2 pe-3' }"
        @keydown.enter="createTag"
      >
        <!-- Color picker -->
        <template #leading>
          <!-- Its corners follow the field's (not the pill buttons'). -->
          <TagColorPicker
            v-model="newTagColor"
            label="Couleur de la nouvelle étiquette"
          >
            <template #trigger="{ icon, attrs }">
              <UButton
                :icon="icon"
                color="neutral"
                variant="outline"
                v-bind="attrs"
                :ui="{ base: 'rounded-md shadow-none' }"
              />
            </template>
          </TagColorPicker>
        </template>

        <!-- Enter adds the tag; or why it cannot -->
        <template #trailing>
          <!-- The quota: « 12/50 » (cf. the hint for screen readers). -->
          <span
            v-if="showsQuota"
            aria-hidden="true"
            class="text-xs tabular-nums"
            :class="nearQuota ? 'font-medium text-warning' : 'text-dimmed'"
          >{{ tags.length }}/{{ maxTags }}</span>
          <UIcon
            v-if="error"
            name="i-lucide-circle-alert"
            aria-hidden="true"
            class="size-5 text-error"
          />
          <UKbd
            v-else
            value="enter"
            size="lg"
            aria-hidden="true"
            class="transition-opacity"
            :class="newTagName.length ? 'opacity-100' : 'opacity-50'"
          />
          <span
            :id="hintId"
            class="sr-only"
          >Entrée pour ajouter{{ showsQuota ? ` (${tags.length} étiquette${tags.length > 1 ? "s" : ""} sur ${maxTags} au plus)` : "" }}</span>
          <span
            :id="errorId"
            role="status"
            class="sr-only"
          >{{ error }}</span>
        </template>
      </UInput>
    </template>

    <template #content>
      <p aria-hidden="true">
        {{ error }}
      </p>
    </template>
  </UPopover>
</template>
