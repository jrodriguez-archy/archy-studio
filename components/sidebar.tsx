'use client';

import { createContext, Fragment, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, SidebarLeft01Icon, Tick02Icon, UnfoldMoreIcon } from '@hugeicons/core-free-icons';
import { BrandLockup, BrandMark } from '@/components/brand-lockup';
import { NAV_ICONS, NavLink, ROW } from '@/components/nav-link';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ProjectsNav, type ProjectLink } from '@/components/projects-nav';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { NavItem, NavSection } from '@/components/app-shell';
import { BRAND_IDS, BRANDS, brandCookie, type Brand } from '@/lib/brands';
import { firstName } from '@/lib/names';

const SidebarContext = createContext({ collapsed: false });
export const useSidebar = () => useContext(SidebarContext);

const WIDE = 240, NARROW = 60;
// Full-screen tools open with the rail collapsed, without changing the saved preference.
const opensCollapsed = (path: string) => /^\/canvas(\/|$)/.test(path);

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
export function Sidebar({ sections, admin, projects, me, email, name, brand }: { sections: NavSection[]; admin: NavItem[] | null; projects: ProjectLink[]; me?: { id: string; is_admin: boolean }; email: string; name: string; brand: Brand }) {
  const { collapsed } = useSidebar();
  const toggle = useContext(ToggleContext);
  return (
    <aside className={`sticky top-0 hidden h-dvh flex-col overflow-hidden border-r border-foreground/[0.06] bg-[#FAFAFA] pt-6 pb-3 md:flex ${collapsed ? 'px-2.5' : 'px-3'}`}>
      <div className={`flex items-center ${collapsed ? 'flex-col gap-4' : 'justify-between'}`}>
        <Link href="/" className={collapsed ? 'flex justify-center' : 'px-2'} aria-label={BRANDS[brand].studio}>
          {collapsed ? <BrandMark brand={brand} height={32} /> : <BrandLockup size="sm" label={false} brand={brand} />}
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
        <BrandMenu brand={brand} />
        <NavLink href="/install" icon="install">Install</NavLink>
        {admin && <AdminMenu items={admin} />}
        <AccountMenu name={name} email={email} />
      </div>
    </aside>
  );
}

// The rail's menus open upward (to the right when the rail is collapsed).
const menuSide = (collapsed: boolean) => (collapsed ? { side: 'right' as const, align: 'end' as const } : { side: 'top' as const, align: 'start' as const });

// The brand Studio works in: Archy or DOC. Each has its own templates, assets, gallery and projects,
// so switching starts over on that brand's Gallery.
export function useSwitchBrand() {
  const router = useRouter();
  return (b: Brand) => {
    document.cookie = brandCookie(b);
    router.push('/');
    router.refresh();
  };
}

function BrandMenu({ brand }: { brand: Brand }) {
  const { collapsed } = useSidebar();
  const switchTo = useSwitchBrand();
  const trigger = (
    <DropdownMenuTrigger aria-label={`Brand: ${BRANDS[brand].name}`}
      className={`${ROW} w-full text-foreground/60 outline-none hover:bg-foreground/[0.04] hover:text-foreground ${collapsed ? 'justify-center px-0' : ''}`}>
      <span className="flex size-4 shrink-0 items-center justify-center"><BrandMark brand={brand} /></span>
      {!collapsed && <><span className="min-w-0 flex-1 truncate text-left">{BRANDS[brand].name}</span><HugeiconsIcon icon={UnfoldMoreIcon} className="size-3.5 text-foreground/35" /></>}
    </DropdownMenuTrigger>
  );
  return (
    <DropdownMenu>
      {collapsed ? <Tooltip><TooltipTrigger render={trigger} /><TooltipContent side="right">{BRANDS[brand].name}</TooltipContent></Tooltip> : trigger}
      <DropdownMenuContent {...menuSide(collapsed)} sideOffset={6} className="w-56">
        {BRAND_IDS.map((b) => (
          <DropdownMenuItem key={b} onClick={() => b !== brand && switchTo(b)} className="gap-2 text-[13px]">
            <span className="flex size-4 items-center justify-center"><BrandMark brand={b} /></span>
            <span className="flex-1">{BRANDS[b].name}</span>
            {b === brand && <HugeiconsIcon icon={Tick02Icon} className="size-3.5 text-foreground/50" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Admin: one row, its pages in a menu. Lit while on any of them.
function AdminMenu({ items }: { items: NavItem[] }) {
  const { collapsed } = useSidebar();
  const path = usePathname();
  const active = path === '/admin' || path.startsWith('/admin/');
  const trigger = (
    <DropdownMenuTrigger aria-label="Admin"
      className={`${ROW} w-full outline-none ${collapsed ? 'justify-center px-0' : ''} ${active ? 'bg-background text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.06)]' : 'text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground'}`}>
      <HugeiconsIcon icon={NAV_ICONS.admin} className={`size-4 shrink-0 ${active ? 'text-primary' : 'text-foreground/40'}`} strokeWidth={1.6} />
      {!collapsed && <><span className="min-w-0 flex-1 truncate text-left">Admin</span><HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5 text-foreground/35" /></>}
    </DropdownMenuTrigger>
  );
  return (
    <DropdownMenu>
      {collapsed ? <Tooltip><TooltipTrigger render={trigger} /><TooltipContent side="right">Admin</TooltipContent></Tooltip> : trigger}
      <DropdownMenuContent {...menuSide(collapsed)} sideOffset={6} className="w-52">
        {items.map((i) => (
          <DropdownMenuItem key={i.href} render={<Link href={i.href} />} className="gap-2 text-[13px]">
            <HugeiconsIcon icon={NAV_ICONS[i.icon]} className="size-4 text-foreground/45" strokeWidth={1.6} /> {i.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// The person: initial, name, and a menu with Account and Sign out.
function AccountMenu({ name, email }: { name: string; email: string }) {
  const { collapsed } = useSidebar();
  const path = usePathname();
  const initial = (name || email || '?').trim().charAt(0).toUpperCase();
  const avatar = <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{initial}</span>;
  const trigger = (
    <DropdownMenuTrigger aria-label="Account"
      className={`${ROW} h-10 w-full outline-none ${collapsed ? 'justify-center px-0' : ''} ${path === '/account' ? 'bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.06)]' : 'hover:bg-foreground/[0.04]'}`}>
      {avatar}
      {!collapsed && <><span className="min-w-0 flex-1 truncate text-left text-foreground/75">{name ? firstName(name) : email}</span><HugeiconsIcon icon={UnfoldMoreIcon} className="size-3.5 text-foreground/35" /></>}
    </DropdownMenuTrigger>
  );
  return (
    <DropdownMenu>
      {collapsed ? <Tooltip><TooltipTrigger render={trigger} /><TooltipContent side="right">{name || email}</TooltipContent></Tooltip> : trigger}
      <DropdownMenuContent {...menuSide(collapsed)} sideOffset={6} className="w-56">
        <p className="truncate px-2 py-1.5 text-[12px] text-foreground/50">{email}</p>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/account" />} className="gap-2 text-[13px]">
          <HugeiconsIcon icon={NAV_ICONS.account} className="size-4 text-foreground/45" strokeWidth={1.6} /> Account
        </DropdownMenuItem>
        <DropdownMenuItem render={<a href="/auth/signout" />} className="gap-2 text-[13px]">
          <HugeiconsIcon icon={NAV_ICONS.signout} className="size-4 text-foreground/45" strokeWidth={1.6} /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
