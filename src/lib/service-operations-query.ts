export const SERVICE_OPERATIONS_SQL = `
WITH orders AS (
  SELECT o.*,
    EXISTS(SELECT 1 FROM sila_service_work_events e WHERE e.order_id=o.id AND e.action='accept_assignment') AS ever_accepted,
    EXISTS(SELECT 1 FROM sila_service_work_events e WHERE e.order_id=o.id AND e.action='request_rework') AS reworked
  FROM sila_service_orders o WHERE o.workspace_id=$1
), money AS (
  SELECT m.order_id,
    COALESCE(SUM(m.amount_minor) FILTER (WHERE m.kind='receipt'),0) AS collected,
    COALESCE(SUM(m.amount_minor) FILTER (WHERE m.kind='refund'),0) AS refunded,
    COALESCE(SUM(m.amount_minor) FILTER (WHERE m.kind='cost'),0) AS costs
  FROM sila_service_money_entries m JOIN orders o ON o.id=m.order_id GROUP BY m.order_id
), basis AS (
  SELECT o.*,COALESCE(m.collected,0) AS collected,COALESCE(m.refunded,0) AS refunded,COALESCE(m.costs,0) AS costs,
    COALESCE(m.collected,0)-COALESCE(m.refunded,0) AS net_collected
  FROM orders o LEFT JOIN money m ON m.order_id=o.id
)
SELECT transaction_timestamp() AS "observedAt",
  COUNT(*)::text AS assignments,
  COUNT(DISTINCT opportunity_id)::text AS opportunities,
  COUNT(*) FILTER (WHERE ever_accepted)::text AS accepted,
  COUNT(*) FILTER (WHERE status='offered')::text AS "awaitingPartner",
  COUNT(*) FILTER (WHERE status IN ('accepted','in_progress','rework'))::text AS "inProgress",
  COUNT(*) FILTER (WHERE status='delivered')::text AS "awaitingReview",
  COUNT(*) FILTER (WHERE status='completed')::text AS completed,
  COUNT(*) FILTER (WHERE status NOT IN ('completed','declined','cancelled') AND due_at < transaction_timestamp())::text AS overdue,
  COUNT(*) FILTER (WHERE ever_accepted AND reworked)::text AS reworked,
  COUNT(*) FILTER (WHERE ever_accepted AND (status IN ('completed','cancelled') OR due_at <= transaction_timestamp()))::text AS "evaluatedAccepted",
  COUNT(*) FILTER (WHERE ever_accepted AND status='completed' AND completed_at <= due_at)::text AS "onTimeCompleted",
  COUNT(*) FILTER (WHERE status='completed' AND net_collected < sila_fee_minor)::text AS "completedWithFeeBalance",
  COUNT(DISTINCT opportunity_id) FILTER (WHERE net_collected > 0)::text AS "paidOpportunities",
  (SELECT COALESCE(jsonb_agg(t ORDER BY t.currency),'[]'::jsonb) FROM (
    SELECT currency,
      SUM(collected)::text AS "collectedMinor",SUM(refunded)::text AS "refundedMinor",
      SUM(costs)::text AS "directCostMinor",SUM(net_collected)::text AS "netCollectedMinor",
      SUM(net_collected-costs)::text AS "cashContributionMinor",
      SUM(CASE WHEN status='completed' THEN sila_fee_minor-net_collected ELSE 0 END)::text AS "completedFeeBalanceMinor"
    FROM basis GROUP BY currency
  ) t) AS currencies
FROM basis
`;
