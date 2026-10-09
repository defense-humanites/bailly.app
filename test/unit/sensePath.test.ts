import { describe, expect, test } from "vitest";
import { entryOutline, outlineWorthy, senseAt, senseLabel, sensePath } from "~/utils/sensePath";

/** ἑκάς, its markup as the API gives it (shortened). */
const HEKAS = `<span class="entreea"><span class="grec">ἑκάς,</span></span> <span class="ital">att.</span>
<div class="rub"><span class="ruba">I</span> <span class="ital">adv.</span> loin, au loin, <span class="aut">Eur.</span>
<span class="oeuv">H.f.</span> <span class="refch">198 ;</span> non loin ||</div>
<div class="rub"><span class="ruba">II</span> <span class="ital">prép.</span> loin de, <span class="ital">gén. :</span>
<div class="pp"><span class="ppa">1</span> <span class="ital">avec
idée de lieu,</span> <span class="ital">d’ord. après son
rég.</span> <span class="grec">νηῶν ἑκάς,</span> <span class="aut">Od.</span> <span class="refch">14, 496,</span> loin des
vaisseaux ||</div>
<div class="pp"><span class="ppa">2</span> <span class="ital">p. suite,</span> <span class="grec">οὐχ ἑκὰς χρόνου,</span> <span class="aut">Hdt.</span> <span class="refch">8, 144,</span> sans tarder ||</div>
</div>`;

const definition = (): HTMLElement => {
  const element = document.createElement("div");
  element.className = "definition";
  element.innerHTML = HEKAS;
  return element;
};

/** A sense of the given markup (after its number). */
const sense = (html: string): HTMLElement => {
  const element = document.createElement("div");
  element.className = "pp";
  element.innerHTML = `<span class="ppa">1</span> ${html}`;
  return element;
};

describe("senseLabel", () => {
  test("the head after the number, remarks and glosses, up to a strong punctuation or a reference", () => {
    const [first, second] = definition().querySelectorAll(".rub");
    expect(senseLabel(first!)).toBe("adv. loin, au loin");
    expect(senseLabel(second!)).toBe("prép. loin de");
    // καί, B.
    expect(senseLabel(sense(`<span class="ital">adv.</span> aussi, même\u00a0:
<div class="rub"><span class="ruba">I</span> aussi, de même\u00a0:</div>`))).toBe("adv. aussi, même");
  });

  test("a Greek expression closes it, with an « etc. » after it", () => {
    // καί, C. I. 7.
    expect(senseLabel(sense(`<span class="grec">καὶ
<a href="/men">μέν</a>,</span> et en outre, <span class="ital">d’ord. avec une ou
plusieurs particules\u00a0:</span> <span class="grec">καὶ μὲν δή,</span> <span class="aut">Plat.</span>`))).toBe("καὶ μέν");
    // καί, B. I. 3.
    expect(senseLabel(sense(`<span class="ital">dans
les locut.</span> <span class="grec">εἴ τις καὶ ἄλλος,</span>
<span class="ital">etc.\u202f;</span> <span class="grec">ὥς τις καὶ ἄλλος,</span>`))).toBe("dans les locut. εἴ τις καὶ ἄλλος, etc.");
    // καί, A. II. 2.: the commas within the Greek.
    expect(senseLabel(sense(`<span class="ital">dans
les locut.</span> <span class="grec">καὶ τοῦτο, καὶ ταῦτα,</span>
<span class="ital">au sens du franç.</span> « et cela »`))).toBe("dans les locut. καὶ τοῦτο, καὶ ταῦτα");
    const [, , fourth] = [...definition().querySelectorAll(".rub, .pp")];
    expect(senseLabel(fourth!)).toBe("avec idée de lieu, d’ord. après son rég. νηῶν ἑκάς");
  });

  test("past a linking word, to the gloss after it; not to a further remark", () => {
    expect(senseLabel(sense(`<span class="ital">en b. part\u00a0:</span> bonne opinion, <span class="aut">Plat.</span>`))).toBe("en b. part\u00a0: bonne opinion");
    // καί, C. III. 6.
    expect(senseLabel(sense(`<span class="ital">avec
des mots invariables : adverbes :</span> <span class="grec">κἀθέως</span> = <span class="grec">καὶ ἀθέως,</span>
<span class="aut">Soph.</span> <span class="refch">354 ;</span>`))).toBe("avec des mots invariables");
  });

  test("not past a linking word to a citation; but the headword alone", () => {
    // καί, A. I. 2.
    expect(senseLabel(sense(`<span class="ital">pour unir deux propos.\u00a0:</span> <span class="grec">ὁ ἵππος πίπτει εἰς γόνατα,</span> <span class="aut">Xén.</span>`))).toBe("pour unir deux propos.");
    // καί, C. III.
    expect(senseLabel(sense(`<span class="grec"><span data-linked-self>καί</span></span> se contracte par crase\u00a0:`))).toBe("καί se contracte par crase");
  });

  test("without the remarks ending it, after a comma", () => {
    expect(senseLabel(sense(`s’attacher à, <span class="ital">d’où\u00a0:</span>`))).toBe("s’attacher à");
    expect(senseLabel(sense(`compte qu’on fait de qqe ch., valeur qu’on leur attribue, <span class="ital">avec un gén. déterminatif</span> <span class="aut">Hdt.</span>`))).toBe("compte qu’on fait de qqe ch., valeur qu’on leur attribue");
  });

  test("none if the sense opens on a reference", () => {
    expect(senseLabel(sense(`<span class="aut">Hdt.</span> <span class="refch">8, 144,</span> sans tarder`))).toBe("");
  });
});

