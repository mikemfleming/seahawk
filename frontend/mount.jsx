import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

export function mountControl(container, element) {
  const root = createRoot(container);
  flushSync(() => root.render(element));
  return container.firstElementChild;
}

export function appendSlot(parent) {
  const slot = document.createElement('div');
  slot.style.display = 'contents';
  parent.append(slot);
  return slot;
}
