"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo } from "react";
import type { ComponentType } from "react";
import type { ReactQuillProps } from "react-quill";

import { cn } from "@/lib/utils";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

const TOOLBAR_OPTIONS = [
  [{ header: [false, 2, 3] }],
  ["bold", "italic", "underline"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["blockquote", "link"],
  ["clean"],
] as const;

const BASE_MODULES = {
  toolbar: TOOLBAR_OPTIONS,
  clipboard: { matchVisual: false },
} satisfies NonNullable<ReactQuillProps["modules"]>;

const BASE_FORMATS = [
  "header",
  "bold",
  "italic",
  "underline",
  "list",
  "bullet",
  "blockquote",
  "link",
] satisfies NonNullable<ReactQuillProps["formats"]>;

const ReactQuill = dynamic(async () => import("react-quill"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[160px] items-center justify-center px-3 py-3 text-sm text-muted-foreground/70">
      Editor wird geladen…
    </div>
  ),
}) as ComponentType<ReactQuillProps>;

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const modules = useMemo(() => BASE_MODULES, []);
  const formats = useMemo(() => BASE_FORMATS, []);

  const handleChange = useCallback(
    (content: string) => {
      const normalized = content === "<p><br></p>" ? "" : content;
      onChange(normalized);
    },
    [onChange],
  );

  return (
    <div
      className={cn(
        "rich-text-editor overflow-hidden rounded-lg border border-border/60 bg-background/80",
        className,
      )}
    >
      <ReactQuill
        theme="snow"
        value={value || ""}
        onChange={handleChange}
        placeholder={placeholder}
        modules={modules}
        formats={formats}
      />
    </div>
  );
}
