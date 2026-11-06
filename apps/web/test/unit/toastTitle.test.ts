import { describe, expect, it } from "vitest";
import { toastTitle } from "~/utils/toastTitle";

describe("toastTitle", () => {
  it("drops a final period", () => {
    expect(toastTitle("La clé n'a pas pu être copiée.")).toBe("La clé n'a pas pu être copiée");
  });

  it("keeps the other marks, and a title without a period", () => {
    expect(toastTitle("Recherche…")).toBe("Recherche…");
    expect(toastTitle("Arrêter la synchronisation ?")).toBe("Arrêter la synchronisation ?");
    expect(toastTitle("Clé copiée")).toBe("Clé copiée");
  });
});
