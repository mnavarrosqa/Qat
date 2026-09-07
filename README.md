# Qat

Qat es un harness para QA manual pensado para usarse principalmente con **lenguaje natural**. Lee tickets Jira, genera casos, los sincroniza con Xray o genera archivos importables, y publica resultados/evidencias.

Funciona **sin API de Claude**: usa Claude CLI cuando la empresa ya provee acceso de esa forma.

## Estado actual

Versión **0.7.0**.

> Para instalación y uso paso a paso consultá [`docs/MANUAL.md`](docs/MANUAL.md).

## Instalación rápida

Requisitos: Node.js 18+, Claude CLI instalado/autenticado y acceso a Jira Cloud.

```bash
git clone https://github.com/mnavarrosqa/Qat.git
cd Qat
npm install
cp .env.example .env
npm run setup
```

El setup pregunta si usás Xray y si tenés acceso por API. Si no tenés API, Qat configura automáticamente modo `export` y genera CSV/JSON importable en `artifacts/`.

Después completá Jira en `.env`:

```env
LLM_PROVIDER=claude-cli
CLAUDE_COMMAND=claude
JIRA_BASE_URL=https://tuempresa.atlassian.net
JIRA_EMAIL=tu.email@empresa.com
JIRA_API_TOKEN=tu_token
```

`.env` está ignorado por Git. Nunca guardes passwords/tokens reales en el repositorio.

## Xray con o sin API

### Xray Cloud API nativa

```env
XRAY_ENABLED=true
XRAY_MODE=api
XRAY_CLIENT_ID=tu_client_id
XRAY_CLIENT_SECRET=tu_client_secret
```

Qat autentica contra Xray Cloud, usa la API GraphQL para buscar Tests existentes y crear Tests Manuales con sus pasos. Los Tests creados se vinculan al ticket Jira origen.

Validá la conexión sin mostrar secretos:

```bash
npm run doctor
```

### Sin acceso API

```env
XRAY_ENABLED=true
XRAY_MODE=export
XRAY_EXPORT_FORMAT=csv
```

El mismo pedido funciona en ambos casos:

```bash
npm run qat -- "crea los tests de QA-123 en Xray"
```

En modo export genera, por ejemplo:

```text
artifacts/QA-123-xray-import.csv
```

## Hablale a Qat

```bash
npm run qat -- "analiza QA-123 y genera casos de prueba"
npm run qat -- "genera los casos de QA-123 y guárdalos"
npm run qat -- "crea los tests de QA-123 en Xray"
npm run qat -- "comenta QA-123 indicando que el smoke pasó correctamente"
npm run qat -- "adjunta ./evidence/error-login.png a QA-123"
```

No necesitás escribir exactamente esas frases. Qat intenta reconocer pedidos comunes localmente para ahorrar tokens y usa Claude como fallback para interpretar instrucciones más libres.

Claude interpreta **qué querés hacer**; el código de Qat ejecuta las operaciones reales contra Jira/Xray o genera los artifacts correspondientes.

## Ambientes y perfiles

Qat separa **ambiente** de **perfil de credenciales**.

Un ambiente representa dónde probás (`qa`, `staging`, `dev`) y un perfil con qué identidad (`admin`, `customer`, `readonly`). Esto permite varios ambientes o un único ambiente con muchos usuarios/passwords sin duplicar URLs.

Configuración recomendada:

```bash
mkdir -p .qat
cp .qat/environments.example.json .qat/environments.json
```

En `.env` sólo queda la selección activa:

```env
QAT_ENVIRONMENTS_FILE=.qat/environments.json
QAT_ENV=qa
QAT_PROFILE=admin
```

Comandos:

```bash
npm run qat -- env list
npm run qat -- env show
npm run qat -- env use qa admin
npm run qat -- env use staging qa-user
```

Qat nunca imprime la password. Si no existe `.qat/environments.json`, sigue funcionando el formato anterior con `QAT_BASE_URL`, `QAT_USER` y `QAT_PASSWORD`.

