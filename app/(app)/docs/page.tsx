import { Section } from '@/components/docs/section';
import { SECTIONS } from '@/components/docs/sections';
import { DOCS } from '@/lib/docs';
import { currentUser } from '@/lib/team';

export const metadata = { title: 'Docs' };

export default async function DocsHome() {
  const Content = SECTIONS[''];
  return <Section doc={DOCS[0]}><Content doc={!!(await currentUser())?.doc} /></Section>;
}
