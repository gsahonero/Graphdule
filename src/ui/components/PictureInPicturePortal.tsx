import React from 'react';
import { createPortal } from 'react-dom';

interface DocumentPictureInPictureOptions {
  width?: number;
  height?: number;
  disallowReturnToOpener?: boolean;
  preferInitialWindowPlacement?: boolean;
}

interface DocumentPictureInPicture extends EventTarget {
  requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
  readonly window: Window | null;
  onenter: ((this: DocumentPictureInPicture, ev: Event) => void) | null;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

/**
 * Copies all stylesheets and theme styling from the main document to the target window.
 */
export function syncStylesToPipWindow(targetDoc: Document): void {
  // Copy all style and link[rel="stylesheet"] elements
  const headElements = document.querySelectorAll('style, link[rel="stylesheet"]');
  headElements.forEach((el) => {
    targetDoc.head.appendChild(el.cloneNode(true));
  });

  // Sync theme classes (e.g. 'dark' or 'light')
  targetDoc.documentElement.className = document.documentElement.className;
  targetDoc.body.className = 'm-0 p-0 bg-slate-950 text-slate-100 font-sans overflow-hidden select-none antialiased';
}

export interface RequestPiPOptions {
  width?: number;
  height?: number;
  title?: string;
  onClose?: () => void;
}

/**
 * Requests an OS-level Document Picture-in-Picture window, falling back to a popup window if unsupported.
 */
export async function requestPictureInPictureWindow(
  options: RequestPiPOptions = {}
): Promise<Window | null> {
  const width = options.width || 420;
  const height = options.height || 170;

  let win: Window | null = null;

  // 1. Try modern Document Picture-in-Picture API (Chromium 111+)
  if (typeof window !== 'undefined' && 'documentPictureInPicture' in window && window.documentPictureInPicture) {
    try {
      win = await window.documentPictureInPicture.requestWindow({
        width,
        height,
      });
    } catch (err) {
      console.warn('Document Picture-in-Picture request failed, attempting popup fallback:', err);
    }
  }

  // 2. Fallback to compact popup window for other browsers (Safari, Firefox)
  if (!win && typeof window !== 'undefined') {
    try {
      const left = Math.max(0, (window.screen?.availWidth || 1024) - width - 24);
      const top = Math.max(0, (window.screen?.availHeight || 768) - height - 48);
      win = window.open(
        '',
        'graphdule_focus_pip',
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
      );
    } catch (err) {
      console.error('Failed to open popup window for focus session:', err);
    }
  }

  if (!win) {
    return null;
  }

  win.document.title = options.title || 'Graphdule • Active Focus Session';
  syncStylesToPipWindow(win.document);

  if (options.onClose) {
    const handleClose = () => {
      options.onClose?.();
    };
    win.addEventListener('pagehide', handleClose, { once: true });
  }

  return win;
}

export interface PictureInPicturePortalProps {
  pipWindow: Window | null;
  children: React.ReactNode;
}

/**
 * Renders React children directly into the external Picture-in-Picture window's body.
 */
export const PictureInPicturePortal: React.FC<PictureInPicturePortalProps> = ({
  pipWindow,
  children,
}) => {
  if (!pipWindow || !pipWindow.document?.body) {
    return null;
  }
  return createPortal(children, pipWindow.document.body);
};
