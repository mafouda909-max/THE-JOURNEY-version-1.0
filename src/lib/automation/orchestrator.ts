import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workflows, auditLog } from "@/db/schema";

/**
 * CENTRAL WORKFLOW ORCHESTRATOR
 *
 * Orchestrates domain workflows with status tracking, retries, idempotency,
 * and immutable execution audit records.
 */

export interface WorkflowTaskParams<TInput, TResult> {
  workflowId: string;
  triggerEvent: string;
  input: TInput;
  execute: (input: TInput) => Promise<TResult>;
  maxRetries?: number;
}

export interface WorkflowTaskRun<TResult> {
  workflowId: string;
  runId: string;
  status: "completed" | "failed";
  retryCount: number;
  result?: TResult;
  error?: string;
  startedAt: string;
  completedAt: string;
}

export class WorkflowOrchestrator {
  public async runWorkflow<TInput, TResult>(
    params: WorkflowTaskParams<TInput, TResult>,
  ): Promise<WorkflowTaskRun<TResult>> {
    const runId = `run_${params.workflowId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const maxRetries = params.maxRetries ?? 2;
    let currentRetry = 0;
    const startedAt = new Date().toISOString();

    // Record workflow run initialization
    await db.insert(workflows).values({
      workflowId: params.workflowId,
      runId,
      triggerEvent: params.triggerEvent,
      status: "running",
      retryCount: 0,
    });

    while (currentRetry <= maxRetries) {
      try {
        const result = await params.execute(params.input);
        const completedAt = new Date().toISOString();

        await db
          .update(workflows)
          .set({
            status: "completed",
            result: JSON.stringify(result),
            completedAt: new Date(),
          })
          .where(eq(workflows.runId, runId));

        await db.insert(auditLog).values({
          actor: "orchestrator",
          action: `workflow_completed:${params.workflowId}`,
          targetType: "workflow",
          targetId: 0,
          reason: `Workflow ${params.workflowId} run ${runId} completed successfully.`,
          meta: JSON.stringify({ runId, retries: currentRetry }),
        });

        return {
          workflowId: params.workflowId,
          runId,
          status: "completed",
          retryCount: currentRetry,
          result,
          startedAt,
          completedAt,
        };
      } catch (err: unknown) {
        currentRetry++;
        const errorMsg = err instanceof Error ? err.message : "Workflow execution failed";

        if (currentRetry > maxRetries) {
          const completedAt = new Date().toISOString();
          await db
            .update(workflows)
            .set({
              status: "failed",
              errors: errorMsg,
              retryCount: currentRetry,
              completedAt: new Date(),
            })
            .where(eq(workflows.runId, runId));

          await db.insert(auditLog).values({
            actor: "orchestrator",
            action: `workflow_failed:${params.workflowId}`,
            targetType: "workflow",
            targetId: 0,
            reason: `Workflow ${params.workflowId} run ${runId} failed: ${errorMsg}`,
            meta: JSON.stringify({ runId, error: errorMsg }),
          });

          return {
            workflowId: params.workflowId,
            runId,
            status: "failed",
            retryCount: currentRetry,
            error: errorMsg,
            startedAt,
            completedAt,
          };
        }

        await db
          .update(workflows)
          .set({
            status: "retrying",
            retryCount: currentRetry,
            errors: `Retry ${currentRetry}: ${errorMsg}`,
          })
          .where(eq(workflows.runId, runId));
      }
    }

    throw new Error("Unreachable workflow state");
  }
}

export const workflowOrchestrator = new WorkflowOrchestrator();
