export type Domain = "acting" | "crew";

export type CandidatePreference = {
  roleId: string;
  label: string;
  share: number;
  rank: number;
};

export type CandidateAggregate = {
  userId: string;
  name: string;
  email: string | null;
  focus: "acting" | "tech" | "both" | null;
  score: number;
  confidence: number;
  experienceYears: number | null;
  interests: string[];
  background: string | null;
  notes: string | null;
  preferences: Record<Domain, CandidatePreference[]>;
};

export type HighlightContext = {
  domain: Domain;
  roleId: string;
  label: string;
  rank: number;
  share: number;
};

export type RoleCandidate = {
  candidate: CandidateAggregate;
  highlight: HighlightContext;
};

export type RoleGroup = {
  roleId: string;
  label: string;
  domain: Domain;
  candidates: RoleCandidate[];
};

export type RoleSummary = {
  roleId: string;
  label: string;
  domain: Domain;
  averageShare: number;
};
