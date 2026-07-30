FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y gcc postgresql-client && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Preserve the backend.* / backend.app.* package layout so imports in
# main.py and security.py (e.g. `from backend.app.core.config import ...`)
# resolve the same way in the container as they do locally.
COPY ./backend ./backend
COPY ./alembic ./alembic
COPY ./alembic.ini .

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
