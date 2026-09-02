package domain

import (
	"errors"
	"strings"
	"testing"
)

func TestValidarApunte(t *testing.T) {
	tests := []struct {
		name       string
		estudiante string
		clase      string
		titulo     string
		contenido  string
		posicion   int32
		wantErr    error
	}{
		{name: "válido con marcadores de tiempo", estudiante: "est-1", clase: "clase-1", titulo: "Resumen", contenido: "# Tema\n\n[01:30] explicación\n\n[05:45] ejemplo", posicion: 90},
		{name: "válido sin marcadores", estudiante: "est-1", clase: "clase-1", titulo: "Resumen", contenido: "texto simple", posicion: 0},
		{name: "estudiante requerido", clase: "clase-1", titulo: "t", contenido: "c", wantErr: ErrEstudianteRequerido},
		{name: "clase requerida", estudiante: "est-1", titulo: "t", contenido: "c", wantErr: ErrClaseRequerida},
		{name: "título requerido", estudiante: "est-1", clase: "clase-1", titulo: "   ", contenido: "c", wantErr: ErrApunteTituloRequerido},
		{name: "contenido requerido", estudiante: "est-1", clase: "clase-1", titulo: "t", contenido: "   ", wantErr: ErrApunteContenidoRequerido},
		{name: "marcador con segundos inválidos", estudiante: "est-1", clase: "clase-1", titulo: "t", contenido: "[01:75]", wantErr: ErrMarcadorTiempoInvalido},
		{name: "marcador fuera de rango", estudiante: "est-1", clase: "clase-1", titulo: "t", contenido: "[99:99]", wantErr: ErrMarcadorTiempoInvalido},
		{name: "posición negativa", estudiante: "est-1", clase: "clase-1", titulo: "t", contenido: "c", posicion: -1, wantErr: ErrPosicionInvalida},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidarApunte(tt.estudiante, tt.clase, tt.titulo, tt.contenido, tt.posicion)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("ValidarApunte() error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidarApunteTituloLargo(t *testing.T) {
	titulo := strings.Repeat("a", MaxTituloApunte+1)
	err := ValidarApunte("est-1", "clase-1", titulo, "contenido", 0)
	if !errors.Is(err, ErrTituloMuyLargo) {
		t.Fatalf("ValidarApunte() con título largo error = %v, want %v", err, ErrTituloMuyLargo)
	}
}

func TestSegundosDeMarcadorTiempo(t *testing.T) {
	tests := []struct {
		in   string
		want int
	}{
		{in: "01:30", want: 90},
		{in: "00:00", want: 0},
		{in: "99:59", want: 5999},
		{in: "00:60", want: -1},
		{in: "1:30", want: -1},
		{in: "abc", want: -1},
		{in: "", want: -1},
	}
	for _, tt := range tests {
		if got := SegundosDeMarcadorTiempo("[" + tt.in + "]"); got != tt.want {
			t.Errorf("SegundosDeMarcadorTiempo(%q) = %d, want %d", tt.in, got, tt.want)
		}
	}
}
