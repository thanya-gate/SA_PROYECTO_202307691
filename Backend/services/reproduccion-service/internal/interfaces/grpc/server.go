package grpc

import (
	"context"
	"errors"
	"log"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"yousac.com/yousac/reproduccion-service/gen/reproduccionv1"
	"yousac.com/yousac/reproduccion-service/internal/application/service"
	"yousac.com/yousac/reproduccion-service/internal/domain"
)

type Server struct {
	reproduccionv1.UnimplementedReproduccionServiceServer
	svc     *service.ReproduccionService
	version string
}

func New(svc *service.ReproduccionService, version string) *Server {
	return &Server{svc: svc, version: version}
}

func (s *Server) Health(_ context.Context, _ *reproduccionv1.HealthRequest) (*reproduccionv1.HealthResponse, error) {
	return &reproduccionv1.HealthResponse{
		Status:  "SERVING",
		Service: "reproduccion-service",
		Version: s.version,
	}, nil
}

func (s *Server) GuardarCheckpoint(ctx context.Context, req *reproduccionv1.GuardarCheckpointRequest) (*reproduccionv1.GuardarCheckpointResponse, error) {
	historialID, porcentajeAvance, err := s.svc.GuardarCheckpoint(ctx,
		req.GetEstudianteId(), req.GetClaseId(), req.GetSegundoActual(), req.GetDuracion())
	if err != nil {
		return nil, mapError(err)
	}
	return &reproduccionv1.GuardarCheckpointResponse{
		HistorialId:      historialID,
		PorcentajeAvance: porcentajeAvance,
	}, nil
}

func (s *Server) ObtenerCheckpoint(ctx context.Context, req *reproduccionv1.ObtenerCheckpointRequest) (*reproduccionv1.ObtenerCheckpointResponse, error) {
	cp, err := s.svc.ObtenerCheckpoint(ctx, req.GetEstudianteId(), req.GetClaseId())
	if err != nil {
		return nil, mapError(err)
	}
	if cp == nil {
		return &reproduccionv1.ObtenerCheckpointResponse{}, nil
	}
	return &reproduccionv1.ObtenerCheckpointResponse{
		Checkpoint: &reproduccionv1.Checkpoint{
			HistorialId:        cp.HistorialID,
			ClaseId:            cp.ClaseID,
			SegundoActual:      cp.SegundoActual,
			Duracion:           cp.Duracion,
			PorcentajeAvance:   cp.PorcentajeAvance,
			FechaActualizacion: cp.FechaActualizacion,
		},
	}, nil
}

func (s *Server) HistorialReciente(ctx context.Context, req *reproduccionv1.HistorialRecienteRequest) (*reproduccionv1.HistorialRecienteResponse, error) {
	items, err := s.svc.HistorialReciente(ctx, req.GetEstudianteId())
	if err != nil {
		return nil, mapError(err)
	}
	protoItems := make([]*reproduccionv1.HistorialItem, 0, len(items))
	for _, item := range items {
		protoItems = append(protoItems, &reproduccionv1.HistorialItem{
			ClaseId:                  item.ClaseID,
			FechaUltimaVisualizacion: item.FechaUltimaVisualizacion,
			SegundoActual:            item.SegundoActual,
			Duracion:                 item.Duracion,
			PorcentajeAvance:         item.PorcentajeAvance,
			TieneCheckpoint:          item.TieneCheckpoint,
		})
	}
	return &reproduccionv1.HistorialRecienteResponse{Items: protoItems}, nil
}

func (s *Server) RegistrarCalificacion(ctx context.Context, req *reproduccionv1.RegistrarCalificacionRequest) (*reproduccionv1.RegistrarCalificacionResponse, error) {
	if err := s.svc.RegistrarCalificacion(ctx, req.GetHistorialId(), req.GetPuntuacion(), req.GetComentario()); err != nil {
		return nil, mapError(err)
	}
	return &reproduccionv1.RegistrarCalificacionResponse{Registrada: true}, nil
}

