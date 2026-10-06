// Gallery shapes shared by the server loader and the client grid.

export type Piece = {
  id: string; template: string; title: string; format: string; width: number; height: number; scale: number;
  slots: Record<string, string | null>; created_at: string;
  user_id: string | null; author: string; project_id: string | null; thumb?: string; file?: string;
};

// Gallery types: Square counts as a feed post.
export const TYPES = [
  { key: 'post', label: 'Post', formats: ['post', 'square'] },
  { key: 'story', label: 'Story', formats: ['stories'] },
  { key: 'og', label: 'OG', formats: ['og'] },
  { key: 'cover', label: 'Cover', formats: ['cover'] },
];

export const formatLabel = (f: string) => (f === 'og' ? 'OG' : f[0].toUpperCase() + f.slice(1));

// "speaker-name" → "Speaker name"
export const humanize = (k: string) => (k.charAt(0).toUpperCase() + k.slice(1)).replace(/-/g, ' ');
