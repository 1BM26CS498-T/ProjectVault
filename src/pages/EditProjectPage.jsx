import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function EditProjectPage({ id, navigate }) {
  const { user } = useAuth();

  const [project] = useState({
    id: id || 'j1',
    title: 'Campus Lost & Found Portal',
    dept: 'Computer Science',
    batch: '2023–24',
    domain: 'Web Development',
    guideName: 'Prof. Arun Nair',
    tech: 'React, Node.js, MongoDB',
    features: 'Item reporting, keyword matching, email alerts',
    desc: 'Web portal where students report lost items and staff log found items.'
  });

  const [form, setForm] = useState(project);

  return (
    <div className="max-w-2xl mx-auto rounded-xl bg-white p-6 shadow-sm border border-slate-200">
      <h1 className="text-xl font-bold text-navy mb-4">Edit Project Record</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          alert('Project record updated successfully.');
          navigate('projects');
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Project Title</label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
          />
        </div>

        <div>
          {/* Faculty guide is displayed as read-only */}
          <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Faculty Guide (Read-Only)</label>
          <input
            type="text"
            value={user?.role === 'faculty' ? user.name : form.guideName}
            readOnly
            disabled
            className="w-full rounded-lg border border-slate-200 bg-slate-100 p-2.5 text-sm text-slate-600 cursor-not-allowed font-medium"
          />
          <span className="text-[11px] text-slate-500 mt-1 block">
            The assigned faculty guide cannot be changed during record updates.
          </span>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Technologies Used</label>
          <input
            type="text"
            value={form.tech}
            onChange={e => setForm({ ...form, tech: e.target.value })}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Key Features</label>
          <textarea
            value={form.features}
            onChange={e => setForm({ ...form, features: e.target.value })}
            rows="3"
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-3">
          <button
            type="button"
            onClick={() => navigate('projects')}
            className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-vio font-semibold text-white text-sm"
          >
            Save Record Changes
          </button>
        </div>
      </form>
    </div>
  );
}
