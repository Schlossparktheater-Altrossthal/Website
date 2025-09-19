"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastValueRef = useRef<string>("");

  useEffect(() => {
    if (!editorRef.current) return;
    if (lastValueRef.current === value) return;
    editorRef.current.innerHTML = value || "";
    lastValueRef.current = value;
  }, [value]);

  const handleInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    lastValueRef.current = html;
    onChange(html);
  };

  const runCommand = (command: string, valueArg?: string) => {
    document.execCommand(command, false, valueArg ?? undefined);
    editorRef.current?.focus();
    handleInput();
  };

  const handleCreateLink = () => {
    const url = prompt("Link-Adresse eingeben");
    if (url) {
      runCommand("createLink", url);
    }
  };

  const handleRemoveFormat = () => {
    runCommand("removeFormat");
  };

  const isEmpty = !value || value.replace(/<[^>]+>/g, "").trim().length === 0;

  return (
    <div className={cn("rounded-lg border border-border/60 bg-background/80", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-border/60 bg-muted/60 px-2 py-1.5">
        <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-sm font-semibold" onClick={() => runCommand("bold")}>
          B
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 px-2 italic" onClick={() => runCommand("italic")}>
          I
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 px-2 underline" onClick={() => runCommand("underline")}>
          U
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={() => runCommand("insertUnorderedList")}>
          • Liste
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={handleCreateLink}>
          Link
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={handleRemoveFormat}>
          Format löschen
        </Button>
      </div>
      <div className="relative">
        {isEmpty && placeholder ? (
          <span className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground/70">{placeholder}</span>
        ) : null}
        <div
          ref={editorRef}
          className="min-h-[160px] w-full whitespace-pre-wrap px-3 py-3 text-sm focus:outline-none"
          contentEditable
          onInput={handleInput}
          onBlur={handleInput}
        />
      </div>
    </div>
  );
}
