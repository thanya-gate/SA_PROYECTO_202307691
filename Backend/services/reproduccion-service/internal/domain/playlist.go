package domain

import (
	"errors"
	"strings"
)

type Playlist struct {
	PlaylistID         string
	EstudianteID       string
	Nombre             string
	EsPublica          bool
	EnlacePublico      string
	CantidadItems      int32
	FechaCreacion      string
	FechaActualizacion string
	ClasePortada       string
}

type PlaylistItem struct {
	PlaylistItemID string
	ClaseID        string
	Orden          int32
	SegundoInicio  int32
	FechaAgregado  string
}

const MaxNombrePlaylist = 120

var (
	ErrPlaylistNombreRequerido  = errors.New("PLAYLIST_NOMBRE_OBLIGATORIO: el nombre de la playlist es obligatorio")
	ErrPlaylistNombreLargo      = errors.New("PLAYLIST_NOMBRE_LARGO: el nombre de la playlist no puede superar los 120 caracteres")
	ErrPlaylistIDRequerido      = errors.New("PLAYLIST_ID_OBLIGATORIO: debe indicarse la playlist")
	ErrPlaylistNoEncontrada     = errors.New("PLAYLIST_NO_ENCONTRADA: no existe la playlist indicada")
	ErrEnlacePublicoInvalido    = errors.New("PLAYLIST_ENLACE_INVALIDO: el enlace público de la playlist no es válido o ya no está disponible")
	ErrPlaylistItemRequerido    = errors.New("PLAYLIST_ITEM_OBLIGATORIO: debe indicarse el elemento de la playlist")
	ErrPlaylistItemNoEncontrado = errors.New("PLAYLIST_ITEM_NO_ENCONTRADO: no existe el elemento en la playlist")
	ErrOrdenInvalido            = errors.New("PLAYLIST_ORDEN_INVALIDO: la lista de elementos para reordenar está vacía")
)

// ValidarPlaylist valida los campos mínimos para crear o actualizar una playlist
// de repaso (RF-F2-05).
func ValidarPlaylist(estudianteID, nombre string) error {
	if estudianteID == "" {
		return ErrEstudianteRequerido
	}
	if strings.TrimSpace(nombre) == "" {
		return ErrPlaylistNombreRequerido
	}
	if len(nombre) > MaxNombrePlaylist {
		return ErrPlaylistNombreLargo
	}
	return nil
}

// ValidarItemPlaylist valida los campos de un elemento (grabación o fragmento)
// que se agrega a la playlist. segundo_inicio >= 0 representa el fragmento
// dentro de la clase; 0 equivale a reproducir desde el inicio.
func ValidarItemPlaylist(playlistID, claseID string, segundoInicio int32) error {
	if playlistID == "" {
		return ErrPlaylistIDRequerido
	}
	if claseID == "" {
		return ErrClaseRequerida
	}
	if segundoInicio < 0 {
		return ErrSegundoInvalido
	}
	return nil
}