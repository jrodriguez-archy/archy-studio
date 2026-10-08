'use server';

import { loadPieces, type Piece, type PieceFilter } from '@/lib/gallery';
import { currentUser } from '@/lib/team';

const ID = /^[0-9a-f-]{36}$/i;
const clean = (f: PieceFilter): PieceFilter => ({
  userId: f.userId && ID.test(f.userId) ? f.userId : undefined,
  projectId: f.projectId && ID.test(f.projectId) ? f.projectId : undefined,
  archived: !!f.archived,
});

// The next page of the gallery: designs older than `before`.
export async function morePiecesAction(filter: PieceFilter, before: string): Promise<Piece[]> {
  if (!(await currentUser())) return [];
  return loadPieces({ ...clean(filter), before });
}

// One set as it is now, for a live update (empty when it no longer belongs to this view).
export async function setPiecesAction(filter: PieceFilter, setId: string): Promise<Piece[]> {
  if (!(await currentUser()) || !ID.test(setId)) return [];
  return loadPieces({ ...clean(filter), setId }, 50);
}
