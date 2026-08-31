package service_test

import (
	"context"
	"errors"
	"testing"

	"yousac.com/yousac/reproduccion-service/internal/application/service"
	"yousac.com/yousac/reproduccion-service/internal/domain"
)

type fakeRepository struct {
	guardarID          string
	guardarPorcentaje  float64
	guardarErr         error
	checkpoint         *domain.Checkpoint
	checkpointErr      error
	historial          []domain.HistorialItem
	historialErr       error
	calificarErr       error
	guardarCalls       int
	checkpointCalls    int
	historialCalls     int
	calificarCalls     int
	lastEstudiante     string
	lastClase          string
	lastSegundo        int32
	lastDuracion       int32
	lastPuntuacion     int32
	lastComentario     string
	apunte             *domain.Apunte
	apunteErr          error
	apuntes            []domain.Apunte
	apuntesErr         error
	eliminarOk         bool
	eliminarErr        error
	guardarApunteCalls int
	lastTitulo         string
	lastContenido      string
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

func (f *fakeRepository) GuardarApunte(_ context.Context, estudianteID, claseID, titulo, contenidoMarkdown string) (*domain.Apunte, error) {
	f.guardarApunteCalls++
	f.lastEstudiante, f.lastClase = estudianteID, claseID
	f.lastTitulo, f.lastContenido = titulo, contenidoMarkdown
	return f.apunte, f.apunteErr
}

func (f *fakeRepository) ObtenerApunte(context.Context, string, string) (*domain.Apunte, error) {
	return f.apunte, f.apunteErr
}

func (f *fakeRepository) ListarApuntes(context.Context, string) ([]domain.Apunte, error) {
	return f.apuntes, f.apuntesErr
}

func (f *fakeRepository) EliminarApunte(context.Context, string, string) (bool, error) {
	return f.eliminarOk, f.eliminarErr
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
	repo := &fakeRepository{guardarErr: failure, checkpointErr: failure, historialErr: failure, calificarErr: failure,
		apunteErr: failure, apuntesErr: failure, eliminarErr: failure}
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
	if _, err := svc.GuardarApunte(context.Background(), "est", "clase", "t", "contenido [12:30]"); !errors.Is(err, failure) {
		t.Errorf("GuardarApunte no propagó error: %v", err)
	}
	if _, err := svc.ObtenerApunte(context.Background(), "est", "clase"); !errors.Is(err, failure) {
		t.Errorf("ObtenerApunte no propagó error: %v", err)
	}
	if _, err := svc.ListarApuntes(context.Background(), "est"); !errors.Is(err, failure) {
		t.Errorf("ListarApuntes no propagó error: %v", err)
	}
	if _, err := svc.EliminarApunte(context.Background(), "est", "clase"); !errors.Is(err, failure) {
		t.Errorf("EliminarApunte no propagó error: %v", err)
	}
}

func TestReproduccionServiceApuntesValidaYDelega(t *testing.T) {
	repo := &fakeRepository{
		apunte:     &domain.Apunte{ApunteID: "apunte-1", EstudianteID: "est-1", ClaseID: "clase-1", Titulo: "Resumen", ContenidoMarkdown: "# Resumen\\n\\n[01:20] tema"},
		apuntes:    []domain.Apunte{{ApunteID: "apunte-1", ClaseID: "clase-1"}},
		eliminarOk: true,
	}
	svc := service.New(repo)

	apunte, err := svc.GuardarApunte(context.Background(), "est-1", "clase-1", "Resumen", "[01:20] tema")
	if err != nil || apunte.ApunteID != "apunte-1" {
		t.Fatalf("GuardarApunte() = %#v, %v", apunte, err)
	}
	if repo.lastEstudiante != "est-1" || repo.lastClase != "clase-1" || repo.lastTitulo != "Resumen" {
		t.Fatalf("argumentos delegados incorrectos: %#v", repo)
	}

	if _, err := svc.ObtenerApunte(context.Background(), "est-1", "clase-1"); err != nil {
		t.Fatalf("ObtenerApunte() error = %v", err)
	}
	lista, err := svc.ListarApuntes(context.Background(), "est-1")
	if err != nil || len(lista) != 1 {
		t.Fatalf("ListarApuntes() = %#v, %v", lista, err)
	}
	ok, err := svc.EliminarApunte(context.Background(), "est-1", "clase-1")
	if err != nil || !ok {
		t.Fatalf("EliminarApunte() = %v, %v", ok, err)
	}

	if _, err := svc.GuardarApunte(context.Background(), "", "clase", "t", "c"); !errors.Is(err, domain.ErrEstudianteRequerido) {
		t.Errorf("apunte sin estudiante = %v", err)
	}
	if _, err := svc.GuardarApunte(context.Background(), "est", "", "t", "c"); !errors.Is(err, domain.ErrClaseRequerida) {
		t.Errorf("apunte sin clase = %v", err)
	}
	if _, err := svc.GuardarApunte(context.Background(), "est", "clase", "", "c"); !errors.Is(err, domain.ErrApunteTituloRequerido) {
		t.Errorf("apunte sin título = %v", err)
	}
	if _, err := svc.GuardarApunte(context.Background(), "est", "clase", "t", ""); !errors.Is(err, domain.ErrApunteContenidoRequerido) {
		t.Errorf("apunte sin contenido = %v", err)
	}
	if _, err := svc.GuardarApunte(context.Background(), "est", "clase", "t", "texto [99:99] inválido"); !errors.Is(err, domain.ErrMarcadorTiempoInvalido) {
		t.Errorf("apunte con marcador inválido = %v", err)
	}
	if _, err := svc.ObtenerApunte(context.Background(), "", "clase"); !errors.Is(err, domain.ErrEstudianteRequerido) {
		t.Errorf("obtener apunte sin estudiante = %v", err)
	}
	if _, err := svc.EliminarApunte(context.Background(), "est", ""); !errors.Is(err, domain.ErrClaseRequerida) {
		t.Errorf("eliminar apunte sin clase = %v", err)
	}
	if repo.guardarApunteCalls != 1 {
		t.Errorf("el repositorio de apuntes recibió %d llamadas, se esperaba 1", repo.guardarApunteCalls)
	}
}
