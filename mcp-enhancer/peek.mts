// Read-only look at a piece and its Canvas draft: node --conditions=react-server … peek.mts <piece-id>
import { supabaseAdmin } from '../lib/supabase/admin';
const id = process.argv[2];
const sb = supabaseAdmin();
const { data: piece } = await sb.from('renders').select('id, template, format, design, theme, set_id, slots, edits, created_at, user_id').eq('id', id).maybeSingle();
const { data: draft } = await sb.from('canvas_drafts').select('*').eq('piece_id', id).maybeSingle();
console.log(JSON.stringify({ piece, draft }, null, 1));
process.exit(0);
