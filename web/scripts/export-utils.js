import { api } from "./api.js";

export const EXPORT_FORMAT_STORAGE_KEY = "settings_export_format";
export const EXPORT_FORMATS = new Set(["csv", "excel", "google-sheets", "pdf"]);

export function getPreferredExportFormat() {
  const value = String(localStorage.getItem(EXPORT_FORMAT_STORAGE_KEY) || "csv").trim().toLowerCase();
  return EXPORT_FORMATS.has(value) ? value : "csv";
}

export function setPreferredExportFormat(format) {
  const normalized = String(format || "").trim().toLowerCase();
  const safe = EXPORT_FORMATS.has(normalized) ? normalized : "csv";
  localStorage.setItem(EXPORT_FORMAT_STORAGE_KEY, safe);
  return safe;
}

function escapeCsv(value) {
  const raw = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function xmlEscape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function htmlEscape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeColumns(sheet) {
  if (Array.isArray(sheet?.columns) && sheet.columns.length) {
    return sheet.columns.map((col) =>
      typeof col === "string" ? { key: col, label: col } : { key: col.key, label: col.label || col.key }
    );
  }
  const firstRow = Array.isArray(sheet?.rows) ? sheet.rows[0] : null;
  if (firstRow && typeof firstRow === "object" && !Array.isArray(firstRow)) {
    return Object.keys(firstRow).map((key) => ({ key, label: key }));
  }
  return [];
}

function getCellValue(row, column) {
  if (row === null || row === undefined) return "";
  if (typeof row !== "object" || Array.isArray(row)) return row;
  return row[column.key];
}

function buildCsvContent(sheets) {
  if (!Array.isArray(sheets) || !sheets.length) return "";
  if (sheets.length === 1) {
    const sheet = sheets[0];
    const columns = normalizeColumns(sheet);
    const rows = [columns.map((col) => escapeCsv(col.label)).join(",")];
    (sheet.rows || []).forEach((row) => {
      rows.push(columns.map((col) => escapeCsv(getCellValue(row, col))).join(","));
    });
    return rows.join("\n");
  }

  const sections = [];
  sheets.forEach((sheet) => {
    const columns = normalizeColumns(sheet);
    sections.push(`# ${sheet.name || "Sheet"}`);
    sections.push(columns.map((col) => escapeCsv(col.label)).join(","));
    (sheet.rows || []).forEach((row) => {
      sections.push(columns.map((col) => escapeCsv(getCellValue(row, col))).join(","));
    });
    sections.push("");
  });
  return sections.join("\n");
}

function spreadsheetType(value) {
  if (typeof value === "number" && Number.isFinite(value)) return "Number";
  return "String";
}

function sanitizeWorksheetName(name, fallback = "Sheet") {
  const raw = String(name || fallback).replace(/[\\/?*\[\]:]/g, " ").trim();
  return (raw || fallback).slice(0, 31);
}

function buildWorkbookXml({ title, sheets }) {
  const safeTitle = xmlEscape(title || "Export");
  const worksheetXml = (sheets || [])
    .map((sheet, index) => {
      const columns = normalizeColumns(sheet);
      const rowsXml = [];
      rowsXml.push(
        `<Row>${columns
          .map((col) => `<Cell ss:StyleID="header"><Data ss:Type="String">${xmlEscape(col.label)}</Data></Cell>`)
          .join("")}</Row>`
      );
      (sheet.rows || []).forEach((row) => {
        rowsXml.push(
          `<Row>${columns
            .map((col) => {
              const value = getCellValue(row, col);
              const type = spreadsheetType(value);
              return `<Cell><Data ss:Type="${type}">${xmlEscape(value)}</Data></Cell>`;
            })
            .join("")}</Row>`
        );
      });

      return `
        <Worksheet ss:Name="${xmlEscape(sanitizeWorksheetName(sheet.name, `Sheet ${index + 1}`))}">
          <Table>
            ${rowsXml.join("")}
          </Table>
        </Worksheet>
      `;
    })
    .join("");

  return `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>${safeTitle}</Title>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Bottom" />
      <Borders />
      <Font />
      <Interior />
      <NumberFormat />
      <Protection />
    </Style>
    <Style ss:ID="header">
      <Font ss:Bold="1" />
      <Interior ss:Color="#DCEBFF" ss:Pattern="Solid" />
    </Style>
  </Styles>
  ${worksheetXml}
</Workbook>`;
}

function buildPrintableHtml({ title, sheets }) {
  const sections = (sheets || [])
    .map((sheet) => {
      const columns = normalizeColumns(sheet);
      const headers = columns.map((col) => `<th>${htmlEscape(col.label)}</th>`).join("");
      const rows = (sheet.rows || [])
        .map(
          (row) =>
            `<tr>${columns
              .map((col) => `<td>${htmlEscape(getCellValue(row, col))}</td>`)
              .join("")}</tr>`
        )
        .join("");
      return `
        <section class="sheet">
          <h2>${htmlEscape(sheet.name || "Sheet")}</h2>
          <table>
            <thead><tr>${headers}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </section>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${htmlEscape(title || "Export")}</title>
  <style>
    body { font-family: Georgia, serif; margin: 24px; color: #111827; }
    h1 { margin-bottom: 8px; }
    h2 { margin: 24px 0 12px; page-break-after: avoid; }
    .meta { color: #4b5563; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
    th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #eff6ff; }
    .sheet { page-break-after: always; }
    .sheet:last-child { page-break-after: auto; }
  </style>
</head>
<body>
  <h1>${htmlEscape(title || "Export")}</h1>
  <p class="meta">Generated ${htmlEscape(new Date().toLocaleString())}</p>
  ${sections}
</body>
</html>`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportSheets({
  title = "Export",
  filenameBase = "export",
  format = getPreferredExportFormat(),
  sheets = [],
} = {}) {
  const safeFormat = EXPORT_FORMATS.has(format) ? format : "csv";
  const safeSheets = Array.isArray(sheets) ? sheets.filter((sheet) => Array.isArray(sheet?.rows)) : [];
  if (!safeSheets.length) {
    throw new Error("No data available to export.");
  }

  if (safeFormat === "csv") {
    const content = buildCsvContent(safeSheets);
    downloadBlob(new Blob([content], { type: "text/csv;charset=utf-8" }), `${filenameBase}.csv`);
    return;
  }

  if (safeFormat === "excel" || safeFormat === "google-sheets") {
    const workbook = buildWorkbookXml({ title, sheets: safeSheets });
    downloadBlob(
      new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" }),
      `${filenameBase}.xls`
    );
    return;
  }

  if (safeFormat === "pdf") {
    const html = buildPrintableHtml({ title, sheets: safeSheets });
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) {
      throw new Error("Popup blocked. Please allow popups to export PDF.");
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    window.setTimeout(() => win.print(), 150);
    return;
  }
}

function toDateOnly(value) {
  if (!value) return "";
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function normalizeRecordRows(records = []) {
  return records.map((record) => {
    const origin = String(
      record.origin ||
        (record.linked_receipt_id || record.linkedReceiptId
          ? "receipt"
          : record.linked_recurring_id || record.linkedRecurringId
            ? "recurring"
            : record.linked_plaid_account_id || record.linkedPlaidAccountId
              ? "plaid"
            : "manual")
    ).toLowerCase();

    return {
      Date: toDateOnly(record.date),
      Type: record.type || "",
      Category: record.category || "",
      Amount: Number(record.amount || 0),
      Notes: record.note || "",
      Origin: origin.replace(/^./, (char) => char.toUpperCase()),
    };
  });
}

function normalizeReceiptRows(receipts = []) {
  return receipts.map((receipt) => ({
    Date: toDateOnly(receipt.date || receipt.created_at),
    Source: receipt.source || receipt.original_filename || "",
    Amount: Number(receipt.amount || 0),
    Tax: Number(receipt.tax_amount || 0),
    PaymentMethod: receipt.pay_method || "",
    LinkedRecordId: receipt.linked_record_id || "",
    Items: JSON.stringify(receipt.items || []),
    ParsedData: JSON.stringify(receipt.parsed_data || {}),
  }));
}

function normalizeBudgetRows(sheets = []) {
  return sheets.map((sheet) => ({
    Cadence: sheet.cadence || "",
    Period: sheet.period || "",
    Updated: sheet.updated_at || sheet.updatedAt || "",
    Housing: Number(sheet.housing || 0),
    Utilities: Number(sheet.utilities || 0),
    Groceries: Number(sheet.groceries || 0),
    Transportation: Number(sheet.transportation || 0),
    Dining: Number(sheet.dining || 0),
    Health: Number(sheet.health || 0),
    Entertainment: Number(sheet.entertainment || 0),
    Shopping: Number(sheet.shopping || 0),
    Membership: Number(sheet.membership || 0),
    Miscellaneous: Number(sheet.miscellaneous || 0),
    Education: Number(sheet.education || 0),
    Giving: Number(sheet.giving || 0),
    Savings: Number(sheet.savings || 0),
    CustomCategories: JSON.stringify(sheet.custom_categories || []),
  }));
}

function normalizeSimpleRows(items = [], config = {}) {
  const fields = Array.isArray(config.fields) ? config.fields : [];
  return (items || []).map((item) => {
    const row = {};
    fields.forEach((field) => {
      const key = typeof field === "string" ? field : field.label;
      const sourceKey = typeof field === "string" ? field : field.key;
      row[key] = item?.[sourceKey] ?? "";
    });
    return row;
  });
}

function normalizePlaidItemRows(items = []) {
  return (items || []).map((item) => ({
    PlaidItemId: item.plaid_item_id || "",
    InstitutionId: item.institution_id || "",
    InstitutionName: item.institution_name || "",
    Status: item.status || "",
    LastSyncedAt: item.last_synced_at || "",
    CreatedAt: item.created_at || "",
    UpdatedAt: item.updated_at || "",
  }));
}

function normalizePlaidAccountRows(accounts = []) {
  return (accounts || []).map((account) => ({
    Name: account.name || "",
    OfficialName: account.official_name || "",
    Mask: account.mask || "",
    Type: account.type || "",
    Subtype: account.subtype || "",
    InstitutionName: account.institution_name || "",
    PlaidAccountId: account.plaid_account_id || "",
    PlaidItemId: account.plaid_item_external_id || "",
    CurrentBalance: Number(account.current_balance || 0),
    AvailableBalance: Number(account.available_balance || 0),
    Currency: account.currency || "USD",
    Active: Boolean(account.is_active),
    PlaidItemStatus: account.plaid_item_status || "",
    CreatedAt: account.created_at || "",
    UpdatedAt: account.updated_at || "",
  }));
}

function normalizeNetWorthSnapshotRows(snapshots = []) {
  return (snapshots || []).map((snapshot) => ({
    SnapshotDate: snapshot.snapshot_date || "",
    AssetsTotal: Number(snapshot.assets_total || 0),
    LiabilitiesTotal: Number(snapshot.liabilities_total || 0),
    NetWorth: Number(snapshot.net_worth || 0),
    Currency: snapshot.currency || "USD",
    CreatedAt: snapshot.created_at || "",
    UpdatedAt: snapshot.updated_at || "",
  }));
}

export async function exportAllUserData({
  format = getPreferredExportFormat(),
  localSettings = {},
} = {}) {
  const bundle = await api.settings.exportAllData();
  const profile = bundle?.profile || {};
  const sheets = [
    {
      name: "Personal Info",
      rows: [
        {
          FullName: profile.full_name || "",
          Username: profile.username || "",
          Email: profile.email || "",
          Location: profile.location || "",
          Phone: profile.phone_number || "",
          Employer: profile.employer || "",
          IncomeRange: profile.income_range || "",
          NotificationsEmail: Boolean(profile.notification_email_enabled),
          NotificationsSMS: Boolean(profile.notification_sms_enabled),
        },
      ],
    },
    {
      name: "App Settings",
      rows: [
        {
          Currency: localSettings.currency || "",
          NumberFormat: localSettings.numberFormat || "",
          Timezone: localSettings.timezone || "",
          Language: localSettings.language || "",
          DashboardView: localSettings.dashboardView || "",
          ExportFormat: localSettings.exportFormat || getPreferredExportFormat(),
        },
      ],
    },
    { name: "Records", rows: normalizeRecordRows(bundle?.records || []) },
    { name: "Receipts", rows: normalizeReceiptRows(bundle?.receipts || []) },
    { name: "Budgets", rows: normalizeBudgetRows(bundle?.budgetSheets || []) },
    {
      name: "Recurring",
      rows: normalizeSimpleRows(bundle?.recurring || [], {
        fields: ["name", "type", "amount", "category", "note", "frequency", "day_of_month", "start_date", "end_date", "active"],
      }),
    },
    {
      name: "Rules",
      rows: (bundle?.rules || []).map((rule) => ({
        Name: rule.name || "",
        Enabled: Boolean(rule.enabled),
        Priority: Number(rule.priority || 0),
        ApplyMode: rule.applyMode || "",
        Conditions: JSON.stringify(rule.conditions || []),
        Actions: JSON.stringify(rule.actions || []),
        CreatedAt: rule.createdAt || "",
      })),
    },
    {
      name: "Net Worth",
      rows: normalizeSimpleRows(bundle?.netWorth || [], {
        fields: ["type", "name", "amount", "created_at", "updated_at"],
      }),
    },
    {
      name: "Net Worth Snapshots",
      rows: normalizeNetWorthSnapshotRows(bundle?.netWorthSnapshots || []),
    },
    {
      name: "Linked Items",
      rows: normalizePlaidItemRows(bundle?.plaidItems || []),
    },
    {
      name: "Linked Accounts",
      rows: normalizePlaidAccountRows(bundle?.plaidAccounts || []),
    },
    {
      name: "Achievements",
      rows: normalizeSimpleRows(bundle?.achievements || [], {
        fields: ["achievement_key", "unlocked_at"],
      }),
    },
    {
      name: "Activity",
      rows: (bundle?.activity || []).map((item) => ({
        CreatedAt: item.created_at || "",
        Action: item.action || "",
        EntityType: item.entity_type || "",
        EntityId: item.entity_id || "",
        Metadata: JSON.stringify(item.metadata || {}),
      })),
    },
  ].filter((sheet) => sheet.rows.length);

  await exportSheets({
    title: "WalletLens Full Export",
    filenameBase: `walletlens_full_export_${new Date().toISOString().slice(0, 10)}`,
    format,
    sheets,
  });
}
