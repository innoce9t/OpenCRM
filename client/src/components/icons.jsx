// Minimal stroke-based line icons. All inherit `currentColor` and take a `size`.
function I({ size = 18, children, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {children}
    </svg>
  );
}

export const IconHash = (p) => <I {...p}><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" /></I>;
export const IconMegaphone = (p) => <I {...p}><path d="M4 10v4h3l7 4V6l-7 4H4Z" /><path d="M18 9a4 4 0 0 1 0 6" /></I>;
export const IconBot = (p) => <I {...p}><rect x="5" y="8" width="14" height="11" rx="2.5" /><path d="M12 8V4.5" /><circle cx="12" cy="3.4" r="1.1" /><path d="M9.5 13v1.2M14.5 13v1.2" /><path d="M2.5 12.5v3M21.5 12.5v3" /></I>;
export const IconLock = (p) => <I {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></I>;
export const IconUser = (p) => <I {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></I>;
export const IconPaperclip = (p) => <I {...p}><path d="M20 11.5 12 19.5a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9 16.4a1.6 1.6 0 0 1-2.3-2.3L14 6.8" /></I>;
export const IconMic = (p) => <I {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0" /><path d="M12 17v4M8.5 21h7" /></I>;
export const IconVideo = (p) => <I {...p}><rect x="3" y="6" width="12" height="12" rx="2.5" /><path d="M15 10.5 21 7v10l-6-3.5Z" /></I>;
export const IconTask = (p) => <I {...p}><rect x="4" y="4" width="16" height="16" rx="3.5" /><path d="M8 12.5l2.8 2.8L16 9.5" /></I>;
export const IconBolt = (p) => <I {...p}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></I>;
export const IconSend = (p) => <I {...p}><path d="M21.5 2.5 11 13" /><path d="M21.5 2.5 15 21.5l-4-8.5-8.5-4 19-6.5Z" /></I>;
export const IconPlus = (p) => <I {...p}><path d="M12 5v14M5 12h14" /></I>;
export const IconFile = (p) => <I {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5" /></I>;
export const IconImage = (p) => <I {...p}><rect x="4" y="4" width="16" height="16" rx="2.5" /><circle cx="9" cy="9.5" r="1.7" /><path d="M5 17l4.5-4.5 3.5 3.5 3-3 3 3" /></I>;
export const IconHome = (p) => <I {...p}><path d="M4 11 12 4l8 7" /><path d="M6 10v9h12v-9" /></I>;
export const IconChat = (p) => <I {...p}><path d="M5 5h14v10H9l-4 4V5Z" /></I>;
export const IconClipboard = (p) => <I {...p}><rect x="6" y="4.5" width="12" height="16" rx="2" /><path d="M9.5 4.5V3.5h5v1" /><path d="M9 10h6M9 14h6" /></I>;
export const IconArrowLeft = (p) => <I {...p}><path d="M15 5l-7 7 7 7" /></I>;
export const IconClose = (p) => <I {...p}><path d="M6 6l12 12M18 6 6 18" /></I>;
export const IconPhone = (p) => <I {...p}><path d="M6 3h3l1.5 4.5-2 1.5a11 11 0 0 0 5 5l1.5-2 4.5 1.5V18a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z" /></I>;
export const IconCallIn = (p) => <I {...p}><path d="M6 3h3l1.5 4.5-2 1.5a11 11 0 0 0 5 5l1.5-2 4.5 1.5V18a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z" /><path d="M21 3l-6 6M15 3v6h6" /></I>;
export const IconCallOut = (p) => <I {...p}><path d="M6 3h3l1.5 4.5-2 1.5a11 11 0 0 0 5 5l1.5-2 4.5 1.5V18a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z" /><path d="M15 9l6-6M21 9V3h-6" /></I>;
export const IconChevron = (p) => <I {...p}><path d="M6 9l6 6 6-6" /></I>;
