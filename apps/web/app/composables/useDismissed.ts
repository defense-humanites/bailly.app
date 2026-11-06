import { StorageKey } from "~/enums";
import { IdbPreferences } from "~/idb";
import type { NoticeId } from "~/utils/notices";

/**
 * Whether the user dismissed a notice (one of the register, cf.
 * `utils/notices.ts`, e.g. `morpheusWarning`), stored in
 * the local storage with the other dismissed notices, and recorded to be
 * synchronized with the preferences (cf. `isDismissedRecord`): a notice
 * dismissed is so on every device.
 * @remarks Read on the client only: for notices that the server doesn't render.
 */
export function useDismissed(id: NoticeId): WritableComputedRef<boolean> {
  const dismissed = useLocalStorage<string[]>(StorageKey.Dismissed, [], { writeDefaults: false });

  return computed({
    get: () => dismissed.value.includes(id),
    set: (value: boolean) => {
      const others = dismissed.value.filter(item => item !== id);
      dismissed.value = value ? [...others, id] : others;
      if (value) {
        // (Dismissed here whatever happens; not recorded if IndexedDB fails.)
        void IdbPreferences.recordDismissed([id]).then(() => {
          useSyncStore().noticeDismissed();
        }).catch((e: unknown) => {
          console.error(e);
        });
      }
    },
  });
}
