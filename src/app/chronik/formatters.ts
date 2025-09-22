export function formatChronikPlayerName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "";
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0];
  }

  const lastName = parts.pop() ?? "";
  const lastInitial = lastName.charAt(0);
  const firstNames = parts.join(" ");
  if (!lastInitial) {
    return trimmed;
  }

  return `${firstNames} ${lastInitial}.`;
}
