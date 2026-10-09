import { Section } from '@/components/docs/section';
import { SECTIONS } from '@/components/docs/sections';
import { DOCS } from '@/lib/docs';

export const metadata = { title: 'Docs' };

export default function DocsHome() {
  const Content = SECTIONS[''];
  return <Section doc={DOCS[0]}><Content /></Section>;
}
