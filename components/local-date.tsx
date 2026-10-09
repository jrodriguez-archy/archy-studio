'use client';
import { useEffect, useState } from 'react';

export const DAY: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
export const DATE: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
export const DATE_TIME: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' };

// A date in the viewer's own time zone. The server does not know it (it would print the UTC day), so the
// date is written once the page is in the browser.
export function LocalDate({ iso, opts = DATE }: { iso: string; opts?: Intl.DateTimeFormatOptions }) {
  const [text, setText] = useState('');
  const key = JSON.stringify(opts);
  useEffect(() => setText(new Date(iso).toLocaleString('en-US', JSON.parse(key))), [iso, key]);
  return <span suppressHydrationWarning>{text}</span>;
}
