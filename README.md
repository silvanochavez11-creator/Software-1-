# Refaccionaria de Motos — Inventario + Contabilidad

App de una sola pantalla (componente React) para una refaccionaria de motos. Resuelve los dos
dolores de cabeza del negocio: **llevar el inventario de refacciones** y **llevar la contabilidad**,
conectados para que no haya que capturar nada dos veces.

Es la adaptación de la app financiera original (`financeapp.jsx`): se reutiliza toda la base
visual y técnica (tema oscuro, pestañas, gráficas con `recharts`, persistencia con
`window.storage`, asistente de IA), pero el modelo de datos cambia de "ingresos/gastos sueltos"
a **refacciones** y **ventas que descuentan stock y generan utilidad**.

## La idea clave

El inventario y la contabilidad están unidos por la **venta**:

```
Refacción (costo + precio)  ──vende──▶  baja stock  +  registra ingreso y costo
                                                          │
                                                          ▼
                                            Utilidad = precio − costo (automática)
```

Cuando registras una venta en el Punto de venta:
1. Se descuenta el stock de cada pieza.
2. Se guarda el ingreso **y** el costo de la mercancía vendida (COGS).
3. La utilidad de la venta sale sola. La contabilidad se arma sin doble captura.

## Pestañas

| Pestaña | Para qué sirve |
|---|---|
| **Tablero** | KPIs del mes: valor del inventario, ventas, utilidad bruta y neta, alertas de stock bajo, más vendidos. |
| **Inventario** | Alta/edición de refacciones (SKU, marca, categoría, compatibilidad de moto, stock, mínimo, costo, precio). Buscador, ajuste rápido de stock ± y alertas cuando una pieza llega al mínimo. Importar/exportar CSV. |
| **Punto de venta** | Busca piezas, arma la venta, cobra. Descuenta inventario y registra la utilidad. No deja vender más de lo que hay en stock. |
| **Gastos** | Gastos del negocio: renta, luz, sueldos, compra a proveedor, etc. |
| **Contabilidad** | Estado de resultados (ventas − costo de mercancía = utilidad bruta − gastos = utilidad neta), margen, ticket promedio y gráficas por mes. |
| **Asistente IA** | Pega una factura/pedido del proveedor en texto y la IA lo convierte en refacciones para dar de alta o reabastecer. Si la pieza ya existe, suma el stock. |

## Multi-refaccionaria con Supabase (login + nube)

La app arranca con una **pantalla de inicio de sesión** (Supabase Auth). Según quién entre:

- **Administrador** (tú): ve el **panel de administrador** para crear refaccionarias
  (nombre, logo, color), eliminarlas y **asignar las cuentas de los dueños** a su negocio.
- **Dueño**: entra directo a SU refaccionaria. La interfaz se tiñe con su color, muestra su
  logo, y solo ve **sus** datos (inventario, ventas y gastos).

El aislamiento entre negocios lo garantiza la base de datos (Row Level Security por `org_id`),
no el código. Todo vive en **Supabase**, así que es accesible desde cualquier dispositivo.

> **Configuración:** sigue [`supabase/SETUP.md`](./supabase/SETUP.md) (correr el SQL,
> desactivar confirmación de correo, hacerte admin). La URL del proyecto y la llave pública
> ya están en el código (`SB_URL` / `SB_KEY`).

## Datos

- **En la nube (Supabase):** `organizations`, `profiles`, `memberships`, `parts`, `sales`,
  `expenses`. Ver `supabase/schema.sql`.
- **Local (`window.storage`):** solo la sesión (`refa:session`) y la config cosmética del
  ticket por negocio (`refa:org:<id>:shop`).

## Notas

- Moneda en pesos mexicanos (MXN).
- El asistente de IA usa la API de Anthropic (`/v1/messages`), igual que la app original.
- Pensado para correr en el mismo entorno que `financeapp.jsx` (espera `window.storage` y `recharts`/`papaparse`/`lucide-react` disponibles).

## Próximos pasos posibles

- **Backend real (Supabase):** login, base de datos y aislamiento por servidor para que
  las refaccionarias sean cuentas de verdad accesibles desde cualquier dispositivo.
- Clientes y fiados (cuentas por cobrar).
- Margen objetivo por categoría y sugerencia de precio.
- Reporte mensual exportable para el contador.
