'use client';

import { QRCodeSVG } from 'qrcode.react';
import { LEGAL } from '@/lib/legal-constants';

interface QRCodeProps {
  url?: string;
  size?: number;
  className?: string;
}

export function QRCode({ url, size = 160, className }: QRCodeProps) {
  const targetUrl = url || `${LEGAL.WEBSITE_URL}/get`;

  return (
    <div className={className}>
      <QRCodeSVG
        value={targetUrl}
        size={size}
        bgColor="transparent"
        fgColor="currentColor"
        level="M"
        includeMargin={false}
      />
    </div>
  );
}
