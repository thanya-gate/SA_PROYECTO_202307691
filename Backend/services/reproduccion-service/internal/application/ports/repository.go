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
	Ping(ctx context.Context) error
}
