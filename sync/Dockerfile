FROM python:3.11-slim

WORKDIR /app
COPY pyproject.toml ./
RUN pip install --no-cache-dir \
      "httpx==0.27.2" \
      "sqlalchemy==2.0.36" \
      "psycopg[binary]==3.2.3" \
      "pydantic==2.9.2" \
      "feedparser==6.0.11" \
      "python-dateutil==2.9.0.post0"

COPY src ./src

ENV PYTHONUNBUFFERED=1
CMD ["python", "-m", "src.main"]
