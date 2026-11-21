export default function StatusBadge({ status = 'Unknown' }) {
  const styles = {
    approved: 'bg-green-100 text-green-800',
    verified: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    pending: 'bg-amber-100 text-amber-800',
    submitted: 'bg-blue-100 text-blue-800',
    changes_requested: 'bg-orange-100 text-orange-800',
  };
  const key = String(status).toLowerCase().replaceAll(' ', '_');
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[key] || 'bg-slate-100 text-slate-700'}`}>{String(status).replaceAll('_', ' ')}</span>;
}
