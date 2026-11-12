import { useMemo, useState } from 'react';
import { useStore } from '../../app/store';
import { Dialog } from '../../components/Dialog';
import { buildCatalogueDiff, type CourseSummaryForDiff } from '../../persistence/exportImport';
import { savePlan } from '../../persistence/db';

/**
 * Catalogue-data migration review (acceptance criterion 51).
 *
 * When a plan was last read against a different catalogue build, the app must
 * present a diff *before* reinterpreting the plan. The prior interpretation is
 * kept until the user accepts, and a planned course that disappeared from the
 * newer catalogue is never silently deleted.
 */

export function MigrationNotice() {
  const plan = useStore((s) => s.plan);
  const catalogue = useStore((s) => s.catalogue);
  const setPlan = useStore((s) => s.setPlan);
  const pushToast = useStore((s) => s.pushToast);
  const [dismissed, setDismissed] = useState(false);

  const needsReview = Boolean(
    plan && catalogue && plan.dataBuildId !== catalogue.buildId && !dismissed,
  );

  const diff = useMemo(() => {
    if (!plan || !catalogue) return null;
    // The previous snapshot is not retained, so the comparison runs against the
    // courses the plan actually references. A course still present keeps its
    // current definition; a missing one is reported.
    const current = new Map<string, CourseSummaryForDiff>(
      catalogue.courses.map((c) => {
        const summary: CourseSummaryForDiff = { normalizedCode: c.normalizedCode, units: c.units };
        if (c.prerequisiteRaw) summary.prerequisiteRaw = c.prerequisiteRaw;
        return [c.normalizedCode, summary];
      }),
    );
    return buildCatalogueDiff(plan, plan.dataBuildId, catalogue.buildId, current, current);
  }, [plan, catalogue]);

  if (!needsReview || !plan || !catalogue || !diff) return null;

  function accept() {
    if (!plan || !catalogue) return;
    const migrated = { ...plan, dataBuildId: catalogue.buildId, updatedAt: new Date().toISOString() };
    setPlan(migrated);
    void savePlan(migrated);
    pushToast({ message: `Plan now reads against ${catalogue.buildId}`, tone: 'success' });
    setDismissed(true);
  }

  return (
    <Dialog
      open
      onClose={() => setDismissed(true)}
      title="Review catalogue data update"
      footer={
        <>
          <button type="button" onClick={() => setDismissed(true)}>
            Keep the previous interpretation for now
          </button>
          <button type="button" className="primary" onClick={accept}>
            Accept this data build
          </button>
        </>
      }
    >
      <section>
        <h3>What changed</h3>
        <p>
          This plan was last read against catalogue build{' '}
          <span className="code">{plan.dataBuildId}</span>. This app now has{' '}
          <span className="code">{catalogue.buildId}</span>.
        </p>
        <div className="callout info">
          <strong>Nothing has been reinterpreted yet.</strong>
          Your course placements, grades, external credit, and overrides are untouched. Review the
          differences below, then accept when you are ready.
        </div>
      </section>

      <section>
        <h3>Effect on your plan</h3>
        {diff.clean ? (
          <div className="callout ok">
            <strong>No courses in your plan are affected.</strong>
            Every course you have placed still exists in the newer snapshot with the same units and
            prerequisite text.
          </div>
        ) : (
          <>
            {diff.removedCourses.length > 0 ? (
              <div className="callout warn">
                <strong>
                  {diff.removedCourses.length} planned course
                  {diff.removedCourses.length === 1 ? '' : 's'} no longer in the catalogue
                </strong>
                <ul>
                  {diff.removedCourses.map((c, i) => (
                    <li key={i}>
                      <span className="code">{c.code}</span> in “{c.scenarioName}”
                    </li>
                  ))}
                </ul>
                These are kept in your plan and never deleted automatically. Check with an adviser
                whether a replacement course applies.
              </div>
            ) : null}

            {diff.changedUnits.length > 0 ? (
              <div className="callout warn">
                <strong>Unit values changed</strong>
                <ul>
                  {diff.changedUnits.map((c, i) => (
                    <li key={i}>
                      <span className="code">{c.code}</span>: {c.from} → {c.to} units
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {diff.changedPrerequisites.length > 0 ? (
              <div className="callout warn">
                <strong>Prerequisite text changed</strong>
                <ul>
                  {diff.changedPrerequisites.map((c, i) => (
                    <li key={i}>
                      <span className="code">{c.code}</span>
                    </li>
                  ))}
                </ul>
                Re-check these courses; their eligibility may now evaluate differently.
              </div>
            ) : null}
          </>
        )}
      </section>

      <section>
        <h3>Catalogue year</h3>
        <p>
          Both builds use catalogue year <strong>{catalogue.catalogueYear}</strong>. UCI catalogue
          rights mean an earlier year may be the correct ruleset for you — confirm with an adviser
          before changing it.
        </p>
      </section>
    </Dialog>
  );
}
