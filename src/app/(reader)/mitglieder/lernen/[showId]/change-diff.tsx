"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { wordDiff } from "@/lib/skript/diff";

/**
 * Was sich an einer Stelle gegenüber dem zuletzt gelernten Wortlaut geändert hat
 * (docs/Plan/lernmodus-plan.md, Runde 2). Verdeckt erst, damit die Abfrage nicht verraten wird;
 * Öffnen deckt die Stelle auf (zählt wie „Alles“).
 */
export function ChangeDiff({
  before,
  after,
  open,
  onOpen,
}: {
  before: string | null | undefined;
  after: string;
  open: boolean;
  onOpen: () => void;
}) {
  const tokens = React.useMemo(() => (before ? wordDiff(before, after) : []), [before, after]);
  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={onOpen} data-testid="lernen-aenderung">
        Was hat sich geändert?
      </Button>
    );
  }
  return (
    <div
      className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm"
      data-testid="lernen-aenderung-text"
    >
      <p className="text-xs font-medium text-muted-foreground">
        Geändert gegenüber deinem gelernten Text
      </p>
      {before ? (
        <p className="mt-1 leading-relaxed">
          {tokens.map((token, index) =>
            token.op === "equal" ? (
              <span key={index}>{token.text} </span>
            ) : token.op === "insert" ? (
              <React.Fragment key={index}>
                <ins className="bg-success/25 no-underline">{token.text}</ins>{" "}
              </React.Fragment>
            ) : (
              <React.Fragment key={index}>
                <del className="bg-destructive/15 text-muted-foreground">{token.text}</del>{" "}
              </React.Fragment>
            ),
          )}
        </p>
      ) : (
        <p className="mt-1 text-muted-foreground">
          Der alte Wortlaut ist nicht gespeichert (vor diesem Update gelernt) – die Stelle ist jetzt
          aufgedeckt.
        </p>
      )}
    </div>
  );
}
