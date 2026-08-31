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

	GuardarApunte(ctx context.Context, estudianteID, claseID, titulo, contenidoMarkdown string) (*domain.Apunte, error)
	ObtenerApunte(ctx context.Context, estudianteID, claseID string) (*domain.Apunte, error)
	ListarApuntes(ctx context.Context, estudianteID string) ([]domain.Apunte, error)
	EliminarApunte(ctx context.Context, estudianteID, claseID string) (bool, error)

	Ping(ctx context.Context) error
}
