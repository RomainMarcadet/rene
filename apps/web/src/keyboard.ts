export function isEditing(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable || target.closest('[role="textbox"]') !== null);
}

const SOCIAL_SHORTCUTS = { KeyH: 'wave', KeyJ: 'dance', KeyK: 'suspect', KeyF: 'punch', KeyE: 'nearby', KeyB: 'picker', KeyX: 'stop', Escape: 'close' } as const;
/** Physical letter keys work on French and English keyboards without using movement or PTT. */
export function socialShortcut(event: Pick<KeyboardEvent, 'code'>) {
  return SOCIAL_SHORTCUTS[event.code as keyof typeof SOCIAL_SHORTCUTS];
}
