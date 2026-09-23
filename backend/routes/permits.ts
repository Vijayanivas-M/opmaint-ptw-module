import { Router, type Request, type Response } from 'express';
import type { Pool, PoolClient } from 'pg';

// ---------------------------------------------------------------------------
// TypeScript Interfaces
// ---------------------------------------------------------------------------

/** Fields common to every permit type — maps to the `permits` table. */
interface PermitBaseBody {
  requester_id: string;           // UUID — must exist in users table
  area_owner_id?: string;         // UUID (optional)
  safety_officer_id?: string;     // UUID (optional)
  work_description: string;
  location: string;
  equipment_tag?: string;
  planned_start: string;          // ISO 8601 timestamp string
  planned_end: string;            // ISO 8601 timestamp string
}

/** Hot-work-specific fields — maps to the `permit_hot_work` table. */
interface HotWorkBody {
  hot_work_type: string;
  fire_watch_required?: boolean;
  fire_watch_name?: string;
  fire_extinguisher_type?: string;
  fire_blanket_used?: boolean;
  flammable_gas_cleared?: boolean;
  gas_test_reading_ppm?: number;
  gas_tested_by?: string;         // UUID
  gas_tested_at?: string;         // ISO 8601 timestamp string
  additional_controls?: unknown[]; // JSON array
}

/** Full request body for POST /api/permits/hot-work */
interface CreateHotWorkPermitBody extends PermitBaseBody, HotWorkBody {}

// ---------------------------------------------------------------------------
// Factory: returns a configured router that closes over the shared pool
// ---------------------------------------------------------------------------
export function createPermitsRouter(pool: Pool): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // POST /api/permits/hot-work
  // Creates a base permit row + a hot-work extension row in a single transaction.
  // Rolls back both inserts automatically if either fails.
  // -------------------------------------------------------------------------
  router.post('/hot-work', async (req: Request<object, object, CreateHotWorkPermitBody>, res: Response) => {
    // --- Destructure & validate required fields ---
    const {
      requester_id,
      area_owner_id,
      safety_officer_id,
      work_description,
      location,
      equipment_tag,
      planned_start,
      planned_end,

      hot_work_type,
      fire_watch_required = false,
      fire_watch_name,
      fire_extinguisher_type,
      fire_blanket_used = false,
      flammable_gas_cleared = false,
      gas_test_reading_ppm,
      gas_tested_by,
      gas_tested_at,
      additional_controls = [],
    } = req.body;

    if (!requester_id || !work_description || !location || !planned_start || !planned_end || !hot_work_type) {
      res.status(400).json({
        error: 'Missing required fields: requester_id, work_description, location, planned_start, planned_end, hot_work_type',
      });
      return;
    }

    // Acquire a dedicated client so we can manage the transaction manually
    const client: PoolClient = await pool.connect();

    try {
      await client.query('BEGIN');

      // --- 1. Insert the base permit row ---
      const permitInsertSQL = `
        INSERT INTO permits (
          permit_type,
          requester_id,
          area_owner_id,
          safety_officer_id,
          work_description,
          location,
          equipment_tag,
          planned_start,
          planned_end
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const permitValues = [
        'hot_work',
        requester_id,
        area_owner_id ?? null,
        safety_officer_id ?? null,
        work_description,
        location,
        equipment_tag ?? null,
        planned_start,
        planned_end,
      ];

      const permitResult = await client.query<{ id: string }>(permitInsertSQL, permitValues);
      const newPermitId = permitResult.rows[0]!.id;

      // --- 2. Insert the hot-work extension row ---
      const hotWorkInsertSQL = `
        INSERT INTO permit_hot_work (
          permit_id,
          hot_work_type,
          fire_watch_required,
          fire_watch_name,
          fire_extinguisher_type,
          fire_blanket_used,
          flammable_gas_cleared,
          gas_test_reading_ppm,
          gas_tested_by,
          gas_tested_at,
          additional_controls
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      const hotWorkValues = [
        newPermitId,
        hot_work_type,
        fire_watch_required,
        fire_watch_name ?? null,
        fire_extinguisher_type ?? null,
        fire_blanket_used,
        flammable_gas_cleared,
        gas_test_reading_ppm ?? null,
        gas_tested_by ?? null,
        gas_tested_at ?? null,
        JSON.stringify(additional_controls),
      ];

      const hotWorkResult = await client.query(hotWorkInsertSQL, hotWorkValues);

      await client.query('COMMIT');

      // Return the merged object (base permit + hot-work extension)
      res.status(201).json({
        message: 'Hot work permit created successfully.',
        permit: {
          ...permitResult.rows[0],
          ...hotWorkResult.rows[0],
        },
      });
    } catch (error) {
      // Guaranteed rollback — no partial data is ever written
      await client.query('ROLLBACK');
      console.error('[POST /api/permits/hot-work] Transaction rolled back:', error);
      res.status(500).json({ error: 'Failed to create hot work permit. Transaction rolled back.' });
    } finally {
      // Always release the client back to the pool
      client.release();
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/permits
  // Returns all permits LEFT JOINed with their hot-work extension data.
  // (NULL extension columns indicate a non-hot-work permit type.)
  // -------------------------------------------------------------------------
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const sql = `
        SELECT
          -- Base permit columns
          p.id,
          p.permit_number,
          p.permit_type,
          p.status,
          p.requester_id,
          p.area_owner_id,
          p.safety_officer_id,
          p.work_description,
          p.location,
          p.equipment_tag,
          p.planned_start,
          p.planned_end,
          p.actual_start,
          p.actual_end,
          p.submitted_at,
          p.area_approved_at,
          p.safety_approved_at,
          p.rejected_by,
          p.rejected_at,
          p.rejection_reason,
          p.created_at,
          p.updated_at,

          -- Hot-work extension columns (NULL for other permit types)
          hw.hot_work_type,
          hw.fire_watch_required,
          hw.fire_watch_name,
          hw.fire_extinguisher_type,
          hw.fire_blanket_used,
          hw.flammable_gas_cleared,
          hw.gas_test_reading_ppm,
          hw.gas_tested_by,
          hw.gas_tested_at,
          hw.additional_controls

        FROM permits p
        LEFT JOIN permit_hot_work hw ON p.id = hw.permit_id
        ORDER BY p.created_at DESC
      `;

      const result = await pool.query(sql);
      res.status(200).json({ permits: result.rows });
    } catch (error) {
      console.error('[GET /api/permits] Query failed:', error);
      res.status(500).json({ error: 'Failed to fetch permits.' });
    }
  });

  return router;
}
