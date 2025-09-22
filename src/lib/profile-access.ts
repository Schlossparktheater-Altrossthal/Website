import { hasPermission, PROFILE_DATA_PERMISSION_KEYS } from '@/lib/permissions';

const PROFILE_PERMISSION_MATRIX = {
  measurements: {
    read: PROFILE_DATA_PERMISSION_KEYS.measurements,
    write: PROFILE_DATA_PERMISSION_KEYS.measurements,
  },
  sizes: {
    read: PROFILE_DATA_PERMISSION_KEYS.sizes,
    write: PROFILE_DATA_PERMISSION_KEYS.sizes,
  },
  dietary: {
    read: PROFILE_DATA_PERMISSION_KEYS.dietary,
    write: PROFILE_DATA_PERMISSION_KEYS.dietary,
  },
} as const;

type ProfilePermissionMatrix = typeof PROFILE_PERMISSION_MATRIX;

type ProfilePermissionUser = Parameters<typeof hasPermission>[0];

export type ProfileDataType = keyof ProfilePermissionMatrix;
export type ProfilePermissionAction = keyof ProfilePermissionMatrix[ProfileDataType];

function getProfilePermissionKey(
  dataType: ProfileDataType,
  action: ProfilePermissionAction
) {
  const entry = PROFILE_PERMISSION_MATRIX[dataType];
  return entry?.[action];
}

function checkProfilePermission(
  dataType: ProfileDataType,
  action: ProfilePermissionAction,
  user?: ProfilePermissionUser
) {
  const permissionKey = getProfilePermissionKey(dataType, action);
  if (!permissionKey) {
    return Promise.resolve(false);
  }
  return hasPermission(user, permissionKey);
}

export function canReadProfileData(
  dataType: ProfileDataType,
  user?: ProfilePermissionUser
): Promise<boolean> {
  return checkProfilePermission(dataType, 'read', user);
}

export function canWriteProfileData(
  dataType: ProfileDataType,
  user?: ProfilePermissionUser
): Promise<boolean> {
  return checkProfilePermission(dataType, 'write', user);
}

export function canAccessProfileData(
  dataType: ProfileDataType,
  action: ProfilePermissionAction,
  user?: ProfilePermissionUser
): Promise<boolean> {
  return checkProfilePermission(dataType, action, user);
}

export async function canEditOwnProfileData(
  dataType: ProfileDataType,
  user?: ProfilePermissionUser
): Promise<boolean> {
  if (!user?.id) {
    return false;
  }

  if (dataType === 'dietary') {
    return true;
  }

  return canWriteProfileData(dataType, user);
}

export const profileAccessRights = {
  measurements: {
    read: (user?: ProfilePermissionUser) => canReadProfileData('measurements', user),
    write: (user?: ProfilePermissionUser) => canWriteProfileData('measurements', user),
  },
  sizes: {
    read: (user?: ProfilePermissionUser) => canReadProfileData('sizes', user),
    write: (user?: ProfilePermissionUser) => canWriteProfileData('sizes', user),
  },
  dietary: {
    read: (user?: ProfilePermissionUser) => canReadProfileData('dietary', user),
    write: (user?: ProfilePermissionUser) => canWriteProfileData('dietary', user),
  },
} as const;
