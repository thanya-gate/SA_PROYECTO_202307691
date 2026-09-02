package service

import (
	"context"

	"yousac.com/yousac/reproduccion-service/internal/domain"
)

// GuardarApunte crea un apunte nuevo cuando apunteID está vacío, o actualiza
// el apunte existente cuando apunteID viene definido (verificando pertenencia
// al estudiante en la capa de persistencia). Permite varios apuntes por clase.
func (s *ReproduccionService) GuardarApunte(ctx context.Context, estudianteID, apunteID, claseID, titulo, contenidoMarkdown string, posicionSegundos int32) (*domain.Apunte, error) {
	if err := domain.ValidarApunte(estudianteID, claseID, titulo, contenidoMarkdown, posicionSegundos); err != nil {
		return nil, err
	}
	return s.repo.GuardarApunte(ctx, estudianteID, apunteID, claseID, titulo, contenidoMarkdown, posicionSegundos)
}

// ListarApuntes devuelve los apuntes del estudiante. Si claseID no es vacío,
// filtra solo los apuntes de esa clase.
func (s *ReproduccionService) ListarApuntes(ctx context.Context, estudianteID, claseID string) ([]domain.Apunte, error) {
	if estudianteID == "" {
		return nil, domain.ErrEstudianteRequerido
	}
	return s.repo.ListarApuntes(ctx, estudianteID, claseID)
}

// EliminarApunte elimina un apunte específico por su identificador, siempre
// que pertenezca al estudiante autenticado.
func (s *ReproduccionService) EliminarApunte(ctx context.Context, estudianteID, apunteID string) (bool, error) {
	if estudianteID == "" {
		return false, domain.ErrEstudianteRequerido
	}
	if apunteID == "" {
		return false, domain.ErrApunteIDRequerido
	}
	return s.repo.EliminarApunte(ctx, estudianteID, apunteID)
}

// ExportarApunteMd genera el archivo Markdown (.md) del cuaderno de apuntes de
// una clase concatenando todos los apuntes del estudiante para esa clase. Como
// el contenido ya se persiste como Markdown, la exportación es directa; la
// conversión a PDF (con rendering enriquecido) queda en el frontend.
func (s *ReproduccionService) ExportarApunteMd(ctx context.Context, estudianteID, claseID string) (*domain.ArchivoApunte, error) {
	if estudianteID == "" {
		return nil, domain.ErrEstudianteRequerido
	}
	if claseID == "" {
		return nil, domain.ErrClaseRequerida
	}
	apuntes, err := s.repo.ListarApuntes(ctx, estudianteID, claseID)
	if err != nil {
		return nil, err
	}
	if len(apuntes) == 0 {
		return nil, domain.ErrApunteNoEncontrado
	}
	return domain.NuevoArchivoCuadernoApuntes(claseID, apuntes), nil
}
