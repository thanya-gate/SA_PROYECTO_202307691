package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"yousac.com/yousac/reproduccion-service/internal/domain"
)


type ReproduccionRepository struct {
	pool *pgxpool.Pool
}

func NewReproduccionRepository(pool *pgxpool.Pool) *ReproduccionRepository {
	return &ReproduccionRepository{pool: pool}
}

func (r *ReproduccionRepository) Ping(ctx context.Context) error {
	return r.pool.Ping(ctx)
}

func mapearError(err error) error {
	if err == nil {
		return nil
	}
	msg := err.Error()
	switch {
	case strings.Contains(msg, "HISTORIAL_NO_ENCONTRADO"):
		return domain.ErrHistorialNoEncontrado
	case strings.Contains(msg, "PUNTUACION_INVALIDA"):
		return domain.ErrPuntuacionInvalida
	default:
		return err
	}
}

func (r *ReproduccionRepository) GuardarCheckpoint(ctx context.Context, estudianteID, claseID string, segundoActual, duracion int32) (string, float64, error) {
	_, err := r.pool.Exec(ctx, "CALL sp_guardar_checkpoint($1, $2, $3, $4, NULL)",
		estudianteID, claseID, segundoActual, duracion)
	if err != nil {
		return "", 0, fmt.Errorf("guardar checkpoint: %w", mapearError(err))
	}

	var historialID string
	var porcentajeAvance float64
	err = r.pool.QueryRow(ctx, `
		SELECT cp.historial_id, cp.porcentaje_avance::float8
		FROM checkpoint cp
		JOIN historial_reproduccion h ON h.id = cp.historial_id
		WHERE h.estudiante_id = $1 AND h.clase_id = $2`, estudianteID, claseID).
		Scan(&historialID, &porcentajeAvance)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", 0, domain.ErrHistorialNoEncontrado
	}
	if err != nil {
		return "", 0, fmt.Errorf("leer checkpoint guardado: %w", err)
	}
	return historialID, porcentajeAvance, nil
}

func (r *ReproduccionRepository) ObtenerCheckpoint(ctx context.Context, estudianteID, claseID string) (*domain.Checkpoint, error) {
	var cp domain.Checkpoint
	err := r.pool.QueryRow(ctx, `
		SELECT cp.historial_id, h.clase_id, cp.segundo_actual, cp.duracion,
		       cp.porcentaje_avance::float8, cp.fecha_actualizacion::text
		FROM checkpoint cp
		JOIN historial_reproduccion h ON h.id = cp.historial_id
		WHERE h.estudiante_id = $1 AND h.clase_id = $2`, estudianteID, claseID).
		Scan(&cp.HistorialID, &cp.ClaseID, &cp.SegundoActual, &cp.Duracion,
			&cp.PorcentajeAvance, &cp.FechaActualizacion)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("obtener checkpoint: %w", err)
	}
	return &cp, nil
}

func (r *ReproduccionRepository) HistorialReciente(ctx context.Context, estudianteID string) ([]domain.HistorialItem, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT clase_id, fecha_ultima_visualizacion::text, segundo_actual,
		       duracion, porcentaje_avance::float8, tiene_checkpoint
		FROM vw_historial_reciente
		WHERE estudiante_id = $1
		ORDER BY fecha_ultima_visualizacion DESC`, estudianteID)
	if err != nil {
		return nil, fmt.Errorf("consultar historial reciente: %w", err)
	}
	defer rows.Close()

	items := make([]domain.HistorialItem, 0)
	for rows.Next() {
		var item domain.HistorialItem
		if err := rows.Scan(&item.ClaseID, &item.FechaUltimaVisualizacion, &item.SegundoActual,
			&item.Duracion, &item.PorcentajeAvance, &item.TieneCheckpoint); err != nil {
			return nil, fmt.Errorf("leer historial reciente: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterar historial reciente: %w", err)
	}
	return items, nil
}

func (r *ReproduccionRepository) RegistrarCalificacion(ctx context.Context, historialID string, puntuacion int32, comentario string) error {
	var comentarioArg any
	if comentario != "" {
		comentarioArg = comentario
	}
	_, err := r.pool.Exec(ctx, "CALL sp_registrar_calificacion($1, $2, $3)", historialID, puntuacion, comentarioArg)
	if err != nil {
		return fmt.Errorf("registrar calificación: %w", mapearError(err))
	}
	return nil
}
