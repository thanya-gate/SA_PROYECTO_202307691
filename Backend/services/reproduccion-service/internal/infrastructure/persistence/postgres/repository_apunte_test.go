package postgres

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"yousac.com/yousac/reproduccion-service/internal/domain"
)

type filaFalsa struct {
	valores []any
	err     error
}

func (f filaFalsa) Scan(destinos ...any) error {
	if f.err != nil {
		return f.err
	}
	return asignarFila(destinos, f.valores)
}

type filasFalsas struct {
	filas   [][]any
	indice  int
	err     error
	scanErr error
	cerrada bool
}

func nuevasFilasFalsas(filas ...[]any) *filasFalsas {
	return &filasFalsas{filas: filas, indice: -1}
}

func (f *filasFalsas) Close()                                       { f.cerrada = true }
func (f *filasFalsas) Err() error                                   { return f.err }
func (f *filasFalsas) CommandTag() pgconn.CommandTag                { return pgconn.NewCommandTag("SELECT") }
func (f *filasFalsas) FieldDescriptions() []pgconn.FieldDescription { return nil }
func (f *filasFalsas) RawValues() [][]byte                          { return nil }
func (f *filasFalsas) Conn() *pgx.Conn                              { return nil }

func (f *filasFalsas) Next() bool {
	if f.cerrada {
		return false
	}
	siguiente := f.indice + 1
	if siguiente >= len(f.filas) {
		f.cerrada = true
		return false
	}
	f.indice = siguiente
	return true
}

func (f *filasFalsas) Scan(destinos ...any) error {
	if f.scanErr != nil {
		return f.scanErr
	}
	if f.indice < 0 || f.indice >= len(f.filas) {
		return errors.New("no hay una fila activa")
	}
	return asignarFila(destinos, f.filas[f.indice])
}

func (f *filasFalsas) Values() ([]any, error) {
	if f.indice < 0 || f.indice >= len(f.filas) {
		return nil, errors.New("no hay una fila activa")
	}
	return f.filas[f.indice], nil
}

func asignarFila(destinos, valores []any) error {
	if len(destinos) != len(valores) {
		return fmt.Errorf("cantidad de destinos %d, valores %d", len(destinos), len(valores))
	}
	for i, destino := range destinos {
		puntero := reflect.ValueOf(destino)
		if puntero.Kind() != reflect.Pointer || puntero.IsNil() {
			return fmt.Errorf("destino %d no es un puntero", i)
		}
		valor := reflect.ValueOf(valores[i])
		if !valor.IsValid() || !valor.Type().AssignableTo(puntero.Elem().Type()) {
			return fmt.Errorf("valor %d incompatible con %s", i, puntero.Elem().Type())
		}
		puntero.Elem().Set(valor)
	}
	return nil
}

type dbFalsa struct {
	queryRow func(context.Context, string, ...any) pgx.Row
	query    func(context.Context, string, ...any) (pgx.Rows, error)
	exec     func(context.Context, string, ...any) (pgconn.CommandTag, error)
}

func (d *dbFalsa) Ping(context.Context) error { return nil }

func (d *dbFalsa) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	if d.queryRow == nil {
		return filaFalsa{err: errors.New("QueryRow inesperado")}
	}
	return d.queryRow(ctx, sql, args...)
}

func (d *dbFalsa) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	if d.query == nil {
		return nil, errors.New("Query inesperado")
	}
	return d.query(ctx, sql, args...)
}

func (d *dbFalsa) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	if d.exec == nil {
		return pgconn.CommandTag{}, errors.New("Exec inesperado")
	}
	return d.exec(ctx, sql, args...)
}

func valoresApunte(titulo string) []any {
	return []any{
		"apunte-1", "estudiante-1", "clase-1", titulo, "[01:30] concepto",
		int32(90), "2026-09-01T10:00:00Z", "2026-09-01T10:05:00Z",
	}
}

