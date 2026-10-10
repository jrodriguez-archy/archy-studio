'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  BulbIcon,
  Archive02Icon, ArrowTurnBackwardIcon, Copy01Icon, Delete02Icon, Download04Icon, Folder01Icon, FolderExportIcon,
  Link01Icon, PackageIcon, PaintBoardIcon, PencilEdit02Icon, SparklesIcon, ViewIcon,
} from '@hugeicons/core-free-icons';
import { copy, type Action } from '@/components/action-menu';
import { ProjectDialog } from '@/components/project-dialog';
import type { ProjectLink } from '@/components/projects-nav';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createProjectAction } from '@/app/(app)/projects/actions';
import { archiveSetAction, deleteSetAction, moveSetAction, proposeSetAction, renameSetAction, restoreSetAction } from '@/app/(app)/sets/actions';
import { formatLabel, humanize, isExploration, type PieceSet } from '@/lib/gallery-shared';
import { downloadSet } from '@/lib/download-set';

const download = (url?: string) => { if (url) window.location.href = url; };

// A prompt to paste in Claude: same template and brief, kept in the same set.
function versionPrompt(set: PieceSet) {
  const rank = (k: string) => { const i = ['event-name', 'kicker', 'headline', 'subhead', 'speaker', 'name', 'role', 'company', 'city', 'venue', 'date', 'time', 'booth'].findIndex((p) => k.startsWith(p)); return i < 0 ? 99 : i; };
  const lines = Object.entries(set.lead.slots)
    .filter(([, v]) => v && !v.startsWith('data:') && v !== '[inline image]')
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([k, v]) => `- ${humanize(k)}: ${v!.replace(/\s*\n\s*/g, ' ')}`);
  if (isExploration(set.lead.template)) return [`Make a new version of the Archy Studio exploration "${set.title}" (${set.pieces.map((p) => `${p.format} ${p.width}×${p.height}`).join(', ')}).`, `Keep it in set ${set.id}.`].join('\n');
  return [
    `Make a new version of "${set.title}" with the Archy Studio template ${set.lead.template}.`,
    'Same brief:',
    ...lines,
    `Keep it in set ${set.id}.`,
  ].join('\n');
}

