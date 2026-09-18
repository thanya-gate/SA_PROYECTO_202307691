-- Esquema mínimo requerido por la funcionalidad de playlists.
-- Debe poder ejecutarse tanto en una base nueva como en una ya existente.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS playlist (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estudiante_id       UUID NOT NULL,
    nombre              VARCHAR(120) NOT NULL,
    es_publica          BOOLEAN NOT NULL DEFAULT FALSE,
    enlace_publico      UUID UNIQUE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS playlist_item (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id    UUID NOT NULL REFERENCES playlist(id) ON DELETE CASCADE,
    clase_id       UUID NOT NULL,
    orden          INT NOT NULL DEFAULT 0,
    segundo_inicio INT NOT NULL DEFAULT 0,
    fecha_agregado TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (playlist_id, orden)
);

CREATE INDEX IF NOT EXISTS idx_playlist_estudiante ON playlist (estudiante_id);
CREATE INDEX IF NOT EXISTS idx_playlist_item_playlist ON playlist_item (playlist_id);
