package postgres

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"yousac.com/yousac/reproduccion-service/internal/domain"
)

func valoresPlaylist(enlace string) []any {
	return []any{
		"playlist-1", "estudiante-1", "Repaso parcial", true, enlace,
		"2026-09-10T10:00:00Z", "2026-09-10T10:00:00Z",
	}
}

func valoresPlaylistCompleta(enlace string, cantidad int32) []any {
	return []any{
		"playlist-1", "estudiante-1", "Repaso parcial", true, enlace,
		cantidad, "2026-09-10T10:00:00Z", "2026-09-10T10:00:00Z", "clase-1",
	}
}

func valoresItem(orden, segundo int32) []any {
	return []any{
		"item-1", "clase-1", orden, segundo, "2026-09-10T10:05:00Z",
	}
}

func TestCrearPlaylistGeneraEnlaceSoloSiEsPublica(t *testing.T) {
	var consulta string
	var argumentos []any
	db := &dbFalsa{queryRow: func(_ context.Context, sql string, args ...any) pgx.Row {
		consulta = sql
		argumentos = args
		return filaFalsa{valores: valoresPlaylist("enlace-1")}
	}}
	repositorio := NewReproduccionRepository(db)

	playlist, err := repositorio.CrearPlaylist(context.Background(), "estudiante-1", "Repaso parcial", true)
	if err != nil {
		t.Fatalf("CrearPlaylist() error = %v", err)
	}
	if !strings.Contains(consulta, "INSERT INTO playlist") || !strings.Contains(consulta, "gen_random_uuid()") {
		t.Fatalf("consulta = %q, se esperaba INSERT con gen_random_uuid()", consulta)
	}
	if !reflect.DeepEqual(argumentos, []any{"estudiante-1", "Repaso parcial", true}) {
		t.Fatalf("argumentos = %#v", argumentos)
	}
	if playlist.PlaylistID != "playlist-1" || playlist.EnlacePublico != "enlace-1" || playlist.CantidadItems != 0 {
		t.Fatalf("playlist mapeada = %#v", playlist)
	}

	db.queryRow = func(_ context.Context, sql string, args ...any) pgx.Row {
		consulta = sql
		argumentos = args
		return filaFalsa{valores: valoresPlaylist("")}
	}
	privada, err := repositorio.CrearPlaylist(context.Background(), "estudiante-1", "Privada", false)
	if err != nil {
		t.Fatalf("CrearPlaylist(privada) error = %v", err)
	}
	if privada.EnlacePublico != "" {
		t.Fatalf("una playlist privada no debe tener enlace, got %q", privada.EnlacePublico)
	}
}

func TestListarPlaylistsCuentaItemsYOrdena(t *testing.T) {
	filas := nuevasFilasFalsas(valoresPlaylistCompleta("", int32(3)))
	db := &dbFalsa{query: func(_ context.Context, sql string, args ...any) (pgx.Rows, error) {
		if !strings.Contains(sql, "WHERE p.estudiante_id = $1") || !strings.Contains(sql, "ORDER BY p.fecha_actualizacion DESC") {
			t.Fatalf("consulta inesperada: %q", sql)
		}
		return filas, nil
	}}
	repositorio := NewReproduccionRepository(db)

	playlists, err := repositorio.ListarPlaylists(context.Background(), "estudiante-1")
	if err != nil {
		t.Fatalf("ListarPlaylists() error = %v", err)
	}
	if len(playlists) != 1 || playlists[0].PlaylistID != "playlist-1" {
		t.Fatalf("playlists = %#v", playlists)
	}
	if !filas.cerrada {
		t.Fatal("las filas no fueron cerradas")
	}
}

