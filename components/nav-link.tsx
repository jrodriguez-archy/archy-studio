'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { Archive02Icon, Folder01Icon, Image02Icon, LayoutGridIcon, Logout03Icon, PlugSocketIcon, UserCircleIcon, UserGroupIcon } from '@hugeicons/core-free-icons';

export const NAV_ICONS = { gallery: Image02Icon, templates: LayoutGridIcon, install: PlugSocketIcon, team: UserGroupIcon, account: UserCircleIcon, signout: Logout03Icon, project: Folder01Icon, archive: Archive02Icon };
export type NavIcon = keyof typeof NAV_ICONS;

const ROW = 'flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] transition-colors';

export function NavLink({ href, icon, children, trailing, onNavigate }: { href: string; icon: NavIcon; children: React.ReactNode; trailing?: React.ReactNode; onNavigate?: () => void }) {
  const path = usePathname();
  const active = href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
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
  return (
    <a href="/auth/signout" className={`${ROW} text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground`}>
      <HugeiconsIcon icon={NAV_ICONS.signout} className="size-4 shrink-0 text-foreground/40" strokeWidth={1.6} />
      Sign out
    </a>
  );
}
