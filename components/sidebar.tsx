'use client';

import { createContext, Fragment, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { SidebarLeft01Icon } from '@hugeicons/core-free-icons';
import { ArchyWordmark } from '@/components/archy-wordmark';
import { BrandLockup } from '@/components/brand-lockup';
import { NavLink, SignOutLink } from '@/components/nav-link';
import { ProjectsNav, type ProjectLink } from '@/components/projects-nav';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { NavSection } from '@/components/app-shell';

const SidebarContext = createContext({ collapsed: false });
export const useSidebar = () => useContext(SidebarContext);

const WIDE = 240, NARROW = 60;
// Full-screen tools open with the rail collapsed, without changing the saved preference.
const opensCollapsed = (path: string) => /^\/canvas\/[^/]+/.test(path);

// The app frame: the left rail (240px, or 60px with icons only) and the content. The preference lives
// in a cookie so the server draws the right width on the first paint. ⌘\ toggles it.
export function ShellFrame({ initialCollapsed, sidebar, children }: { initialCollapsed: boolean; sidebar: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname();
  const [pref, setPref] = useState(initialCollapsed);
  const [override, setOverride] = useState<{ path: string; collapsed: boolean } | null>(null);
  const collapsed = override?.path === path ? override.collapsed : opensCollapsed(path) || pref;

  const toggle = useCallback(() => {
    const next = !collapsed;
    if (opensCollapsed(path)) { setOverride({ path, collapsed: next }); return; }
    setPref(next);
    document.cookie = `sidebar=${next ? 'collapsed' : 'expanded'}; path=/; max-age=31536000; samesite=lax`;
  }, [collapsed, path]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === '\\') { e.preventDefault(); toggle(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return (
    <SidebarContext.Provider value={{ collapsed }}>
      <ToggleContext.Provider value={toggle}>
        <div
          className="min-h-dvh md:grid md:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] md:transition-[grid-template-columns] md:duration-200"
          style={{ '--sidebar-w': `${collapsed ? NARROW : WIDE}px` } as React.CSSProperties}
        >
          {sidebar}
          {children}
        </div>
      </ToggleContext.Provider>
    </SidebarContext.Provider>
  );
}

const ToggleContext = createContext<() => void>(() => {});

// Left rail on a faint grey layer (the login's card-on-ground idea): Studio lockup, icon nav with the
// active page lifted onto white, account at the bottom. Collapsed, only icons remain, with tooltips.
export function Sidebar({ sections, projects, me, email }: { sections: NavSection[]; projects: ProjectLink[]; me?: { id: string; is_admin: boolean }; email: string }) {
  const { collapsed } = useSidebar();
  const toggle = useContext(ToggleContext);
  return (
    <aside className={`sticky top-0 hidden h-dvh flex-col overflow-hidden border-r border-foreground/[0.06] bg-[#FAFAFA] py-6 md:flex ${collapsed ? 'px-2.5' : 'px-3'}`}>
      <div className={`flex items-center ${collapsed ? 'flex-col gap-4' : 'justify-between'}`}>
        <Link href="/" className={collapsed ? 'flex justify-center' : 'px-2'} aria-label="Archy Studio">
          {collapsed ? <ArchyWordmark mark className="h-8 w-auto text-primary" /> : <BrandLockup size="sm" label={false} />}
        </Link>
        <Tooltip>
          <TooltipTrigger
            render={<button type="button" onClick={toggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} />}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-foreground/40 transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
          >
            <HugeiconsIcon icon={SidebarLeft01Icon} className="size-4" strokeWidth={1.6} />
          </TooltipTrigger>
          <TooltipContent side="right">{collapsed ? 'Expand' : 'Collapse'} <span className="text-background/50">⌘\</span></TooltipContent>
        </Tooltip>
      </div>
      <nav className={`-mx-3 mt-6 min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-4 [scrollbar-width:thin] ${collapsed ? 'space-y-3' : 'space-y-5'}`}>
        {sections.map((s, n) => (
          <Fragment key={s.label}>
            <div className="space-y-0.5">
              {collapsed ? (n > 0 && <div className="mx-2 mb-3 h-px bg-foreground/[0.07]" aria-hidden />) : <p className="px-2 pb-1 text-[11px] font-medium tracking-[0.02em] text-foreground/35">{s.label}</p>}
              {s.items.map((i) => <NavLink key={i.href} href={i.href} icon={i.icon}>{i.label}</NavLink>)}
            </div>
            {n === 0 && <ProjectsNav projects={projects} me={me} />}
          </Fragment>
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-foreground/[0.06] pt-4">
        {!collapsed && <p className="truncate px-2 pb-1 text-[11px] text-foreground/35">{email}</p>}
        <NavLink href="/account" icon="account">Account</NavLink>
        <SignOutLink />
      </div>
    </aside>
  );
}
