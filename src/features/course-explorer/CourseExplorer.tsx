import { useMemo, useState } from 'react';
import type { Course } from '../../domain/courses/types';
import { useStore } from '../../app/store';
import { assessOffering } from '../../domain/offerings/assess';
import { OFFERING_INDEX } from '../../data/offerings2026';
import { academicYearForTerm, calendarYearOfTermId } from '../../domain/terms/terms';
import type { Term } from '../../domain/terms/terms';
import { OfferingBadge } from '../../components/StatusBadge';
import {
  DEFAULT_FILTERS,
  GE_FILTER_OPTIONS,
  departmentList,
  describeActiveFilters,
  filtersAreDefault,
  searchCourses,
  type SearchFilters,
} from './search';

/**
 * Course Explorer — the left rail.
 *
 * Search results update as text and filters change, every result links to its
 * official Catalogue record, and adding a course never requires drag-and-drop.
 */

interface Props {
  terms: Term[];
  /** Term used for "eligible by" and offering evaluation. */
  selectedTermId: string;
  onSelectTerm: (termId: string) => void;
}

export function CourseExplorer({ terms, selectedTermId, onSelectTerm }: Props) {
  const catalogue = useStore((s) => s.catalogue);
  const explorerFilterCodes = useStore((s) => s.explorerFilterCodes);
  const setExplorerFilterCodes = useStore((s) => s.setExplorerFilterCodes);
  const addCourse = useStore((s) => s.addCourse);
  const openDetail = useStore((s) => s.openDetail);

  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const effectiveFilters = useMemo<SearchFilters>(
    () => ({ ...filters, onlyCodes: explorerFilterCodes }),
    [filters, explorerFilterCodes],
  );

  const departments = useMemo(() => (catalogue ? departmentList(catalogue.courses) : []), [catalogue]);

  const { results, total } = useMemo(() => {
    if (!catalogue) return { results: [] as Course[], total: 0 };
    return searchCourses(catalogue.courses, effectiveFilters);
  }, [catalogue, effectiveFilters]);

  const activeFilterText = describeActiveFilters(effectiveFilters);
  const isDefault = filtersAreDefault(effectiveFilters);

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setExplorerFilterCodes(null);
  }

  return (
    <>
      <div className="rail-header">
        <h2 id="explorer-heading">Course Explorer</h2>
        <button
          type="button"
          className="subtle"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          aria-controls="explorer-filters"
        >
          {showFilters ? 'Hide filters' : 'Filters'}
        </button>
      </div>

      <div className="rail-body">
        <label htmlFor="course-search" className="visually-hidden">
          Search courses by code, title, or keyword
        </label>
        <input
          id="course-search"
          type="search"
          placeholder="Search: COMPSCI 112, CS 112, “graphics”…"
          value={filters.query}
          onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
        />

        <div className="filter-row">
          <label htmlFor="eligibility-term" style={{ whiteSpace: 'nowrap' }}>
            Eligible by
          </label>
          <select
            id="eligibility-term"
            value={selectedTermId}
            onChange={(e) => onSelectTerm(e.target.value)}
          >
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.label}
              </option>
            ))}
          </select>
        </div>

        {showFilters ? (
          <div id="explorer-filters" style={{ marginTop: 8 }}>
            <fieldset>
              <legend>Filters</legend>

              <div className="filter-grid">
                <div>
                  <label htmlFor="filter-department">Department</label>
                  <select
                    id="filter-department"
                    value={filters.departments[0] ?? ''}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, departments: e.target.value ? [e.target.value] : [] }))
                    }
                  >
                    <option value="">All departments</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="filter-level">Level</label>
                  <select
                    id="filter-level"
                    value={filters.levels[0] ?? ''}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        levels: e.target.value ? [e.target.value as SearchFilters['levels'][number]] : [],
                      }))
                    }
                  >
                    <option value="">Any level</option>
                    <option value="lower">Lower division</option>
                    <option value="upper">Upper division</option>
                    <option value="graduate">Graduate</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="filter-ge">GE category</label>
                  <select
                    id="filter-ge"
                    value={filters.geCategories[0] ?? ''}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        geCategories: e.target.value ? [e.target.value as SearchFilters['geCategories'][number]] : [],
                      }))
                    }
                  >
                    <option value="">Any GE</option>
                    {GE_FILTER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="filter-prereq">Prerequisite state</label>
                  <select
                    id="filter-prereq"
                    value={filters.prerequisiteState}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, prerequisiteState: e.target.value as SearchFilters['prerequisiteState'] }))
                    }
                  >
                    <option value="any">Any</option>
                    <option value="none">No prerequisites</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="filter-min-units">Min units</label>
                  <input
                    id="filter-min-units"
                    type="number"
                    min={0}
                    max={20}
                    value={filters.minUnits ?? ''}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, minUnits: e.target.value ? Number(e.target.value) : null }))
                    }
                  />
                </div>
                <div>
                  <label htmlFor="filter-max-units">Max units</label>
                  <input
                    id="filter-max-units"
                    type="number"
                    min={0}
                    max={20}
                    value={filters.maxUnits ?? ''}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, maxUnits: e.target.value ? Number(e.target.value) : null }))
                    }
                  />
                </div>
              </div>

              <div className="filter-row">
                <input
                  id="filter-graduate"
                  type="checkbox"
                  checked={filters.includeGraduate}
                  onChange={(e) => setFilters((f) => ({ ...f, includeGraduate: e.target.checked }))}
                />
                <label htmlFor="filter-graduate">Show graduate/professional and restricted courses</label>
              </div>
              <div className="filter-row">
                <input
                  id="filter-restricted"
                  type="checkbox"
                  checked={filters.hideRestricted}
                  onChange={(e) => setFilters((f) => ({ ...f, hideRestricted: e.target.checked }))}
                />
                <label htmlFor="filter-restricted">Hide courses with enrollment restrictions</label>
              </div>
            </fieldset>
          </div>
        ) : null}

        <div className="result-meta" role="status" aria-live="polite">
          <span>
            {total.toLocaleString()} {total === 1 ? 'course' : 'courses'}
            {results.length < total ? ` (showing first ${results.length})` : ''}
          </span>
          {!isDefault ? (
            <button type="button" className="subtle" onClick={resetFilters}>
              Reset filters
            </button>
          ) : null}
        </div>

        {!isDefault && activeFilterText.length > 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Active: {activeFilterText.join('; ')}.</p>
        ) : null}

        {results.length === 0 ? (
          <div className="callout info">
            <strong>No courses match.</strong>
            {activeFilterText.length > 0 ? (
              <span>Active filters: {activeFilterText.join('; ')}.</span>
            ) : (
              <span>Try a course code such as COMPSCI 112 or a keyword such as “graphics”.</span>
            )}
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-labelledby="explorer-heading">
            {results.map((course) => (
              <li key={course.id}>
                <CourseResultCard
                  course={course}
                  selectedTermId={selectedTermId}
                  onAdd={() => addCourse(course.normalizedCode, selectedTermId)}
                  onOpen={() => openDetail(course.normalizedCode)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function CourseResultCard({
  course,
  selectedTermId,
  onAdd,
  onOpen,
}: {
  course: Course;
  selectedTermId: string;
  onAdd: () => void;
  onOpen: () => void;
}) {
  const offering = useMemo(() => {
    const year = calendarYearOfTermId(selectedTermId);
    const season = /-(fall|winter|spring|summer)/.exec(selectedTermId)?.[1];
    if (year === null || !season) return null;
    return assessOffering({
      record: OFFERING_INDEX.get(course.normalizedCode),
      termId: selectedTermId,
      academicYear: academicYearForTerm(year, season as 'fall'),
    });
  }, [course.normalizedCode, selectedTermId]);

  const units = course.units.variable
    ? `${course.units.min}–${course.units.max} units`
    : `${course.units.max} units`;

  return (
    <article className="course-card">
      <div className="row">
        <span className="code title">{course.code}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{units}</span>
      </div>
      <div style={{ fontWeight: 500 }}>{course.title}</div>
      {course.description ? <p className="desc">{course.description}</p> : null}

      <div className="badges">
        {course.geCategories.map((ge) => (
          <span key={ge.category} className="badge neutral" title={`Printed as “${ge.raw}”`}>
            GE {ge.category}
          </span>
        ))}
        {course.prerequisiteExpr ? (
          <span className="badge info" title={course.prerequisiteRaw}>
            Has prerequisites
          </span>
        ) : null}
        {course.restrictions.length > 0 ? (
          <span className="badge warn" title={course.restrictions[0]!.raw}>
            Restricted
          </span>
        ) : null}
        {course.level === 'graduate' || course.level === 'professional' ? (
          <span className="badge neutral">Graduate</span>
        ) : null}
        {offering ? <OfferingBadge state={offering.state} title={offering.explanation} /> : null}
      </div>

      <div className="actions">
        <button type="button" className="primary" onClick={onAdd}>
          Add to term
        </button>
        <button type="button" onClick={onOpen}>
          Details
        </button>
        <a
          href={course.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          style={{ fontSize: 12, alignSelf: 'center' }}
        >
          Catalogue {course.catalogueYear} ↗
        </a>
      </div>
    </article>
  );
}
