CREATE EXTENSION IF NOT EXISTS pgcrypto;

--tablas
CREATE TABLE historial_reproduccion (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estudiante_id            UUID NOT NULL,   
    clase_id                 UUID NOT NULL,   
    fecha_ultima_visualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (estudiante_id, clase_id)
);

CREATE TABLE checkpoint (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    historial_id       UUID NOT NULL UNIQUE REFERENCES historial_reproduccion(id) ON DELETE CASCADE,
    segundo_actual     INT NOT NULL DEFAULT 0,
    duracion           INT NOT NULL DEFAULT 0,
    porcentaje_avance  NUMERIC(5,2) NOT NULL DEFAULT 0,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE calificacion (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    historial_id      UUID NOT NULL REFERENCES historial_reproduccion(id) ON DELETE CASCADE,
    puntuacion        INT NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
    comentario        TEXT,
    fecha_calificacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (historial_id)
);

CREATE INDEX idx_historial_estudiante ON historial_reproduccion (estudiante_id);
CREATE INDEX idx_checkpoint_historial ON checkpoint (historial_id);

--funciones
CREATE OR REPLACE FUNCTION fn_calcular_progreso(p_segundo_actual INT, p_duracion_total INT)
RETURNS NUMERIC(5,2)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_duracion_total <= 0 THEN
        RETURN 0;
    END IF;
    RETURN GREATEST(0, LEAST(100, ROUND((p_segundo_actual::NUMERIC * 100) / p_duracion_total, 2)));
END;
$$;

--procedimientos
CREATE OR REPLACE PROCEDURE sp_guardar_checkpoint(
    p_estudiante_id UUID,
    p_clase_id UUID,
    p_segundo_actual INT,
    p_duracion INT,
    INOUT p_historial_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO historial_reproduccion (estudiante_id, clase_id)
    VALUES (p_estudiante_id, p_clase_id)
    ON CONFLICT (estudiante_id, clase_id)
    DO UPDATE SET fecha_ultima_visualizacion = NOW()
    RETURNING id INTO p_historial_id;

    INSERT INTO checkpoint (historial_id, segundo_actual, duracion, porcentaje_avance)
    VALUES (p_historial_id, p_segundo_actual, p_duracion,
            fn_calcular_progreso(p_segundo_actual, p_duracion))
    ON CONFLICT (historial_id) DO UPDATE SET
        segundo_actual = EXCLUDED.segundo_actual,
        duracion = EXCLUDED.duracion,
        porcentaje_avance = EXCLUDED.porcentaje_avance,
        fecha_actualizacion = NOW();
END;
$$;

CREATE OR REPLACE PROCEDURE sp_registrar_calificacion(
    p_historial_id UUID,
    p_puntuacion INT,
    p_comentario TEXT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM historial_reproduccion WHERE id = p_historial_id) THEN
        RAISE EXCEPTION 'HISTORIAL_NO_ENCONTRADO: No existe historial para esta clase';
    END IF;

    IF p_puntuacion < 1 OR p_puntuacion > 5 THEN
        RAISE EXCEPTION 'PUNTUACION_INVALIDA: La puntuación debe estar entre 1 y 5';
    END IF;

    INSERT INTO calificacion (historial_id, puntuacion, comentario)
    VALUES (p_historial_id, p_puntuacion, p_comentario)
    ON CONFLICT (historial_id) DO UPDATE SET
        puntuacion = EXCLUDED.puntuacion,
        comentario = EXCLUDED.comentario,
        fecha_calificacion = NOW();
END;
$$;

--vistas
CREATE OR REPLACE VIEW vw_historial_reciente AS
SELECT
    h.estudiante_id,
    h.clase_id,
    h.fecha_ultima_visualizacion,
    COALESCE(cp.segundo_actual, 0) AS segundo_actual,
    COALESCE(cp.duracion, 0) AS duracion,
    COALESCE(cp.porcentaje_avance, 0) AS porcentaje_avance,
    (cp.id IS NOT NULL) AS tiene_checkpoint
FROM historial_reproduccion h
LEFT JOIN checkpoint cp ON cp.historial_id = h.id
ORDER BY h.fecha_ultima_visualizacion DESC;

--triggers
CREATE OR REPLACE FUNCTION fn_trg_actualizar_historial() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE historial_reproduccion
    SET fecha_ultima_visualizacion = NOW()
    WHERE id = NEW.historial_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_actualizar_historial ON checkpoint;
CREATE TRIGGER trg_actualizar_historial
    AFTER INSERT OR UPDATE ON checkpoint
    FOR EACH ROW EXECUTE FUNCTION fn_trg_actualizar_historial();

CREATE OR REPLACE FUNCTION fn_trg_validar_rango_puntuacion() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.puntuacion < 1 OR NEW.puntuacion > 5 THEN
        RAISE EXCEPTION 'PUNTUACION_INVALIDA: La puntuación debe estar entre 1 y 5';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_rango_puntuacion ON calificacion;
CREATE TRIGGER trg_validar_rango_puntuacion
    BEFORE INSERT OR UPDATE ON calificacion
    FOR EACH ROW EXECUTE FUNCTION fn_trg_validar_rango_puntuacion();
