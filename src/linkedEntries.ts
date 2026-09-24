/**
 * Replace the `span[data-linked-entries]` elements of the definitions with
 * links to the reader (e.g. `data-linked-entries="echô,choô"` becomes
 * `href="/lecteur?q=echô,choô&forme=…"`), keeping their other attributes and content.
 * @param root The element containing the definitions.
 */
export function convertLinkedEntries(root: ParentNode): void {
  root
    .querySelectorAll<HTMLSpanElement>("span[data-linked-entries]")
    .forEach((element) => {
      const queryString = element.dataset.linkedEntries;
      if (!queryString) return;

      const anchor = document.createElement("a");
      for (const attribute of element.attributes) {
        if (attribute.name !== "data-linked-entries") {
          anchor.setAttribute(attribute.name, attribute.value);
        }
      }
      // Pass the form itself, so that the reader can show which form is ambiguous.
      const form = element.textContent?.trim();
      anchor.href = `/lecteur?q=${queryString}` +
        (form ? `&forme=${encodeURIComponent(form)}` : "");
      anchor.innerHTML = element.innerHTML;
      element.replaceWith(anchor);
    });
}
