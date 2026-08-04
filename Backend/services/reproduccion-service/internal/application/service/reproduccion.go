package service

import (
	"context"

	"yousac.com/yousac/reproduccion-service/internal/application/ports"
	"yousac.com/yousac/reproduccion-service/internal/domain"
)

// ReproduccionService es la capa de aplicación (casos de uso del módulo 5).
type ReproduccionService struct {
	repo ports.ReproduccionRepository
}

func New(repo ports.ReproduccionRepository) *ReproduccionService {
	return &ReproduccionService{repo: repo}
}

// GuardarCheckpoint (CDU0005.2): registra el segundo exacto de pausa.
func (s *ReproduccionService) GuardarCheckpoint(ctx context.Context, estudianteID, claseID string, segundoActual, duracion int32) (string, float64, error) {
	if err := domain.ValidarCheckpoint(estudianteID, claseID, segundoActual, duracion); err != nil {
		return "", 0, err
	}
	return s.repo.GuardarCheckpoint(ctx, estudianteID, claseID, segundoActual, duracion)
}

// ObtenerCheckpoint (CDU0005.3): reanuda la reproducción desde el punto guardado.
func (s *ReproduccionService) ObtenerCheckpoint(ctx context.Context, estudianteID, claseID string) (*domain.Checkpoint, error) {
	if err := domain.ValidarCheckpoint(estudianteID, claseID, 0, 0); err != nil {
		return nil, err
	}
	return s.repo.ObtenerCheckpoint(ctx, estudianteID, claseID)
}

// HistorialReciente (CDU0005.4): consulta la reproducción reciente.
func (s *ReproduccionService) HistorialReciente(ctx context.Context, estudianteID string) ([]domain.HistorialItem, error) {
	if estudianteID == "" {
		return nil, domain.ErrEstudianteRequerido
	}
	return s.repo.HistorialReciente(ctx, estudianteID)
}

// RegistrarCalificacion: valoración 1..5 de una clase ya reproducida.
func (s *ReproduccionService) RegistrarCalificacion(ctx context.Context, historialID string, puntuacion int32, comentario string) error {
	if historialID == "" {
		return domain.ErrHistorialNoEncontrado
	}
	if err := domain.ValidarCalificacion(puntuacion); err != nil {
		return err
	}
	return s.repo.RegistrarCalificacion(ctx, historialID, puntuacion, comentario)
}
