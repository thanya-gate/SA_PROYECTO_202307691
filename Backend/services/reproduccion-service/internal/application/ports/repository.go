package ports

import (
	"context"

	"yousac.com/yousac/reproduccion-service/internal/domain"
)

// ReproduccionRepository es la abstracción de persistencia del microservicio.
type ReproduccionRepository interface {
	// GuardarCheckpoint persiste (upsert) el avance y devuelve el historial_id
	// y el porcentaje de avance calculado por la BD (fn_calcular_progreso).
	GuardarCheckpoint(ctx context.Context, estudianteID, claseID string, segundoActual, duracion int32) (historialID string, porcentajeAvance float64, err error)
	// ObtenerCheckpoint devuelve el checkpoint de una clase; nil si no existe.
	ObtenerCheckpoint(ctx context.Context, estudianteID, claseID string) (*domain.Checkpoint, error)
	// HistorialReciente lista la reproducción reciente del estudiante.
	HistorialReciente(ctx context.Context, estudianteID string) ([]domain.HistorialItem, error)
	// RegistrarCalificacion aplica/actualiza la valoración de una clase (1..5).
	RegistrarCalificacion(ctx context.Context, historialID string, puntuacion int32, comentario string) error
	// Ping verifica la conexión a la BD.
	Ping(ctx context.Context) error
}
