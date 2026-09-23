import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';
import { createPermitsRouter } from './routes/permits.js';

// Load environment variables from the .env file
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Set up the PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Mount API routes
app.use('/api/permits', createPermitsRouter(pool));

app.get('/', (req, res) => {
    res.send('PTW Backend API is running!');
});

// A simple test route
app.get('/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            status: 'Success!',
            message: 'Connected to Supabase PostgreSQL',
            serverTime: result.rows[0].now
        });
    } catch (error) {
        console.error('Database connection error:', error);
        res.status(500).json({ error: 'Failed to connect to the database' });
    }
});

const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on http://0.0.0.0:${PORT} (accessible on all interfaces)`);
});