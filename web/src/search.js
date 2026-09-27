// Prefix matches (on name or any alias) rank before contains matches.
export function searchCatalog(query, catalog, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const prefixMatches = [];
  const containsMatches = [];

  for (const it of catalog) {
    const names = [it.name, ...it.aliases].map((n) => n.toLowerCase());
    const isPrefix = names.some((n) => n.startsWith(q));
    if (isPrefix) {
      prefixMatches.push(it);
      continue;
    }
    const isContains = names.some((n) => n.includes(q));
    if (isContains) containsMatches.push(it);
  }

  return [...prefixMatches, ...containsMatches].slice(0, limit);
}
