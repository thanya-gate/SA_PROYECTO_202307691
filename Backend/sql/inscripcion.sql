CREATE EXTENSION IF NOT EXISTS pgcrypto;

--tablas
CREATE TABLE curso (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo      VARCHAR(20) NOT NULL UNIQUE,
    nombre      VARCHAR(200) NOT NULL,
    escuela     VARCHAR(100) NOT NULL,
    semestre    VARCHAR(10) NOT NULL,  
    año         INT NOT NULL
);

CREATE TABLE docente (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL
);

CREATE TABLE auxiliar (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL
);

CREATE TABLE asignacion_docente (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    docente_id       UUID NOT NULL REFERENCES docente(id) ON DELETE CASCADE,
    curso_id         UUID NOT NULL REFERENCES curso(id) ON DELETE CASCADE,
    semestre         VARCHAR(10) NOT NULL,
    fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (docente_id, curso_id, semestre)
);

CREATE TABLE asignacion_auxiliar (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auxiliar_id           UUID NOT NULL REFERENCES auxiliar(id) ON DELETE CASCADE,
    asignacion_docente_id UUID NOT NULL REFERENCES asignacion_docente(id) ON DELETE CASCADE,
    fecha_asignacion      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE asignacion_curso (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estudiante_id    UUID NOT NULL,     
    curso_id         UUID NOT NULL REFERENCES curso(id) ON DELETE CASCADE,
    semestre         VARCHAR(10) NOT NULL,
    estado_matricula VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE',
    fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (estudiante_id, curso_id, semestre)
);

CREATE TABLE auditoria_inscripcion (
    id              SERIAL PRIMARY KEY,
    estudiante_id   UUID,
    curso_id        UUID,
    estado_anterior VARCHAR(15),
    estado_nuevo    VARCHAR(15),
    fecha_evento    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_asignacion_curso_estudiante ON asignacion_curso (estudiante_id, semestre);
CREATE INDEX idx_asignacion_docente_curso ON asignacion_docente (curso_id, semestre);

--funciones
CREATE OR REPLACE FUNCTION fn_estado_matricula(p_estudiante_id UUID, p_curso_id UUID)
RETURNS VARCHAR(15)
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado VARCHAR(15);
BEGIN
    SELECT estado_matricula INTO v_estado
    FROM asignacion_curso
    WHERE estudiante_id = p_estudiante_id
      AND curso_id = p_curso_id
      AND semestre = (SELECT MAX(semestre) FROM asignacion_curso
                      WHERE estudiante_id = p_estudiante_id)
    ORDER BY fecha_asignacion DESC
    LIMIT 1;

    RETURN COALESCE(v_estado, 'SIN_MATRICULA');
END;
$$;

--procedimientos
CREATE OR REPLACE PROCEDURE sp_inscribir_estudiante(
    p_estudiante_id UUID,
    p_curso_id UUID,
    p_semestre VARCHAR(10),
    INOUT p_inscripcion_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM asignacion_curso
        WHERE estudiante_id = p_estudiante_id
          AND curso_id = p_curso_id
          AND semestre = p_semestre
    ) THEN
        RAISE EXCEPTION 'INSCRIPCION_DUPLICADA: Ya está inscrito en este curso';
    END IF;

    INSERT INTO asignacion_curso (estudiante_id, curso_id, semestre, estado_matricula)
    VALUES (p_estudiante_id, p_curso_id, p_semestre, 'PENDIENTE')
    RETURNING id INTO p_inscripcion_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_asignar_catedratico_curso(
    p_docente_id UUID,
    p_curso_id UUID,
    p_semestre VARCHAR(10),
    INOUT p_asignacion_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO asignacion_docente (docente_id, curso_id, semestre)
    VALUES (p_docente_id, p_curso_id, p_semestre)
    ON CONFLICT (docente_id, curso_id, semestre) DO NOTHING
    RETURNING id INTO p_asignacion_id;

    IF p_asignacion_id IS NULL THEN
        SELECT id INTO p_asignacion_id
        FROM asignacion_docente
        WHERE docente_id = p_docente_id AND curso_id = p_curso_id AND semestre = p_semestre;
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_asignar_auxiliar_catedratico(
    p_auxiliar_id UUID,
    p_asignacion_docente_id UUID,
    INOUT p_asignacion_auxiliar_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO asignacion_auxiliar (auxiliar_id, asignacion_docente_id)
    VALUES (p_auxiliar_id, p_asignacion_docente_id)
    RETURNING id INTO p_asignacion_auxiliar_id;
END;
$$;

--vistas
CREATE OR REPLACE VIEW vw_panel_estudiante AS
SELECT
    ac.estudiante_id,
    ac.curso_id,
    c.codigo,
    c.nombre AS curso,
    c.escuela,
    ac.semestre,
    c.año,
    ac.estado_matricula,
    d.usuario_id AS catedratico_usuario_id
FROM asignacion_curso ac
JOIN curso c ON c.id = ac.curso_id
LEFT JOIN asignacion_docente ad
       ON ad.curso_id = ac.curso_id AND ad.semestre = ac.semestre
LEFT JOIN docente d ON d.id = ad.docente_id;

CREATE OR REPLACE VIEW vw_cursos_por_catedratico AS
SELECT
    d.usuario_id AS catedratico_usuario_id,
    c.id AS curso_id,
    c.codigo,
    c.nombre AS curso,
    ad.semestre,
    c.año,
    COALESCE(array_agg(a.usuario_id ORDER BY a.usuario_id) FILTER (WHERE a.id IS NOT NULL), '{}') AS auxiliares
FROM asignacion_docente ad
JOIN docente d ON d.id = ad.docente_id
JOIN curso c ON c.id = ad.curso_id
LEFT JOIN asignacion_auxiliar aa ON aa.asignacion_docente_id = ad.id
LEFT JOIN auxiliar a ON a.id = aa.auxiliar_id
GROUP BY d.usuario_id, c.id, c.codigo, c.nombre, ad.semestre, c.año;

--triggers
CREATE OR REPLACE FUNCTION fn_trg_auditoria_inscripcion() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.estado_matricula IS DISTINCT FROM OLD.estado_matricula THEN
        INSERT INTO auditoria_inscripcion (estudiante_id, curso_id, estado_anterior, estado_nuevo)
        VALUES (NEW.estudiante_id, NEW.curso_id, OLD.estado_matricula, NEW.estado_matricula);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auditoria_inscripcion ON asignacion_curso;
CREATE TRIGGER trg_auditoria_inscripcion
    AFTER UPDATE OF estado_matricula ON asignacion_curso
    FOR EACH ROW EXECUTE FUNCTION fn_trg_auditoria_inscripcion();


CREATE OR REPLACE FUNCTION fn_trg_validar_auxiliar_unico() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_docente_id UUID;
BEGIN
    SELECT ad.docente_id INTO v_docente_id
    FROM asignacion_docente ad
    WHERE ad.id = NEW.asignacion_docente_id;

    IF EXISTS (
        SELECT 1
        FROM asignacion_auxiliar aa
        JOIN asignacion_docente ad ON ad.id = aa.asignacion_docente_id
        WHERE aa.auxiliar_id = NEW.auxiliar_id
          AND ad.docente_id = v_docente_id
          AND aa.id <> NEW.id
    ) THEN
        RAISE EXCEPTION 'AUXILIAR_DUPLICADO: El auxiliar ya apoya a este catedrático';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_auxiliar_unico_catedratico ON asignacion_auxiliar;
CREATE TRIGGER trg_validar_auxiliar_unico_catedratico
    BEFORE INSERT ON asignacion_auxiliar
    FOR EACH ROW EXECUTE FUNCTION fn_trg_validar_auxiliar_unico();
