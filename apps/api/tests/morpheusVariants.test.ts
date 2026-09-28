import { assertEquals } from "@std/assert";
import {
  buildBreathingVariants,
  capitalize,
  getCrasis,
  hasInitialRoughBreathing,
  removeAccents
} from "../src/Morpheus.ts";

/*
 * Forms submitted to Morpheus when diacritics and/or case are ignored (cf.
 * `Morpheus.lookup()`). libmorpheus' `IgnoreAccents` option does not cover:
 *   - the breathings: a form without breathing is read as smooth;
 *   - the accents and iota subscripts that are present: they are then required.
 * Without `StrictCase`, a capital is lowercased, but never the reverse.
 */

Deno.test("buildBreathingVariants: initial vowel", () => {
  assertEquals(buildBreathingVariants("ων"), ["ὠν", "ὡν"]);
  assertEquals(buildBreathingVariants("ης"), ["ἠς", "ἡς"]);
  assertEquals(buildBreathingVariants("Ος"), ["Ὀς", "Ὁς"]);
});

Deno.test("buildBreathingVariants: the typed breathing is replaced", () => {
  assertEquals(buildBreathingVariants("ὡν"), ["ὠν", "ὡν"]);
  assertEquals(buildBreathingVariants("ἑων"), ["ἐων", "ἑων"]);
});

Deno.test("buildBreathingVariants: accents are kept", () => {
  assertEquals(buildBreathingVariants("ῶν"), ["ὦν", "ὧν"]);
});

Deno.test("buildBreathingVariants: diphthongs take the breathing on their 2nd vowel", () => {
  assertEquals(buildBreathingVariants("ου"), ["οὐ", "οὑ"]);
  assertEquals(buildBreathingVariants("αυτος"), ["αὐτος", "αὑτος"]);
  assertEquals(buildBreathingVariants("Αυτος"), ["Αὐτος", "Αὑτος"]);
  assertEquals(buildBreathingVariants("υιος"), ["υἰος", "υἱος"]);
  assertEquals(buildBreathingVariants("οὗ"), ["οὖ", "οὗ"]);
});

Deno.test("buildBreathingVariants: a diaeresis prevents the diphthong", () => {
  assertEquals(buildBreathingVariants("αϊδης"), ["ἀϊδης", "ἁϊδης"]);
});

Deno.test("buildBreathingVariants: initial rho takes a rough breathing only", () => {
  assertEquals(buildBreathingVariants("ρημα"), ["ῥημα"]);
});

Deno.test("buildBreathingVariants: initial consonant, unchanged", () => {
  assertEquals(buildBreathingVariants("λογος"), ["λογος"]);
});

Deno.test("buildBreathingVariants: NFC output", () => {
  for (const variant of buildBreathingVariants("ων".normalize("NFD"))) {
    assertEquals(variant, variant.normalize("NFC"));
  }
});

Deno.test("removeAccents: accents and iota subscripts only", () => {
  assertEquals(removeAccents("ᾧ"), "ὡ");
  assertEquals(removeAccents("λόγῳ"), "λογω");
  assertEquals(removeAccents("Διὸς"), "Διος");
  // Breathings and diaereses are kept (they position the breathing variants).
  assertEquals(removeAccents("ἀΐδιος"), "ἀϊδιος");
});

Deno.test("capitalize: diacritics stay on the capital", () => {
  assertEquals(capitalize("διος"), "Διος");
  assertEquals(capitalize("ὡν"), "Ὡν");
  // `toUpperCase()` alone would give ὯΙ.
  assertEquals(capitalize("ᾧ"), "ᾯ");
  assertEquals(capitalize("Λογος"), "Λογος");
});

Deno.test("hasInitialRoughBreathing: initial vowel or diphthong", () => {
  assertEquals(hasInitialRoughBreathing("ἁνα"), true);
  assertEquals(hasInitialRoughBreathing("Ἁνα"), true);
  assertEquals(hasInitialRoughBreathing("οὑμος"), true);
  assertEquals(hasInitialRoughBreathing("ἅνα"), true);
  assertEquals(hasInitialRoughBreathing("ἀνα"), false);
  assertEquals(hasInitialRoughBreathing("ανα"), false);
  assertEquals(hasInitialRoughBreathing("ἀνὴρ ἁ"), false);
});

Deno.test("getCrasis: the two words of a crasis reading, in Greek", () => {
  assertEquals(getCrasis({ crasis: "w)=", workword: "a)gaqe/" }), {
    first: "ὦ",
    second: "ἀγαθέ"
  });
  assertEquals(getCrasis({ crasis: "kai/", workword: "e)gw/" }), {
    first: "καί",
    second: "ἐγώ"
  });
  // Quantity marks are removed.
  assertEquals(getCrasis({ crasis: "ta/", workword: "a)/lla_" }), {
    first: "τά",
    second: "ἄλλα"
  });
  assertEquals(getCrasis({ crasis: "", workword: "a)na/" }), undefined);
});
