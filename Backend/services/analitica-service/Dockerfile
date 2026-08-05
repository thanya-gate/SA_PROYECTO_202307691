FROM python:3.12-slim AS runtime
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app:/app/src:/app/gen

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py healthcheck.py ./
COPY gen ./gen
COPY src ./src

# Solo gRPC (east-west). El analitica-service no expone HTTP: el API Gateway
# es el punto de entrada único hacia el cliente web.
EXPOSE 50054

USER nobody

CMD ["python", "main.py"]
