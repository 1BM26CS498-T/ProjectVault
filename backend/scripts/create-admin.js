import { pool } from '../db.js';

const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const fullName = String(process.env.ADMIN_NAME || '').trim();
const collegeId = Number(process.env.ADMIN_COLLEGE_ID);
let client;
let transactionOpen = false;

try {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('Set ADMIN_EMAIL to a valid email address.');
  }
  if (fullName.length < 2 || fullName.length > 120) {
    throw new Error('Set ADMIN_NAME to a name between 2 and 120 characters.');
  }
  if (!Number.isSafeInteger(collegeId) || collegeId < 1) {
    throw new Error('Set ADMIN_COLLEGE_ID to an existing college id.');
  }

  client = await pool.connect();
  await client.query('BEGIN');
  transactionOpen = true;
  await client.query('SELECT pg_advisory_xact_lock($1)', [98177431]);

  const college = await client.query('SELECT 1 FROM colleges WHERE id = $1', [collegeId]);
  if (!college.rowCount) throw new Error('ADMIN_COLLEGE_ID does not match an existing college.');

  const { rows: adminRows } = await client.query("SELECT COUNT(*)::int AS count FROM profiles WHERE role = 'admin'");
  const { rows: profileRows } = await client.query(
    `SELECT id, role, auth_user_id, email_verified_at, status
       FROM profiles
      WHERE LOWER(email) = $1
      FOR UPDATE`,
    [email],
  );
  const profile = profileRows[0];
  if (!profile) {
    throw new Error('Create and verify this Neon Auth account through ProjectVault before promoting it to admin.');
  }
  if (profile.role === 'admin' && profile.auth_user_id && profile.email_verified_at && profile.status === 'Active') {
    await client.query('COMMIT');
    transactionOpen = false;
    console.log(`Verified ProjectVault administrator already exists for ${email} (${profile.id}).`);
  } else if (Number(adminRows[0].count) === 0 && profile.role === 'student'
    && profile.auth_user_id && profile.email_verified_at && profile.status === 'Active') {
    const { rows } = await client.query(
      `UPDATE profiles
          SET role = 'admin', full_name = $1, college_id = $2
        WHERE id = $3 AND role = 'student' AND auth_user_id IS NOT NULL
          AND email_verified_at IS NOT NULL AND status = 'Active'
        RETURNING id`,
      [fullName, collegeId, profile.id],
    );
    if (!rows[0]) throw new Error('The account changed during promotion. No admin role was assigned.');
    await client.query('COMMIT');
    transactionOpen = false;
    console.log(`Promoted verified Neon Auth account ${email} (${rows[0].id}) to administrator.`);
  } else {
    throw new Error(Number(adminRows[0].count)
      ? 'An administrator already exists. The first-admin setup will not promote another account.'
      : 'Only an active, verified ProjectVault student account can initialize the first administrator.');
  }
} catch (error) {
  if (transactionOpen) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(`Admin provisioning rollback failed: ${rollbackError.message}`);
    }
  }
  console.error(`Admin provisioning failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
