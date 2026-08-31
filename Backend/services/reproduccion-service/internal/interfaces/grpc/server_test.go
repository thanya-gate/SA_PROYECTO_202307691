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
	apunte     *domain.Apunte
	apuntes    []domain.Apunte
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

func (f *grpcFakeRepository) GuardarApunte(ctx context.Context, estudianteID, claseID, titulo, contenidoMarkdown string) (*domain.Apunte, error) {
	if f.guardarErr != nil {
		return nil, f.guardarErr
	}
	return &domain.Apunte{ApunteID: "apunte-1", EstudianteID: estudianteID, ClaseID: claseID, Titulo: titulo, ContenidoMarkdown: contenidoMarkdown}, nil
}

func (f *grpcFakeRepository) ObtenerApunte(context.Context, string, string) (*domain.Apunte, error) {
	return f.apunte, f.readErr
}

func (f *grpcFakeRepository) ListarApuntes(context.Context, string) ([]domain.Apunte, error) {
	return f.apuntes, f.readErr
}

func (f *grpcFakeRepository) EliminarApunte(context.Context, string, string) (bool, error) {
	if f.guardarErr != nil {
		return false, f.guardarErr
	}
	return true, nil
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

func TestServerApuntesExponeRespuestasYMapeaErrores(t *testing.T) {
	repo := &grpcFakeRepository{
		apunte:  &domain.Apunte{ApunteID: "apunte-1", EstudianteID: "est-1", ClaseID: "clase-1", Titulo: "Resumen", ContenidoMarkdown: "# Resumen\n\n[01:20] tema"},
		apuntes: []domain.Apunte{{ApunteID: "apunte-1", EstudianteID: "est-1", ClaseID: "clase-1", Titulo: "Resumen"}},
	}
	server := New(service.New(repo), "test-version")

	guardado, err := server.GuardarApunte(context.Background(), &reproduccionv1.GuardarApunteRequest{
		EstudianteId: "est-1", ClaseId: "clase-1", Titulo: "Resumen", ContenidoMarkdown: "[01:20] tema",
	})
	if err != nil || guardado.GetApunte().GetApunteId() != "apunte-1" || guardado.GetApunte().GetTitulo() != "Resumen" {
		t.Fatalf("GuardarApunte() = %#v, %v", guardado, err)
	}

	obtenido, err := server.ObtenerApunte(context.Background(), &reproduccionv1.ObtenerApunteRequest{EstudianteId: "est-1", ClaseId: "clase-1"})
	if err != nil || obtenido.GetApunte().GetContenidoMarkdown() != "# Resumen\n\n[01:20] tema" {
		t.Fatalf("ObtenerApunte() = %#v, %v", obtenido, err)
	}

	lista, err := server.ListarApuntes(context.Background(), &reproduccionv1.ListarApuntesRequest{EstudianteId: "est-1"})
	if err != nil || len(lista.GetApuntes()) != 1 || lista.GetApuntes()[0].GetClaseId() != "clase-1" {
		t.Fatalf("ListarApuntes() = %#v, %v", lista, err)
	}

	eliminado, err := server.EliminarApunte(context.Background(), &reproduccionv1.EliminarApunteRequest{EstudianteId: "est-1", ClaseId: "clase-1"})
	if err != nil || !eliminado.GetEliminado() {
		t.Fatalf("EliminarApunte() = %#v, %v", eliminado, err)
	}

	// Validación de entrada: contenido inválido debe devolver InvalidArgument.
	if _, err := server.GuardarApunte(context.Background(), &reproduccionv1.GuardarApunteRequest{
		EstudianteId: "est", ClaseId: "clase", Titulo: "t", ContenidoMarkdown: "[12:99] mal",
	}); status.Code(err) != codes.InvalidArgument {
		t.Fatalf("GuardarApunte con marcador inválido status = %s, se esperaba InvalidArgument", status.Code(err))
	}
}

func TestServerExportarApunteMdExponeArchivo(t *testing.T) {
	repo := &grpcFakeRepository{
		apunte: &domain.Apunte{
			ApunteID:          "apunte-1",
			EstudianteID:      "est-1",
			ClaseID:           "clase-1",
			Titulo:            "Resumen",
			ContenidoMarkdown: "# Resumen\n\n[00:05] marcador",
		},
	}
	server := New(service.New(repo), "test-version")

	exportado, err := server.ExportarApunteMd(context.Background(), &reproduccionv1.ExportarApunteMdRequest{EstudianteId: "est-1", ClaseId: "clase-1"})
	if err != nil {
		t.Fatalf("ExportarApunteMd() error = %v", err)
	}
	if exportado.GetNombreArchivo() != "apunte-clase-1.md" {
		t.Errorf("NombreArchivo = %q, se esperaba apunte-clase-1.md", exportado.GetNombreArchivo())
	}
	if exportado.GetContenidoMd() != "# Resumen\n\n[00:05] marcador" {
		t.Errorf("ContenidoMd = %q", exportado.GetContenidoMd())
	}
	if exportado.GetMimeType() != domain.MimeTypeMarkdown {
		t.Errorf("MimeType = %q, se esperaba %q", exportado.GetMimeType(), domain.MimeTypeMarkdown)
	}

	// Apunte inexistente (fake devuelve (nil, nil)) debe mapearse a NotFound.
	repoSinApunte := &grpcFakeRepository{}
	serverSinApunte := New(service.New(repoSinApunte), "test-version")
	if _, err := serverSinApunte.ExportarApunteMd(context.Background(),
		&reproduccionv1.ExportarApunteMdRequest{EstudianteId: "est-1", ClaseId: "clase-1"}); status.Code(err) != codes.NotFound {
		t.Fatalf("ExportarApunteMd sin apunte status = %s, se esperaba NotFound", status.Code(err))
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
		{domain.ErrApunteTituloRequerido, codes.InvalidArgument},
		{domain.ErrApunteContenidoRequerido, codes.InvalidArgument},
		{domain.ErrMarcadorTiempoInvalido, codes.InvalidArgument},
		{domain.ErrTituloMuyLargo, codes.InvalidArgument},
		{domain.ErrApunteNoEncontrado, codes.NotFound},
		{errors.New("fallo externo"), codes.Internal},
	}
	for _, tt := range tests {
		if got := status.Code(mapError(tt.err)); got != tt.code {
			t.Errorf("mapError(%v) = %s, want %s", tt.err, got, tt.code)
		}
	}
}
