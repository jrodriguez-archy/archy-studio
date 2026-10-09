import Link from 'next/link';
import { CopyText } from '@/components/copy-text';
import { Callout, H2, H3, Rows, Step, Steps, Ui } from '../ui';

export function ConnectClaude() {
  return (
    <>
      <p>
        Archy Studio works inside Claude as a plugin. You add it once; after that, any conversation can make designs, and they land in
        your Studio gallery with your name.
      </p>

      <H2 id="claude-app">In the Claude app</H2>
      <p>For the Claude desktop app, in <strong>Cowork</strong> or <strong>Code</strong>.</p>
      <Steps>
        <Step>Click <Ui>+</Ui>, then <Ui>Plugins</Ui> → <Ui>Add marketplace</Ui>, and enter <CopyText text="jrodriguez-archy/archy-studio" />.</Step>
        <Step>Install <Ui>Archy - Studio</Ui>.</Step>
        <Step>Connect your account. In a new conversation type <CopyText text="/mcp" /> and send it. Find <strong>archy-studio</strong> (it says <em>needs auth</em>) and click <Ui>Sign in</Ui>.</Step>
        <Step>Your browser opens Archy Studio. Sign in with your Archy email and click <Ui>Allow</Ui>. Then go back to Claude.</Step>
        <Step>Ask for a design in your own words. That is it.</Step>
      </Steps>
      <Callout kind="note">You can also add it from <strong>Connectors</strong> in the Claude app settings. Either way, you only sign in once.</Callout>

      <H2 id="terminal">Claude Code in a terminal</H2>
      <Steps>
        <Step><CopyText wrap text="claude plugin marketplace add jrodriguez-archy/archy-studio" /></Step>
        <Step><CopyText wrap text="claude plugin install archy-studio@archy-studio" /></Step>
        <Step>In a new session type <CopyText text="/mcp" />, choose <strong>archy-studio</strong> and <Ui>Authenticate</Ui>.</Step>
      </Steps>

      <H2 id="check">Check that it works</H2>
      <p>Ask Claude: <em>“What can Archy Studio make?”</em> It should list the templates. In Studio, Canvas shows <strong>Connected</strong> in its right panel once Claude has signed in.</p>

      <H2 id="can-do">What Claude can do</H2>
      <p>When you click <Ui>Allow</Ui>, Claude can do these things in Studio, always as you:</p>
      <Rows rows={[
        ['Templates', 'List them, read what each needs and its length limits, and pick the best one for your brief.'],
        ['Designs', 'Make designs in every format and save them to the gallery, in a set.'],
        ['Images', 'Read the team’s images in Assets, and send you a link to upload photos.'],
        ['Projects', 'List projects and create one when you ask to file designs in it.'],
        ['Canvas', 'See the design you have open and edit it live, as you watch. You can undo every change.'],
      ]} />
      <p>Claude cannot change templates, delete anything, or touch your account.</p>

      <H2 id="signed-out">If Claude is not signed in</H2>
      <p>If Claude says Archy Studio needs you to sign in (or its tools are missing), connect again:</p>
      <Steps>
        <Step>Type <CopyText text="/mcp" /> in a conversation and send it.</Step>
        <Step>Click <Ui>Sign in</Ui> (or <Ui>Authenticate</Ui>) next to <strong>archy-studio</strong>, and <Ui>Allow</Ui> in the browser.</Step>
      </Steps>
      <H3>Still not working?</H3>
      <ul>
        <li>Start a <strong>new conversation</strong>: tools added during a conversation may not appear in it.</li>
        <li>Check the plugin is installed and enabled under <Ui>Plugins</Ui>.</li>
        <li>Your email must be on the Studio team list. If sign-in says it is not, ask an admin (<Link href="/docs/admin">For admins</Link>).</li>
      </ul>
    </>
  );
}
