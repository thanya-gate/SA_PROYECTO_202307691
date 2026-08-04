package domain

import "errors"

// Entidad que representa el punto de reanudación de una clase.
type Checkpoint struct {
	HistorialID        string
	ClaseID            string
	SegundoActual      int32
	Duracion           int32
	PorcentajeAvance   float64
	FechaActualizacion string
}

// Ítem del historial de reproducción reciente de un estudiante.
type HistorialItem struct {
	ClaseID                  string
	FechaUltimaVisualizacion string
	SegundoActual            int32
	Duracion                 int32
	PorcentajeAvance         float64
	TieneCheckpoint          bool
}

// Errores de dominio (mensajes estables para el gateway y el cliente web).
var (
	ErrEstudianteRequerido   = errors.New("ESTUDIANTE_OBLIGATORIO: estudianteId es obligatorio")
	ErrClaseRequerida        = errors.New("CLASE_OBLIGATORIA: claseId es obligatorio")
	ErrSegundoInvalido       = errors.New("SEGUNDO_INVALIDO: el segundo de avance no puede ser negativo")
	ErrDuracionInvalida      = errors.New("DURACION_INVALIDA: la duración no puede ser negativa")
	ErrHistorialNoEncontrado = errors.New("HISTORIAL_NO_ENCONTRADO: no existe historial para la clase")
	ErrPuntuacionInvalida    = errors.New("PUNTUACION_INVALIDA: la puntuación debe estar entre 1 y 5")
)

// ValidarCheckpoint valida los datos de entrada antes de persistir.
func ValidarCheckpoint(estudianteID, claseID string, segundoActual, duracion int32) error {
	if estudianteID == "" {
		return ErrEstudianteRequerido
	}
	if claseID == "" {
		return ErrClaseRequerida
	}
	if segundoActual < 0 {
		return ErrSegundoInvalido
	}
	if duracion < 0 {
		return ErrDuracionInvalida
	}
	return nil
}

// ValidarCalificacion valida el rango de puntuación (1..5).
func ValidarCalificacion(puntuacion int32) error {
	if puntuacion < 1 || puntuacion > 5 {
		return ErrPuntuacionInvalida
	}
	return nil
}
