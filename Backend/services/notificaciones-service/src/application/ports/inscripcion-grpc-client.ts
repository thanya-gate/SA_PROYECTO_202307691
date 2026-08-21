export interface InscripcionGrpcClient {
  listarEstudiantesDeCurso(cursoId: string, semestre: string): Promise<string[]>;
  listarCursos(): Promise<Array<{ cursoId: string; codigo: string }>>;
}
