export type StaffRole = "owner" | "admin";

export type StaffProfile = {
  id: string;
  email: string;
  role: StaffRole;
  active: boolean;
  expiresAt?: number;
};

export function isOwner(profile: StaffProfile | null) {
  return profile?.role === "owner";
}

export function isAdminOrOwner(profile: StaffProfile | null) {
  return profile?.role === "owner" || profile?.role === "admin";
}