func TestListarPlaylistsPublicasExcluyePropiasYFiltraPublicas(t *testing.T) {
	var argumentos []any
	filas := nuevasFilasFalsas(valoresPlaylistCompleta("enlace-1", int32(2)))
	db := &dbFalsa{query: func(_ context.Context, sql string, args ...any) (pgx.Rows, error) {
		if !strings.Contains(sql, "WHERE p.es_publica = TRUE") || !strings.Contains(sql, "AND p.estudiante_id <> $1") {
			t.Fatalf("consulta inesperada: %q", sql)
		}
		argumentos = args
		return filas, nil
	}}
	repositorio := NewReproduccionRepository(db)

	playlists, err := repositorio.ListarPlaylistsPublicas(context.Background(), "estudiante-1")
	if err != nil {
		t.Fatalf("ListarPlaylistsPublicas() error = %v", err)
	}
	if !reflect.DeepEqual(argumentos, []any{"estudiante-1"}) {
		t.Fatalf("argumentos = %#v", argumentos)
	}
	if len(playlists) != 1 || playlists[0].PlaylistID != "playlist-1" || playlists[0].EnlacePublico != "enlace-1" || playlists[0].CantidadItems != 2 {
		t.Fatalf("playlists públicas = %#v", playlists)
	}
	if !filas.cerrada {
		t.Fatal("las filas no fueron cerradas")
	}
}

func TestObtenerPlaylistMapeaAusenciaYListaItems(t *testing.T) {
	db := &dbFalsa{queryRow: func(_ context.Context, sql string, args ...any) pgx.Row {
		if strings.Contains(sql, "FROM playlist p") {
			return filaFalsa{valores: valoresPlaylistCompleta("", int32(1))}
		}
		return nil
	}}
	repositorio := NewReproduccionRepository(db)

	db.query = func(_ context.Context, sql string, args ...any) (pgx.Rows, error) {
		if !strings.Contains(sql, "FROM playlist_item") || !strings.Contains(sql, "ORDER BY orden ASC") {
			t.Fatalf("consulta inesperada: %q", sql)
		}
		return nuevasFilasFalsas(valoresItem(0, 90)), nil
	}
	playlist, items, err := repositorio.ObtenerPlaylist(context.Background(), "estudiante-1", "playlist-1")
	if err != nil {
		t.Fatalf("ObtenerPlaylist() error = %v", err)
	}
	if playlist.PlaylistID != "playlist-1" || len(items) != 1 || items[0].SegundoInicio != 90 {
		t.Fatalf("ObtenerPlaylist() = %#v, %#v", playlist, items)
	}

	db.queryRow = func(_ context.Context, sql string, args ...any) pgx.Row {
		return filaFalsa{err: pgx.ErrNoRows}
	}
	if _, _, err := repositorio.ObtenerPlaylist(context.Background(), "estudiante-1", "playlist-1"); !errors.Is(err, domain.ErrPlaylistNoEncontrada) {
		t.Fatalf("error = %v, want %v", err, domain.ErrPlaylistNoEncontrada)
	}
}

func TestObtenerPlaylistPublicaMapeaEnlaceInvalido(t *testing.T) {
	db := &dbFalsa{queryRow: func(_ context.Context, sql string, args ...any) pgx.Row {
		if !strings.Contains(sql, "p.es_publica = TRUE") {
			t.Fatalf("consulta inesperada: %q", sql)
		}
		return filaFalsa{err: pgx.ErrNoRows}
	}}
	repositorio := NewReproduccionRepository(db)
	if _, _, err := repositorio.ObtenerPlaylistPublica(context.Background(), "enlace-caido"); !errors.Is(err, domain.ErrEnlacePublicoInvalido) {
		t.Fatalf("error = %v, want %v", err, domain.ErrEnlacePublicoInvalido)
	}
}

