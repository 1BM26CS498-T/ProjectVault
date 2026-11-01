export default function ProposalDetailPage({ id, navigate }) {
  return <section className="rounded-2xl border bg-white p-7">
    <button onClick={() => navigate('proposals')} className="text-sm font-semibold text-violet-700">← Back to proposals</button>
    <h1 className="mt-4 text-2xl font-bold">Proposal review</h1>
    <p className="mt-2 text-slate-600">Proposal ID: {id ?? 'Not selected'}</p>
    <p className="mt-3 text-slate-600">Proposal loading and review actions need to be connected to Supabase.</p>
  </section>;
}
