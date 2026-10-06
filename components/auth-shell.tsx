import { BrandLockup } from '@/components/brand-lockup';
import { PixelField } from '@/components/pixel-field';

// Frame for the access screens (sign in, create password, authorize Claude): live Archy Pixel Gradient
// behind a white card with the Studio lockup. Inside the app, plain white.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative isolate grid min-h-dvh place-items-center px-4">
      <PixelField />
      <div className="w-full max-w-[360px] space-y-6 rounded-md border border-foreground/[0.07] bg-background p-8 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <BrandLockup />
        {children}
      </div>
    </main>
  );
}
