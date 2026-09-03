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
	PosicionSegundos   int32
}

var (
	ErrApunteTituloRequerido    = errors.New("APUNTE_TITULO_OBLIGATORIO: el título del apunte es obligatorio")
	ErrApunteContenidoRequerido = errors.New("APUNTE_CONTENIDO_OBLIGATORIO: el contenido Markdown del apunte es obligatorio")
	ErrMarcadorTiempoInvalido   = errors.New("MARCADOR_TIEMPO_INVALIDO: el marcador de tiempo debe tener el formato [MM:SS]")
	ErrTituloMuyLargo           = errors.New("APUNTE_TITULO_LARGO: el título del apunte no puede superar los 200 caracteres")
	ErrApunteIDRequerido        = errors.New("APUNTE_ID_OBLIGATORIO: debe indicarse el apunte a modificar")
	ErrApunteNoEncontrado       = errors.New("APUNTE_NO_ENCONTRADO: no existe el apunte indicado")
	ErrPosicionInvalida         = errors.New("APUNTE_POSICION_INVALIDA: la posición en segundos del apunte no puede ser negativa")
)

const (
	MaxTituloApunte  = 200
	MimeTypeMarkdown = "text/markdown; charset=utf-8"
	ExtensionApunte  = ".md"
)

// ArchivoApunte representa un cuaderno de apuntes exportado a un archivo
// Markdown listo para descargar.
type ArchivoApunte struct {
	NombreArchivo string
	ContenidoMD   string
	MimeType      string
}

// NuevoArchivoApunte construye el archivo .md a partir de un apunte persistido.
// El nombre de archivo usa el identificador de la clase para que sea único.
func NuevoArchivoApunte(a *Apunte) *ArchivoApunte {
	if a == nil {
		return nil
	}
	return &ArchivoApunte{
		NombreArchivo: "apunte-" + a.ClaseID + ExtensionApunte,
		ContenidoMD:   a.ContenidoMarkdown,
		MimeType:      MimeTypeMarkdown,
	}
}

// NuevoArchivoCuadernoApuntes concatena todos los apuntes de una clase en un
// único archivo Markdown para su exportación. El encabezado de cada apunte
// incluye su título.
func NuevoArchivoCuadernoApuntes(claseID string, apuntes []Apunte) *ArchivoApunte {
	var b strings.Builder
	for i, apunte := range apuntes {
		if i > 0 {
			b.WriteString("\n\n---\n\n")
		}
		b.WriteString("# ")
		b.WriteString(apunte.Titulo)
		b.WriteString("\n\n")
		b.WriteString(apunte.ContenidoMarkdown)
	}
	return &ArchivoApunte{
		NombreArchivo: "apuntes-" + claseID + ExtensionApunte,
		ContenidoMD:   b.String(),
		MimeType:      MimeTypeMarkdown,
	}
}

// Los candidatos permiten detectar marcadores numéricos mal formados como
// [1:30] o [01:5], en lugar de ignorarlos silenciosamente. La expresión
// completa aplica el formato admitido: [MM:SS], con dos dígitos por grupo.
var (
	marcadorTiempoCompletoRe  = regexp.MustCompile(`^\[(\d{2}):(\d{2})\]$`)
	marcadorTiempoCandidatoRe = regexp.MustCompile(`\[\d+:\d+\]`)
)

// ValidarApunte valida los campos del cuaderno de apuntes ligado a un
// estudiante y una clase.
func ValidarApunte(estudianteID, claseID, titulo, contenidoMarkdown string, posicionSegundos int32) error {
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
	if posicionSegundos < 0 {
		return ErrPosicionInvalida
	}
	if err := ValidarMarcadoresTiempo(contenidoMarkdown); err != nil {
		return err
	}
	return nil
}

// ValidarMarcadoresTiempo comprueba que todos los marcadores de tiempo
// embebidos en el Markdown ([MM:SS]) sean sintácticamente válidos.
func ValidarMarcadoresTiempo(markdown string) error {
	candidatos := marcadorTiempoCandidatoRe.FindAllString(markdown, -1)
	for _, candidato := range candidatos {
		m := marcadorTiempoCompletoRe.FindStringSubmatch(candidato)
		if m == nil {
			return ErrMarcadorTiempoInvalido
		}
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
	m := marcadorTiempoCompletoRe.FindStringSubmatch(cadena)
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