func (s *Server) GuardarApunte(ctx context.Context, req *reproduccionv1.GuardarApunteRequest) (*reproduccionv1.GuardarApunteResponse, error) {
	apunte, err := s.svc.GuardarApunte(ctx, req.GetEstudianteId(), req.GetClaseId(), req.GetTitulo(), req.GetContenidoMarkdown())
	if err != nil {
		return nil, mapError(err)
	}
	return &reproduccionv1.GuardarApunteResponse{Apunte: toProtoApunte(apunte)}, nil
}

func (s *Server) ObtenerApunte(ctx context.Context, req *reproduccionv1.ObtenerApunteRequest) (*reproduccionv1.ObtenerApunteResponse, error) {
	apunte, err := s.svc.ObtenerApunte(ctx, req.GetEstudianteId(), req.GetClaseId())
	if err != nil {
		return nil, mapError(err)
	}
	if apunte == nil {
		return &reproduccionv1.ObtenerApunteResponse{}, nil
	}
	return &reproduccionv1.ObtenerApunteResponse{Apunte: toProtoApunte(apunte)}, nil
}

func (s *Server) ListarApuntes(ctx context.Context, req *reproduccionv1.ListarApuntesRequest) (*reproduccionv1.ListarApuntesResponse, error) {
	apuntes, err := s.svc.ListarApuntes(ctx, req.GetEstudianteId())
	if err != nil {
		return nil, mapError(err)
	}
	protoApuntes := make([]*reproduccionv1.Apunte, 0, len(apuntes))
	for i := range apuntes {
		protoApuntes = append(protoApuntes, toProtoApunte(&apuntes[i]))
	}
	return &reproduccionv1.ListarApuntesResponse{Apuntes: protoApuntes}, nil
}

func (s *Server) EliminarApunte(ctx context.Context, req *reproduccionv1.EliminarApunteRequest) (*reproduccionv1.EliminarApunteResponse, error) {
	eliminado, err := s.svc.EliminarApunte(ctx, req.GetEstudianteId(), req.GetClaseId())
	if err != nil {
		return nil, mapError(err)
	}
	return &reproduccionv1.EliminarApunteResponse{Eliminado: eliminado}, nil
}

func (s *Server) ExportarApunteMd(ctx context.Context, req *reproduccionv1.ExportarApunteMdRequest) (*reproduccionv1.ExportarApunteMdResponse, error) {
	archivo, err := s.svc.ExportarApunteMd(ctx, req.GetEstudianteId(), req.GetClaseId())
	if err != nil {
		return nil, mapError(err)
	}
	return &reproduccionv1.ExportarApunteMdResponse{
		NombreArchivo: archivo.NombreArchivo,
		ContenidoMd:   archivo.ContenidoMD,
		MimeType:      archivo.MimeType,
	}, nil
}

func toProtoApunte(a *domain.Apunte) *reproduccionv1.Apunte {
	if a == nil {
		return nil
	}
	return &reproduccionv1.Apunte{
		ApunteId:           a.ApunteID,
		EstudianteId:       a.EstudianteID,
		ClaseId:            a.ClaseID,
		Titulo:             a.Titulo,
		ContenidoMarkdown:  a.ContenidoMarkdown,
		FechaCreacion:      a.FechaCreacion,
		FechaActualizacion: a.FechaActualizacion,
	}
}

func mapError(err error) error {
	switch {
	case errors.Is(err, domain.ErrEstudianteRequerido),
		errors.Is(err, domain.ErrClaseRequerida),
		errors.Is(err, domain.ErrSegundoInvalido),
		errors.Is(err, domain.ErrDuracionInvalida),
		errors.Is(err, domain.ErrHistorialNoEncontrado),
		errors.Is(err, domain.ErrPuntuacionInvalida),
		errors.Is(err, domain.ErrApunteTituloRequerido),
		errors.Is(err, domain.ErrApunteContenidoRequerido),
		errors.Is(err, domain.ErrMarcadorTiempoInvalido),
		errors.Is(err, domain.ErrTituloMuyLargo):
		return status.Error(codes.InvalidArgument, err.Error())
	case errors.Is(err, domain.ErrApunteNoEncontrado):
		return status.Error(codes.NotFound, err.Error())
	default:
		log.Printf("[reproduccion-service] error no mapeado: %v", err)
		return status.Error(codes.Internal, "ERROR_INTERNO: no se pudo completar la operación")
	}
}
