import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale/de";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CloseIcon, FileIcon, ImageIcon, UploadIcon } from "@/components/ui/action-icons";
import { formatFileLibraryFileSize } from "@/lib/file-library";
import { getUserDisplayName } from "@/lib/names";

import {
  deleteDepartmentDocumentAction,
  uploadDepartmentDocumentAction,
} from "./department-documents-actions";

type DocumentEntry = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
  uploadedById: string | null;
  uploadedBy: {
    id: string | null;
    name: string | null;
    email: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

type DepartmentDocumentsSectionProps = {
  documents: DocumentEntry[];
  departmentId: string;
  canManage: boolean;
  userId: string;
  refreshPath: string;
};

function resolveIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return ImageIcon;
  }
  return FileIcon;
}

export function DepartmentDocumentsSection({
  documents,
  departmentId,
  canManage,
  userId,
  refreshPath,
}: DepartmentDocumentsSectionProps) {
  const hasDocuments = documents.length > 0;
  return (
    <section className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-4 shadow-inner">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Dokumente &amp; Fotos</h3>
          <p className="text-xs text-muted-foreground">
            Teile Pläne, Fotos oder Unterlagen zentral in deinem Gewerk.
          </p>
        </div>
        <Badge variant="muted" size="sm">
          {documents.length} Datei{documents.length === 1 ? "" : "en"}
        </Badge>
      </div>

      {canManage ? (
        <form
          action={uploadDepartmentDocumentAction}
          encType="multipart/form-data"
          className="flex flex-col gap-2 rounded-xl border border-dashed border-border/60 bg-background/70 p-3"
        >
          <input type="hidden" name="departmentId" value={departmentId} />
          <input type="hidden" name="redirectPath" value={refreshPath} />
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Dateien hochladen (Bilder oder PDFs, max. 15&nbsp;MB)
          </label>
          <Input type="file" name="files" multiple accept="image/*,application/pdf,application/msword,application/vnd.*" />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              Unterstützt Bilder (JPG, PNG, WebP) sowie PDF- und Office-Dokumente.
            </p>
            <Button type="submit" size="sm" className="gap-2">
              <UploadIcon aria-hidden className="h-4 w-4" />
              <span>Hochladen</span>
            </Button>
          </div>
        </form>
      ) : null}

      {hasDocuments ? (
        <ul className="space-y-3">
          {documents.map((doc) => {
            const Icon = resolveIcon(doc.mimeType);
            const uploadedLabel = doc.uploadedBy
              ? getUserDisplayName(doc.uploadedBy, "Unbekannt")
              : "Unbekannt";
            const canDelete = canManage || doc.uploadedById === userId;
            const downloadHref = `/api/departments/${departmentId}/documents/${doc.id}`;
            return (
              <li
                key={doc.id}
                className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/85 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon aria-hidden className="h-5 w-5" />
                  </span>
                  <div className="space-y-1">
                    <a
                      href={downloadHref}
                      className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      {doc.fileName}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {formatFileLibraryFileSize(doc.fileSize)} · hochgeladen von {uploadedLabel} ·{' '}
                      {formatDistanceToNow(doc.createdAt, { addSuffix: true, locale: de })}
                    </p>
                  </div>
                </div>
                {canDelete ? (
                  <form action={deleteDepartmentDocumentAction} className="flex justify-end">
                    <input type="hidden" name="documentId" value={doc.id} />
                    <input type="hidden" name="redirectPath" value={refreshPath} />
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <CloseIcon aria-hidden className="mr-2 h-4 w-4" />
                      Entfernen
                    </Button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Noch keine Dateien hinterlegt. {canManage ? "Lege los und stelle deinem Team wichtige Unterlagen bereit." : "Bitte wende dich an die Leitung, um Unterlagen zu teilen."}
        </p>
      )}
    </section>
  );
}