describe("sensePath", () => {
  test("the outer senses' numbers, the inner one's label", () => {
    expect(sensePath(definition().querySelectorAll(".pp")[0]!)).toEqual([
      { number: "II.", label: "" },
      { number: "1.", label: "avec idée de lieu, d’ord. après son rég. νηῶν ἑκάς" },
    ]);
  });

  test("none before the first sense", () => {
    expect(sensePath(null)).toEqual([]);
  });
});

describe("senseAt", () => {
  const at = (tops: number[], line: number): number => {
    const senses = tops.map(top => ({ getBoundingClientRect: () => ({ top }) }) as Element);
    return senses.indexOf(senseAt(senses, line)!);
  };

  test("the last sense whose top has passed the line", () => {
    expect(at([-400, -20, 30, 300], 40)).toBe(2);
    expect(at([-400, -20, 30, 300], 0)).toBe(1);
  });

  test("none above the first one", () => {
    expect(at([100, 300], 40)).toBe(-1);
  });
});

describe("entryOutline", () => {
  test("the senses with their numbers, labels and levels", () => {
    const items = entryOutline(definition());
    expect(items.map(({ number, label, depth, parent }) => [number, label, depth, parent])).toEqual([
      ["I.", "adv. loin, au loin", 0, -1],
      ["II.", "prép. loin de", 0, -1],
      ["1.", "avec idée de lieu, d’ord. après son rég. νηῶν ἑκάς", 1, 1],
      ["2.", "p. suite, οὐχ ἑκὰς χρόνου", 1, 1],
    ]);
    // An outline if an item starts out of the first screen; none otherwise.
    expect(outlineWorthy(items, element => element.textContent.includes("prép."))).toBe(true);
    expect(outlineWorthy(items, () => false)).toBe(false);
    expect(outlineWorthy(items.slice(0, 1), () => true)).toBe(false);
  });

  test("a group of homonyms: each with its senses under it", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div class="definition"><span class="entreea"><span class="grec">ἡ,</span></span>
<div class="pp"><span class="ppa">1</span> article</div></div>
<div class="definition"><span class="entreea"><span class="grec">ἤ,</span></span> ou</div>
<div class="definition"><span class="entreea"><span class="grec">ἧ,</span></span>
<div class="pp"><span class="ppa">1</span> où</div><div class="pp"><span class="ppa">2</span> comme</div></div>`;
    const items = entryOutline(root);
    expect(items.map(({ number, label, depth, sense }) => [number, label, depth, sense])).toEqual([
      ["", "ἡ", 0, false],
      ["1.", "article", 1, true],
      ["", "ἧ", 0, false],
      ["1.", "où", 1, true],
      ["2.", "comme", 1, true],
    ]);
    expect(outlineWorthy(items, element => element.textContent.includes("comme"))).toBe(true);
  });
});

test("the sections opened by a label (« Moy. »): a step of the path, their senses under them", () => {
  const root = document.createElement("div");
  root.className = "definition";
  root.innerHTML = `<div class="Rub"><span class="Ruba">A</span> porter</div>
<div class="sect"><span class="secta">Moy.</span> <span class="grec"><span data-linked-self>ἔχομαι</span></span> (<span class="ital">f.</span> ἕξομαι) :
<div class="Rub"><span class="Ruba">A</span> porter <div class="rub"><span class="ruba">I</span> porter sur soi</div></div></div>`;
  expect(sensePath(root.querySelector(".sect .rub"))).toEqual([
    { number: "Moy.", label: "" },
    { number: "A.", label: "" },
    { number: "I.", label: "porter sur soi" },
  ]);
  expect(entryOutline(root).map(({ number, label, depth }) => [number, label, depth])).toEqual([
    ["A.", "porter", 0],
    ["Moy.", "ἔχομαι", 0],
    ["A.", "porter", 1],
    ["I.", "porter sur soi", 2],
  ]);
});

test("an arrow's note holding senses (the other forms of ὁ): a step of the path, its senses under it", () => {
  const root = document.createElement("div");
  root.className = "definition";
  root.innerHTML = `<div class="rub"><span class="ruba">I</span> article</div>
<div class="fleche"><span class="flechea">E</span> Att. ἕκας, Dysc.</div>
<div class="fleche"><span class="flechea">E</span> <span class="ital">Formes poét. et dialect.\u00a0:</span>
<div class="pp"><span class="ppa">1</span> <span class="ital">formes épq.</span></div></div>`;
  expect(entryOutline(root).map(({ number, arrow, label, depth }) => [number, !!arrow, label, depth])).toEqual([
    ["I.", false, "article", 0],
    ["", true, "Formes poét. et dialect.", 0],
    ["1.", false, "formes épq.", 1],
  ]);
  expect(sensePath(root.querySelector(".fleche .pp"))).toEqual([
    { number: "", arrow: true, label: "" },
    { number: "1.", label: "formes épq." },
  ]);
});
