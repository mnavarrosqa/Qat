# Qat

Qat es un harness simple para ayudar a QA manuales a convertir tickets en planes/casos de prueba, ejecutarlos con ayuda de un LLM y publicar resultados/evidencias nuevamente en Jira/Xray.

La primera versión está pensada para funcionar **sin API de Claude**: usa `claude` por CLI cuando la empresa ya provee acceso de esa forma. La arquitectura deja abierta la puerta a otros proveedores.

## Objetivos

- Leer tickets de Jira.
- Generar o actualizar casos de prueba.
- Preparar casos compatibles con Xray.
- Ejecutar prompts con Claude CLI.
- Comentar tickets con resultados de testing.
- Adjuntar evidencias a Jira.
- Minimizar uso de tokens mediante contexto compacto, caché local y límites configurables.

## Requisitos

- Node.js 18+
- Claude CLI instalado y autenticado (`claude --version`)
- Jira Cloud o Jira Server/Data Center accesible por REST

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
TOKEN_BUDGET=12000
```

> No subas `.env` al repositorio.

## Uso rápido

Verificar instalación:

```bash
npm run doctor
```

Generar un plan/casos de prueba desde un ticket:

```bash
npm run qat -- generate QA-123
```

Guardar el resultado generado en `artifacts/`:

```bash
npm run qat -- generate QA-123 --save
```

Publicar un comentario de resultados en Jira:

```bash
npm run qat -- comment QA-123 --status passed --summary "Smoke OK"
```

Adjuntar evidencia:

```bash
npm run qat -- evidence QA-123 ./evidence/login.png
```

Mostrar ayuda:

```bash
npm run qat -- --help
```

## Claude por CLI

Qat no necesita una API key de Anthropic cuando `LLM_PROVIDER=claude-cli`. Ejecuta el comando configurado en `CLAUDE_COMMAND` y envía el prompt por stdin.

Podés comprobarlo con:

```bash
claude --version
printf "Respondé solamente OK" | claude
```

Si tu instalación corporativa usa otro wrapper, cambiá:

```env
CLAUDE_COMMAND=mi-claude-corporativo
```

## Flujo recomendado

1. QA toma un ticket de Jira.
2. `qat generate ABC-123` obtiene título, descripción y criterios relevantes.
3. Qat compacta el contexto y evita enviar metadata innecesaria.
4. Claude genera casos en formato Markdown/JSON.
5. QA revisa y ejecuta los casos.
6. `qat comment` publica el resumen de resultados.
7. `qat evidence` adjunta capturas, logs u otros archivos.
8. La integración con Xray queda encapsulada para evolucionar creación/actualización automática de Test issues.

## Optimización de tokens

La estrategia inicial es deliberadamente simple:

- enviar sólo campos útiles del ticket;
- truncar contexto por presupuesto;
- cachear respuestas por hash de ticket + prompt;
- reutilizar resultados previos;
- separar generación de casos, ejecución y reporte en prompts pequeños;
- evitar reenviar evidencias binarias al LLM.

Más adelante se puede evaluar EnGram, Ponytail u otra capa de memoria/compresión siempre que mejore costo/latencia sin volver frágil el flujo.

## Estructura

```text
src/
  cli.js
  config.js
  jira.js
  llm.js
  prompts.js
  cache.js
artifacts/
evidence/
```

## Seguridad

- `.env` está ignorado por Git.
- Nunca se imprimen tokens en consola.
- Las credenciales de Jira sólo se envían al host configurado.
- Las evidencias se adjuntan directamente a Jira y no pasan por Claude.

## Estado

MVP / v0.1 inicial. Próximos pasos: integración Xray completa, comandos para sincronizar Test issues, ejecución estructurada, suites y mejor control de contexto.
