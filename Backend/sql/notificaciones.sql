CREATE EXTENSION IF NOT EXISTS pgcrypto;

--tablas
CREATE TABLE plantilla_correo (
    id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    asunto VARCHAR(255) NOT NULL,
    cuerpo TEXT NOT NULL,               
    tipo   VARCHAR(30) NOT NULL         
);

CREATE TABLE notificacion (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id     UUID NOT NULL,
    correo_destino VARCHAR(320) NOT NULL,
    plantilla_id   UUID NOT NULL REFERENCES plantilla_correo(id),
    tipo           VARCHAR(30) NOT NULL,
    datos_contexto JSONB NOT NULL DEFAULT '{}',
    estado         VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE',
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_envio    TIMESTAMPTZ
);

CREATE TABLE cola_envio (
    id                   SERIAL PRIMARY KEY,
    notificacion_id      UUID NOT NULL REFERENCES notificacion(id) ON DELETE CASCADE,
    intentos             INT NOT NULL DEFAULT 0,
    ultimo_error         TEXT,
    estado               VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE',  
    fecha_proximo_intento TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notificacion_estado ON notificacion (estado);
CREATE INDEX idx_notificacion_usuario ON notificacion (usuario_id);
CREATE INDEX idx_cola_estado ON cola_envio (estado, fecha_proximo_intento);

--funcines
CREATE OR REPLACE FUNCTION fn_renderizar_plantilla(p_plantilla_id UUID, p_datos JSONB)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_asunto TEXT;
    v_cuerpo TEXT;
    v_clave TEXT;
    v_valor TEXT;
    v_claves TEXT[];
BEGIN
    SELECT asunto, cuerpo INTO v_asunto, v_cuerpo
    FROM plantilla_correo WHERE id = p_plantilla_id;

    IF v_cuerpo IS NULL THEN
        RAISE EXCEPTION 'PLANTILLA_NO_ENCONTRADA: Plantilla no encontrada';
    END IF;

    v_claves := ARRAY(
        SELECT DISTINCT match[1]
        FROM regexp_matches(v_cuerpo, '\{\{([a-zA-Z0-9_]+)\}\}', 'g') AS match
    );

    FOREACH v_clave IN ARRAY v_claves
    LOOP
        v_valor := COALESCE((p_datos ->> v_clave), '');
        v_cuerpo := replace(v_cuerpo, '{{' || v_clave || '}}', v_valor);
    END LOOP;

    RETURN v_asunto || E'\n' || v_cuerpo;
END;
$$;

--procedimientos
CREATE OR REPLACE PROCEDURE sp_registrar_notificacion(
    INOUT p_notificacion_id UUID,
    p_usuario_id UUID,
    p_correo_destino VARCHAR(320),
    p_plantilla_id UUID,
    p_tipo VARCHAR(30),
    p_datos_contexto JSONB DEFAULT '{}'
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO notificacion (usuario_id, correo_destino, plantilla_id, tipo, datos_contexto)
    VALUES (p_usuario_id, p_correo_destino, p_plantilla_id, p_tipo, p_datos_contexto)
    RETURNING id INTO p_notificacion_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_marcar_enviada(p_notificacion_id UUID)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE notificacion
    SET estado = 'ENVIADA', fecha_envio = NOW()
    WHERE id = p_notificacion_id;

    UPDATE cola_envio
    SET estado = 'ENVIADA'
    WHERE notificacion_id = p_notificacion_id;
END;
$$;


CREATE OR REPLACE PROCEDURE sp_registrar_intento_fallido(
    p_cola_id INT,
    p_error TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE cola_envio
    SET ultimo_error = p_error, estado = 'FALLIDA'
    WHERE id = p_cola_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_marcar_fallida_definitiva(p_cola_id INT)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE cola_envio
    SET estado = 'FALLIDA_DEFINITIVA', fecha_proximo_intento = NULL
    WHERE id = p_cola_id;

    UPDATE notificacion
    SET estado = 'FALLIDA'
    WHERE id = (SELECT notificacion_id FROM cola_envio WHERE id = p_cola_id)
      AND estado = 'PENDIENTE';
END;
$$;

--vistas
CREATE OR REPLACE VIEW vw_notificaciones_pendientes AS
SELECT
    n.id AS notificacion_id,
    n.usuario_id,
    n.correo_destino,
    n.tipo,
    n.datos_contexto,
    ce.id AS cola_id,
    ce.intentos,
    ce.fecha_proximo_intento,
    fn_renderizar_plantilla(n.plantilla_id, n.datos_contexto) AS contenido
FROM notificacion n
JOIN cola_envio ce ON ce.notificacion_id = n.id
WHERE n.estado = 'PENDIENTE'
  AND ce.estado = 'PENDIENTE'
  AND ce.fecha_proximo_intento <= NOW()
ORDER BY ce.fecha_proximo_intento ASC;

--triggers
CREATE OR REPLACE FUNCTION fn_trg_encolar_notificacion() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO cola_envio (notificacion_id, estado)
    VALUES (NEW.id, 'PENDIENTE');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_encolar_notificacion ON notificacion;
CREATE TRIGGER trg_encolar_notificacion
    AFTER INSERT ON notificacion
    FOR EACH ROW EXECUTE FUNCTION fn_trg_encolar_notificacion();


CREATE OR REPLACE FUNCTION fn_trg_reintento_fallido() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.ultimo_error IS NOT NULL AND NEW.ultimo_error IS DISTINCT FROM OLD.ultimo_error THEN
        UPDATE cola_envio
        SET intentos = OLD.intentos + 1,
            estado = 'PENDIENTE',
            fecha_proximo_intento = NOW() + (OLD.intentos + 1) * INTERVAL '1 minute'
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reintento_fallido ON cola_envio;
CREATE TRIGGER trg_reintento_fallido
    AFTER UPDATE OF ultimo_error ON cola_envio
    FOR EACH ROW EXECUTE FUNCTION fn_trg_reintento_fallido();


--insert default templates
INSERT INTO plantilla_correo (nombre, asunto, cuerpo, tipo) VALUES
    ('confirmacion_registro',
     'Bienvenido a YoUSAC',
     'Hola {{nombre}}, tu cuenta institucional {{correo}} fue creada exitosamente.',
     'REGISTRO'),
    ('nueva_clase',
     'Nueva clase publicada',
     'El curso {{curso}} publicó la clase "{{tema}}" del semestre {{semestre}}.',
     'NUEVA_CLASE'),
    ('aviso_general',
     'Aviso del sistema',
     '{{mensaje}}',
     'AVISO')
ON CONFLICT (nombre) DO NOTHING;
