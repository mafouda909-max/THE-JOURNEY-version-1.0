import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import { parseQuoteLines } from "@/lib/commercial-domain";
import { sanitizeAgencyEventPayload } from "@/lib/agency-policy";
import { getPublicQuoteDelivery } from "@/lib/quote-delivery-public";
import { generateQuoteDeliveryToken, isValidQuoteDeliveryToken, quoteDeliveryTokenDigest } from "@/lib/quote-delivery-token";
import {
  isServicePilotWorkspace, servicePilotWorkspaceIds, serviceCommandKeys, serviceEconomics,
  serviceId, serviceMinor, serviceText, serviceTransition,
  type ServiceActor, type ServiceOrderView, type ServiceResult, type ServiceStatus,
} from "@/lib/service-fulfillment-domain";

type Json = Record<string, unknown>;
type Row = Record<string, unknown>;
const fail = (error: string, status: number): ServiceResult => ({ status, body: { error } });
const ok = (body: Json, status = 200): ServiceResult => ({ status, body });

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
}

async function officeAccess(client: PoolClient, actor: ServiceActor, lock = false): Promise<"owner" | "member" | null> {
  if (!actor.workspaceId || !isServicePilotWorkspace(actor.workspaceId)) return null;
  const result = await client.query<{ role: "owner" | "member" }>(
    `SELECT m.role FROM agency_memberships m
     JOIN agency_workspaces w ON w.id=m.workspace_id AND w.status='active'
     WHERE m.workspace_id=$1 AND m.account_id=$2 AND m.status='active'
     ${lock ? "FOR SHARE OF m, w" : ""}`,
    [actor.workspaceId, actor.accountId],
  );
  return result.rows[0]?.role ?? null;
}

async function loadOrder(client: PoolClient, actor: ServiceActor, orderId: number, lock: boolean): Promise<Row | null> {
  const result = await client.query(
    `SELECT o.*, a.display_name AS partner_name, w.name AS office_name
       FROM sila_service_orders o
       JOIN accounts a ON a.id=o.partner_account_id
       JOIN agency_workspaces w ON w.id=o.workspace_id AND w.status='active'
      WHERE o.id=$1 AND o.workspace_id=ANY($2::integer[])
        AND ${actor.audience === "office" ? "o.workspace_id=$3" : "o.partner_account_id=$3"}
      ${lock ? "FOR UPDATE OF o FOR SHARE OF w" : ""}`,
    [orderId, servicePilotWorkspaceIds(), actor.audience === "office" ? actor.workspaceId : actor.accountId],
  );
  return result.rows[0] as Row ?? null;
}

async function appendEvent(client: PoolClient, actor: ServiceActor, order: Row, command: string, payload: Json = {}, note: string | null = null) {
  if (!["record_fee", "record_refund", "record_cost"].includes(command)) {
    await client.query(`INSERT INTO sila_service_work_events(order_id,actor_account_id,action,note) VALUES($1,$2,$3,$4)`, [order.id, actor.accountId, command, note]);
  }
  await client.query(
    `INSERT INTO agency_domain_events
      (workspace_id,actor_account_id,event_type,payload,reference_type,reference_id,correlation_id)
     VALUES ($1,$2,$3,$4::jsonb,'service_order',$5,$6)`,
    [order.workspace_id, actor.accountId, `service.${command}`, JSON.stringify(sanitizeAgencyEventPayload({ ...payload, audience: actor.audience })), order.id, randomUUID()],
  );
}

async function totals(client: PoolClient, orderId: number) {
  const result = await client.query(
    `SELECT COALESCE(SUM(amount_minor) FILTER (WHERE kind='receipt'),0)::text AS collected,
            COALESCE(SUM(amount_minor) FILTER (WHERE kind='refund'),0)::text AS refunded,
            COALESCE(SUM(amount_minor) FILTER (WHERE kind='cost'),0)::text AS costs
       FROM sila_service_money_entries WHERE order_id=$1`, [orderId],
  );
  return { collected: Number(result.rows[0].collected), refunded: Number(result.rows[0].refunded), costs: Number(result.rows[0].costs) };
}

