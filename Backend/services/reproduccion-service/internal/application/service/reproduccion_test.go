package service_test

import (
	"context"
	"errors"
	"testing"

	"yousac.com/yousac/reproduccion-service/internal/application/service"
	"yousac.com/yousac/reproduccion-service/internal/domain"
)

type fakeRepository struct {
	guardarID         string
	guardarPorcentaje float64
	guardarErr        error
	checkpoint        *domain.Checkpoint
	checkpointErr     error
	historial         []domain.HistorialItem
	historialErr      error
	calificarErr      error
	guardarCalls      int
	checkpointCalls   int
	historialCalls    int
	calificarCalls    int
	lastEstudiante    string
	lastClase         string
	lastSegundo       int32
	lastDuracion      int32
	lastPuntuacion    int32
	lastComentario    string
}

func (f *fakeRepository) GuardarCheckpoint(_ context.Context, estudianteID, claseID string, segundoActual, duracion int32) (string, float64, error) {
	f.guardarCalls++
	f.lastEstudiante, f.lastClase = estudianteID, claseID
	f.lastSegundo, f.lastDuracion = segundoActual, duracion
	return f.guardarID, f.guardarPorcentaje, f.guardarErr
}

func (f *fakeRepository) ObtenerCheckpoint(context.Context, string, string) (*domain.Checkpoint, error) {
	f.checkpointCalls++
	return f.checkpoint, f.checkpointErr
}

func (f *fakeRepository) HistorialReciente(context.Context, string) ([]domain.HistorialItem, error) {
	f.historialCalls++
	return f.historial, f.historialErr
}

func (f *fakeRepository) RegistrarCalificacion(_ context.Context, _ string, puntuacion int32, comentario string) error {
	f.calificarCalls++
	f.lastPuntuacion, f.lastComentario = puntuacion, comentario
	return f.calificarErr
}

func (f *fakeRepository) Ping(context.Context) error { return nil }

func TestReproduccionServiceValidaAntesDeDelegar(t *testing.T) {
	tests := []struct {
		name string
		call func(*service.ReproduccionService, *fakeRepository) error
	}{
		{name: "checkpoint sin estudiante", call: func(s *service.ReproduccionService, _ *fakeRepository) error {
			_, _, err := s.GuardarCheckpoint(context.Background(), "", "clase", 1, 10)
			return err
		}},
		{name: "checkpoint sin clase", call: func(s *service.ReproduccionService, _ *fakeRepository) error {
			_, _, err := s.GuardarCheckpoint(context.Background(), "est", "", 1, 10)
			return err
		}},
		{name: "segundo negativo", call: func(s *service.ReproduccionService, _ *fakeRepository) error {
			_, _, err := s.GuardarCheckpoint(context.Background(), "est", "clase", -1, 10)
			return err
		}},
		{name: "duración negativa", call: func(s *service.ReproduccionService, _ *fakeRepository) error {
			_, _, err := s.GuardarCheckpoint(context.Background(), "est", "clase", 1, -1)
			return err
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{}
			err := tt.call(service.New(repo), repo)
			if err == nil {
				t.Fatal("se esperaba un error de validación")
			}
			if repo.guardarCalls != 0 {
				t.Fatalf("el repositorio fue invocado %d veces para una entrada inválida", repo.guardarCalls)
			}
		})
	}
}

func TestReproduccionServiceDelegaCheckpointHistorialYCalificacion(t *testing.T) {
	repo := &fakeRepository{
		guardarID: "hist-1", guardarPorcentaje: 35.5,
		checkpoint: &domain.Checkpoint{HistorialID: "hist-1", ClaseID: "clase-1", SegundoActual: 42, Duracion: 120, PorcentajeAvance: 35},
		historial:  []domain.HistorialItem{{ClaseID: "clase-1", SegundoActual: 42, Duracion: 120, TieneCheckpoint: true}},
	}
	svc := service.New(repo)

	id, porcentaje, err := svc.GuardarCheckpoint(context.Background(), "est-1", "clase-1", 42, 120)
	if err != nil || id != "hist-1" || porcentaje != 35.5 {
		t.Fatalf("GuardarCheckpoint() = %q, %v, %v", id, porcentaje, err)
	}
	if repo.lastEstudiante != "est-1" || repo.lastClase != "clase-1" || repo.lastSegundo != 42 || repo.lastDuracion != 120 {
		t.Fatalf("argumentos delegados incorrectos: %#v", repo)
	}

	cp, err := svc.ObtenerCheckpoint(context.Background(), "est-1", "clase-1")
	if err != nil || cp == nil || cp.HistorialID != "hist-1" {
		t.Fatalf("ObtenerCheckpoint() = %#v, %v", cp, err)
	}
	historial, err := svc.HistorialReciente(context.Background(), "est-1")
	if err != nil || len(historial) != 1 || !historial[0].TieneCheckpoint {
		t.Fatalf("HistorialReciente() = %#v, %v", historial, err)
	}
	if err := svc.RegistrarCalificacion(context.Background(), "hist-1", 5, "muy útil"); err != nil {
		t.Fatalf("RegistrarCalificacion() error = %v", err)
	}
	if repo.lastPuntuacion != 5 || repo.lastComentario != "muy útil" {
		t.Fatalf("calificación delegada incorrectamente: %#v", repo)
	}

	if _, err := svc.ObtenerCheckpoint(context.Background(), "", "clase-1"); !errors.Is(err, domain.ErrEstudianteRequerido) {
		t.Errorf("ObtenerCheckpoint sin estudiante = %v", err)
	}
	if _, err := svc.HistorialReciente(context.Background(), ""); !errors.Is(err, domain.ErrEstudianteRequerido) {
		t.Errorf("HistorialReciente sin estudiante = %v", err)
	}
	if err := svc.RegistrarCalificacion(context.Background(), "", 5, ""); !errors.Is(err, domain.ErrHistorialNoEncontrado) {
		t.Errorf("calificación sin historial = %v", err)
	}
	if err := svc.RegistrarCalificacion(context.Background(), "hist-1", 0, ""); !errors.Is(err, domain.ErrPuntuacionInvalida) {
		t.Errorf("calificación fuera de rango = %v", err)
	}
	if repo.calificarCalls != 1 {
		t.Errorf("el repositorio de calificación recibió %d llamadas, se esperaba 1", repo.calificarCalls)
	}
}

func TestReproduccionServicePropagaErroresDelRepositorio(t *testing.T) {
	failure := errors.New("database unavailable")
	repo := &fakeRepository{guardarErr: failure, checkpointErr: failure, historialErr: failure, calificarErr: failure}
	svc := service.New(repo)

	if _, _, err := svc.GuardarCheckpoint(context.Background(), "est", "clase", 1, 10); !errors.Is(err, failure) {
		t.Errorf("GuardarCheckpoint no propagó error: %v", err)
	}
	if _, err := svc.ObtenerCheckpoint(context.Background(), "est", "clase"); !errors.Is(err, failure) {
		t.Errorf("ObtenerCheckpoint no propagó error: %v", err)
	}
	if _, err := svc.HistorialReciente(context.Background(), "est"); !errors.Is(err, failure) {
		t.Errorf("HistorialReciente no propagó error: %v", err)
	}
	if err := svc.RegistrarCalificacion(context.Background(), "hist", 3, ""); !errors.Is(err, failure) {
		t.Errorf("RegistrarCalificacion no propagó error: %v", err)
	}
}
