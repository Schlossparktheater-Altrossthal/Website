"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo } from "react";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

// Nur, was die Bereinigung beim Speichern (sanitizeDescription) durchlässt.
const TOOLBAR_OPTIONS = [
  ["bold", "italic", "underline", "link"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["clean"],
] as const;

const BASE_MODULES = {
  toolbar: TOOLBAR_OPTIONS,
  clipboard: {
    matchVisual: false,
  },
  history: {
    delay: 2000,
    maxStack: 500,
    userOnly: true,
  },
  keyboard: {
    bindings: {
      tab: {
        key: 9,
        handler: function (this: {
          quill: {
            history: { cutoff(): void };
            getSelection(): { index: number } | null;
            insertText(index: number, text: string): void;
            setSelection(index: number): void;
          };
        }) {
          this.quill.history.cutoff();
          const range = this.quill.getSelection();
          if (range) {
            this.quill.insertText(range.index, "\t");
            this.quill.setSelection(range.index + 1);
          }
          return false;
        },
      },
    },
  },
};

const BASE_FORMATS = ["bold", "italic", "underline", "link", "list", "blockquote"];

interface ReactQuillProps {
  value: string;
  onChange: (value: string) => void;
  modules: typeof BASE_MODULES;
  formats: string[];
  placeholder?: string;
  className?: string;
  theme?: string;
}

const ReactQuill = dynamic(async () => import("react-quill-new"), {
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
    <div className={cn("rich-text-editor group relative overflow-hidden", className)}>
      <ReactQuill
        theme="snow"
        value={value || ""}
        onChange={handleChange}
        placeholder={placeholder || "Beschreibung eingeben..."}
        modules={modules}
        formats={formats}
      />
    </div>
  );
}
