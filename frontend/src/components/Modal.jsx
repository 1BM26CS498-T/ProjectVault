export default function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
    <section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-bold">{title}</h2><button onClick={onClose} className="rounded-lg border px-3 py-1">Close</button></div>
      <div className="mt-4">{children}</div>
    </section>
  </div>;
}
