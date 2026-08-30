# Component Specification: Admin Analytics Dashboard (Siigo POS Style)

This document specifies the technical and UI/UX requirements for building the **Admin Dashboard** component located at `/dashboard` for **Mecatos el Santi**. It emulates the visual layout and core metrics of Siigo POS.

---

## 1. Technical Stack Requirements

* **UI Framework:** ReactJS + TypeScript + TailwindCSS
* **Charting Library:** Recharts (or Chart.js / Tremor) for responsive rendering
* **Date Handling:** `date-fns` or `dayjs` for filtering date ranges
* **Icons:** `lucide-react` for UI icons

---

## 2. Top Filter Bar (Global Controls)

A sticky top control bar that dynamically updates all charts and tables in real-time.

* **Date Range Selector:** Dropdown with options (`Today` [Default], `Yesterday`, `This Week`, `This Month`, `Custom Range`).
* **Branch Selector (Sede):** Dropdown to filter by specific branch or `All Branches` [Default].
* **DatePicker Inputs:** `From` and `To` date pickers enabled when `Custom Range` is active. Default value: Current Date (`2026-08-24`).

---

## 3. Dashboard Layout & Widget Breakdown

The layout follows a 2-row grid structure emulating Siigo POS:

```text
┌──────────────────────────────────────────────────────────┬────────────────────────────┐
│ WIDGET 1: Sales Behavior (Line Chart by Hour)           │ WIDGET 2: Top 5 Products   │
│ - X-Axis: Hours (05:00 - 23:00)                          │ (Pie Chart / Donut)        │
│ - Y-Axis: Revenue in COP ($)                            │ - Percentage breakdown     │
├────────────────────────────┬─────────────────────────────┼────────────────────────────┤
│ WIDGET 3: Expenses         │ WIDGET 4: Payment Methods   │ WIDGET 5: KPI Summary      │
│ Distribution (Pie Chart)   │ Breakdown (Table/List)      │ (Ticket Promedio & Totals) │
│ - Categories breakdown     │ - Cash, Card, Nequi, Apps   │ - Gross, Tax, Net Totals   │
└────────────────────────────┴─────────────────────────────┴────────────────────────────┘

Aquí tienes el archivo unificado en formato Markdown (**.md**) ajustado con todas las secciones corregidas, las listas bien formadas y la instrucción del patrón de color general adaptada para todo el proyecto:

```markdown
# Component Specification: Admin Analytics Dashboard (Siigo POS Style)

This document specifies the technical and UI/UX requirements for building the **Admin Dashboard** component located at `/dashboard` for **Mecatos el Santi**. It emulates the visual layout and core metrics of Siigo POS.

---

## 1. Technical Stack Requirements

* **UI Framework:** ReactJS + TypeScript + TailwindCSS
* **Charting Library:** Recharts (or Chart.js / Tremor) for responsive rendering
* **Date Handling:** `date-fns` or `dayjs` for filtering date ranges
* **Icons:** `lucide-react` for UI icons

---

## 2. Top Filter Bar (Global Controls)

A sticky top control bar that dynamically updates all charts and tables in real-time.

* **Date Range Selector:** Dropdown with options (`Today` [Default], `Yesterday`, `This Week`, `This Month`, `Custom Range`).
* **Branch Selector (Sede):** Dropdown to filter by specific branch or `All Branches` [Default].
* **DatePicker Inputs:** `From` and `To` date pickers enabled when `Custom Range` is active. Default value: Current Date (`2026-08-24`).

---

## 3. Dashboard Layout & Widget Breakdown

The layout follows a 2-row grid structure emulating Siigo POS:

```text
┌──────────────────────────────────────────────────────────┬────────────────────────────┐
│ WIDGET 1: Sales Behavior (Line Chart by Hour)           │ WIDGET 2: Top 5 Products   │
│ - X-Axis: Hours (05:00 - 23:00)                          │ (Pie Chart / Donut)        │
│ - Y-Axis: Revenue in COP ($)                            │ - Percentage breakdown     │
├────────────────────────────┬─────────────────────────────┼────────────────────────────┤
│ WIDGET 3: Expenses         │ WIDGET 4: Payment Methods   │ WIDGET 5: KPI Summary      │
│ Distribution (Pie Chart)   │ Breakdown (Table/List)      │ (Ticket Promedio & Totals) │
│ - Categories breakdown     │ - Cash, Card, Nequi, Apps   │ - Gross, Tax, Net Totals   │
└────────────────────────────┴─────────────────────────────┴────────────────────────────┘

```

