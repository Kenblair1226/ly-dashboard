FROM python:3.11-slim

WORKDIR /app
RUN pip install --no-cache-dir \
      "fastapi==0.115.5" \
      "uvicorn[standard]==0.32.1" \
      "sqlalchemy==2.0.36" \
      "psycopg[binary]==3.2.3" \
      "pydantic==2.9.2"

COPY src ./src

ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
