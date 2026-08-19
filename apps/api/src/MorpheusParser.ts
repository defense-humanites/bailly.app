export type PartOfSpeech =
  | "verb"
  | "participle"
  | "adverb"
  | "adjective"
  | "nominal";

export type Gender =
  | "masculine"
  | "feminine"
  | "neuter";

export type GrammaticalCase =
  | "nominative"
  | "genitive"
  | "dative"
  | "accusative"
  | "vocative";

export type GrammaticalNumber =
  | "singular"
  | "dual"
  | "plural";

export type Tense =
  | "present"
  | "imperfect"
  | "future"
  | "aorist"
  | "perfect"
  | "pluperfect"
  | "future perfect";

export type Mood =
  | "indicative"
  | "subjunctive"
  | "optative"
  | "imperative"
  | "infinitive"
  | "participle";

export type Voice =
  | "active"
  | "middle"
  | "passive"
  | "middle-passive";

export type Person =
  | "first"
  | "second"
  | "third";

export type Degree =
  | "comparative"
  | "superlative";

export type Dialect =
  | "attic"
  | "ionic"
  | "doric"
  | "aeolic"
  | "epic";

export interface Morphology {
  partOfSpeech?: PartOfSpeech;

  gender?: Gender[];
  case?: GrammaticalCase[];
  number?: GrammaticalNumber[];

  tense?: Tense;
  mood?: Mood;
  voice?: Voice;
  person?: Person;
  degree?: Degree;

  dialects?: Dialect[];
  features?: string[];

  /**
   * Tokens we don't understand yet.
   */
  unparsed?: string[];
}

export interface MorpheusStem {
  value: string;
  classes: string[];
  attributes?: string[];
}

export interface MorpheusEnding {
  value: string;
  class?: string;
}

export interface MorpheusAnalysis {
  raw?: string;
  workWord?: string;
  lemma?: string;

  prefix?: string;
  augment?: string;
  stem?: MorpheusStem;
  suffix?: string;
  ending?: MorpheusEnding;

  morphology?: Morphology;
}

