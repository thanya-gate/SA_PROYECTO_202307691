package grpc

import (
	"context"

	"yousac.com/yousac/reproduccion-service/gen/reproduccionv1"
	"yousac.com/yousac/reproduccion-service/internal/domain"
)

func (s *Server) CrearPlaylist(ctx context.Context, req *reproduccionv1.CrearPlaylistRequest) (*reproduccionv1.CrearPlaylistResponse, error) {
	playlist, err := s.svc.CrearPlaylist(ctx, req.GetEstudianteId(), req.GetNombre(), req.GetEsPublica())
	if err != nil {
		return nil, mapError(err)
	}
	return &reproduccionv1.CrearPlaylistResponse{Playlist: toProtoPlaylist(playlist)}, nil
}

func (s *Server) ListarPlaylists(ctx context.Context, req *reproduccionv1.ListarPlaylistsRequest) (*reproduccionv1.ListarPlaylistsResponse, error) {
	playlists, err := s.svc.ListarPlaylists(ctx, req.GetEstudianteId())
	if err != nil {
		return nil, mapError(err)
	}
	protoPlaylists := make([]*reproduccionv1.Playlist, 0, len(playlists))
	for i := range playlists {
		protoPlaylists = append(protoPlaylists, toProtoPlaylist(&playlists[i]))
	}
	return &reproduccionv1.ListarPlaylistsResponse{Playlists: protoPlaylists}, nil
}

func (s *Server) ListarPlaylistsPublicas(ctx context.Context, req *reproduccionv1.ListarPlaylistsPublicasRequest) (*reproduccionv1.ListarPlaylistsPublicasResponse, error) {
	playlists, err := s.svc.ListarPlaylistsPublicas(ctx, req.GetEstudianteId())
	if err != nil {
		return nil, mapError(err)
	}
	protoPlaylists := make([]*reproduccionv1.PlaylistPublica, 0, len(playlists))
	for i := range playlists {
		protoPlaylists = append(protoPlaylists, &reproduccionv1.PlaylistPublica{
			PlaylistId:         playlists[i].PlaylistID,
			EstudianteId:       playlists[i].EstudianteID,
			Nombre:             playlists[i].Nombre,
			CantidadItems:      playlists[i].CantidadItems,
			FechaActualizacion: playlists[i].FechaActualizacion,
			EnlacePublico:      playlists[i].EnlacePublico,
			ClasePortada:       playlists[i].ClasePortada,
		})
	}
	return &reproduccionv1.ListarPlaylistsPublicasResponse{Playlists: protoPlaylists}, nil
}

func (s *Server) ObtenerPlaylist(ctx context.Context, req *reproduccionv1.ObtenerPlaylistRequest) (*reproduccionv1.ObtenerPlaylistResponse, error) {
	playlist, items, err := s.svc.ObtenerPlaylist(ctx, req.GetEstudianteId(), req.GetPlaylistId())
	if err != nil {
		return nil, mapError(err)
	}
	return &reproduccionv1.ObtenerPlaylistResponse{
		Playlist: toProtoPlaylist(playlist),
		Items:    toProtoPlaylistItems(items),
	}, nil
}

func (s *Server) ObtenerPlaylistPublica(ctx context.Context, req *reproduccionv1.ObtenerPlaylistPublicaRequest) (*reproduccionv1.ObtenerPlaylistResponse, error) {
	playlist, items, err := s.svc.ObtenerPlaylistPublica(ctx, req.GetEnlacePublico())
	if err != nil {
		return nil, mapError(err)
	}
	return &reproduccionv1.ObtenerPlaylistResponse{
		Playlist: toProtoPlaylist(playlist),
		Items:    toProtoPlaylistItems(items),
	}, nil
}

