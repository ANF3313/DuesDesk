import type { SVGProps } from "react";

function Svg({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={20}
      height={20}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);
export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
);
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><path d="M5 13l4 4L19 7" /></Svg>
);
export const IconChevronRight = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>
);
export const IconArrowRight = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
);
export const IconMail = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7.5l9 6 9-6" />
  </Svg>
);
export const IconTrash = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M4 7h16M10 4h4M6.5 7l1 13h9l1-13M10 11v6M14 11v6" />
  </Svg>
);
export const IconPencil = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><path d="M4 20l4.5-1L20 7.5l-3.5-3.5L5 15.5 4 20z" /></Svg>
);
export const IconBuilding = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <path d="M10 21v-4h4v4M9 7h2M13 7h2M9 11h2M13 11h2" />
  </Svg>
);
export const IconUsers = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3.5 20c.5-3.4 2.7-5.5 5.5-5.5s5 2.1 5.5 5.5M16 5a3.5 3.5 0 010 6.5M17.5 14.8c1.9.7 3 2.5 3.3 5.2" />
  </Svg>
);
export const IconReceipt = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3z" />
    <path d="M9.5 8h5M9.5 12h5" />
  </Svg>
);
export const IconAnnounce = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M11 5L6 9H3v6h3l5 4V5z" />
    <path d="M15.5 8.5a5 5 0 010 7" />
  </Svg>
);
export const IconSettings = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
    <circle cx="9" cy="6" r="1.8" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.8" fill="currentColor" stroke="none" />
    <circle cx="7" cy="18" r="1.8" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconAlert = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V13M12 16.5h.01" />
  </Svg>
);
export const IconRefresh = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><path d="M20 12a8 8 0 11-2.34-5.66M20 4v4h-4" /></Svg>
);
export const IconLink = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M10.5 13.5a4 4 0 005.66 0l3-3a4 4 0 10-5.66-5.66l-1.6 1.6" />
    <path d="M13.5 10.5a4 4 0 00-5.66 0l-3 3a4 4 0 105.66 5.66l1.6-1.6" />
  </Svg>
);
export const IconLogout = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M9 21H6a2 2 0 01-2-2V5a2 2 0 012-2h3M16 17l5-5-5-5M21 12H10" />
  </Svg>
);
export const IconBanknote = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6.5 12h.01M17.5 12h.01" />
  </Svg>
);
export const IconClock = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
export const IconSend = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></Svg>
);
export const IconShield = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
);
export const IconSpinner = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p} className={`animate-spin ${p.className ?? ""}`}>
    <path d="M12 3a9 9 0 109 9" />
  </Svg>
);
