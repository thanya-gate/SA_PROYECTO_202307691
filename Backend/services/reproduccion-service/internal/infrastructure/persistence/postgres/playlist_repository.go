package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"yousac.com/yousac/reproduccion-service/internal/domain"
)

func (r *ReproduccionRepository) CrearPlaylist(ctx context.Context, estudianteID, nombre string, esPublica bool) (*domain.Playlist, error) {
	var playlist domain.Playlist
	err := r.pool.QueryRow(ctx, `
		INSERT INTO playlist (estudiante_id, nombre, es_publica, enlace_publico)
		VALUES ($1, $2, $3, CASE WHEN $3 THEN gen_random_uuid() ELSE NULL END)
		RETURNING id, estudiante_id, nombre, es_publica,
		          COALESCE(enlace_publico::text, ''),
		          fecha_creacion::text, fecha_actualizacion::text`,
		estudianteID, nombre, esPublica).
		Scan(&playlist.PlaylistID, &playlist.EstudianteID, &playlist.Nombre, &playlist.EsPublica,
			&playlist.EnlacePublico, &playlist.FechaCreacion, &playlist.FechaActualizacion)
	if err != nil {
		return nil, fmt.Errorf("crear playlist: %w", mapearError(err))
	}
	playlist.CantidadItems = 0
	return &playlist, nil
}

func (r *ReproduccionRepository) ListarPlaylists(ctx context.Context, estudianteID string) ([]domain.Playlist, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT p.id, p.estudiante_id, p.nombre, p.es_publica,
		       COALESCE(p.enlace_publico::text, ''),
		       (SELECT COUNT(*) FROM playlist_item pi WHERE pi.playlist_id = p.id)::int,
		       p.fecha_creacion::text, p.fecha_actualizacion::text,
		       (SELECT pi.clase_id FROM playlist_item pi WHERE pi.playlist_id = p.id
		        ORDER BY pi.orden ASC LIMIT 1)::text AS clase_portada
		FROM playlist p
		WHERE p.estudiante_id = $1
		ORDER BY p.fecha_actualizacion DESC`, estudianteID)
	if err != nil {
		return nil, fmt.Errorf("listar playlists: %w", err)
	}
	defer rows.Close()

	playlists := make([]domain.Playlist, 0)
	for rows.Next() {
		var playlist domain.Playlist
		if err := rows.Scan(&playlist.PlaylistID, &playlist.EstudianteID, &playlist.Nombre, &playlist.EsPublica,
			&playlist.EnlacePublico, &playlist.CantidadItems,
			&playlist.FechaCreacion, &playlist.FechaActualizacion, &playlist.ClasePortada); err != nil {
			return nil, fmt.Errorf("leer playlist: %w", err)
		}
		playlists = append(playlists, playlist)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterar playlists: %w", err)
	}
	return playlists, nil
}

func (r *ReproduccionRepository) ListarPlaylistsPublicas(ctx context.Context, estudianteID string) ([]domain.Playlist, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT p.id, p.estudiante_id, p.nombre, p.es_publica,
		       COALESCE(p.enlace_publico::text, ''),
		       (SELECT COUNT(*) FROM playlist_item pi WHERE pi.playlist_id = p.id)::int,
		       p.fecha_creacion::text, p.fecha_actualizacion::text,
		       (SELECT pi.clase_id FROM playlist_item pi WHERE pi.playlist_id = p.id
		        ORDER BY pi.orden ASC LIMIT 1)::text AS clase_portada
		FROM playlist p
		WHERE p.es_publica = TRUE AND p.estudiante_id <> $1
		ORDER BY p.fecha_actualizacion DESC`, estudianteID)
	if err != nil {
		return nil, fmt.Errorf("listar playlists públicas: %w", err)
	}
	defer rows.Close()

	playlists := make([]domain.Playlist, 0)
	for rows.Next() {
		var playlist domain.Playlist
		if err := rows.Scan(&playlist.PlaylistID, &playlist.EstudianteID, &playlist.Nombre, &playlist.EsPublica,
			&playlist.EnlacePublico, &playlist.CantidadItems,
			&playlist.FechaCreacion, &playlist.FechaActualizacion, &playlist.ClasePortada); err != nil {
			return nil, fmt.Errorf("leer playlist pública: %w", err)
		}
		playlists = append(playlists, playlist)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterar playlists públicas: %w", err)
	}
	return playlists, nil
}

