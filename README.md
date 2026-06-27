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

## Datos

Todo se guarda localmente con `window.storage` bajo las llaves `refa:parts`, `refa:sales`,
`refa:expenses`. No requiere backend.

## Notas

- Moneda en pesos mexicanos (MXN).
- El asistente de IA usa la API de Anthropic (`/v1/messages`), igual que la app original.
- Pensado para correr en el mismo entorno que `financeapp.jsx` (espera `window.storage` y `recharts`/`papaparse`/`lucide-react` disponibles).

## Próximos pasos posibles

- Folio/ticket imprimible por venta.
- Clientes y fiados (cuentas por cobrar).
- Margen objetivo por categoría y sugerencia de precio.
- Reporte mensual exportable para el contador.
