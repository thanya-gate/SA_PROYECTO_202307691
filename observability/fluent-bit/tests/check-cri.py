"""Prueba el parser versionado con la imagen real; requiere Docker."""
import json
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
from textwrap import dedent

source = (Path(__file__).resolve().parents[1] / 'configmap.yaml').read_text()
with TemporaryDirectory() as directory:
    root = Path(directory)
    (root / 'parsers.conf').write_text(dedent(source.split('  parsers-yousac.conf: |\n', 1)[1]))
    log = '[api-gateway] LOGIN_FALLIDO code=SESION_INVALIDA ruta=POST /api/auth/login'
    (root / 'line.log').write_text(f'2026-10-23T13:56:04.290356264Z stderr F {log}\n')
    (root / 'test.conf').write_text('''[SERVICE]
    Flush 1
    Parsers_File /test/parsers.conf
[INPUT]
    Name tail
    Path /test/line.log
    Parser cri
    Read_from_Head On
    Exit_On_Eof On
[OUTPUT]
    Name stdout
    Match *
    Format json_lines
''')
    output = subprocess.check_output(['docker', 'run', '--rm', '-v', f'{root}:/test:ro',
                                     'cr.fluentbit.io/fluent/fluent-bit:5.1.5', '-c', '/test/test.conf'], text=True)
    events = [json.loads(line) for line in output.splitlines() if line.startswith('{')]
    assert len(events) == 1, events
    assert events[0]['log'] == log and events[0]['stream'] == 'stderr', events
    print('CRI: log y stream conservados')
