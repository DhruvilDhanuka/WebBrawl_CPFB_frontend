import LZString from "lz-string";

/**
 * Encodes a group object into a compressed, URL-safe string.
 */
export function encodeGroupToUrl(group) {
  if (!group) return "";

  const cleanGroup = {
    id: group.id,
    name: group.name,
    members: group.members || {},
    expenses: (group.expenses || []).map((exp) => ({
      id: exp.id,
      description: exp.description,
      amount: exp.amount,
      payerId: exp.payerId,
      participantIds: exp.participantIds || [],
      shares: exp.shares || null,
      date: exp.date,
    })),
    createdAt: group.createdAt || new Date().toISOString(),
  };

  const json = JSON.stringify(cleanGroup);
  return LZString.compressToEncodedURIComponent(json);
}

/**
 * Decodes a compressed URL-safe string back into a group object.
 */
export function decodeGroupFromUrl(encodedData) {
  if (!encodedData) return null;

  try {
    const json = LZString.decompressFromEncodedURIComponent(encodedData);
    if (!json) return null;
    const group = JSON.parse(json);
    if (!group || !group.id || !group.name) return null;
    return group;
  } catch (err) {
    console.error("Failed to decode group from URL:", err);
    return null;
  }
}
