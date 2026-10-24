-- ============================================================================
-- Recomendación personalizada (filtrado colaborativo ítem-ítem).
-- Reemplaza fn_recomendaciones_estudiante, que antes ignoraba al estudiante.
--
-- puntaje = 60 % base de la comunidad (fn_calcular_porcentaje_recomendacion:
--           valoraciones + popularidad) + 40 % afinidad con estudiantes que
--           vieron las mismas clases. Las clases que el estudiante ya vio
--           bajan al 30 % para priorizar contenido nuevo.
-- Sin historial (arranque en frío) queda solo la base de la comunidad.
-- Idempotente: CREATE OR REPLACE con la misma firma.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_recomendaciones_estudiante(p_estudiante_id UUID, p_limite INT DEFAULT 10)
RETURNS TABLE (
    clase_id                 UUID,
    porcentaje_recomendacion NUMERIC(5,2),
    total_vistas             INT,
    promedio_calificacion    NUMERIC(3,2),
    fecha_calculo            TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_fecha TIMESTAMPTZ := NOW();
BEGIN
    RETURN QUERY
    WITH vistas_propias AS (
        SELECT DISTINCT ev.clase_id
        FROM evento_vista ev
        WHERE ev.estudiante_id = p_estudiante_id
    ),
    vecinos AS (
        -- Estudiantes con historial en común, pesados por cuántas clases comparten.
        SELECT ev.estudiante_id, COUNT(DISTINCT ev.clase_id) AS comunes
        FROM evento_vista ev
        JOIN vistas_propias vp ON vp.clase_id = ev.clase_id
        WHERE ev.estudiante_id <> p_estudiante_id
        GROUP BY ev.estudiante_id
    ),
    afinidad AS (
        SELECT ev.clase_id, SUM(v.comunes)::NUMERIC AS peso
        FROM evento_vista ev
        JOIN vecinos v ON v.estudiante_id = ev.estudiante_id
        GROUP BY ev.clase_id
    ),
    puntaje AS (
        SELECT
            cm.clase_id,
            fn_calcular_porcentaje_recomendacion(cm.id) AS base,
            COALESCE(a.peso / NULLIF(MAX(a.peso) OVER (), 0), 0) AS afin,
            (vp.clase_id IS NOT NULL) AS vista,
            cm.fecha_primera_ingesta
        FROM clase_metrica cm
        LEFT JOIN afinidad a ON a.clase_id = cm.clase_id
        LEFT JOIN vistas_propias vp ON vp.clase_id = cm.clase_id
    ),
    final AS (
        SELECT
            p.clase_id,
            ROUND(LEAST(100, GREATEST(0,
                CASE WHEN EXISTS (SELECT 1 FROM vistas_propias)
                     THEN p.base * 0.6 + p.afin * 40
                     ELSE p.base END
                * CASE WHEN p.vista THEN 0.3 ELSE 1 END
            )), 2)::NUMERIC(5,2) AS pct,
            p.fecha_primera_ingesta
        FROM puntaje p
    )
    SELECT
        f.clase_id,
        f.pct,
        COALESCE((SELECT COUNT(*) FROM evento_vista ev WHERE ev.clase_id = f.clase_id), 0)::INT,
        COALESCE(ca.promedio_calificacion, 0),
        v_fecha
    FROM final f
    LEFT JOIN calificacion_agregada ca ON ca.clase_id = f.clase_id
    ORDER BY f.pct DESC, f.fecha_primera_ingesta DESC
    LIMIT p_limite;
END;
$$;
