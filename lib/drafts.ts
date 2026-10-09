import 'server-only';
import { cleanEdits, type Edits } from './canvas-shared';
import { supabaseAdmin } from './supabase/admin';

// Canvas drafts: the work in progress on a piece, kept as people (or Claude) edit; Realtime sends
// Claude's changes to the open Canvas. Saving the piece clears it.

/** A format added in Canvas and not saved yet ("new:<template>:<format>…"), kept on the set's first saved format. */
export type AddedFormat = { ref: string; slots: Record<string, string | null>; edits: Edits };
export type Draft = { piece_id: string; user_id: string | null; slots: Record<string, string | null>; edits: Edits; version: number; updated_by: string; note: string | null; updated_at: string; claude_working_at: string | null; claude_status: string | null; added: AddedFormat[] };

export async function getDraft(pieceId: string): Promise<Draft | null> {
  if (!/^[0-9a-f-]{36}$/i.test(pieceId)) return null;
  const { data } = await supabaseAdmin().from('canvas_drafts').select('*').eq('piece_id', pieceId).maybeSingle();
  return (data as Draft | null) ?? null;
}

// `added`: the formats added and not saved yet; left as they were when not given (Claude's edits).
export async function saveDraft(input: { pieceId: string; userId: string; slots: Record<string, string | null>; edits: Edits; by: 'app' | 'claude'; note?: string | null; added?: AddedFormat[] }): Promise<number> {
  const prev = await getDraft(input.pieceId);
  const version = (prev?.version ?? 0) + 1;
  const { error } = await supabaseAdmin().from('canvas_drafts').upsert({
    piece_id: input.pieceId, user_id: input.by === 'app' ? input.userId : prev?.user_id ?? input.userId, slots: input.slots, edits: cleanEdits(input.edits),
    version, updated_by: input.by, note: input.note ?? null, updated_at: new Date().toISOString(),
    ...(input.added ? { added: input.added.map((a) => ({ ref: a.ref, slots: a.slots, edits: cleanEdits(a.edits) })) } : {}),
    // Claude's edit has landed: it is no longer "working".
    ...(input.by === 'claude' ? { claude_working_at: null, claude_status: null } : {}),
  });
  if (error) throw new Error(`Could not keep the draft: ${error.message}`);
  return version;
}

export async function clearDraft(pieceId: string) {
  await supabaseAdmin().from('canvas_drafts').delete().eq('piece_id', pieceId);
}


// Claude's presence on the design open in Canvas (shown live on the artboard). With no draft yet, one
// is started from the design as it is, so the open Canvas hears about it.
export async function markClaude(input: { pieceId: string; userId: string; slots: Record<string, string | null>; edits: Edits; status: string | null }) {
  const db = supabaseAdmin();
  const at = input.status ? new Date().toISOString() : null;
  const prev = await getDraft(input.pieceId);
  if (prev) {
    await db.from('canvas_drafts').update({ claude_working_at: at, claude_status: input.status }).eq('piece_id', input.pieceId);
    return;
  }
  if (!input.status) return;
  await db.from('canvas_drafts').upsert({
    piece_id: input.pieceId, user_id: input.userId, slots: input.slots, edits: cleanEdits(input.edits), version: 0, updated_by: 'app',
    claude_working_at: at, claude_status: input.status,
  });
}
