FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin proj-bin libproj-dev proj-data libgeos-dev build-essential \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

ENV PORT=8000
CMD ["sh", "-c", "uvicorn app_API:app --host 0.0.0.0 --port ${PORT}"]
