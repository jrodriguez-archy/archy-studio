-- Formats added in Canvas and not saved yet ("Add all formats"), kept with the work in progress so they
-- survive a reload and show in other tabs: [{ ref: "new:<template>:<format>…", slots, edits }]. They live
-- on the draft of the set's first saved format; saving the set clears the draft, and with it this list.
alter table public.canvas_drafts add column if not exists added jsonb not null default '[]'::jsonb;
