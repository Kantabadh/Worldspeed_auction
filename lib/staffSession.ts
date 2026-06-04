export type StaffRole = "owner" | "admin" | "stock_staff";

export type StaffProfile = {
  id: string;
  email: string;
  role: StaffRole;
  active: boolean;
  branch_code?: string | null;
  branch_name?: string | null;
  expiresAt?: number;
  checkedAt?: number;
};

export const ADMIN_SESSION_TIMEOUT_MS = 30 * 60 * 1000;
export const STAFF_TIMEOUT_MS = ADMIN_SESSION_TIMEOUT_MS;

const STAFF_PROFILE_KEY = "staffProfile";

let staffProfileCache: StaffProfile | null = null;

export function isStaffProfileUsable(profile?: StaffProfile | null) {
  return Boolean(
    profile?.id &&
      profile.email &&
      profile.role &&
      profile.active &&
      (!profile.expiresAt || Date.now() <= profile.expiresAt)
  );
}

export function isStaffRoleAllowed(
  profile: StaffProfile | null,
  allowedRoles: StaffRole[]
) {
  return Boolean(profile && allowedRoles.includes(profile.role));
}

export function getCachedStaffProfile() {
  if (isStaffProfileUsable(staffProfileCache)) {
    return staffProfileCache;
  }

  if (typeof window === "undefined") {
    return null;
  }

  const savedProfileText = localStorage.getItem(STAFF_PROFILE_KEY);

  if (!savedProfileText) {
    staffProfileCache = null;
    return null;
  }

  try {
    const savedProfile = JSON.parse(savedProfileText) as StaffProfile;

    if (!isStaffProfileUsable(savedProfile)) {
      clearCachedStaffProfile();
      return null;
    }

    staffProfileCache = savedProfile;
    return savedProfile;
  } catch {
    clearCachedStaffProfile();
    return null;
  }
}

export function getMemoryCachedStaffProfile() {
  return isStaffProfileUsable(staffProfileCache) ? staffProfileCache : null;
}

export function saveCachedStaffProfile(profile: StaffProfile) {
  const updatedProfile = {
    ...profile,
    checkedAt: Date.now(),
    expiresAt: Date.now() + STAFF_TIMEOUT_MS,
  };

  staffProfileCache = updatedProfile;

  if (typeof window !== "undefined") {
    localStorage.setItem(STAFF_PROFILE_KEY, JSON.stringify(updatedProfile));
  }

  return updatedProfile;
}

export function clearCachedStaffProfile() {
  staffProfileCache = null;

  if (typeof window !== "undefined") {
    localStorage.removeItem(STAFF_PROFILE_KEY);
  }
}
