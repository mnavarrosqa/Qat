# Qat

Qat es un harness simple para ayudar a QA manuales a convertir tickets en planes/casos de prueba, sincronizarlos con Xray y publicar ejecuciones, resultados y evidencias nuevamente en Jira.

Está pensado para funcionar **sin API de Claude**: usa `claude` por CLI cuando la empresa ya provee acceso de esa forma. La arquitectura queda abierta a otros proveedores.

## Estado actual

Versión **0.3.0**.

Incluye:

- lectura de tickets Jira Cloud;
- generación de casos con Claude CLI;
- salida Markdown para revisión humana;
- salida JSON estructurada para Xray;
- creación y actualización idempotente de issues tipo `Test`;
- link automático entre ticket origen y Test;
- creación de issues tipo `Test Execution`;
- resultados `PASS`, `FAIL`, `BLOCKED` y `TODO` por caso;
- evidencias adjuntas a la ejecución;
- comentario final automático en el ticket origen;
- caché local y presupuesto de contexto para reducir tokens;
- modo `--dry-run` para inspeccionar cambios antes de tocar Jira.

## Requisitos

- Node.js 18+
- Claude CLI instalado y autenticado (`claude --version`)
- Jira Cloud accesible por REST
- Xray instalado/configurado en Jira para usar `xray-sync` y `execute`

> La versión actual usa Jira REST API v3. Jira Server/Data Center necesitará un adapter específico.

## Instalación

```bash
git clone https://github.com/mnavarrosqa/Qat.git
cd Qat
npm install
cp .env.example .env
```

Editá `.env` con tus credenciales/configuración.

## Configuración mínima

```env
LLM_PROVIDER=claude-cli
CLAUDE_COMMAND=claude

JIRA_BASE_URL=https://tuempresa.atlassian.net
JIRA_EMAIL=tu.email@empresa.com
JIRA_API_TOKEN=tu_token

XRAY_ENABLED=true
XRAY_TEST_ISSUE_TYPE=Test
XRAY_EXECUTION_ISSUE_TYPE=Test Execution
XRAY_LINK_TYPE=Tests
XRAY_EXECUTION_LINK_TYPE=Tests

TOKEN_BUDGET=12000
```

No subas `.env` al repositorio.

### Proyecto de Tests y ejecuciones

Por defecto, Qat crea Tests y Test Executions en el mismo proyecto que el ticket origen.

Para usar otro proyecto:

```env
XRAY_PROJECT_KEY=QA
```

### Campo Test Type de Xray

Algunas instalaciones de Xray exponen `Test Type` como un custom field de Jira. Si necesitás completarlo:

```env
XRAY_TEST_TYPE_FIELD=customfield_12345
XRAY_TEST_TYPE_VALUE=Manual
```

Si no hace falta, dejá `XRAY_TEST_TYPE_FIELD` vacío.

### Tipos de link

Por defecto:

```env
XRAY_LINK_TYPE=Tests
XRAY_EXECUTION_LINK_TYPE=Tests
```

Si tu Jira/Xray usa otros nombres, reemplazalos por los nombres exactos configurados en Jira.

## Uso rápido

Verificar instalación:

```bash
npm run doctor
```

Ejecutar tests internos:

```bash
npm test
```

### 1. Generar casos para revisión

```bash
npm run qat -- generate QA-123
```

Guardar Markdown:

```bash
npm run qat -- generate QA-123 --save
```

### 2. Probar el sync con Xray

```bash
npm run qat -- xray-sync QA-123 --dry-run --save
```

El JSON estructurado queda en:

```text
artifacts/QA-123-xray.json
```

### 3. Crear o actualizar Tests

```bash
npm run qat -- xray-sync QA-123
```

Para cada caso Qat usa labels estables similares a:

```text
qat
qat-source-qa-123
qat-case-tc-001
```

Esto permite actualizar Tests existentes en lugar de duplicarlos.

### 4. Registrar una ejecución

Copiá el ejemplo:

```bash
cp examples/execution.example.json execution.json
```

Marcá cada caso con uno de estos estados:

```text
PASS
FAIL
BLOCKED
TODO
```

