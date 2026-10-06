'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { Menu01Icon } from '@hugeicons/core-free-icons';
import { ArchyWordmark } from '@/components/archy-wordmark';
import { BrandLockup } from '@/components/brand-lockup';
import { NavLink, SignOutLink } from '@/components/nav-link';
import { ProjectsNav, type ProjectLink } from '@/components/projects-nav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { NavSection } from '@/components/app-shell';

export function MobileNav({ sections, projects, me, email }: { sections: NavSection[]; projects: ProjectLink[]; me?: { id: string; is_admin: boolean }; email: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className="sticky top-0 z-40 flex items-center justify-between border-b border-foreground/[0.06] bg-[#FAFAFA]/90 px-4 py-3 backdrop-blur md:hidden">
      <Link href="/" className="flex items-center gap-2" aria-label="Archy Studio">
        <ArchyWordmark className="h-6 w-auto text-primary" />
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
            <BrandLockup size="sm" label={false} />
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
              <p className="truncate px-2 pb-1 text-[11px] text-foreground/35">{email}</p>
              <NavLink href="/account" icon="account" onNavigate={close}>Account</NavLink>
              <SignOutLink />
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
