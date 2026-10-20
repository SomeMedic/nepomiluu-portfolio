'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { documentLanguage } from './document-language';

/** Shared root layouts persist during Next Link navigation between locales. */
export function DocumentLanguage() {
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.lang = documentLanguage(pathname);
  }, [pathname]);
  return null;
}
