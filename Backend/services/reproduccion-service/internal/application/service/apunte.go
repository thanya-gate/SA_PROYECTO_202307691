package service

import (
	"context"

	"yousac.com/yousac/reproduccion-service/internal/domain"
)

func (s *ReproduccionService) GuardarApunte(ctx context.Context, estudianteID, claseID, titulo, contenidoMarkdown string) (*domain.Apunte, error) {
	if err := domain.ValidarApunte(estudianteID, claseID, titulo, contenidoMarkdown); err != nil {
		return nil, err
	}
	return s.repo.GuardarApunte(ctx, estudianteID, claseID, titulo, contenidoMarkdown)
}

func (s *ReproduccionService) ObtenerApunte(ctx context.Context, estudianteID, claseID string) (*domain.Apunte, error) {
	if estudianteID == "" {
		return nil, domain.ErrEstudianteRequerido
	}
	if claseID == "" {
		return nil, domain.ErrClaseRequerida
	}
	return s.repo.ObtenerApunte(ctx, estudianteID, claseID)
}

func (s *ReproduccionService) ListarApuntes(ctx context.Context, estudianteID string) ([]domain.Apunte, error) {
	if estudianteID == "" {
		return nil, domain.ErrEstudianteRequerido
	}
	return s.repo.ListarApuntes(ctx, estudianteID)
}

func (s *ReproduccionService) EliminarApunte(ctx context.Context, estudianteID, claseID string) (bool, error) {
	if estudianteID == "" {
		return false, domain.ErrEstudianteRequerido
	}
	if claseID == "" {
		return false, domain.ErrClaseRequerida
	}
	return s.repo.EliminarApunte(ctx, estudianteID, claseID)
}