export class MorpheusParser {
  static readonly #genders: Record<string, Gender> = {
    masc: "masculine",
    fem: "feminine",
    neut: "neuter"
  };

  static readonly #cases: Record<string, GrammaticalCase> = {
    nom: "nominative",
    gen: "genitive",
    dat: "dative",
    acc: "accusative",
    voc: "vocative"
  };

  static readonly #numbers: Record<string, GrammaticalNumber> = {
    sg: "singular",
    dual: "dual",
    pl: "plural"
  };

  static readonly #tenses: Record<string, Tense> = {
    pres: "present",
    imperf: "imperfect",
    fut: "future",
    aor: "aorist",
    perf: "perfect",
    plup: "pluperfect",
    futperf: "future perfect"
  };

  static readonly #moods: Record<string, Mood> = {
    ind: "indicative",
    subj: "subjunctive",
    opt: "optative",
    imperat: "imperative",
    inf: "infinitive",
    infin: "infinitive", // tolerate both
    part: "participle"
  };

  static readonly #voices: Record<string, Voice> = {
    act: "active",
    mid: "middle",
    pass: "passive",
    mp: "middle-passive"
  };

  static readonly #persons: Record<string, Person> = {
    "1st": "first",
    "2nd": "second",
    "3rd": "third"
  };

  static readonly #dialects: Record<string, Dialect> = {
    attic: "attic",
    ionic: "ionic",
    doric: "doric",
    aeolic: "aeolic",
    epic: "epic"
  };

  /**
   * A list of erroneous lemmas in stemlib and their corrections.
   * @remarks Keys format is `<lemma>|<stem>` (the lemma itself provides insufficient information).
   * @private
   */
  static readonly #lemmaCorrections = new Map<string, string>([
    ["neani/hs|nea_ni", "neani/as"]
  ]);

  readonly #fields = new Map<string, string>();

  constructor(block: string) {
    for (const line of block.split(/\r?\n/)) {
      const match = line.trim().match(/^:(\w+)\s*(.*)$/);

      if (match) {
        this.#fields.set(match[1], match[2].trim());
      }
    }
  }

  #correctLemma(lemma: string, stem: MorpheusStem): string {
    return MorpheusParser.#lemmaCorrections.get(`${lemma}|${stem.value}`) ??
      lemma;
  }

  parse(): MorpheusAnalysis {
    const ending = this.#parseEnding(this.#fields.get("end"));
    const morphology = ending.morphology;

    const stem = this.#parseStem(this.#fields.get("stem"));

    const lem = this.#get("lem") && stem
      ? this.#correctLemma(this.#get("lem"), stem)
      : undefined;

    this.#inferPartOfSpeech(
      morphology,
      stem,
      ending.value
    );

    return {
      raw: this.#get("raw"),
      workWord: this.#get("workw"),
      lemma: lem,

      prefix: this.#get("prvb"),
      augment: this.#get("aug1"),
      stem,
      suffix: this.#get("suff"),
      ending: ending.value,

      morphology
    };
  }

  #get(key: string): string | undefined {
    return this.#fields.get(key) || undefined;
  }

  #parseStem(
    raw: string | undefined
  ): MorpheusStem | undefined {
    if (!raw) return;

    const tokens = raw.split(/\s+/);

    const value = tokens.shift();
    if (!value) return;

    /*
     * In Cruncher output the final token contains the
     * inflection/stem classes:
     *
     *   hs_ou
     *   aor2_pass
     *   evw_pr,ev_stem
     */
    const classes = tokens.pop()?.split(",") ?? [];

    return {
      value,
      classes,

      ...(tokens.length > 0 && {
        attributes: tokens
      })
    };
  }

  #parseEnding(
    raw: string | undefined
  ): {
    value?: MorpheusEnding;
    morphology: Morphology;
  } {
    const morphology: Morphology = {};

    if (!raw) {
      return { morphology };
    }

    const tokens = raw.split(/\s+/);

    const value = tokens.shift();
    const inflectionClass = tokens.pop();

    if (!value) {
      return { morphology };
    }

    const unparsed: string[] = [];

    for (const token of tokens) {
      if (this.#parseMorphologyToken(token, morphology)) {
        continue;
      }

      unparsed.push(token);
    }

    if (unparsed.length) {
      morphology.unparsed = unparsed;
    }

    return {
      value: {
        value,
        class: inflectionClass
      },
      morphology
    };
  }

  #parseMorphologyToken(
    token: string,
    morphology: Morphology
  ): boolean {
    const parts = token.split("/");

    const genders = this.#mapAll(
      parts,
      MorpheusParser.#genders
    );

    if (genders) {
      morphology.gender = this.#unique([
        ...(morphology.gender ?? []),
        ...genders
      ]);

      return true;
    }

    const cases = this.#mapAll(
      parts,
      MorpheusParser.#cases
    );

    if (cases) {
      morphology.case = this.#unique([
        ...(morphology.case ?? []),
        ...cases
      ]);

      return true;
    }

    const numbers = this.#mapAll(
      parts,
      MorpheusParser.#numbers
    );

    if (numbers) {
      morphology.number = this.#unique([
        ...(morphology.number ?? []),
        ...numbers
      ]);

      return true;
    }

    if (parts.length !== 1) {
      return false;
    }

    const value = parts[0];

    const tense = MorpheusParser.#tenses[value];
    if (tense) {
      morphology.tense = tense;
      return true;
    }

    const mood = MorpheusParser.#moods[value];
    if (mood) {
      morphology.mood = mood;
      return true;
    }

    const voice = MorpheusParser.#voices[value];
    if (voice) {
      morphology.voice = voice;
      return true;
    }

    const person = MorpheusParser.#persons[value];
    if (person) {
      morphology.person = person;
      return true;
    }

    const dialect = MorpheusParser.#dialects[value];
    if (dialect) {
      morphology.dialects = this.#unique([
        ...(morphology.dialects ?? []),
        dialect
      ]);

      return true;
    }

    switch (value) {
      case "comp":
        morphology.degree = "comparative";
        return true;

      case "superl":
        morphology.degree = "superlative";
        return true;

      case "contr":
        this.#addFeature(morphology, "contracted");
        return true;

      case "unaugmented":
        this.#addFeature(morphology, "unaugmented");
        return true;

      case "poetic":
        this.#addFeature(morphology, "poetic");
        return true;

      case "adverbial":
        morphology.partOfSpeech = "adverb";
        return true;
    }

    return false;
  }

  #inferPartOfSpeech(
    morphology: Morphology,
    stem: MorpheusStem | undefined,
    ending: MorpheusEnding | undefined
  ): void {
    if (morphology.partOfSpeech) {
      return;
    }

    if (morphology.mood === "participle") {
      morphology.partOfSpeech = "participle";
      return;
    }

    if (
      morphology.tense ||
      morphology.mood ||
      morphology.voice ||
      morphology.person
    ) {
      morphology.partOfSpeech = "verb";
      return;
    }

    const classes = [
      ...(stem?.classes ?? []),
      ...(ending?.class ? [ending.class] : [])
    ];

    if (classes.some((value) => value.endsWith("_adj"))) {
      morphology.partOfSpeech = "adjective";
      return;
    }

    if (
      morphology.gender?.length ||
      morphology.case?.length
    ) {
      morphology.partOfSpeech = "nominal";
    }
  }

  #addFeature(
    morphology: Morphology,
    feature: string
  ): void {
    morphology.features = this.#unique([
      ...(morphology.features ?? []),
      feature
    ]);
  }

  #mapAll<T>(
    values: string[],
    map: Record<string, T>
  ): T[] | undefined {
    const result: T[] = [];

    for (const value of values) {
      const mapped = map[value];

      if (mapped === undefined) {
        return;
      }

      result.push(mapped);
    }

    return result;
  }

  #unique<T>(values: T[]): T[] {
    return [...new Set(values)];
  }
}
