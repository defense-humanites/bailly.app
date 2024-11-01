import { assertEquals } from "jsr:@std/assert";
import { describe } from "jsr:@std/testing/bdd";
import { app } from "../src/index.ts";
import { Settings } from "../src/Settings.ts";

const settings = Settings.getSettings();

type TestCase = {
  path: string;
  status: number;
  data: {};
};

const returnedValue = (props: {}): {} => {
  return {
    data: {
      version: settings.dbVersion,
      ...props
    }
  };
};

const entryPath = (q?: string): string => `/entry/${q ? q : ""}`;

describe("GET /entry", () => {
  const testCases: TestCase[] = [
    {
      path: entryPath(),
      status: 404,
      data: {}
    },
    {
      path: entryPath("anêr"),
      status: 200,
      data: {
        entry: {
          word: "ἀνήρ",
          uri: "anêr",
          excerpt:
            "ἀνήρ (ὁ) [ᾰ, mais v. ci-dessous] (voc. ἄνερ, gén. etc. ἀνδρός, ἀνδρί, ἄνδρα ; pl. ἄνδρες, ἀνδρῶν, ἀνδράσι, ἄνδρας ; duel ἄνδρε, ἀνδροῖν) litt. celui …"
        },
        siblings: {}
      }
    },
    {
      path: entryPath("anêr?fields=word"),
      status: 200,
      data: {
        entry: {
          word: "ἀνήρ"
        },
        siblings: {}
      }
    },
    {
      path: entryPath("anêr?siblings"),
      status: 200,
      data: {
        entry: {
          word: "ἀνήρ",
          uri: "anêr",
          excerpt:
            "ἀνήρ (ὁ) [ᾰ, mais v. ci-dessous] (voc. ἄνερ, gén. etc. ἀνδρός, ἀνδρί, ἄνδρα ; pl. ἄνδρες, ἀνδρῶν, ἀνδράσι, ἄνδρας ; duel ἄνδρε, ἀνδροῖν) litt. celui …"
        },
        siblings: {
          next: {
            word: "ἀνήρεικτος",
            uri: "anêreiktos",
            excerpt: "ἀν·ήρεικτος, c. ἀνέρεικτος, Gal. Lex. Hipp. 19, 81."
          },
          previous: {
            word: "ἀνηπύω",
            uri: "anêpuô",
            excerpt:
              "ἀν·ηπύω [ῠ, A. Rh. 4, 1197 ; ῡ, Mosch. 2, 98] (seul. prés. et impf.) dire à haute voix, crier. Étym. ἀνά, ἠπυώ. "
          }
        }
      }
    },
    {
      path: entryPath("anêr?fields=word&siblings"),
      status: 200,
      data: {
        entry: {
          word: "ἀνήρ"
        },
        siblings: {
          next: {
            word: "ἀνήρεικτος"
          },
          previous: {
            word: "ἀνηπύω"
          }
        }
      }
    },
    {
      path: entryPath("nonexistent"),
      status: 200,
      data: {
        entry: {},
        siblings: {}
      }
    }
  ];

  for (const tc of testCases) {
    Deno.test(`GET ${tc.path}`, async () => {
      const response = await app.request(tc.path);
      assertEquals(response.status, tc.status);
      if (tc.status !== 404) {
        const json = await response.json();
        assertEquals(json, returnedValue(tc.data));
      }
    });
  }
});
