'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { specialOfferLogoCandidates } from '@/lib/subscriptions/specialOfferLogoUrl';

type Props = {
  logoUrl: string | null | undefined;
  alt?: string;
  className?: string;
  /** Shown when there is no logo or no domain can serve it. */
  fallback?: ReactNode;
};

export default function SpecialOfferLogoImage({ logoUrl, alt = '', className, fallback = null }: Props) {
  const candidates = useMemo(() => specialOfferLogoCandidates(logoUrl), [logoUrl]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [candidates]);

  const src = candidates[index];
  if (!src) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} onError={() => setIndex((i) => i + 1)} />
  );
}
