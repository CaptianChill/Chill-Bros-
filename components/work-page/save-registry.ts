// Lets the Work Page's sticky SAVE buttons flush every section that holds
// unsaved text (diagnosis notes, repair report) before refreshing or leaving.
type Saver = () => Promise<boolean>;

const savers = new Set<Saver>();

export function registerSaver(saver: Saver) {
  savers.add(saver);
  return () => {
    savers.delete(saver);
  };
}

/** Resolves true when every registered section saved (or had nothing to save). */
export async function flushAllSavers() {
  const results = await Promise.all(Array.from(savers, (save) => save().catch(() => false)));
  return results.every(Boolean);
}