Guía completa: [`docs/ENVIRONMENTS.md`](docs/ENVIRONMENTS.md).

## Flujo diario

1. Elegí ambiente/perfil si necesitás cambiar de contexto.
2. Pedí que analice el ticket y genere casos.
3. Revisá casos, cobertura y ambigüedades.
4. Pedí crear los tests en Xray.
5. Con API Cloud nativa se crean/sincronizan; sin API se genera el archivo importable.
6. Ejecutá las pruebas manuales.
7. Registrá PASS/FAIL/BLOCKED/TODO y evidencia.
8. Publicá el Test Execution cuando corresponda.

Los Test Execution completos todavía usan `execution.json`:

```bash
cp examples/execution.example.json execution.json
npm run qat -- execute QA-123 execution.json --dry-run
npm run qat -- execute QA-123 execution.json
```

## Doctor

```bash
npm run doctor
```

`doctor` muestra el ambiente/perfil activos y valida Claude, Jira y Xray. En `XRAY_MODE=api` intenta autenticar contra Xray Cloud y, si no puede, recomienda `XRAY_MODE=export`. Nunca imprime passwords, tokens, client IDs ni secrets.

## Comandos clásicos

```bash
npm run setup
npm run doctor
npm test
npm run qat -- env list
npm run qat -- env show
npm run qat -- env use qa admin
npm run qat -- generate QA-123 [--save]
npm run qat -- xray-sync QA-123 [--dry-run] [--save]
npm run qat -- execute QA-123 execution.json [--dry-run]
npm run qat -- comment QA-123 --status passed --summary "Smoke OK"
npm run qat -- evidence QA-123 ./evidence/login.png
```

## Seguridad y tokens

- interpretación local cuando es posible;
- Claude como fallback;
- contexto del ticket limitado por `TOKEN_BUDGET`;
- caché de generación;
- `.env` y `.qat/environments.json` ignorados por Git;
- secretos, passwords y evidencias fuera del LLM;
- Xray Cloud usa token temporal obtenido desde `XRAY_CLIENT_ID`/`XRAY_CLIENT_SECRET`;
- `--dry-run` para inspeccionar cambios antes de escribir.

## Estructura

```text
src/
  cli.js
  setup.js
  natural.js
  config.js
  environments.js
  jira.js
  llm.js
  prompts.js
  cache.js
  xray.js
  xray-cloud.js
  execution.js
.qat/
  environments.example.json
test/
examples/
docs/
  MANUAL.md
  ENVIRONMENTS.md
artifacts/
evidence/
```

## Limitaciones v0.7

- Test Execution completo todavía usa JSON;
- el adapter nativo Xray Cloud crea Tests y evita duplicados, pero la actualización completa de pasos de Tests existentes todavía está pendiente;
- selección de ambientes/perfiles por lenguaje natural queda pendiente;
- Jira Server/Data Center necesitará adapter;
- Xray puede tener custom fields/configuraciones distintas según instalación;
- Test Runs nativos de Xray siguen pendientes.

## Roadmap inmediato

1. actualizar pasos de Tests existentes vía Xray Cloud;
2. cambio de ambiente/perfil por lenguaje natural;
3. resultados y evidencias completamente por lenguaje natural;
4. Test Runs nativos de Xray;
5. perfiles configurables de importación CSV/JSON;
6. Test Plans y suites;
7. optimización continua del consumo de tokens.

## Documentación

- [`docs/MANUAL.md`](docs/MANUAL.md): instalación, setup, configuración, flujo diario, seguridad y troubleshooting.
- [`docs/ENVIRONMENTS.md`](docs/ENVIRONMENTS.md): múltiples ambientes y perfiles de credenciales.
- [`.env.example`](.env.example): configuración de referencia.
- [`.qat/environments.example.json`](.qat/environments.example.json): ejemplo de ambientes y usuarios de prueba.
- [`examples/execution.example.json`](examples/execution.example.json): ejemplo de Test Execution.
