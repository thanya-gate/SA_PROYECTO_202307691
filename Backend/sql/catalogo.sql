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
    semestre         VARCHAR(10) NOT NULL,   
    año              INT NOT NULL,
    url_video        TEXT NOT NULL,
    url_material     TEXT,
    duracion         INT NOT NULL DEFAULT 0, 
    fecha_publicacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE participante_clase (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clase_id          UUID NOT NULL REFERENCES clase_grabada(id) ON DELETE CASCADE,
    nombre_participante VARCHAR(200) NOT NULL,
    rol_participante  VARCHAR(30) NOT NULL,  
    UNIQUE (clase_id, nombre_participante, rol_participante)
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
CREATE INDEX idx_participante_clase ON participante_clase (clase_id);

--funciones
-- Vista base para búsqueda con paginación evita duplicados.
CREATE OR REPLACE VIEW vw_clases_busqueda AS
SELECT DISTINCT
    cg.id AS clase_id,
    cc.codigo,
    cc.nombre AS curso,
    cc.escuela,
    cg.unidad,
    cg.tema,
    cg.semestre,
    cg.año,
    cg.url_video
FROM clase_grabada cg
JOIN curso_catalogo cc ON cc.id = cg.curso_id
LEFT JOIN participante_clase pc ON pc.clase_id = cg.id
LEFT JOIN clase_etiqueta ce ON ce.clase_id = cg.id
LEFT JOIN etiqueta et ON et.id = ce.etiqueta_id;


-- Funcion para buscar clasesusando la paginacion usando un subquery para contar el total de clases filtradas
CREATE OR REPLACE FUNCTION fn_buscar_clases(
    p_semestre VARCHAR(10) DEFAULT NULL,
    p_escuela VARCHAR(100) DEFAULT NULL,
    p_curso TEXT DEFAULT NULL,
    p_catedratico TEXT DEFAULT NULL,
    p_tema TEXT DEFAULT NULL,
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 10
)
RETURNS TABLE(
    clase_id UUID,
    codigo VARCHAR(20),
    curso VARCHAR(200),
    unidad VARCHAR(200),
    tema VARCHAR(200),
    semestre VARCHAR(10),
    año INT,
    url_video TEXT,
    total BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_page      INT := GREATEST(COALESCE(p_page, 1), 1);
    v_page_size INT := LEAST(GREATEST(COALESCE(p_page_size, 10), 1), 10);
BEGIN
    RETURN QUERY
    WITH filtradas AS (
        SELECT DISTINCT
            v.clase_id,
            v.codigo,
            v.curso,
            v.unidad,
            v.tema,
            v.semestre,
            v.año,
            v.url_video
        FROM vw_clases_busqueda v
        WHERE (p_semestre IS NULL OR v.semestre = p_semestre)
          AND (p_escuela IS NULL OR v.escuela ILIKE '%' || p_escuela || '%')
          AND (p_curso IS NULL OR v.curso ILIKE '%' || p_curso || '%' OR v.codigo ILIKE '%' || p_curso || '%')
          AND (p_catedratico IS NULL OR EXISTS (
              SELECT 1 FROM participante_clase pc
              WHERE pc.clase_id = v.clase_id
                AND pc.nombre_participante ILIKE '%' || p_catedratico || '%'
          ))
          AND (p_tema IS NULL OR EXISTS (
              SELECT 1 FROM clase_etiqueta ce
              JOIN etiqueta et ON et.id = ce.etiqueta_id
              WHERE ce.clase_id = v.clase_id
                AND (et.nombre ILIKE '%' || p_tema || '%' OR v.tema ILIKE '%' || p_tema || '%')
          ))
    )
    SELECT
        f.clase_id,
        f.codigo,
        f.curso,
        f.unidad,
        f.tema,
        f.semestre,
        f.año,
        f.url_video,
        (SELECT count(*) FROM filtradas) AS total
    FROM filtradas f
    ORDER BY f.año DESC, f.semestre, f.curso
    LIMIT v_page_size OFFSET (v_page - 1) * v_page_size;
END;
$$;

-- Consigue el total de clases que cumplen los filtros independientemente de la pagina y se usa cunado la pagina
-- solicitada esta vacia
CREATE OR REPLACE FUNCTION fn_contar_clases(
    p_semestre VARCHAR(10) DEFAULT NULL,
    p_escuela VARCHAR(100) DEFAULT NULL,
    p_curso TEXT DEFAULT NULL,
    p_catedratico TEXT DEFAULT NULL,
    p_tema TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_total BIGINT;
BEGIN
    SELECT count(DISTINCT v.clase_id) INTO v_total
    FROM vw_clases_busqueda v
    WHERE (p_semestre IS NULL OR v.semestre = p_semestre)
      AND (p_escuela IS NULL OR v.escuela ILIKE '%' || p_escuela || '%')
      AND (p_curso IS NULL OR v.curso ILIKE '%' || p_curso || '%' OR v.codigo ILIKE '%' || p_curso || '%')
      AND (p_catedratico IS NULL OR EXISTS (
          SELECT 1 FROM participante_clase pc
          WHERE pc.clase_id = v.clase_id
            AND pc.nombre_participante ILIKE '%' || p_catedratico || '%'
      ))
      AND (p_tema IS NULL OR EXISTS (
          SELECT 1 FROM clase_etiqueta ce
          JOIN etiqueta et ON et.id = ce.etiqueta_id
          WHERE ce.clase_id = v.clase_id
            AND (et.nombre ILIKE '%' || p_tema || '%' OR v.tema ILIKE '%' || p_tema || '%')
      ));
    RETURN v_total;
END;
$$;
-- procedimientos
CREATE OR REPLACE FUNCTION fn_validar_semestre(p_semestre VARCHAR(10))
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN p_semestre IS NOT NULL AND p_semestre ~ '^\d{4}-[12]$';
END;
$$;

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
DECLARE
    v_semestre_valido BOOLEAN;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM curso_catalogo WHERE id = p_curso_id) THEN
        RAISE EXCEPTION 'CURSO_NO_ENCONTRADO: El curso no existe en el catálogo';
    END IF;

    IF p_url_video IS NULL OR length(trim(p_url_video)) = 0 THEN
        p_url_video := '';
    END IF;

    IF p_duracion IS NULL OR p_duracion < 0 THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: duracion no puede ser negativa';
    END IF;

    SELECT fn_validar_semestre(p_semestre) INTO v_semestre_valido;
    IF NOT v_semestre_valido THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: semestre inválido (formato AAAA-1 o AAAA-2)';
    END IF;

    -- Mantiene actualizado el registro admin de semestres.
    PERFORM fn_registrar_semestre(p_semestre, p_año);

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

-- Asocia los participantesa la clase publicada.
CREATE OR REPLACE PROCEDURE sp_asociar_participantes(
    p_clase_id UUID,
    p_nombres TEXT[],
    p_roles TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 1..array_length(p_nombres, 1) LOOP
        IF upper(trim(p_roles[i])) NOT IN ('CATEDRATICO', 'AUXILIAR') THEN
            RAISE EXCEPTION 'ENTRADA_INVALIDA: rol participante inválido (%)', p_roles[i];
        END IF;

        INSERT INTO participante_clase (clase_id, nombre_participante, rol_participante)
        VALUES (p_clase_id, trim(p_nombres[i]), upper(trim(p_roles[i])))
        ON CONFLICT (clase_id, nombre_participante, rol_participante) DO NOTHING;
    END LOOP;
END;
$$;

-- Registra un curso en el catálogo (código único).
CREATE OR REPLACE PROCEDURE sp_registrar_curso_catalogo(
    p_codigo VARCHAR(20),
    p_nombre VARCHAR(200),
    p_escuela VARCHAR(100),
    INOUT p_curso_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_codigo IS NULL OR length(trim(p_codigo)) = 0 THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: codigo es obligatorio';
    END IF;
    IF p_nombre IS NULL OR length(trim(p_nombre)) = 0 THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: nombre es obligatorio';
    END IF;
    IF p_escuela IS NULL OR length(trim(p_escuela)) = 0 THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: escuela es obligatoria';
    END IF;

    -- Mantiene actualizado el registro admin de escuelas/áreas.
    PERFORM fn_registrar_escuela(p_escuela);

    INSERT INTO curso_catalogo (codigo, nombre, escuela)
    VALUES (trim(p_codigo), trim(p_nombre), trim(p_escuela))
    RETURNING id INTO p_curso_id;
END;
$$;

--vistas
CREATE OR REPLACE VIEW vw_ficha_tecnica_clase AS
SELECT
    cg.id AS clase_id,
    cg.curso_id,
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
GROUP BY cg.id, cg.curso_id, cc.codigo, cc.nombre, cc.escuela, cg.unidad, cg.tema,
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

-- =====================================================================
-- Fase 1 Práctica 3: Registros de Semestres y Escuelas/Áreas
-- Tablas + funciones idempotentes + SPs CRUD para el panel admin.
-- =====================================================================

CREATE TABLE escuela (
    id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE semestre (
    id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(10) NOT NULL UNIQUE,
    año    INT NOT NULL
);

-- Asegura (idempotente) que la escuela exista en el registro admin.
CREATE OR REPLACE FUNCTION fn_registrar_escuela(p_nombre VARCHAR(100))
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
BEGIN
    IF p_nombre IS NULL OR length(trim(p_nombre)) = 0 THEN
        RETURN NULL;
    END IF;

    INSERT INTO escuela (nombre)
    VALUES (trim(p_nombre))
    ON CONFLICT (nombre) DO NOTHING;

    SELECT id INTO v_id FROM escuela WHERE nombre = trim(p_nombre);
    RETURN v_id;
END;
$$;

-- Asegura (idempotente) que el semestre exista en el registro admin.
CREATE OR REPLACE FUNCTION fn_registrar_semestre(p_nombre VARCHAR(10), p_año INT)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
BEGIN
    IF NOT fn_validar_semestre(p_nombre) THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: semestre inválido (formato AAAA-1 o AAAA-2)';
    END IF;

    INSERT INTO semestre (nombre, año)
    VALUES (trim(p_nombre), p_año)
    ON CONFLICT (nombre) DO NOTHING;

    SELECT id INTO v_id FROM semestre WHERE nombre = trim(p_nombre);
    RETURN v_id;
END;
$$;

-- CRUD escuelas/áreas
CREATE OR REPLACE PROCEDURE sp_registrar_escuela(
    p_nombre VARCHAR(100),
    INOUT p_escuela_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_nombre IS NULL OR length(trim(p_nombre)) = 0 THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: nombre de escuela es obligatorio';
    END IF;

    SELECT fn_registrar_escuela(p_nombre) INTO p_escuela_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_actualizar_escuela(
    p_escuela_id UUID,
    p_nombre VARCHAR(100),
    INOUT p_actualizado BOOLEAN DEFAULT FALSE
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_nombre IS NULL OR length(trim(p_nombre)) = 0 THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: nombre de escuela es obligatorio';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM escuela WHERE id = p_escuela_id) THEN
        RAISE EXCEPTION 'ESCUELA_NO_ENCONTRADA: la escuela no existe';
    END IF;

    UPDATE escuela SET nombre = trim(p_nombre) WHERE id = p_escuela_id;
    p_actualizado := TRUE;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_eliminar_escuela(
    p_escuela_id UUID,
    INOUT p_eliminado BOOLEAN DEFAULT FALSE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_nombre VARCHAR(100);
BEGIN
    SELECT nombre INTO v_nombre FROM escuela WHERE id = p_escuela_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ESCUELA_NO_ENCONTRADA: la escuela no existe';
    END IF;

    IF EXISTS (SELECT 1 FROM curso_catalogo WHERE escuela = v_nombre) THEN
        RAISE EXCEPTION 'ESCUELA_EN_USO: no se puede eliminar una escuela con cursos asociados';
    END IF;

    DELETE FROM escuela WHERE id = p_escuela_id;
    p_eliminado := TRUE;
END;
$$;

-- CRUD semestres
CREATE OR REPLACE PROCEDURE sp_registrar_semestre(
    p_nombre VARCHAR(10),
    p_año INT,
    INOUT p_semestre_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_nombre IS NULL OR p_año IS NULL THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: nombre y año del semestre son obligatorios';
    END IF;

    SELECT fn_registrar_semestre(p_nombre, p_año) INTO p_semestre_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_actualizar_semestre(
    p_semestre_id UUID,
    p_nombre VARCHAR(10),
    p_año INT,
    INOUT p_actualizado BOOLEAN DEFAULT FALSE
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_nombre IS NULL OR p_año IS NULL THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: nombre y año del semestre son obligatorios';
    END IF;

    IF NOT fn_validar_semestre(p_nombre) THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: semestre inválido (formato AAAA-1 o AAAA-2)';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM semestre WHERE id = p_semestre_id) THEN
        RAISE EXCEPTION 'SEMESTRE_NO_ENCONTRADO: el semestre no existe';
    END IF;

    UPDATE semestre SET nombre = trim(p_nombre), año = p_año WHERE id = p_semestre_id;
    p_actualizado := TRUE;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_eliminar_semestre(
    p_semestre_id UUID,
    INOUT p_eliminado BOOLEAN DEFAULT FALSE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_nombre VARCHAR(10);
BEGIN
    SELECT nombre INTO v_nombre FROM semestre WHERE id = p_semestre_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SEMESTRE_NO_ENCONTRADO: el semestre no existe';
    END IF;

    IF EXISTS (SELECT 1 FROM clase_grabada WHERE semestre = v_nombre) THEN
        RAISE EXCEPTION 'SEMESTRE_EN_USO: no se puede eliminar un semestre con clases asociadas';
    END IF;

    DELETE FROM semestre WHERE id = p_semestre_id;
    p_eliminado := TRUE;
END;
$$;

-- Actualiza un curso del catálogo (código único, validando reuso).
CREATE OR REPLACE PROCEDURE sp_actualizar_curso_catalogo(
    p_curso_id UUID,
    p_codigo VARCHAR(20),
    p_nombre VARCHAR(200),
    p_escuela VARCHAR(100),
    INOUT p_actualizado BOOLEAN DEFAULT FALSE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_codigo_actual VARCHAR(20);
BEGIN
    IF p_codigo IS NULL OR length(trim(p_codigo)) = 0 THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: codigo es obligatorio';
    END IF;
    IF p_nombre IS NULL OR length(trim(p_nombre)) = 0 THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: nombre es obligatorio';
    END IF;
    IF p_escuela IS NULL OR length(trim(p_escuela)) = 0 THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: escuela es obligatoria';
    END IF;

    SELECT codigo INTO v_codigo_actual FROM curso_catalogo WHERE id = p_curso_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'CURSO_NO_ENCONTRADO: el curso no existe en el catálogo';
    END IF;

    IF trim(p_codigo) <> v_codigo_actual AND EXISTS (
        SELECT 1 FROM curso_catalogo WHERE codigo = trim(p_codigo) AND id <> p_curso_id
    ) THEN
        RAISE EXCEPTION 'CURSO_CODIGO_DUPLICADO: el código ya pertenece a otro curso';
    END IF;

    PERFORM fn_registrar_escuela(p_escuela);

    UPDATE curso_catalogo SET codigo = trim(p_codigo), nombre = trim(p_nombre), escuela = trim(p_escuela)
    WHERE id = p_curso_id;
    p_actualizado := TRUE;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_eliminar_curso_catalogo(
    p_curso_id UUID,
    INOUT p_eliminado BOOLEAN DEFAULT FALSE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_codigo VARCHAR(20);
BEGIN
    SELECT codigo INTO v_codigo FROM curso_catalogo WHERE id = p_curso_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'CURSO_NO_ENCONTRADO: el curso no existe en el catálogo';
    END IF;

    IF EXISTS (SELECT 1 FROM clase_grabada WHERE curso_id = p_curso_id) THEN
        RAISE EXCEPTION 'CURSO_EN_USO: no se puede eliminar un curso con clases asociadas';
    END IF;

    DELETE FROM curso_catalogo WHERE id = p_curso_id;
    p_eliminado := TRUE;
END;
$$;

-- =====================================================================
-- CRUD completo de clases (Práctica 4): editar y eliminar una clase.
-- sp_actualizar_clase actualiza los datos de la clase; la re-asociación de
-- etiquetas y participantes se hace en el repositorio dentro de la misma
-- transacción (se borran las asociaciones previas y se insertan las nuevas).
-- Las asociaciones (participante_clase, clase_etiqueta y el evento de
-- publicación) se eliminan en cascada al borrar la clase.
-- =====================================================================
CREATE OR REPLACE PROCEDURE sp_actualizar_clase(
    p_clase_id UUID,
    p_curso_id UUID,
    p_unidad VARCHAR(200),
    p_tema VARCHAR(200),
    p_fecha_imparticion DATE,
    p_semestre VARCHAR(10),
    p_año INT,
    p_duracion INT,
    p_url_video TEXT,
    p_url_material TEXT,
    INOUT p_actualizado BOOLEAN DEFAULT FALSE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_semestre_valido BOOLEAN;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM clase_grabada WHERE id = p_clase_id) THEN
        RAISE EXCEPTION 'CLASE_NO_ENCONTRADA: la clase no existe';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM curso_catalogo WHERE id = p_curso_id) THEN
        RAISE EXCEPTION 'CURSO_NO_ENCONTRADO: el curso no existe en el catálogo';
    END IF;

    IF p_duracion IS NULL OR p_duracion < 0 THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: duracion no puede ser negativa';
    END IF;

    SELECT fn_validar_semestre(p_semestre) INTO v_semestre_valido;
    IF NOT v_semestre_valido THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: semestre inválido (formato AAAA-1 o AAAA-2)';
    END IF;

    IF p_url_video IS NULL OR length(trim(p_url_video)) = 0 THEN
        p_url_video := '';
    END IF;

    -- Mantiene actualizado el registro admin de semestres.
    PERFORM fn_registrar_semestre(p_semestre, p_año);

    UPDATE clase_grabada SET
        curso_id         = p_curso_id,
        unidad           = p_unidad,
        tema             = p_tema,
        fecha_imparticion = p_fecha_imparticion,
        semestre         = p_semestre,
        año              = p_año,
        duracion         = p_duracion,
        url_video        = p_url_video,
        url_material     = p_url_material
    WHERE id = p_clase_id;
    p_actualizado := TRUE;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_eliminar_clase(
    p_clase_id UUID,
    INOUT p_eliminado BOOLEAN DEFAULT FALSE
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM clase_grabada WHERE id = p_clase_id) THEN
        RAISE EXCEPTION 'CLASE_NO_ENCONTRADA: la clase no existe';
    END IF;

    DELETE FROM clase_grabada WHERE id = p_clase_id;
    p_eliminado := TRUE;
END;
$$;

-- Vistas para el panel admin (con conteo de uso)
CREATE OR REPLACE VIEW vw_escuelas AS
SELECT e.id, e.nombre, COUNT(cc.id) AS cursos
FROM escuela e
LEFT JOIN curso_catalogo cc ON cc.escuela = e.nombre
GROUP BY e.id, e.nombre
ORDER BY e.nombre;

CREATE OR REPLACE VIEW vw_semestres AS
SELECT s.id, s.nombre, s.año, COUNT(cg.id) AS clases
FROM semestre s
LEFT JOIN clase_grabada cg ON cg.semestre = s.nombre
GROUP BY s.id, s.nombre, s.año
ORDER BY s.año DESC, s.nombre;

--ingesta masiva de datos
CREATE OR REPLACE PROCEDURE sp_cargar_clases_csv(
    p_clases JSONB,
    INOUT p_registradas INT DEFAULT 0,
    INOUT p_omitidas INT DEFAULT 0
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_clase    RECORD;
    v_curso_id UUID;
    v_clase_id UUID;
    v_nombres  TEXT[] := '{}';
    v_roles    TEXT[] := '{}';
BEGIN
    IF p_clases IS NULL OR p_clases = '[]'::jsonb THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: no hay filas que procesar';
    END IF;

    p_registradas := 0;
    p_omitidas := 0;

    FOR v_clase IN
        SELECT *
        FROM jsonb_to_recordset(p_clases) AS x(
            codigo_curso      TEXT,
            nombre_curso      TEXT,
            escuela           TEXT,
            unidad            TEXT,
            tema              TEXT,
            fecha_imparticion TEXT,
            semestre          TEXT,
            año               INT,
            url_video         TEXT,
            url_material      TEXT,
            duracion          INT,
            etiquetas         TEXT[],
            docentes          TEXT[],
            auxiliares        TEXT[]
        )
    LOOP
        BEGIN
-- validaciones básicas de campos obligatorios y longitudes.
        IF v_clase.codigo_curso IS NULL OR length(trim(v_clase.codigo_curso)) NOT BETWEEN 1 AND 20
           OR v_clase.semestre IS NULL OR length(trim(v_clase.semestre)) NOT BETWEEN 1 AND 10
           OR v_clase.año IS NULL
           OR v_clase.url_video IS NULL OR length(trim(v_clase.url_video)) = 0 THEN
            p_omitidas := p_omitidas + 1;
            CONTINUE;
        END IF;

        IF NOT fn_validar_semestre(v_clase.semestre) THEN
            p_omitidas := p_omitidas + 1;
            CONTINUE;
        END IF;

-- registra el curso en el catálogo si no existe de lo contrario, obtiene su ID.
        IF NOT EXISTS (SELECT 1 FROM curso_catalogo WHERE codigo = trim(v_clase.codigo_curso)) THEN
            IF v_clase.nombre_curso IS NULL OR length(trim(v_clase.nombre_curso)) NOT BETWEEN 1 AND 200
               OR v_clase.escuela IS NULL OR length(trim(v_clase.escuela)) NOT BETWEEN 1 AND 100 THEN
                p_omitidas := p_omitidas + 1;
                CONTINUE;
            END IF;

            CALL sp_registrar_curso_catalogo(
                trim(v_clase.codigo_curso),
                trim(v_clase.nombre_curso),
                trim(v_clase.escuela),
                v_curso_id
            );
        ELSE
            SELECT id INTO v_curso_id
            FROM curso_catalogo
            WHERE codigo = trim(v_clase.codigo_curso);
        END IF;

        -- Para evitar duplicados y omite las filas
        IF EXISTS (
            SELECT 1 FROM clase_grabada cg
            WHERE cg.curso_id = v_curso_id
              AND cg.semestre = trim(v_clase.semestre)
              AND cg.url_video = trim(v_clase.url_video)
        ) THEN
            p_omitidas := p_omitidas + 1;
            CONTINUE;
        END IF;

        PERFORM fn_registrar_semestre(trim(v_clase.semestre), v_clase.año);
        PERFORM fn_registrar_escuela(trim(v_clase.escuela));

        CALL sp_publicar_clase(
            v_curso_id,
            v_clase.unidad,
            v_clase.tema,
            v_clase.fecha_imparticion::DATE,
            trim(v_clase.semestre),
            v_clase.año,
            trim(v_clase.url_video),
            v_clase.url_material,
            COALESCE(v_clase.duracion, 0),
            v_clase_id
        );

        -- Etiquetas.
        IF v_clase.etiquetas IS NOT NULL AND cardinality(v_clase.etiquetas) > 0 THEN
            CALL sp_asociar_etiquetas(v_clase_id, v_clase.etiquetas);
        END IF;

        -- Participantes 
        v_nombres := '{}';
        v_roles := '{}';
        IF v_clase.docentes IS NOT NULL AND cardinality(v_clase.docentes) > 0 THEN
            v_nombres := v_nombres || v_clase.docentes;
            v_roles := v_roles || (SELECT array_agg('CATEDRATICO'::text) FROM unnest(v_clase.docentes));
        END IF;
        IF v_clase.auxiliares IS NOT NULL AND cardinality(v_clase.auxiliares) > 0 THEN
            v_nombres := v_nombres || v_clase.auxiliares;
            v_roles := v_roles || (SELECT array_agg('AUXILIAR'::text) FROM unnest(v_clase.auxiliares));
        END IF;
        IF cardinality(v_nombres) > 0 THEN
            CALL sp_asociar_participantes(v_clase_id, v_nombres, v_roles);
        END IF;

        p_registradas := p_registradas + 1;
        EXCEPTION
            WHEN OTHERS THEN
                -- omisiones
                p_omitidas := p_omitidas + 1;
        END;
    END LOOP;
END;
$$;
-- Para el repositorio de materail adjunto
CREATE TABLE material (
    id              UUID PRIMARY KEY,
    clase_id        UUID NOT NULL REFERENCES clase_grabada(id) ON DELETE CASCADE,
    nombre_archivo  VARCHAR(255) NOT NULL,
    mime_type       VARCHAR(100) NOT NULL,
    extension       VARCHAR(10) NOT NULL,
    tamano_bytes    BIGINT NOT NULL DEFAULT 0 CHECK (tamano_bytes >= 0),
    version_actual  INT NOT NULL DEFAULT 1 CHECK (version_actual >= 1),
    total_descargas BIGINT NOT NULL DEFAULT 0,
    subido_por      UUID,
    fecha_subida    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE material_version (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id         UUID NOT NULL REFERENCES material(id) ON DELETE CASCADE,
    numero_version      INT NOT NULL CHECK (numero_version >= 1),
    url_almacenamiento  TEXT NOT NULL,
    tamano_bytes        BIGINT NOT NULL DEFAULT 0 CHECK (tamano_bytes >= 0),
    fecha_publicacion   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (material_id, numero_version)
);

CREATE INDEX idx_material_clase ON material (clase_id);
CREATE INDEX idx_material_version_material ON material_version (material_id);

-- Ficha de cada material junto a su versión actual.
CREATE OR REPLACE VIEW vw_materiales_clase AS
SELECT
    m.id               AS material_id,
    m.clase_id,
    m.nombre_archivo,
    m.mime_type,
    m.extension,
    m.tamano_bytes,
    m.version_actual,
    m.total_descargas,
    m.subido_por,
    m.fecha_subida,
    mv.url_almacenamiento AS url_archivo
FROM material m
LEFT JOIN material_version mv
    ON mv.material_id = m.id AND mv.numero_version = m.version_actual;

-- Registra un nuevo material inicializando su version
CREATE OR REPLACE PROCEDURE sp_registrar_material(
    p_clase_id           UUID,
    p_nombre_archivo     VARCHAR,
    p_mime_type          VARCHAR,
    p_extension          VARCHAR,
    p_tamano_bytes       BIGINT,
    p_url_almacenamiento TEXT,
    INOUT p_material_id  UUID DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID := COALESCE(p_material_id, gen_random_uuid());
BEGIN
    IF trim(p_nombre_archivo) IS NULL OR length(trim(p_nombre_archivo)) NOT BETWEEN 1 AND 255 THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: el nombre del archivo es obligatorio (max 255)';
    END IF;

    IF trim(p_mime_type) IS NULL OR length(trim(p_mime_type)) NOT BETWEEN 1 AND 100 THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: el tipo MIME es obligatorio';
    END IF;

    IF trim(p_extension) IS NULL OR length(trim(p_extension)) NOT BETWEEN 1 AND 10 THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: la extensión es obligatoria';
    END IF;

    IF p_tamano_bytes < 0 THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: el tamaño no puede ser negativo';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM clase_grabada WHERE id = p_clase_id) THEN
        RAISE EXCEPTION 'CLASE_NO_ENCONTRADA: la clase % no existe', p_clase_id;
    END IF;

    INSERT INTO material (id, clase_id, nombre_archivo, mime_type, extension, tamano_bytes, version_actual, subido_por)
    VALUES (v_id, p_clase_id, trim(p_nombre_archivo), trim(p_mime_type), trim(p_extension), p_tamano_bytes, 1, NULL);

    INSERT INTO material_version (material_id, numero_version, url_almacenamiento, tamano_bytes)
    VALUES (v_id, 1, p_url_almacenamiento, p_tamano_bytes);

    p_material_id := v_id;
END;
$$;

-- Publica una nueva versión de un material existente
CREATE OR REPLACE PROCEDURE sp_agregar_version_material(
    p_material_id         UUID,
    p_tamano_bytes        BIGINT,
    p_url_almacenamiento  TEXT,
    INOUT p_numero_version INT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_nueva_version INT;
BEGIN
    IF p_tamano_bytes < 0 THEN
        RAISE EXCEPTION 'ENTRADA_INVALIDA: el tamaño no puede ser negativo';
    END IF;

    UPDATE material
    SET version_actual  = version_actual + 1,
        tamano_bytes    = p_tamano_bytes,
        fecha_subida    = NOW()
    WHERE id = p_material_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'MATERIAL_NO_ENCONTRADO: el material % no existe', p_material_id;
    END IF;

    SELECT version_actual INTO v_nueva_version
    FROM material WHERE id = p_material_id;

    INSERT INTO material_version (material_id, numero_version, url_almacenamiento, tamano_bytes)
    VALUES (p_material_id, v_nueva_version, p_url_almacenamiento, p_tamano_bytes);

    p_numero_version := v_nueva_version;
END;
$$;

-- Elimina un material (las versiones se borran en cascada). Devuelve el
-- clase_id para que el gateway pueda limpiar los archivos físicos.
CREATE OR REPLACE PROCEDURE sp_eliminar_material(
    p_material_id     UUID,
    INOUT p_eliminado BOOLEAN DEFAULT NULL,
    INOUT p_clase_id  UUID DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    SELECT clase_id INTO p_clase_id FROM material WHERE id = p_material_id;
    IF p_clase_id IS NULL THEN
        p_eliminado := FALSE;
        RETURN;
    END IF;

    DELETE FROM material WHERE id = p_material_id;
    p_eliminado := TRUE;
END;
$$;

-- Registra las descargas de material para las metricas de uso. Devuelve el total de descargas acumuladas.
CREATE OR REPLACE PROCEDURE sp_registrar_descarga_material(
    p_material_id          UUID,
    INOUT p_total_descargas BIGINT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE material
    SET total_descargas = total_descargas + 1
    WHERE id = p_material_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'MATERIAL_NO_ENCONTRADO: el material % no existe', p_material_id;
    END IF;

    SELECT total_descargas INTO p_total_descargas
    FROM material WHERE id = p_material_id;
END;
$$;
