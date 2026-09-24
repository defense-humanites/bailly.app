// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(
  {
    files: ["**/*.ts", "**/*.vue"],
    rules: {
      // Numbers are safe to interpolate (e.g. in error messages).
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    files: ["**/*.vue"],
    rules: {
      // Keep the `<script>` content of SFCs indented by one level.
      "@stylistic/indent": "off",
      "vue/script-indent": ["error", 2, { baseIndent: 1, switchCase: 1 }],
      // French typography relies on (narrow) non-breaking spaces.
      "no-irregular-whitespace": "off",
      "vue/no-irregular-whitespace": ["error", { skipHTMLTextContents: true }],
    },
  },
);
