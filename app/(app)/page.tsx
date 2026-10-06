import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { signedUrls } from '@/lib/renders';
import { currentUser } from '@/lib/team';

export const metadata = { title: 'Gallery · Archy Studio' };
export const dynamic = 'force-dynamic';

type Row = { id: string; template: string; format: string; storage_path: string; width: number; height: number; created_at: string; user_id: string | null; profiles: { email: string; full_name: string | null } | null };

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ mine?: string }> }) {
  const { mine } = await searchParams;
  const me = await currentUser();
  let q = supabaseAdmin().from('renders').select('id, template, format, storage_path, width, height, created_at, user_id, profiles(email, full_name)').order('created_at', { ascending: false }).limit(60);
  if (mine && me) q = q.eq('user_id', me.id);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];
  const urls = await signedUrls(rows.map((r) => r.storage_path));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Gallery</h1>
          <p className="mt-1 text-muted-foreground">Every piece the team made with Studio, newest first.</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <Button size="sm" variant={mine ? 'ghost' : 'secondary'} nativeButton={false} render={<Link href="/" />}>Everyone</Button>
          <Button size="sm" variant={mine ? 'secondary' : 'ghost'} nativeButton={false} render={<Link href="/?mine=1" />}>Mine</Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No pieces yet. Ask Claude for one with the Archy Studio plugin.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 items-start gap-4 md:grid-cols-3 lg:grid-cols-4">
          {rows.map((r) => (
            <Card key={r.id} className="gap-3 overflow-hidden py-0">
              <a href={urls[r.storage_path]} target="_blank" rel="noreferrer" className="block bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urls[r.storage_path]} alt={`${r.template} ${r.format}`} loading="lazy" className="w-full object-contain" style={{ aspectRatio: `${r.width} / ${r.height}` }} />
              </a>
              <CardContent className="space-y-1 px-3 pb-3">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{r.template.replace(/-/g, ' ')}</span>
                  <Badge variant="secondary" className="ml-auto capitalize">{r.format}</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {r.profiles?.full_name ?? r.profiles?.email ?? 'Before sign-in'} · {new Date(r.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
