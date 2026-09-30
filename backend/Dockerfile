# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential libpq5 curl \
 && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash lynk
WORKDIR /app

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .

RUN chown -R lynk:lynk /app
USER lynk

ENV FLASK_APP=wsgi:app

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
  CMD curl -fsS http://localhost:5000/api/v1/health || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "3", "--timeout", "60", "--access-logfile", "-", "--error-logfile", "-", "wsgi:app"]