// Actions for one set (gallery, project pages) or one archived set (Archive page), plus the dialogs they open.
export function useSetActions({ set, projects, canManage, onOpen }: { set: PieceSet; projects: ProjectLink[]; canManage: boolean; onOpen?: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [, start] = useTransition();
  const many = set.pieces.length > 1;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string, undo?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? 'Something went wrong');
      else if (done) toast.success(done, undo ? { action: { label: 'Undo', onClick: undo } } : undefined);
    });
  const move = (id: string | null, name?: string) => run(() => moveSetAction(set.id, id), id ? `Moved to ${name}` : 'Removed from the project');
  const restore = () => run(() => restoreSetAction(set.id), 'Restored to the gallery');

  const router = useRouter();
  const open: Action[] = onOpen ? [{ label: 'Open', icon: ViewIcon, onSelect: onOpen }] : [];
  // Canvas opens the lead design with the set's other formats beside it, as artboards.
  const edit: Action[] = [{ label: 'Edit in Canvas', icon: PaintBoardIcon, onSelect: () => router.push(`/canvas/${set.lead.id}`) }];
  const downloads: Action[] = [
    { label: many ? `Download all (${set.pieces.length})` : 'Download', icon: many ? PackageIcon : Download04Icon, onSelect: () => (many ? downloadSet(set.id) : download(set.lead.file)) },
    ...(many ? [{ label: 'Download format', icon: Download04Icon, items: set.pieces.map((p) => ({ label: formatLabel(p.format), hint: set.templates.length > 1 ? p.title : `${p.width}×${p.height}`, onSelect: () => download(p.file) })) }] : []),
  ];

  const actions: Action[] = set.archived_at
    ? [
        ...open,
        ...downloads,
        { separator: true },
        { label: 'Restore', icon: ArrowTurnBackwardIcon, disabled: !canManage, onSelect: restore },
        { label: 'Delete permanently…', icon: Delete02Icon, destructive: true, disabled: !canManage, onSelect: () => setDeleting(true) },
      ]
    : [
        ...open,
        ...edit,
        ...downloads,
        { separator: true },
        {
          label: 'Move to project', icon: FolderExportIcon, disabled: !canManage,
          items: [
            ...projects.map((p) => ({ label: p.name, icon: Folder01Icon, hint: p.id === set.project_id ? '✓' : undefined, onSelect: () => p.id !== set.project_id && move(p.id, p.name) })),
            ...(projects.length ? [{ separator: true } as const] : []),
            { label: 'New project…', onSelect: () => setCreating(true) },
            ...(set.project_id ? [{ label: 'Remove from project', onSelect: () => move(null) }] : []),
          ],
        },
        { label: 'Rename…', icon: PencilEdit02Icon, disabled: !canManage, onSelect: () => setRenaming(true) },
        ...(isExploration(set.lead.template)
          ? [set.lead.proposed
            ? { label: 'Proposed as template', icon: BulbIcon, disabled: true, onSelect: () => {} }
            : { label: 'Propose as template…', icon: BulbIcon, onSelect: () => setProposing(true) }]
          : []),
        { label: 'New version with Claude', icon: SparklesIcon, onSelect: async () => { (await copy(versionPrompt(set))) ? toast.success('Prompt copied. Paste it in Claude.') : toast.error('Could not copy'); } },
        { label: 'Copy link', icon: Link01Icon, onSelect: async () => { (await copy(`${location.origin}/?all=1&set=${set.id}`)) && toast.success('Link copied'); } },
        { label: 'Copy set ID', icon: Copy01Icon, onSelect: async () => { (await copy(set.id)) && toast.success('Set ID copied'); } },
        { separator: true },
        { label: 'Archive', icon: Archive02Icon, disabled: !canManage, onSelect: () => run(() => archiveSetAction(set.id), 'Archived', restore) },
      ];

  const dialogs = (
    <>
      <ProposeDialog open={proposing} onOpenChange={setProposing} title={set.title} onSave={async (note) => { const r = await proposeSetAction(set.id, note); if (!r.ok) toast.error(r.error); else toast.success('Proposed. Design will see it in Template proposals.'); return r.ok; }} />
      <RenameDialog open={renaming} onOpenChange={setRenaming} title={set.title} onSave={async (t) => { const r = await renameSetAction(set.id, t); if (!r.ok) toast.error(r.error); return r.ok; }} />
      <ProjectDialog
        open={creating}
        onOpenChange={setCreating}
        title="New project"
        action="Create and move"
        onSubmit={async (name, shared) => {
          const res = await createProjectAction(name, shared);
          if (!res.ok || !res.data) { toast.error(res.ok ? 'Could not create the project.' : res.error); return false; }
          move(res.data, name.trim());
          return true;
        }}
      />
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{set.title}” for good?</AlertDialogTitle>
            <AlertDialogDescription>
              {set.pieces.length === 1 ? 'The file is' : `All ${set.pieces.length} files are`} deleted from Studio. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => run(() => deleteSetAction(set.id), 'Deleted')}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  return { actions, dialogs, restore, openDelete: () => setDeleting(true), openRename: () => setRenaming(true), archive: () => run(() => archiveSetAction(set.id), 'Archived', restore) };
}

function ProposeDialog({ open, onOpenChange, title, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; onSave: (note: string) => Promise<boolean> }) {
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  useEffect(() => { if (open) setNote(''); }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 rounded-md p-6 text-[13px] sm:max-w-[420px]">
        <DialogHeader><DialogTitle className="text-[15px] font-medium">Propose “{title}” as a template</DialogTitle></DialogHeader>
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); start(async () => { if (await onSave(note)) onOpenChange(false); }); }}>
          <Textarea autoFocus maxLength={300} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why it should be a template (optional)" className="text-[13px]" aria-label="Note" />
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" size="lg" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="lg" disabled={pending}>{pending ? 'Sending…' : 'Propose'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({ open, onOpenChange, title, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; onSave: (t: string) => Promise<boolean> }) {
  const [value, setValue] = useState(title);
  const [pending, start] = useTransition();
  useEffect(() => { if (open) setValue(title); }, [open, title]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 rounded-md p-6 text-[13px] sm:max-w-[380px]">
        <DialogHeader><DialogTitle className="text-[15px] font-medium">Rename</DialogTitle></DialogHeader>
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (value.trim()) start(async () => { if (await onSave(value)) onOpenChange(false); }); }}>
          <Input autoFocus maxLength={120} value={value} onChange={(e) => setValue(e.target.value)} onFocus={(e) => e.currentTarget.select()} className="h-8 text-[13px]" aria-label="Name" />
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" size="lg" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="lg" disabled={pending || !value.trim()}>{pending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
