package domain

import (
	"errors"
	"regexp"
	"strconv"
	"strings"
)

type Apunte struct {
	ApunteID           string
	EstudianteID       string
	ClaseID            string
	Titulo             string
	ContenidoMarkdown  string
	FechaCreacion      string
	FechaActualizacion string
}

var (
	ErrApunteTituloRequerido    = errors.New("APUNTE_TITULO_OBLIGATORIO: el título del apunte es obligatorio")
	ErrApunteContenidoRequerido = errors.New("APUNTE_CONTENIDO_OBLIGATORIO: el contenido Markdown del apunte es obligatorio")
	ErrMarcadorTiempoInvalido   = errors.New("MARCADOR_TIEMPO_INVALIDO: el marcador de tiempo debe tener el formato [MM:SS]")
	ErrTituloMuyLargo           = errors.New("APUNTE_TITULO_LARGO: el título del apunte no puede superar los 200 caracteres")
)

const MaxTituloApunte = 200

// marcadorTiempoRe expresa el formato admitido para los marcadores de tiempo
// dentro del apunte: [MM:SS] con minutos y segundos de dos dígitos.
var marcadorTiempoRe = regexp.MustCompile(`\[(\d{2}):(\d{2})\]`)

// ValidarApunte valida los campos del cuaderno de apuntes ligado a un
// estudiante y una clase.
func ValidarApunte(estudianteID, claseID, titulo, contenidoMarkdown string) error {
	if estudianteID == "" {
		return ErrEstudianteRequerido
	}
	if claseID == "" {
		return ErrClaseRequerida
	}
	if strings.TrimSpace(titulo) == "" {
		return ErrApunteTituloRequerido
	}
	if len(titulo) > MaxTituloApunte {
		return ErrTituloMuyLargo
	}
	if strings.TrimSpace(contenidoMarkdown) == "" {
		return ErrApunteContenidoRequerido
	}
	if err := ValidarMarcadoresTiempo(contenidoMarkdown); err != nil {
		return err
	}
	return nil
}

// ValidarMarcadoresTiempo comprueba que todos los marcadores de tiempo
// embebidos en el Markdown ([MM:SS]) sean sintácticamente válidos.
func ValidarMarcadoresTiempo(markdown string) error {
	matches := marcadorTiempoRe.FindAllStringSubmatch(markdown, -1)
	for _, m := range matches {
		minutos, errMin := strconv.Atoi(m[1])
		segundos, errSeg := strconv.Atoi(m[2])
		if errMin != nil || errSeg != nil {
			return ErrMarcadorTiempoInvalido
		}
		if minutos < 0 || segundos < 0 || segundos > 59 {
			return ErrMarcadorTiempoInvalido
		}
	}
	return nil
}

// SegundosDeMarcadorTiempo convierte un marcador de tiempo de la forma
// "MM:SS" a su equivalente en segundos. Devuelve -1 si el formato no es válido.
func SegundosDeMarcadorTiempo(cadena string) int {
	m := marcadorTiempoRe.FindStringSubmatch(cadena)
	if m == nil {
		return -1
	}
	minutos, errMin := strconv.Atoi(m[1])
	segundos, errSeg := strconv.Atoi(m[2])
	if errMin != nil || errSeg != nil || segundos > 59 {
		return -1
	}
	return minutos*60 + segundos
}
