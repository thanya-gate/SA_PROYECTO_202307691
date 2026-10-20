-- ============================================================================
-- Migracion: Cronjob de Notificacion de Repaso (base yousac_notificaciones)
-- Idempotente: registra la plantilla repaso_examen y los objetos que encolan
-- la notificacion de repaso sin duplicar envios.
-- ============================================================================

INSERT INTO plantilla_correo (nombre, asunto, cuerpo, tipo) VALUES
    ('repaso_examen',
     'Preparate para tu examen de {{curso}}',
     E'Hola {{nombre}},\n\n'
     'Se acerca tu {{tipo}} de {{curso}} ("{{unidad}}") el {{fecha_examen}}.\n'
     'Te sugerimos repasar con estas grabaciones mejor calificadas de la unidad:\n\n'
     '{{grabaciones}}\n\n'
     '¡Éxitos en tu preparación!\nEquipo YoUSAC',
     'REPASO')
ON CONFLICT (nombre) DO NOTHING;

CREATE OR REPLACE FUNCTION fn_repaso_ya_enviado(p_usuario_id UUID, p_evaluacion_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
AS $$
    SELECT EXISTS (
        SELECT 1 FROM notificacion
        WHERE usuario_id = p_usuario_id
          AND tipo = 'REPASO'
          AND datos_contexto ->> 'evaluacion_id' = p_evaluacion_id
          AND fecha_creacion >= NOW() - INTERVAL '20 hours'
    );
$$;

CREATE OR REPLACE PROCEDURE sp_encolar_notificacion_repaso(
    p_usuario_id UUID,
    p_correo_destino VARCHAR(320),
    p_curso VARCHAR(200),
    p_unidad VARCHAR(120),
    p_tipo VARCHAR(30),
    p_fecha_examen TEXT,
    p_nombre TEXT,
    p_grabaciones TEXT,
    p_evaluacion_id TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_plantilla_id UUID;
BEGIN
    IF fn_repaso_ya_enviado(p_usuario_id, p_evaluacion_id) THEN
        RETURN;
    END IF;

    SELECT id INTO v_plantilla_id FROM plantilla_correo WHERE nombre = 'repaso_examen';
    IF v_plantilla_id IS NULL THEN
        RAISE EXCEPTION 'PLANTILLA_NO_ENCONTRADA: falta la plantilla repaso_examen';
    END IF;

    INSERT INTO notificacion (usuario_id, correo_destino, plantilla_id, tipo, datos_contexto)
    VALUES (
        p_usuario_id,
        p_correo_destino,
        v_plantilla_id,
        'REPASO',
        jsonb_build_object(
            'curso', p_curso,
            'unidad', COALESCE(p_unidad, ''),
            'tipo', p_tipo,
            'fecha_examen', p_fecha_examen,
            'nombre', COALESCE(p_nombre, 'estudiante'),
            'grabaciones', p_grabaciones,
            'evaluacion_id', p_evaluacion_id
        )
    );
END;
$$;
