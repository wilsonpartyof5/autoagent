import Image from 'next/image';
import { cn } from '@/lib/utils';

interface PhoneFrameProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

export function PhoneFrame({ src, alt, className, priority = false }: PhoneFrameProps) {
  return (
    <div
      className={cn(
        'relative shrink-0 rounded-[40px] bg-[#0E1020] p-2 shadow-[0_40px_80px_rgba(30,30,90,0.28),inset_0_0_0_2px_#2A2E48] sm:rounded-[48px] sm:p-2.5',
        className,
      )}
    >
      <div className="relative aspect-[393/852] overflow-hidden rounded-[32px] bg-[#EEF1F7] sm:rounded-[38px]">
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="(min-width: 1280px) 330px, (min-width: 768px) 220px, 260px"
          className="object-cover object-top"
        />
      </div>
    </div>
  );
}
