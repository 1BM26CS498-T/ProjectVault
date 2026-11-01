import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';

export default function ProfilePage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [college, setCollege] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, college_id')
        .eq('id', user.id)
        .single();

      if (!active) return;

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      setFullName(data.full_name || '');
      setEmail(data.email || user.email || '');
      setRole(data.role || user.role || '');

      if (data.college_id) {
        const { data: collegeData, error: collegeError } = await supabase
          .from('colleges')
          .select('college_name')
          .eq('id', data.college_id)
          .maybeSingle();

        if (!active) return;

        if (collegeError) {
          setError('Profile loaded, but college information could not be loaded.');
        } else {
          setCollege(collegeData?.college_name || '');
        }
      } else {
        setCollege('');
      }

      setLoading(false);
    }

    loadProfile();
    return () => { active = false; };
  }, [user?.id, user?.email, user?.role]);

  async function saveProfile(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    const cleanName = fullName.trim();
    if (!cleanName) {
      setError('Please enter your full name.');
      return;
    }

    if (!user?.id) {
      setError('Please log in again to update your profile.');
      return;
    }

    setSaving(true);

    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: cleanName })
      .eq('id', user.id)
      .select('full_name')
      .single();

    setSaving(false);

    if (updateError) {
      setError(
        updateError.code === '42501'
          ? 'Permission denied. Your Supabase profiles table needs an update policy for the signed-in user.'
          : updateError.message
      );
      return;
    }

    setFullName(data.full_name);
    setMessage('Profile updated successfully.');
  }

  async function changePassword(event) {
    event.preventDefault();
    setPasswordMessage('');
    setPasswordError('');

    if (!user?.email) {
      setPasswordError('Please sign in again before changing your password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Your new password must contain at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError('Choose a password different from your current password.');
      return;
    }

    setPasswordBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        throw new Error('Your current password is incorrect.');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage('Password changed successfully.');
    } catch (err) {
      setPasswordError(err.message || 'Unable to change password.');
    } finally {
      setPasswordBusy(false);
    }
  }
  if (loading) {
    return <div className="rounded-xl border bg-white p-6">Loading your profile...</div>;
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
        <p className="mt-2 text-slate-600">
          View your account details and update your personal information.
        </p>
      </div>

      <form onSubmit={saveProfile} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="profile-name" className="mb-1 block text-sm font-medium text-slate-700">
            Full name
          </label>
          <input
            id="profile-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            maxLength={100}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
          />
        </div>

        <div>
          <label htmlFor="profile-email" className="mb-1 block text-sm font-medium text-slate-700">
            Email address
          </label>
          <input
            id="profile-email"
            value={email}
            readOnly
            className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600"
          />
          <p className="mt-1 text-xs text-slate-500">
            Email changes must be handled through Supabase Auth.
          </p>
        </div>

        <div>
          <label htmlFor="profile-role" className="mb-1 block text-sm font-medium text-slate-700">
            Role
          </label>
          <input
            id="profile-role"
            value={role}
            readOnly
            className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600"
          />
        </div>

        <div>
          <label htmlFor="profile-college" className="mb-1 block text-sm font-medium text-slate-700">
            College
          </label>
          <input
            id="profile-college"
            value={college || 'No college assigned'}
            readOnly
            className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600"
          />
        </div>

        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
      <form onSubmit={changePassword} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Change Password</h2>
          <p className="mt-1 text-sm text-slate-600">Enter your current password and choose a new one.</p>
        </div>
        <div>
          <label htmlFor="current-password" className="mb-1 block text-sm font-medium text-slate-700">Current password</label>
          <input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
        </div>
        <div>
          <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-slate-700">New password</label>
          <input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          <p className="mt-1 text-xs text-slate-500">Use at least 8 characters.</p>
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-slate-700">Confirm new password</label>
          <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
        </div>
        {passwordError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{passwordError}</p>}
        {passwordMessage && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{passwordMessage}</p>}
        <button type="submit" disabled={passwordBusy} className="rounded-lg bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
          {passwordBusy ? 'Changing password...' : 'Change Password'}
        </button>
      </form>
    </section>
  );
}

