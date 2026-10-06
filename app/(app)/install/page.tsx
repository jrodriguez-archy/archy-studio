import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const metadata = { title: 'Install · Archy Studio' };

const BRIEFS = [
  'We have booth #1211 at the Chicago Midwinter Meeting, February 18 to 20 in Chicago. Make the social posts.',
  'Instagram ad introducing Sarah Thompson, our Account Executive in Austin, TX. Here is her photo: <link>',
  'Reminder for tomorrow: we are at the Hinman Dental Meeting in Atlanta, booth #1039.',
  'We are hosting a free night out for Dallas dentists at Topgolf Dallas, Friday October 9, 6 to 8 PM.',
  'Event page cover for our booth at the Greater New York Dental Meeting, booth #4402. City photo: <link>',
];

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{n}</span>
      <div className="pt-0.5 text-sm leading-relaxed">{children}</div>
    </li>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground">{children}</code>;
}

export default function InstallPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Install</h1>
        <p className="mt-1 text-muted-foreground">Add Archy Studio to Claude once. Then just ask for a piece in any conversation.</p>
      </div>

      <Tabs defaultValue="app">
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
          <TabsTrigger value="app">Claude app (Cowork or Code)</TabsTrigger>
          <TabsTrigger value="terminal">Claude Code in a terminal</TabsTrigger>
        </TabsList>
        <TabsContent value="app">
          <Card>
            <CardContent className="pt-6">
              <ol className="space-y-4">
                <Step n={1}>Click <strong>+</strong>, then <strong>Plugins → Add marketplace</strong>, and enter <Code>jrodriguez-archy/archy-studio</Code>.</Step>
                <Step n={2}>Install <strong>Archy - Studio</strong>.</Step>
                <Step n={3}>Start a <strong>new conversation</strong>. The first time you ask for a piece, Claude asks you to connect Archy Studio: sign in here with your Archy email and click <strong>Allow</strong>.</Step>
                <Step n={4}>Ask for a piece in your own words. Claude reads the brief, asks once for anything missing and picks the right template.</Step>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="terminal">
          <Card>
            <CardContent className="pt-6">
              <ol className="space-y-4">
                <Step n={1}>Run <Code>claude plugin marketplace add jrodriguez-archy/archy-studio</Code></Step>
                <Step n={2}>Run <Code>claude plugin install archy-studio@archy-studio</Code></Step>
                <Step n={3}>In a new session, type <Code>/mcp</Code>, choose <strong>archy-studio</strong> and <strong>Authenticate</strong>. Sign in and click <strong>Allow</strong>.</Step>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Things to ask</CardTitle>
          <CardDescription>Write it like a message to a designer. Copy on the piece is always in US English.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {BRIEFS.map((b) => <p key={b} className="rounded-lg border bg-secondary/50 px-3 py-2 text-sm">{b}</p>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Good to know</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p><Badge variant="secondary" className="mr-2">Photos</Badge>People are always their real photo, as a link to a cutout PNG (background removed). Claude never generates a person.</p>
          <p><Badge variant="secondary" className="mr-2">Logos</Badge>Partner and sponsor logos as a link (PNG or SVG). They are set in the design's colour and balanced with the Archy logo.</p>
          <p><Badge variant="secondary" className="mr-2">Missing info</Badge>Small details can be left out (no time: only the date). If something essential is missing, Claude asks or suggests another template.</p>
          <p><Badge variant="secondary" className="mr-2">Gallery</Badge>Every piece is saved to the team gallery with your name, and the download link lasts a week.</p>
        </CardContent>
      </Card>
    </div>
  );
}
