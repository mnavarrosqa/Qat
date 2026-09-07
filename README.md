# Qat

Qat es un harness para QA manual pensado para usarse principalmente con **lenguaje natural**. Lee tickets Jira, genera casos, los sincroniza con Xray y publica resultados/evidencias.

Funciona **sin API de Claude**: usa Claude CLI cuando la empresa ya provee acceso de esa forma.

## Estado actual

Versión **0.4.0**.

> Para instalación y uso paso a paso consultá [`docs/MANUAL.md`](docs/MANUAL.md).

## Instalación rápida

Requisitos: Node.js 18+, Claude CLI instalado/autenticado y acceso a Jira Cloud.

```bash
git clone https://github.com/mnavarrosqa/Qat.git
cd Qat
npm install
cp .env.example .env
```

Editá `.env` con Jira/Xray y, si hace falta, ambiente/usuario de prueba.

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
```

`.env` está ignorado por Git. Nunca guardes passwords/tokens reales en el repositorio. Las credenciales de prueba no se incluyen en prompts enviados a Claude.

## Hablale a Qat

La interfaz recomendada es lenguaje natural:

```bash
npm run qat -- "analiza QA-123 y genera casos de prueba"
```

```bash
npm run qat -- "genera los casos de QA-123 y guárdalos"
```

```bash
npm run qat -- "sube los tests de QA-123 a Xray sin modificar"
```

```bash
npm run qat -- "crea los tests de QA-123 en Xray"
```

```bash
npm run qat -- "comenta QA-123 indicando que el smoke pasó correctamente"
```

```bash
npm run qat -- "adjunta ./evidence/error-login.png a QA-123"
```

No necesitás escribir exactamente esas frases. Qat intenta reconocer pedidos comunes localmente para ahorrar tokens y usa Claude como fallback para interpretar instrucciones más libres.

Claude interpreta **qué querés hacer**; el código de Qat ejecuta las operaciones reales contra Jira/Xray.

## Flujo diario

1. Pedí que analice el ticket y genere casos.
2. Revisá casos, cobertura y ambigüedades.
3. Hacé dry-run del sync a Xray.
4. Creá/actualizá los Tests.
5. Ejecutá las pruebas manuales.
6. Registrá PASS/FAIL/BLOCKED/TODO y evidencia.
7. Publicá el Test Execution.

En v0.4, el paso 6/7 todavía usa `execution.json` para evitar interpretar incorrectamente resultados sensibles:

```bash
cp examples/execution.example.json execution.json
npm run qat -- execute QA-123 execution.json --dry-run
npm run qat -- execute QA-123 execution.json
```

La próxima evolución elimina esta necesidad y permitirá frases como:

```text
QA-123: TC-001 pasó, TC-002 falló por error 500 y adjunta error.png
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

`doctor` muestra el ambiente y si las credenciales están configuradas, pero nunca muestra passwords/tokens.

## Comandos clásicos

El lenguaje natural es una capa sobre operaciones determinísticas. Los comandos explícitos siguen disponibles para CI/debugging:

```bash
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
- generación, sync y ejecución separados.

## Seguridad

- `.env` ignorado por Git;
- passwords/tokens no se imprimen;
- secretos no se envían a Claude;
- evidencias no se envían al LLM;
- Claude no tiene acceso directo a Jira/Xray;
- `--dry-run` para inspeccionar cambios antes de escribir.

## Estructura

```text
src/
  cli.js
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

## Limitaciones v0.4

- Test Execution completo todavía usa JSON;
- Jira Cloud REST API v3; Server/Data Center necesitará adapter;
- Xray puede tener custom fields/nombres distintos según instalación;
- Test Runs nativos de Xray siguen pendientes;
- el parser natural seguirá ampliándose a medida que agreguemos operaciones.

## Roadmap inmediato

1. resultados y evidencias completamente por lenguaje natural;
2. modo conversacional interactivo `qat`;
3. Test Runs nativos de Xray;
4. detección automática de campos/configuración Xray;
5. Test Plans y suites;
6. optimización continua del consumo de tokens.

## Documentación

- [`docs/MANUAL.md`](docs/MANUAL.md): instalación, configuración, flujo diario, seguridad y troubleshooting.
- [`.env.example`](.env.example): configuración de referencia.
- [`examples/execution.example.json`](examples/execution.example.json): ejemplo de Test Execution.
