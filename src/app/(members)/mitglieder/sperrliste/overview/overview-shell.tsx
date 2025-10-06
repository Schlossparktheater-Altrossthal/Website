"use client";

export type OverviewShellProps = Record<string, unknown>;

export function OverviewShell(_props: OverviewShellProps) {
  void _props;
  return (
    <div className="rounded-xl border border-dashed bg-muted/40 p-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">
        Die Sperrlisten-Übersicht befindet sich derzeit noch in Arbeit.
      </p>
    </div>
  );
}
