interface InsertError { code?: string; message: string }
interface InsertResponse { error: InsertError | null }
interface BatchResult { imported: number; errors: string[]; uncertain: boolean }

/** Retry only an atomic batch rejected by a known PostgreSQL integrity constraint. */
export async function insertImportBatch<T>(
  rows: T[],
  insert: (rows: T[], signal: AbortSignal) => PromiseLike<InsertResponse>,
  timeoutMs = 20000
): Promise<BatchResult> {
  const send = async (payload: T[]): Promise<InsertResponse> => {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(() => insert(payload, controller.signal)),
        new Promise<InsertResponse>(resolve => {
          timeout = setTimeout(() => {
            controller.abort();
            resolve({ error: { message: 'Délai de réponse dépassé' } });
          }, timeoutMs);
        }),
      ]);
    } catch (error) {
      return { error: { message: error instanceof Error ? error.message : String(error) } };
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  };
  const unknownOutcome = (imported: number): BatchResult => ({
    imported, uncertain: true,
    errors: ['Résultat de l’import incertain après une interruption réseau. Rechargez les transactions et vérifiez les opérations reçues avant de relancer l’import.'],
  });
  const isIntegrityRejection = (error: InsertError) => /^23[0-9A-Z]{3}$/.test(error.code || '');
  const batch = await send(rows);
  if (!batch.error) return { imported: rows.length, errors: [], uncertain: false };
  if (!isIntegrityRejection(batch.error)) return unknownOutcome(0);

  let imported = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const result = await send([row]);
    if (!result.error) imported++;
    else if (isIntegrityRejection(result.error)) errors.push(`Opération refusée : ${result.error.message}`);
    else return { ...unknownOutcome(imported), errors: [...errors, ...unknownOutcome(0).errors] };
  }
  return { imported, errors, uncertain: false };
}
