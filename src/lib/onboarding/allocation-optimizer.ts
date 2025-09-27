import type { AllocationCandidate, AllocationRole } from "./dashboard-schemas";

type FocusCategory = "acting" | "tech" | "both" | "unknown";
type ExperienceCategory = "novice" | "experienced" | "unknown";

interface CandidateMeta {
  userId: string;
  focus: FocusCategory;
  experience: ExperienceCategory;
  bucketId: string;
  maxAssignments: number;
}

interface SlotEntry {
  slotId: string;
  roleId: string;
  roleIndex: number;
}

interface CandidateOption {
  candidate: AllocationCandidate;
  adjustedScore: number;
  normalizedScore: number;
  fairnessPenalty: number;
}

interface RoleCandidateMap {
  [userId: string]: CandidateOption;
}

interface FairnessBucket {
  id: string;
  label: string;
  focus: FocusCategory;
  experience: ExperienceCategory;
  candidateCount: number;
  totalMaxAssignments: number;
  capacity: number;
}

interface EdgeMetaAssignment {
  type: "assignment";
  slotId: string;
  roleId: string;
  candidateId: string;
}

type EdgeMeta = EdgeMetaAssignment | undefined;

interface Edge {
  to: number;
  rev: number;
  capacity: number;
  cost: number;
  originalCapacity: number;
  meta?: EdgeMeta;
}

interface EdgeReference {
  from: number;
  index: number;
}

class MinCostMaxFlow {
  private graph: Edge[][];

  constructor(size: number) {
    this.graph = Array.from({ length: size }, () => []);
  }

  addEdge(from: number, to: number, capacity: number, cost: number, meta?: EdgeMeta): EdgeReference {
    const forward: Edge = {
      to,
      rev: this.graph[to].length,
      capacity,
      cost,
      originalCapacity: capacity,
      meta,
    };
    const backward: Edge = {
      to: from,
      rev: this.graph[from].length,
      capacity: 0,
      cost: -cost,
      originalCapacity: 0,
    };
    this.graph[from].push(forward);
    this.graph[to].push(backward);
    return { from, index: this.graph[from].length - 1 };
  }

  getEdge(reference: EdgeReference): Edge {
    return this.graph[reference.from][reference.index];
  }

