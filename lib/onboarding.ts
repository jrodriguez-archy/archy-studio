import 'server-only';
import { supabaseAdmin } from './supabase/admin';

// The Gallery's "Get started" card: three steps that tick themselves (Claude connected, a first design,
// a design opened in Canvas). It goes for good when the person closes it, or after it has shown complete.
type Who = { id: string };
type Onboarding = { canvas_at?: string; dismissed_at?: string; done_at?: string };
export type OnboardingState = { show: boolean; complete: boolean; steps: { claude: boolean; design: boolean; canvas: boolean }; latestPieceId: string | null };

async function read(me: Who) {
  const { data } = await supabaseAdmin().from('profiles').select('mcp_seen_at, onboarding').eq('id', me.id).maybeSingle();
  return { mcpSeenAt: (data?.mcp_seen_at as string | null) ?? null, onboarding: ((data?.onboarding as Onboarding | null) ?? {}) };
}

export async function markOnboarding(me: Who, key: keyof Onboarding) {
  const { onboarding } = await read(me);
  if (onboarding[key]) return;
  await supabaseAdmin().from('profiles').update({ onboarding: { ...onboarding, [key]: new Date().toISOString() } }).eq('id', me.id);
}

export async function onboardingState(me: Who): Promise<OnboardingState> {
  const [{ mcpSeenAt, onboarding }, latest] = await Promise.all([
    read(me),
    supabaseAdmin().from('renders').select('id').eq('user_id', me.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const steps = { claude: !!mcpSeenAt, design: !!latest.data, canvas: !!onboarding.canvas_at };
  const complete = steps.claude && steps.design && steps.canvas;
  const show = !onboarding.dismissed_at && !onboarding.done_at;
  // Complete: shown this once ("You're all set"), then never again.
  if (show && complete) await markOnboarding(me, 'done_at');
  return { show, complete, steps, latestPieceId: (latest.data?.id as string | undefined) ?? null };
}
