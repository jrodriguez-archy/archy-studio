'use client';

import { useEffect, useRef } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

// New designs, new versions and replaced images, live: `onChange` runs (once per burst) whenever a
// design is added or changed, by this person, someone else on the team or Claude.
export function useRendersLive(onChange: () => void, enabled = true) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    if (!enabled) return;
    const db = supabaseBrowser();
    let channel: ReturnType<typeof db.channel> | null = null;
    let gone = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      // The gallery is readable by signed-in people only (RLS): Realtime needs the session's token.
      const { data } = await db.auth.getSession();
      if (gone) return;
      db.realtime.setAuth(data.session?.access_token ?? null);
      channel = db.channel(`renders:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'renders' }, () => {
          clearTimeout(timer);
          timer = setTimeout(() => cb.current(), 600);
        })
        .subscribe();
    })();
    return () => { gone = true; clearTimeout(timer); if (channel) db.removeChannel(channel); };
  }, [enabled]);
}
