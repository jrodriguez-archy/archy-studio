import { RELEASES, releaseId } from '@/lib/whats-new';
import { H2 } from '../ui';

const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export function WhatsNew() {
  return (
    <>
      <p>
        What changed in Studio, newest first. Your version is in the account menu; when a new one is out while Studio is open,
        <strong> Update</strong> appears in the sidebar.
      </p>
      {RELEASES.map((r) => (
        <section key={r.version}>
          <H2 id={releaseId(r.version)}>{r.version} · {r.title}</H2>
          <p className="text-foreground/50">{day(r.date)}</p>
          <ul>{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      ))}
    </>
  );
}
