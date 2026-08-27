BEGIN;

DO $$
DECLARE
  v_curso UUID := gen_random_uuid();
  v_clase UUID := gen_random_uuid();
  v_clase_sin_duracion UUID := gen_random_uuid();
  v_capitulo_1 UUID;
  v_capitulo_2 UUID;
  v_capitulo_ignorado UUID;
  v_material UUID;
  v_version INT;
  v_eliminado BOOLEAN;
  v_clase_material UUID;
  v_descargas BIGINT;
  v_actualizado BOOLEAN;
BEGIN
  INSERT INTO curso_catalogo (id, codigo, nombre, escuela)
  VALUES (v_curso, 'TEST-CH', 'Pruebas de capítulos', 'Ingeniería');
  INSERT INTO clase_grabada (id, curso_id, semestre, año, url_video, duracion)
  VALUES (v_clase, v_curso, '2026-2', 2026, '/media/clase.mp4', 60);
  INSERT INTO clase_grabada (id, curso_id, semestre, año, url_video, duracion)
  VALUES (v_clase_sin_duracion, v_curso, '2026-2', 2026, '/media/vacia.mp4', 0);

  CALL sp_crear_capitulo(v_clase, 'Primero', 0, 30, NULL, v_capitulo_1);
  IF NOT EXISTS (SELECT 1 FROM capitulo WHERE id = v_capitulo_1 AND orden = 1) THEN
    RAISE EXCEPTION 'El primer capítulo no recibió orden automático 1';
  END IF;

  -- Los rangos adyacentes comparten frontera, pero no se solapan.
  CALL sp_crear_capitulo(v_clase, 'Segundo', 30, 60, 0, v_capitulo_2);
  IF NOT EXISTS (SELECT 1 FROM capitulo WHERE id = v_capitulo_2 AND orden = 2) THEN
    RAISE EXCEPTION 'El rango adyacente no recibió orden automático 2';
  END IF;

  BEGIN
    CALL sp_crear_capitulo(v_clase, 'Contenido', 10, 20, 3, v_capitulo_ignorado);
    RAISE EXCEPTION 'Se aceptó un rango contenido';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%CONFLICTO%' THEN RAISE; END IF;
  END;
  BEGIN
    CALL sp_crear_capitulo(v_clase, 'Contenedor', 0, 60, 3, v_capitulo_ignorado);
    RAISE EXCEPTION 'Se aceptó un rango contenedor';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%CONFLICTO%' THEN RAISE; END IF;
  END;
  BEGIN
    CALL sp_crear_capitulo(v_clase, 'Mismo', 0, 30, 3, v_capitulo_ignorado);
    RAISE EXCEPTION 'Se aceptó un rango idéntico';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%CONFLICTO%' THEN RAISE; END IF;
  END;
  BEGIN
    CALL sp_crear_capitulo(v_clase, 'Parcial', 20, 40, 3, v_capitulo_ignorado);
    RAISE EXCEPTION 'Se aceptó un rango parcialmente superpuesto';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%CONFLICTO%' THEN RAISE; END IF;
  END;
  BEGIN
    CALL sp_crear_capitulo(v_clase, 'Orden repetido', 60, 60, 1, v_capitulo_ignorado);
    RAISE EXCEPTION 'Se aceptó un fin igual al inicio u orden duplicado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ENTRADA_INVALIDA%' AND SQLERRM NOT LIKE '%CONFLICTO%' THEN RAISE; END IF;
  END;
  BEGIN
    CALL sp_crear_capitulo(v_clase, 'Fuera', 0, 61, 3, v_capitulo_ignorado);
    RAISE EXCEPTION 'Se aceptó un final mayor a la duración';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ENTRADA_INVALIDA%' THEN RAISE; END IF;
  END;
  BEGIN
    CALL sp_crear_capitulo(v_clase_sin_duracion, 'Sin duración', 0, 1, 1, v_capitulo_ignorado);
    RAISE EXCEPTION 'Se segmentó una clase con duración cero';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ENTRADA_INVALIDA%' THEN RAISE; END IF;
  END;
  BEGIN
    CALL sp_crear_capitulo(gen_random_uuid(), 'Clase inexistente', 0, 1, 1, v_capitulo_ignorado);
    RAISE EXCEPTION 'Se aceptó una clase inexistente';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%CLASE_NO_ENCONTRADA%' THEN RAISE; END IF;
  END;

  -- Actualizar el propio rango no debe colisionar consigo mismo.
  CALL sp_actualizar_capitulo(v_capitulo_1, v_clase, 'Primero editado', 0, 30, 1, v_actualizado);
  IF NOT v_actualizado THEN RAISE EXCEPTION 'No se actualizó el capítulo'; END IF;
  BEGIN
    CALL sp_actualizar_capitulo(v_capitulo_1, gen_random_uuid(), 'Clase distinta', 0, 30, 1, v_actualizado);
    RAISE EXCEPTION 'Se actualizó un capítulo con clase distinta';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ENTRADA_INVALIDA%' THEN RAISE; END IF;
  END;

  BEGIN
    UPDATE clase_grabada SET duracion = 29 WHERE id = v_clase;
    RAISE EXCEPTION 'Se redujo la duración por debajo de un capítulo';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ENTRADA_INVALIDA%' THEN RAISE; END IF;
  END;

  CALL sp_registrar_material(v_clase, 'guia.pdf', 'application/pdf', '.pdf', 10, '/media/guia-v1.pdf', v_material);
  CALL sp_agregar_version_material(v_material, 20, '/media/guia-v2.pdf', v_version);
  IF v_version <> 2 THEN RAISE EXCEPTION 'La versión no incrementó a 2'; END IF;
  CALL sp_registrar_descarga_material(v_material, v_descargas);
  IF v_descargas <> 1 THEN RAISE EXCEPTION 'La métrica de descarga no incrementó'; END IF;
  CALL sp_eliminar_material(v_material, v_eliminado, v_clase_material);
  IF NOT v_eliminado OR v_clase_material <> v_clase THEN RAISE EXCEPTION 'La eliminación no devolvió claseId'; END IF;
  IF EXISTS (SELECT 1 FROM material_version WHERE material_id = v_material) THEN
    RAISE EXCEPTION 'Las versiones no se eliminaron en cascada';
  END IF;
END;
$$;

ROLLBACK;
