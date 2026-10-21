-- ============================================================================
-- Migracion: Cronjob de Agregacion de Tendencias (base yousac_analitica)
-- Idempotente: crea el procedimiento que recalcula el ranking de las ultimas
-- N horas en tendencia_semanal. El CronJob lo invoca antes de los picos.
-- ============================================================================

CREATE OR REPLACE PROCEDURE sp_recalcular_tendencias_diarias(
    INOUT p_clases_procesadas INT,
    p_horas INT DEFAULT 24,
    p_semana DATE DEFAULT CURRENT_DATE
)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM tendencia_semanal WHERE semana = p_semana;

    INSERT INTO tendencia_semanal (clase_id, semana, total_vistas)
    SELECT ev.clase_id, p_semana, COUNT(*)
    FROM evento_vista ev
    WHERE ev.fecha_evento >= NOW() - (p_horas || ' hours')::INTERVAL
    GROUP BY ev.clase_id;

    UPDATE tendencia_semanal ts SET ranking_posicion = r.pos
    FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY total_vistas DESC) AS pos
        FROM tendencia_semanal
        WHERE semana = p_semana
    ) r
    WHERE ts.id = r.id AND ts.semana = p_semana;

    SELECT COUNT(*) INTO p_clases_procesadas
    FROM tendencia_semanal WHERE semana = p_semana;
END;
$$;
