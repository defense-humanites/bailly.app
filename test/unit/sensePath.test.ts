import { describe, expect, test } from "vitest";
import { senseAt, senseLabel, sensePath } from "~/utils/sensePath";

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

describe("senseLabel", () => {
  test("the head of the text after the number, remarks included, cut at its punctuation", () => {
    const [first, second] = definition().querySelectorAll(".rub");
    expect(senseLabel(first!)).toBe("adv. loin");
    expect(senseLabel(second!)).toBe("prép. loin de");
    const [third, fourth] = definition().querySelectorAll(".pp");
    expect(senseLabel(third!)).toBe("avec idée de lieu");
    expect(senseLabel(fourth!)).toBe("p. suite");
  });

  test("never a line further in the body: none if the sense opens on a citation", () => {
    const sense = definition().querySelectorAll(".pp")[1]!;
    sense.querySelector(".ital")!.remove();
    expect(senseLabel(sense)).toBe("");
  });

  test("past a linking word, to the gloss that follows it (ἔχω, B. III. 2.)", () => {
    const sense = document.createElement("div");
    sense.className = "pp";
    sense.innerHTML = `<span class="ppa">2</span> <span class="ital">p.
suite,</span> avoir à sa disposition, être en état de, <span class="ital">avec l’inf.</span> <span class="grec">ἔχω λέγειν</span>`;
    expect(senseLabel(sense)).toBe("p. suite, avoir à sa disposition");
  });

  test("not the signs between the citations (καί, C. III. 6.)", () => {
    const sense = document.createElement("div");
    sense.className = "pp";
    sense.innerHTML = `<span class="ppa">6</span> <span class="ital">avec
des mots invariables : adverbes :</span> <span class="grec">κἀθέως</span> = <span class="grec">καὶ ἀθέως,</span>
<span class="aut">Soph.</span> <span class="refch">354 ;</span> <span class="grec">κἄτι</span> =
<span class="grec">καὶ ἔτι,</span> <span class="aut">Soph.</span> <span class="refch">272</span>).`;
    expect(senseLabel(sense)).toBe("avec des mots invariables");
  });
});

describe("sensePath", () => {
  test("the outer senses' numbers, the inner one's label", () => {
    expect(sensePath(definition().querySelectorAll(".pp")[0]!)).toEqual([
      { number: "II.", label: "" },
      { number: "1.", label: "avec idée de lieu" },
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
