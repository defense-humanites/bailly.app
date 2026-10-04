<script setup lang="ts">
  import { convert } from "@humanities/greek-conversion";

  /**
   * The correspondence of the Greek letters with the two input modes (cf.
   * `utils/searchInput.ts`), computed by the library the search uses, so
   * that it can't drift from it: Beta Code (its capitals marked by an
   * asterisk, their diacritics before the letter), and the transliteration, with its usual variants
   * (the circumflex for the long vowels, y for upsilon).
   */
  const NAMES = [
    "alpha", "bêta", "gamma", "delta", "epsilon", "zêta", "êta", "thêta", "iota", "kappa", "lambda", "mu",
    "nu", "xi", "omicron", "pi", "rhô", "sigma", "tau", "upsilon", "phi", "khi", "psi", "ôméga",
  ];
  const VARIANTS: Record<string, string> = { η: "ê", ω: "ô", υ: "y" };

  const letters = Array.from("αβγδεζηθικλμνξοπρστυφχψω", greek => greek).map((greek, index) => ({
    name: NAMES[index]!,
    greek: `${greek.toUpperCase()} ${greek}${greek === "σ" ? " ς" : ""}`,
    betaCode: convert(greek, "greek", "beta-code"),
    transliteration: [convert(greek, "greek", "transliteration"), VARIANTS[greek]].filter(Boolean).join(", "),
  }));

  /**
   * The diacritics, in Beta Code (typed after their letter); the
   * transliteration ignores them, but for the rough breathing, an initial h.
   */
  const diacritics = [
    { name: "Esprit doux", betaCode: ")", example: "a) → ἀ" },
    { name: "Esprit rude", betaCode: "(", example: "a( → ἁ" },
    { name: "Accent aigu", betaCode: "/", example: "a/ → ά" },
    { name: "Accent grave", betaCode: "\\", example: "a\\ → ὰ" },
    { name: "Accent circonflexe", betaCode: "=", example: "a= → ᾶ" },
    { name: "Iota souscrit", betaCode: "|", example: "a| → ᾳ" },
    { name: "Tréma", betaCode: "+", example: "i+ → ϊ" },
  ];

  const examples = [
    { betaCode: "a)/nqrwpos", greek: "ἄνθρωπος", transliteration: "anthrôpos" },
    { betaCode: "ci/fos", greek: "ξίφος", transliteration: "xiphos" },
    { betaCode: "yuxh/", greek: "ψυχή", transliteration: "psuchê" },
    { betaCode: "o(do/s", greek: "ὁδός", transliteration: "hodos" },
    { betaCode: "*(h/ra", greek: "Ἥρα", transliteration: "Hêra" },
  ];
</script>

<!--
  The table of the input modes (cf. the preferences' « Saisie »): the
  letters, the diacritics of the Beta Code, and examples. The Greek in the
  dictionary's font.
-->
<template>
  <div class="space-y-6 text-sm">
    <table class="w-full table-fixed text-center">
      <caption class="sr-only">
        Les lettres grecques en beta code et en translittération
      </caption>
      <thead>
        <tr class="text-muted">
          <th
            scope="col"
            class="pb-2 text-start font-medium"
          >
            Lettre
          </th>
          <th
            scope="col"
            class="pb-2 font-medium"
          >
            Grec
          </th>
          <th
            scope="col"
            class="pb-2 font-medium"
          >
            Beta code
          </th>
          <th
            scope="col"
            class="pb-2 font-medium"
          >
            <!-- Abbreviated on a phone (the column is narrow). -->
            <abbr
              title="Translittération"
              class="no-underline sm:hidden"
            >Translit.</abbr>
            <span class="max-sm:hidden">Translittération</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="letter in letters"
          :key="letter.name"
          class="odd:bg-elevated/60"
        >
          <th
            scope="row"
            class="rounded-s-md py-1 ps-2 text-start font-normal text-muted"
          >
            {{ letter.name }}
          </th>
          <td
            lang="grc"
            class="py-1 font-serif text-base"
          >
            {{ letter.greek }}
          </td>
          <td class="py-1">
            {{ letter.betaCode }}
          </td>
          <td class="rounded-e-md py-1">
            {{ letter.transliteration }}
          </td>
        </tr>
      </tbody>
    </table>

    <p class="text-muted">
      En beta code, une majuscule se marque d'un astérisque (*a → Α) ; le
      sigma final (ς) est placé de lui-même. En translittération, un h initial
      note l'esprit rude (hodos → ὁδος).
    </p>

    <section aria-labelledby="conversion-diacritiques">
      <h3
        id="conversion-diacritiques"
        class="mb-2 font-semibold"
      >
        Signes diacritiques (beta code)
      </h3>
      <p class="mb-2 text-muted">
        Facultatifs, ils se tapent après la lettre ; pour une majuscule, avant
        elle, après l'astérisque (*)/a → Ἄ).
      </p>
      <table class="w-full table-fixed">
        <tbody>
          <tr
            v-for="diacritic in diacritics"
            :key="diacritic.name"
            class="odd:bg-elevated/60"
          >
            <th
              scope="row"
              class="rounded-s-md py-1 ps-2 text-start font-normal"
            >
              {{ diacritic.name }}
            </th>
            <td class="py-1 text-center">
              {{ diacritic.betaCode }}
            </td>
            <td
              lang="grc"
              class="rounded-e-md py-1 text-center font-serif text-base"
            >
              {{ diacritic.example }}
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section aria-labelledby="conversion-exemples">
      <h3
        id="conversion-exemples"
        class="mb-2 font-semibold"
      >
        Exemples
      </h3>
      <table class="w-full table-fixed text-center">
        <thead>
          <tr class="text-muted">
            <th
              scope="col"
              class="pb-2 font-medium"
            >
              Beta code
            </th>
            <th
              scope="col"
              class="pb-2 font-medium"
            >
              Grec
            </th>
            <th
              scope="col"
              class="pb-2 font-medium"
            >
              <abbr
                title="Translittération"
                class="no-underline sm:hidden"
              >Translit.</abbr>
              <span class="max-sm:hidden">Translittération</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="example in examples"
            :key="example.greek"
            class="odd:bg-elevated/60"
          >
            <td class="rounded-s-md py-1">
              {{ example.betaCode }}
            </td>
            <td
              lang="grc"
              class="py-1 font-serif text-base"
            >
              {{ example.greek }}
            </td>
            <td class="rounded-e-md py-1">
              {{ example.transliteration }}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
