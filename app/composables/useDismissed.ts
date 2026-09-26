import { StorageKey } from "~/enums";

/**
 * Whether the user dismissed a notice (e.g. `morpheusWarning`), stored in
 * the local storage with the other dismissed notices.
 * @remarks Read on the client only: for notices that the server doesn't render.
 */
export function useDismissed(id: string): WritableComputedRef<boolean> {
  const dismissed = useLocalStorage<string[]>(StorageKey.Dismissed, [], { writeDefaults: false });

  return computed({
    get: () => dismissed.value.includes(id),
    set: (value: boolean) => {
      const others = dismissed.value.filter(item => item !== id);
      dismissed.value = value ? [...others, id] : others;
    },
  });
}
