import { notFound } from 'next/navigation';
import { Section } from '@/components/docs/section';
import { SECTIONS } from '@/components/docs/sections';
import { DOCS } from '@/lib/docs';
import { currentUser } from '@/lib/team';

const find = (slug: string) => DOCS.find((d) => d.slug === slug && slug);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const doc = find((await params).slug);
  const me = await currentUser();
  const shown = doc && (!doc.admin || me?.is_admin) && (!doc.doc || me?.doc);
  return { title: shown ? `${doc.title} · Docs` : 'Docs' };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const doc = find((await params).slug);
  const me = await currentUser();
  if (!doc || (doc.admin && !me?.is_admin) || (doc.doc && !me?.doc)) notFound();
  const Content = SECTIONS[doc.slug];
  return <Section doc={doc}><Content doc={!!me?.doc} /></Section>;
}
