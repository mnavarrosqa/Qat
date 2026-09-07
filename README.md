# Qat

Qat es un harness para QA manual pensado para usarse principalmente con **lenguaje natural**. Lee tickets Jira, genera casos, los sincroniza con Xray o genera archivos importables, y publica resultados/evidencias.

Funciona **sin API de Claude**: usa Claude CLI cuando la empresa ya provee acceso de esa forma.

## Estado actual

Versión **0.5.0**.

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

Después completá Jira y el ambiente en `.env`:

```env
LLM_PROVIDER=claude-cli
CLAUDE_COMMAND=claude
JIRA_BASE_URL=https://tuempresa.atlassian.net
JIRA_EMAIL=tu.email@empresa.com
JIRA_API_TOKEN=tu_token

QAT_ENV=qa
QAT_BASE_URL=https://qa.tuapp.com
QAT_USER=usuario_qa
QAT_PASSWORD=password_qa
```

`.env` está ignorado por Git. Nunca guardes passwords/tokens reales en el repositorio.

## Xray con o sin API

Con acceso por API:

```env
XRAY_ENABLED=true
XRAY_MODE=api
```

Sin acceso por API:

```env
XRAY_ENABLED=true
XRAY_MODE=export
XRAY_EXPORT_FORMAT=csv
```

El mismo pedido funciona en ambos casos:

```bash
npm run qat -- "crea los tests de QA-123 en Xray"
```

En modo API, Qat crea/actualiza los Tests. En modo export, genera por ejemplo:

```text
artifacts/QA-123-xray-import.csv
```

El CSV incluye campos base para mapear durante el import en Jira/Xray: Summary, Issue Type, Description, Labels, Test Type, Priority, Source Issue y Case ID.

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

## Flujo diario

1. Pedí que analice el ticket y genere casos.
2. Revisá casos, cobertura y ambigüedades.
3. Pedí crear los tests en Xray.
4. Con API se sincronizan; sin API se genera el archivo importable.
5. Ejecutá las pruebas manuales.
6. Registrá PASS/FAIL/BLOCKED/TODO y evidencia.
7. Publicá el Test Execution cuando corresponda.

En v0.5, el paso de Test Execution todavía usa `execution.json` para evitar interpretar incorrectamente resultados sensibles:

```bash
cp examples/execution.example.json execution.json
npm run qat -- execute QA-123 execution.json --dry-run
npm run qat -- execute QA-123 execution.json
```

## Ambientes y credenciales

Un ambiente activo por `.env`:

```env
QAT_ENV=qa
QAT_BASE_URL=https://qa.tuapp.com
QAT_USER=usuario_qa
QAT_PASSWORD=password_qa
```

Para staging cambiás esos valores. Usuario/password son opcionales.

```bash
npm run doctor
```

`doctor` muestra el ambiente y si las credenciales están configuradas, pero nunca muestra passwords/tokens. También informa el modo activo de Xray.

## Comandos clásicos

```bash
npm run setup
npm run doctor
npm test
npm run qat -- generate QA-123 [--save]
npm run qat -- xray-sync QA-123 [--dry-run] [--save]
npm run qat -- execute QA-123 execution.json [--dry-run]
npm run qat -- comment QA-123 --status passed --summary "Smoke OK"
npm run qat -- evidence QA-123 ./evidence/login.png
```

## Claude CLI

Qat no necesita API key de Anthropic:

```bash
claude --version
```

Si tu empresa usa otro wrapper:

```env
CLAUDE_COMMAND=mi-claude-corporativo
```

## Tokens

- interpretación local cuando es posible;
- Claude como fallback;
- contexto del ticket limitado por `TOKEN_BUDGET`;
- caché de generación;
- evidencias y passwords fuera del LLM;
- generación, sync/export y ejecución separados.

## Seguridad

- `.env` ignorado por Git;
- passwords/tokens no se imprimen;
- secretos no se envían a Claude;
- evidencias no se envían al LLM;
- Claude no tiene acceso directo a credenciales;
- fallback local cuando no hay API de Xray;
- `--dry-run` para inspeccionar cambios antes de escribir.

## Estructura

```text
src/
  cli.js
  setup.js
  natural.js
  config.js
  jira.js
  llm.js
  prompts.js
  cache.js
  xray.js
  execution.js
test/
examples/
docs/
  MANUAL.md
artifacts/
evidence/
```

## Limitaciones v0.5

- Test Execution completo todavía usa JSON;
- Jira Cloud REST API v3; Server/Data Center necesitará adapter;
- Xray puede tener custom fields/nombres distintos según instalación;
- el CSV exportable usa campos base y puede requerir mapeo durante el import;
- el adapter nativo de Xray Cloud todavía está pendiente;
- Test Runs nativos de Xray siguen pendientes.

## Roadmap inmediato

1. resultados y evidencias completamente por lenguaje natural;
2. adapter nativo para Xray Cloud;
3. perfiles configurables de importación CSV/JSON;
4. Test Runs nativos de Xray;
5. Test Plans y suites;
6. optimización continua del consumo de tokens.

## Documentación

- [`docs/MANUAL.md`](docs/MANUAL.md): instalación, setup, configuración, flujo diario, seguridad y troubleshooting.
- [`.env.example`](.env.example): configuración de referencia.
- [`examples/execution.example.json`](examples/execution.example.json): ejemplo de Test Execution.
