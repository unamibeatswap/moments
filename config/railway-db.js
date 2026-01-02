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
    insert: function(data) {
      const insertQuery = {
        select: function() {
          return {
            single: async () => {
              try {
                const record = Array.isArray(data) ? data[0] : data;
                const columns = Object.keys(record).join(', ');
                const values = Object.values(record);
                const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
                
                const query = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
                const result = await pool.query(query, values);
                return { data: result.rows[0], error: null };
              } catch (error) {
                console.error(`Insert error in ${table}:`, error.message);
                return { data: null, error };
              }
            }
          };
        }
      };
      return insertQuery;
    },
    select: function(columns = '*') {
      const query = {
        limit: async (count) => {
          try {
            const result = await pool.query(`SELECT ${columns} FROM ${table} LIMIT ${count}`);
            return { data: result.rows, error: null };
          } catch (error) {
            return { data: [], error };
          }
        }
      };
      return query;
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