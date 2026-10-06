import { Fragment } from 'react';
import Link from 'next/link';
import { BrandLockup } from '@/components/brand-lockup';
import { MobileNav } from '@/components/mobile-nav';
import { NavLink, SignOutLink, type NavIcon } from '@/components/nav-link';
import { ProjectsNav, type ProjectLink } from '@/components/projects-nav';
import { listProjects } from '@/lib/projects';
import { currentUser } from '@/lib/team';

export type NavItem = { href: string; label: string; icon: NavIcon };
export type NavSection = { label: string; items: NavItem[] };

// Left rail on a faint grey layer (the login's card-on-ground idea): Studio lockup, icon nav with the
// active page lifted onto white, account at the bottom.
export async function AppShell({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  const sections: NavSection[] = [
    { label: 'Library', items: [{ href: '/', label: 'Gallery', icon: 'gallery' }, { href: '/templates', label: 'Templates', icon: 'templates' }] },
    { label: 'Resources', items: [{ href: '/install', label: 'Install', icon: 'install' }] },
    ...(me?.is_admin ? [{ label: 'Admin', items: [{ href: '/admin', label: 'Team', icon: 'team' as const }] }] : []),
  ];
  const projects: ProjectLink[] = me ? (await listProjects(me).catch(() => [])).map(({ id, name, shared, count }) => ({ id, name, shared, count })) : [];
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-foreground/[0.06] bg-[#FAFAFA] px-3 py-6 md:flex">
        <Link href="/" className="px-2" aria-label="Archy Studio">
          <BrandLockup size="sm" label={false} />
        </Link>
        <nav className="-mx-3 mt-6 min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-4 [scrollbar-width:thin]">
          {sections.map((s, n) => (
            <Fragment key={s.label}>
              <div className="space-y-0.5">
                <p className="px-2 pb-1 text-[11px] font-medium tracking-[0.02em] text-foreground/35">{s.label}</p>
                {s.items.map((i) => <NavLink key={i.href} href={i.href} icon={i.icon}>{i.label}</NavLink>)}
              </div>
              {n === 0 && <ProjectsNav projects={projects} />}
            </Fragment>
          ))}
        </nav>
        <div className="space-y-0.5 border-t border-foreground/[0.06] pt-4">
          <p className="truncate px-2 pb-1 text-[11px] text-foreground/35">{me?.email}</p>
          <NavLink href="/account" icon="account">Account</NavLink>
          <SignOutLink />
        </div>
      </aside>
      <MobileNav sections={sections} projects={projects} email={me?.email ?? ''} />

      <main className="min-w-0 px-4 pt-5 pb-16 sm:px-6 md:pt-8 lg:px-10">{children}</main>
    </div>
  );
}

export function PageHeader({ title, description, aside, children }: { title: string; description?: string; aside?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[26px] leading-tight font-medium tracking-[-0.02em] break-words">{title}</h1>
          {description && <p className="text-[15px] text-muted-foreground">{description}</p>}
        </div>
        {aside && <div className="shrink-0 pt-1">{aside}</div>}
      </div>
      {children}
    </div>
  );
}

// Filters: small squared chips like the Marketing label; the active one lifted onto white with Archy blue text.
export function Pills({ items }: { items: { href: string; label: string; active: boolean }[] }) {
  return (
    <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`flex h-7 shrink-0 items-center rounded-[4px] px-2.5 text-[13px] transition-colors ${
            i.active ? 'bg-[#E6F4FF] font-medium text-primary' : 'bg-foreground/[0.04] text-foreground/60 hover:bg-foreground/[0.07] hover:text-foreground'
          }`}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}

// Two-way switch (whose pieces): a grey track with the chosen option lifted onto white.
export function Segmented({ items }: { items: { href: string; label: string; active: boolean }[] }) {
  return (
    <div className="inline-flex h-7 shrink-0 items-center rounded-[5px] bg-foreground/[0.05] p-0.5">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.active ? 'page' : undefined}
          className={`flex h-6 items-center rounded-[4px] px-2.5 text-[13px] transition-colors ${
            i.active ? 'bg-background font-medium text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]' : 'text-foreground/55 hover:text-foreground'
          }`}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}
