package grpc

import (
	"context"
	"errors"
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"yousac.com/yousac/reproduccion-service/gen/reproduccionv1"
	"yousac.com/yousac/reproduccion-service/internal/application/service"
	"yousac.com/yousac/reproduccion-service/internal/domain"
)

type grpcFakeRepository struct {
	checkpoint *domain.Checkpoint
	historial  []domain.HistorialItem
	guardarErr error
	readErr    error
}

func (f *grpcFakeRepository) GuardarCheckpoint(context.Context, string, string, int32, int32) (string, float64, error) {
	if f.guardarErr != nil {
		return "", 0, f.guardarErr
	}
	return "hist-1", 40, nil
}

func (f *grpcFakeRepository) ObtenerCheckpoint(context.Context, string, string) (*domain.Checkpoint, error) {
	return f.checkpoint, f.readErr
}

func (f *grpcFakeRepository) HistorialReciente(context.Context, string) ([]domain.HistorialItem, error) {
	return f.historial, f.readErr
}

func (f *grpcFakeRepository) RegistrarCalificacion(context.Context, string, int32, string) error {
	return f.guardarErr
}

func (f *grpcFakeRepository) Ping(context.Context) error { return nil }

func TestServerExponeRespuestasYMapeaErrores(t *testing.T) {
	repo := &grpcFakeRepository{
		checkpoint: &domain.Checkpoint{HistorialID: "hist-1", ClaseID: "clase-1", SegundoActual: 30, Duracion: 90, PorcentajeAvance: 33.3, FechaActualizacion: "2026-08-26T00:00:00Z"},
		historial:  []domain.HistorialItem{{ClaseID: "clase-1", SegundoActual: 30, Duracion: 90, PorcentajeAvance: 33.3, TieneCheckpoint: true}},
	}
	server := New(service.New(repo), "test-version")

	health, err := server.Health(context.Background(), &reproduccionv1.HealthRequest{})
	if err != nil || health.GetStatus() != "SERVING" || health.GetVersion() != "test-version" {
		t.Fatalf("Health() = %#v, %v", health, err)
	}
	checkpoint, err := server.GuardarCheckpoint(context.Background(), &reproduccionv1.GuardarCheckpointRequest{EstudianteId: "est-1", ClaseId: "clase-1", SegundoActual: 30, Duracion: 90})
	if err != nil || checkpoint.GetHistorialId() != "hist-1" || checkpoint.GetPorcentajeAvance() != 40 {
		t.Fatalf("GuardarCheckpoint() = %#v, %v", checkpoint, err)
	}

	response, err := server.ObtenerCheckpoint(context.Background(), &reproduccionv1.ObtenerCheckpointRequest{EstudianteId: "est-1", ClaseId: "clase-1"})
	if err != nil || response.GetCheckpoint().GetSegundoActual() != 30 || response.GetCheckpoint().GetClaseId() != "clase-1" {
		t.Fatalf("ObtenerCheckpoint() = %#v, %v", response, err)
	}
	history, err := server.HistorialReciente(context.Background(), &reproduccionv1.HistorialRecienteRequest{EstudianteId: "est-1"})
	if err != nil || len(history.GetItems()) != 1 || !history.GetItems()[0].GetTieneCheckpoint() {
		t.Fatalf("HistorialReciente() = %#v, %v", history, err)
	}
	rating, err := server.RegistrarCalificacion(context.Background(), &reproduccionv1.RegistrarCalificacionRequest{HistorialId: "hist-1", Puntuacion: 5, Comentario: "ok"})
	if err != nil || !rating.GetRegistrada() {
		t.Fatalf("RegistrarCalificacion() = %#v, %v", rating, err)
	}
}

func TestServerDevuelveCheckpointVacíoYStatusInvalidArgument(t *testing.T) {
	server := New(service.New(&grpcFakeRepository{}), "test")
	response, err := server.ObtenerCheckpoint(context.Background(), &reproduccionv1.ObtenerCheckpointRequest{EstudianteId: "est", ClaseId: "clase"})
	if err != nil || response.GetCheckpoint() != nil {
		t.Fatalf("checkpoint ausente = %#v, %v", response, err)
	}

	tests := []struct {
		name string
		call func() error
	}{
		{name: "estudiante ausente", call: func() error {
			_, err := server.GuardarCheckpoint(context.Background(), &reproduccionv1.GuardarCheckpointRequest{ClaseId: "clase"})
			return err
		}},
		{name: "puntuación inválida", call: func() error {
			_, err := server.RegistrarCalificacion(context.Background(), &reproduccionv1.RegistrarCalificacionRequest{HistorialId: "hist", Puntuacion: 6})
			return err
		}},
		{name: "historial ausente", call: func() error {
			_, err := server.HistorialReciente(context.Background(), &reproduccionv1.HistorialRecienteRequest{})
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

func TestMapError(t *testing.T) {
	tests := []struct {
		err  error
		code codes.Code
	}{
		{domain.ErrEstudianteRequerido, codes.InvalidArgument},
		{domain.ErrClaseRequerida, codes.InvalidArgument},
		{domain.ErrSegundoInvalido, codes.InvalidArgument},
		{domain.ErrDuracionInvalida, codes.InvalidArgument},
		{domain.ErrHistorialNoEncontrado, codes.InvalidArgument},
		{domain.ErrPuntuacionInvalida, codes.InvalidArgument},
		{errors.New("fallo externo"), codes.Internal},
	}
	for _, tt := range tests {
		if got := status.Code(mapError(tt.err)); got != tt.code {
			t.Errorf("mapError(%v) = %s, want %s", tt.err, got, tt.code)
		}
	}
}
