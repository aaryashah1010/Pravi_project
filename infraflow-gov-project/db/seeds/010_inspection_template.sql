-- Configured inspection checklist. This is an operational checklist, NOT a statutory protocol.
-- Idempotent.

INSERT INTO inspection_templates (code, name, project_type_id, checklist_schema)
SELECT 'STRUCTURAL-WORK-CHECK',
       'Structural work quality checklist (configured, not a statutory protocol)',
       pt.id,
       $j$[
         {"code":"REBAR",   "label":"Reinforcement placement matches the approved drawing"},
         {"code":"COVER",   "label":"Cover blocks positioned as specified"},
         {"code":"SLUMP",   "label":"Slump test recorded for the batch"},
         {"code":"CUBES",   "label":"Concrete cube samples cast and tagged"},
         {"code":"SAFETY",  "label":"Site safety measures in place"},
         {"code":"ACCESS",  "label":"Work front free of hindrance (access / boundary / utilities)"}
       ]$j$::jsonb
FROM project_types pt WHERE pt.code = 'GOV_BUILDING'
ON CONFLICT (code) DO NOTHING;
