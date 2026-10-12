'use client';

import Image from 'next/image';

interface IPhoneFrameProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

export function IPhoneFrame({ src, alt, className = '', priority = false }: IPhoneFrameProps) {
  return (
    <div className={`relative ${className}`}>
      {/* iPhone 15/16 style frame */}
      <div className="relative mx-auto" style={{ width: '280px', maxWidth: '100%' }}>
        {/* Device frame */}
        <div 
          className="relative rounded-[3rem] bg-gradient-to-b from-zinc-800 to-zinc-900 p-[10px] shadow-2xl"
          style={{
            boxShadow: `
              0 0 0 1px rgba(255,255,255,0.1),
              0 25px 50px -12px rgba(0,0,0,0.5),
              inset 0 1px 0 rgba(255,255,255,0.1)
            `
          }}
        >
          {/* Dynamic Island */}
          <div className="absolute top-[18px] left-1/2 -translate-x-1/2 z-10">
            <div className="w-[90px] h-[28px] bg-black rounded-full" />
          </div>
          
          {/* Screen bezel */}
          <div className="relative rounded-[2.4rem] overflow-hidden bg-black">
            {/* Screen content */}
            <div className="relative aspect-[393/852]">
              <Image
                src={src}
                alt={alt}
                fill
                className="object-cover object-top"
                sizes="(max-width: 640px) 280px, 280px"
                priority={priority}
              />
            </div>
          </div>
          
          {/* Side button (right) */}
          <div 
            className="absolute right-[-2px] top-[140px] w-[3px] h-[60px] bg-zinc-700 rounded-l-sm"
            aria-hidden="true"
          />
          
          {/* Volume buttons (left) */}
          <div 
            className="absolute left-[-2px] top-[100px] w-[3px] h-[28px] bg-zinc-700 rounded-r-sm"
            aria-hidden="true"
          />
          <div 
            className="absolute left-[-2px] top-[140px] w-[3px] h-[50px] bg-zinc-700 rounded-r-sm"
            aria-hidden="true"
          />
          <div 
            className="absolute left-[-2px] top-[200px] w-[3px] h-[50px] bg-zinc-700 rounded-r-sm"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}

export function IPhoneFrameGroup({ 
  children, 
  className = '' 
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center gap-4 md:gap-8 ${className}`}>
      {children}
    </div>
  );
}
