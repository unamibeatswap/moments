-- COMPLETE ANALYTICS FIX
-- Fixes empty analytics + adds marketing templates + unifies all interfaces

-- 0. Add missing columns to broadcasts table
ALTER TABLE broadcasts 
ADD COLUMN IF NOT EXISTS template_name TEXT,
ADD COLUMN IF NOT EXISTS template_category TEXT CHECK (template_category IN ('UTILITY', 'MARKETING', 'AUTHENTICATION'));

CREATE INDEX IF NOT EXISTS idx_broadcasts_template_name ON broadcasts(template_name);
CREATE INDEX IF NOT EXISTS idx_broadcasts_template_category ON broadcasts(template_category);

-- 1. Create unified analytics view (single source of truth)
CREATE OR REPLACE VIEW unified_analytics AS
SELECT 
  (SELECT COUNT(*) FROM moments WHERE status = 'broadcasted') as total_moments,
    (SELECT COUNT(*) FROM subscriptions WHERE opted_in = true) as active_subscribers,
      (SELECT COUNT(*) FROM broadcasts WHERE status IN ('delivered', 'sent')) as total_broadcasts,
        (SELECT COUNT(*) FROM broadcasts WHERE created_at >= CURRENT_DATE) as broadcasts_today,
          (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'delivered') / NULLIF(COUNT(*), 0), 1) 
             FROM broadcasts WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as delivery_rate_7d,
               (SELECT COUNT(*) FROM moments WHERE sponsor_id IS NOT NULL AND status = 'broadcasted') as sponsored_moments,
                 (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE template_name LIKE '%_v2') / NULLIF(COUNT(*), 0), 1)
                    FROM broadcasts WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as template_v2_adoption,
                      (SELECT AVG(compliance_score) FROM marketing_compliance WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as avg_compliance_score,
                        CURRENT_TIMESTAMP as last_updated;

                        -- 2. Fix refresh_analytics function
                        CREATE OR REPLACE FUNCTION refresh_analytics()
                        RETURNS void AS $$
                        BEGIN
                          -- Use unified analytics
                            INSERT INTO daily_stats (
                                stat_date, 
                                    total_moments, 
                                        total_comments, 
                                            total_subscribers, 
                                                active_subscribers, 
                                                    total_broadcasts,
                                                        broadcast_success_rate
                                                          )
                                                            SELECT 
                                                                CURRENT_DATE,
                                                                    total_moments,
                                                                        0,
                                                                            (SELECT COUNT(*) FROM subscriptions),
                                                                                active_subscribers,
                                                                                    total_broadcasts,
                                                                                        COALESCE(delivery_rate_7d, 0)
                                                                                          FROM unified_analytics
                                                                                            ON CONFLICT (stat_date) DO UPDATE SET
                                                                                                total_moments = EXCLUDED.total_moments,
                                                                                                    total_subscribers = EXCLUDED.total_subscribers,
                                                                                                        active_subscribers = EXCLUDED.active_subscribers,
                                                                                                            total_broadcasts = EXCLUDED.total_broadcasts,
                                                                                                                broadcast_success_rate = EXCLUDED.broadcast_success_rate;

                                                                                                                  -- Regional stats
                                                                                                                    DELETE FROM regional_stats;
                                                                                                                      INSERT INTO regional_stats (region, moment_count, comment_count, subscriber_count)
                                                                                                                        SELECT 
                                                                                                                            COALESCE(m.region, 'Unknown'),
                                                                                                                                COUNT(DISTINCT m.id),
                                                                                                                                    0,
                                                                                                                                        0
                                                                                                                                          FROM moments m
                                                                                                                                            WHERE m.status = 'broadcasted'
                                                                                                                                              GROUP BY m.region;

                                                                                                                                                -- Category stats
                                                                                                                                                  DELETE FROM category_stats;
                                                                                                                                                    INSERT INTO category_stats (category, moment_count, comment_count, avg_engagement)
                                                                                                                                                      SELECT 
                                                                                                                                                          COALESCE(m.category, 'General'),
                                                                                                                                                              COUNT(DISTINCT m.id),
                                                                                                                                                                  0,
                                                                                                                                                                      0
                                                                                                                                                                        FROM moments m
                                                                                                                                                                          WHERE m.status = 'broadcasted'
                                                                                                                                                                            GROUP BY m.category;
                                                                                                                                                                            END;
                                                                                                                                                                            $$ LANGUAGE plpgsql;

                                                                                                                                                                            -- 3. Marketing template analytics
                                                                                                                                                                            CREATE OR REPLACE VIEW template_analytics AS
                                                                                                                                                                            SELECT 
                                                                                                                                                                              DATE(b.created_at) as broadcast_date,
                                                                                                                                                                                b.template_name,
                                                                                                                                                                                  b.template_category,
                                                                                                                                                                                    COUNT(*) as total_sent,
                                                                                                                                                                                      COUNT(*) FILTER (WHERE b.status = 'delivered') as delivered,
                                                                                                                                                                                        COUNT(*) FILTER (WHERE b.status = 'failed') as failed,
                                                                                                                                                                                          ROUND(100.0 * COUNT(*) FILTER (WHERE b.status = 'delivered') / NULLIF(COUNT(*), 0), 1) as delivery_rate,
                                                                                                                                                                                            COUNT(DISTINCT b.moment_id) as unique_moments,
                                                                                                                                                                                              COUNT(*) FILTER (WHERE m.sponsor_id IS NOT NULL) as sponsored_count,
                                                                                                                                                                                                AVG(mc.compliance_score) as avg_compliance_score
                                                                                                                                                                                                FROM broadcasts b
                                                                                                                                                                                                LEFT JOIN moments m ON b.moment_id = m.id
                                                                                                                                                                                                LEFT JOIN marketing_compliance mc ON b.id = mc.broadcast_id
                                                                                                                                                                                                WHERE b.created_at >= CURRENT_DATE - INTERVAL '30 days'
                                                                                                                                                                                                GROUP BY DATE(b.created_at), b.template_name, b.template_category
                                                                                                                                                                                                ORDER BY broadcast_date DESC, total_sent DESC;

                                                                                                                                                                                                -- 4. Template adoption metrics
                                                                                                                                                                                                CREATE OR REPLACE VIEW template_adoption AS
                                                                                                                                                                                                SELECT 
                                                                                                                                                                                                  COUNT(*) FILTER (WHERE template_name LIKE '%_v2') as v2_templates,
                                                                                                                                                                                                    COUNT(*) FILTER (WHERE template_name NOT LIKE '%_v2') as v1_templates,
                                                                                                                                                                                                      ROUND(100.0 * COUNT(*) FILTER (WHERE template_name LIKE '%_v2') / NULLIF(COUNT(*), 0), 1) as adoption_rate,
                                                                                                                                                                                                        COUNT(*) FILTER (WHERE template_category = 'MARKETING') as marketing_templates,
                                                                                                                                                                                                          COUNT(*) FILTER (WHERE template_category != 'MARKETING' OR template_category IS NULL) as utility_templates
                                                                                                                                                                                                          FROM broadcasts
                                                                                                                                                                                                          WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

                                                                                                                                                                                                          -- 5. Grant access
                                                                                                                                                                                                          GRANT SELECT ON unified_analytics TO anon, authenticated;
                                                                                                                                                                                                          GRANT SELECT ON template_analytics TO anon, authenticated;
                                                                                                                                                                                                          GRANT SELECT ON template_adoption TO anon, authenticated;

                                                                                                                                                                                                          -- 6. Initialize with current data
                                                                                                                                                                                                          SELECT refresh_analytics();
                                                                                                                                                                                                          