async function orderView(client: PoolClient, actor: ServiceActor, row: Row): Promise<ServiceOrderView> {
  const deliveries = await client.query<{ id: number; reference: string; submittedAt: Date }>(
    `SELECT id, reference, submitted_at AS "submittedAt" FROM sila_service_deliveries WHERE order_id=$1 ORDER BY id DESC`, [row.id],
  );
  const status = String(row.status) as ServiceStatus;
  const dueAt = new Date(String(row.due_at)).toISOString();
  const view: ServiceOrderView = {
    id: Number(row.id), workspaceId: Number(row.workspace_id), opportunityId: Number(row.opportunity_id), officeName: String(row.office_name),
    serviceName: String(row.service_name), status, revision: Number(row.revision), scope: String(row.scope),
    acceptanceCriteria: String(row.acceptance_criteria), dueAt, partnerName: String(row.partner_name),
    supplierCostMinor: Number(row.supplier_cost_minor), currency: String(row.currency),
    lastNote: row.last_note ? String(row.last_note) : null,
    completedAt: row.completed_at ? new Date(String(row.completed_at)).toISOString() : null,
    overdue: Date.parse(dueAt) < Date.now() && !["completed", "cancelled", "declined"].includes(status),
    deliveries: deliveries.rows.map((delivery) => ({ ...delivery, submittedAt: new Date(delivery.submittedAt).toISOString() })),
    timeline: [],
  };
  const timeline = await client.query(`SELECT action,note,created_at FROM sila_service_work_events WHERE order_id=$1 ORDER BY id`, [row.id]);
  view.timeline = timeline.rows.map((event) => ({ action: event.action, note: event.note, createdAt: new Date(event.created_at).toISOString() }));
  if (actor.audience === "office") {
    const links = await client.query(`SELECT id,expires_at FROM sila_service_status_links WHERE order_id=$1 AND revoked_at IS NULL AND expires_at>NOW()`, [row.id]);
    view.statusLink = links.rows[0] ? { id: Number(links.rows[0].id), expiresAt: new Date(links.rows[0].expires_at).toISOString() } : null;
    view.qualificationReference = String(row.qualification_reference);
    const entries = await client.query(`SELECT kind,amount_minor,reference,note,created_at FROM sila_service_money_entries WHERE order_id=$1 ORDER BY id`, [row.id]);
    view.moneyEntries = entries.rows.map((entry) => ({ kind: entry.kind, amountMinor: Number(entry.amount_minor), reference: entry.reference, note: entry.note, createdAt: new Date(entry.created_at).toISOString() }));
    const sums = await totals(client, view.id);
    view.finance = {
      ...serviceEconomics(Number(row.sila_fee_minor), sums.collected, sums.refunded, sums.costs),
      agencySellMinor: Number(row.agency_sell_minor),
      agencyMarginBeforeOperatingCostsMinor: Number(row.agency_sell_minor) - Number(row.supplier_cost_minor) - Number(row.sila_fee_minor),
    };
  }
  return view;
}

