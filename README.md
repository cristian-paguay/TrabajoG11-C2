# TrabajoG11-C2
Ejercicio Práctico Grupo 11 - Tratamiento de Datos

# Dashboard Financiero

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

## Cómo funciona la obtención de datos

La aplicación obtiene datos en dos etapas secuenciales. Primero hace scraping de Yahoo Finance para identificar qué empresas son de interés, y luego consume la API de yfinance para enriquecer esos datos con información financiera detallada. Ambas etapas ocurren en el backend antes de que el frontend reciba cualquier dato.

### Etapa 1 — Scraping de Yahoo Finance

**Archivo:** `backend/scraper.py`  
**URL objetivo:** `https://finance.yahoo.com/most-active/`

Yahoo Finance publica en esta página un ranking público de las acciones con mayor volumen de operaciones del día. No requiere autenticación ni API key. La página entrega una tabla HTML con columnas de ticker, nombre, precio, variación absoluta, variación porcentual y volumen.

El proceso de scraping funciona de la siguiente manera. Primero se hace una petición HTTP GET con `requests` usando headers que simulan un navegador real, lo cual es necesario porque Yahoo Finance bloquea peticiones que no incluyen un `User-Agent` válido:

```python
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...",
    "Accept-Language": "en-US,en;q=0.9",
}
response = requests.get("https://finance.yahoo.com/most-active/", headers=HEADERS)
```

El HTML de respuesta se parsea con **BeautifulSoup4**, que construye un árbol del documento y permite seleccionar elementos con selectores CSS. Las filas de la tabla se extraen con:

```python
soup = BeautifulSoup(response.text, "html.parser")
rows = soup.select("table tbody tr")
```

Cada fila contiene celdas `<td>` en este orden:

| Índice | Contenido | Ejemplo |
|---|---|---|
| `cols[0]` | Símbolo bursátil (ticker) | `NVDA` |
| `cols[1]` | Nombre de la empresa | `NVIDIA Corporation` |
| `cols[2]` | Precio actual | `875.40` |
| `cols[3]` | Variación absoluta en USD | `+27.30` |
| `cols[4]` | Variación porcentual | `+3.21%` |
| `cols[5]` | Volumen del día | `45.3M` |

Los valores de precio y porcentaje se limpian con la función `_clean_number`, que elimina caracteres como `$`, `,`, `+`, `%` antes de convertir a float:

```python
def _clean_number(val: str) -> float | None:
    cleaned = re.sub(r'[$,+%\s]', '', str(val))
    return float(cleaned)
```

**Selección de las 10 empresas de interés**

El criterio de selección es la volatilidad del día medida por el valor absoluto del cambio porcentual. Se calcula un campo `indicator_score = abs(change_pct_num)` y se ordenan todas las empresas de mayor a menor, tomando las primeras 10. La lógica detrás es que las acciones con mayor movimiento porcentual en el día son las más relevantes para análisis de corto plazo y comparación de rendimiento.

```python
df["indicator_score"] = df["change_pct_num"].abs()
df = df.sort_values("indicator_score", ascending=False).head(10)
```

**Fallback para cambios de HTML**

Yahoo Finance actualiza su estructura HTML con frecuencia. El scraper incluye un método `_scrape_fallback` que intenta selectores alternativos basados en atributos `data-field` cuando la tabla principal no se encuentra. Si ambos métodos fallan, el servidor lanza una excepción con un mensaje descriptivo.

---

### Etapa 2 — Enriquecimiento con yfinance

