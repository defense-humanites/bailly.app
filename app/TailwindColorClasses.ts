import { Color } from "./enums";

type SafelistedOpacity = 50;
type SafelistedShade = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

type TailwindColorClassesState = "active" | "hover";
type TailwindColorClassesVariant = "solid" | "translucent";

type TailwindColorClassesKeyBase = "bg" | "border" | "ring" | "text";
type TailwindColorClassesKey =
  | TailwindColorClassesKeyBase
  | `${TailwindColorClassesState}:${TailwindColorClassesKeyBase}`;

type TailwindColorClassesShades = {
  [key in TailwindColorClassesKey]: SafelistedShade;
};

type TailwindColorClassesOptions = {
  shade?: SafelistedShade;
  variant?: TailwindColorClassesVariant;
};

type TailwindColorClassesOptionsWithState = TailwindColorClassesOptions & {
  state?: TailwindColorClassesState;
};

/**
 * Generates Tailwind classes from the colors defined in the Color enum.
 * @remarks As the classes are created dynamically, they must be registered in the safelist (cf. 'app/assets/css/safelist.css').
 */
export class TailwindColorClasses {
  /**
   * The color from which to generate the classes.
   */
  #color: Color;
  /**
   * The default shades.
   */
  #shades: TailwindColorClassesShades = {
    bg: 200,
    "hover:bg": 300,
    "active:bg": 400,
    border: 300,
    "hover:border": 400,
    "active:border": 500,
    ring: 300,
    "hover:ring": 400,
    "active:ring": 500,
    text: 600,
    "hover:text": 700,
    "active:text": 700,
  };
  /**
   * The default variant.
   * @remarks Variants should only apply to backgrounds and borders.
   */
  #variant: TailwindColorClassesVariant = "solid";
  /**
   * The translucent variant opacity setting.
   */
  #translucentOpacity: SafelistedOpacity = 50;

  /**
   * Constructs a new `TailwindColorClasses` instance.
   * @param color A color defined in the `Color` enum.
   * @param opts An optional configuration object.
   */
  constructor(
    color: Color,
    opts?: {
      shades?: Partial<TailwindColorClassesShades>;
      variant?: TailwindColorClassesVariant;
    }
  ) {
    this.#color = color;
    if (opts?.shades) Object.assign(this.#shades, opts.shades);
    if (opts?.variant) this.#variant = opts.variant;
  }

  /**
   * Builds a Tailwind color class using class keys and the instance configuration
   * (which can be overridden by passing the `opts` configuration oject).
   * @param key A class key.
   * @param opts An optional configuration object.
   * @returns A Tailwind color class.
   */
  #buildClassName(
    key: TailwindColorClassesKey,
    opts?: TailwindColorClassesOptions
  ) {
    const shade: SafelistedShade = opts?.shade ?? this.#shades[key];
    const variant: TailwindColorClassesVariant = opts?.variant ?? this.#variant;

    let className: string = `${key}-${this.#color}-${shade}`;

    // Variants only apply to backgrounds and borders.
    if (["bg", "border", "ring"].includes(key)) {
      switch (variant) {
        case "solid":
          break;
        case "translucent":
          className = `${className}/${this.#translucentOpacity}`;
          break;
      }
    }

    return className;
  }

  /**
   * Calls `this.#buildClassName()` taking care to apply a state (e.g. 'hover')
   * defined in the configuration object.
   * @param key A class key.
   * @param opts An optional configuration object.
   * @returns A Tailwind color class.
   * @example this.#singleClass("border", { state: "hover" }); // hover:border-*
   */
  #singleClass(
    key: TailwindColorClassesKeyBase,
    opts?: TailwindColorClassesOptionsWithState
  ): string {
    return opts?.state
      ? this.#buildClassName(`${opts.state}:${key}`, opts)
      : this.#buildClassName(key, opts);
  }

  /**
   * The canonical method to build Tailwind color classes.
   * @param keys An object whose keys are class keys and values are a configuration object or an array (which can contain objects) of class keys.
   * @returns Tailwind color classes.
   * @example new TailwindColorClasses(Color.Blue).classes(["text", { bg: { variant: "translucent" } }]);
   */
  classes<
    KeyOptsRecord extends Partial<
      Record<TailwindColorClassesKey, TailwindColorClassesOptions>
    >
  >(
    keys: KeyOptsRecord | Array<TailwindColorClassesKey | KeyOptsRecord>
  ): string {
    let className: string[] = [];

    // If an array was passed, convert it to an object.
    const keyOptsRecord = Array.isArray(keys)
      ? keys.reduce<KeyOptsRecord>((acc, curr) => {
          // Some indices can be of object type.
          if (typeof curr === "object") Object.assign(acc, curr);
          else Object.assign(acc, { [curr]: {} });
          return acc;
        }, {} as KeyOptsRecord)
      : keys;

    for (const [key, opts] of Object.entries(keyOptsRecord)) {
      className.push(
        this.#buildClassName(key as TailwindColorClassesKey, opts)
      );
    }

    return className.join(" ");
  }

  /**
   * A shorthand to build a Tailwind background class.
   * @param opts An optional configuration object.
   * @returns A Tailwind background color class.
   */
  background(opts?: TailwindColorClassesOptionsWithState): string {
    return this.#singleClass("bg", opts);
  }

  /**
   * A shorthand to build a Tailwind border class.
   * @param opts An optional configuration object.
   * @returns A Tailwind border color class.
   */
  border(opts?: TailwindColorClassesOptionsWithState): string {
    return this.#singleClass("border", opts);
  }

  /**
   * A shorthand to build a Tailwind ring class.
   * @param opts An optional configuration object.
   * @returns A Tailwind ring color class.
   */
  ring(opts?: TailwindColorClassesOptionsWithState): string {
    return this.#singleClass("ring", opts);
  }

  /**
   * A shorthand to build a Tailwind text class.
   * @param opts An optional configuration object.
   * @returns A Tailwind text color class.
   */
  text(opts?: TailwindColorClassesOptionsWithState): string {
    return this.#singleClass("text", opts);
  }
}
