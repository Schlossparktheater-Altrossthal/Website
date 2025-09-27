import { randomUUID } from "node:crypto";

import type { OnboardingFocus, RolePreferenceDomain } from "@prisma/client";

import {
  GENDER_LABELS,
  loadOnboardingDataset,
  resolveAgeBucket,
  resolveGenderKey,
  type PhotoConsentSnapshot,
} from "@/lib/onboarding-dashboard";

import type { OnboardingTalentProfile } from "@/lib/onboarding-analytics";

export type AssignmentFilterInput = {
  focuses?: OnboardingFocus[];
  ageBuckets?: string[];
  backgrounds?: string[];
  documentStatuses?: string[];
};

export type AssignmentFairnessInput = {
  gender?: Partial<Record<keyof typeof GENDER_LABELS, number>>;
  experience?: { experienced: number; newcomer: number };
};

export type AssignmentRequest = {
  capacities: Record<string, number>;
  filters?: AssignmentFilterInput;
  fairness?: AssignmentFairnessInput;
};

export type CandidatePlacement = {
  profileId: string;
  userId: string;
  name: string | null;
  email: string | null;
  focus: OnboardingFocus;
  gender: keyof typeof GENDER_LABELS;
  age: number | null;
  ageBucket: string | null;
  background: string | null;
  memberSinceYear: number | null;
  documentStatus: string;
  score: number;
  normalizedWeight: number;
  qualityFactor: number;
  reasons: string[];
  confidence: number;
  rank: number;
};

export type TargetAssignment = {
  code: string;
  domain: RolePreferenceDomain;
  label: string;
  capacity: number;
  demand: number;
  assigned: CandidatePlacement[];
  alternatives: CandidatePlacement[];
  averageScore: number;
  medianScore: number;
};

export type FairnessSignal = {
  dimension: "gender" | "experience";
  status: "good" | "warning" | "critical";
  metrics: {
    label: string;
    value: number;
    target: number;
  }[];
  summary: string;
};

export type ConflictEntry = {
  id: string;
  targetCode: string;
  targetLabel: string;
  domain: RolePreferenceDomain;
  candidates: CandidatePlacement[];
  reason: string;
};

export type AssignmentSolution = {
  id: string;
  generatedAt: string;
  config: AssignmentRequest;
  targets: TargetAssignment[];
  demandVsCapacity: {
    code: string;
    label: string;
    domain: RolePreferenceDomain;
    capacity: number;
    assigned: number;
    demand: number;
    fillRate: number;
  }[];
  fairness: FairnessSignal[];
  conflicts: ConflictEntry[];
};

type DocumentStatusSummary = {
  primary: string;
  tags: string[];
};

type DomainQuality = {
  factor: number;
  reasons: string[];
};

type CandidateDomainScore = {
  candidateIndex: number;
  profile: OnboardingTalentProfile;
  code: string;
  domain: RolePreferenceDomain;
  normalizedWeight: number;
  qualityFactor: number;
  reasons: string[];
  score: number;
  gender: keyof typeof GENDER_LABELS;
  documentStatus: DocumentStatusSummary;
};

type RawCandidate = {
  index: number;
  profile: OnboardingTalentProfile;
  gender: keyof typeof GENDER_LABELS;
  ageBucket: string | null;
  documentStatus: DocumentStatusSummary;
  domainQualities: Record<RolePreferenceDomain, DomainQuality>;
  normalizedPreferences: CandidateDomainScore[];
};

const assignmentCache = new Map<string, AssignmentSolution>();
const assignmentCacheOrder: string[] = [];

function pickPrimaryDocumentStatus(summary: DocumentStatusSummary): string {
  if (summary.primary) {
    return summary.primary;
  }
  const priorities = ["genehmigt", "ausstehend", "abgelehnt", "fehlend", "hochgeladen", "kein Upload"];
  for (const candidate of priorities) {
    if (summary.tags.includes(candidate)) {
      return candidate;
    }
  }
  return summary.tags[0] ?? "unbekannt";
}