Cuando el caso ya existe en Xray, agregá su `key` para vincularlo a la ejecución:

```json
{
  "id": "TC-002",
  "key": "QA-502",
  "title": "Login con password inválido",
  "status": "FAIL",
  "note": "No se muestra el mensaje esperado",
  "evidence": ["./evidence/TC-002-login-error.png"]
}
```

Primero probá:

```bash
npm run qat -- execute QA-123 execution.json --dry-run
```

Después publicá:

```bash
npm run qat -- execute QA-123 execution.json
```

Qat hará lo siguiente:

1. valida todos los estados;
2. crea un issue `Test Execution`;
3. lo vincula al ticket origen;
4. vincula los Tests que tengan `key`;
5. adjunta las evidencias al Test Execution;
6. agrega a la ejecución el detalle de PASS/FAIL/BLOCKED/TODO;
7. comenta el ticket origen con el resumen y la clave de la ejecución.

### Comentario manual

```bash
npm run qat -- comment QA-123 --status passed --summary "Smoke OK"
```

### Evidencia manual

```bash
npm run qat -- evidence QA-123 ./evidence/login.png
```

### Ayuda

```bash
npm run qat -- --help
```

## Claude por CLI

Qat no necesita una API key de Anthropic cuando `LLM_PROVIDER=claude-cli`. Ejecuta el comando configurado en `CLAUDE_COMMAND` y envía el prompt por stdin.

```bash
claude --version
printf "Respondé solamente OK" | claude
```

Si tu instalación corporativa usa otro wrapper:

```env
CLAUDE_COMMAND=mi-claude-corporativo
```

## Flujo recomendado

1. QA toma un ticket Jira.
2. `qat generate ABC-123` genera una versión legible de los casos.
3. QA revisa requisitos, cobertura y ambigüedades.
4. `qat xray-sync ABC-123 --dry-run --save` prepara el sync.
5. `qat xray-sync ABC-123` crea/actualiza Tests.
6. QA ejecuta las pruebas y completa `execution.json`.
7. `qat execute ABC-123 execution.json --dry-run` valida el reporte.
8. `qat execute ABC-123 execution.json` crea el Test Execution, adjunta evidencias y comenta el ticket.

## Optimización de tokens

La estrategia inicial es deliberadamente simple:

- enviar sólo campos útiles del ticket;
- truncar contexto según `TOKEN_BUDGET`;
- cachear respuestas por ticket + prompt;
- reutilizar resultados previos;
- separar generación, sincronización y reporte;
- evitar enviar evidencias binarias al LLM;
- usar IDs estables para no regenerar trabajo innecesariamente.

En versiones posteriores se puede evaluar EnGram, Ponytail u otra capa de memoria/compresión si reduce costo y latencia sin volver frágil el flujo.

## Estructura

```text
src/
  cli.js
  config.js
  jira.js
  llm.js
  prompts.js
  cache.js
  xray.js
  execution.js
test/
  execution.test.js
examples/
  execution.example.json
artifacts/
evidence/
```

## Seguridad

- `.env` está ignorado por Git.
- Qat no imprime tokens en consola.
- Las credenciales de Jira sólo se envían al host configurado.
- Las evidencias se adjuntan directamente a Jira y no pasan por Claude.
- `--dry-run` permite inspeccionar el resultado antes de modificar Jira/Xray.

## Limitaciones v0.3

- Xray cambia custom fields y nombres de issue/link según instalación, por eso son configurables.
- Los pasos de los Tests siguen guardándose inicialmente en la descripción.
- Los estados PASS/FAIL/BLOCKED/TODO quedan registrados en la descripción del Test Execution y el comentario resumen. Escribir directamente el estado nativo de cada Test Run de Xray requiere el adapter específico de la API/GraphQL correspondiente a la edición instalada.
- La integración actual apunta a Jira Cloud.

## Próximos pasos

- detectar automáticamente metadata/campos de Xray;
- escribir pasos directamente en el modelo nativo de Xray;
- adapter nativo para actualizar Test Runs dentro de Test Executions;
- Test Plans y suites;
- importar suites existentes;
- adapters para Jira Server/Data Center;
- mejorar memoria/caché para reducir todavía más tokens.
