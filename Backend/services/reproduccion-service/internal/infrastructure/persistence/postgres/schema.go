package postgres

import (
	"context"
	_ "embed"
	"fmt"
)

//go:embed migrations/playlist.sql
var playlistSchemaSQL string

// EnsurePlaylistSchema aplica únicamente el esquema requerido por playlists.
// Las sentencias son idempotentes para que el servicio pueda arrancar tanto en
// una base nueva como en una base que ya tenga tablas y datos.
func EnsurePlaylistSchema(ctx context.Context, db DBTX) error {
	if _, err := db.Exec(ctx, playlistSchemaSQL); err != nil {
		return fmt.Errorf("aplicar esquema de playlists: %w", err)
	}
	return nil
}
