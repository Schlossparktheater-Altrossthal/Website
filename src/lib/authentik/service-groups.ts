/**
 * Abgleich SSO.*-Berechtigungen -> Authentik-Dienst-Gruppen.
 *
 * Der Mitgliederbereich entscheidet, wer einen Dienst (z. B. Nextcloud) nutzen
 * darf: Rechteverwaltung, Rollen und Gewerke wie bei allen anderen Rechten.
 * Welche Gruppe welche Anwendung öffnet, steht im Authentik-Blueprint (Gruppe
 * mit Attribut `mitgliederbereich.permission` plus Policy-Binding). Hier werden
 * nur die Mitgliedschaften verwalteter Konten gepflegt; manuell eingetragene
 * Konten außerhalb des Mitgliederbereich-Pfads bleiben unberührt.
 *
 * Rechte ändern sich an vielen Stellen (Rollen, Gewerke, Rechtematrix,
 * Deaktivierung), deshalb gleicht der Mitgliederbereich regelmäßig komplett ab
 * und zusätzlich kurz nach den wichtigsten Änderungen.
 */
import {
  getAuthentikMemberId,
  listAuthentikServiceGroups,
  listManagedAuthentikUsers,
  setAuthentikGroupMembership,
  type AuthentikUser,
} from "@/lib/authentik/client";
import { isAuthentikProvisioningEnabled } from "@/lib/authentik/config";
import { createLogger } from "@/lib/logger";
import { getUserPermissionKeys, isKnownPermissionKey } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const logger = createLogger("authentik-service-groups");

const SYNC_INTERVAL_MS = 10 * 60 * 1000;
const SYNC_DEBOUNCE_MS = 5 * 1000;

export type ServiceGroupSyncResult = { added: number; removed: number; failed: number };

/** Berechtigungen je Profil-ID; deaktivierte und gelöschte Profile haben keine. */
async function loadMemberPermissions(memberIds: string[]): Promise<Map<string, Set<string>>> {
  const members = await prisma.user.findMany({
    where: { id: { in: memberIds }, deactivatedAt: null },
    select: { id: true },
  });
  const result = new Map<string, Set<string>>();
  for (const member of members) {
    result.set(member.id, new Set(await getUserPermissionKeys({ id: member.id })));
  }
  return result;
}

export async function reconcileServiceGroups(): Promise<ServiceGroupSyncResult> {
  const result: ServiceGroupSyncResult = { added: 0, removed: 0, failed: 0 };
  const groups = (await listAuthentikServiceGroups()).filter((group) => {
    if (isKnownPermissionKey(group.permission)) return true;
    console.warn(
      `[authentik] Gruppe "${group.name}" verweist auf unbekannte Berechtigung ${group.permission}`,
    );
    return false;
  });
  if (groups.length === 0) return result;

  const users = await listManagedAuthentikUsers();
  const memberIdByPk = new Map<number, string>();
  for (const user of users) {
    const memberId = getAuthentikMemberId(user);
    if (memberId) memberIdByPk.set(user.pk, memberId);
  }
  const permissions = await loadMemberPermissions(Array.from(new Set(memberIdByPk.values())));

  for (const group of groups) {
    const current = new Set(group.userPks);
    for (const user of users) {
      const memberId = memberIdByPk.get(user.pk);
      const wanted = Boolean(memberId && permissions.get(memberId)?.has(group.permission));
      if (wanted === current.has(user.pk)) continue;
      try {
        await setAuthentikGroupMembership(group, user, wanted);
        if (wanted) result.added += 1;
        else result.removed += 1;
      } catch (error) {
        result.failed += 1;
        await logMembershipError(group.name, user, error);
      }
    }
  }
  return result;
}

async function logMembershipError(groupName: string, user: AuthentikUser, error: unknown) {
  console.error(`[authentik] Gruppe ${groupName} für ${user.username} nicht abgeglichen`, error);
  await logger.error("Abgleich der Dienst-Gruppe fehlgeschlagen", {
    description: `${groupName}: ${getAuthentikMemberId(user) ?? user.username}`,
    error: error instanceof Error ? error.message : String(error),
  });
}

type SyncState = {
  running: Promise<void> | null;
  rerun: boolean;
  debounce: ReturnType<typeof setTimeout> | null;
  interval: ReturnType<typeof setInterval> | null;
};

// Über globalThis, damit Hot-Reload und mehrere Modul-Instanzen nur einen
// Abgleich gleichzeitig starten.
const globalForSync = globalThis as typeof globalThis & { __serviceGroupSync?: SyncState };
const state: SyncState = (globalForSync.__serviceGroupSync ??= {
  running: null,
  rerun: false,
  debounce: null,
  interval: null,
});

function runSync(): void {
  if (state.running) {
    state.rerun = true;
    return;
  }
  state.running = (async () => {
    try {
      const result = await reconcileServiceGroups();
      if (result.added || result.removed || result.failed) {
        await logger.info("Dienst-Gruppen abgeglichen", {
          description: `+${result.added} / -${result.removed} / Fehler ${result.failed}`,
        });
      }
    } catch (error) {
      console.error("[authentik] Abgleich der Dienst-Gruppen fehlgeschlagen", error);
    } finally {
      state.running = null;
      if (state.rerun) {
        state.rerun = false;
        runSync();
      }
    }
  })();
}

/**
 * Nach Änderungen an Rechten, Rollen oder dem Status eines Mitglieds aufrufen.
 * Mehrere Aufrufe kurz hintereinander lösen nur einen Abgleich aus.
 */
export function requestServiceGroupSync(): void {
  if (!isAuthentikProvisioningEnabled()) return;
  if (state.debounce) clearTimeout(state.debounce);
  state.debounce = setTimeout(() => {
    state.debounce = null;
    runSync();
  }, SYNC_DEBOUNCE_MS);
  state.debounce.unref?.();
}

/** Regelmäßiger Komplettabgleich, gestartet in instrumentation.ts. */
export function startServiceGroupSyncSchedule(): void {
  if (!isAuthentikProvisioningEnabled() || state.interval) return;
  state.interval = setInterval(runSync, SYNC_INTERVAL_MS);
  state.interval.unref?.();
  requestServiceGroupSync();
}