func TestActualizarPlaylistAplicaFALECCionDeEnlace(t *testing.T) {
	var consulta string
	var argumentos []any
	db := &dbFalsa{queryRow: func(_ context.Context, sql string, args ...any) pgx.Row {
		if strings.Contains(sql, "UPDATE playlist") {
			consulta = sql
			argumentos = args
			return filaFalsa{valores: valoresPlaylist("enlace-1")}
		}
		return filaFalsa{valores: []any{int32(3)}}
	}}
	repositorio := NewReproduccionRepository(db)

	playlist, err := repositorio.ActualizarPlaylist(context.Background(), "estudiante-1", "playlist-1", "Editado", true)
	if err != nil {
		t.Fatalf("ActualizarPlaylist() error = %v", err)
	}
	if !strings.Contains(consulta, "WHEN NOT $4 THEN NULL") || !strings.Contains(consulta, "WHEN $4 AND enlace_publico IS NULL THEN gen_random_uuid()") {
		t.Fatalf("consulta sin FA-03 del enlace: %q", consulta)
	}
	if !reflect.DeepEqual(argumentos, []any{"playlist-1", "estudiante-1", "Editado", true}) {
		t.Fatalf("argumentos = %#v", argumentos)
	}
	if playlist.CantidadItems != 3 {
		t.Fatalf("CantidadItems = %d, want 3", playlist.CantidadItems)
	}

	db.queryRow = func(_ context.Context, sql string, args ...any) pgx.Row {
		if strings.Contains(sql, "UPDATE playlist") {
			return filaFalsa{err: pgx.ErrNoRows}
		}
		return nil
	}
	if _, err := repositorio.ActualizarPlaylist(context.Background(), "estudiante-1", "ajena", "Editado", true); !errors.Is(err, domain.ErrPlaylistNoEncontrada) {
		t.Fatalf("error = %v, want %v", err, domain.ErrPlaylistNoEncontrada)
	}
}

func TestEliminarPlaylistReportaFilasAfectadas(t *testing.T) {
	llamadas := 0
	db := &dbFalsa{exec: func(_ context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
		llamadas++
		if sql != "DELETE FROM playlist WHERE id = $1 AND estudiante_id = $2" {
			t.Fatalf("consulta = %q", sql)
		}
		if !reflect.DeepEqual(args, []any{"playlist-1", "estudiante-1"}) {
			t.Fatalf("argumentos = %#v", args)
		}
		if llamadas == 1 {
			return pgconn.NewCommandTag("DELETE 1"), nil
		}
		return pgconn.NewCommandTag("DELETE 0"), nil
	}}
	repositorio := NewReproduccionRepository(db)

	ok, err := repositorio.EliminarPlaylist(context.Background(), "estudiante-1", "playlist-1")
	if err != nil || !ok {
		t.Fatalf("EliminarPlaylist() = %v, %v", ok, err)
	}
	ok, err = repositorio.EliminarPlaylist(context.Background(), "estudiante-1", "playlist-1")
	if err != nil || ok {
		t.Fatalf("EliminarPlaylist() sin fila = %v, %v", ok, err)
	}
}

func TestAgregarItemPlaylistVerificaPropietarioYCalculaOrden(t *testing.T) {
	var insertarArgs []any
	db := &dbFalsa{
		queryRow: func(_ context.Context, sql string, args ...any) pgx.Row {
			switch {
			case strings.Contains(sql, "SELECT 1 FROM playlist"):
				return filaFalsa{valores: []any{1}}
			case strings.Contains(sql, "SELECT COALESCE(MAX(orden)"):
				return filaFalsa{valores: []any{int32(2)}}
			case strings.Contains(sql, "INSERT INTO playlist_item"):
				insertarArgs = args
				return filaFalsa{valores: valoresItem(3, 90)}
			case strings.Contains(sql, "SELECT COUNT(*)"):
				return filaFalsa{valores: []any{int32(3)}}
			}
			t.Fatalf("QueryRow inesperado: %q", sql)
			return nil
		},
	}
	repositorio := NewReproduccionRepository(db)

	item, cantidad, err := repositorio.AgregarItemPlaylist(context.Background(), "estudiante-1", "playlist-1", "clase-1", 90)
	if err != nil {
		t.Fatalf("AgregarItemPlaylist() error = %v", err)
	}
	if item.PlaylistItemID != "item-1" || item.Orden != 3 || cantidad != 3 {
		t.Fatalf("AgregarItemPlaylist() = %#v, %d", item, cantidad)
	}
	if !reflect.DeepEqual(insertarArgs, []any{"playlist-1", "clase-1", int32(2), int32(90)}) {
		t.Fatalf("argumentos del INSERT = %#v", insertarArgs)
	}

	db.queryRow = func(_ context.Context, sql string, args ...any) pgx.Row {
		if strings.Contains(sql, "SELECT 1 FROM playlist") {
			return filaFalsa{err: pgx.ErrNoRows}
		}
		return nil
	}
	if _, _, err := repositorio.AgregarItemPlaylist(context.Background(), "estudiante-1", "playlist-ajena", "clase-1", 0); !errors.Is(err, domain.ErrPlaylistNoEncontrada) {
		t.Fatalf("playlist ajena error = %v, want %v", err, domain.ErrPlaylistNoEncontrada)
	}
}

