import type { Facts } from '../rules/domain/condition.js';
import type { ProjectRow, SiteRow } from './projects.repo.js';

/**
 * Flatten a project into the fact namespace used by rule conditions:
 *   project.*  department.*  site.*  jurisdiction.*  attributes.*
 * estimated_cost is exposed as a number for DSL comparisons only; money storage/arithmetic stays NUMERIC in SQL.
 */
export function buildFacts(project: ProjectRow, site: SiteRow | null, jurisdictionChain: { code: string; jurisdiction_type: string }[]): Facts {
  return {
    project: {
      estimated_cost: Number(project.estimated_cost),
      project_type: project.project_type_code,
      lifecycle_stage: project.lifecycle_stage,
    },
    department: { code: project.department_code },
    site: site
      ? {
          possession_status: site.possession_status,
          survey_status: site.survey_status,
          soil_investigation_status: site.soil_investigation_status,
          district: site.district,
          taluka: site.taluka,
        }
      : {},
    jurisdiction: {
      primary: jurisdictionChain[0]?.code ?? null,
      type: jurisdictionChain[0]?.jurisdiction_type ?? null,
      chain: jurisdictionChain.map((j) => j.code),
    },
    attributes: project.attributes ?? {},
  };
}
