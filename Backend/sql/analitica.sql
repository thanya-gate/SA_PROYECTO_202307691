CREATE EXTENSION IF NOT EXISTS pgcrypto;
--tablas
CREATE TABLE clase_metrica (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clase_id              UUID NOT NULL UNIQUE,   
    fecha_primera_ingesta TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE evento_vista (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clase_id       UUID NOT NULL,
    estudiante_id  UUID NOT NULL,     
    fecha_evento   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duracion_vista INT NOT NULL DEFAULT 0
);

CREATE TABLE sincronizacion_calificacion (
    id               SERIAL PRIMARY KEY,
    clase_id         UUID NOT NULL,
    estudiante_id    UUID NOT NULL,
    puntuacion       INT NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
    fecha_sincronizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (clase_id, estudiante_id)
);

CREATE TABLE calificacion_agregada (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clase_id               UUID NOT NULL UNIQUE,
    promedio_calificacion  NUMERIC(3,2) NOT NULL DEFAULT 0,
    total_calificaciones   INT NOT NULL DEFAULT 0,
    fecha_actualizacion    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tendencia_semanal (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clase_id         UUID NOT NULL,
    semana           DATE NOT NULL,       -- lunes de la semana calculada
    total_vistas     INT NOT NULL DEFAULT 0,
    ranking_posicion INT,
    fecha_calculo    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (clase_id, semana)
);

CREATE TABLE recomendacion (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clase_id                 UUID NOT NULL,
    estudiante_id            UUID NOT NULL,
    porcentaje_recomendacion NUMERIC(5,2) NOT NULL DEFAULT 0,
    fecha_calculo            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (clase_id, estudiante_id)
);

CREATE TABLE cache_invalidacion (
    id         SERIAL PRIMARY KEY,
    clave      VARCHAR(200) NOT NULL UNIQUE,
    invalidado BOOLEAN NOT NULL DEFAULT TRUE,
    fecha      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evento_vista_clase ON evento_vista (clase_id, fecha_evento);
CREATE INDEX idx_tendencia_semana ON tendencia_semanal (semana);

--funciones
CREATE OR REPLACE FUNCTION fn_calcular_porcentaje_recomendacion(p_clase_metrica_id UUID)
RETURNS NUMERIC(5,2)
LANGUAGE plpgsql
AS $$
DECLARE
    v_clase_id UUID;
    v_promedio NUMERIC(3,2);
    v_vistas   INT;
    v_resultado NUMERIC(5,2);
BEGIN
    SELECT clase_id INTO v_clase_id FROM clase_metrica WHERE id = p_clase_metrica_id;
    IF v_clase_id IS NULL THEN
        RETURN 0;
    END IF;

    SELECT COALESCE(promedio_calificacion, 0) INTO v_promedio
    FROM calificacion_agregada WHERE clase_id = v_clase_id;

    SELECT COALESCE(SUM(total_vistas), 0) INTO v_vistas
    FROM tendencia_semanal WHERE clase_id = v_clase_id;

    v_resultado := (COALESCE(v_promedio, 0) / 5 * 70) +
                   LEAST(30, LOG(2, GREATEST(v_vistas + 1)) * 5);
    RETURN GREATEST(0, LEAST(100, ROUND(v_resultado, 2)));
END;
$$;

CREATE OR REPLACE FUNCTION fn_recalcular_calificacion_agregada(p_clase_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_promedio NUMERIC(3,2);
    v_total INT;
BEGIN
    SELECT ROUND(AVG(puntuacion), 2)::NUMERIC(3,2), COUNT(*)
    INTO v_promedio, v_total
    FROM sincronizacion_calificacion
    WHERE clase_id = p_clase_id;

    INSERT INTO calificacion_agregada (clase_id, promedio_calificacion, total_calificaciones)
    VALUES (p_clase_id, COALESCE(v_promedio, 0), COALESCE(v_total, 0))
    ON CONFLICT (clase_id) DO UPDATE SET
        promedio_calificacion = COALESCE(v_promedio, 0),
        total_calificaciones = COALESCE(v_total, 0),
        fecha_actualizacion = NOW();
END;
$$;

--procedimientos

CREATE OR REPLACE PROCEDURE sp_registrar_evento_vista(
    p_clase_id UUID,
    p_estudiante_id UUID,
    p_duracion_vista INT DEFAULT 0
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO clase_metrica (clase_id)
    VALUES (p_clase_id)
    ON CONFLICT (clase_id) DO NOTHING;

    INSERT INTO evento_vista (clase_id, estudiante_id, duracion_vista)
    VALUES (p_clase_id, p_estudiante_id, p_duracion_vista);
END;
$$;


CREATE OR REPLACE PROCEDURE sp_sincronizar_calificacion(
    p_clase_id UUID,
    p_estudiante_id UUID,
    p_puntuacion INT
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO sincronizacion_calificacion (clase_id, estudiante_id, puntuacion)
    VALUES (p_clase_id, p_estudiante_id, p_puntuacion)
    ON CONFLICT (clase_id, estudiante_id) DO UPDATE SET
        puntuacion = EXCLUDED.puntuacion,
        fecha_sincronizacion = NOW();

    PERFORM fn_recalcular_calificacion_agregada(p_clase_id);
END;
$$;

CREATE OR REPLACE PROCEDURE sp_recalcular_tendencias(p_semana DATE)
LANGUAGE plpgsql
AS $$
BEGIN

    DELETE FROM tendencia_semanal WHERE semana = p_semana;

    INSERT INTO tendencia_semanal (clase_id, semana, total_vistas)
    SELECT ev.clase_id, p_semana, COUNT(*)
    FROM evento_vista ev
    WHERE ev.fecha_evento >= p_semana
      AND ev.fecha_evento < p_semana + INTERVAL '7 days'
    GROUP BY ev.clase_id;

    UPDATE tendencia_semanal ts SET ranking_posicion = r.pos
    FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY total_vistas DESC) AS pos
        FROM tendencia_semanal
        WHERE semana = p_semana
    ) r
    WHERE ts.id = r.id AND ts.semana = p_semana;
END;
$$;

--vistas
CREATE OR REPLACE VIEW vw_ranking_clases AS
SELECT
    ts.clase_id,
    SUM(ts.total_vistas) AS total_vistas,
    COALESCE(ca.promedio_calificacion, 0) AS promedio_calificacion,
    COALESCE(ca.total_calificaciones, 0) AS total_calificaciones,
    RANK() OVER (ORDER BY SUM(ts.total_vistas) DESC) AS posicion
FROM tendencia_semanal ts
LEFT JOIN calificacion_agregada ca ON ca.clase_id = ts.clase_id
GROUP BY ts.clase_id, ca.promedio_calificacion, ca.total_calificaciones;

CREATE OR REPLACE VIEW vw_tendencias_examenes AS
SELECT
    ts.clase_id,
    ts.semana,
    ts.total_vistas,
    ts.ranking_posicion
FROM tendencia_semanal ts
WHERE ts.semana >= (SELECT MAX(semana) FROM tendencia_semanal) - INTERVAL '3 weeks'
ORDER BY ts.total_vistas DESC
LIMIT 20;

--triggers
CREATE OR REPLACE FUNCTION fn_trg_actualizar_calificacion_agregada() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM fn_recalcular_calificacion_agregada(NEW.clase_id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_actualizar_calificacion_agregada ON sincronizacion_calificacion;
CREATE TRIGGER trg_actualizar_calificacion_agregada
    AFTER INSERT OR UPDATE ON sincronizacion_calificacion
    FOR EACH ROW EXECUTE FUNCTION fn_trg_actualizar_calificacion_agregada();

CREATE OR REPLACE FUNCTION fn_trg_invalidar_cache_ranking() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO cache_invalidacion (clave, invalidado)
    VALUES ('tendencias', TRUE)
    ON CONFLICT (clave) DO UPDATE SET invalidado = TRUE, fecha = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidar_cache_ranking ON tendencia_semanal;
CREATE TRIGGER trg_invalidar_cache_ranking
    AFTER INSERT OR UPDATE ON tendencia_semanal
    FOR EACH ROW EXECUTE FUNCTION fn_trg_invalidar_cache_ranking();