### Widget Specifications

#### **Widget 1: Sales Behavior Timeline (Line Chart)**

* **Type:** Area / Line Chart with smooth curve (`monotone`).
* **Default Behavior:** Displays total sales generated per hour for the selected date range.
* **X-Axis:** Hours of the operating day (e.g., `05:00`, `06:00`, `07:00` ... `23:00`).
* **Y-Axis:** Total monetary amount ($ COP).
* **Tooltip:** Hovering over a point displays the exact hour and total amount sold (e.g., `10:00 AM - $377.300 COP`).
* **Goal:** Allow managers to identify peak sales hours for staff planning.

#### **Widget 2: Top 5 Best-Selling Products (Pie Chart)**

* **Type:** Donut or Pie Chart with a clear color legend.
* **Data:** Top 5 products by quantity/revenue within the selected timeframe. Group remaining items as `Others`.
* **Metrics:** Displays product name, total units sold, and percentage share (e.g., *Empanada Pequeña: 35%*, *Pandebono-Buñuelo: 22%*).

#### **Widget 3: Expenses Distribution (Pie / Donut Chart)**

* **Type:** Pie Chart dedicated exclusively to recorded expenses.
* **Default Behavior:** Shows current day expenses by default, updating with the date filter.
* **Data Categories:** Breakdown by expense type (e.g., *Caja Menor*, *Insumos de Emergencia*, *Aseo y Limpieza*, *Pagos a Proveedores Directos*).
* **Metrics:** Total amount spent per category and percentage representation.

#### **Widget 4: Transactions by Payment Method (Structured Table)**

* **Type:** Clean, compact table displaying financial breakdown per payment channel.
* **Columns:** `Payment Method` | `Total Amount ($ COP)`
* **Rows Required:**
* **Efectivo (Cash)**
* **Tarjetas / Datáfono (Credit/Debit Card)**
* **Nequi / Daviplata (Transfer)**
* **Delivery Apps (Rappi / DiDi)**
* **Crédito / Cuentas por Cobrar**
* **Devoluciones / Notas Crédito** *(Displayed in negative/red)*



#### **Widget 5: Financial Metrics & Ticket Promedio (KPI Cards)**

* **Ticket Promedio:** Average transaction value (`Total Revenue / Number of Invoices`).
* **Applied Totals Breakdown:**
* **Total Bruto (Gross Sales)**
* **Descuentos (Discounts)**
* **Impoconsumo (8% Tax)**
* **IVA (19% Tax)**
* **Total Neto (Net Revenue)**



---

## 4. API Response Schema Expected (Backend Endpoint `/api/admin/dashboard/metrics`)

```json
{
  "summary": {
    "grossTotal": 1089373.02,
    "discountTotal": 0,
    "impoconsumoTotal": 79105.39,
    "ivaTotal": 18441.09,
    "netTotal": 1186919.50,
    "averageTicket": 7023.67,
    "totalTransactions": 169
  },
  "salesByHour": [
    { "hour": "05:00", "total": 0 },
    { "hour": "07:00", "total": 62803 },
    { "hour": "10:00", "total": 377300 },
    { "hour": "12:00", "total": 188800 }
  ],
  "topProducts": [
    { "name": "Empanada Pequeña", "quantity": 140, "percentage": 35.5, "color": "#F59E0B" },
    { "name": "Pandebono", "quantity": 90, "percentage": 22.8, "color": "#10B981" },
    { "name": "Otros", "quantity": 167, "percentage": 41.7, "color": "#9CA3AF" }
  ],
  "expensesByCategory": [
    { "category": "Insumos Emergencia", "amount": 45000, "percentage": 60 },
    { "category": "Caja Menor", "amount": 30000, "percentage": 40 }
  ],
  "paymentMethods": [
    { "method": "Efectivo", "amount": 1043600.00 },
    { "method": "Tarjetas", "amount": 0.00 },
    { "method": "Pagos en Línea / Nequi", "amount": 143400.00 },
    { "method": "Rappi / DiDi", "amount": 0.00 }
  ]
}

```

---

## 5. UI/UX Refinement Instructions for AI

* **Color Palette & Consistency:** Strictly follow the global design system and color pattern defined for the whole project across all cards, text elements, charts, and boundaries.
* **Skeleton Loaders:** Show pulsating gray skeleton cards while data fetches from the backend API.
* **Empty States:** If no sales or expenses exist for the selected date, show clear empty state graphics rather than broken charts.

```

```