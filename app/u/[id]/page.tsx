import { BrandLockup } from '@/components/brand-lockup';
import { getAsset } from '@/lib/assets';
import { BRANDS } from '@/lib/brands';
import { getPhotoRequest } from '@/lib/photo-requests';
import { PhotoDrop } from './photo-drop';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Add photos · Studio' };

// A photo link Claude gave (request_photos): one drop zone per photo the design needs.
export default async function PhotoLink({ params }: { params: Promise<{ id: string }> }) {
  const req = await getPhotoRequest((await params).id);
  const items = req ? await Promise.all(req.items.map(async (i) => ({ key: i.key, label: i.label, cutout: i.cutout, thumb: i.asset_id ? (await getAsset(i.asset_id))?.thumb ?? null : null }))) : [];
  return (
    <main className="grid min-h-dvh place-items-center bg-[#FAFAFA] px-4 py-10">
      <div className="w-full max-w-[420px] space-y-6 rounded-md border border-foreground/[0.07] bg-background p-8 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <BrandLockup brand={req?.brand ?? 'archy'} label={false} />
        {!req ? (
          <p className="text-[14px] text-muted-foreground">This link does not exist.</p>
        ) : req.expired ? (
          <p className="text-[14px] text-muted-foreground">This link has expired. Ask Claude for a new one.</p>
        ) : (
          <>
            <div className="space-y-1">
              <h1 className="text-[18px] font-medium">Add {items.length === 1 ? 'the photo' : 'the photos'}</h1>
              <p className="text-[13px] text-muted-foreground">They go to {BRANDS[req.brand].name} Assets.</p>
            </div>
            <PhotoDrop id={req.id} items={items} />
          </>
        )}
      </div>
    </main>
  );
}
