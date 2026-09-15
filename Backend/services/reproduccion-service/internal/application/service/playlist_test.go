package service_test

import (
	"context"
	"strings"
	"testing"

	"yousac.com/yousac/reproduccion-service/internal/application/service"
	"yousac.com/yousac/reproduccion-service/internal/domain"
)

func TestCrearPlaylistValidaAntesDeDelegar(t *testing.T) {
	casos := []struct {
		name       string
		estudiante string
		nombre     string
	}{
		{name: "sin estudiante", nombre: "Repaso"},
		{name: "sin nombre", estudiante: "est-1"},
		{name: "nombre largo", estudiante: "est-1", nombre: strings.Repeat("a", domain.MaxNombrePlaylist+1)},
	}
	for _, tt := range casos {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{}
			_, err := service.New(repo).CrearPlaylist(context.Background(), tt.estudiante, tt.nombre, false)
			if err == nil {
				t.Fatal("se esperaba un error de validación")
			}
			if repo.crearPlaylistCalls != 0 {
				t.Fatalf("el repositorio fue invocado %d veces para una entrada inválida", repo.crearPlaylistCalls)
			}
		})
	}
}

func TestCrearPlaylistDelegaYRecuperaDeErrores(t *testing.T) {
	repo := &fakeRepository{playlist: &domain.Playlist{PlaylistID: "playlist-1", Nombre: "Repaso", EsPublica: true}}
	svc := service.New(repo)

	got, err := svc.CrearPlaylist(context.Background(), "est-1", "  Repaso  ", true)
	if err != nil {
		t.Fatalf("CrearPlaylist() error = %v", err)
	}
	if got.PlaylistID != "playlist-1" || !got.EsPublica {
		t.Fatalf("CrearPlaylist() = %#v", got)
	}
	if repo.lastEstudiante != "est-1" || repo.lastNombre != "  Repaso  " || !repo.lastEsPublica {
		t.Fatalf("argumentos delegados incorrectos: %#v", repo)
	}
}

func TestListarPlaylistsRequiereEstudiante(t *testing.T) {
	repo := &fakeRepository{playlists: []domain.Playlist{{PlaylistID: "pl-1", Nombre: "Repaso"}}}
	svc := service.New(repo)

	if _, err := svc.ListarPlaylists(context.Background(), ""); err != domain.ErrEstudianteRequerido {
		t.Fatalf("ListarPlaylists(sin estudiante) error = %v", err)
	}
	lista, err := svc.ListarPlaylists(context.Background(), "est-1")
	if err != nil || len(lista) != 1 || lista[0].PlaylistID != "pl-1" {
		t.Fatalf("ListarPlaylists() = %#v, %v", lista, err)
	}
}

func TestListarPlaylistsPublicasRequiereEstudianteYDelega(t *testing.T) {
	repo := &fakeRepository{playlists: []domain.Playlist{{PlaylistID: "pl-1", Nombre: "Compartida", EnlacePublico: "enlace-1"}}}
	svc := service.New(repo)

	if _, err := svc.ListarPlaylistsPublicas(context.Background(), ""); err != domain.ErrEstudianteRequerido {
		t.Fatalf("ListarPlaylistsPublicas(sin estudiante) error = %v", err)
	}
	lista, err := svc.ListarPlaylistsPublicas(context.Background(), "est-1")
	if err != nil || len(lista) != 1 || lista[0].EnlacePublico != "enlace-1" {
		t.Fatalf("ListarPlaylistsPublicas() = %#v, %v", lista, err)
	}
	if repo.lastEstudiante != "est-1" {
		t.Fatalf("argumentos delegados incorrectos: %#v", repo)
	}
}

func TestObtenerPlaylistYPublica(t *testing.T) {
	repo := &fakeRepository{
		playlist: &domain.Playlist{PlaylistID: "pl-1", Nombre: "Repaso"},
		items:    []domain.PlaylistItem{{PlaylistItemID: "it-1", ClaseID: "clase-1"}},
	}
	svc := service.New(repo)

	if _, _, err := svc.ObtenerPlaylist(context.Background(), "", "pl-1"); err != domain.ErrEstudianteRequerido {
		t.Fatalf("ObtenerPlaylist(sin estudiante) = %v", err)
	}
	if _, _, err := svc.ObtenerPlaylist(context.Background(), "est-1", ""); err != domain.ErrPlaylistIDRequerido {
		t.Fatalf("ObtenerPlaylist(sin playlist) = %v", err)
	}
	if _, _, err := svc.ObtenerPlaylistPublica(context.Background(), ""); err != domain.ErrEnlacePublicoInvalido {
		t.Fatalf("ObtenerPlaylistPublica(sin enlace) = %v", err)
	}

	pl, items, err := svc.ObtenerPlaylist(context.Background(), "est-1", "pl-1")
	if err != nil || pl.PlaylistID != "pl-1" || len(items) != 1 {
		t.Fatalf("ObtenerPlaylist() = %#v, %#v, %v", pl, items, err)
	}
	pub, pubItems, err := svc.ObtenerPlaylistPublica(context.Background(), "enlace-1")
	if err != nil || pub.PlaylistID != "pl-1" || len(pubItems) != 1 {
		t.Fatalf("ObtenerPlaylistPublica() = %#v, %#v, %v", pub, pubItems, err)
	}
}