func (r *ReproduccionRepository) ObtenerPlaylist(ctx context.Context, estudianteID, playlistID string) (*domain.Playlist, []domain.PlaylistItem, error) {
	var playlist domain.Playlist
	err := r.pool.QueryRow(ctx, `
		SELECT p.id, p.estudiante_id, p.nombre, p.es_publica,
		       COALESCE(p.enlace_publico::text, ''),
		       (SELECT COUNT(*) FROM playlist_item pi WHERE pi.playlist_id = p.id)::int,
		       p.fecha_creacion::text, p.fecha_actualizacion::text,
		       (SELECT pi.clase_id FROM playlist_item pi WHERE pi.playlist_id = p.id
		        ORDER BY pi.orden ASC LIMIT 1)::text AS clase_portada
		FROM playlist p
		WHERE p.id = $1 AND p.estudiante_id = $2`, playlistID, estudianteID).
		Scan(&playlist.PlaylistID, &playlist.EstudianteID, &playlist.Nombre, &playlist.EsPublica,
			&playlist.EnlacePublico, &playlist.CantidadItems,
			&playlist.FechaCreacion, &playlist.FechaActualizacion, &playlist.ClasePortada)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, domain.ErrPlaylistNoEncontrada
	}
	if err != nil {
		return nil, nil, fmt.Errorf("obtener playlist: %w", err)
	}
	items, err := r.listarItems(ctx, playlistID)
	if err != nil {
		return nil, nil, err
	}
	return &playlist, items, nil
}

func (r *ReproduccionRepository) ObtenerPlaylistPublica(ctx context.Context, enlacePublico string) (*domain.Playlist, []domain.PlaylistItem, error) {
	var playlist domain.Playlist
	err := r.pool.QueryRow(ctx, `
		SELECT p.id, p.estudiante_id, p.nombre, p.es_publica,
		       COALESCE(p.enlace_publico::text, ''),
		       (SELECT COUNT(*) FROM playlist_item pi WHERE pi.playlist_id = p.id)::int,
		       p.fecha_creacion::text, p.fecha_actualizacion::text,
		       (SELECT pi.clase_id FROM playlist_item pi WHERE pi.playlist_id = p.id
		        ORDER BY pi.orden ASC LIMIT 1)::text AS clase_portada
		FROM playlist p
		WHERE p.enlace_publico = $1 AND p.es_publica = TRUE`, enlacePublico).
		Scan(&playlist.PlaylistID, &playlist.EstudianteID, &playlist.Nombre, &playlist.EsPublica,
			&playlist.EnlacePublico, &playlist.CantidadItems,
			&playlist.FechaCreacion, &playlist.FechaActualizacion, &playlist.ClasePortada)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, domain.ErrEnlacePublicoInvalido
	}
	if err != nil {
		return nil, nil, fmt.Errorf("obtener playlist pública: %w", err)
	}
	items, err := r.listarItems(ctx, playlist.PlaylistID)
	if err != nil {
		return nil, nil, err
	}
	return &playlist, items, nil
}

func (r *ReproduccionRepository) ActualizarPlaylist(ctx context.Context, estudianteID, playlistID, nombre string, esPublica bool) (*domain.Playlist, error) {
	var playlist domain.Playlist
	// FA-03: si ya hay un enlace vigente y sigue siendo pública, se reutiliza;
	// al pasar a pública sin enlace se genera uno nuevo y al volver a privada
	// se invalida el enlace previo.
	err := r.pool.QueryRow(ctx, `
		UPDATE playlist
		SET nombre = $3,
		    es_publica = $4,
		    enlace_publico = CASE
		        WHEN $4 AND enlace_publico IS NULL THEN gen_random_uuid()
		        WHEN NOT $4 THEN NULL
		        ELSE enlace_publico
		    END,
		    fecha_actualizacion = NOW()
		WHERE id = $1 AND estudiante_id = $2
		RETURNING id, estudiante_id, nombre, es_publica,
		          COALESCE(enlace_publico::text, ''),
		          fecha_creacion::text, fecha_actualizacion::text`,
		playlistID, estudianteID, nombre, esPublica).
		Scan(&playlist.PlaylistID, &playlist.EstudianteID, &playlist.Nombre, &playlist.EsPublica,
			&playlist.EnlacePublico, &playlist.FechaCreacion, &playlist.FechaActualizacion)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrPlaylistNoEncontrada
	}
	if err != nil {
		return nil, fmt.Errorf("actualizar playlist: %w", err)
	}
	if err := r.pool.QueryRow(ctx,
		"SELECT COUNT(*)::int FROM playlist_item WHERE playlist_id = $1", playlistID).Scan(&playlist.CantidadItems); err != nil {
		return nil, fmt.Errorf("contar elementos de playlist: %w", err)
	}
	return &playlist, nil
}