function deriveDocumentStatus(
  userId: string,
  consents: Map<string, PhotoConsentSnapshot>,
  skipped: Set<string>,
): DocumentStatusSummary {
  const tags = new Set<string>();
  const consent = consents.get(userId);
  if (!consent) {
    tags.add("fehlend");
  } else {
    if (consent.status === "approved") tags.add("genehmigt");
    if (consent.status === "pending") tags.add("ausstehend");
    if (consent.status === "rejected") tags.add("abgelehnt");
    if (consent.documentUploadedAt) {
      tags.add("hochgeladen");
    } else {
      tags.add("kein Upload");
    }
  }
  if (skipped.has(userId)) {
    tags.add("kein Upload");
  }
  return { primary: pickPrimaryDocumentStatus({ primary: "", tags: Array.from(tags) }), tags: Array.from(tags) };
}

function computeDomainQualities(
  profile: OnboardingTalentProfile,
  documentStatus: DocumentStatusSummary,
): Record<RolePreferenceDomain, DomainQuality> {
  const baseReasons: string[] = [];
  let baseFactor = 1;
  if (profile.memberSinceYear) {
    baseFactor += 0.15;
    baseReasons.push(`Mitglied seit ${profile.memberSinceYear}`);
  } else {
    baseReasons.push("Neu im Ensemble");
  }
  if (profile.completedAt) {
    baseFactor += 0.05;
    baseReasons.push("Onboarding abgeschlossen");
  }
  if (profile.requiresGuardianDocument) {
    baseFactor -= 0.05;
    baseReasons.push("Erziehungsberechtigten-Dokument ausstehend");
  }
  if (documentStatus.primary === "genehmigt") {
    baseFactor += 0.05;
    baseReasons.push("Fotoeinverständnis genehmigt");
  }
  if (documentStatus.primary === "abgelehnt") {
    baseFactor -= 0.1;
    baseReasons.push("Fotoeinverständnis abgelehnt");
  }

  const actingQuality: DomainQuality = {
    factor: baseFactor + (profile.focus === "acting" || profile.focus === "both" ? 0.2 : -0.1),
    reasons: [
      ...baseReasons,
      profile.focus === "acting" || profile.focus === "both"
        ? "Fokus auf Schauspiel"
        : "Primärer Fokus außerhalb Schauspiel",
    ],
  };

  const crewQuality: DomainQuality = {
    factor: baseFactor + (profile.focus === "tech" || profile.focus === "both" ? 0.2 : -0.05),
    reasons: [
      ...baseReasons,
      profile.focus === "tech" || profile.focus === "both"
        ? "Fokus auf Technik/Gewerke"
        : "Primärer Fokus außerhalb Technik",
    ],
  };

  return { acting: actingQuality, crew: crewQuality } satisfies Record<RolePreferenceDomain, DomainQuality>;
}

function buildRawCandidates(
  profiles: OnboardingTalentProfile[],
  consents: Map<string, PhotoConsentSnapshot>,
  skippedDocuments: Set<string>,
  filters: AssignmentFilterInput | undefined,
): { candidates: RawCandidate[]; targetDemand: Map<string, number> } {
  const candidates: RawCandidate[] = [];
  const targetDemand = new Map<string, number>();

  const ageFilter = new Set(filters?.ageBuckets ?? []);
  const focusFilter = new Set(filters?.focuses ?? []);
  const backgroundFilter = new Set((filters?.backgrounds ?? []).map((entry) => entry.toLowerCase()));
  const documentFilter = new Set(filters?.documentStatuses ?? []);

  profiles.forEach((profile, index) => {
    const consentSummary = deriveDocumentStatus(profile.userId, consents, skippedDocuments);
    const gender = resolveGenderKey(profile.gender);
    const ageBucket = typeof profile.age === "number" ? resolveAgeBucket(profile.age) : null;

    if (focusFilter.size && !focusFilter.has(profile.focus)) {
      return;
    }
    if (ageFilter.size && (!ageBucket || !ageFilter.has(ageBucket))) {
      return;
    }
    if (backgroundFilter.size) {
      const background = profile.backgroundClass ?? profile.background ?? "";
      if (!backgroundFilter.has(background.toLowerCase())) {
        return;
      }
    }
    if (documentFilter.size) {
      const matches = consentSummary.tags.some((tag) => documentFilter.has(tag));
      if (!matches) {
        return;
      }
    }

    const domainQualities = computeDomainQualities(profile, consentSummary);
    const normalized: CandidateDomainScore[] = [];

    const domainTotals: Record<RolePreferenceDomain, number> = { acting: 0, crew: 0 };
    const domainPreferences: Record<RolePreferenceDomain, { code: string; weight: number }[]> = {
      acting: [],
      crew: [],
    };

    for (const pref of profile.preferences) {
      if (pref.weight <= 0) continue;
      domainTotals[pref.domain] += pref.weight;
      domainPreferences[pref.domain].push({ code: pref.code, weight: pref.weight });
    }

    (Object.keys(domainPreferences) as RolePreferenceDomain[]).forEach((domain) => {
      const total = domainTotals[domain];
      if (total <= 0) return;
      const quality = domainQualities[domain];
      for (const pref of domainPreferences[domain]) {
        const normalizedWeight = pref.weight / total;
        const reasons = [...quality.reasons, `Präferenzgewicht ${Math.round(normalizedWeight * 100)} %`];
        normalized.push({
          candidateIndex: index,
          profile,
          code: pref.code,
          domain,
          normalizedWeight,
          qualityFactor: quality.factor,
          reasons,
          score: 0,
          gender,
          documentStatus: consentSummary,
        });
        targetDemand.set(pref.code, (targetDemand.get(pref.code) ?? 0) + 1);
      }
    });

    candidates.push({
      index,
      profile,
      gender,
      ageBucket,
      documentStatus: consentSummary,
      domainQualities,
      normalizedPreferences: normalized,
    });
  });

  return { candidates, targetDemand };
}

