import { Show, onMount, onCleanup, createUniqueId, type JSX } from 'solid-js';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: JSX.Element;
}

const Modal = (props: ModalProps) => {
  const titleId = createUniqueId();

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') props.onClose();
  };

  onMount(() => document.addEventListener('keydown', handleKeyDown));
  onCleanup(() => document.removeEventListener('keydown', handleKeyDown));

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={() => props.onClose()}
      >
        <div
          class="w-full max-w-md rounded-xl border border-border bg-bg-secondary p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id={titleId} class="mb-4 text-xl font-semibold text-text-primary">{props.title}</h2>
          {props.children}
        </div>
      </div>
    </Show>
  );
};

export default Modal;
