/**
 * Helpers for specs that render Ionic components, which hydrate in jsdom.
 */

/**
 * The accessible name of an Ionic button: Ionic moves `aria-label` from
 * the host to the native button in its shadow root.
 */
export function ariaLabel(element: Element | null | undefined) {
  return (
    element?.getAttribute('aria-label') ??
    element?.shadowRoot?.querySelector('button')?.getAttribute('aria-label')
  );
}

/** Types into an ion-input or ion-textarea as the user would. */
export function typeInto(element: Element | null | undefined, value: string) {
  const native = element?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    'input, textarea',
  );
  if (!native) {
    throw new Error('No native input to type into');
  }
  native.value = value;
  native.dispatchEvent(new Event('input'));
}

/**
 * Waits for Ionic components to re-render after a change they observe
 * themselves, such as a form field becoming invalid.
 */
export async function ionicUpdates() {
  await new Promise((resolve) => setTimeout(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

/** Error messages of the form fields that show them (invalid and touched). */
export function shownErrors(root: Element | null | undefined) {
  return [
    ...(root?.querySelectorAll(
      ':is(ion-input, ion-textarea).ion-invalid.ion-touched .error-text',
    ) ?? []),
  ].map((error) => error.textContent?.trim());
}

/** Text without line breaks and repeated spaces. */
export function text(element: Element | null | undefined) {
  return element?.textContent?.replace(/\s+/g, ' ').trim();
}
