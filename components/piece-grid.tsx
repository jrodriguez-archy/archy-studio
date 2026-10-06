import { HugeiconsIcon } from '@hugeicons/react';
import { Download04Icon } from '@hugeicons/core-free-icons';
import { PieceMenu } from '@/components/piece-menu';
import type { ProjectLink } from '@/components/projects-nav';
import { formatLabel, type Piece } from '@/lib/gallery';

// Masonry of finished pieces. Hover shows download and, for pieces you can organise, the project menu.
export function PieceGrid({ pieces, projects, me, showProject = true }: { pieces: Piece[]; projects: ProjectLink[]; me: { id: string; is_admin: boolean }; showProject?: boolean }) {
  const names = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  return (
    <div className="columns-2 gap-3 md:columns-3 xl:columns-4">
      {pieces.map((r) => {
        const project = r.project_id ? names[r.project_id] : undefined; // a teammate's personal folder stays hidden
        const canMove = r.user_id === me.id || me.is_admin;
        return (
          <figure key={r.id} className="group mb-3 break-inside-avoid">
            <div className="relative overflow-hidden rounded-lg bg-foreground/[0.04] ring-1 ring-foreground/[0.06]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.thumb} alt={`${r.title} ${r.format}`} loading="lazy" className="block w-full" style={{ aspectRatio: `${r.width} / ${r.height}` }} />
              <div className="absolute right-2 bottom-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100 max-lg:opacity-100">
                {canMove && <PieceMenu pieceId={r.id} projectId={r.project_id} projects={projects} />}
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
                {r.author} · {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {showProject && project && <> · {project}</>}
              </div>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
