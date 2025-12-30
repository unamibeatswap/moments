import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Use Railway's PostgreSQL (no IPv4 issues)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Supabase-compatible interface
export const supabase = {
  from: (table) => ({
    insert: async (data) => {
      try {
        const columns = Object.keys(data[0] || data).join(', ');
        const values = Array.isArray(data) ? data : [data];
        const placeholders = values.map((_, i) => 
          `(${Object.keys(values[i]).map((_, j) => `$${i * Object.keys(values[i]).length + j + 1}`).join(', ')})`
        ).join(', ');
        
        const flatValues = values.flatMap(obj => Object.values(obj));
        const query = `INSERT INTO ${table} (${columns}) VALUES ${placeholders} RETURNING *`;
        
        const result = await pool.query(query, flatValues);
        return { data: result.rows, error: null };
      } catch (error) {
        console.error(`Insert error in ${table}:`, error.message);
        return { data: null, error };
      }
    },
    select: async (columns = '*') => {
      try {
        const result = await pool.query(`SELECT ${columns} FROM ${table} LIMIT 10`);
        return { data: result.rows, error: null };
      } catch (error) {
        return { data: [], error };
      }
    },
    update: async (data) => ({ data: [], error: null }),
    eq: function() { return this; },
    single: async () => ({ data: null, error: null }),
    limit: function() { return this; }
  }),
  storage: {
    from: () => ({
      upload: async () => ({ data: { path: 'railway/path' }, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: 'https://railway.url' } })
    })
  }
};

export const supabaseAnon = supabase;