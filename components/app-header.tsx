import Link from 'next/link';
import { ArchyWordmark } from '@/components/archy-wordmark';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { currentUser } from '@/lib/team';

const NAV = [
  { href: '/', label: 'Gallery' },
  { href: '/templates', label: 'Templates' },
  { href: '/install', label: 'Install' },
];

export async function AppHeader() {
  const me = await currentUser();
  const initials = (me?.full_name || me?.email || '?').slice(0, 2).toUpperCase();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <ArchyWordmark className="h-6 w-auto text-primary" />
          <span className="font-heading text-sm font-semibold text-foreground">Studio</span>
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {[...NAV, ...(me?.is_admin ? [{ href: '/admin', label: 'Team' }] : [])].map((n) => (
            <Button key={n.href} variant="ghost" size="sm" nativeButton={false} render={<Link href={n.href} />}>{n.label}</Button>
          ))}
        </nav>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" aria-label="Account" />}>
              <Avatar className="size-8"><AvatarFallback className="bg-accent text-xs text-accent-foreground">{initials}</AvatarFallback></Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{me?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="sm:hidden">
                {[...NAV, ...(me?.is_admin ? [{ href: '/admin', label: 'Team' }] : [])].map((n) => (
                  <DropdownMenuItem key={n.href} render={<Link href={n.href} />}>{n.label}</DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </div>
              <DropdownMenuItem render={<Link href="/account" />}>Account</DropdownMenuItem>
              <DropdownMenuItem render={<a href="/auth/signout" />}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
