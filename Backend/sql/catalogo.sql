CREATE EXTENSION IF NOT EXISTS pgcrypto;

--tablas
CREATE TABLE etiqueta (
    id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE
);


CREATE TABLE curso_catalogo (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo  VARCHAR(20) NOT NULL UNIQUE,
    nombre  VARCHAR(200) NOT NULL,
    escuela VARCHAR(100) NOT NULL
);

CREATE TABLE clase_grabada (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curso_id         UUID NOT NULL REFERENCES curso_catalogo(id) ON DELETE CASCADE,
    unidad           VARCHAR(200),
    tema             VARCHAR(200),
    fecha_imparticion DATE,
    semestre         VARCHAR(10) NOT NULL,   -- p.ej. '2026-1'
    año              INT NOT NULL,
    url_video        TEXT NOT NULL,
    url_material     TEXT,
    duracion         INT NOT NULL DEFAULT 0, -- segundos
    fecha_publicacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE participante_clase (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clase_id          UUID NOT NULL REFERENCES clase_grabada(id) ON DELETE CASCADE,
    nombre_participante VARCHAR(200) NOT NULL,
    rol_participante  VARCHAR(30) NOT NULL   -- CATEDRATICO | AUXILIAR
);

CREATE TABLE clase_etiqueta (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clase_id   UUID NOT NULL REFERENCES clase_grabada(id) ON DELETE CASCADE,
    etiqueta_id UUID NOT NULL REFERENCES etiqueta(id) ON DELETE CASCADE,
    UNIQUE (clase_id, etiqueta_id)
);


CREATE TABLE evento_publicacion_pendiente (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clase_id   UUID NOT NULL REFERENCES clase_grabada(id) ON DELETE CASCADE,
    procesado  BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_evento TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clase_busqueda ON clase_grabada (semestre, año, curso_id);
CREATE INDEX idx_clase_etiqueta ON clase_etiqueta (etiqueta_id);

--funciones
CREATE OR REPLACE FUNCTION fn_buscar_clases(
    p_semestre VARCHAR(10) DEFAULT NULL,
    p_escuela VARCHAR(100) DEFAULT NULL,
    p_curso TEXT DEFAULT NULL,
    p_catedratico TEXT DEFAULT NULL,
    p_tema TEXT DEFAULT NULL
)
RETURNS TABLE(
    clase_id UUID,
    codigo VARCHAR(20),
    curso VARCHAR(200),
    unidad VARCHAR(200),
    tema VARCHAR(200),
    semestre VARCHAR(10),
    año INT,
    url_video TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        cg.id,
        cc.codigo,
        cc.nombre,
        cg.unidad,
        cg.tema,
        cg.semestre,
        cg.año,
        cg.url_video
    FROM clase_grabada cg
    JOIN curso_catalogo cc ON cc.id = cg.curso_id
    LEFT JOIN participante_clase pc ON pc.clase_id = cg.id
    LEFT JOIN clase_etiqueta ce ON ce.clase_id = cg.id
    LEFT JOIN etiqueta et ON et.id = ce.etiqueta_id
    WHERE (p_semestre IS NULL OR cg.semestre = p_semestre)
      AND (p_escuela IS NULL OR cc.escuela = p_escuela)
      AND (p_curso IS NULL OR cc.nombre ILIKE '%' || p_curso || '%' OR cc.codigo ILIKE '%' || p_curso || '%')
      AND (p_catedratico IS NULL OR pc.nombre_participante ILIKE '%' || p_catedratico || '%')
      AND (p_tema IS NULL OR et.nombre ILIKE '%' || p_tema || '%' OR cg.tema ILIKE '%' || p_tema || '%')
    ORDER BY cg.semestre, cg.año DESC;
END;
$$;
-- procedommientos
CREATE OR REPLACE PROCEDURE sp_publicar_clase(
    p_curso_id UUID,
    p_unidad VARCHAR(200),
    p_tema VARCHAR(200),
    p_fecha_imparticion DATE,
    p_semestre VARCHAR(10),
    p_año INT,
    p_url_video TEXT,
    p_url_material TEXT,
    p_duracion INT,
    INOUT p_clase_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO clase_grabada (
        curso_id, unidad, tema, fecha_imparticion, semestre, año,
        url_video, url_material, duracion
    )
    VALUES (
        p_curso_id, p_unidad, p_tema, p_fecha_imparticion, p_semestre, p_año,
        p_url_video, p_url_material, p_duracion
    )
    RETURNING id INTO p_clase_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_asociar_etiquetas(
    p_clase_id UUID,
    p_etiquetas TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_etiqueta_id UUID;
    v_nombre TEXT;
BEGIN
    FOREACH v_nombre IN ARRAY p_etiquetas
    LOOP
        INSERT INTO etiqueta (nombre)
        VALUES (trim(lower(v_nombre)))
        ON CONFLICT (nombre) DO NOTHING;

        SELECT id INTO v_etiqueta_id FROM etiqueta WHERE nombre = trim(lower(v_nombre));

        INSERT INTO clase_etiqueta (clase_id, etiqueta_id)
        VALUES (p_clase_id, v_etiqueta_id)
        ON CONFLICT (clase_id, etiqueta_id) DO NOTHING;
    END LOOP;
END;
$$;

--vistas
CREATE OR REPLACE VIEW vw_ficha_tecnica_clase AS
SELECT
    cg.id AS clase_id,
    cc.codigo,
    cc.nombre AS curso,
    cc.escuela,
    cg.unidad,
    cg.tema,
    cg.fecha_imparticion,
    cg.semestre,
    cg.año,
    cg.duracion,
    cg.url_video,
    cg.url_material,
    cg.fecha_publicacion,
    COALESCE(
        array_agg(DISTINCT pc.nombre_participante || ' (' || pc.rol_participante || ')')
            FILTER (WHERE pc.id IS NOT NULL), '{}'
    ) AS participantes,
    COALESCE(array_agg(DISTINCT et.nombre) FILTER (WHERE et.id IS NOT NULL), '{}') AS etiquetas
FROM clase_grabada cg
JOIN curso_catalogo cc ON cc.id = cg.curso_id
LEFT JOIN participante_clase pc ON pc.clase_id = cg.id
LEFT JOIN clase_etiqueta ce ON ce.clase_id = cg.id
LEFT JOIN etiqueta et ON et.id = ce.etiqueta_id
GROUP BY cg.id, cc.codigo, cc.nombre, cc.escuela, cg.unidad, cg.tema,
         cg.fecha_imparticion, cg.semestre, cg.año, cg.duracion,
         cg.url_video, cg.url_material, cg.fecha_publicacion;

CREATE OR REPLACE VIEW vw_catalogo_por_semestre AS
SELECT
    cg.semestre,
    cg.año,
    cc.escuela,
    COUNT(*) AS total_clases
FROM clase_grabada cg
JOIN curso_catalogo cc ON cc.id = cg.curso_id
GROUP BY cg.semestre, cg.año, cc.escuela
ORDER BY cg.año DESC, cg.semestre;

--triggers
CREATE OR REPLACE FUNCTION fn_trg_evento_clase_publicada() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO evento_publicacion_pendiente (clase_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evento_clase_publicada ON clase_grabada;
CREATE TRIGGER trg_evento_clase_publicada
    AFTER INSERT ON clase_grabada
    FOR EACH ROW EXECUTE FUNCTION fn_trg_evento_clase_publicada();
