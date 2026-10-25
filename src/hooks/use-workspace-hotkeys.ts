import { useEffect, useRef } from "react";
import {
  QUICK_ACTIONS,
  QUICK_ACTION_SEQUENCE_MS,
  type QuickAction,
} from "@/lib/quick-actions";

export function useWorkspaceHotkeys({
  enabled,
  scope,
  onAction,
}: {
  enabled: boolean;
  scope?: string;
  onAction: (action: QuickAction) => void;
}) {
  const actionRef = useRef(onAction);
  useEffect(() => {
    actionRef.current = onAction;
  }, [onAction]);
  useEffect(() => {
    let prefixAt = 0;
    const reset = () => {
      prefixAt = 0;
    };
    const keydown = (event: KeyboardEvent) => {
      if (
        !enabled ||
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing
      )
        return;
      const target = event.target instanceof Element ? event.target : null;
      const editing = target?.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]',
      );
      const overlay = document.querySelector(
        '[role="dialog"], [role="alertdialog"], [role="menu"][data-state="open"], [data-hotkeys-disabled]',
      );
      if (
        editing ||
        overlay ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      ) {
        reset();
        return;
      }
      const key = event.key.toLowerCase();
      const now = performance.now();
      if (prefixAt && now - prefixAt <= QUICK_ACTION_SEQUENCE_MS) {
        reset();
        const action = QUICK_ACTIONS.find((action) => action.key === key);
        if (action) {
          event.preventDefault();
          actionRef.current(action.kind);
          return;
        }
      }
      if (key === "n") {
        prefixAt = now;
        event.preventDefault();
      } else reset();
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("pointerdown", reset);
    window.addEventListener("blur", reset);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("pointerdown", reset);
      window.removeEventListener("blur", reset);
    };
  }, [enabled, scope]);
}