func (r *ReproduccionRepository) EliminarPlaylist(ctx context.Context, estudianteID, playlistID string) (bool, error) {
	tag, err := r.pool.Exec(ctx,
		"DELETE FROM playlist WHERE id = $1 AND estudiante_id = $2", playlistID, estudianteID)
	if err != nil {
		return false, fmt.Errorf("eliminar playlist: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}

func (r *ReproduccionRepository) AgregarItemPlaylist(ctx context.Context, estudianteID, playlistID, claseID string, segundoInicio int32) (*domain.PlaylistItem, int32, error) {
	if err := r.verificarPropietario(ctx, playlistID, estudianteID); err != nil {
		return nil, 0, err
	}

	var siguienteOrden int32
	err := r.pool.QueryRow(ctx,
		"SELECT COALESCE(MAX(orden), -1) + 1 FROM playlist_item WHERE playlist_id = $1", playlistID).
		Scan(&siguienteOrden)
	if err != nil {
		return nil, 0, fmt.Errorf("calcular orden de playlist: %w", err)
	}

	var item domain.PlaylistItem
	err = r.pool.QueryRow(ctx, `
		INSERT INTO playlist_item (playlist_id, clase_id, orden, segundo_inicio)
		VALUES ($1, $2, $3, $4)
		RETURNING id, clase_id, orden, segundo_inicio, fecha_agregado::text`,
		playlistID, claseID, siguienteOrden, segundoInicio).
		Scan(&item.PlaylistItemID, &item.ClaseID, &item.Orden, &item.SegundoInicio, &item.FechaAgregado)
	if err != nil {
		return nil, 0, fmt.Errorf("agregar elemento a playlist: %w", mapearError(err))
	}

	var cantidad int32
	err = r.pool.QueryRow(ctx,
		"SELECT COUNT(*)::int FROM playlist_item WHERE playlist_id = $1", playlistID).Scan(&cantidad)
	if err != nil {
		return nil, 0, fmt.Errorf("contar elementos de playlist: %w", err)
	}
	return &item, cantidad, nil
}

func (r *ReproduccionRepository) ReordenarPlaylist(ctx context.Context, estudianteID, playlistID string, itemsOrdenados []string) ([]domain.PlaylistItem, error) {
	if err := r.verificarPropietario(ctx, playlistID, estudianteID); err != nil {
		return nil, err
	}

	var cantActual int32
	if err := r.pool.QueryRow(ctx,
		"SELECT COUNT(*)::int FROM playlist_item WHERE playlist_id = $1", playlistID).Scan(&cantActual); err != nil {
		return nil, fmt.Errorf("contar elementos de playlist: %w", err)
	}
	if len(itemsOrdenados) != int(cantActual) {
		return nil, domain.ErrPlaylistItemNoEncontrado
	}

	// Doble pasada para no violar la restricción UNIQUE (playlist_id, orden):
	// primero se desplazan todos los órdenes a valores negativos y luego se
	// asignan las posiciones finales 0..n-1.
	for i, itemID := range itemsOrdenados {
		if _, err := r.pool.Exec(ctx,
			"UPDATE playlist_item SET orden = $1 WHERE playlist_id = $2 AND id = $3",
			-(i + 1), playlistID, itemID); err != nil {
			return nil, fmt.Errorf("reordenar playlist (paso 1): %w", err)
		}
	}
	for i, itemID := range itemsOrdenados {
		if _, err := r.pool.Exec(ctx,
			"UPDATE playlist_item SET orden = $1 WHERE playlist_id = $2 AND id = $3",
			int32(i), playlistID, itemID); err != nil {
			return nil, fmt.Errorf("reordenar playlist (paso 2): %w", err)
		}
	}

	return r.listarItems(ctx, playlistID)
}

func (r *ReproduccionRepository) EliminarItemPlaylist(ctx context.Context, estudianteID, playlistID, playlistItemID string) (bool, int32, error) {
	if err := r.verificarPropietario(ctx, playlistID, estudianteID); err != nil {
		return false, 0, err
	}

	tag, err := r.pool.Exec(ctx,
		"DELETE FROM playlist_item WHERE id = $1 AND playlist_id = $2", playlistItemID, playlistID)
	if err != nil {
		return false, 0, fmt.Errorf("eliminar elemento de playlist: %w", err)
	}

	var cantidad int32
	err = r.pool.QueryRow(ctx,
		"SELECT COUNT(*)::int FROM playlist_item WHERE playlist_id = $1", playlistID).Scan(&cantidad)
	if err != nil {
		return false, 0, fmt.Errorf("contar elementos de playlist: %w", err)
	}
	return tag.RowsAffected() > 0, cantidad, nil
}

func (r *ReproduccionRepository) verificarPropietario(ctx context.Context, playlistID, estudianteID string) error {
	var existente int
	err := r.pool.QueryRow(ctx,
		"SELECT 1 FROM playlist WHERE id = $1 AND estudiante_id = $2", playlistID, estudianteID).Scan(&existente)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrPlaylistNoEncontrada
	}
	if err != nil {
		return fmt.Errorf("verificar propietario de playlist: %w", err)
	}
	return nil
}

func (r *ReproduccionRepository) listarItems(ctx context.Context, playlistID string) ([]domain.PlaylistItem, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, clase_id, orden, segundo_inicio, fecha_agregado::text
		FROM playlist_item
		WHERE playlist_id = $1
		ORDER BY orden ASC`, playlistID)
	if err != nil {
		return nil, fmt.Errorf("listar elementos de playlist: %w", err)
	}
	defer rows.Close()

	items := make([]domain.PlaylistItem, 0)
	for rows.Next() {
		var item domain.PlaylistItem
		if err := rows.Scan(&item.PlaylistItemID, &item.ClaseID, &item.Orden, &item.SegundoInicio, &item.FechaAgregado); err != nil {
			return nil, fmt.Errorf("leer elemento de playlist: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterar elementos de playlist: %w", err)
	}
	return items, nil
}