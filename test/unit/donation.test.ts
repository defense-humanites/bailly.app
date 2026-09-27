import { expect, test } from "vitest";
import { donationThanks } from "../../app/utils/donation";

test("donationThanks", () => {
  expect(donationThanks({ st: "Completed", amt: "10.00", cc: "EUR" })).toBe("Merci pour votre don de 10,00 € !");
  expect(donationThanks({ st: "Completed" })).toBe("Merci pour votre don !");
  expect(donationThanks({ st: "Completed", amt: "abc", cc: "EUR" })).toBe("Merci pour votre don !");
  expect(donationThanks({ st: "Pending", amt: "10.00", cc: "EUR" })).toBe("Merci ! Votre don est en cours de traitement par PayPal.");
});
