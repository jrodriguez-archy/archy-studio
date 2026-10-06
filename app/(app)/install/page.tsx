import { PageHeader } from '@/components/app-shell';
import { CopyText } from '@/components/copy-text';

export const metadata = { title: 'Install · Archy Studio' };

const BRIEFS = [
  'We have booth #1211 at the Chicago Midwinter Meeting, February 18 to 20 in Chicago. Make the social posts.',
  'Instagram ad introducing Sarah Thompson, our Account Executive in Austin, TX. Here is her photo: <link>',
  'Reminder for tomorrow: we are at the Hinman Dental Meeting in Atlanta, booth #1039.',
  'We are hosting a free night out for Dallas dentists at Topgolf Dallas, Friday October 9, 6 to 8 PM.',
  'Event page cover for our booth at the Greater New York Dental Meeting, booth #4402. City photo: <link>',
];

const NOTES = [
  ['Photos', 'People are always their real photo, as a link to a cutout PNG. Claude never generates a person.'],
  ['Logos', 'Partner and sponsor logos as a link (PNG or SVG). They are set in the design’s colour and balanced with the Archy logo.'],
  ['Missing info', 'Small details can be left out (no time: only the date). If something essential is missing, Claude asks or suggests another template.'],
  ['Gallery', 'Every piece is saved to the gallery with your name. Download links last a week.'],
];

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[20px_1fr] gap-3">
      <span className="text-foreground/30 tabular-nums">{n}</span>
      <div className="text-foreground/80">{children}</div>
    </li>
  );
}

export default function InstallPage() {
  return (
    <div className="max-w-2xl text-[13px]">
      <PageHeader title="Install" description="Add Archy Studio to Claude once, then ask for pieces in any conversation." />

      <section className="mt-8 space-y-3">
        <h2 className="text-foreground/40">Claude app · Cowork or Code</h2>
        <ol className="space-y-3">
          <Step n={1}>Click <strong className="font-medium text-foreground">+</strong>, then <strong className="font-medium text-foreground">Plugins → Add marketplace</strong>, and enter <CopyText text="jrodriguez-archy/archy-studio" />.</Step>
          <Step n={2}>Install <strong className="font-medium text-foreground">Archy - Studio</strong>.</Step>
          <Step n={3}>Connect your account, once. In a new conversation type <CopyText text="/mcp" /> and send it. Find <strong className="font-medium text-foreground">archy-studio</strong> (it shows <span className="text-foreground/60">needs auth</span>) and click <strong className="font-medium text-foreground">Sign in</strong>.</Step>
          <Step n={4}>Your browser opens Archy Studio. Sign in with your Archy email and click <strong className="font-medium text-foreground">Allow</strong>. Then go back to Claude.</Step>
          <Step n={5}>Ask for a piece in your own words. Claude reads the brief, asks once for anything missing and picks the template.</Step>
        </ol>
        <p className="text-foreground/40">You can also connect it from <strong className="font-medium text-foreground/60">Connectors</strong> in the Claude app. If Claude ever says Archy Studio is not signed in, repeat steps 3 and 4.</p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-foreground/40">Claude Code in a terminal</h2>
        <ol className="space-y-3">
          <Step n={1}><CopyText text="claude plugin marketplace add jrodriguez-archy/archy-studio" /></Step>
          <Step n={2}><CopyText text="claude plugin install archy-studio@archy-studio" /></Step>
          <Step n={3}>In a new session type <CopyText text="/mcp" />, choose <strong className="font-medium text-foreground">archy-studio</strong> and <strong className="font-medium text-foreground">Authenticate</strong>.</Step>
        </ol>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-foreground/40">Things to ask</h2>
        <div className="space-y-1.5">
          {BRIEFS.map((b) => <p key={b} className="rounded-lg bg-foreground/[0.04] px-3 py-2.5 text-foreground/80">{b}</p>)}
        </div>
        <p className="text-foreground/40">Copy on the piece is always in US English.</p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-foreground/40">Good to know</h2>
        <dl className="divide-y divide-foreground/[0.06] border-y border-foreground/[0.06]">
          {NOTES.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[110px_1fr] gap-4 py-2.5">
              <dt>{k}</dt>
              <dd className="text-foreground/60">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