func (s *Server) ActualizarPlaylist(ctx context.Context, req *reproduccionv1.ActualizarPlaylistRequest) (*reproduccionv1.ActualizarPlaylistResponse, error) {
	playlist, err := s.svc.ActualizarPlaylist(ctx, req.GetEstudianteId(), req.GetPlaylistId(), req.GetNombre(), req.GetEsPublica())
	if err != nil {
		return nil, mapError(err)
	}
	return &reproduccionv1.ActualizarPlaylistResponse{Playlist: toProtoPlaylist(playlist)}, nil
}

func (s *Server) EliminarPlaylist(ctx context.Context, req *reproduccionv1.EliminarPlaylistRequest) (*reproduccionv1.EliminarPlaylistResponse, error) {
	eliminada, err := s.svc.EliminarPlaylist(ctx, req.GetEstudianteId(), req.GetPlaylistId())
	if err != nil {
		return nil, mapError(err)
	}
	return &reproduccionv1.EliminarPlaylistResponse{Eliminada: eliminada}, nil
}

func (s *Server) AgregarItemPlaylist(ctx context.Context, req *reproduccionv1.AgregarItemPlaylistRequest) (*reproduccionv1.AgregarItemPlaylistResponse, error) {
	item, cantidad, err := s.svc.AgregarItemPlaylist(ctx, req.GetEstudianteId(), req.GetPlaylistId(), req.GetClaseId(), req.GetSegundoInicio())
	if err != nil {
		return nil, mapError(err)
	}
	return &reproduccionv1.AgregarItemPlaylistResponse{
		Item:          toProtoPlaylistItem(item),
		CantidadItems: cantidad,
	}, nil
}

func (s *Server) ReordenarPlaylist(ctx context.Context, req *reproduccionv1.ReordenarPlaylistRequest) (*reproduccionv1.ReordenarPlaylistResponse, error) {
	items, err := s.svc.ReordenarPlaylist(ctx, req.GetEstudianteId(), req.GetPlaylistId(), req.GetItemsOrdenados())
	if err != nil {
		return nil, mapError(err)
	}
	return &reproduccionv1.ReordenarPlaylistResponse{Items: toProtoPlaylistItems(items)}, nil
}

func (s *Server) EliminarItemPlaylist(ctx context.Context, req *reproduccionv1.EliminarItemPlaylistRequest) (*reproduccionv1.EliminarItemPlaylistResponse, error) {
	eliminado, cantidad, err := s.svc.EliminarItemPlaylist(ctx, req.GetEstudianteId(), req.GetPlaylistId(), req.GetPlaylistItemId())
	if err != nil {
		return nil, mapError(err)
	}
	return &reproduccionv1.EliminarItemPlaylistResponse{
		Eliminado:     eliminado,
		CantidadItems: cantidad,
	}, nil
}

func toProtoPlaylist(p *domain.Playlist) *reproduccionv1.Playlist {
	if p == nil {
		return nil
	}
	return &reproduccionv1.Playlist{
		PlaylistId:         p.PlaylistID,
		EstudianteId:       p.EstudianteID,
		Nombre:             p.Nombre,
		EsPublica:          p.EsPublica,
		EnlacePublico:      p.EnlacePublico,
		CantidadItems:      p.CantidadItems,
		FechaCreacion:      p.FechaCreacion,
		FechaActualizacion: p.FechaActualizacion,
		ClasePortada:       p.ClasePortada,
	}
}

func toProtoPlaylistItem(item *domain.PlaylistItem) *reproduccionv1.PlaylistItem {
	if item == nil {
		return nil
	}
	return &reproduccionv1.PlaylistItem{
		PlaylistItemId: item.PlaylistItemID,
		ClaseId:        item.ClaseID,
		Orden:          item.Orden,
		SegundoInicio:  item.SegundoInicio,
		FechaAgregado:  item.FechaAgregado,
	}
}

func toProtoPlaylistItems(items []domain.PlaylistItem) []*reproduccionv1.PlaylistItem {
	protoItems := make([]*reproduccionv1.PlaylistItem, 0, len(items))
	for i := range items {
		protoItems = append(protoItems, toProtoPlaylistItem(&items[i]))
	}
	return protoItems
}