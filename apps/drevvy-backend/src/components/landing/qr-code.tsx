import Image from 'next/image';
import { QR_TARGET } from '@/lib/store-links';

interface QRCodeProps {
  size?: number;
  className?: string;
}

/**
 * Static SVG for https://drevvy.com/get. The file is the supplied
 * qr-drevvy-get asset, drawn locally with no QR API.
 */
export function QRCode({ size = 112, className }: QRCodeProps) {
  return (
    <Image
      src="/qr-drevvy-get.svg"
      alt={`QR code linking to ${QR_TARGET}`}
      width={size}
      height={size}
      unoptimized
      className={className}
    />
  );
}
