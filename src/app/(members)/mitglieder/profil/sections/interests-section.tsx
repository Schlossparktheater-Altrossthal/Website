"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { FormSaveBar } from "@/components/ui/form-save-bar";
import { InterestTagInput } from "@/components/members/interest-tag-input";
import { saveInterestsAction } from "../actions/interests";
import { InterestsState } from "../profile-shared";

type InterestsSectionProps = {
  interests: string[];
  onInterestsChange: (next: string[]) => void;
};

export function InterestsSection({ interests, onInterestsChange }: InterestsSectionProps) {
  const [state, setState] = useState<InterestsState>({ items: interests, dirty: false });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setState({ items: interests, dirty: false });
  }, [interests]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const result = await saveInterestsAction(state.items);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setState({ items: result.data.interests, dirty: false });
      onInterestsChange(result.data.interests);
      toast.success("Interessen gespeichert");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="plain" size="md">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <InterestTagInput
          id="interestInput"
          label="Deine Interessen"
          value={state.items}
          onChange={(items) => setState({ items, dirty: true })}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <FormSaveBar
          dirty={state.dirty}
          submitting={saving}
          onReset={() => {
            setState({ items: interests, dirty: false });
            setError(null);
          }}
        />
      </form>
    </Card>
  );
}
