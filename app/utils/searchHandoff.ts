/**
 * What was typed in the server's search bar (cf. `SearchBarStatic`) before
 * the page became interactive, handed to the search bar that replaces it
 * once hydrated (cf. `SearchBar`).
 */
export type SearchHandoff = {
  /** The input text, as typed (Beta Code, transliteration or Greek). */
  text: string;
  /** Where the caret was. */
  caret: number;
  /** Whether the input had the focus. */
  focused: boolean;
  /**
   * An invisible input holding the focus meanwhile: the focus moving from an
   * input to another, iOS keeps its keyboard open (it would close it if the
   * focus were lost, and not reopen it for a focus given by a script).
   */
  keeper?: HTMLInputElement;
};

let pending: SearchHandoff | undefined;

/**
 * Keeps what was typed in the server's search bar, as it is removed.
 */
export function handOffSearch(input: HTMLInputElement): void {
  const focused = document.activeElement === input;
  if (!input.value && !focused) return;

  let keeper: HTMLInputElement | undefined;
  if (focused) {
    keeper = document.createElement("input");
    keeper.setAttribute("aria-hidden", "true");
    keeper.tabIndex = -1;
    // 16px: below, iOS would zoom in on the focus.
    keeper.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0";
    document.body.append(keeper);
    keeper.focus({ preventScroll: true });
  }

  pending = { text: input.value, caret: input.selectionStart ?? input.value.length, focused, keeper };
  // Not left behind if no search bar takes it.
  setTimeout(() => takeSearchHandoff()?.keeper?.remove(), 2000);
}

/**
 * What the server's search bar handed off, once.
 */
export function takeSearchHandoff(): SearchHandoff | undefined {
  const handoff = pending;
  pending = undefined;
  return handoff;
}
