/**
 * Makes all the properties of `T` optional, except `K`.
 */
export type PartialExcept<T, K extends keyof T> = Pick<T, K>
  & Partial<Omit<T, K>>;
