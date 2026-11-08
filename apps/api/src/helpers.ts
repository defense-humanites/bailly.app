export function graveToAcute(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll("\u0300", "\u0301")
    .normalize("NFC");
}

export function hasGraveAccent(value: string): boolean {
  return value
    .normalize("NFD")
    .includes("\u0300");
}
