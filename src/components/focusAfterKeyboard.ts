/** Continue keyboard navigation without moving focus after a mouse/touch answer. */
export function focusAfterKeyboard(button: HTMLButtonElement | null) {
  if (button && document.activeElement?.matches(":focus-visible")) {
    button.focus({ preventScroll: true });
  }
}