async function createOrder(client: PoolClient, actor: ServiceActor, body: Json): Promise<ServiceResult> {
  if (actor.audience !== "office") return fail("إنشاء الطلب متاح لصاحب المكتب فقط.", 403);
  const opportunityId = serviceId(body.opportunityId);
  const supplierOptionId = serviceId(body.supplierOptionId);
  const partnerEmail = serviceText(body.partnerEmail, 320)?.toLowerCase();
  const scope = serviceText(body.scope, 4000);
  const acceptance = serviceText(body.acceptanceCriteria, 2000);
  const qualification = serviceText(body.qualificationReference, 1000);
  const fee = serviceMinor(body.silaFeeMinor);
  const due = typeof body.dueAt === "string" && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(body.dueAt) ? Date.parse(body.dueAt) : NaN;
  if (!opportunityId || !supplierOptionId || !partnerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partnerEmail) || !scope || !acceptance || !qualification || fee === null || !Number.isFinite(due) || due <= Date.now() || due > Date.now() + 366 * 86_400_000 || body.confirmScopeSharing !== true) {
    return fail("أكمل الشريك ونطاق الخدمة ومعيار القبول ومرجع تأهيله والموعد والرسوم، وأكد مشاركة النطاق معه.", 422);
  }
  const versions = await client.query(
    `SELECT qv.id, qv.currency, qv.lines_snapshot
       FROM agency_opportunities o
       JOIN agency_quote_versions qv ON qv.id=o.won_quote_version_id AND qv.workspace_id=o.workspace_id AND qv.opportunity_id=o.id
       JOIN agency_quotes q ON q.id=qv.quote_id AND q.workspace_id=o.workspace_id AND q.opportunity_id=o.id
      WHERE o.id=$1 AND o.workspace_id=$2 AND o.stage='won' AND q.status='accepted'
      FOR SHARE OF o, q, qv`, [opportunityId, actor.workspaceId],
  );
  const version = versions.rows[0];
  if (!version) return fail("يلزم عرض معتمد ونتيجة تجارية مسجلة قبل تكليف الشريك.", 409);
  const parsed = parseQuoteLines(version.lines_snapshot);
  if (!parsed.ok) return fail("تعذر التحقق من بنود العرض المعتمد.", 409);
  const matching = parsed.value.filter((line) => line.supplierOptionId === supplierOptionId);
  if (matching.length !== 1) return fail("اختر بند مورد واحدًا من العرض المعتمد؛ البنود المكررة تحتاج توضيحًا.", 422);
  const line = matching[0];
  const supplierCost = serviceMinor(line.costUnitMinor * line.quantity);
  const agencySell = serviceMinor(line.sellUnitMinor * line.quantity);
  if (supplierCost === null || agencySell === null || !Number.isSafeInteger(agencySell - supplierCost - fee)) return fail("مبالغ الخدمة تتجاوز الدقة المسموح بها.", 422);
  const supplier = await client.query(
    `SELECT id FROM agency_supplier_options WHERE id=$1 AND workspace_id=$2 AND opportunity_id=$3 AND status IN ('active','selected') FOR SHARE`,
    [supplierOptionId, actor.workspaceId, opportunityId],
  );
  if (!supplier.rows[0]) return fail("بند المورد غير متاح لهذا الطلب.", 422);
  const partners = await client.query<{ id: number }>(
    `SELECT a.id FROM accounts a WHERE LOWER(a.email)=$1 AND NOT EXISTS (
       SELECT 1 FROM agency_memberships m WHERE m.account_id=a.id AND m.workspace_id=$2 AND m.status='active'
     )`, [partnerEmail, actor.workspaceId],
  );
  if (!partners.rows[0]) return fail("يلزم حساب شريك قائم خارج فريق المكتب. راجع بريد الحساب مع الشريك.", 422);
  const inserted = await client.query(
    `INSERT INTO sila_service_orders
      (workspace_id,opportunity_id,quote_version_id,supplier_option_id,partner_account_id,service_name,scope,
       acceptance_criteria,qualification_reference,due_at,currency,supplier_cost_minor,agency_sell_minor,sila_fee_minor,created_by_account_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [actor.workspaceId, opportunityId, version.id, supplierOptionId, partners.rows[0].id, line.label, scope, acceptance,
      qualification, new Date(due).toISOString(), line.currency, supplierCost, agencySell, fee, actor.accountId],
  );
  const order = inserted.rows[0];
  await appendEvent(client, actor, order, "created", { quoteVersionId: version.id, supplierOptionId, revision: 1 });
  return ok({ orderId: order.id, revision: 1, workStatus: "offered" }, 201);
}

async function mutateOrder(client: PoolClient, actor: ServiceActor, body: Json): Promise<ServiceResult> {
  const orderId = serviceId(body.orderId);
  const expectedRevision = serviceId(body.expectedRevision);
  if (!orderId || !expectedRevision) return fail("معرف الطلب ونسخته مطلوبان.", 422);
  const order = await loadOrder(client, actor, orderId, true);
  if (!order) return fail("الطلب غير متاح لهذا الحساب.", 404);
  if (Number(order.revision) !== expectedRevision) return fail("الطلب اتحدث بالفعل. حدّث الصفحة وراجع الحالة قبل المحاولة.", 409);
  const command = String(body.command);
  const note = body.note == null || body.note === "" ? null : serviceText(body.note, 2000);
  if (body.note != null && body.note !== "" && !note) return fail("ملاحظة العملية أطول من الحد المسموح.", 422);
  let nextStatus = String(order.status) as ServiceStatus;
  let nextNote = note;
  if (["record_fee", "record_refund", "record_cost"].includes(command)) {
    if (actor.audience !== "office") return fail("التسجيل المالي متاح لصاحب المكتب فقط.", 403);
    const amount = serviceMinor(body.amountMinor, true);
    const reference = serviceText(body.reference, 500);
    if (amount === null || !reference || !note || note.length > 1000) return fail("أدخل المبلغ ومرجع إثباته وملاحظة التسجيل.", 422);
    const sums = await totals(client, orderId);
    const fee = Number(order.sila_fee_minor);
    if (command === "record_fee" && (sums.collected - sums.refunded + amount > fee || !Number.isSafeInteger(sums.collected + amount))) return fail("المبلغ يتجاوز رصيد رسوم صلة المتفق عليها.", 422);
    if (command === "record_refund" && amount > sums.collected - sums.refunded) return fail("الاسترداد يتجاوز الرسوم المحصلة المتبقية.", 422);
    if (command === "record_cost" && !Number.isSafeInteger(sums.costs + amount)) return fail("إجمالي التكاليف يتجاوز الدقة المسموح بها.", 422);
    const kind = command === "record_fee" ? "receipt" : command === "record_refund" ? "refund" : "cost";
    await client.query(
      `INSERT INTO sila_service_money_entries (order_id,actor_account_id,kind,amount_minor,reference,note) VALUES ($1,$2,$3,$4,$5,$6)`,
      [orderId, actor.accountId, kind, amount, reference, note],
    );
    // Partner views must never inherit private accounting notes.
    nextNote = order.last_note == null ? null : String(order.last_note);
  } else {
    const transition = serviceTransition(command, actor.audience, nextStatus);
    if (!transition) return fail("هذه العملية غير مسموحة لهذا الطرف في حالة الطلب الحالية.", 409);
    if (["decline_assignment", "request_rework", "cancel"].includes(command) && !note) return fail("سبب الإجراء مطلوب لحفظ تاريخ الطلب.", 422);
    if (command === "accept_assignment" && new Date(String(order.due_at)).getTime() <= Date.now()) return fail("موعد التكليف انتهى. اطلب من المكتب تكليفًا بموعد جديد.", 409);
    if (command === "deliver") {
      const reference = serviceText(body.deliveryReference, 2000);
      if (!reference) return fail("وصف التسليم أو مرجعه مطلوب قبل إرساله للمراجعة.", 422);
      await client.query(`INSERT INTO sila_service_deliveries (order_id,submitted_by_account_id,reference) VALUES ($1,$2,$3)`, [orderId, actor.accountId, reference]);
    }
    nextStatus = transition;
  }
  const updated = await client.query<{ revision: number }>(
    `UPDATE sila_service_orders SET status=$1::varchar, revision=revision+1,
       last_note=$2, completed_at=CASE WHEN $1::varchar='completed' THEN COALESCE(completed_at,NOW()) ELSE NULL END, updated_at=NOW()
     WHERE id=$3 RETURNING revision`, [nextStatus, nextNote, orderId],
  );
  await appendEvent(client, actor, order, command, { previousStatus: order.status, status: nextStatus, revision: updated.rows[0].revision }, note);
  return ok({ orderId, revision: updated.rows[0].revision, workStatus: nextStatus });
}

export async function executeServiceCommand(actor: ServiceActor, body: Json): Promise<ServiceResult> {
  if (servicePilotWorkspaceIds().length === 0 || (actor.audience === "office" && (!actor.workspaceId || !isServicePilotWorkspace(actor.workspaceId)))) return fail("خدمة التنفيذ غير مفعلة لهذا المكتب.", 404);
  const keys = serviceCommandKeys(body.command);
  const requestId = serviceText(body.requestId, 80);
  if (!keys || Object.keys(body).some((key) => !keys.includes(key)) || !requestId || !/^[a-zA-Z0-9_-]{8,80}$/.test(requestId)) return fail("إجراء غير صالح أو حقول غير مسموحة أو معرف إعادة المحاولة مفقود.", 422);
  const digest = createHash("sha256").update(JSON.stringify(canonical({ actor, body }))).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (actor.audience === "office") {
      const role = await officeAccess(client, actor, true);
      if (!role) { await client.query("ROLLBACK"); return fail("مساحة المكتب غير متاحة لهذا الحساب.", 404); }
      if (role !== "owner") { await client.query("ROLLBACK"); return fail("اعتماد التنفيذ والتسجيل المالي متاحان لصاحب المكتب.", 403); }
    } else {
      const orderId = serviceId(body.orderId);
      if (!orderId || !await loadOrder(client, actor, orderId, false)) { await client.query("ROLLBACK"); return fail("الطلب غير متاح لهذا الحساب.", 404); }
    }
    await client.query("SELECT pg_advisory_xact_lock($1,hashtext($2))", [actor.accountId, requestId]);
    const replay = await client.query<{ command_digest: string; response_status: number; response_body: Json }>(
      `SELECT command_digest,response_status,response_body FROM sila_service_command_receipts WHERE actor_account_id=$1 AND request_id=$2`, [actor.accountId, requestId],
    );
    if (replay.rows[0]) {
      await client.query("COMMIT");
      return replay.rows[0].command_digest === digest
        ? { status: replay.rows[0].response_status, body: replay.rows[0].response_body }
        : fail("معرف المحاولة استُخدم لإجراء مختلف.", 409);
    }
    const result = body.command === "create_order" ? await createOrder(client, actor, body) : await mutateOrder(client, actor, body);
    if (result.status >= 400) { await client.query("ROLLBACK"); return result; }
    await client.query(
      `INSERT INTO sila_service_command_receipts (actor_account_id,request_id,command_digest,response_status,response_body) VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [actor.accountId, requestId, digest, result.status, JSON.stringify(result.body)],
    );
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const code = (error as { code?: string }).code;
    if (code === "23505") return fail("يوجد تسجيل مطابق بالفعل. حدّث الصفحة قبل تكرار الإجراء.", 409);
    if (code === "23503" || code === "23514" || code === "P0001") return fail("تعذر قبول العملية بسبب تعارض في حالة الطلب أو المبالغ.", 422);
    if (code === "42P01") return fail("أدوات التجربة تحتاج إكمال تجهيز البيانات قبل استخدامها.", 503);
    console.error("Service fulfillment command failed", code ?? "unknown");
    return fail("تعذر تنفيذ الإجراء. أعد المحاولة بنفس الطلب لتجنب التكرار.", 500);
  } finally { client.release(); }
}