function normalizeFairnessWeights(values: Record<string, number>): Record<string, number> {
  const entries = Object.entries(values).filter(([, value]) => Number.isFinite(value) && value >= 0);
  const total = entries.reduce((acc, [, value]) => acc + value, 0);
  if (total <= 0) {
    const equal = entries.length ? 1 / entries.length : 0;
    return Object.fromEntries(entries.map(([key]) => [key, equal]));
  }
  return Object.fromEntries(entries.map(([key, value]) => [key, value / total]));
}

type FairnessContext = {
  genderMultipliers: Record<string, number>;
  experienceMultipliers: Record<"experienced" | "newcomer", number>;
  targetGender: Record<string, number>;
  targetExperience: Record<"experienced" | "newcomer", number>;
};

function computeFairnessMultipliers(
  candidates: RawCandidate[],
  fairness: AssignmentFairnessInput | undefined,
): FairnessContext {
  const genderCounts = new Map<string, number>();
  let experiencedCount = 0;
  let newcomerCount = 0;

  for (const candidate of candidates) {
    genderCounts.set(candidate.gender, (genderCounts.get(candidate.gender) ?? 0) + 1);
    if (candidate.profile.memberSinceYear) {
      experiencedCount += 1;
    } else {
      newcomerCount += 1;
    }
  }

  const totalCandidates = Math.max(1, candidates.length);
  const observedGenderWeights = Object.fromEntries(
    Array.from(genderCounts.entries()).map(([key, count]) => [key, count / totalCandidates]),
  );
  const targetGenderWeights = normalizeFairnessWeights({
    ...observedGenderWeights,
    ...(fairness?.gender ?? {}),
  });

  const genderMultipliers: Record<string, number> = {};
  for (const [key, observed] of Object.entries(observedGenderWeights)) {
    const target = targetGenderWeights[key] ?? observed;
    if (observed <= 0 || target <= 0) {
      genderMultipliers[key] = 1;
    } else {
      const ratio = target / observed;
      genderMultipliers[key] = Math.max(0.5, Math.min(1.6, ratio));
    }
  }

  const observedExperience = {
    experienced: experiencedCount / totalCandidates,
    newcomer: newcomerCount / totalCandidates,
  };
  const targetExperience = normalizeFairnessWeights({
    experienced: observedExperience.experienced,
    newcomer: observedExperience.newcomer,
    ...(fairness?.experience ?? {}),
  });

  const experienceMultipliers: Record<"experienced" | "newcomer", number> = {
    experienced:
      observedExperience.experienced > 0 && targetExperience.experienced > 0
        ? Math.max(0.6, Math.min(1.5, targetExperience.experienced / observedExperience.experienced))
        : 1,
    newcomer:
      observedExperience.newcomer > 0 && targetExperience.newcomer > 0
        ? Math.max(0.6, Math.min(1.5, targetExperience.newcomer / observedExperience.newcomer))
        : 1,
  };

  return {
    genderMultipliers,
    experienceMultipliers,
    targetGender: targetGenderWeights,
    targetExperience,
  } satisfies FairnessContext;
}

