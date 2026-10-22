import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  id: string;
  titleId: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}

export function Modal({ id, titleId, children, onClose, busy = false }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => { dialog.close(); };
  }, []);
  return <dialog id={id} ref={ref} aria-labelledby={titleId} onCancel={event => {
    event.preventDefault();
    if (!busy) onClose();
  }}>{children}</dialog>;
}
