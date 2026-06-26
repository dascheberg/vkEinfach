import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { receipts, transactions, fiscalYears } from "@/lib/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import ReceiptDeleteButton from "@/modules/receipts/components/ReceiptDeleteButton";

type SearchParams = Promise<{ fyId?: string }>;

const STORAGE_LABELS: Record<string, string> = {
  local: "Lokal",
  nas:   "NAS",
  cloud: "Cloud",
};

function formatDate(value: string | null): string {
  if (!value) return "–";
  const [y, m, d] = value.split("-");
  return `${d}.${m}.${y}`;
}

export default async function ReceiptsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAuth();
  const role    = (session.user as { role?: string }).role ?? "member";
  if (role === "member") redirect("/dashboard");

  const isAdmin = role === "admin";
  const params  = await searchParams;

  const fiscalYearList = await db
    .select()
    .from(fiscalYears)
    .orderBy(asc(fiscalYears.dateFrom));

  const activeFY  = fiscalYearList.find((fy) => fy.isActive);
  const defaultFY = activeFY ?? fiscalYearList[fiscalYearList.length - 1];
  const selectedFY = params.fyId
    ? fiscalYearList.find((fy) => fy.id === parseInt(params.fyId!))
    : defaultFY;

  // Alle Belege (mit Buchungsinfos), optional nach Buchungsjahr gefiltert
  const baseQuery = db
    .select({
      id:            receipts.id,
      transactionId: receipts.transactionId,
      receiptNumber: transactions.receiptNumber,
      bookingDate:   transactions.bookingDate,
      fiscalYearId:  transactions.fiscalYearId,
      fileName:      receipts.fileName,
      filePath:      receipts.filePath,
      fileType:      receipts.fileType,
      storageType:   receipts.storageType,
      notes:         receipts.notes,
      uploadedAt:    receipts.uploadedAt,
    })
    .from(receipts)
    .leftJoin(transactions, eq(receipts.transactionId, transactions.id));

  const rows = selectedFY
    ? await baseQuery
        .where(eq(transactions.fiscalYearId, selectedFY.id))
        .orderBy(desc(transactions.bookingDate), desc(receipts.id))
    : await baseQuery.orderBy(desc(transactions.bookingDate), desc(receipts.id));

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Scan-Belege</h1>

      {/* Jahresfilter */}
      <form method="GET" className="flex flex-wrap items-end gap-3 mb-6">
        <label className="form-control">
          <span className="label-text text-base mb-1">Buchungsjahr</span>
          <select
            name="fyId"
            defaultValue={selectedFY ? String(selectedFY.id) : ""}
            className="select select-bordered text-base"
          >
            <option value="">Alle Jahre</option>
            {fiscalYearList.map((fy) => (
              <option key={fy.id} value={String(fy.id)}>
                {fy.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary text-base">
          Filtern
        </button>
      </form>

      <p className="text-base text-base-content/60 mb-3">{rows.length} Belege</p>

      {rows.length === 0 ? (
        <div className="text-center py-12 text-base-content/50 text-base">
          Keine Belege vorhanden.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full text-base">
            <thead>
              <tr className="text-base">
                <th>Buchungs-Nr.</th>
                <th>Datum</th>
                <th>Dateiname</th>
                <th>Pfad</th>
                <th>Typ</th>
                <th>Ort</th>
                <th>Notizen</th>
                <th scope="col"><span className="sr-only">Aktionen</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="font-mono whitespace-nowrap">
                    {row.receiptNumber ?? "–"}
                  </td>
                  <td className="whitespace-nowrap">{formatDate(row.bookingDate)}</td>
                  <td className="font-mono">{row.fileName}</td>
                  <td className="font-mono text-base break-all max-w-xs">{row.filePath}</td>
                  <td>{row.fileType?.toUpperCase() ?? "–"}</td>
                  <td>{STORAGE_LABELS[row.storageType] ?? row.storageType}</td>
                  <td>{row.notes ?? "–"}</td>
                  <td>
                    <div className="flex gap-1">
                      {row.storageType !== "cloud" && (
                        <a
                          href={`/api/receipts/${row.id}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-xs btn-info btn-outline text-base"
                        >
                          Anzeigen
                        </a>
                      )}
                      {isAdmin && (
                        <ReceiptDeleteButton receiptId={row.id} fileName={row.fileName} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
