/**
 * backend/seed.ts
 *
 * Inserts 4 test users (one per role) into the `users` table.
 * Password hashing is done in-database via pgcrypto's crypt() / gen_salt(),
 * so no extra npm dependencies are required.
 *
 * Run with:  npx tsx seed.ts
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------------------
// Seed data — one user per role
// ---------------------------------------------------------------------------
const DUMMY_PASSWORD = 'Test@1234!';

const seedUsers = [
  {
    employee_id: 'EMP-001',
    full_name: 'Alice Requester',
    email: 'alice.requester@ptw.local',
    role: 'requester',
    department: 'Operations',
    phone: '+1-555-0101',
  },
  {
    employee_id: 'EMP-002',
    full_name: 'Bob Area-Owner',
    email: 'bob.areaowner@ptw.local',
    role: 'area_owner',
    department: 'Maintenance',
    phone: '+1-555-0102',
  },
  {
    employee_id: 'EMP-003',
    full_name: 'Carol Safety',
    email: 'carol.safety@ptw.local',
    role: 'safety_officer',
    department: 'HSE',
    phone: '+1-555-0103',
  },
  {
    employee_id: 'EMP-004',
    full_name: 'Dave Admin',
    email: 'dave.admin@ptw.local',
    role: 'admin',
    department: 'IT',
    phone: '+1-555-0104',
  },
] as const;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function seed(): Promise<void> {
  const client = await pool.connect();

  try {
    console.log('\n🌱  Starting database seed...\n');

    // Use a transaction so all inserts succeed or none do
    await client.query('BEGIN');

    const insertedUsers: Array<{ id: string; email: string; role: string }> = [];

    for (const user of seedUsers) {
      // ON CONFLICT DO NOTHING lets you re-run the script safely without errors
      const result = await client.query<{ id: string; email: string; role: string }>(
        `
        INSERT INTO users (
          employee_id,
          full_name,
          email,
          -- Hash the password in-database using pgcrypto's bcrypt (cost factor 12)
          password_hash,
          role,
          department,
          phone
        )
        VALUES (
          $1, $2, $3,
          crypt($4, gen_salt('bf', 12)),
          $5::user_role,
          $6, $7
        )
        ON CONFLICT (email) DO NOTHING
        RETURNING id, email, role
        `,
        [
          user.employee_id,
          user.full_name,
          user.email,
          DUMMY_PASSWORD,
          user.role,
          user.department,
          user.phone,
        ]
      );

      if (result.rowCount === 0) {
        console.warn(`  ⚠️  Skipped (already exists): ${user.email}`);
      } else {
        insertedUsers.push(result.rows[0]!);
      }
    }

    await client.query('COMMIT');

    // ---------------------------------------------------------------------------
    // Print a copy-paste-friendly summary table
    // ---------------------------------------------------------------------------
    console.log('✅  Seed complete! Generated user IDs:\n');
    console.log('  Role            │ ID (UUID)                            │ Email');
    console.log('  ────────────────┼──────────────────────────────────────┼─────────────────────────────');
    for (const u of insertedUsers) {
      console.log(`  ${u.role.padEnd(16)}│ ${u.id} │ ${u.email}`);
    }
    console.log('\n  Dummy password for all accounts:', DUMMY_PASSWORD);
    console.log('  (Use any UUID above as requester_id in your API test payloads)\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌  Seed failed — transaction rolled back:\n', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end(); // Close all pool connections so the process can exit cleanly
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