export async function listServiceOrders(actor: ServiceActor, opportunityId?: number): Promise<ServiceResult> {
  if (servicePilotWorkspaceIds().length === 0) return fail("تجربة التنفيذ غير مفعلة.", 404);
  const client = await pool.connect();
  try {
    // Keep revision, deliveries and accounting totals from one database snapshot.
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    if (actor.audience === "office" && !await officeAccess(client, actor)) { await client.query("ROLLBACK"); return fail("مساحة المكتب غير متاحة لهذا الحساب.", 404); }
    if (actor.audience === "office" && opportunityId) {
      const opportunity = await client.query(`SELECT id FROM agency_opportunities WHERE id=$1 AND workspace_id=$2`, [opportunityId, actor.workspaceId]);
      if (!opportunity.rows[0]) { await client.query("ROLLBACK"); return fail("الفرصة غير متاحة لهذا المكتب.", 404); }
    }
    const rows = await client.query(
      `SELECT o.*, a.display_name AS partner_name, w.name AS office_name
       FROM sila_service_orders o JOIN accounts a ON a.id=o.partner_account_id
       JOIN agency_workspaces w ON w.id=o.workspace_id AND w.status='active'
       WHERE o.workspace_id=ANY($1::integer[]) AND ${actor.audience === "office" ? "o.workspace_id=$2" : "o.partner_account_id=$2"}
         AND ($3::integer IS NULL OR o.opportunity_id=$3) ORDER BY o.created_at DESC LIMIT 100`,
      [servicePilotWorkspaceIds(), actor.audience === "office" ? actor.workspaceId : actor.accountId, opportunityId ?? null],
    );
    const orders: ServiceOrderView[] = [];
    for (const row of rows.rows) orders.push(await orderView(client, actor, row));
    const eligibleSuppliers: Json[] = [];
    if (actor.audience === "office" && opportunityId) {
      const accepted = await client.query(
        `SELECT qv.lines_snapshot FROM agency_opportunities o
         JOIN agency_quote_versions qv ON qv.id=o.won_quote_version_id AND qv.workspace_id=o.workspace_id AND qv.opportunity_id=o.id
         WHERE o.id=$1 AND o.workspace_id=$2 AND o.stage='won'`, [opportunityId, actor.workspaceId],
      );
      if (accepted.rows[0]) {
        const parsed = parseQuoteLines(accepted.rows[0].lines_snapshot);
        if (parsed.ok) for (const line of parsed.value) if (line.supplierOptionId) eligibleSuppliers.push({ supplierOptionId: line.supplierOptionId, label: line.label, currency: line.currency });
      }
    }
    await client.query("COMMIT");
    return ok({ orders, eligibleSuppliers });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const code = (error as { code?: string }).code;
    console.error("Service fulfillment read failed", code ?? "unknown");
    return fail("تعذر تحميل أدوات التنفيذ. راجع تجهيز بيانات التجربة.", code === "42P01" ? 503 : 500);
  } finally { client.release(); }
}

