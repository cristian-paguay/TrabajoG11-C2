# TrabajoG11-C2
Ejercicio Práctico Grupo 11 - Tratamiento de Datos

Dashboard financiero en tiempo real construido con **FastAPI** y **React + Vite**.  
Extrae las 10 acciones más activas de Yahoo Finance, las enriquece con datos de mercado via yfinance, y las visualiza en un dashboard interactivo con gráficos de precio e histórico comparativo.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Backend | Python 3.11 · FastAPI · uvicorn |
| Data | pandas · yfinance · BeautifulSoup4 |
| Base de datos | SQLite · SQLAlchemy |
| Frontend | React 18 · Vite 5 · Recharts · Axios |
| Estilos | CSS plano con variables (sin frameworks) |
| Infraestructura | Docker · Docker Compose · nginx |

---

## Docker

### Requisitos

- Docker 24+
- Docker Compose v2

### Levantar todo

```bash
docker compose up --build
```

| Servicio | URL |
|---|---|
| Frontend | `http://localhost:3000` |
| Backend API | `http://localhost:8000` |
| Docs interactivos | `http://localhost:8000/docs` |

### Arquitectura Docker

```
Browser → localhost:3000 → nginx (frontend container)
                               │
                               ├── /          → archivos estáticos (React build)
                               └── /api/*     → rewrite → backend:8000/* (red interna Docker)
```

- El frontend se construye con Vite en una imagen multi-stage y se sirve con **nginx**.
- Las llamadas a `/api/*` son redirigidas internamente por nginx al servicio `backend` — el navegador nunca habla directo con el puerto 8000.
- nginx usa el resolver interno de Docker (`127.0.0.11`) para resolver el hostname `backend` en tiempo de request, no al arrancar.
- La base de datos SQLite persiste en un volumen Docker (`db_data`) — los datos sobreviven reinicios.

### Comandos útiles

```bash
# Detener contenedores
docker compose down

# Detener y borrar base de datos
docker compose down -v

# Ver logs en tiempo real
docker compose logs -f

# Reconstruir solo el backend
docker compose up --build backend
```

---

## Base de datos SQL (SQLite)

La app usa **SQLite** vía **SQLAlchemy ORM**. El archivo `financial_data.db` se crea automáticamente al iniciar el backend.

### Tabla `companies`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INTEGER PK | Autoincremental |
| `ticker` | STRING UNIQUE | Símbolo bursátil (ej: `AAPL`) |
| `name` | STRING | Nombre de la empresa |
| `price` | FLOAT | Precio actual de la acción |
| `change_percent` | FLOAT | Variación porcentual del día |
| `market_cap` | STRING | Capitalización de mercado |
| `sector` | STRING | Sector económico |

### Flujo de datos

1. Al arrancar el backend, SQLAlchemy crea la tabla si no existe (`Base.metadata.create_all`).
2. `GET /companies` consulta la tabla — si está vacía, dispara el scraper de Yahoo Finance + enriquecimiento con `yfinance` y guarda los resultados.
3. `POST /refresh` borra todos los registros y repite el proceso de scraping, forzando datos frescos.
4. `db.merge()` se usa al insertar para evitar errores de clave duplicada si un ticker ya existe.

---

## Estructura del proyecto

```
financial-dashboard/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── main.py           # Aplicación FastAPI y endpoints
│   ├── scraper.py        # Scraping de Yahoo Finance
│   ├── finance.py        # Enriquecimiento con yfinance
│   ├── models.py         # Modelos SQLAlchemy + Pydantic
│   ├── financial_data.db # SQLite (generado en runtime)
│   └── requirements.txt
└── frontend/
    ├── Dockerfile
    ├── .dockerignore
    ├── nginx.conf        # Proxy /api/* → backend:8000 en producción
    ├── index.html
    ├── package.json
    ├── vite.config.js    # Proxy /api/* → localhost:8000 en desarrollo
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api.js
        ├── index.css
        └── components/
            ├── PriceChart.jsx
            ├── CompareChart.jsx
            └── CompanyTable.jsx
```

---

## Instalación

### Requisitos previos

- Python 3.11+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

> **CPU antigua (sin AVX-512):** Si hay errores al importar numpy, el `requirements.txt` ya incluye `numpy<2.0` para prevenirlo. Si el problema persiste:
> ```bash
> pip install "numpy<2.0"
> ```

### Frontend

```bash
cd frontend
npm install
```

---

## Uso

Abrir dos terminales desde la raíz del proyecto.

**Terminal 1 — Backend:**
```bash
cd backend
source .venv/bin/activate
python main.py
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Abrir en el navegador: `http://localhost:5173`

> La primera carga tarda 20–40 segundos mientras el scraper extrae y enriquece los datos de las 10 empresas.

---

## Endpoints de la API

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Estado del servidor |
| `GET` | `/companies` | Top 10 empresas scrapeadas y enriquecidas |
| `GET` | `/prices/{ticker}` | Historial OHLCV · params: `period`, `interval` |
| `GET` | `/compare` | Cambio % comparativo · param: `period` |
| `GET` | `/export-csv` | Descarga el DataFrame como CSV |
| `POST` | `/refresh` | Limpia el caché y fuerza nuevo scrape |

Parámetro `period`: `5d` · `1mo` · `3mo` · `6mo` · `1y`  
Parámetro `interval`: `1d` · `1wk`

Documentación interactiva disponible en `http://localhost:8000/docs`

---

## Funcionalidades

- Scraping automático de las 10 acciones más activas del día
- Enriquecimiento con sector, P/E, beta, capitalización y rango 52 semanas
- Gráfico de precio de cierre con indicador de cambio porcentual
- Comparación visual de rendimiento entre las 10 empresas
- Selector de período interactivo (5d a 1 año)
- Exportación a CSV desde el dashboard o vía endpoint
- Refresco manual de datos con un clic
- Indicador de estado de conexión con el backend

---

## Notas de desarrollo

- El caché es **en memoria** — se pierde al reiniciar el servidor. Llamar `POST /refresh` o reiniciar reconstruye los datos.
- El proxy de Vite (`/api → http://127.0.0.1:8000`) usa IPv4 explícito para evitar conflictos con Node.js 17+ que resuelve `localhost` como `::1`.
- Los estilos usan CSS puro con variables (`--accent`, `--bg`, `--border`, etc.) sin PostCSS ni Tailwind para garantizar compatibilidad en cualquier entorno.
