import { createMemo, Index, Show, type Resource, type Setter } from "solid-js";
import type { ApiLookupResponse } from "../api";
import { LocalStorageKey } from "../enums";
import HistoryList from "./HistoryList";
import DismissibleCard from "./DismissibleCard";

interface Props {
  id?: string;
  class: string;
  searchValue: string;
  // `undefined` before the first search (cf. `initialValue` in `SearchBar.tsx`).
  entries: Resource<ApiLookupResponse<"uri" | "excerpt" | "word"> | undefined>;
  setResultsOpen: Setter<boolean>;
}

export default function ResultsList(props: Props) {
  const count = createMemo(() => props.entries.latest?.count ?? -1);
  const countAll = createMemo(() => props.entries.latest?.countAll ?? -1);
  const entries = createMemo(() => props.entries.latest?.entries ?? []);

  return (
    <div
      id={props.id}
      class={`${props.class ?? ""} bg-secondary-50 shadow-2xl md:border md:border-t-0 md:border-secondary-200 md:bg-white dark:bg-neutral-900 dark:shadow-neutral-950 dark:md:border-neutral-600 md:dark:bg-neutral-800`}
      role="navigation"
      tabindex={-1}
    >
      <HistoryList
        class={`${
          props.searchValue && props.entries.latest ? "hidden" : "block"
        } p-3`}
        setResultsOpen={props.setResultsOpen}
      />

      <ul
        class={`${
          props.searchValue && props.entries.latest ? "block" : "hidden"
        } divide-y divide-secondary-100 outline-none dark:divide-neutral-700`}
      >
        <Show when={entries().some(el => el.isMorpheus)}>
          <li>
            <DismissibleCard
              class="m-3"
              content="Les résultats issus de l'analyse morphologique, signalés par une icône scintillante, peuvent être lacunaires. Gardez l'esprit critique !"
              icon="Sparkles"
              key={LocalStorageKey.DismissSearchBarMorphologicalResultsWarning}
            />
          </li>
        </Show>
        <Index each={entries()}>
          {(item) => (
            <li>
              <a
                class={`block px-3 py-3 transition duration-75 hover:bg-primary-100 dark:hover:bg-primary-900 ${
                  item().isExact &&
                  "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-200"
                }`}
                href={`/${item().uri}`}
                onClick={() => props.setResultsOpen(false)}
              >
                <Show
                  when={item().children?.length}
                  fallback={
                    <span
                      class="line-clamp-2 pl-3 -indent-3 sm:line-clamp-1 md:line-clamp-2 lg:line-clamp-1"
                      innerHTML={
                        item().isMorpheus
                          ? "✨ " + item().excerpt
                          : item().excerpt
                      }
                    />
                  }
                >
                  <span class="font-semibold">
                    {item().word}
                    {item().isMorpheus && " ✨"}
                  </span>
                  <ul class="mt-3">
                    <Index each={item().children}>
                      {(child) => (
                        <li class="mx-1.5 border-l-2 border-secondary-100 py-1.5 hover:border-primary-700 lg:py-2 dark:border-neutral-600 dark:hover:border-primary-200">
                          <a
                            class="line-clamp-2 pl-6 -indent-3 sm:line-clamp-1 md:line-clamp-2 lg:line-clamp-1 lg:pl-3 lg:indent-0"
                            href={`/${child().uri}`}
                          >
                            {child().excerpt}
                          </a>
                        </li>
                      )}
                    </Index>
                  </ul>
                </Show>
              </a>
            </li>
          )}
        </Index>

        <Show when={Number(countAll()) > Number(count())}>
          <li class="block px-3 py-3 text-center font-semibold text-primary-700 md:px-6 dark:text-primary-200">
            Veuillez préciser votre recherche pour voir plus de résultats.
          </li>
        </Show>
      </ul>
    </div>
  );
}