export async function publicServiceProgress(token: string): Promise<ServiceResult> {
  if (servicePilotWorkspaceIds().length === 0) return ok({ services: [] });
  const quote = await getPublicQuoteDelivery(token);
  if (quote.status >= 400) return quote;
  const rows = await pool.query(
    `SELECT o.service_name AS "serviceName",o.status,o.due_at AS "dueAt",o.completed_at AS "completedAt"
     FROM agency_quote_deliveries d JOIN sila_service_orders o
       ON o.quote_version_id=d.quote_version_id AND o.workspace_id=d.workspace_id AND o.opportunity_id=d.opportunity_id
     JOIN agency_workspaces w ON w.id=o.workspace_id AND w.status='active'
     WHERE d.token_digest=$1 AND d.status IN ('active','responded') AND d.expires_at>NOW()
       AND o.workspace_id=ANY($2::integer[])
       AND o.status NOT IN ('declined','cancelled') ORDER BY o.id`,
    [quoteDeliveryTokenDigest(token), servicePilotWorkspaceIds()],
  );
  return ok({ services: rows.rows.map((row) => ({ serviceName: row.serviceName, status: row.status, dueAt: new Date(row.dueAt).toISOString(), completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null })) });
}

export async function manageServiceStatusLink(actor: ServiceActor, body: Json): Promise<ServiceResult> {
  const orderId = serviceId(body.orderId);
  const revision = serviceId(body.expectedRevision);
  if (actor.audience !== "office" || !actor.workspaceId || !isServicePilotWorkspace(actor.workspaceId)) return fail("متابعة العميل غير متاحة لهذا الحساب.", 404);
  if (!orderId || !revision || !["issue", "revoke"].includes(String(body.command)) || Object.keys(body).some((key) => !["command", "orderId", "expectedRevision"].includes(key))) return fail("بيانات رابط المتابعة غير صالحة.", 422);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const role = await officeAccess(client, actor, true);
    if (role !== "owner") { await client.query("ROLLBACK"); return fail("إدارة رابط العميل متاحة لصاحب المكتب فقط.", role ? 403 : 404); }
    const order = await loadOrder(client, actor, orderId, true);
    if (!order) { await client.query("ROLLBACK"); return fail("الطلب غير متاح لهذا المكتب.", 404); }
    if (Number(order.revision) !== revision) { await client.query("ROLLBACK"); return fail("حدّث الطلب قبل إدارة رابط المتابعة.", 409); }
    const revoked = await client.query<{ id: number }>(`UPDATE sila_service_status_links SET revoked_at=NOW() WHERE order_id=$1 AND revoked_at IS NULL RETURNING id`, [orderId]);
    if (revoked.rows.length) await client.query(`INSERT INTO agency_domain_events(workspace_id,actor_account_id,event_type,payload,reference_type,reference_id,correlation_id) VALUES($1,$2,'service.status_link_revoked',$3::jsonb,'service_order',$4,$5)`, [actor.workspaceId, actor.accountId, JSON.stringify({ linkIds: revoked.rows.map((row) => row.id) }), orderId, randomUUID()]);
    if (body.command === "revoke") {
      await client.query("COMMIT");
      return ok({ revoked: true });
    }
    const token = generateQuoteDeliveryToken();
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const issued = await client.query<{ id: number }>(`INSERT INTO sila_service_status_links(order_id,token_digest,expires_at,created_by_account_id) VALUES($1,$2,$3,$4) RETURNING id`, [orderId, quoteDeliveryTokenDigest(token), expiresAt, actor.accountId]);
    await client.query(`INSERT INTO agency_domain_events(workspace_id,actor_account_id,event_type,payload,reference_type,reference_id,correlation_id) VALUES($1,$2,'service.status_link_issued',$3::jsonb,'service_order',$4,$5)`, [actor.workspaceId, actor.accountId, JSON.stringify({ linkId: issued.rows[0].id, expiresAt }), orderId, randomUUID()]);
    await client.query("COMMIT");
    // Deliberately absent from command receipts, logs and database: raw access token.
    return ok({ token, expiresAt }, 201);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const code = (error as { code?: string }).code;
    console.error("Service status link failed", code ?? "unknown");
    return fail("تعذر إدارة الرابط. يمكنك إصدار رابط جديد لإلغاء أي رابط سابق.", code === "42P01" ? 503 : 500);
  } finally { client.release(); }
}

