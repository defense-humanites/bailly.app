/**
 * Search keys of the Bailly, shared with the data converter.
 *
 * Provisional: `@humanities/bailly-search-key` is only published on JSR, which npm
 * cannot reach; its sources are copied under `src/vendor/` until it is published on
 * npm (then: `export … from "@humanities/bailly-search-key"` and delete the copy).
 */
export {
  toBaillySearchKey,
  toSearchKey
} from "./vendor/bailly-search-key/mod.ts";
