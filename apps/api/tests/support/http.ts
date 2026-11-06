/** The JSON body of a response, untyped (as Deno's `Response.json()` gave it). */
// deno-lint-ignore no-explicit-any
export const json = (response: Response): Promise<any> => response.json();