export async function publicStandaloneServiceProgress(token: string): Promise<ServiceResult> {
  if (!isValidQuoteDeliveryToken(token) || servicePilotWorkspaceIds().length === 0) return fail("رابط المتابعة غير متاح.", 404);
  try {
    const result = await pool.query(
      `SELECT l.expires_at,l.revoked_at,w.name AS office_name,o.service_name,o.status,o.due_at,o.completed_at
       FROM sila_service_status_links l JOIN sila_service_orders o ON o.id=l.order_id
       JOIN agency_workspaces w ON w.id=o.workspace_id AND w.status='active'
       WHERE l.token_digest=$1 AND o.workspace_id=ANY($2::integer[])`,
      [quoteDeliveryTokenDigest(token), servicePilotWorkspaceIds()],
    );
    const row = result.rows[0];
    if (!row) return fail("رابط المتابعة غير متاح.", 404);
    if (row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) return fail("انتهت صلاحية الرابط أو ألغاه المكتب. اطلب رابط متابعة جديدًا.", 410);
    return ok({ officeName: row.office_name, serviceName: row.service_name, status: row.status,
      dueAt: new Date(row.due_at).toISOString(), completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
      expiresAt: new Date(row.expires_at).toISOString() });
  } catch (error) {
    console.error("Service status read failed", (error as { code?: string }).code ?? "unknown");
    return fail("تعذر تحميل المتابعة الآن. تواصل مع المكتب لمعرفة حالة الخدمة.", 503);
  }
}
