export const buildDeterministicCallRoomId = (firstUniqueId: string, secondUniqueId: string) => {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");

  const [a, b] = [normalize(firstUniqueId), normalize(secondUniqueId)].sort((left, right) => left.localeCompare(right));

  return `${a}_${b}`;
};
