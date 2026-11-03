// Plain objects rather than `enum`s: Node.js runs the TypeScript sources by stripping
// their types, which leaves no room for the code an `enum` generates.

export const SpecialChar = {
  explicitStart: "^",
  explicitEnd: "$",
  singleWildcard: "?",
  wildcard: "*"
} as const;
