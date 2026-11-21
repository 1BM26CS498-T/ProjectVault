import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const steps = [
  {
    number: '01',
    title: 'Find inspiration',
    description: 'Browse approved projects and discover ideas, tools, and approaches.',
    page: 'search-projects',
    action: 'Explore projects',
    icon: '⌕',
  },
  {
    number: '02',
    title: 'Share your idea',
    description: 'Send a proposal to a faculty guide and get thoughtful feedback.',
    page: 'propose',
    action: 'Submit a proposal',
    icon: '✳',
  },
  {
    number: '03',
    title: 'Make it official',
    description: 'Keep your work moving through project review and verification.',
    page: 'my-projects',
    action: 'Track your work',
    icon: '✓',
  },
];

const questions = [
  {
    question: 'What can I find in ProjectVault?',
    answer: 'A searchable catalogue of approved college projects, with descriptions and the technologies used.',
  },
  {
    question: 'How do I get feedback on a project idea?',
    answer: 'Sign in, submit a proposal, and choose a faculty guide to review your idea.',
  },
  {
    question: 'Can I follow a project after submitting it?',
    answer: 'Yes. Your dashboard and My Projects area help you keep track of your project as it moves through review.',
  },
];

export default function LandingPage({ navigate }) {
  const { user } = useAuth();
  const [openQuestion, setOpenQuestion] = useState(0);

  return (
    <div className="space-y-16 py-6 md:py-10">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#403a4b] px-6 py-12 text-white shadow-xl shadow-lavender-900/10 sm:px-10 md:px-14 md:py-16">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=2200&q=85')" }}
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-[#343440]/90 via-[#4b4659]/82 to-[#57746d]/66" />
        <div aria-hidden="true" className="absolute -right-24 -top-32 -z-10 h-96 w-96 rounded-full bg-[#d2c1dc]/20 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-36 left-1/3 -z-10 h-80 w-80 rounded-full bg-[#b8cdbf]/20 blur-3xl" />

        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_.85fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.16em] text-lavender-100">
              <span className="h-2 w-2 rounded-full bg-[#b8cdbf]" />
              Ideas grow better together
            </p>
            <h1 className="mt-6 max-w-2xl text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
              Your next big idea starts <span className="text-[#d7c8df]">here.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-lavender-50 sm:text-lg">
              Discover student projects, shape your own idea, and connect with faculty guidance—all in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => navigate('search-projects')}
                className="rounded-xl bg-[#c4d5ca] px-5 py-3 font-bold text-[#343440] shadow-lg shadow-black/10 hover:bg-[#d7e3da]"
              >
                Explore projects <span aria-hidden="true">→</span>
              </button>
              <button
                onClick={() => navigate(user ? 'propose' : 'register')}
                className="rounded-xl border border-white/30 bg-white/5 px-5 py-3 font-bold text-white hover:bg-white/15"
              >
                {user ? 'Share an idea' : 'Create your account'}
              </button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-lavender-100">
              <span>✦ Find inspiration</span>
              <span>✦ Get faculty guidance</span>
              <span>✦ Track your progress</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-4 rotate-3 rounded-[2rem] bg-gradient-to-br from-[#b8cdbf]/35 to-[#cbb9d6]/35 blur-sm" />
            <div className="relative rounded-[1.6rem] border border-white/20 bg-white/10 p-5 shadow-xl backdrop-blur-xl sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-[#d7c8df]">Your project journey</p>
                  <p className="mt-1 text-lg font-bold">From spark to showcase</p>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {steps.map((step, index) => (
                  <button
                    key={step.number}
                    onClick={() => navigate(user || step.page === 'search-projects' ? step.page : 'register')}
                    className="group flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/25 p-4 text-left hover:border-[#c4d5ca]/60 hover:bg-white/10"
                  >
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-bold ${index === 0 ? 'bg-[#c4d5ca] text-[#343440]' : 'bg-white/10 text-lavender-100'}`}>
                      {step.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold uppercase tracking-wider text-lavender-200">{step.number} / 03</span>
                      <span className="mt-1 block font-bold">{step.title}</span>
                    </span>
                    <span className="text-lg text-lavender-200 transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-center text-xs text-lavender-200">A clearer path for every campus project.</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-extrabold uppercase tracking-[.16em] text-violet-700">One workspace, every step</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Turn curiosity into something real.</h2>
          <p className="mt-3 leading-7 text-slate-600">Whether you’re looking for inspiration or ready to build, ProjectVault helps you move forward.</p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => (
            <article
              key={step.number}
              className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-teal-200 hover:shadow-xl hover:shadow-slate-950/10"
            >
              <div className="flex items-center justify-between">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl text-xl font-bold ${index === 1 ? 'bg-peach-100 text-peach-800' : index === 2 ? 'bg-sage-100 text-sage-800' : 'bg-teal-100 text-teal-800'}`}>
                  {step.icon}
                </span>
                <span className="text-sm font-extrabold tracking-widest text-slate-300">{step.number}</span>
              </div>
              <h3 className="mt-5 text-xl font-extrabold text-slate-950">{step.title}</h3>
              <p className="mt-2 flex-1 leading-6 text-slate-600">{step.description}</p>
              <button
                onClick={() => navigate(user || step.page === 'search-projects' ? step.page : 'register')}
                className="mt-6 flex items-center gap-2 self-start font-bold text-blue-700 group-hover:text-blue-900"
              >
                {step.action}<span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="grid items-center gap-8 rounded-3xl bg-amber-50 px-6 py-8 ring-1 ring-amber-100 sm:px-10 md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[.16em] text-amber-800">Good ideas deserve a place to grow</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Ready to make your next move?</h2>
          <p className="mt-2 max-w-2xl leading-6 text-slate-600">Browse the project catalogue or sign in to open your personal workspace.</p>
        </div>
        <div className="flex flex-wrap gap-3 md:justify-end">
          <button onClick={() => navigate('search-projects')} className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white shadow-lg shadow-blue-900/15 hover:bg-blue-800">
            Browse projects
          </button>
          <button onClick={() => navigate(user ? 'dashboard' : 'login')} className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-800 hover:bg-slate-100">
            {user ? 'Open dashboard' : 'Sign in'}
          </button>
        </div>
      </section>

      <section className="mx-auto max-w-3xl">
        <div className="text-center">
          <p className="text-sm font-extrabold uppercase tracking-[.16em] text-blue-700">Quick answers</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">A few things you might be wondering</h2>
          <button onClick={() => navigate('faq')} className="mt-3 font-bold text-[#873d4a] hover:underline">
            Browse all answers or ask a question →
          </button>
        </div>
        <div className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5">
          {questions.map(({ question, answer }, index) => {
            const isOpen = openQuestion === index;
            const answerId = `landing-answer-${index}`;

            return (
              <div key={question}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={answerId}
                  onClick={() => setOpenQuestion(isOpen ? -1 : index)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left font-bold text-slate-900 hover:text-violet-700"
                >
                  {question}
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-50 text-violet-700 transition-transform ${isOpen ? 'rotate-45' : ''}`} aria-hidden="true">+</span>
                </button>
                <p id={answerId} hidden={!isOpen} className="max-w-2xl pb-5 pr-8 leading-6 text-slate-600">{answer}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
