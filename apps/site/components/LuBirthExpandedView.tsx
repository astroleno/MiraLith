"use client";

import { useEffect, useRef, type RefObject } from "react";

interface LuBirthExpandedViewProps {
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}

export function LuBirthExpandedView({ open, onClose, returnFocusRef }: LuBirthExpandedViewProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        returnFocusRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open, returnFocusRef]);

  if (!open) {
    return null;
  }

  return (
    <div className="expanded-view" role="dialog" aria-modal="true" aria-label="LuBirth expanded view">
      <div className="expanded-view__panel">
        <div className="expanded-view__copy">
          <p>LuBirth</p>
          <h2>Moon Earth You</h2>
          <p>出生、时间、轨道与自我识别，被收束成同一块黑色宇宙界面。</p>
        </div>
        <button
          ref={closeRef}
          className="expanded-view__close"
          type="button"
          onClick={() => {
            onClose();
            returnFocusRef.current?.focus();
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
