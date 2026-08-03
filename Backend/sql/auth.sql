CREATE EXTENSION IF NOT EXISTS pgcrypto;

--tablas
CREATE TABLE rol (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(50) NOT NULL UNIQUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE usuario (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correo_institucional VARCHAR(255) NOT NULL UNIQUE,
    contraseña          TEXT NOT NULL,
    email_verificado    BOOLEAN NOT NULL DEFAULT FALSE,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    proveedor_oauth     VARCHAR(50),
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usuario_rol (
    id              SERIAL PRIMARY KEY,
    usuario_id      UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    rol_id          INT NOT NULL REFERENCES rol(id) ON DELETE CASCADE,
    fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (usuario_id, rol_id)
);

CREATE TABLE sesion (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id          UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    perfil_activo_rol_id INT REFERENCES rol(id),
    token_jwt           TEXT DEFAULT NULL,
    fecha_inicio        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_fin           TIMESTAMPTZ,
    activa              BOOLEAN NOT NULL DEFAULT TRUE,
    ip                  TEXT,
    user_agent          TEXT
);

CREATE TABLE auditoria (
    id            SERIAL PRIMARY KEY,
    usuario_id    UUID REFERENCES usuario(id) ON DELETE SET NULL,
    tipo_cambio   VARCHAR(50) NOT NULL, 
    valor_anterior TEXT,
    valor_nuevo   TEXT,
    ejecutado_por UUID REFERENCES usuario(id) ON DELETE SET NULL,
    fecha_evento  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permiso_rbac (
    id      SERIAL PRIMARY KEY,
    rol_id  INT NOT NULL REFERENCES rol(id) ON DELETE CASCADE,
    recurso VARCHAR(100) NOT NULL,
    accion  VARCHAR(100) NOT NULL,
    UNIQUE (rol_id, recurso, accion)
);

CREATE TABLE token_verificacion (
    id              SERIAL PRIMARY KEY,
    usuario_id      UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    token           VARCHAR(255) NOT NULL UNIQUE,
    tipo            VARCHAR(30) NOT NULL,
    usado           BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_expiracion TIMESTAMPTZ NOT NULL,
    fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_uso       TIMESTAMPTZ
);

CREATE INDEX idx_usuario_correo ON usuario (correo_institucional);
CREATE INDEX idx_sesion_usuario ON sesion (usuario_id);
CREATE INDEX idx_token_verificacion_token ON token_verificacion (token);
CREATE INDEX idx_permiso_rbac_rol ON permiso_rbac (rol_id);

--procedimientos 
CREATE OR REPLACE FUNCTION fn_validar_dominio_correo(correo TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    dominio TEXT;
BEGIN
    dominio := lower(substring(correo from '@(.*)$'));
    RETURN dominio IN ('ingenieria.usac.edu.gt', 'ing.usac.edu.gt');
END;
$$;


CREATE OR REPLACE FUNCTION fn_tiene_permiso(p_rol_id INT, p_recurso TEXT, p_accion TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM permiso_rbac
        WHERE rol_id = p_rol_id
          AND recurso = p_recurso
          AND accion = p_accion
    );
END;
$$;

CREATE OR REPLACE PROCEDURE sp_registrar_usuario(
    p_correo TEXT,
    p_contraseña_hash TEXT,
    INOUT p_usuario_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_rol_estudiante INT;
BEGIN
    IF NOT fn_validar_dominio_correo(p_correo) THEN
        RAISE EXCEPTION 'DOMINIO_NO_AUTORIZADO: Correo no autorizado';
    END IF;

    IF EXISTS (SELECT 1 FROM usuario WHERE correo_institucional = lower(p_correo)) THEN
        RAISE EXCEPTION 'CORREO_YA_REGISTRADO: Ya existe una cuenta con este correo';
    END IF;

    INSERT INTO usuario (correo_institucional, contraseña)
    VALUES (lower(p_correo), p_contraseña_hash)
    RETURNING id INTO p_usuario_id;

    SELECT id INTO v_rol_estudiante FROM rol WHERE nombre = 'ESTUDIANTE';
    INSERT INTO usuario_rol (usuario_id, rol_id)
    VALUES (p_usuario_id, v_rol_estudiante);
END;
$$;

CREATE OR REPLACE PROCEDURE sp_asignar_rol(
    p_usuario_id UUID,
    p_rol_nombre TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_rol_id INT;
BEGIN
    SELECT id INTO v_rol_id FROM rol WHERE nombre = upper(p_rol_nombre);
    IF v_rol_id IS NULL THEN
        RAISE EXCEPTION 'ROL_INVALIDO: Rol inválido';
    END IF;

    INSERT INTO usuario_rol (usuario_id, rol_id)
    VALUES (p_usuario_id, v_rol_id)
    ON CONFLICT (usuario_id, rol_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_cambiar_password(
    p_usuario_id UUID,
    p_nuevo_hash TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE usuario SET contraseña = p_nuevo_hash, fecha_actualizacion = NOW()
    WHERE id = p_usuario_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'USUARIO_NO_ENCONTRADO: Usuario no encontrado';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_vincular_cuenta_oauth(
    p_correo TEXT,
    p_proveedor TEXT,
    INOUT p_usuario_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT fn_validar_dominio_correo(p_correo) THEN
        RAISE EXCEPTION 'DOMINIO_NO_AUTORIZADO: Correo no autorizado';
    END IF;

    SELECT id INTO p_usuario_id FROM usuario WHERE correo_institucional = lower(p_correo);

    IF p_usuario_id IS NULL THEN
        INSERT INTO usuario (correo_institucional, contraseña, email_verificado, proveedor_oauth)
        VALUES (lower(p_correo), 'no-applicable-oauth', TRUE, p_proveedor)
        RETURNING id INTO p_usuario_id;

        INSERT INTO usuario_rol (usuario_id, rol_id)
        SELECT p_usuario_id, id FROM rol WHERE nombre = 'ESTUDIANTE';
    ELSE
        UPDATE usuario
        SET proveedor_oauth = p_proveedor, email_verificado = TRUE, fecha_actualizacion = NOW()
        WHERE id = p_usuario_id;
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_solicitar_reset_password(
    p_correo TEXT,
    INOUT p_token TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_usuario_id UUID;
BEGIN
    SELECT id INTO v_usuario_id FROM usuario WHERE correo_institucional = lower(p_correo);
    IF v_usuario_id IS NULL THEN
        p_token := NULL;
        RETURN;
    END IF;

    p_token := encode(gen_random_bytes(32), 'hex');
    INSERT INTO token_verificacion (usuario_id, token, tipo, fecha_expiracion)
    VALUES (v_usuario_id, p_token, 'RESET_PASSWORD', NOW() + INTERVAL '30 minutes');
END;
$$;

CREATE OR REPLACE PROCEDURE sp_confirmar_verificacion(
    p_token TEXT,
    p_tipo TEXT,
    p_nueva_contraseña_hash TEXT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_registro RECORD;
BEGIN
    SELECT * INTO v_registro
    FROM token_verificacion
    WHERE token = p_token AND tipo = p_tipo;

    IF v_registro.id IS NULL THEN
        RAISE EXCEPTION 'TOKEN_INVALIDO: Token inválido';
    END IF;
    IF v_registro.usado THEN
        RAISE EXCEPTION 'TOKEN_INVALIDO: El token ya fue utilizado';
    END IF;
    IF v_registro.fecha_expiracion < NOW() THEN
        RAISE EXCEPTION 'TOKEN_EXPIRADO: El token ha expirado';
    END IF;

    UPDATE token_verificacion SET usado = TRUE, fecha_uso = NOW()
    WHERE id = v_registro.id;

    IF p_tipo = 'RESET_PASSWORD' AND p_nueva_contraseña_hash IS NOT NULL THEN
        CALL sp_cambiar_password(v_registro.usuario_id, p_nueva_contraseña_hash);
    END IF;
END;
$$;

--vistas
CREATE OR REPLACE VIEW vw_usuarios_activos_roles AS
SELECT
    u.id,
    u.correo_institucional,
    u.email_verificado,
    u.activo,
    u.proveedor_oauth,
    COALESCE(array_agg(r.nombre ORDER BY r.nombre), '{}') AS roles,
    u.fecha_creacion,
    u.fecha_actualizacion
FROM usuario u
LEFT JOIN usuario_rol ur ON ur.usuario_id = u.id
LEFT JOIN rol r ON r.id = ur.rol_id
WHERE u.activo = TRUE
GROUP BY u.id;

CREATE OR REPLACE VIEW vw_sesiones_activas AS
SELECT
    s.id,
    s.usuario_id,
    u.correo_institucional,
    s.perfil_activo_rol_id,
    r.nombre AS perfil_activo,
    s.token_jwt,
    s.fecha_inicio,
    s.fecha_fin
FROM sesion s
JOIN usuario u ON u.id = s.usuario_id
LEFT JOIN rol r ON r.id = s.perfil_activo_rol_id
WHERE s.activa = TRUE
  AND (s.fecha_fin IS NULL OR s.fecha_fin > NOW());

--triggers
CREATE OR REPLACE FUNCTION fn_trg_auditoria_password() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.contraseña IS DISTINCT FROM OLD.contraseña THEN
        INSERT INTO auditoria (usuario_id, tipo_cambio, valor_anterior, valor_nuevo, ejecutado_por)
        VALUES (NEW.id, 'PASSWORD', '***', '***', OLD.id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auditoria_password ON usuario;
CREATE TRIGGER trg_auditoria_password
    AFTER UPDATE OF contraseña ON usuario
    FOR EACH ROW EXECUTE FUNCTION fn_trg_auditoria_password();

CREATE OR REPLACE FUNCTION fn_trg_auditoria_rol() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_nombre VARCHAR(50);
    v_usuario_existe BOOLEAN;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT nombre INTO v_nombre FROM rol WHERE id = NEW.rol_id;
        INSERT INTO auditoria (usuario_id, tipo_cambio, valor_nuevo, ejecutado_por)
        VALUES (NEW.usuario_id, 'ROL', v_nombre, NEW.usuario_id);
    ELSIF TG_OP = 'DELETE' THEN
        SELECT nombre INTO v_nombre FROM rol WHERE id = OLD.rol_id;
        SELECT EXISTS(SELECT 1 FROM usuario WHERE id = OLD.usuario_id) INTO v_usuario_existe;
        IF v_usuario_existe THEN
            INSERT INTO auditoria (usuario_id, tipo_cambio, valor_anterior, ejecutado_por)
            VALUES (OLD.usuario_id, 'ROL', v_nombre, OLD.usuario_id);
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_auditoria_rol ON usuario_rol;
CREATE TRIGGER trg_auditoria_rol
    AFTER INSERT OR DELETE ON usuario_rol
    FOR EACH ROW EXECUTE FUNCTION fn_trg_auditoria_rol();


CREATE OR REPLACE FUNCTION fn_trg_marcar_verificado() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.usado = TRUE AND NEW.tipo = 'VERIFICACION_CORREO' THEN
        UPDATE usuario SET email_verificado = TRUE, fecha_actualizacion = NOW()
        WHERE id = NEW.usuario_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marcar_verificado ON token_verificacion;
CREATE TRIGGER trg_marcar_verificado
    AFTER UPDATE OF usado ON token_verificacion
    FOR EACH ROW EXECUTE FUNCTION fn_trg_marcar_verificado();


INSERT INTO rol (nombre) VALUES ('ESTUDIANTE'), ('CATEDRATICO'), ('AUXILIAR'), ('ADMIN')
ON CONFLICT (nombre) DO NOTHING;

--inserccion de datos
INSERT INTO permiso_rbac (rol_id, recurso, accion)
SELECT r.id, p.recurso, p.accion
FROM (VALUES
    ('usuario', 'leer'),
    ('usuario', 'crear'),
    ('usuario', 'actualizar_rol'),
    ('rol', 'gestionar'),
    ('curso', 'leer'),
    ('curso', 'inscribir'),
    ('curso', 'asignar'),
    ('catalogo', 'leer'),
    ('catalogo', 'publicar'),
    ('analitica', 'leer'),
    ('reproduccion', 'reproducir'),
    ('sesion', 'cerrar')
) AS p(recurso, accion)
JOIN rol r ON true
WHERE (r.nombre, p.recurso, p.accion) IN (
    ('ESTUDIANTE', 'usuario', 'leer'),
    ('ESTUDIANTE', 'curso', 'leer'),
    ('ESTUDIANTE', 'curso', 'inscribir'),
    ('ESTUDIANTE', 'catalogo', 'leer'),
    ('ESTUDIANTE', 'analitica', 'leer'),
    ('ESTUDIANTE', 'reproduccion', 'reproducir'),
    ('ESTUDIANTE', 'sesion', 'cerrar'),
    ('CATEDRATICO', 'usuario', 'leer'),
    ('CATEDRATICO', 'curso', 'leer'),
    ('CATEDRATICO', 'catalogo', 'leer'),
    ('CATEDRATICO', 'catalogo', 'publicar'),
    ('CATEDRATICO', 'sesion', 'cerrar'),
    ('AUXILIAR', 'usuario', 'leer'),
    ('AUXILIAR', 'curso', 'leer'),
    ('AUXILIAR', 'catalogo', 'leer'),
    ('AUXILIAR', 'sesion', 'cerrar'),
    ('ADMIN', 'usuario', 'leer'),
    ('ADMIN', 'usuario', 'crear'),
    ('ADMIN', 'usuario', 'actualizar_rol'),
    ('ADMIN', 'rol', 'gestionar'),
    ('ADMIN', 'curso', 'leer'),
    ('ADMIN', 'curso', 'asignar'),
    ('ADMIN', 'catalogo', 'leer'),
    ('ADMIN', 'catalogo', 'publicar'),
    ('ADMIN', 'analitica', 'leer'),
    ('ADMIN', 'sesion', 'cerrar')
)
ON CONFLICT (rol_id, recurso, accion) DO NOTHING;

