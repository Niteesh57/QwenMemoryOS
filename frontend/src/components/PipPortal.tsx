import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

interface PipPortalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  height?: number;
  isSpeaking?: boolean;
  onPipDocumentReady?: (doc: Document) => void;
}

export const isPipSupported = () => {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
};

export const PipPortal: React.FC<PipPortalProps> = ({
  isOpen,
  onClose,
  children,
  width: _width = 300,
  height: _height = 200,
  isSpeaking = true,
  onPipDocumentReady,
}) => {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const pipWindowRef = useRef<any | null>(null);

  // Only update body style when isSpeaking changes — no dynamic resizeTo()
  useEffect(() => {
    if (!pipWindowRef.current) return;
    try {
      if (isSpeaking) {
        pipWindowRef.current.document.body.style.background = 'rgba(8, 8, 16, 0.72)';
        pipWindowRef.current.document.body.style.backdropFilter = 'blur(24px)';
        pipWindowRef.current.document.body.style.webkitBackdropFilter = 'blur(24px)';
      } else {
        pipWindowRef.current.document.body.style.background = 'transparent';
        pipWindowRef.current.document.body.style.backdropFilter = 'none';
        pipWindowRef.current.document.body.style.webkitBackdropFilter = 'none';
      }
    } catch (e: any) {
      // PiP window may have been closed
    }
  }, [isSpeaking]); // ✅ Only isSpeaking — no more dynamic resizeTo()


  useEffect(() => {
    if (!isOpen) {
      closePipWindow();
      return;
    }

    if (!isPipSupported()) {
      console.warn('Document Picture-in-Picture is not supported in this browser.');
      onClose();
      return;
    }

    const openPipWindow = async () => {
      try {
        // Open at a fixed compact size — user can manually resize in browser native PiP
        const PIP_W = 300;
        const PIP_H = 200;
        const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
          width: PIP_W,
          height: PIP_H,
        });

        pipWindowRef.current = pipWindow;

        // Copy stylesheets from main page to PiP window
        const allStyleSheets = Array.from(document.styleSheets);
        allStyleSheets.forEach((styleSheet) => {
          try {
            if (styleSheet.cssRules) {
              const newStyle = pipWindow.document.createElement('style');
              const rules = Array.from(styleSheet.cssRules)
                .map((rule) => (rule as CSSRule).cssText)
                .join('\n');
              newStyle.textContent = rules;
              pipWindow.document.head.appendChild(newStyle);
            } else if (styleSheet.href) {
              const newLink = pipWindow.document.createElement('link');
              newLink.rel = 'stylesheet';
              newLink.href = styleSheet.href;
              pipWindow.document.head.appendChild(newLink);
            }
          } catch (e) {
            if ((styleSheet as any).href) {
              const newLink = pipWindow.document.createElement('link');
              newLink.rel = 'stylesheet';
              newLink.href = (styleSheet as any).href;
              pipWindow.document.head.appendChild(newLink);
            }
          }
        });

        // Inject user-select CSS to ensure text is selectable in the PiP window
        const selectStyle = pipWindow.document.createElement('style');
        selectStyle.textContent = `
          * { box-sizing: border-box; }
          .pip-selectable-text { user-select: text !important; -webkit-user-select: text !important; cursor: text; }
          ::selection { background: rgba(139, 92, 246, 0.4); color: #fff; }
        `;
        pipWindow.document.head.appendChild(selectStyle);

        if (isSpeaking) {
          pipWindow.document.body.style.background = 'rgba(8, 8, 16, 0.72)';
          pipWindow.document.body.style.backdropFilter = 'blur(24px)';
          pipWindow.document.body.style.webkitBackdropFilter = 'blur(24px)';
        } else {
          pipWindow.document.body.style.background = 'transparent';
          pipWindow.document.body.style.backdropFilter = 'none';
          pipWindow.document.body.style.webkitBackdropFilter = 'none';
        }
        pipWindow.document.body.style.margin = '0';
        pipWindow.document.body.style.padding = '0';
        pipWindow.document.body.style.overflow = 'hidden';
        pipWindow.document.body.style.height = '100vh';
        pipWindow.document.body.style.width = '100vw';
        pipWindow.document.title = 'AI Assistant';

        const rootDiv = pipWindow.document.createElement('div');
        rootDiv.id = 'pip-portal-root';
        rootDiv.style.width = '100%';
        rootDiv.style.height = '100%';
        pipWindow.document.body.appendChild(rootDiv);

        setContainer(rootDiv);

        // ✅ Notify parent that PiP document is ready for selection listening
        if (onPipDocumentReady) {
          onPipDocumentReady(pipWindow.document);
        }

        pipWindow.addEventListener('pagehide', () => {
          setContainer(null);
          pipWindowRef.current = null;
          onClose();
        });
      } catch (err) {
        console.error('Failed to open Picture-in-Picture window:', err);
        onClose();
      }
    };

    openPipWindow();

    return () => {
      closePipWindow();
    };
  }, [isOpen]);

  const closePipWindow = () => {
    if (pipWindowRef.current) {
      try {
        pipWindowRef.current.close();
      } catch (e) {
        // Already closed
      }
      pipWindowRef.current = null;
      setContainer(null);
    }
  };

  if (!isOpen || !container) {
    return null;
  }

  return createPortal(children, container);
};
