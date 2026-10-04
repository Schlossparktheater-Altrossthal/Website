"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  commentRecipeAction,
  deleteCommentAction,
  rateRecipeAction,
} from "@/app/(members)/mitglieder/rezepte/actions";
import { StarIcon, TrashIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import type { RecipeDetail } from "@/lib/food/recipes/queries";
import { cn } from "@/lib/utils";

const DATE = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: DEFAULT_TIME_ZONE,
});

export function RecipeRating({
  recipeId,
  myRating,
}: {
  recipeId: string;
  myRating: number | null;
}) {
  const [value, setValue] = useState(myRating);
  const [pending, startTransition] = useTransition();

  const rate = (stars: number) => {
    const previous = value;
    setValue(stars);
    startTransition(async () => {
      const result = await rateRecipeAction(recipeId, stars);
      if (!result.ok) {
        setValue(previous);
        toast.error("Nicht gespeichert", { description: result.error, duration: 5000 });
      }
    });
  };

  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Deine Bewertung">
      {[1, 2, 3, 4, 5].map((stars) => (
        <button
          key={stars}
          type="button"
          role="radio"
          aria-checked={value === stars}
          aria-label={`${stars} von 5 Sternen`}
          disabled={pending}
          onClick={() => rate(stars)}
          className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <StarIcon
            className={cn(
              "h-6 w-6",
              value !== null && stars <= value
                ? "fill-primary text-primary"
                : "text-muted-foreground",
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function RecipeComments({
  recipeId,
  comments,
}: {
  recipeId: string;
  comments: RecipeDetail["comments"];
}) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await commentRecipeAction(recipeId, body);
      if (!result.ok) {
        toast.error("Nicht gespeichert", { description: result.error, duration: 5000 });
        return;
      }
      setBody("");
    });
  };

  const remove = (commentId: string) =>
    startTransition(async () => {
      const result = await deleteCommentAction(commentId);
      if (!result.ok) toast.error(result.error, { duration: 5000 });
    });

  return (
    <div className="space-y-4">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Kommentare.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <UserAvatar
                userId={comment.author?.id}
                name={comment.author?.name}
                email={comment.author?.avatar.email}
                avatarSource={comment.author?.avatar.avatarSource}
                avatarUpdatedAt={comment.author?.avatar.avatarUpdatedAt}
                size={32}
                className="h-8 w-8 shrink-0"
              />
              <div className="min-w-0 flex-1 rounded-md bg-muted p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {comment.author?.name ?? "Ehemaliges Mitglied"}
                    </span>{" "}
                    · {DATE.format(new Date(comment.createdAt))}
                  </p>
                  {comment.own ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label="Kommentar löschen"
                      disabled={pending}
                      onClick={() => remove(comment.id)}
                    >
                      <TrashIcon />
                    </Button>
                  ) : null}
                </div>
                <p className="whitespace-pre-line break-words text-sm text-foreground">
                  {comment.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="space-y-2">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={2}
          maxLength={4000}
          placeholder="Tipp, Erfahrung, Variante …"
          aria-label="Kommentar"
        />
        <div className="flex justify-end">
          <AsyncButton
            type="submit"
            size="sm"
            isLoading={pending}
            loadingText="Senden…"
            disabled={body.trim().length === 0}
          >
            Kommentieren
          </AsyncButton>
        </div>
      </form>
    </div>
  );
}
