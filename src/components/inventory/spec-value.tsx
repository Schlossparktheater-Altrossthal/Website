import type { FieldType } from "@/lib/inventory/specs";

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Zeigt einen Merkmalswert an: Farbe als Farbfeld, Link und Datei als Verweis, sonst den Text.
 * Der Farbwert stammt aus dem Merkmal (Nutzerdaten), nicht aus dem Theme – deshalb als Inline-Stil.
 */
export function SpecValueDisplay({
  type,
  value,
  fileId,
}: {
  type?: FieldType;
  value: string;
  /** Datei-Anhang zum Download (Merkmalstyp `file`). */
  fileId?: string | null;
}) {
  if (type === "color" && HEX.test(value.trim())) {
    const hex = value.trim();
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block h-4 w-4 shrink-0 rounded-full border border-border"
          style={{ backgroundColor: hex }}
        />
        <span className="font-mono text-xs uppercase">{hex}</span>
      </span>
    );
  }
  if (type === "file" && fileId) {
    return (
      <a
        href={`/api/lager/spec-files/${fileId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-primary underline underline-offset-2"
      >
        {value}
      </a>
    );
  }
  if (type === "url") {
    const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-primary underline underline-offset-2"
      >
        {value}
      </a>
    );
  }
  return <>{value}</>;
}
