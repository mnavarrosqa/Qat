# Qat

Qat es un harness simple para ayudar a QA manuales a convertir tickets en casos de prueba, sincronizarlos con Xray y publicar ejecuciones, resultados y evidencias nuevamente en Jira.

Funciona **sin API de Claude**: usa `claude` por CLI cuando la empresa ya provee acceso de esa forma.

## Estado actual

Versión **0.3.x**.

Incluye:

- lectura de tickets Jira Cloud;
- generación de casos con Claude CLI;
- creación/actualización de Tests en Xray;
- Test Executions;
- estados `PASS`, `FAIL`, `BLOCKED` y `TODO`;
- evidencias;
- comentario final automático en Jira;
- configuración simple de ambiente y usuario de prueba;
- caché local para reducir tokens;
- `--dry-run` antes de modificar Jira.

## Instalación

Requisitos: Node.js 18+, Claude CLI instalado/autenticado y acceso a Jira Cloud.

```bash
git clone https://github.com/mnavarrosqa/Qat.git
cd Qat
npm install
cp .env.example .env
```

Después editá `.env`.

## Configuración

Toda la configuración local vive en un solo archivo: `.env`.

Ejemplo mínimo:

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

QAT_ENV=qa
QAT_BASE_URL=https://qa.tuapp.com
QAT_USER=usuario_qa
QAT_PASSWORD=password_qa

TOKEN_BUDGET=12000
```

### Ambientes, usuarios y passwords

Para mantener Qat simple, usamos **un ambiente activo por `.env`**.

Por ejemplo, para QA:

```env
QAT_ENV=qa
QAT_BASE_URL=https://qa.tuapp.com
QAT_USER=usuario_qa
QAT_PASSWORD=password_qa
```

Para trabajar en staging, cambiás esas variables:

```env
QAT_ENV=staging
QAT_BASE_URL=https://staging.tuapp.com
QAT_USER=usuario_staging
QAT_PASSWORD=password_staging
```

No hace falta crear archivos JSON de ambientes ni administrar perfiles todavía.

`QAT_USER` y `QAT_PASSWORD` son opcionales. Sólo se completan cuando las pruebas necesitan autenticación.

**Importante:** `.env` está ignorado por Git. Nunca pongas passwords reales en `.env.example`, casos de prueba, evidencias o archivos que vayas a commitear.

Claude no necesita conocer el password. Cuando en el futuro Qat automatice el login, la credencial se leerá localmente desde `.env` y no se incluirá en el prompt enviado al LLM.

Podés comprobar la configuración sin mostrar los secretos:

```bash
npm run doctor
```

Verás algo similar a:

```text
QA environment: qa
QA base URL: https://qa.tuapp.com
QA test credentials: configuradas
```

El password nunca se imprime.

### Configuración opcional de Xray

Por defecto Tests y Test Executions se crean en el proyecto del ticket origen. Para otro proyecto:

```env
XRAY_PROJECT_KEY=QA
```

Si tu instalación necesita el custom field `Test Type`:

```env
XRAY_TEST_TYPE_FIELD=customfield_12345
XRAY_TEST_TYPE_VALUE=Manual
```

## Flujo diario

### 1. Verificar configuración

```bash
npm run doctor
npm test
```

### 2. Generar casos

```bash
npm run qat -- generate QA-123
```

Para guardarlos:

```bash
npm run qat -- generate QA-123 --save
```

### 3. Revisar antes de crear Tests

```bash
npm run qat -- xray-sync QA-123 --dry-run --save
```

### 4. Crear/actualizar Tests

```bash
npm run qat -- xray-sync QA-123
```

Qat usa IDs y labels estables para actualizar Tests existentes en lugar de duplicarlos.

### 5. Registrar resultados

Copiá el ejemplo:

```bash
cp examples/execution.example.json execution.json
```

Ejemplo de un resultado:

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

Estados disponibles:

```text
PASS
FAIL
BLOCKED
TODO
```

Primero:

```bash
npm run qat -- execute QA-123 execution.json --dry-run
```

Si está correcto:

```bash
npm run qat -- execute QA-123 execution.json
```

Qat crea el Test Execution, vincula los Tests que tengan `key`, adjunta evidencias y comenta el ticket origen con el resumen.

## Comandos

```bash
npm run doctor
npm run qat -- generate QA-123 [--save]
npm run qat -- xray-sync QA-123 [--dry-run] [--save]
npm run qat -- execute QA-123 execution.json [--dry-run]
npm run qat -- comment QA-123 --status passed --summary "Smoke OK"
npm run qat -- evidence QA-123 ./evidence/login.png
npm run qat -- --help
```

## Claude CLI

Qat no necesita una API key de Anthropic.

```bash
claude --version
printf "Respondé solamente OK" | claude
```

Si la empresa usa otro wrapper:

```env
CLAUDE_COMMAND=mi-claude-corporativo
```

## Tokens

Para mantener bajo el consumo:

- sólo se envían campos útiles del ticket;
- el contexto se limita con `TOKEN_BUDGET`;
- las respuestas se cachean localmente;
- las evidencias no se envían a Claude;
- usuarios/passwords no se envían al LLM;
- generación, sync y reporte son operaciones separadas.

Más adelante podemos evaluar EnGram, Ponytail u otra solución sólo si realmente reduce costo/latencia sin complicar el uso.

## Seguridad

- `.env` está ignorado por Git;
- passwords y tokens no se imprimen;
- no guardar secretos en casos de prueba;
- evidencias van directamente a Jira, no a Claude;
- usar `--dry-run` antes de operaciones importantes;
- evitar usar credenciales de producción para testing.

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
examples/
artifacts/
evidence/
.env.example
```

## Limitaciones actuales

- Jira Cloud REST API v3; Server/Data Center necesitará un adapter.
- Xray puede tener nombres/custom fields distintos según instalación.
- Los pasos todavía se almacenan inicialmente en la descripción del Test.
- PASS/FAIL/BLOCKED/TODO se registran en el Test Execution; actualizar Test Runs nativos de Xray será parte del adapter específico de Xray.

## Próximos pasos

- Test Runs nativos de Xray;
- detección de campos Xray;
- Test Plans y suites;
- automatización opcional de login usando `QAT_USER`/`QAT_PASSWORD` localmente;
- adapters Jira Server/Data Center;
- seguir reduciendo tokens sin complicar el flujo.
