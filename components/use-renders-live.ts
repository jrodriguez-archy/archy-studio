'use client';

import { useEffect, useRef } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

// New designs, new versions and replaced images, live: `onChange` runs (once per burst) whenever a
// design is added or changed, by this person, someone else on the team or Claude. It gets the sets that
// changed (and the ids of designs deleted for good), so a view can update just those.
export type RendersChange = { sets: string[]; deleted: string[] };
export function useRendersLive(onChange: (change: RendersChange) => void, enabled = true) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    if (!enabled) return;
    const db = supabaseBrowser();
    let channel: ReturnType<typeof db.channel> | null = null;
    let gone = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let sets = new Set<string>(), deleted = new Set<string>();
    (async () => {
      // The gallery is readable by signed-in people only (RLS): Realtime needs the session's token.
      const { data } = await db.auth.getSession();
      if (gone) return;
      db.realtime.setAuth(data.session?.access_token ?? null);
      channel = db.channel(`renders:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'renders' }, (e) => {
          const row = e.new as { id?: string; set_id?: string | null };
          if (e.eventType === 'DELETE') { const id = (e.old as { id?: string }).id; if (id) deleted.add(id); }
          else if (row.id) sets.add(row.set_id ?? row.id);
          clearTimeout(timer);
          timer = setTimeout(() => {
            const change = { sets: [...sets], deleted: [...deleted] };
            sets = new Set(); deleted = new Set();
            cb.current(change);
          }, 600);
        })
        .subscribe();
    })();
    return () => { gone = true; clearTimeout(timer); if (channel) db.removeChannel(channel); };
  }, [enabled]);
}
