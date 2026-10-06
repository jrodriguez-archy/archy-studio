'use client';

import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { Download04Icon } from '@hugeicons/core-free-icons';
import { InfoRows, Inspector, StageImage, useInspector } from '@/components/inspector';
import { PieceMenu } from '@/components/piece-menu';
import type { ProjectLink } from '@/components/projects-nav';
import { formatLabel, humanize, type Piece } from '@/lib/gallery-shared';

const day = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const when = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// Masonry of finished pieces. A click opens the piece in place; hover shows download and, for
// pieces you can organise, the project menu.
export function PieceGrid({ pieces, projects, me, showProject = true }: { pieces: Piece[]; projects: ProjectLink[]; me: { id: string; is_admin: boolean }; showProject?: boolean }) {
  const names = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const { openId, open, close, step } = useInspector('piece', pieces.map((p) => p.id));
  const current = pieces.find((p) => p.id === openId);
  const canMove = (r: Piece) => r.user_id === me.id || me.is_admin;

  return (
    <>
      <div className="columns-2 gap-3 md:columns-3 xl:columns-4">
        {pieces.map((r) => {
          const project = r.project_id ? names[r.project_id] : undefined; // a teammate's personal folder stays hidden
          return (
            <figure key={r.id} className="group mb-3 break-inside-avoid">
              <div className="relative overflow-hidden rounded-lg bg-foreground/[0.04] ring-1 ring-foreground/[0.06]">
                <button type="button" onClick={() => open(r.id)} className="block w-full cursor-zoom-in" aria-label={`Open ${r.title} ${formatLabel(r.format)}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.thumb} alt="" loading="lazy" className="block w-full" style={{ aspectRatio: `${r.width} / ${r.height}` }} />
                </button>
                <div className="absolute right-2 bottom-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100 max-lg:opacity-100">
                  {canMove(r) && <PieceMenu pieceId={r.id} projectId={r.project_id} projects={projects} />}
                  {r.file && (
                    <a href={r.file} aria-label="Download PNG" title="Download PNG"
                      className="flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur">
                      <HugeiconsIcon icon={Download04Icon} className="size-3.5" />
                    </a>
                  )}
                </div>
              </div>
              <figcaption className="mt-1.5 px-0.5 text-[13px]">
                <div className="flex items-baseline gap-1.5">
                  <span className="truncate">{r.title}</span>
                  <span className="shrink-0 text-foreground/40">{formatLabel(r.format)}</span>
                </div>
                <div className="truncate text-foreground/40">
                  {r.author} · {day(r.created_at)}
                  {showProject && project && <> · {project}</>}
                </div>
              </figcaption>
            </figure>
          );
        })}
      </div>

      {current && (
        <Inspector
          eyebrow={formatLabel(current.format)}
          title={current.title}
          onClose={close}
          onStep={step}
          stage={<StageImage src={current.file} placeholder={current.thumb} alt={`${current.title} ${formatLabel(current.format)}`} width={current.width} height={current.height} />}
          info={<PieceInfo piece={current} project={current.project_id ? names[current.project_id] : undefined} projects={projects} canMove={canMove(current)} />}
        />
      )}
    </>
  );
}

function PieceInfo({ piece, project, projects, canMove }: { piece: Piece; project?: string; projects: ProjectLink[]; canMove: boolean }) {
  // The copy that went on the piece; images and logos are listed as provided, links are not shown.
  const copy = Object.entries(piece.slots).filter(([, v]) => v);
  const rank = (k: string) => { const i = ['kicker', 'headline', 'subhead', 'speaker', 'name', 'role', 'company', 'city', 'venue', 'date', 'time', 'booth'].findIndex((p) => k.startsWith(p)); return i < 0 ? 99 : i; };
  const text = copy.filter(([, v]) => !/^(https?:|asset:|data:|\[inline image\])/.test(v!)).sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
  const media = copy.filter(([, v]) => /^(https?:|asset:|data:|\[inline image\])/.test(v!)).map(([k]) => humanize(k.replace(/^(image|logo)-/, '')));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-1.5 [&>*]:justify-center">
        {piece.file && (
          <a href={piece.file} className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90">
            <HugeiconsIcon icon={Download04Icon} className="size-3.5" /> Download
          </a>
        )}
        {canMove && <PieceMenu pieceId={piece.id} projectId={piece.project_id} projects={projects} variant="button" />}
      </div>

      <InfoRows
        rows={[
          ['Template', <Link key="t" href={`/templates?t=${piece.template}`} className="underline decoration-foreground/20 underline-offset-4 hover:decoration-foreground">{piece.title}</Link>],
          ['Format', `${formatLabel(piece.format)} · ${piece.width}×${piece.height}`],
          ['File', `PNG @${piece.scale}x · ${piece.width * piece.scale}×${piece.height * piece.scale}`],
          ['Project', project ?? '—'],
          ['Made by', piece.author],
          ['Created', when(piece.created_at)],
        ]}
      />

      {text.length > 0 && (
        <section>
          <p className="pb-1.5 text-foreground/40">Copy</p>
          <InfoRows rows={text.map(([k, v]) => [humanize(k), v])} />
        </section>
      )}
      {media.length > 0 && <p className="text-foreground/40">Images: {media.join(', ')}</p>}
    </div>
  );
}
