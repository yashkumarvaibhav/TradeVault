import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import type { ReportModel } from "@/lib/report-model";

import { ReportDocument } from "./report-document";

/** Render a finished, single-currency report model into a real PDF byte buffer. */
export async function renderReportPdf(model: ReportModel): Promise<Buffer> {
  return renderToBuffer(<ReportDocument model={model} />);
}
