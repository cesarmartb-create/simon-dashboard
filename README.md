# Panel Simón

Dashboard ejecutivo para gestionar casos derivados por el bot de WhatsApp **Simón**.

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Auth + Postgres)

## Setup

1. Copiar `.env.local.example` a `.env.local` y completar con las credenciales de Supabase.
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Levantar el servidor de desarrollo:
   ```bash
   npm run dev
   ```

## Roles

Los roles se determinan por email (hardcodeado en `lib/auth.ts`):

- **Supervisores**: `cesar.martinez@grupobaco.cl`, `julia@grupobaco.cl`, `helmuth@grupobaco.cl`
- **Gestores**: `mariaandrea@grupobaco.cl`, `nayarhet@grupobaco.cl`, `kathy@grupobaco.cl`

Los gestores deben existir como usuarios en Supabase Auth para poder iniciar sesión.

## Tablas usadas

- `casos`: registros principales derivados por Simón.
- `eventos`: log de cambios de estado / acciones sobre cada caso.
