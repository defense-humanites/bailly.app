# Revision history

The current revision is set in `src/defaults.ts` (`DATABASE`), not in the environment: a new revision is deployed with the code that expects it.

1. Fixes URIs (the transliteration was inaccurate due to a forgotten `greek-conversion` option, `transliterationStyle.gammaNasal_n`).

2. Adds columns `searchableAtonic`, `searchableAtonicCaseInsensitive`.

3. Remove the initial hyphens, which prevented searching for certain particles, from `searchable*` columns.

4. Normalizes all the text columns to NFC (e.g. oxia → tonos, ano teleia → middle dot); generates the `searchable*` columns with `@humanities/bailly-search-key` (graves turned into acutes, except for τὶς; initial hyphens still removed); adds internal links to the definitions: links to a single entry, links to multiple entries (reader), and forms of the current entry (not linked, other candidates kept in `data-linked-alternatives`). Prosodic notations (quantity marks) and forms whose hyphen shape doesn't match the headword's (e.g. `νή-` ≠ νή) are never linked. URIs are unchanged.
