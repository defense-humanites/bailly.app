import { describe, expect, it } from "vitest";
import { apiHostFor } from "../../app/utils/apiHost";

describe("apiHostFor", () => {
  it("reaches an API on localhost at the page's host name, from another device", () => {
    expect(apiHostFor("http://localhost:4321/_api", "192.168.1.20")).toBe("http://192.168.1.20:4321/_api");
    expect(apiHostFor("http://127.0.0.1:3000", "mac.local")).toBe("http://mac.local:3000");
    expect(apiHostFor("http://localhost:3000/", "192.168.1.20")).toBe("http://192.168.1.20:3000/");
  });

  it("leaves it as it is on the machine itself", () => {
    expect(apiHostFor("http://localhost:4321/_api", "localhost")).toBe("http://localhost:4321/_api");
    expect(apiHostFor("http://localhost:4321/_api", "127.0.0.1")).toBe("http://localhost:4321/_api");
  });

  it("leaves a remote API as it is", () => {
    expect(apiHostFor("https://api.bailly.app", "192.168.1.20")).toBe("https://api.bailly.app");
  });
});
