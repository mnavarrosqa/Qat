# Ambientes y perfiles de credenciales

Qat separa dos conceptos:

- **Ambiente**: dónde se prueba (`qa`, `staging`, `dev`, etc.). Define principalmente la URL.
- **Perfil**: con qué identidad se prueba (`admin`, `customer`, `readonly`, etc.). Define usuario y password.

Esto permite tener varios ambientes y, al mismo tiempo, varios usuarios dentro de un mismo ambiente.

## Configuración recomendada

Copiá el ejemplo local:

```bash
mkdir -p .qat
cp .qat/environments.example.json .qat/environments.json
```

`.qat/environments.json` está ignorado por Git y puede contener las credenciales locales de prueba.

Ejemplo:

```json
{
  "environments": {
    "qa": {
      "baseUrl": "https://qa.example.com",
      "defaultProfile": "qa-user",
      "profiles": {
        "qa-user": {
          "user": "qa.user@example.com",
          "password": "secret"
        },
        "admin": {
          "user": "qa.admin@example.com",
          "password": "secret"
        },
        "customer": {
          "user": "customer@example.com",
          "password": "secret"
        }
      }
    },
    "staging": {
      "baseUrl": "https://staging.example.com",
      "defaultProfile": "qa-user",
      "profiles": {
        "qa-user": {
          "user": "staging.qa@example.com",
          "password": "secret"
        }
      }
    }
  }
}
```

En `.env` sólo seleccionás qué combinación querés usar:

```env
QAT_ENVIRONMENTS_FILE=.qat/environments.json
QAT_ENV=qa
QAT_PROFILE=admin
```

## Comandos

Ver todos los ambientes y perfiles disponibles:

```bash
npm run qat -- env list
```

Ver la selección activa sin mostrar secretos:

```bash
npm run qat -- env show
```

Cambiar de ambiente y perfil:

```bash
npm run qat -- env use qa admin
npm run qat -- env use qa customer
npm run qat -- env use staging qa-user
```

`env use` actualiza `QAT_ENV` y `QAT_PROFILE` en `.env`. La password nunca se imprime.

## Un solo ambiente con muchos usuarios

También es válido tener únicamente `qa` y varios perfiles:

```text
qa/admin
qa/basic-user
qa/customer-a
qa/customer-b
qa/readonly
```

Esto evita duplicar la misma URL sólo porque cambian las credenciales.

## Varios ambientes con perfiles equivalentes

Podés repetir nombres de perfil en diferentes ambientes:

```text
qa/admin
staging/admin
production-readonly/admin
```

Cada perfil puede tener credenciales diferentes porque pertenece a su ambiente.

## Modo simple / compatibilidad

Si `.qat/environments.json` no existe, Qat sigue soportando el formato anterior:

```env
QAT_ENV=qa
QAT_BASE_URL=https://qa.example.com
QAT_USER=usuario
QAT_PASSWORD=password
```

No hace falta migrar inmediatamente.

## Seguridad

- `.qat/environments.json` está ignorado por Git.
- `.env` también está ignorado por Git.
- `doctor` y `env show` sólo indican si hay credenciales configuradas; no muestran usuario/password completos.
- Las credenciales de prueba no se envían al LLM.
- El archivo `.qat/environments.example.json` contiene únicamente valores ficticios y sí se versiona.
