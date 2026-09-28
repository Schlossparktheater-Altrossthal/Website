import sanitizeHtml from "sanitize-html";

/** Beschreibung eines Termins als sicheres HTML; `null`, wenn der Editor nur Leeres enthält. */
export function sanitizeEventDescription(html: string | null | undefined) {
  if (!html) return null;
  const clean = sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "em", "u", "ol", "ul", "li", "blockquote", "a", "h2", "h3"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });
  // Ein leerer Editor speichert „<p></p>“ – dann gibt es keine Beschreibung.
  return sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} }).trim() ? clean : null;
}
