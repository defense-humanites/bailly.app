import { expect, test } from "vitest";
import { donationThanks } from "../../app/utils/donation";

test("donationThanks", () => {
  expect(donationThanks({ st: "Completed", amt: "10.00", cc: "EUR" })).toBe("Merci pour votre don de 10,00 €\u202f!");
  expect(donationThanks({ st: "Completed" })).toBe("Merci pour votre don\u202f!");
  expect(donationThanks({ st: "Completed", amt: "abc", cc: "EUR" })).toBe("Merci pour votre don\u202f!");
  expect(donationThanks({ st: "Pending", amt: "10.00", cc: "EUR" })).toBe("Merci\u202f! Votre don est en cours de traitement par PayPal.");
});
