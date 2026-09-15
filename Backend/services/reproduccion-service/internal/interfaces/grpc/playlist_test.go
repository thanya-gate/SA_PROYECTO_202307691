package grpc

import (
	"context"
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"yousac.com/yousac/reproduccion-service/gen/reproduccionv1"
	"yousac.com/yousac/reproduccion-service/internal/application/service"
	"yousac.com/yousac/reproduccion-service/internal/domain"
)

func TestServerPlaylistsExponeRespuestasYMapeaErrores(t *testing.T) {
	repo := &grpcFakeRepository{
		playlist: &domain.Playlist{PlaylistID: "playlist-1", EstudianteID: "est-1", Nombre: "Repaso", EsPublica: true, EnlacePublico: "enlace-1", CantidadItems: 1},
		items: []domain.PlaylistItem{
			{PlaylistItemID: "item-1", ClaseID: "clase-1", Orden: 0, SegundoInicio: 0},
		},
		playlists: []domain.Playlist{{PlaylistID: "playlist-1", EstudianteID: "est-1", Nombre: "Repaso", EnlacePublico: "enlace-1"}},
	}
	server := New(service.New(repo), "test-version")

	creada, err := server.CrearPlaylist(context.Background(), &reproduccionv1.CrearPlaylistRequest{
		EstudianteId: "est-1", Nombre: "Repaso", EsPublica: true,
	})
	if err != nil || creada.GetPlaylist().GetPlaylistId() != "playlist-1" || !creada.GetPlaylist().GetEsPublica() || creada.GetPlaylist().GetEnlacePublico() != "enlace-1" {
		t.Fatalf("CrearPlaylist() = %#v, %v", creada, err)
	}

	lista, err := server.ListarPlaylists(context.Background(), &reproduccionv1.ListarPlaylistsRequest{EstudianteId: "est-1"})
	if err != nil || len(lista.GetPlaylists()) != 1 || lista.GetPlaylists()[0].GetPlaylistId() != "playlist-1" {
		t.Fatalf("ListarPlaylists() = %#v, %v", lista, err)
	}

	publicas, err := server.ListarPlaylistsPublicas(context.Background(), &reproduccionv1.ListarPlaylistsPublicasRequest{EstudianteId: "est-1"})
	if err != nil || len(publicas.GetPlaylists()) != 1 ||
		publicas.GetPlaylists()[0].GetPlaylistId() != "playlist-1" || publicas.GetPlaylists()[0].GetEnlacePublico() != "enlace-1" {
		t.Fatalf("ListarPlaylistsPublicas() = %#v, %v", publicas, err)
	}

	detalle, err := server.ObtenerPlaylist(context.Background(), &reproduccionv1.ObtenerPlaylistRequest{EstudianteId: "est-1", PlaylistId: "playlist-1"})
	if err != nil || detalle.GetPlaylist().GetPlaylistId() != "playlist-1" || len(detalle.GetItems()) != 1 || detalle.GetItems()[0].GetClaseId() != "clase-1" {
		t.Fatalf("ObtenerPlaylist() = %#v, %v", detalle, err)
	}

	publica, err := server.ObtenerPlaylistPublica(context.Background(), &reproduccionv1.ObtenerPlaylistPublicaRequest{EnlacePublico: "enlace-1"})
	if err != nil || publica.GetPlaylist().GetEsPublica() != true || len(publica.GetItems()) != 1 {
		t.Fatalf("ObtenerPlaylistPublica() = %#v, %v", publica, err)
	}

	actualizada, err := server.ActualizarPlaylist(context.Background(), &reproduccionv1.ActualizarPlaylistRequest{
		EstudianteId: "est-1", PlaylistId: "playlist-1", Nombre: "Editado", EsPublica: false,
	})
	if err != nil || actualizada.GetPlaylist().GetNombre() != "Editado" || actualizada.GetPlaylist().GetEsPublica() != false {
		t.Fatalf("ActualizarPlaylist() = %#v, %v", actualizada, err)
	}

	eliminada, err := server.EliminarPlaylist(context.Background(), &reproduccionv1.EliminarPlaylistRequest{EstudianteId: "est-1", PlaylistId: "playlist-1"})
	if err != nil || !eliminada.GetEliminada() {
		t.Fatalf("EliminarPlaylist() = %#v, %v", eliminada, err)
	}

	item, err := server.AgregarItemPlaylist(context.Background(), &reproduccionv1.AgregarItemPlaylistRequest{
		EstudianteId: "est-1", PlaylistId: "playlist-1", ClaseId: "clase-1", SegundoInicio: 90,
	})
	if err != nil || item.GetItem().GetPlaylistItemId() != "item-1" || item.GetItem().GetClaseId() != "clase-1" || item.GetCantidadItems() != 1 {
		t.Fatalf("AgregarItemPlaylist() = %#v, %v", item, err)
	}

	reorden, err := server.ReordenarPlaylist(context.Background(), &reproduccionv1.ReordenarPlaylistRequest{
		EstudianteId: "est-1", PlaylistId: "playlist-1", ItemsOrdenados: []string{"item-1"},
	})
	if err != nil || len(reorden.GetItems()) != 1 {
		t.Fatalf("ReordenarPlaylist() = %#v, %v", reorden, err)
	}

	retiro, err := server.EliminarItemPlaylist(context.Background(), &reproduccionv1.EliminarItemPlaylistRequest{
		EstudianteId: "est-1", PlaylistId: "playlist-1", PlaylistItemId: "item-1",
	})
	if err != nil || !retiro.GetEliminado() || retiro.GetCantidadItems() != 1 {
		t.Fatalf("EliminarItemPlaylist() = %#v, %v", retiro, err)
	}
}

