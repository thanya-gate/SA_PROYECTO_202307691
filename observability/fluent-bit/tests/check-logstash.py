"""Genera un pipeline aislado; ejecutarlo con Logstash 8.15.3, sin Elasticsearch."""
from pathlib import Path

source = (Path(__file__).resolve().parents[3] / 'infra/ansible/roles/elk/templates/logstash.conf.j2').read_text()
filters = source[source.index('filter {'):source.index('\noutput {')]
print('''input { generator { count => 1 lines => ['{"log":"[api-gateway] LOGIN_FALLIDO code=UNAUTHORIZED ruta=POST /api/auth/login ip=127.0.0.1","stream":"stderr","source":"yousac-gke"}'] codec => json } }''')
print(filters)
print('''filter { ruby { code => 'raise "service" unless event.get("service") == "api-gateway"; raise "message" unless event.get("message").start_with?("LOGIN_FALLIDO"); raise "security_event" unless event.get("security_event") == "login_no_autorizado"; raise "stream" unless event.get("stream") == "stderr"' } }
output { stdout { codec => json_lines } }''')
