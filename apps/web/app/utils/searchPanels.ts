import type { InjectionKey, Ref } from "vue";

/** The search bar's panels: its results, and its buttons' (history, options). */
export type SearchPanelName = "results" | "history" | "options";

/** A panel: whether it is in the page (open, or closing), and its closing. */
interface SearchPanel {
  present: Readonly<Ref<boolean>>;
  close: () => void;
}

/**
 * From one of the search bar's panels to another (results, history,
 * options), in their shared place below the bar: the panel open closes, its
 * animation shortened (`SWITCH_LEAVE`, cf. `[data-search-switching]` in
 * `root.css`), then, after a pause (`SWITCH_PAUSE`), the other opens, with
 * its own. Both at once, one fading out over the other fading in, the two
 * panels were mixed up; one gone at once, the page showed between them.
 */
export interface SearchPanels {
  /** Adds a panel. */
  register: (name: SearchPanelName, panel: SearchPanel) => void;
  /** Tells that a panel is gone (its closing animation ended). */
  gone: (name: SearchPanelName) => void;
  /** Whether another panel than this one is in the page. */
  othersPresent: (name: SearchPanelName) => boolean;
  /** A switch begins (a pointer down for another panel): the closings shortened. */
  markSwitch: () => void;
  /** Closes the other panels and resolves once they are gone, after the pause. */
  switchTo: (name: SearchPanelName) => Promise<void>;
}

/** The pause between a panel gone and the next one opening (ms). */
export const SWITCH_PAUSE = 60;

/** The longest wait for a panel to go (its animation lasts 100 ms at most). */
const GONE_TIMEOUT = 250;

export const searchPanelsKey: InjectionKey<SearchPanels> = Symbol("searchPanels");

/** The search bar's panels (provided by `SearchBar`, cf. `searchPanelsKey`). */
export function createSearchPanels(): SearchPanels {
  const panels = new Map<SearchPanelName, SearchPanel>();
  const waiting = new Map<SearchPanelName, (() => void)[]>();
  const root = import.meta.client ? document.documentElement : undefined;
  let switchEnd: ReturnType<typeof setTimeout> | undefined;

  const othersPresent = (name: SearchPanelName): boolean =>
    [...panels].some(([other, panel]) => other !== name && panel.present.value);

  const markSwitch = (): void => {
    if (!root) return;
    root.dataset.searchSwitching = "";
    clearTimeout(switchEnd);
    switchEnd = setTimeout(() => {
      delete root.dataset.searchSwitching;
    }, GONE_TIMEOUT + SWITCH_PAUSE);
  };

  const goneOf = (name: SearchPanelName): Promise<void> => new Promise((resolve) => {
    if (!panels.get(name)?.present.value) {
      resolve();
      return;
    }
    waiting.set(name, [...waiting.get(name) ?? [], resolve]);
    setTimeout(resolve, GONE_TIMEOUT);
  });

  return {
    register: (name, panel) => {
      panels.set(name, panel);
    },
    gone: (name) => {
      for (const resolve of waiting.get(name)?.splice(0) ?? []) resolve();
    },
    othersPresent,
    markSwitch,
    switchTo: async (name) => {
      const others = [...panels].filter(([other, panel]) => other !== name && panel.present.value);
      if (!others.length) return;
      markSwitch();
      for (const [, panel] of others) panel.close();
      await Promise.all(others.map(([other]) => goneOf(other)));
      await new Promise(resolve => setTimeout(resolve, SWITCH_PAUSE));
    },
  };
}

/**
 * A panel of the search bar's buttons (history, options), registered with
 * the bar's panels: it opens once the panel open, if any, is gone (cf.
 * `SearchPanels`). Its content tells it is gone as it unmounts (`onGone`).
 */
export function useSearchPanel(name: SearchPanelName, open: Ref<boolean>): {
  setOpen: (value: boolean) => Promise<void>;
  onGone: () => void;
} {
  const panels = inject(searchPanelsKey, undefined);
  const present = ref(false);
  watch(open, (value) => {
    if (value) present.value = true;
  });
  const close = (): void => {
    open.value = false;
  };
  panels?.register(name, { present, close });
  return {
    setOpen: async (value) => {
      if (value) await panels?.switchTo(name);
      open.value = value;
    },
    onGone: () => {
      present.value = false;
      panels?.gone(name);
    },
  };
}