func TestReordenarPlaylistUsaDoblePasadaYReleeItems(t *testing.T) {
	var pasos []string
	db := &dbFalsa{
		queryRow: func(_ context.Context, sql string, args ...any) pgx.Row {
			switch {
			case strings.Contains(sql, "SELECT 1 FROM playlist"):
				return filaFalsa{valores: []any{1}}
			case strings.Contains(sql, "SELECT COUNT(*)"):
				return filaFalsa{valores: []any{int32(2)}}
			}
			t.Fatalf("QueryRow inesperado: %q", sql)
			return nil
		},
		exec: func(_ context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
			if !strings.Contains(sql, "UPDATE playlist_item SET orden = $1") {
				t.Fatalf("consulta de reorden = %q", sql)
			}
			switch orden := args[0].(type) {
			case int32:
				if orden < 0 {
					pasos = append(pasos, "negativo")
				} else {
					pasos = append(pasos, "final")
				}
			case int:
				pasos = append(pasos, "negativo")
			}
			return pgconn.NewCommandTag("UPDATE 1"), nil
		},
		query: func(_ context.Context, sql string, args ...any) (pgx.Rows, error) {
			return nuevasFilasFalsas(valoresItem(0, 0), valoresItem(1, 0)), nil
		},
	}
	repositorio := NewReproduccionRepository(db)

	items, err := repositorio.ReordenarPlaylist(context.Background(), "estudiante-1", "playlist-1", []string{"a", "b"})
	if err != nil {
		t.Fatalf("ReordenarPlaylist() error = %v", err)
	}
	wantPasos := []string{"negativo", "negativo", "final", "final"}
	if !reflect.DeepEqual(pasos, wantPasos) {
		t.Fatalf("pasos de reorden = %#v, want %#v", pasos, wantPasos)
	}
	if len(items) != 2 {
		t.Fatalf("items = %#v", items)
	}

	db.queryRow = func(_ context.Context, sql string, args ...any) pgx.Row {
		if strings.Contains(sql, "SELECT COUNT(*)") {
			return filaFalsa{valores: []any{int32(3)}}
		}
		return filaFalsa{valores: []any{1}}
	}
	if _, err := repositorio.ReordenarPlaylist(context.Background(), "estudiante-1", "playlist-1", []string{"a"}); !errors.Is(err, domain.ErrPlaylistItemNoEncontrado) {
		t.Fatalf("longitud distinta error = %v, want %v", err, domain.ErrPlaylistItemNoEncontrado)
	}
}

func TestEliminarItemPlaylistReportaFilasYTotal(t *testing.T) {
	db := &dbFalsa{
		queryRow: func(_ context.Context, sql string, args ...any) pgx.Row {
			switch {
			case strings.Contains(sql, "SELECT 1 FROM playlist"):
				return filaFalsa{valores: []any{1}}
			case strings.Contains(sql, "SELECT COUNT(*)"):
				return filaFalsa{valores: []any{int32(2)}}
			}
			return filaFalsa{valores: []any{1}}
		},
		exec: func(_ context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
			if sql != "DELETE FROM playlist_item WHERE id = $1 AND playlist_id = $2" {
				t.Fatalf("consulta = %q", sql)
			}
			return pgconn.NewCommandTag("DELETE 1"), nil
		},
	}
	repositorio := NewReproduccionRepository(db)

	eliminado, cantidad, err := repositorio.EliminarItemPlaylist(context.Background(), "estudiante-1", "playlist-1", "item-1")
	if err != nil || !eliminado || cantidad != 2 {
		t.Fatalf("EliminarItemPlaylist() = %v, %d, %v", eliminado, cantidad, err)
	}
}