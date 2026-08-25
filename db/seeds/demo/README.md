# Demo Seeds (Class 2 — SYNTHETIC data, AD-12)

Clearly-identifiable development/demo records for staging & local environments.

## Gating contract (ratified B9)
1. Demo scripts run ONLY when env `DEMO_SEED_ENABLED=true`
   (MUST be absent in the production environment).
2. Every demo row sets `is_demo = true`.
3. All demo PKs come from one fixed UUID namespace (deterministic, greppable).
4. Demo agents are visibly fictional ("وكيل تجريبي — Demo Agent …").
5. Production launch checklist gate:
   ```sql
   SELECT count(*) FROM public.offers WHERE is_demo;   -- MUST be 0 in prod
   ```
6. Cleanup = `SELECT public.purge_demo_data();`
   Real activity referencing demo offers BLOCKS the purge and is reported,
   never silently cascaded.

## Primary production guarantee (B9)
Production cleanliness + this purge gate + absent `DEMO_SEED_ENABLED`.
View-level demo filtering exists ONLY as defense-in-depth.

## Status
No demo dataset authored yet — first demo fixture set lands with Slice 1
(discovery needs demo verified-agents + published offers to prove the loop).
