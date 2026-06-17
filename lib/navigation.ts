export function isSafeInternalPath(
  value: string | null | undefined
): value is string {
  if (!value) return false;

  const trimmed = value.trim();
  const lowerValue = trimmed.toLowerCase();

  return (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !lowerValue.includes("http://") &&
    !lowerValue.includes("https://")
  );
}

export function withBackFrom(targetHref: string, currentPath: string) {
  if (!isSafeInternalPath(currentPath)) return targetHref;

  const separator = targetHref.includes("?") ? "&" : "?";

  return `${targetHref}${separator}from=${encodeURIComponent(currentPath)}`;
}
