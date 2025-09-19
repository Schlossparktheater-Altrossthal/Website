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

const TOOLBAR_OPTIONS = [
  [{ header: [false, 1, 2, 3, 4, 5, 6] }],
  [{ size: ["small", false, "large", "huge"] }],
  ["bold", "italic", "underline", "strike"],
  [{ color: [] }, { background: [] }],
  [{ script: "sub" }, { script: "super" }],
  [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
  [{ align: [] }],
  ["blockquote", "code-block"],
  ["link", "image", "video"],
  ["clean"],
] as const;

const BASE_MODULES = {
  toolbar: TOOLBAR_OPTIONS,
  clipboard: { 
    matchVisual: false 
  },
  history: {
    delay: 2000,
    maxStack: 500,
    userOnly: true
  },
  keyboard: {
    bindings: {
      tab: {
        key: 9,
        handler: function(this: { quill: { history: { cutoff(): void }; getSelection(): { index: number } | null; insertText(index: number, text: string): void; setSelection(index: number): void } }) {
          this.quill.history.cutoff();
          const range = this.quill.getSelection();
          if (range) {
            this.quill.insertText(range.index, '\t');
            this.quill.setSelection(range.index + 1);
          }
          return false;
        }
      }
    }
  }
};

const BASE_FORMATS = [
  "header", "size",
  "bold", "italic", "underline", "strike",
  "color", "background",
  "script",
  "list", "bullet", "indent",
  "align",
  "blockquote", "code-block",
  "link", "image", "video"
];

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
    <div
      className={cn(
        "rich-text-editor overflow-hidden rounded-lg border border-border bg-card shadow-sm",
        className,
      )}
    >
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