  minCostMaxFlow(source: number, sink: number, maxFlow: number): { flow: number; cost: number } {
    const nodeCount = this.graph.length;
    const potential = new Array(nodeCount).fill(0);
    let flow = 0;
    let cost = 0;

    while (flow < maxFlow) {
      const dist = new Array(nodeCount).fill(Number.POSITIVE_INFINITY);
      const parentNode = new Array(nodeCount).fill(-1);
      const parentEdge = new Array(nodeCount).fill(-1);
      const inQueue = new Array(nodeCount).fill(false);

      dist[source] = 0;
      const queue: number[] = [source];
      inQueue[source] = true;

      while (queue.length > 0) {
        const node = queue.shift()!;
        inQueue[node] = false;
        const edges = this.graph[node];
        for (let i = 0; i < edges.length; i += 1) {
          const edge = edges[i];
          if (edge.capacity <= 0) continue;
          const reducedCost = edge.cost + potential[node] - potential[edge.to];
          if (dist[node] + reducedCost < dist[edge.to]) {
            dist[edge.to] = dist[node] + reducedCost;
            parentNode[edge.to] = node;
            parentEdge[edge.to] = i;
            if (!inQueue[edge.to]) {
              queue.push(edge.to);
              inQueue[edge.to] = true;
            }
          }
        }
      }

      if (parentNode[sink] === -1) {
        break;
      }

      for (let i = 0; i < nodeCount; i += 1) {
        if (dist[i] < Number.POSITIVE_INFINITY) {
          potential[i] += dist[i];
        }
      }

      let addFlow = maxFlow - flow;
      for (let node = sink; node !== source; node = parentNode[node]) {
        const edge = this.graph[parentNode[node]][parentEdge[node]];
        addFlow = Math.min(addFlow, edge.capacity);
      }

      for (let node = sink; node !== source; node = parentNode[node]) {
        const edge = this.graph[parentNode[node]][parentEdge[node]];
        edge.capacity -= addFlow;
        const reverse = this.graph[edge.to][edge.rev];
        reverse.capacity += addFlow;
        cost += addFlow * edge.cost;
      }

      flow += addFlow;
    }

    return { flow, cost };
  }
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function focusCategory(focus: AllocationCandidate["focus"]): FocusCategory {
  if (focus === "acting" || focus === "tech" || focus === "both") {
    return focus;
  }
  return "unknown";
}

function experienceCategory(years: AllocationCandidate["experienceYears"]): ExperienceCategory {
  if (years === undefined || years === null) {
    return "unknown";
  }
  return years < 2 ? "novice" : "experienced";
}

function bucketLabel(focus: FocusCategory, experience: ExperienceCategory): string {
  const focusLabel =
    focus === "acting"
      ? "Acting"
      : focus === "tech"
        ? "Crew"
        : focus === "both"
          ? "Hybrid"
          : "Offen";
  const experienceLabel =
    experience === "novice"
      ? "Novize"
      : experience === "experienced"
        ? "Erfahren"
        : "Unbekannt";
  return `${focusLabel} · ${experienceLabel}`;
}

function computeFocusPenalty(roleDomain: AllocationRole["domain"], focus: AllocationCandidate["focus"]): number {
  if (!focus) {
    return 0.08;
  }
  if (roleDomain === "acting") {
    if (focus === "acting") return 0.0;
    if (focus === "both") return 0.02;
    return 0.4;
  }
  if (focus === "tech") return 0.0;
  if (focus === "both") return 0.04;
  return 0.25;
}

function enhanceCandidate(
  candidate: AllocationCandidate,
  adjustedScore: number,
  fairnessPenalty: number,
): AllocationCandidate {
  return {
    ...candidate,
    adjustedScore: round(adjustedScore, 4),
    fairnessPenalty: round(fairnessPenalty, 4),
  };
}

function buildFairnessBuckets(
  candidates: Map<string, CandidateMeta>,
  totalSlots: number,
  focusSlack = 0.2,
  noviceSlack = 0.15,
): FairnessBucket[] {
  const focusTotals = new Map<FocusCategory, number>();
  const experienceTotals = new Map<ExperienceCategory, number>();

  candidates.forEach((meta) => {
    focusTotals.set(meta.focus, (focusTotals.get(meta.focus) ?? 0) + 1);
    experienceTotals.set(meta.experience, (experienceTotals.get(meta.experience) ?? 0) + 1);
  });

  const candidateCount = candidates.size || 1;
  const noviceShare = (experienceTotals.get("novice") ?? 0) / candidateCount;

  const bucketMap = new Map<string, FairnessBucket>();

  candidates.forEach((meta) => {
    const existing = bucketMap.get(meta.bucketId);
    if (existing) {
      existing.candidateCount += 1;
      existing.totalMaxAssignments += meta.maxAssignments;
      return;
    }
    bucketMap.set(meta.bucketId, {
      id: meta.bucketId,
      label: bucketLabel(meta.focus, meta.experience),
      focus: meta.focus,
      experience: meta.experience,
      candidateCount: 1,
      totalMaxAssignments: meta.maxAssignments,
      capacity: 0,
    });
  });

  bucketMap.forEach((bucket) => {
    if (bucket.candidateCount === 0 || totalSlots === 0) {
      bucket.capacity = 0;
      return;
    }
    const focusShare = (focusTotals.get(bucket.focus) ?? 0) / candidateCount;
    let allowedShare = Math.min(1, focusShare + focusSlack);
    if (bucket.experience === "novice") {
      allowedShare = Math.min(allowedShare, noviceShare + noviceSlack, 0.65);
    }
    const rawCapacity = Math.round(totalSlots * allowedShare);
    let capacity = Math.min(bucket.totalMaxAssignments, rawCapacity);
    if (capacity === 0) {
      capacity = Math.min(bucket.totalMaxAssignments, 1);
    }
    bucket.capacity = capacity;
  });

  const buckets = Array.from(bucketMap.values());
  const currentTotal = buckets.reduce((sum, bucket) => sum + bucket.capacity, 0);
  if (currentTotal < totalSlots) {
    let remaining = totalSlots - currentTotal;
    const adjustable = buckets
      .filter((bucket) => bucket.capacity < bucket.totalMaxAssignments)
      .sort((a, b) => b.totalMaxAssignments - a.totalMaxAssignments);
    for (const bucket of adjustable) {
      if (remaining <= 0) break;
      const additional = Math.min(bucket.totalMaxAssignments - bucket.capacity, remaining);
      bucket.capacity += additional;
      remaining -= additional;
    }
  }

  return buckets;
}

function prepareCandidates(roles: AllocationRole[]): Map<string, CandidateMeta> {
  const metaMap = new Map<string, CandidateMeta>();
  roles.forEach((role) => {
    role.candidates.forEach((candidate) => {
      if (candidate.normalizedShare <= 0) return;
      if (metaMap.has(candidate.userId)) {
        const existing = metaMap.get(candidate.userId)!;
        existing.maxAssignments = Math.max(
          existing.maxAssignments,
          candidate.focus === "both" ? 2 : 1,
        );
        return;
      }
      const focus = focusCategory(candidate.focus);
      const experience = experienceCategory(candidate.experienceYears);
      metaMap.set(candidate.userId, {
        userId: candidate.userId,
        focus,
        experience,
        bucketId: `${focus}:${experience}`,
        maxAssignments: candidate.focus === "both" ? 2 : 1,
      });
    });
  });
  return metaMap;
}

function roleSlots(roles: AllocationRole[]): SlotEntry[] {
  const slots: SlotEntry[] = [];
  roles.forEach((role) => {
    const slotCount = Math.max(0, role.capacity);
    for (let index = 0; index < slotCount; index += 1) {
      slots.push({
        slotId: `${role.roleId}#${index + 1}`,
        roleId: role.roleId,
        roleIndex: index,
      });
    }
  });
  return slots;
}

function createCandidateOptions(roles: AllocationRole[]): Map<string, RoleCandidateMap> {
  const options = new Map<string, RoleCandidateMap>();
  roles.forEach((role) => {
    const roleOptions: RoleCandidateMap = {};
    const maxScore = role.candidates.reduce((max, candidate) => Math.max(max, candidate.score), 0);
    role.candidates.forEach((candidate) => {
      if (candidate.normalizedShare <= 0) return;
      const normalizedScore = maxScore > 0 ? candidate.score / maxScore : 0;
      const fairnessPenalty = computeFocusPenalty(role.domain, candidate.focus);
      const adjustedScore = normalizedScore - fairnessPenalty;
      roleOptions[candidate.userId] = {
        candidate,
        adjustedScore,
        normalizedScore,
        fairnessPenalty,
      };
    });
    options.set(role.roleId, roleOptions);
  });
  return options;
}

interface SlotAssignmentMeta {
  slotId: string;
  roleId: string;
  roleIndex: number;
  candidateId: string;
  adjustedScore: number;
  normalizedScore: number;
  fairnessPenalty: number;
  candidate: AllocationCandidate;
  edge: EdgeReference;
}

const SCORE_SCALE = 1000;

export interface AllocationSlot {
  slotId: string;
  index: number;
  candidate: AllocationCandidate | null;
  adjustedScore: number | null;
  fairnessPenalty: number | null;
  alternatives: AllocationCandidate[];
}

export interface OptimizedRole extends AllocationRole {
  slots: AllocationSlot[];
  optimizedScore?: number;
  unmatchedDemand?: number;
}

export interface OptimizerFairnessBucket {
  bucketId: string;
  label: string;
  capacity: number;
  used: number;
  utilization: number;
}

export interface OptimizerSummary {
  totalSlots: number;
  totalAssignments: number;
  averageScore: number | null;
  fairnessBuckets: OptimizerFairnessBucket[];
}

export interface OptimizerConflict {
  roleId: string;
  label: string;
  slotIndex: number;
  delta: number;
  candidates: Array<{
    userId: string;
    name: string;
    score: number;
    tieBreaker: string;
  }>;
}

export interface AllocationOptimizerResult {
  roles: OptimizedRole[];
  conflicts: OptimizerConflict[];
  summary: OptimizerSummary;
}

export function optimizeRoleAllocation(roles: AllocationRole[]): AllocationOptimizerResult {
  const candidateMeta = prepareCandidates(roles);
  const slots = roleSlots(roles);
  const totalSlots = slots.length;
  const fairnessBuckets = buildFairnessBuckets(candidateMeta, totalSlots);

  const candidateList = Array.from(candidateMeta.values());
  const candidateIndex = new Map<string, number>();
  candidateList.forEach((meta, index) => {
    candidateIndex.set(meta.userId, index);
  });

  const slotOptions = new Map<string, CandidateOption[]>();
  const roleOptions = createCandidateOptions(roles);
  const assignmentEdges: SlotAssignmentMeta[] = [];

  const nodeCount = 1 + slots.length + candidateList.length + fairnessBuckets.length + 1;
  const source = 0;
  const slotOffset = 1;
  const candidateOffset = slotOffset + slots.length;
  const bucketOffset = candidateOffset + candidateList.length;
  const sink = nodeCount - 1;

  const flow = new MinCostMaxFlow(nodeCount);

  slots.forEach((slot, index) => {
    flow.addEdge(source, slotOffset + index, 1, 0);
  });

  candidateList.forEach((meta, index) => {
    const bucketIndex = fairnessBuckets.findIndex((bucket) => bucket.id === meta.bucketId);
    const targetNode = bucketOffset + (bucketIndex >= 0 ? bucketIndex : 0);
    const maxAssignments = Math.max(1, meta.maxAssignments);
    flow.addEdge(candidateOffset + index, targetNode, maxAssignments, 0);
  });

  const bucketEdgeRefs = new Map<string, EdgeReference>();
  fairnessBuckets.forEach((bucket, index) => {
    const edge = flow.addEdge(bucketOffset + index, sink, bucket.capacity, 0);
    bucketEdgeRefs.set(bucket.id, edge);
  });

  slots.forEach((slot, index) => {
    const role = roles.find((item) => item.roleId === slot.roleId);
    if (!role) return;
    const options = roleOptions.get(role.roleId) ?? {};
    Object.entries(options).forEach(([candidateId, option]) => {
      const candidateIdx = candidateIndex.get(candidateId);
      if (candidateIdx === undefined) return;
      const adjustedScore = option.adjustedScore;
      const cost = Math.round(-adjustedScore * SCORE_SCALE);
      const edge = flow.addEdge(
        slotOffset + index,
        candidateOffset + candidateIdx,
        1,
        cost,
        {
          type: "assignment",
          slotId: slot.slotId,
          roleId: slot.roleId,
          candidateId,
        },
      );
      const slotEntry = slotOptions.get(slot.slotId) ?? [];
      slotEntry.push(option);
      slotOptions.set(slot.slotId, slotEntry);
      assignmentEdges.push({
        slotId: slot.slotId,
        roleId: slot.roleId,
        roleIndex: slot.roleIndex,
        candidateId,
        adjustedScore: option.adjustedScore,
        normalizedScore: option.normalizedScore,
        fairnessPenalty: option.fairnessPenalty,
        candidate: option.candidate,
        edge,
      });
    });
  });

  flow.minCostMaxFlow(source, sink, totalSlots);

  const assignmentBySlot = new Map<string, SlotAssignmentMeta>();
  assignmentEdges.forEach((entry) => {
    const edge = flow.getEdge(entry.edge);
    const used = edge.originalCapacity - edge.capacity;
    if (used > 0) {
      assignmentBySlot.set(entry.slotId, entry);
    }
  });

  const optimizedRoles: OptimizedRole[] = roles.map((role) => {
    const roleCandidates = new Map<string, CandidateOption>();
    const options = roleOptions.get(role.roleId) ?? {};
    Object.entries(options).forEach(([candidateId, option]) => {
      roleCandidates.set(candidateId, option);
    });

    const slotEntries = slots.filter((slot) => slot.roleId === role.roleId);
    const slotsForRole: AllocationSlot[] = slotEntries.map((slot) => {
      const assignment = assignmentBySlot.get(slot.slotId) ?? null;
      const assignedCandidate = assignment
        ? enhanceCandidate(assignment.candidate, assignment.adjustedScore, assignment.fairnessPenalty)
        : null;
      const alternatives = (slotOptions.get(slot.slotId) ?? [])
        .filter((option) => !assignment || option.candidate.userId !== assignment.candidateId)
        .sort((a, b) => b.adjustedScore - a.adjustedScore)
        .slice(0, 3)
        .map((option) => {
          const candidateWithAdjustment = enhanceCandidate(
            option.candidate,
            option.adjustedScore,
            option.fairnessPenalty,
          );
          return {
            ...candidateWithAdjustment,
            delta: assignment ? round(assignment.adjustedScore - option.adjustedScore, 3) : undefined,
          };
        });
      return {
        slotId: slot.slotId,
        index: slot.roleIndex,
        candidate: assignedCandidate,
        adjustedScore: assignment ? round(assignment.adjustedScore, 3) : null,
        fairnessPenalty: assignment ? round(assignment.fairnessPenalty, 3) : null,
        alternatives,
      };
    });

    const assignedCount = slotsForRole.filter((slot) => slot.candidate).length;
    const optimizedScore = slotsForRole.reduce((sum, slot) => {
      if (!slot.candidate) return sum;
      const base = slot.candidate.score ?? 0;
      return sum + base;
    }, 0);

    const candidateListForRole = Array.from(roleCandidates.values())
      .map((option) => enhanceCandidate(option.candidate, option.adjustedScore, option.fairnessPenalty))
      .sort((a, b) => (b.adjustedScore ?? b.score) - (a.adjustedScore ?? a.score));

    return {
      ...role,
      candidates: candidateListForRole,
      slots: slotsForRole,
      optimizedScore: round(optimizedScore, 3),
      unmatchedDemand: Math.max(0, role.demand - assignedCount),
    } satisfies OptimizedRole;
  });

  const totalAssignments = Array.from(assignmentBySlot.values()).length;
  const totalAdjustedScore = Array.from(assignmentBySlot.values()).reduce(
    (sum, entry) => sum + entry.adjustedScore,
    0,
  );

  const conflicts: OptimizerConflict[] = [];
  optimizedRoles.forEach((role) => {
    role.slots.forEach((slot) => {
      if (!slot.candidate || slot.alternatives.length === 0) {
        return;
      }
      const bestAlternative = slot.alternatives[0];
      if (!bestAlternative.adjustedScore) {
        return;
      }
      const delta = Math.abs((slot.candidate.adjustedScore ?? slot.candidate.score) - bestAlternative.adjustedScore);
      if (delta <= 0.05) {
        conflicts.push({
          roleId: role.roleId,
          label: role.label,
          slotIndex: slot.index,
          delta: round(delta, 3),
          candidates: [slot.candidate, ...slot.alternatives.slice(0, 2)].map((candidate) => ({
            userId: candidate.userId,
            name: candidate.name,
            score: round(candidate.adjustedScore ?? candidate.score, 3),
            tieBreaker: `${candidate.justification}${candidate.delta !== undefined ? ` · Δ ${round(Math.abs(candidate.delta), 3)}` : ""}`.trim(),
          })),
        });
      }
    });
  });

  const fairnessSummary: OptimizerFairnessBucket[] = fairnessBuckets.map((bucket) => {
    const edgeRef = bucketEdgeRefs.get(bucket.id);
    if (!edgeRef) {
      return {
        bucketId: bucket.id,
        label: bucket.label,
        capacity: bucket.capacity,
        used: 0,
        utilization: 0,
      } satisfies OptimizerFairnessBucket;
    }
    const edge = flow.getEdge(edgeRef);
    const used = edge.originalCapacity - edge.capacity;
    const utilization = bucket.capacity > 0 ? used / bucket.capacity : 0;
    return {
      bucketId: bucket.id,
      label: bucket.label,
      capacity: bucket.capacity,
      used,
      utilization: round(utilization, 3),
    } satisfies OptimizerFairnessBucket;
  });

  const summary: OptimizerSummary = {
    totalSlots,
    totalAssignments,
    averageScore: totalAssignments > 0 ? round(totalAdjustedScore / totalAssignments, 3) : null,
    fairnessBuckets: fairnessSummary,
  };

  const sortedConflicts = conflicts
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 12);

  return {
    roles: optimizedRoles,
    conflicts: sortedConflicts,
    summary,
  };
}
