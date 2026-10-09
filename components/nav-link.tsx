'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebar } from '@/components/sidebar';
import { Archive02Icon, Album02Icon, BookOpen01Icon, Settings02Icon, CheckListIcon, Folder01Icon, Image02Icon, LayoutGridIcon, Logout03Icon, PaintBoardIcon, PlugSocketIcon, UserCircleIcon, UserGroupIcon } from '@hugeicons/core-free-icons';

export const NAV_ICONS = { gallery: Image02Icon, templates: LayoutGridIcon, install: PlugSocketIcon, docs: BookOpen01Icon, team: UserGroupIcon, account: UserCircleIcon, signout: Logout03Icon, project: Folder01Icon, archive: Archive02Icon, canvas: PaintBoardIcon, review: CheckListIcon, admin: Settings02Icon, assets: Album02Icon };
export type NavIcon = keyof typeof NAV_ICONS;

export const ROW = 'flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] transition-colors';

// Collapsed rail: a centred icon with the label as a tooltip.
function Collapsed({ label, children }: { label: React.ReactNode; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function NavLink({ href, icon, children, trailing, onNavigate }: { href: string; icon: NavIcon; children: React.ReactNode; trailing?: React.ReactNode; onNavigate?: () => void }) {
  const path = usePathname();
  const { collapsed } = useSidebar();
  // Section roots that have pages below them in the nav (Admin → Team) are active only on themselves.
  const active = href === '/' || href === '/admin' ? path === href : path === href || path.startsWith(`${href}/`);
  if (collapsed) {
    return (
      <Collapsed label={children}>
        <Link href={href} onClick={onNavigate} aria-current={active ? 'page' : undefined} aria-label={typeof children === 'string' ? children : undefined}
          className={`${ROW} justify-center px-0 ${active ? 'bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.06)]' : 'hover:bg-foreground/[0.04]'}`}>
          <HugeiconsIcon icon={NAV_ICONS[icon] ?? Folder01Icon} className={`size-4 shrink-0 ${active ? 'text-primary' : 'text-foreground/45'}`} strokeWidth={1.6} />
        </Link>
      </Collapsed>
    );
  }
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`${ROW} ${
        active ? 'bg-background text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.06)]' : 'text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground'
      }`}
    >
      <HugeiconsIcon icon={NAV_ICONS[icon] ?? Folder01Icon} className={`size-4 shrink-0 ${active ? 'text-primary' : 'text-foreground/40'}`} strokeWidth={1.6} />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </Link>
  );
}

// Sign out is a plain anchor (a full navigation to the route handler), styled like the other rows.
export function SignOutLink() {
  const { collapsed } = useSidebar();
  if (collapsed) {
    return (
      <Collapsed label="Sign out">
        <a href="/auth/signout" aria-label="Sign out" className={`${ROW} justify-center px-0 hover:bg-foreground/[0.04]`}>
          <HugeiconsIcon icon={NAV_ICONS.signout} className="size-4 shrink-0 text-foreground/45" strokeWidth={1.6} />
        </a>
      </Collapsed>
    );
  }
  return (
    <a href="/auth/signout" className={`${ROW} text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground`}>
      <HugeiconsIcon icon={NAV_ICONS.signout} className="size-4 shrink-0 text-foreground/40" strokeWidth={1.6} />
      Sign out
    </a>
  );
}
