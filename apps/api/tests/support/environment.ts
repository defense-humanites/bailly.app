/** The settings of the tests (cf. `src/Settings.ts`), the same on every platform. */
export const TEST_ENVIRONMENT = {
  API_ENV: "development",
  QUERY_ALLOWED_FIELDS: "word,uri,htmlDefinition,definition,htmlExcerpt,excerpt",
  QUERY_DEFAULT_FIELDS: "word,uri,excerpt",
  QUERY_MAX_BATCH_SIZE: "-1",
  QUERY_MAX_ROWS: "-1"
} as const;
