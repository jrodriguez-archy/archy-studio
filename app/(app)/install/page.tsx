import { redirect } from 'next/navigation';

// Install became the Docs: old links land on how to connect Claude.
export default function Install() {
  redirect('/docs/connect-claude');
}
