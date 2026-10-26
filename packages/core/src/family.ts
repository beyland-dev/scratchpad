/** Minimal shape needed to arrange prototypes into variant families. Free of Node APIs so the web UI can share it. */
export interface FamilyMember {
  id: string;
  variantOf?: string;
  createdAt: string;
}

function byCreation(a: FamilyMember, b: FamilyMember): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

/** Follow `variantOf` links to the original prototype, guarding against missing parents and cycles. */
export function familyRootId<T extends FamilyMember>(
  index: ReadonlyMap<string, T>,
  id: string,
): string {
  const path = [id];
  while (true) {
    const current = path[path.length - 1]!;
    const parent = index.get(current)?.variantOf;
    if (!parent || !index.has(parent)) return current;
    const loopStart = path.indexOf(parent);
    if (loopStart !== -1) {
      // Cycle: pick the oldest member so every entry point resolves to the same root.
      return path
        .slice(loopStart)
        .map((member) => index.get(member)!)
        .sort(byCreation)[0]!.id;
    }
    path.push(parent);
  }
}

/**
 * Group prototypes into variant families. Each family is ordered oldest → newest,
 * so the last member is the latest version.
 */
export function groupFamilies<T extends FamilyMember>(items: readonly T[]): T[][] {
  const index = new Map(items.map((p) => [p.id, p]));
  const families = new Map<string, T[]>();
  for (const item of items) {
    const root = familyRootId(index, item.id);
    const family = families.get(root);
    if (family) family.push(item);
    else families.set(root, [item]);
  }
  return [...families.values()].map((family) => family.sort(byCreation));
}

/** The variant family containing `id`, oldest → newest. Empty if `id` is unknown. */
export function familyOf<T extends FamilyMember>(items: readonly T[], id: string): T[] {
  const index = new Map(items.map((p) => [p.id, p]));
  if (!index.has(id)) return [];
  const root = familyRootId(index, id);
  return items.filter((p) => familyRootId(index, p.id) === root).sort(byCreation);
}

/** Display label for a family member: V1, V2, … and "Latest" for the newest. */
export function versionLabel(position: number, familySize: number): string {
  return familySize > 1 && position === familySize - 1 ? "Latest" : `V${position + 1}`;
}
