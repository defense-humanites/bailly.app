/**
 * A toast's title, without a final period, as the others (« Clé copiée »):
 * a message written as a sentence (an error's, e.g. « Cette clé a été
 * désactivée : activez la synchronisation avec une nouvelle clé. ») loses
 * it; an ellipsis or another mark stays.
 * @example toastTitle("La clé n'a pas pu être copiée.") // "La clé n'a pas pu être copiée"
 */
export function toastTitle(text: string): string {
  return text.endsWith(".") && !text.endsWith("..") ? text.slice(0, -1) : text;
}
