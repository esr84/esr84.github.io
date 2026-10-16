/**
 * `?text=1` input box: typing replaces the microphone for desktop testing. It stays on top
 * of the canvas (also while the emulated XR session is running).
 */
export function createTextInput(container: HTMLElement, onSubmit: (text: string) => void) {
  const form = document.createElement('form');
  form.className = 'text-input';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Escribe lo que dirías y pulsa Intro';
  input.setAttribute('aria-label', 'Tu respuesta');
  input.autocomplete = 'off';
  const button = document.createElement('button');
  button.type = 'submit';
  button.textContent = 'Decir';
  form.append(input, button);
  container.append(form);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    onSubmit(text);
  });

  return { form, input };
}