func TestGuardarApunteCreaYMapeaLaFila(t *testing.T) {
	var consulta string
	var argumentos []any
	db := &dbFalsa{queryRow: func(_ context.Context, sql string, args ...any) pgx.Row {
		consulta = sql
		argumentos = args
		return filaFalsa{valores: valoresApunte("Resumen")}
	}}
	repositorio := NewReproduccionRepository(db)

	apunte, err := repositorio.GuardarApunte(
		context.Background(), "estudiante-1", "", "clase-1", "Resumen", "[01:30] concepto", 90,
	)
	if err != nil {
		t.Fatalf("GuardarApunte() error = %v", err)
	}
	if !strings.Contains(consulta, "INSERT INTO apunte") {
		t.Fatalf("consulta = %q, se esperaba INSERT", consulta)
	}
	wantArgs := []any{"estudiante-1", "clase-1", "Resumen", "[01:30] concepto", int32(90)}
	if !reflect.DeepEqual(argumentos, wantArgs) {
		t.Fatalf("argumentos = %#v, want %#v", argumentos, wantArgs)
	}
	if apunte.ApunteID != "apunte-1" || apunte.EstudianteID != "estudiante-1" || apunte.PosicionSegundos != 90 {
		t.Fatalf("apunte mapeado = %#v", apunte)
	}
}

func TestGuardarApunteActualizaSoloElRegistroDelEstudiante(t *testing.T) {
	var consulta string
	var argumentos []any
	db := &dbFalsa{queryRow: func(_ context.Context, sql string, args ...any) pgx.Row {
		consulta = sql
		argumentos = args
		return filaFalsa{valores: valoresApunte("Editado")}
	}}
	repositorio := NewReproduccionRepository(db)

	apunte, err := repositorio.GuardarApunte(
		context.Background(), "estudiante-1", "apunte-1", "clase-1", "Editado", "[01:30] concepto", 90,
	)
	if err != nil {
		t.Fatalf("GuardarApunte() error = %v", err)
	}
	if !strings.Contains(consulta, "WHERE id = $1 AND estudiante_id = $2") {
		t.Fatalf("la consulta no aisla el apunte por estudiante: %q", consulta)
	}
	wantArgs := []any{"apunte-1", "estudiante-1", "Editado", "[01:30] concepto", int32(90)}
	if !reflect.DeepEqual(argumentos, wantArgs) {
		t.Fatalf("argumentos = %#v, want %#v", argumentos, wantArgs)
	}
	if apunte.Titulo != "Editado" {
		t.Fatalf("Titulo = %q", apunte.Titulo)
	}
}

func TestGuardarApunteMapeaAusenciaYErrorDeBaseDeDatos(t *testing.T) {
	db := &dbFalsa{queryRow: func(context.Context, string, ...any) pgx.Row {
		return filaFalsa{err: pgx.ErrNoRows}
	}}
	repositorio := NewReproduccionRepository(db)
	_, err := repositorio.GuardarApunte(
		context.Background(), "estudiante-1", "apunte-ausente", "clase-1", "T", "C", 0,
	)
	if !errors.Is(err, domain.ErrApunteNoEncontrado) {
		t.Fatalf("error = %v, want %v", err, domain.ErrApunteNoEncontrado)
	}

	db.queryRow = func(context.Context, string, ...any) pgx.Row {
		return filaFalsa{err: errors.New("base no disponible")}
	}
	_, err = repositorio.GuardarApunte(
		context.Background(), "estudiante-1", "", "clase-1", "T", "C", 0,
	)
	if err == nil || !strings.Contains(err.Error(), "crear apunte: base no disponible") {
		t.Fatalf("error = %v", err)
	}
}

