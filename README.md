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
| Frontend | React 18 · Vite 5 · Recharts · Axios |
| Estilos | CSS plano con variables (sin frameworks) |

---

## Estructura del proyecto

```
financial-dashboard/
├── backend/
│   ├── main.py           # Aplicación FastAPI y endpoints
│   ├── scraper.py        # Scraping de Yahoo Finance
│   ├── finance.py        # Enriquecimiento con yfinance
│   ├── models.py         # Modelos Pydantic
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
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
