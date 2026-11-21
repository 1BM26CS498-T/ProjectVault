export default function Footer({ navigate }) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-stone-200 bg-[#fffaf7] px-6 py-6 text-center text-sm text-slate-500">
      <button onClick={() => navigate('faq')} className="font-semibold text-[#873d4a] hover:text-[#5a2c39]">
        FAQ & Ask a question
      </button>
      <p className="mt-2">© {year} @projectvault · College Project Discovery & Verification</p>
    </footer>
  );
}
