export function isEditing(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable || target.closest('[role="textbox"]') !== null);
}
