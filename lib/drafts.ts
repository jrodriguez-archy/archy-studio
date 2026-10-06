import 'server-only';
import { cleanEdits, type Edits } from './canvas-shared';
import { supabaseAdmin } from './supabase/admin';

// Canvas drafts: the work in progress on a piece, kept as people (or Claude) edit; Realtime sends
// Claude's changes to the open Canvas. Saving the piece clears it.

export type Draft = { piece_id: string; user_id: string | null; slots: Record<string, string | null>; edits: Edits; version: number; updated_by: string; note: string | null; updated_at: string };

export async function getDraft(pieceId: string): Promise<Draft | null> {
  if (!/^[0-9a-f-]{36}$/i.test(pieceId)) return null;
  const { data } = await supabaseAdmin().from('canvas_drafts').select('*').eq('piece_id', pieceId).maybeSingle();
  return (data as Draft | null) ?? null;
}

export async function saveDraft(input: { pieceId: string; userId: string; slots: Record<string, string | null>; edits: Edits; by: 'app' | 'claude'; note?: string | null }): Promise<number> {
  const prev = await getDraft(input.pieceId);
  const version = (prev?.version ?? 0) + 1;
  const { error } = await supabaseAdmin().from('canvas_drafts').upsert({
    piece_id: input.pieceId, user_id: input.by === 'app' ? input.userId : prev?.user_id ?? input.userId, slots: input.slots, edits: cleanEdits(input.edits),
    version, updated_by: input.by, note: input.note ?? null, updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Could not keep the draft: ${error.message}`);
  return version;
}

export async function clearDraft(pieceId: string) {
  await supabaseAdmin().from('canvas_drafts').delete().eq('piece_id', pieceId);
}

