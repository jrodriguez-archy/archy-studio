import { AppShell } from '@/components/app-shell';
import { currentBrand } from '@/lib/brand';
import { BRANDS } from '@/lib/brands';

// Page titles end with the brand's Studio name: "Gallery · Archy Studio", "Gallery · DOC Studio".
export async function generateMetadata() {
  const studio = BRANDS[await currentBrand()].studio;
  return { title: { template: `%s · ${studio}`, default: studio } };
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
