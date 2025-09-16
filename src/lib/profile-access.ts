import { Role } from '@prisma/client';

// Definiert, wer auf welche Profilinformationen zugreifen darf
export const profileAccessRights = {
  // Maße (measurements)
  measurements: {
    read: (userRole: Role) => ['admin', 'board'].includes(userRole),
    write: (userRole: Role) => ['admin', 'board'].includes(userRole),
  },
  
  // Konfektionsgrößen (sizes)
  sizes: {
    read: (userRole: Role) => ['admin', 'board'].includes(userRole),
    write: (userRole: Role) => ['admin', 'board'].includes(userRole),
  },
  
  // Allergien und Unverträglichkeiten (dietary)
  dietary: {
    read: (userRole: Role) => ['admin', 'board'].includes(userRole),
    write: (userRole: Role) => ['admin', 'board'].includes(userRole),
  },
};

// Prüft, ob ein Benutzer Zugriff auf bestimmte Profilinformationen hat
export function canAccessProfileData(
  dataType: 'measurements' | 'sizes' | 'dietary',
  action: 'read' | 'write',
  userRole?: Role
): boolean {
  if (!userRole) return false;
  
  const accessRights = profileAccessRights[dataType];
  if (!accessRights) return false;
  
  return accessRights[action](userRole);
}

// Prüft, ob ein Benutzer seine eigenen Daten bearbeiten darf
export function canEditOwnProfileData(
  dataType: 'measurements' | 'sizes' | 'dietary',
  userRole?: Role
): boolean {
  // Eigene Allergien/Unverträglichkeiten darf jeder bearbeiten
  if (dataType === 'dietary') return true;
  
  // Maße und Größen nur durch berechtigte Rollen
  return canAccessProfileData(dataType, 'write', userRole);
}