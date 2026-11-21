import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';

const commonQuestions = [
  {
    id: 'common-projects',
    question: 'What can I find in ProjectVault?',
    answer: 'Browse approved college projects, their summaries, technologies, reports, and demos.',
  },
  {
    id: 'common-proposals',
    question: 'How do I get feedback on a project idea?',
    answer: 'Sign in, submit your idea with a faculty guide, and follow its review status from your dashboard.',
  },
  {
    id: 'common-files',
    question: 'Which files can I include with my project?',
    answer: 'You can attach a PDF or Word report, add a live demo link, and upload an MP4, MOV, WEBM, or M4V demo video.',
  },
];

export default function FaqPage({ navigate }) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [question, setQuestion] = useState('');
  const [openQuestion, setOpenQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadQuestions = useCallback(async () => {
    if (!supabase) {
      setQuestions([]);
      setLoading(false);
      setError('The ProjectVault API is unavailable. Check that the backend is running and connected to PostgreSQL.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data, error: queryError } = await supabase
        .from('faq_questions')
        .select('id, question, answer, answered_at')
        .eq('status', 'published')
        .not('answer', 'is', null)
        .order('answered_at', { ascending: false });

      if (queryError) throw queryError;
      setQuestions(data || []);
    } catch (loadError) {
      setError(`Community answers could not be loaded: ${loadError.message}`);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  async function submitQuestion(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    const cleanQuestion = question.trim();
    if (cleanQuestion.length < 8 || cleanQuestion.length > 1500) {
      setError('Write a question between 8 and 1,500 characters.');
      return;
    }
    if (!user) {
      setError('Sign in before submitting a question.');
      return;
    }
    if (!supabase) {
      setError('The ProjectVault API is unavailable. Check that the backend is running and connected to PostgreSQL.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: insertError } = await supabase
        .from('faq_questions')
        .insert({
          user_id: user.id,
          question: cleanQuestion,
          status: 'pending',
        });

      if (insertError) throw insertError;
      setQuestion('');
      setMessage('Your question was sent to the admin team for review. It will appear here after it is answered.');
    } catch (submitError) {
      setError(`Your question could not be submitted: ${submitError.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  const allQuestions = [
    ...commonQuestions,
    ...questions.map((item) => ({
      id: item.id,
      question: item.question,
      answer: item.answer,
    })),
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="relative isolate overflow-hidden rounded-3xl bg-[#352033] px-6 py-10 text-white shadow-xl sm:px-10">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-cover bg-center opacity-40"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1800&q=80')" }}
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-[#352033]/95 via-[#352033]/85 to-[#813f4b]/70" />
        <p className="text-sm font-bold uppercase tracking-[.16em] text-rose-200">Help & community</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Frequently asked questions</h1>
        <p className="mt-3 max-w-2xl leading-7 text-rose-50">Find an answer or send your question to the ProjectVault admin team. Approved answers become part of the shared FAQ.</p>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">Answers and guidance</h2>
            <p className="mt-1 text-sm text-slate-600">Community questions appear here after an admin answers and approves them.</p>
          </div>
          <button type="button" onClick={loadQuestions} disabled={loading} className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-stone-50 disabled:opacity-60">
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}

        <div className="divide-y divide-stone-200 rounded-2xl border border-stone-200 px-4">
          {allQuestions.map(({ id, question: title, answer }) => {
            const isOpen = openQuestion === id;
            const answerId = `faq-answer-${id}`;

            return (
              <div key={id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={answerId}
                  onClick={() => setOpenQuestion(isOpen ? '' : id)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left font-bold text-slate-900 hover:text-[#a84448]"
                >
                  {title}
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-50 text-lg text-[#a84448] transition-transform ${isOpen ? 'rotate-45' : ''}`} aria-hidden="true">+</span>
                </button>
                <p id={answerId} hidden={!isOpen} className="max-w-3xl pb-5 pr-8 leading-7 text-slate-600">{answer}</p>
              </div>
            );
          })}
          {loading && <p className="py-4 text-sm text-slate-500">Loading community answers…</p>}
          {!loading && allQuestions.length === commonQuestions.length && !error && (
            <p className="py-4 text-sm text-slate-500">No approved community questions yet. Be the first to ask.</p>
          )}
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl bg-[#f7ede8] p-5 ring-1 ring-[#ecd8d2] sm:p-8 md:grid-cols-[.8fr_1.2fr]">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[.14em] text-[#9a4140]">Ask ProjectVault</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Can’t find your answer?</h2>
          <p className="mt-2 leading-6 text-slate-600">Send your question to the admin team. It stays private until it has been reviewed and answered.</p>
        </div>
        <div>
          {message && <p role="status" className="mb-3 rounded-xl bg-white p-3 text-sm text-emerald-800">{message}</p>}
          {user ? (
            <form onSubmit={submitQuestion}>
              <label htmlFor="community-question" className="mb-2 block text-sm font-bold text-slate-800">Your question</label>
              <textarea
                id="community-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                maxLength={1500}
                minLength={8}
                rows={4}
                required
                placeholder="What would you like to know?"
                className="w-full resize-y rounded-xl border border-stone-300 bg-white p-4 text-sm focus:border-[#a84448]"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500">{question.length}/1500 characters</span>
                <button type="submit" disabled={submitting} className="rounded-xl bg-[#873d4a] px-5 py-3 font-bold text-white hover:bg-[#71323d] disabled:opacity-60">
                  {submitting ? 'Sending…' : 'Send question'}
                </button>
              </div>
            </form>
          ) : (
            <div className="rounded-2xl border border-white bg-white/80 p-5">
              <p className="font-semibold text-slate-800">Sign in to ask a question.</p>
              <button onClick={() => navigate('login')} className="mt-3 rounded-lg bg-[#873d4a] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#71323d]">Sign in</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