func TestListarApuntesFiltraPorEstudianteYClase(t *testing.T) {
	tests := []struct {
		nombre       string
		claseID      string
		fragmentoSQL string
		argumentos   []any
	}{
		{nombre: "todas las clases", fragmentoSQL: "WHERE estudiante_id = $1", argumentos: []any{"estudiante-1"}},
		{nombre: "una clase", claseID: "clase-1", fragmentoSQL: "WHERE estudiante_id = $1 AND clase_id = $2", argumentos: []any{"estudiante-1", "clase-1"}},
	}

	for _, tt := range tests {
		t.Run(tt.nombre, func(t *testing.T) {
			filas := nuevasFilasFalsas(valoresApunte("Resumen"))
			db := &dbFalsa{query: func(_ context.Context, sql string, args ...any) (pgx.Rows, error) {
				if !strings.Contains(sql, tt.fragmentoSQL) || !strings.Contains(sql, "ORDER BY fecha_actualizacion DESC") {
					t.Fatalf("consulta inesperada: %q", sql)
				}
				if !reflect.DeepEqual(args, tt.argumentos) {
					t.Fatalf("argumentos = %#v, want %#v", args, tt.argumentos)
				}
				return filas, nil
			}}
			repositorio := NewReproduccionRepository(db)

			apuntes, err := repositorio.ListarApuntes(context.Background(), "estudiante-1", tt.claseID)
			if err != nil {
				t.Fatalf("ListarApuntes() error = %v", err)
			}
			if len(apuntes) != 1 || apuntes[0].ApunteID != "apunte-1" {
				t.Fatalf("apuntes = %#v", apuntes)
			}
			if !filas.cerrada {
				t.Fatal("las filas no fueron cerradas")
			}
		})
	}
}

func TestListarApuntesPropagaErroresDeConsultaLecturaEIteracion(t *testing.T) {
	db := &dbFalsa{query: func(context.Context, string, ...any) (pgx.Rows, error) {
		return nil, errors.New("consulta fallida")
	}}
	repositorio := NewReproduccionRepository(db)
	if _, err := repositorio.ListarApuntes(context.Background(), "estudiante-1", ""); err == nil || !strings.Contains(err.Error(), "listar apuntes") {
		t.Fatalf("error de consulta = %v", err)
	}

	db.query = func(context.Context, string, ...any) (pgx.Rows, error) {
		filas := nuevasFilasFalsas(valoresApunte("Resumen"))
		filas.scanErr = errors.New("lectura fallida")
		return filas, nil
	}
	if _, err := repositorio.ListarApuntes(context.Background(), "estudiante-1", ""); err == nil || !strings.Contains(err.Error(), "leer apuntes") {
		t.Fatalf("error de lectura = %v", err)
	}

	db.query = func(context.Context, string, ...any) (pgx.Rows, error) {
		filas := nuevasFilasFalsas()
		filas.err = errors.New("iteracion fallida")
		return filas, nil
	}
	if _, err := repositorio.ListarApuntes(context.Background(), "estudiante-1", ""); err == nil || !strings.Contains(err.Error(), "iterar apuntes") {
		t.Fatalf("error de iteracion = %v", err)
	}
}

func TestEliminarApunteUsaEstudianteYReportaFilasAfectadas(t *testing.T) {
	llamadas := 0
	db := &dbFalsa{exec: func(_ context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
		llamadas++
		if sql != "DELETE FROM apunte WHERE id = $1 AND estudiante_id = $2" {
			t.Fatalf("consulta = %q", sql)
		}
		if !reflect.DeepEqual(args, []any{"apunte-1", "estudiante-1"}) {
			t.Fatalf("argumentos = %#v", args)
		}
		if llamadas == 1 {
			return pgconn.NewCommandTag("DELETE 1"), nil
		}
		return pgconn.NewCommandTag("DELETE 0"), nil
	}}
	repositorio := NewReproduccionRepository(db)

	eliminado, err := repositorio.EliminarApunte(context.Background(), "estudiante-1", "apunte-1")
	if err != nil || !eliminado {
		t.Fatalf("EliminarApunte() = %v, %v", eliminado, err)
	}
	eliminado, err = repositorio.EliminarApunte(context.Background(), "estudiante-1", "apunte-1")
	if err != nil || eliminado {
		t.Fatalf("EliminarApunte() sin fila = %v, %v", eliminado, err)
	}

	db.exec = func(context.Context, string, ...any) (pgconn.CommandTag, error) {
		return pgconn.CommandTag{}, errors.New("delete fallido")
	}
	if _, err := repositorio.EliminarApunte(context.Background(), "estudiante-1", "apunte-1"); err == nil || !strings.Contains(err.Error(), "eliminar apunte") {
		t.Fatalf("error = %v", err)
	}
}