class MinCostFlow {
  private graph: { to: number; rev: number; capacity: number; cost: number; flow: number }[][];

  constructor(size: number) {
    this.graph = Array.from({ length: size }, () => []);
  }

  addEdge(from: number, to: number, capacity: number, cost: number) {
    const forward = { to, rev: this.graph[to].length, capacity, cost, flow: 0 };
    const backward = { to: from, rev: this.graph[from].length, capacity: 0, cost: -cost, flow: 0 };
    this.graph[from].push(forward);
    this.graph[to].push(backward);
  }

  solve(source: number, sink: number, maxFlow: number) {
    const n = this.graph.length;
    const potential = new Array<number>(n).fill(0);
    let flow = 0;
    let cost = 0;

    const dist = new Array<number>(n);
    const prevNode = new Array<number>(n);
    const prevEdge = new Array<number>(n);

    while (flow < maxFlow) {
      dist.fill(Number.POSITIVE_INFINITY);
      dist[source] = 0;
      const inQueue = new Array<boolean>(n).fill(false);
      const queue: number[] = [source];
      inQueue[source] = true;

      while (queue.length) {
        queue.sort((a, b) => dist[a] - dist[b]);
        const node = queue.shift()!;
        inQueue[node] = false;
        const edges = this.graph[node];
        for (let i = 0; i < edges.length; i += 1) {
          const edge = edges[i];
          if (edge.capacity - edge.flow <= 0) continue;
          const candidateDist = dist[node] + edge.cost + potential[node] - potential[edge.to];
          if (candidateDist < dist[edge.to]) {
            dist[edge.to] = candidateDist;
            prevNode[edge.to] = node;
            prevEdge[edge.to] = i;
            if (!inQueue[edge.to]) {
              queue.push(edge.to);
              inQueue[edge.to] = true;
            }
          }
        }
      }

      if (!Number.isFinite(dist[sink])) {
        break;
      }

      for (let v = 0; v < n; v += 1) {
        if (Number.isFinite(dist[v])) {
          potential[v] += dist[v];
        }
      }

      let addFlow = maxFlow - flow;
      for (let v = sink; v !== source; v = prevNode[v]) {
        const edge = this.graph[prevNode[v]][prevEdge[v]];
        addFlow = Math.min(addFlow, edge.capacity - edge.flow);
      }

      for (let v = sink; v !== source; v = prevNode[v]) {
        const edge = this.graph[prevNode[v]][prevEdge[v]];
        edge.flow += addFlow;
        const rev = this.graph[edge.to][edge.rev];
        rev.flow -= addFlow;
      }

      flow += addFlow;
      cost += addFlow * potential[sink];
    }

    return { flow, cost, graph: this.graph };
  }

  getGraph() {
    return this.graph;
  }
}

function persistSolution(solution: AssignmentSolution) {
  assignmentCache.set(solution.id, solution);
  assignmentCacheOrder.push(solution.id);
  if (assignmentCacheOrder.length > 10) {
    const oldest = assignmentCacheOrder.shift();
    if (oldest) {
      assignmentCache.delete(oldest);
    }
  }
}

function labelForTarget(code: string): string {
  switch (code) {
    case "acting_lead":
      return "Schauspiel – Hauptrolle";
    case "acting_medium":
      return "Schauspiel – Mittelrolle";
    case "acting_scout":
      return "Schauspiel – Scout";
    case "acting_statist":
      return "Schauspiel – Statist";
    case "crew_stage":
      return "Bühne";
    case "crew_light":
      return "Licht";
    case "crew_sound":
      return "Ton";
    case "crew_costume":
      return "Kostüm";
    case "crew_props":
      return "Requisite";
    default:
      return code.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

function summarizeScores(entries: CandidatePlacement[]): { average: number; median: number } {
  if (!entries.length) {
    return { average: 0, median: 0 };
  }
  const total = entries.reduce((acc, entry) => acc + entry.score, 0);
  const sorted = [...entries].sort((a, b) => a.score - b.score);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1]!.score + sorted[mid]!.score) / 2
      : sorted[mid]!.score;
  return { average: total / entries.length, median };
}

