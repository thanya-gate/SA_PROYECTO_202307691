package service

import (
	"context"

	"yousac.com/yousac/reproduccion-service/internal/domain"
)

func (s *ReproduccionService) CrearPlaylist(ctx context.Context, estudianteID, nombre string, esPublica bool) (*domain.Playlist, error) {
	if err := domain.ValidarPlaylist(estudianteID, nombre); err != nil {
		return nil, err
	}
	return s.repo.CrearPlaylist(ctx, estudianteID, nombre, esPublica)
}

func (s *ReproduccionService) ListarPlaylists(ctx context.Context, estudianteID string) ([]domain.Playlist, error) {
	if estudianteID == "" {
		return nil, domain.ErrEstudianteRequerido
	}
	return s.repo.ListarPlaylists(ctx, estudianteID)
}

func (s *ReproduccionService) ListarPlaylistsPublicas(ctx context.Context, estudianteID string) ([]domain.Playlist, error) {
	if estudianteID == "" {
		return nil, domain.ErrEstudianteRequerido
	}
	return s.repo.ListarPlaylistsPublicas(ctx, estudianteID)
}

func (s *ReproduccionService) ObtenerPlaylist(ctx context.Context, estudianteID, playlistID string) (*domain.Playlist, []domain.PlaylistItem, error) {
	if estudianteID == "" {
		return nil, nil, domain.ErrEstudianteRequerido
	}
	if playlistID == "" {
		return nil, nil, domain.ErrPlaylistIDRequerido
	}
	return s.repo.ObtenerPlaylist(ctx, estudianteID, playlistID)
}

func (s *ReproduccionService) ObtenerPlaylistPublica(ctx context.Context, enlacePublico string) (*domain.Playlist, []domain.PlaylistItem, error) {
	if enlacePublico == "" {
		return nil, nil, domain.ErrEnlacePublicoInvalido
	}
	return s.repo.ObtenerPlaylistPublica(ctx, enlacePublico)
}

func (s *ReproduccionService) ActualizarPlaylist(ctx context.Context, estudianteID, playlistID, nombre string, esPublica bool) (*domain.Playlist, error) {
	if err := domain.ValidarPlaylist(estudianteID, nombre); err != nil {
		return nil, err
	}
	if playlistID == "" {
		return nil, domain.ErrPlaylistIDRequerido
	}
	return s.repo.ActualizarPlaylist(ctx, estudianteID, playlistID, nombre, esPublica)
}

func (s *ReproduccionService) EliminarPlaylist(ctx context.Context, estudianteID, playlistID string) (bool, error) {
	if estudianteID == "" {
		return false, domain.ErrEstudianteRequerido
	}
	if playlistID == "" {
		return false, domain.ErrPlaylistIDRequerido
	}
	return s.repo.EliminarPlaylist(ctx, estudianteID, playlistID)
}

func (s *ReproduccionService) AgregarItemPlaylist(ctx context.Context, estudianteID, playlistID, claseID string, segundoInicio int32) (*domain.PlaylistItem, int32, error) {
	if estudianteID == "" {
		return nil, 0, domain.ErrEstudianteRequerido
	}
	if err := domain.ValidarItemPlaylist(playlistID, claseID, segundoInicio); err != nil {
		return nil, 0, err
	}
	return s.repo.AgregarItemPlaylist(ctx, estudianteID, playlistID, claseID, segundoInicio)
}

func (s *ReproduccionService) ReordenarPlaylist(ctx context.Context, estudianteID, playlistID string, itemsOrdenados []string) ([]domain.PlaylistItem, error) {
	if estudianteID == "" {
		return nil, domain.ErrEstudianteRequerido
	}
	if playlistID == "" {
		return nil, domain.ErrPlaylistIDRequerido
	}
	if len(itemsOrdenados) == 0 {
		return nil, domain.ErrOrdenInvalido
	}
	return s.repo.ReordenarPlaylist(ctx, estudianteID, playlistID, itemsOrdenados)
}

func (s *ReproduccionService) EliminarItemPlaylist(ctx context.Context, estudianteID, playlistID, playlistItemID string) (bool, int32, error) {
	if estudianteID == "" {
		return false, 0, domain.ErrEstudianteRequerido
	}
	if playlistID == "" {
		return false, 0, domain.ErrPlaylistIDRequerido
	}
	if playlistItemID == "" {
		return false, 0, domain.ErrPlaylistItemRequerido
	}
	return s.repo.EliminarItemPlaylist(ctx, estudianteID, playlistID, playlistItemID)
}