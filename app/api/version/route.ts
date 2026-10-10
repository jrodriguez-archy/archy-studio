import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// The deploy that is running, so an open Studio can tell when a newer one is out (the sidebar's Update).
export function GET() {
  return NextResponse.json(
    { build: process.env.NEXT_PUBLIC_BUILD, version: process.env.NEXT_PUBLIC_VERSION },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