export async function solveAssignments(
  request: AssignmentRequest,
  now: Date = new Date(),
): Promise<AssignmentSolution> {
  const dataset = await loadOnboardingDataset(now);
  const consentMap = new Map(dataset.consents.map((entry) => [entry.userId, entry]));
  const skippedDocuments = new Set(dataset.redemptions.filter((entry) => entry.photoConsentSkipped && entry.userId).map((entry) => entry.userId!));

  const { candidates, targetDemand } = buildRawCandidates(
    dataset.analytics.talentProfiles,
    consentMap,
    skippedDocuments,
    request.filters,
  );

  const fairnessContext = computeFairnessMultipliers(candidates, request.fairness);

  const capacityEntries = Object.entries(request.capacities).filter(([, value]) => Number.isFinite(value) && value > 0);
  const targets = capacityEntries.map(([code, capacity]) => ({
    code,
    capacity: Math.floor(capacity),
  }));

  const targetIndexMap = new Map<string, number>();
  targets.forEach((target, index) => {
    targetIndexMap.set(target.code, index);
  });

  const candidateScoresByTarget = new Map<string, CandidateDomainScore[]>();

  candidates.forEach((candidate) => {
    candidate.normalizedPreferences.forEach((entry) => {
      const targetIndex = targetIndexMap.get(entry.code);
      if (typeof targetIndex === "undefined") return;
      const genderFactor = fairnessContext.genderMultipliers[candidate.gender] ?? 1;
      const experienceKey = candidate.profile.memberSinceYear ? "experienced" : "newcomer";
      const experienceFactor = fairnessContext.experienceMultipliers[experienceKey];
      const score = entry.normalizedWeight * entry.qualityFactor * genderFactor * experienceFactor;
      entry.score = score;
      const bucket = candidateScoresByTarget.get(entry.code);
      if (bucket) {
        bucket.push(entry);
      } else {
        candidateScoresByTarget.set(entry.code, [entry]);
      }
    });
  });

  const totalCapacity = targets.reduce((acc, target) => acc + target.capacity, 0);
  const nodeCount = 1 + candidates.length + targets.length + 1;
  const source = 0;
  const sink = nodeCount - 1;
  const flow = new MinCostFlow(nodeCount);

  candidates.forEach((candidate, index) => {
    const nodeIndex = 1 + index;
    flow.addEdge(source, nodeIndex, 1, 0);
    candidate.normalizedPreferences.forEach((entry) => {
      const targetIdx = targetIndexMap.get(entry.code);
      if (typeof targetIdx === "undefined") return;
      const targetNode = 1 + candidates.length + targetIdx;
      const cost = Math.round(entry.score * -1000);
      flow.addEdge(nodeIndex, targetNode, 1, cost);
    });
  });

  targets.forEach((target, index) => {
    const nodeIndex = 1 + candidates.length + index;
    flow.addEdge(nodeIndex, sink, target.capacity, 0);
  });

  flow.solve(source, sink, totalCapacity);

  const assignmentsPerTarget = new Map<string, CandidatePlacement[]>();

  candidates.forEach((candidate, index) => {
    const nodeIndex = 1 + index;
    const edges = flow.getGraph()[nodeIndex];
    edges.forEach((edge) => {
      if (edge.flow <= 0) return;
      const targetIdx = edge.to - (1 + candidates.length);
      if (targetIdx < 0 || targetIdx >= targets.length) return;
      const target = targets[targetIdx];
      const scores = candidate.normalizedPreferences.filter((entry) => entry.code === target.code);
      if (!scores.length) return;
      const chosen = scores.sort((a, b) => b.score - a.score)[0]!;
      const placement: CandidatePlacement = {
        profileId: candidate.profile.id,
        userId: candidate.profile.userId,
        name: candidate.profile.name,
        email: candidate.profile.email,
        focus: candidate.profile.focus,
        gender: candidate.gender,
        age: candidate.profile.age ?? null,
        ageBucket: candidate.ageBucket,
        background: candidate.profile.backgroundClass ?? candidate.profile.background ?? null,
        memberSinceYear: candidate.profile.memberSinceYear ?? null,
        documentStatus: pickPrimaryDocumentStatus(candidate.documentStatus),
        score: Math.round(chosen.score * 1000) / 1000,
        normalizedWeight: Math.round(chosen.normalizedWeight * 1000) / 1000,
        qualityFactor: Math.round(chosen.qualityFactor * 1000) / 1000,
        reasons: chosen.reasons,
        confidence: 0,
        rank: 0,
      };
      const list = assignmentsPerTarget.get(target.code) ?? [];
      list.push(placement);
      assignmentsPerTarget.set(target.code, list);
    });
  });

  const targetPlacements: TargetAssignment[] = targets.map((target) => {
    const scores = candidateScoresByTarget.get(target.code) ?? [];
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    const assigned = assignmentsPerTarget.get(target.code) ?? [];

    const alternatives: CandidatePlacement[] = [];
    for (const entry of sorted) {
      const alreadyAssigned = assigned.some((candidate) => candidate.profileId === entry.profile.id);
      if (!alreadyAssigned) {
        alternatives.push({
          profileId: entry.profile.id,
          userId: entry.profile.userId,
          name: entry.profile.name,
          email: entry.profile.email,
          focus: entry.profile.focus,
          gender: entry.gender,
          age: entry.profile.age ?? null,
          ageBucket: typeof entry.profile.age === "number" ? resolveAgeBucket(entry.profile.age) : null,
          background: entry.profile.backgroundClass ?? entry.profile.background ?? null,
          memberSinceYear: entry.profile.memberSinceYear ?? null,
          documentStatus: pickPrimaryDocumentStatus(entry.documentStatus),
          score: Math.round(entry.score * 1000) / 1000,
          normalizedWeight: Math.round(entry.normalizedWeight * 1000) / 1000,
          qualityFactor: Math.round(entry.qualityFactor * 1000) / 1000,
          reasons: entry.reasons,
          confidence: 0,
          rank: alternatives.length + 1,
        });
      }
      if (alternatives.length >= 3) break;
    }

    const demand = targetDemand.get(target.code) ?? 0;

    const { average, median } = summarizeScores(assigned);

    return {
      code: target.code,
      domain: scores[0]?.domain ?? "acting",
      label: labelForTarget(target.code),
      capacity: target.capacity,
      demand,
      assigned,
      alternatives,
      averageScore: Math.round(average * 1000) / 1000,
      medianScore: Math.round(median * 1000) / 1000,
    } satisfies TargetAssignment;
  });

  const demandVsCapacity = targetPlacements.map((entry) => ({
    code: entry.code,
    label: entry.label,
    domain: entry.domain,
    capacity: entry.capacity,
    assigned: entry.assigned.length,
    demand: entry.demand,
    fillRate: entry.capacity > 0 ? Math.round((entry.assigned.length / entry.capacity) * 100) / 100 : 0,
  }));

  targetPlacements.forEach((entry) => {
    const ranking = candidateScoresByTarget.get(entry.code) ?? [];
    entry.assigned.forEach((candidate) => {
      const fallback = ranking.find((score) => score.profile.id !== candidate.profileId);
      const competitorScore = fallback?.score ?? candidate.score;
      const confidence = competitorScore > 0 ? candidate.score / (candidate.score + competitorScore) : 1;
      candidate.confidence = Math.round(confidence * 1000) / 1000;
    });
    entry.assigned.sort((a, b) => b.score - a.score);
    entry.assigned.forEach((candidate, index) => {
      candidate.rank = index + 1;
    });
  });

  const assignedPlacements = targetPlacements.flatMap((entry) => entry.assigned);
  const totalAssigned = Math.max(1, assignedPlacements.length);

  const assignedGenderCounts = new Map<string, number>();
  const assignedExperience = { experienced: 0, newcomer: 0 };
  assignedPlacements.forEach((placement) => {
    assignedGenderCounts.set(placement.gender, (assignedGenderCounts.get(placement.gender) ?? 0) + 1);
    if (placement.memberSinceYear) {
      assignedExperience.experienced += 1;
    } else {
      assignedExperience.newcomer += 1;
    }
  });

  const fairnessSignals: FairnessSignal[] = [];

  if (assignedPlacements.length) {
    const genderMetrics = Array.from(assignedGenderCounts.entries()).map(([gender, count]) => {
      const share = count / totalAssigned;
      const target = fairnessContext.targetGender[gender] ?? share;
      return { label: GENDER_LABELS[gender as keyof typeof GENDER_LABELS] ?? gender, value: share, target };
    });
    const worstGenderDiff = Math.max(...genderMetrics.map((metric) => Math.abs(metric.value - metric.target)));
    fairnessSignals.push({
      dimension: "gender",
      status: worstGenderDiff < 0.1 ? "good" : worstGenderDiff < 0.2 ? "warning" : "critical",
      metrics: genderMetrics,
      summary: "Vergleich zwischen Ziel- und Ist-Geschlechterverteilung",
    });

    const experienceTotal = assignedExperience.experienced + assignedExperience.newcomer;
    if (experienceTotal > 0) {
      const metrics = [
        {
          label: "Erfahren",
          value: assignedExperience.experienced / experienceTotal,
          target: fairnessContext.targetExperience.experienced ?? (assignedExperience.experienced / experienceTotal),
        },
        {
          label: "Neu",
          value: assignedExperience.newcomer / experienceTotal,
          target: fairnessContext.targetExperience.newcomer ?? (assignedExperience.newcomer / experienceTotal),
        },
      ];
      const diff = Math.max(...metrics.map((metric) => Math.abs(metric.value - metric.target)));
      fairnessSignals.push({
        dimension: "experience",
        status: diff < 0.15 ? "good" : diff < 0.25 ? "warning" : "critical",
        metrics,
        summary: "Balance zwischen erfahrenen und neuen Teilnehmenden",
      });
    }
  }

  const conflicts: ConflictEntry[] = [];
  targetPlacements.forEach((entry) => {
    const ranking = candidateScoresByTarget.get(entry.code) ?? [];
    if (!ranking.length) return;
    const assignedIds = new Set(entry.assigned.map((candidate) => candidate.profileId));
    ranking.slice(0, 5).forEach((score) => {
      if (assignedIds.has(score.profile.id)) return;
      const assigned = entry.assigned[0];
      if (!assigned) return;
      const gap = assigned.score - Math.round(score.score * 1000) / 1000;
      const ratio = assigned.score > 0 ? gap / assigned.score : 1;
      if (ratio < 0.12) {
        const alternative: CandidatePlacement = {
          profileId: score.profile.id,
          userId: score.profile.userId,
          name: score.profile.name,
          email: score.profile.email,
          focus: score.profile.focus,
          gender: score.gender,
          age: score.profile.age ?? null,
          ageBucket: typeof score.profile.age === "number" ? resolveAgeBucket(score.profile.age) : null,
          background: score.profile.backgroundClass ?? score.profile.background ?? null,
          memberSinceYear: score.profile.memberSinceYear ?? null,
          documentStatus: pickPrimaryDocumentStatus(score.documentStatus),
          score: Math.round(score.score * 1000) / 1000,
          normalizedWeight: Math.round(score.normalizedWeight * 1000) / 1000,
          qualityFactor: Math.round(score.qualityFactor * 1000) / 1000,
          reasons: score.reasons,
          confidence: 0,
          rank: entry.assigned.length + 1,
        };
        conflicts.push({
          id: randomUUID(),
          targetCode: entry.code,
          targetLabel: entry.label,
          domain: entry.domain,
          candidates: [assigned, alternative],
          reason: "Enges Scoring – manuelle Entscheidung empfohlen",
        });
      }
    });
  });

  const solution: AssignmentSolution = {
    id: randomUUID(),
    generatedAt: now.toISOString(),
    config: request,
    targets: targetPlacements,
    demandVsCapacity,
    fairness: fairnessSignals,
    conflicts,
  };

  persistSolution(solution);
  return solution;
}

export function getAssignmentConflicts(solutionId: string): ConflictEntry[] {
  const solution = assignmentCache.get(solutionId);
  return solution?.conflicts ?? [];
}
