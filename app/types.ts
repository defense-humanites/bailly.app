export type Entries<T> = { [K in keyof T]: [K, T[K]] }[keyof T][];

export type NonEmptyArray<T> = [T, ...T[]];

export type Optional<T, K extends keyof T> = { [P in K]?: T[K] };

export type OptionalKeysOf<Obj> = keyof {
  [Key in keyof Obj as Omit<Obj, Key> extends Obj ? Key : never]: Obj[Key];
};

export type PartialExcept<T, K extends keyof T> = Pick<T, K> &
  Partial<Omit<T, K>>;
