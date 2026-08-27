package domain

import (
	"errors"
	"testing"
)

func TestValidarCheckpoint(t *testing.T) {
	tests := []struct {
		name       string
		estudiante string
		clase      string
		segundo    int32
		duracion   int32
		wantErr    error
	}{
		{name: "válido desde cero", estudiante: "est-1", clase: "clase-1", segundo: 0, duracion: 0},
		{name: "válido con duración", estudiante: "est-1", clase: "clase-1", segundo: 42, duracion: 120},
		{name: "estudiante requerido", clase: "clase-1", wantErr: ErrEstudianteRequerido},
		{name: "clase requerida", estudiante: "est-1", wantErr: ErrClaseRequerida},
		{name: "segundo negativo", estudiante: "est-1", clase: "clase-1", segundo: -1, wantErr: ErrSegundoInvalido},
		{name: "duración negativa", estudiante: "est-1", clase: "clase-1", duracion: -1, wantErr: ErrDuracionInvalida},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidarCheckpoint(tt.estudiante, tt.clase, tt.segundo, tt.duracion)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("ValidarCheckpoint() error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidarCalificacion(t *testing.T) {
	for _, puntuacion := range []int32{1, 2, 3, 4, 5} {
		if err := ValidarCalificacion(puntuacion); err != nil {
			t.Errorf("puntuación válida %d produjo error: %v", puntuacion, err)
		}
	}
	for _, puntuacion := range []int32{0, -1, 6, 99} {
		if !errors.Is(ValidarCalificacion(puntuacion), ErrPuntuacionInvalida) {
			t.Errorf("puntuación inválida %d no produjo ErrPuntuacionInvalida", puntuacion)
		}
	}
}
