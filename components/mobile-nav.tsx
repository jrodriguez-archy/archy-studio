'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { Menu01Icon } from '@hugeicons/core-free-icons';
import { ArchyWordmark } from '@/components/archy-wordmark';
import { BrandLockup, BrandMark } from '@/components/brand-lockup';
import { useSwitchBrand } from '@/components/sidebar';
import { BRAND_IDS, BRANDS, type Brand } from '@/lib/brands';
import { NavLink, SignOutLink } from '@/components/nav-link';
import { ProjectsNav, type ProjectLink } from '@/components/projects-nav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { NavItem, NavSection } from '@/components/app-shell';

export function MobileNav({ sections, admin, projects, me, email, brand }: { sections: NavSection[]; admin: NavItem[] | null; projects: ProjectLink[]; me?: { id: string; is_admin: boolean }; email: string; brand: Brand }) {
  const [open, setOpen] = useState(false);
  const switchTo = useSwitchBrand();
  const close = () => setOpen(false);
  return (
    <div className="sticky top-0 z-40 flex items-center justify-between border-b border-foreground/[0.06] bg-[#FAFAFA]/90 px-4 py-3 backdrop-blur md:hidden">
      <Link href="/" className="flex items-center gap-2" aria-label={BRANDS[brand].studio}>
        {/* DOC's full lockup has a 48px minimum, so the bar shows its symbol and the name. */}
        {brand === 'doc' ? <><BrandMark brand="doc" height={24} /><span className="text-[15px] font-medium">DOC</span></> : <ArchyWordmark className="h-6 w-auto text-primary" />}
        <span className="h-5 w-px -translate-y-[2px] bg-foreground/15" aria-hidden />
        <span className="-translate-y-[2px] text-[15px] text-muted-foreground">Studio</span>
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Menu" />}>
          <HugeiconsIcon icon={Menu01Icon} />
        </SheetTrigger>
        <SheetContent side="right" className="w-72 overflow-y-auto bg-[#FAFAFA] px-3 py-6">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="px-2">
            <BrandLockup size="sm" label={false} brand={brand} />
          </div>
          <nav className="mt-6 space-y-5">
            {sections.map((s, n) => (
              <Fragment key={s.label}>
                <div className="space-y-0.5">
                  <p className="px-2 pb-1 text-[11px] font-medium tracking-[0.02em] text-foreground/35">{s.label}</p>
                  {s.items.map((i) => <NavLink key={i.href} href={i.href} icon={i.icon} onNavigate={close}>{i.label}</NavLink>)}
                </div>
                {n === 0 && <ProjectsNav projects={projects} me={me} onNavigate={close} />}
              </Fragment>
            ))}
            <div className="space-y-0.5 border-t border-foreground/[0.06] pt-4">
              <p className="px-2 pb-1 text-[11px] font-medium tracking-[0.02em] text-foreground/35">Brand</p>
              {BRAND_IDS.map((b) => (
                <button key={b} type="button" onClick={() => { close(); if (b !== brand) switchTo(b); }}
                  className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] ${b === brand ? 'bg-background text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.06)]' : 'text-foreground/60'}`}>
                  <span className="flex size-4 items-center justify-center"><BrandMark brand={b} /></span>{BRANDS[b].name}
                </button>
              ))}
              <div className="h-3" />
              <NavLink href="/install" icon="install" onNavigate={close}>Install</NavLink>
              {admin && (
                <>
                  <p className="px-2 pt-3 pb-1 text-[11px] font-medium tracking-[0.02em] text-foreground/35">Admin</p>
                  {admin.map((i) => <NavLink key={i.href} href={i.href} icon={i.icon} onNavigate={close}>{i.label}</NavLink>)}
                </>
              )}
              <p className="truncate px-2 pt-3 pb-1 text-[11px] text-foreground/35">{email}</p>
              <NavLink href="/account" icon="account" onNavigate={close}>Account</NavLink>
              <SignOutLink />
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
