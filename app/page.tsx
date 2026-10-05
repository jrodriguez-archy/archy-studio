import { listTemplates } from '@/lib/templates';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const templates = await listTemplates();
  return (
    <main style={{ padding: 32, maxWidth: 960 }}>
      <h1>Archy Studio</h1>
      <p>Templates available to render. The gallery and connector instructions come next.</p>
      <ul>
        {templates.map((t) =>
          Object.keys(t.formats).map((f) => (
            <li key={`${t.id}-${f}`}>
              <a href={`/api/render?template=${t.id}&format=${f}`}>{t.title} · {t.formats[f].label}</a>
            </li>
          )),
        )}
      </ul>
    </main>
  );
}
