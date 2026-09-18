package ports

import (
	"context"

	"yousac.com/yousac/reproduccion-service/internal/domain"
)

type ReproduccionRepository interface {
	GuardarCheckpoint(ctx context.Context, estudianteID, claseID string, segundoActual, duracion int32) (historialID string, porcentajeAvance float64, err error)
	ObtenerCheckpoint(ctx context.Context, estudianteID, claseID string) (*domain.Checkpoint, error)
	HistorialReciente(ctx context.Context, estudianteID string) ([]domain.HistorialItem, error)
	RegistrarCalificacion(ctx context.Context, historialID string, puntuacion int32, comentario string) error

	GuardarApunte(ctx context.Context, estudianteID, apunteID, claseID, titulo, contenidoMarkdown string, posicionSegundos int32) (*domain.Apunte, error)
	ListarApuntes(ctx context.Context, estudianteID, claseID string) ([]domain.Apunte, error)
	EliminarApunte(ctx context.Context, estudianteID, apunteID string) (bool, error)

	CrearPlaylist(ctx context.Context, estudianteID, nombre string, esPublica bool) (*domain.Playlist, error)
	ListarPlaylists(ctx context.Context, estudianteID string) ([]domain.Playlist, error)
	ListarPlaylistsPublicas(ctx context.Context, estudianteID string) ([]domain.Playlist, error)
	ObtenerPlaylist(ctx context.Context, estudianteID, playlistID string) (*domain.Playlist, []domain.PlaylistItem, error)
	ObtenerPlaylistPublica(ctx context.Context, enlacePublico string) (*domain.Playlist, []domain.PlaylistItem, error)
	ActualizarPlaylist(ctx context.Context, estudianteID, playlistID, nombre string, esPublica bool) (*domain.Playlist, error)
	EliminarPlaylist(ctx context.Context, estudianteID, playlistID string) (bool, error)
	AgregarItemPlaylist(ctx context.Context, estudianteID, playlistID, claseID string, segundoInicio int32) (*domain.PlaylistItem, int32, error)
	ReordenarPlaylist(ctx context.Context, estudianteID, playlistID string, itemsOrdenados []string) ([]domain.PlaylistItem, error)
	EliminarItemPlaylist(ctx context.Context, estudianteID, playlistID, playlistItemID string) (bool, int32, error)

	Ping(ctx context.Context) error
}