func TestServerPlaylistsValidaEntradaConInvalidArgument(t *testing.T) {
	server := New(service.New(&grpcFakeRepository{}), "test")

	tests := []struct {
		name string
		call func() error
	}{
		{name: "crear sin estudiante", call: func() error {
			_, err := server.CrearPlaylist(context.Background(), &reproduccionv1.CrearPlaylistRequest{Nombre: "Repaso"})
			return err
		}},
		{name: "crear sin nombre", call: func() error {
			_, err := server.CrearPlaylist(context.Background(), &reproduccionv1.CrearPlaylistRequest{EstudianteId: "est-1"})
			return err
		}},
		{name: "listar sin estudiante", call: func() error {
			_, err := server.ListarPlaylists(context.Background(), &reproduccionv1.ListarPlaylistsRequest{})
			return err
		}},
		{name: "listar públicas sin estudiante", call: func() error {
			_, err := server.ListarPlaylistsPublicas(context.Background(), &reproduccionv1.ListarPlaylistsPublicasRequest{})
			return err
		}},
		{name: "detalle sin playlist", call: func() error {
			_, err := server.ObtenerPlaylist(context.Background(), &reproduccionv1.ObtenerPlaylistRequest{EstudianteId: "est-1"})
			return err
		}},
		{name: "agregar item sin clase", call: func() error {
			_, err := server.AgregarItemPlaylist(context.Background(), &reproduccionv1.AgregarItemPlaylistRequest{
				EstudianteId: "est-1", PlaylistId: "playlist-1",
			})
			return err
		}},
		{name: "agregar item con segundo negativo", call: func() error {
			_, err := server.AgregarItemPlaylist(context.Background(), &reproduccionv1.AgregarItemPlaylistRequest{
				EstudianteId: "est-1", PlaylistId: "playlist-1", ClaseId: "clase-1", SegundoInicio: -5,
			})
			return err
		}},
		{name: "reordenar con lista vacía", call: func() error {
			_, err := server.ReordenarPlaylist(context.Background(), &reproduccionv1.ReordenarPlaylistRequest{
				EstudianteId: "est-1", PlaylistId: "playlist-1",
			})
			return err
		}},
		{name: "retirar item sin identificador", call: func() error {
			_, err := server.EliminarItemPlaylist(context.Background(), &reproduccionv1.EliminarItemPlaylistRequest{
				EstudianteId: "est-1", PlaylistId: "playlist-1",
			})
			return err
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if code := status.Code(tt.call()); code != codes.InvalidArgument {
				t.Fatalf("status = %s, se esperaba InvalidArgument", code)
			}
		})
	}
}

func TestServerPlaylistsMapeaNoEncontrado(t *testing.T) {
	repo := &grpcFakeRepository{readErr: domain.ErrPlaylistNoEncontrada}
	server := New(service.New(repo), "test")

	if _, err := server.ObtenerPlaylist(context.Background(), &reproduccionv1.ObtenerPlaylistRequest{
		EstudianteId: "est-1", PlaylistId: "inexistente",
	}); status.Code(err) != codes.NotFound {
		t.Fatalf("ObtenerPlaylist inexistente status = %s, se esperaba NotFound", status.Code(err))
	}

	// Sin enlace no se consulta el repositorio; el dominio lo rechaza y la
	// capa gRPC lo traduce a NotFound (enlace inválido/caído).
	serverSinEnlace := New(service.New(&grpcFakeRepository{}), "test")
	if _, err := serverSinEnlace.ObtenerPlaylistPublica(context.Background(), &reproduccionv1.ObtenerPlaylistPublicaRequest{}); status.Code(err) != codes.NotFound {
		t.Fatalf("ObtenerPlaylistPublica sin enlace status = %s, se esperaba NotFound", status.Code(err))
	}

	repoPublica := &grpcFakeRepository{readErr: domain.ErrEnlacePublicoInvalido}
	serverPublica := New(service.New(repoPublica), "test")
	if _, err := serverPublica.ObtenerPlaylistPublica(context.Background(), &reproduccionv1.ObtenerPlaylistPublicaRequest{
		EnlacePublico: "enlace-caido",
	}); status.Code(err) != codes.NotFound {
		t.Fatalf("ObtenerPlaylistPublica con enlace inválido status = %s, se esperaba NotFound", status.Code(err))
	}
}

func TestMapErrorPlaylists(t *testing.T) {
	tests := []struct {
		err  error
		code codes.Code
	}{
		{domain.ErrPlaylistNombreRequerido, codes.InvalidArgument},
		{domain.ErrPlaylistNombreLargo, codes.InvalidArgument},
		{domain.ErrPlaylistIDRequerido, codes.InvalidArgument},
		{domain.ErrPlaylistItemRequerido, codes.InvalidArgument},
		{domain.ErrOrdenInvalido, codes.InvalidArgument},
		{domain.ErrPlaylistNoEncontrada, codes.NotFound},
		{domain.ErrPlaylistItemNoEncontrado, codes.NotFound},
		{domain.ErrEnlacePublicoInvalido, codes.NotFound},
	}
	for _, tt := range tests {
		if got := status.Code(mapError(tt.err)); got != tt.code {
			t.Errorf("mapError(%v) = %s, want %s", tt.err, got, tt.code)
		}
	}
}