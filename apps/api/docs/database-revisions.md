# Revision history

The current revision is set in `src/defaults.ts` (`DATABASE`), not in the environment: a new revision is deployed with the code that expects it.

1. Fixes URIs (the transliteration was inaccurate due to a forgotten `greek-conversion` option, `transliterationStyle.gammaNasal_n`).

2. Adds columns `searchableAtonic`, `searchableAtonicCaseInsensitive`.

3. Remove the initial hyphens, which prevented searching for certain particles, from `searchable*` columns.

4. Normalizes all the text columns to NFC (e.g. oxia → tonos, ano teleia → middle dot); generates the `searchable*` columns with `@humanities/bailly-search-key` (graves turned into acutes, except for τὶς; initial hyphens still removed); adds internal links to the definitions: links to a single entry, links to multiple entries (reader), and forms of the current entry (not linked, other candidates kept in `data-linked-alternatives`). Prosodic notations (quantity marks) and forms whose hyphen shape doesn't match the headword's (e.g. `νή-` ≠ νή) are never linked. URIs are unchanged.

5. Derived data for the lookups, produced by `scripts/db_derive.ts` from revision 4 (the text columns are unchanged): the rows out of index order per search column (`bailly_unordered`), the counts of the prefixes of 1 to 4 letters (`bailly_prefix_count`), the reversed search keys (`reversedSearchable*`, indexed) and the length of the definitions (`definitionLength`, indexed). The API still runs on a database without them (every lookup then reads and sorts every match).

6. Adds `bailly_form(form, uris)`, produced by `scripts/db_derive.ts` (step 5) from revision 5: the forms linked to several entries in the definitions (`span[data-linked-entries]`, 7 569 forms), with their URIs, for `GET /form/:form` (the front end's page of a form). Every form has the same URIs wherever it is linked. The other tables are unchanged: into a D1 database holding revision 5, `pnpm run d1:export --tables=bailly_form` gives the only statements to import. Without the table, `GET /form/:form` looks every form up as a whole word.