func TestActualizarPlaylistValidaYDelega(t *testing.T) {
	repo := &fakeRepository{playlist: &domain.Playlist{PlaylistID: "pl-1", Nombre: "Editado"}}
	svc := service.New(repo)

	if _, err := svc.ActualizarPlaylist(context.Background(), "est-1", "", "Nombre", false); err != domain.ErrPlaylistIDRequerido {
		t.Fatalf("ActualizarPlaylist(sin playlist) = %v", err)
	}
	pl, err := svc.ActualizarPlaylist(context.Background(), "est-1", "pl-1", "Editado", true)
	if err != nil || pl.Nombre != "Editado" {
		t.Fatalf("ActualizarPlaylist() = %#v, %v", pl, err)
	}
	if repo.lastPlaylist != "pl-1" || repo.lastNombre != "Editado" || !repo.lastEsPublica {
		t.Fatalf("argumentos delegados incorrectos: %#v", repo)
	}
}

func TestEliminarPlaylistVSItem(t *testing.T) {
	repo := &fakeRepository{eliminarOk: true}
	svc := service.New(repo)

	ok, err := svc.EliminarPlaylist(context.Background(), "", "")
	if err != domain.ErrEstudianteRequerido {
		t.Fatalf("EliminarPlaylist(sin estudiante) = %v, %v", ok, err)
	}
	ok, err = svc.EliminarPlaylist(context.Background(), "est-1", "")
	if err != domain.ErrPlaylistIDRequerido {
		t.Fatalf("EliminarPlaylist(sin playlist) = %v, %v", ok, err)
	}
	ok, err = svc.EliminarPlaylist(context.Background(), "est-1", "pl-1")
	if err != nil || !ok {
		t.Fatalf("EliminarPlaylist() = %v, %v", ok, err)
	}
}

func TestAgregarItemPlaylistValida(t *testing.T) {
	casos := []struct {
		name          string
		estudiante    string
		playlistID    string
		claseID       string
		segundoInicio int32
	}{
		{name: "sin estudiante", playlistID: "pl-1", claseID: "clase-1"},
		{name: "sin playlist", estudiante: "est-1", claseID: "clase-1"},
		{name: "sin clase", estudiante: "est-1", playlistID: "pl-1"},
		{name: "segundo negativo", estudiante: "est-1", playlistID: "pl-1", claseID: "clase-1", segundoInicio: -1},
	}
	for _, tt := range casos {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{}
			_, _, err := service.New(repo).AgregarItemPlaylist(context.Background(), tt.estudiante, tt.playlistID, tt.claseID, tt.segundoInicio)
			if err == nil {
				t.Fatal("se esperaba un error de validación")
			}
			if repo.item != nil || repo.cantidadItems != 0 {
				t.Fatalf("el repositorio fue invocado para una entrada inválida: %#v", repo)
			}
		})
	}

	repo := &fakeRepository{
		item:          &domain.PlaylistItem{PlaylistItemID: "it-1", ClaseID: "clase-1", Orden: 0},
		cantidadItems: 1,
	}
	item, total, err := service.New(repo).AgregarItemPlaylist(context.Background(), "est-1", "pl-1", "clase-1", 45)
	if err != nil || item.ClaseID != "clase-1" || total != 1 {
		t.Fatalf("AgregarItemPlaylist() = %#v, %d, %v", item, total, err)
	}
	if repo.lastClaseItem != "clase-1" || repo.lastSegundoInicio != 45 {
		t.Fatalf("argumentos delegados incorrectos: %#v", repo)
	}
}

func TestReordenarPlaylistValidaListaVacia(t *testing.T) {
	repo := &fakeRepository{}
	_, err := service.New(repo).ReordenarPlaylist(context.Background(), "est-1", "pl-1", nil)
	if err != domain.ErrOrdenInvalido {
		t.Fatalf("ReordenarPlaylist(lista vacía) = %v", err)
	}
	if repo.reordenarItems != nil {
		t.Fatalf("el repositorio fue invocado para una entrada inválida")
	}

	repo.items = []domain.PlaylistItem{{PlaylistItemID: "b"}, {PlaylistItemID: "a"}}
	_, err = service.New(repo).ReordenarPlaylist(context.Background(), "est-1", "pl-1", []string{"a", "b"})
	if err != nil {
		t.Fatalf("ReordenarPlaylist() error = %v", err)
	}
	if len(repo.reordenarItems) != 2 || repo.reordenarItems[0] != "a" {
		t.Fatalf("argumentos delegados incorrectos: %#v", repo.reordenarItems)
	}
}

func TestEliminarItemPlaylistValida(t *testing.T) {
	repo := &fakeRepository{}
	svc := service.New(repo)

	if _, _, err := svc.EliminarItemPlaylist(context.Background(), "", "pl-1", "it-1"); err != domain.ErrEstudianteRequerido {
		t.Fatalf("EliminarItemPlaylist(sin estudiante) = %v", err)
	}
	if _, _, err := svc.EliminarItemPlaylist(context.Background(), "est-1", "", "it-1"); err != domain.ErrPlaylistIDRequerido {
		t.Fatalf("EliminarItemPlaylist(sin playlist) = %v", err)
	}
	if _, _, err := svc.EliminarItemPlaylist(context.Background(), "est-1", "pl-1", ""); err != domain.ErrPlaylistItemRequerido {
		t.Fatalf("EliminarItemPlaylist(sin item) = %v", err)
	}

	repo.eliminarOk = true
	repo.cantidadItems = 1
	ok, total, err := svc.EliminarItemPlaylist(context.Background(), "est-1", "pl-1", "it-1")
	if err != nil || !ok || total != 1 {
		t.Fatalf("EliminarItemPlaylist() = %v, %d, %v", ok, total, err)
	}
}