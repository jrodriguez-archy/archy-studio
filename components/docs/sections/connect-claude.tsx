import Link from 'next/link';
import { CopyText } from '@/components/copy-text';
import { RELEASES } from '@/lib/whats-new';
import { Callout, H2, H3, Kbd, Rows, Step, Steps, Ui } from '../ui';

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
      <Callout kind="tip">Right after installing, <a href="#auto-update">turn on auto-update</a>. It is off for this marketplace until you turn it on.</Callout>

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

      <H2 id="update">Update the plugin</H2>
      <p>
        New versions bring new templates and fixes. The latest is <strong>{RELEASES[0].version}</strong>
        (<Link href="/docs/whats-new">What’s new</Link>). Your version is next to <strong>Archy - Studio</strong> in
        Claude’s plugin list.
      </p>

      <H3 id="auto-update">Turn on auto-update (once)</H3>
      <p>
        Auto-update is set <strong>per marketplace</strong>, and it starts <strong>off</strong> for archy-studio, even when it is on
        for your other plugins. Until you turn it on, Claude does not see new versions and <Ui>Update</Ui> stays greyed out.
      </p>
      <Steps>
        <Step>In the Claude app, open <Ui>Customize</Ui> → <Ui>Plugins</Ui>.</Step>
        <Step>Find the <strong>archy-studio</strong> marketplace (not the plugin) and turn on <Ui>Sync automatically</Ui>.</Step>
        <Step>Quit Claude completely (<Kbd>⌘Q</Kbd>) and open it again.</Step>
      </Steps>
      <p>From then on, new versions arrive on their own. A new version loads in a <strong>new conversation</strong>.</p>

      <H3>Update now, in the Claude app</H3>
      <Steps>
        <Step>Open <Ui>Customize</Ui> → <Ui>Plugins</Ui>.</Step>
        <Step>On the <strong>archy-studio</strong> marketplace, choose <Ui>Check for updates</Ui>. This makes Claude read the new version first.</Step>
        <Step>Update <strong>Archy - Studio</strong> if it offers it.</Step>
        <Step>Quit Claude (<Kbd>⌘Q</Kbd>), open it again and start a new conversation.</Step>
      </Steps>

      <H3>Update now, in a terminal</H3>
      <p>Only with Claude Code installed in your terminal.</p>
      <Steps>
        <Step><CopyText wrap text="claude plugin marketplace update archy-studio" /></Step>
        <Step><CopyText wrap text="claude plugin update archy-studio@archy-studio" /></Step>
        <Step>Start a new session, or type <CopyText text="/reload-plugins" /> in the one you have open.</Step>
      </Steps>
      <Callout kind="note">If the terminal says <code>command not found: claude</code>, Claude Code is not installed there. Use the steps in the Claude app instead.</Callout>
      <Callout kind="tip">For auto-update in the terminal: type <CopyText text="/plugin" />, open <Ui>Marketplaces</Ui>, choose <strong>archy-studio</strong> and <Ui>Enable auto-update</Ui>.</Callout>

      <H3>Still on an old version?</H3>
      <ul>
        <li><Ui>Update</Ui> greyed out: the marketplace has not been read again. Choose <Ui>Check for updates</Ui> on the archy-studio marketplace, then try again.</li>
        <li>The new version is installed but Claude still acts the old way: quit Claude with <Kbd>⌘Q</Kbd> (closing the window is not enough) and start a new conversation.</li>
        <li>Still nothing: <a href="#reinstall">remove it and install it fresh</a>. Your designs stay in Studio.</li>
      </ul>

      <H2 id="signed-out">If Claude is not signed in</H2>
      <p>If Claude says Archy Studio needs you to sign in (or its tools are missing), connect again:</p>
      <Steps>
        <Step>Type <CopyText text="/mcp" /> in a conversation and send it.</Step>
        <Step>Click <Ui>Sign in</Ui> (or <Ui>Authenticate</Ui>) next to <strong>archy-studio</strong>, and <Ui>Allow</Ui> in the browser.</Step>
      </Steps>
      <H3>Still not working?</H3>
      <ul>
        <li>Start a <strong>new conversation</strong>: tools added during a conversation may not appear in it.</li>
        <li>Check the plugin is installed and enabled under <Ui>Plugins</Ui>. If it is not, <a href="#reinstall">install it again</a>.</li>
        <li>Your email must be on the Studio team list. If sign-in says it is not, ask an admin (<Link href="/docs/admin">For admins</Link>).</li>
      </ul>

      <H2 id="reinstall">If the plugin is not enabled</H2>
      <p>
        Sometimes the plugin shows as installed but stays off, or its tools never appear. Enabling it again rarely helps: remove it
        and install it fresh. It takes a minute, and your designs stay in Studio.
      </p>
      <H3>In the Claude app</H3>
      <Steps>
        <Step>Open <Ui>Customize</Ui> → <Ui>Plugins</Ui>, open the menu of <strong>Archy - Studio</strong> and choose <Ui>Remove</Ui>.</Step>
        <Step>Remove the <strong>archy-studio</strong> marketplace too.</Step>
        <Step>Install it again as at the start: <a href="#claude-app">In the Claude app</a>.</Step>
        <Step>Sign in again with <CopyText text="/mcp" />, then start a new conversation.</Step>
      </Steps>
      <H3>Claude Code in a terminal</H3>
      <Steps>
        <Step><CopyText wrap text="claude plugin uninstall archy-studio@archy-studio" /></Step>
        <Step><CopyText wrap text="claude plugin marketplace update archy-studio" /></Step>
        <Step><CopyText wrap text="claude plugin install archy-studio@archy-studio" /></Step>
        <Step>In a new session type <CopyText text="/mcp" />, choose <strong>archy-studio</strong> and <Ui>Authenticate</Ui>.</Step>
      </Steps>
      <Callout kind="note">To see whether it is on: <CopyText text="claude plugin list" /> shows each plugin with its version and status.</Callout>
    </>
  );
}
