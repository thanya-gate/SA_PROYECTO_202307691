-- ============================================================================
-- Migracion: Cronjob de Purga y Seguridad (base yousac_auth)
-- Idempotente: crea la blacklist de JWT, el archivo de auditoria y los SP/fn
-- que consume el CronJob yousac-purge-security. No altera datos existentes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS token_revocado (
    jti            TEXT PRIMARY KEY,
    usuario_id     UUID REFERENCES usuario(id) ON DELETE CASCADE,
    motivo         VARCHAR(30) NOT NULL DEFAULT 'REVOCADO',
    fecha_revocado TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_expiracion TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_token_revocado_expiracion ON token_revocado (fecha_expiracion);

CREATE TABLE IF NOT EXISTS auditoria_archivo (
    id             BIGSERIAL PRIMARY KEY,
    usuario_id     UUID,
    tipo_cambio    VARCHAR(50) NOT NULL,
    valor_anterior TEXT,
    valor_nuevo    TEXT,
    ejecutado_por  UUID,
    fecha_evento   TIMESTAMPTZ NOT NULL,
    fecha_archivado TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_archivo_fecha ON auditoria_archivo (fecha_evento);

CREATE OR REPLACE PROCEDURE sp_revocar_token(
    p_jti TEXT,
    p_usuario_id UUID,
    p_fecha_expiracion TIMESTAMPTZ,
    p_motivo VARCHAR(30) DEFAULT 'REVOCADO'
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO token_revocado (jti, usuario_id, motivo, fecha_expiracion)
    VALUES (p_jti, p_usuario_id, p_motivo, p_fecha_expiracion)
    ON CONFLICT (jti) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION fn_token_esta_revocado(p_jti TEXT)
RETURNS BOOLEAN
LANGUAGE sql
AS $$
    SELECT EXISTS (SELECT 1 FROM token_revocado WHERE jti = p_jti);
$$;

CREATE OR REPLACE PROCEDURE sp_purgar_seguridad(
    INOUT p_sesiones_cerradas INT,
    INOUT p_tokens_expirados INT,
    INOUT p_tokens_revocados_purgados INT,
    INOUT p_auditoria_archivada INT,
    p_dias_sesion_inactiva INT DEFAULT 1,
    p_dias_auditoria INT DEFAULT 90
)
LANGUAGE plpgsql
AS $$
BEGIN
    p_sesiones_cerradas := 0;
    p_tokens_expirados := 0;
    p_tokens_revocados_purgados := 0;
    p_auditoria_archivada := 0;

    WITH cerradas AS (
        UPDATE sesion
        SET activa = FALSE,
            fecha_fin = COALESCE(fecha_fin, NOW())
        WHERE activa = TRUE
          AND (
                (fecha_fin IS NOT NULL AND fecha_fin <= NOW())
             OR fecha_inicio <= NOW() - (p_dias_sesion_inactiva || ' days')::INTERVAL
          )
        RETURNING 1
    )
    SELECT COUNT(*) INTO p_sesiones_cerradas FROM cerradas;

    WITH purgados AS (
        DELETE FROM token_revocado
        WHERE fecha_expiracion <= NOW()
        RETURNING 1
    )
    SELECT COUNT(*) INTO p_tokens_revocados_purgados FROM purgados;

    WITH tokens AS (
        DELETE FROM token_verificacion
        WHERE fecha_expiracion <= NOW()
           OR (usado = TRUE AND fecha_uso <= NOW() - INTERVAL '7 days')
        RETURNING 1
    )
    SELECT COUNT(*) INTO p_tokens_expirados FROM tokens;

    WITH archivados AS (
        INSERT INTO auditoria_archivo
            (usuario_id, tipo_cambio, valor_anterior, valor_nuevo, ejecutado_por, fecha_evento)
        SELECT usuario_id, tipo_cambio, valor_anterior, valor_nuevo, ejecutado_por, fecha_evento
        FROM auditoria
        WHERE fecha_evento < NOW() - (p_dias_auditoria || ' days')::INTERVAL
        RETURNING 1
    )
    SELECT COUNT(*) INTO p_auditoria_archivada FROM archivados;

    DELETE FROM auditoria
    WHERE fecha_evento < NOW() - (p_dias_auditoria || ' days')::INTERVAL;
END;
$$;
