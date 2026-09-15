package domain

import (
	"errors"
	"strings"
	"testing"
)

func TestValidarPlaylist(t *testing.T) {
	tests := []struct {
		name       string
		estudiante string
		nombre     string
		wantErr    error
	}{
		{name: "válido", estudiante: "est-1", nombre: "Repaso del segundo parcial"},
		{name: "nombre con espacios alrededor", estudiante: "est-1", nombre: "  Repaso  "},
		{name: "estudiante requerido", nombre: "Repaso", wantErr: ErrEstudianteRequerido},
		{name: "nombre requerido", estudiante: "est-1", nombre: "   ", wantErr: ErrPlaylistNombreRequerido},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidarPlaylist(tt.estudiante, tt.nombre)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("ValidarPlaylist() error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidarPlaylistNombreLargo(t *testing.T) {
	nombre := strings.Repeat("a", MaxNombrePlaylist+1)
	err := ValidarPlaylist("est-1", nombre)
	if !errors.Is(err, ErrPlaylistNombreLargo) {
		t.Fatalf("ValidarPlaylist() con nombre largo error = %v, want %v", err, ErrPlaylistNombreLargo)
	}

	if err := ValidarPlaylist("est-1", strings.Repeat("a", MaxNombrePlaylist)); err != nil {
		t.Fatalf("ValidarPlaylist() con el largo máximo no debe fallar, got %v", err)
	}
}

func TestValidarItemPlaylist(t *testing.T) {
	tests := []struct {
		name          string
		playlistID    string
		claseID       string
		segundoInicio int32
		wantErr       error
	}{
		{name: "válido desde el inicio", playlistID: "pl-1", claseID: "clase-1", segundoInicio: 0},
		{name: "válido como fragmento", playlistID: "pl-1", claseID: "clase-1", segundoInicio: 90},
		{name: "playlist requerida", claseID: "clase-1", wantErr: ErrPlaylistIDRequerido},
		{name: "clase requerida", playlistID: "pl-1", wantErr: ErrClaseRequerida},
		{name: "segundo negativo", playlistID: "pl-1", claseID: "clase-1", segundoInicio: -1, wantErr: ErrSegundoInvalido},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidarItemPlaylist(tt.playlistID, tt.claseID, tt.segundoInicio)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("ValidarItemPlaylist() error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}