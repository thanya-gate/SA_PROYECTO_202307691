-- ============================================================================
-- Migracion: Cronjob de Notificacion de Repaso (base yousac_inscripcion)
-- Idempotente: crea el calendario de evaluaciones y la vista que cruza
-- estudiantes matriculados con evaluaciones futuras.
-- ============================================================================

CREATE TABLE IF NOT EXISTS evaluacion (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curso_id    UUID NOT NULL REFERENCES curso(id) ON DELETE CASCADE,
    titulo      VARCHAR(200) NOT NULL,
    unidad      VARCHAR(120),
    fecha       TIMESTAMPTZ NOT NULL,
    tipo        VARCHAR(30) NOT NULL DEFAULT 'PARCIAL',
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evaluacion_fecha ON evaluacion (fecha);
CREATE INDEX IF NOT EXISTS idx_evaluacion_curso ON evaluacion (curso_id);

CREATE OR REPLACE VIEW vw_evaluaciones_proximas AS
SELECT
    e.id            AS evaluacion_id,
    e.curso_id,
    c.codigo        AS curso_codigo,
    c.nombre        AS curso_nombre,
    c.escuela,
    e.titulo,
    e.unidad,
    e.fecha         AS fecha_examen,
    e.tipo,
    ac.estudiante_id,
    ac.semestre,
    (e.fecha - NOW()) AS tiempo_restante
FROM evaluacion e
JOIN curso c ON c.id = e.curso_id
JOIN asignacion_curso ac ON ac.curso_id = e.curso_id
WHERE e.fecha >= NOW()
  AND ac.estado_matricula = 'MATRICULADO';