**Archivo:** `backend/finance.py`  
**Librería:** [`yfinance`](https://github.com/ranaroussi/yfinance)

yfinance es una librería de Python de código abierto que actúa como cliente no oficial de la API de Yahoo Finance. No requiere registro ni API key. Internamente hace peticiones a los endpoints JSON de Yahoo Finance que el sitio web usa para sus propios gráficos.

Tras el scraping se tiene una lista de 10 tickers con precio y variación del día, pero sin contexto financiero. El enriquecimiento agrega datos fundamentales y de mercado para cada ticker usando el objeto `yf.Ticker`:

```python
info = yf.Ticker("NVDA").info
```

El objeto `.info` es un diccionario con más de 100 campos. Los que usa esta aplicación son:

| Campo en `.info` | Campo en la app | Descripción |
|---|---|---|
| `currentPrice` | `price` | Precio actual (respaldo si el scraper falla) |
| `regularMarketPrice` | `price` | Precio de mercado en tiempo real |
| `marketCap` | `market_cap` | Capitalización de mercado en USD |
| `sector` | `sector` | Sector económico (Technology, Healthcare, etc.) |
| `trailingPE` | `pe_ratio` | Ratio precio/beneficio de los últimos 12 meses |
| `fiftyTwoWeekHigh` | `week52_high` | Máximo precio en los últimos 52 semanas |
| `fiftyTwoWeekLow` | `week52_low` | Mínimo precio en los últimos 52 semanas |
| `beta` | `beta` | Volatilidad relativa respecto al mercado (S&P 500) |

**Precio como campo de respaldo**

El precio que entrega el scraper puede ser `None` si Yahoo Finance cambia el índice de columnas de su tabla según la región o el idioma del servidor. Para garantizar que el precio siempre esté disponible, el enriquecimiento detecta este caso y lo rellena desde yfinance:

```python
if scraped_price is None or pd.isna(scraped_price):
    yf_price = (
        info.get("currentPrice")
        or info.get("regularMarketPrice")
        or info.get("previousClose")
    )
    extra["price"] = float(yf_price) if yf_price else None
```

**Historial de precios OHLCV**

El endpoint `/prices/{ticker}` usa el método `.history()` de yfinance para obtener datos OHLCV (Open, High, Low, Close, Volume) en el período e intervalo solicitados:

```python
hist = yf.Ticker("NVDA").history(period="1mo", interval="1d")
```

Los parámetros disponibles para `period` son `5d`, `1mo`, `3mo`, `6mo` y `1y`. Para `interval` se soportan `1d` (diario) y `1wk` (semanal). El DataFrame resultante tiene un índice de tipo `DatetimeTZDtype` con timezone UTC, que se normaliza a string `YYYY-MM-DD` antes de serializar:

```python
hist["Date"] = hist["Date"].astype(str).str[:10]
```

Esta normalización es importante porque sin ella el frontend recibe fechas como `2024-03-18 00:00:00+00:00`, lo que hace que el eje X del gráfico muestre `00:00` en lugar de la fecha legible.

**Comparación de rendimiento**

El endpoint `/compare` calcula el cambio porcentual de precio en el período para cada una de las 10 empresas. Usa el primer y último cierre del historial:

```python
pct_change = ((end_price - start_price) / start_price) * 100
```

Esto permite comparar el rendimiento relativo entre empresas independientemente de su precio absoluto. Una acción de $1,000 y una de $10 son directamente comparables en porcentaje.

---

### Flujo completo de datos

```
Yahoo Finance (HTML)
        ↓
    scraper.py
    BeautifulSoup4 parsea la tabla
    Selecciona top 10 por |% cambio|
        ↓
    DataFrame pandas (10 filas)
    ticker | name | price | change_pct | volume | indicator_score
        ↓
    finance.py
    yf.Ticker(ticker).info → sector, P/E, beta, market_cap, 52w
    yf.Ticker(ticker).history() → OHLCV por período
        ↓
    DataFrame enriquecido (10 filas, 13 columnas)
        ↓
    Caché en memoria (_cache["df"])
        ↓
    FastAPI serializa a JSON
        ↓
    React renderiza tabla + gráficos
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

> **CPU antigua (sin AVX-512):** El `requirements.txt` incluye `numpy<2.0`. Si el error persiste al importar: `pip install "numpy<2.0"`

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
- yfinance es una librería no oficial. Yahoo Finance puede cambiar sus endpoints internos sin previo aviso, lo que puede causar errores temporales en `.info` o `.history()`. En ese caso esperar unos minutos y llamar `POST /refresh`.

## Funcionamiento en red LAN
<img width="1359" height="681" alt="image" src="https://github.com/user-attachments/assets/bf9a014a-fd99-4418-b806-e5e53c2f8e91" />
<img width="1362" height="672" alt="image" src="https://github.com/user-attachments/assets/748c3af5-1cfc-4ac4-b2b0-c9a7eab01ae0" />


## Análisis de seguridad — `POST /refresh`

En esta sección se realiza un análisis de las brechas de seguridad existentes en el proyecto, contemplando como punto de partida la siguiente pregunta:
¿Cómo podría un atacante abusar de este endpoint para forzar ejecuciones repetidas del proceso completo y qué impacto tendría esto en el rendimiento del sistema, el consumo de recursos y la disponibilidad del servicio?

### El problema

El endpoint no tiene ningún mecanismo de protección:

```python
@app.post("/refresh")
def refresh_data():
    _cache["df"] = None
    get_df()  # bloquea el hilo hasta completar scraping + yfinance
    return {"status": "actualizado", "count": int(len(_cache["df"]))}
```

Cualquier cliente que pueda alcanzar el servidor puede llamarlo ilimitadamente, de forma simultánea, sin autenticación ni restricción de frecuencia.

---

### Cómo lo explotaría un atacante

**Ataque de agotamiento de recursos (Resource Exhaustion)**

El vector más simple es enviar peticiones concurrentes en volumen:

```bash
# 50 peticiones simultáneas en bucle continuo
while true; do
  for i in $(seq 1 50); do
    curl -s -X POST http://servidor:8000/refresh &
  done
  wait
done
```

Cada llamada ejecuta secuencialmente:

1. Una petición HTTP a `finance.yahoo.com/most-active/` con parseo de HTML
2. Diez llamadas separadas a `yf.Ticker(ticker).info` — una por empresa
3. Construcción y escritura de un DataFrame de pandas en memoria

Con un solo worker, FastAPI procesa las peticiones de forma síncrona. Cada ejecución completa tarda entre 20 y 40 segundos. Con peticiones concurrentes, los workers se saturan y la cola de peticiones crece sin límite.

**Ataque de carrera sobre el caché (Race Condition)**

El caché se implementa con un diccionario Python simple:

```python
_cache: dict = {"df": None}

def get_df():
    if _cache["df"] is None:       # ← lectura
        df = scrape_top_companies()
        df = enrich_with_yfinance(df)
        _cache["df"] = df          # ← escritura
    return _cache["df"]
```

Con múltiples peticiones concurrentes, varios workers pueden pasar la comprobación `if _cache["df"] is None` simultáneamente antes de que ninguno complete la escritura. El resultado es que el proceso de scraping y enriquecimiento se ejecuta N veces en paralelo — una vez por petición concurrente que pasó la verificación — multiplicando el consumo de CPU, memoria y conexiones de red por N.

---

### Impacto en rendimiento, recursos y disponibilidad

**CPU y memoria**

Cada ejecución de `enrich_with_yfinance` construye un DataFrame nuevo en memoria y ejecuta diez instancias de `yf.Ticker().info`, cada una de las cuales abre conexiones HTTP, parsea JSON y construye estructuras de datos internas de pandas. Con 20 peticiones concurrentes activas, el proceso Python puede consumir varios cientos de MB de RAM y llevar la CPU al 100% en un servidor de recursos modestos.

**Conexiones de red hacia yfinance**

yfinance no tiene rate limiting documentado públicamente, pero implementa throttling silencioso: cuando detecta demasiadas peticiones desde la misma IP en un intervalo corto, comienza a devolver respuestas vacías o errores HTTP 429/403. Un atacante que fuerce ejecuciones repetidas de `/refresh` no solo degrada el servidor propio sino que quema el cupo de peticiones disponibles hacia Yahoo Finance, dejando a todos los usuarios con datos vacíos o caché corrupto hasta que el throttle se libere — típicamente varios minutos.

**Disponibilidad del servicio (DoS efectivo)**

Dado que `get_df()` es una función síncrona que bloquea el hilo durante 20–40 segundos, y uvicorn por defecto levanta un número limitado de workers, un atacante con una conexión de red estable puede monopolizar todos los workers disponibles con peticiones a `/refresh` y dejar sin capacidad de respuesta a los endpoints legítimos como `/companies`, `/prices` o `/compare`. Esto constituye un Denial of Service efectivo sin necesidad de generar un volumen anormal de tráfico — basta con mantener ocupados los workers con operaciones lentas.

---

### Mitigaciones

**1. Rate limiting por IP**

La solución más directa es usar `slowapi`, que integra rate limiting en FastAPI con una línea por endpoint:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/refresh")
@limiter.limit("1/minute")  # máximo 1 refresh por IP por minuto
def refresh_data(request: Request):
    ...
```

**2. Autenticación con API key**

Proteger el endpoint con un header secreto que solo conozcan los clientes autorizados:

```python
from fastapi import Header, HTTPException
import os

API_KEY = os.environ.get("REFRESH_API_KEY", "")

@app.post("/refresh")
def refresh_data(x_api_key: str = Header(...)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="No autorizado")
    ...
```

**3. Bloqueo con estado de ejecución**

Evitar ejecuciones simultáneas con un flag de bloqueo, de forma que si ya hay un refresh en curso las peticiones adicionales devuelvan inmediatamente sin lanzar otro proceso:

```python
import threading

_cache = {"df": None, "refreshing": False}
_lock  = threading.Lock()

@app.post("/refresh")
def refresh_data():
    with _lock:
        if _cache["refreshing"]:
            return {"status": "en_progreso", "message": "Ya hay un refresh en curso"}
        _cache["refreshing"] = True
    try:
        _cache["df"] = None
        get_df()
        return {"status": "actualizado", "count": int(len(_cache["df"]))}
    finally:
        _cache["refreshing"] = False
```

**4. Refresh automático programado en lugar de endpoint público**

La solución arquitectónica más limpia es eliminar el endpoint público completamente y mover el refresh a un scheduler interno que corra en horario de mercado:

```python
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()
scheduler.add_job(
    lambda: (_cache.update({"df": None}), get_df()),
    "cron",
    hour="9-16",
    minute="*/30"
)
scheduler.start()
```

Esto elimina la superficie de ataque por completo: ningún cliente externo puede disparar el proceso — solo el reloj interno del servidor.

---

### Resumen del riesgo

| Vector | Probabilidad | Impacto |
|---|---|---|
| DoS por saturación de workers | Alta — endpoint público sin auth | Servicio inaccesible para usuarios legítimos |
| Agotamiento de rate limit de yfinance | Alta — 10 llamadas por refresh | Datos vacíos para todos los usuarios |
| Race condition en caché | Media — requiere concurrencia | Múltiples scrapers simultáneos, CPU/RAM al límite |
| Abuso desde red LAN | Alta — servidor escucha en `0.0.0.0` | Cualquier dispositivo en la red local puede atacarlo |

El último punto es especialmente relevante dado que el servidor está configurado con `host="0.0.0.0"` y es visible en la red LAN. En un entorno de producción, el endpoint `/refresh` debería estar protegido con al menos autenticación por API key y rate limiting antes de exponerse a cualquier red.
