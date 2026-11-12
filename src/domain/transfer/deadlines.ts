import type { Claim } from '../requirements/allocate';
import type { Term } from '../terms/terms';
import type { TransferProgram, EntryTerm } from './types';
import type { ProgramResult, TransferSnapshot } from './evaluate';
import { buildSnapshot, evaluateProgram } from './evaluate';
import type { TransferInstitution } from './types';
import type { Course } from '../courses/types';

/**
 * A dated application cycle is deliberately separate from the target registry.
 * The registry describes durable admission rules; this file describes when a
 * particular cycle closes and how late coursework may be completed.
 *
 * Dates after the last published cycle are projections of the school's stated
 * recurring month/day and are always labelled as such in the UI. A historical
 * estimate is a separate, more cautious category used only when the current
 * cycle is unpublished but an official historical pattern is useful for planning.
 */

export type CourseworkTiming = 'completed_by' | 'started_by';

interface RelativeDate {
  month: number;
  day: number;
  /** Offset from the calendar year in which the student would enroll. */
  yearOffset: number;
}

interface DeadlineTemplate {
  id: string;
  institutionId: string;
  programIds?: string[];
  entryTerm: EntryTerm;
  round?: string;
  deadline?: RelativeDate;
  courseworkCutoff: RelativeDate;
  courseworkTiming: CourseworkTiming;
  timingLabel: string;
  timingExplanation: string;
  sourceUrls: string[];
  /** Last entry year whose exact date is currently published. */
  publishedThrough?: number;
  /** A planning placeholder based on official historical dates, not a published cycle. */
  historicalEstimate?: boolean;
  /** A school-specific gate that must already be true on the deadline. */
  minimumCompletedQuartersAtApplication?: number;
  /** Brown publishes exact allowed quarter counts, not merely a range. */
  allowedRegularQuartersAtEntry?: number[];
  notes?: string[];
}

export interface ApplicationCycle {
  id: string;
  institutionId: string;
  programId: string;
  entryYear: number;
  entryTerm: EntryTerm;
  round?: string;
  applicationDeadline?: string;
  courseworkCutoff: string;
  courseworkTiming: CourseworkTiming;
  timingLabel: string;
  timingExplanation: string;
  sourceUrls: string[];
  projected: boolean;
  historicalEstimate: boolean;
  minimumCompletedQuartersAtApplication?: number;
  allowedRegularQuartersAtEntry?: number[];
  notes: string[];
}

export type DeadlineReadiness =
  | 'eligible'
  | 'on_track'
  | 'gaps'
  | 'not_eligible'
  | 'needs_review'
  | 'closed'
  | 'deadline_unpublished';

export interface DeadlineAudit {
  cycle: ApplicationCycle;
  atApplication: TransferSnapshot | null;
  byCourseworkCutoff: TransferSnapshot | null;
  applicationResult: ProgramResult | null;
  result: ProgramResult | null;
  readiness: DeadlineReadiness;
  headline: string;
  reasons: string[];
  termsAtApplication: Term[];
  termsAllowedAfterApplication: Term[];
  excludedTerms: Term[];
}

const d = (month: number, day: number, yearOffset = 0): RelativeDate => ({ month, day, yearOffset });
const src = (url: string): string[] => [url];

const UC_SOURCE = 'https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-transfer/dates-and-deadlines.html';
const UC_TAU_SOURCE = 'https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-transfer/after-you-apply/transfer-academic-update.html';

const TEMPLATES: DeadlineTemplate[] = [
  ...['berkeley', 'ucsd', 'ucla'].map((institutionId): DeadlineTemplate => ({
    id: `${institutionId}.fall`, institutionId, entryTerm: 'fall', deadline: d(11, 30, -1),
    courseworkCutoff: d(6, 30), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'End of the spring before enrollment',
    timingExplanation: 'UC uses the fall application plus the Transfer Academic Update and allows required units and major preparation through the following spring. Summer immediately before enrollment cannot repair UCLA/UC minimum-unit eligibility.',
    sourceUrls: [UC_SOURCE, UC_TAU_SOURCE],
  })),

  { id: 'cmu.fall', institutionId: 'cmu', entryTerm: 'fall', deadline: d(2, 16),
    courseworkCutoff: d(2, 16), courseworkTiming: 'started_by', publishedThrough: 2027,
    timingLabel: 'Courses completed or underway by the application deadline',
    timingExplanation: 'CMU requires at least one completed college term before the deadline; spring transfer availability is college- and space-dependent.',
    minimumCompletedQuartersAtApplication: 1,
    sourceUrls: src('https://www.cmu.edu/admission/admission/transfer-applicants') },
  { id: 'cmu.spring', institutionId: 'cmu', entryTerm: 'spring', deadline: d(10, 15, -1),
    courseworkCutoff: d(10, 15, -1), courseworkTiming: 'started_by', publishedThrough: 2027,
    timingLabel: 'Courses completed or underway by the application deadline',
    timingExplanation: 'The catalog lists October 15 for spring, but spring openings are exceptionally limited and depend on the admitting college.',
    minimumCompletedQuartersAtApplication: 1,
    notes: ['Spring admission may not be available in every CMU college in every year.'],
    sourceUrls: src('https://www.cmu.edu/admission/admission/transfer-applicants') },

  { id: 'gatech.fall', institutionId: 'gatech', entryTerm: 'fall', deadline: d(3, 1),
    courseworkCutoff: d(5, 30), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'Georgia Tech course-requirement deadline (May 30)',
    timingExplanation: 'Georgia Tech separates the application, document, and required-course deadlines. Courses may count when completed by the published course-requirement date.',
    sourceUrls: src('https://admission.gatech.edu/transfer/deadlines-fees') },
  { id: 'gatech.spring', institutionId: 'gatech', entryTerm: 'spring', deadline: d(9, 15, -1),
    courseworkCutoff: d(9, 15, -1), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'Published spring course-requirement deadline',
    timingExplanation: 'Required courses must be complete by Georgia Tech’s separate course-requirement deadline, which falls around the application deadline for spring entry.',
    sourceUrls: src('https://admission.gatech.edu/transfer/deadlines-fees') },
  { id: 'gatech.summer', institutionId: 'gatech', entryTerm: 'summer', deadline: d(1, 15),
    courseworkCutoff: d(5, 15), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'Georgia Tech course-requirement deadline (May 15)',
    timingExplanation: 'The summer application closes in January, but Georgia Tech publishes a later deadline for completing required courses.',
    sourceUrls: src('https://admission.gatech.edu/transfer/deadlines-fees') },

  { id: 'cornell.fall', institutionId: 'cornell', entryTerm: 'fall', deadline: d(3, 15),
    courseworkCutoff: d(3, 15), courseworkTiming: 'started_by', publishedThrough: 2027,
    timingLabel: 'Complete or in progress when the application is submitted',
    timingExplanation: 'Cornell’s college-specific transfer preparation is generally expected to be complete or in progress at application. At UCI, the spring quarter has not started by March 15 and is therefore excluded.',
    sourceUrls: src('https://admissions.cornell.edu/how-to-apply/transfer-applicants') },

  { id: 'uiuc.fall_priority', institutionId: 'uiuc', entryTerm: 'fall', round: 'Priority', deadline: d(2, 1),
    courseworkCutoff: d(2, 1), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'Required preparation completed before applying',
    timingExplanation: 'The requested Grainger and LAS computing programs publish fall-only program requirements. The priority round is evaluated conservatively using completed coursework.',
    sourceUrls: src('https://www.admissions.illinois.edu/transfer/') },
  { id: 'uiuc.fall_regular', institutionId: 'uiuc', entryTerm: 'fall', round: 'Regular', deadline: d(4, 1),
    courseworkCutoff: d(4, 1), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'Required preparation completed before applying',
    timingExplanation: 'UIUC’s regular transfer deadline is April 1 (materials April 5). Program prerequisites that must precede application are not credited merely because they appear later in the plan.',
    sourceUrls: src('https://www.admissions.illinois.edu/transfer/') },

  { id: 'utaustin.fall', institutionId: 'utaustin', entryTerm: 'fall', deadline: d(3, 1),
    courseworkCutoff: d(3, 1), courseworkTiming: 'started_by', publishedThrough: 2027,
    timingLabel: 'Completed or in progress at application',
    timingExplanation: 'UT’s 24 transferable hours may be complete or in progress when applying; major-specific prerequisites and grade floors still apply.',
    sourceUrls: src('https://admissions.utexas.edu/apply/transfer-students/') },
  { id: 'utaustin.spring', institutionId: 'utaustin', programIds: ['utaustin.math_bs'], entryTerm: 'spring', deadline: d(9, 1, -1),
    courseworkCutoff: d(9, 1, -1), courseworkTiming: 'started_by', publishedThrough: 2027,
    timingLabel: 'Completed or in progress at application',
    timingExplanation: 'The College of Natural Sciences accepts spring transfers, but the requested Computer Science program is fall-only.',
    sourceUrls: src('https://admissions.utexas.edu/apply/transfer-students/') },
  { id: 'utaustin.summer', institutionId: 'utaustin', programIds: ['utaustin.math_bs'], entryTerm: 'summer', deadline: d(3, 1),
    courseworkCutoff: d(3, 1), courseworkTiming: 'started_by', publishedThrough: 2027,
    timingLabel: 'Completed or in progress at application',
    timingExplanation: 'Summer entry is available through Natural Sciences for Mathematics, not for the requested CS or ECE programs.',
    sourceUrls: src('https://admissions.utexas.edu/apply/transfer-students/') },

  { id: 'uw.allen_autumn', institutionId: 'uw', programIds: ['uw.cs_bs', 'uw.ce_bs'], entryTerm: 'fall', deadline: d(4, 5),
    courseworkCutoff: d(4, 5), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'Completed before the Allen School deadline',
    timingExplanation: 'The UW application closes February 15, then the Allen School application closes April 5. Allen prerequisites must be completed and numerically graded before the departmental deadline.',
    sourceUrls: src('https://www.cs.washington.edu/academics/ugrad/admissions/transfer') },
  { id: 'uw.allen_spring', institutionId: 'uw', programIds: ['uw.cs_bs', 'uw.ce_bs'], entryTerm: 'spring', deadline: d(1, 15),
    courseworkCutoff: d(1, 15), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'Completed before the Allen School deadline',
    timingExplanation: 'The UW spring application closes December 15; the Allen School departmental deadline is January 15. No prerequisite may still be in progress.',
    sourceUrls: src('https://www.cs.washington.edu/academics/ugrad/admissions/transfer') },
  { id: 'uw.acms_autumn', institutionId: 'uw', programIds: ['uw.acms_bs'], entryTerm: 'fall', deadline: d(4, 5),
    courseworkCutoff: d(4, 5), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'Completed before the ACMS application closes',
    timingExplanation: 'ACMS is autumn-only for external transfer applicants and does not allow prerequisite courses to remain in progress at application.',
    sourceUrls: src('https://acms.washington.edu/admissions') },

  { id: 'umd.fall', institutionId: 'umd', entryTerm: 'fall', deadline: d(3, 1),
    courseworkCutoff: d(3, 1), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'Gateway courses completed before applying',
    timingExplanation: 'UMD Computer Science gateway requirements must be complete before the university application is filed.',
    sourceUrls: src('https://admissions.umd.edu/apply/admission-requirements/transfer-applicant-requirements') },
  { id: 'umd.spring', institutionId: 'umd', entryTerm: 'spring', deadline: d(10, 15, -1),
    courseworkCutoff: d(10, 15, -1), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'Gateway courses completed before applying',
    timingExplanation: 'UMD Computer Science gateway requirements must be complete before the October application deadline.',
    sourceUrls: src('https://admissions.umd.edu/apply/admission-requirements/transfer-applicant-requirements') },

  { id: 'umich.fall', institutionId: 'umich', entryTerm: 'fall', deadline: d(2, 1),
    courseworkCutoff: d(8, 15), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'Before the intended term of enrollment',
    timingExplanation: 'Michigan asks for all current and future courses. Engineering prerequisites may be completed, in progress, or planned at application but must be letter-graded C or better before enrollment.',
    sourceUrls: src('https://admissions.umich.edu/apply/transfer-applicants/requirements-deadlines') },
  { id: 'umich.winter', institutionId: 'umich', entryTerm: 'winter', deadline: d(10, 1, -1),
    courseworkCutoff: d(12, 31, -1), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'Before winter enrollment',
    timingExplanation: 'Fall courses are reportable as future/in-progress work and must be finished before the January term begins.',
    sourceUrls: src('https://admissions.umich.edu/apply/transfer-applicants/requirements-deadlines') },
  { id: 'umich.spring_half', institutionId: 'umich', entryTerm: 'spring', round: 'Spring Half Term', deadline: d(2, 1),
    courseworkCutoff: d(4, 15), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'Before Spring Half Term enrollment',
    timingExplanation: 'Michigan lists a February 1 deadline for Spring Half Term. Planned prerequisites must be completed before enrollment.',
    sourceUrls: src('https://admissions.umich.edu/apply/transfer-applicants/requirements-deadlines') },
  { id: 'umich.summer_half', institutionId: 'umich', entryTerm: 'summer', round: 'Summer Half Term', deadline: d(2, 1),
    courseworkCutoff: d(6, 15), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'Before Summer Half Term enrollment',
    timingExplanation: 'Michigan lists a February 1 deadline for Summer Half Term. Planned prerequisites must be completed before enrollment.',
    sourceUrls: src('https://admissions.umich.edu/apply/transfer-applicants/requirements-deadlines') },

  { id: 'nyu.fall', institutionId: 'nyu', entryTerm: 'fall', deadline: d(3, 15),
    courseworkCutoff: d(6, 30), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'By enrollment; spring work may be reviewed',
    timingExplanation: 'NYU lists current and planned work and says its most competitive transfers complete a full-time year by enrollment. CAS specifically accepts fall and spring external transfers.',
    sourceUrls: src('https://www.nyu.edu/admissions/undergraduate-admissions/how-to-apply/transfer-applicants.html') },
  { id: 'nyu.spring', institutionId: 'nyu', entryTerm: 'spring', deadline: d(10, 15, -1),
    courseworkCutoff: d(12, 31, -1), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'By spring enrollment',
    timingExplanation: 'Fall coursework after the October application can appear as in-progress work and must be completed before January enrollment.',
    sourceUrls: src('https://www.nyu.edu/admissions/undergraduate-admissions/how-to-apply/transfer-applicants.html') },

  { id: 'usc.fall', institutionId: 'usc', entryTerm: 'fall', deadline: d(2, 15),
    courseworkCutoff: d(6, 30), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'End of spring before enrollment',
    timingExplanation: 'USC may request spring grades. Viterbi preparation may be in progress at application but must be complete by the end of spring.',
    sourceUrls: src('https://admission.usc.edu/prospective-students/how-to-apply/transfer-students/') },

  { id: 'uva.seas_fall', institutionId: 'uva', programIds: ['uva.seas'], entryTerm: 'fall', deadline: d(3, 1),
    courseworkCutoff: d(3, 1), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'Engineering core completed before applying',
    timingExplanation: 'UVA Engineering admits external transfers for fall only and expects its core transfer courses complete before application; later exceptions require direct school review.',
    sourceUrls: src('https://admission.virginia.edu/transfer/about-transfer') },
  { id: 'uva.college_fall', institutionId: 'uva', programIds: ['uva.college_math'], entryTerm: 'fall', deadline: d(3, 1),
    courseworkCutoff: d(6, 30), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'By fall enrollment',
    timingExplanation: 'The College evaluates completed and nearly completed transfer preparation; spring coursework can be reflected in the final transcript.',
    sourceUrls: src('https://admission.virginia.edu/transfer/about-transfer') },
  { id: 'uva.college_spring', institutionId: 'uva', programIds: ['uva.college_math'], entryTerm: 'spring', deadline: d(10, 1, -1),
    courseworkCutoff: d(12, 31, -1), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: '24 semester hours earned by the end of fall',
    timingExplanation: 'Spring transfer is College of Arts & Sciences only. First-semester college students are ineligible, and 24 semester hours must be earned by the end of the preceding fall.',
    sourceUrls: src('https://admission.virginia.edu/transfer/about-transfer') },

  ...simpleFallTemplates(),

  { id: 'rice.spring', institutionId: 'rice', entryTerm: 'spring', deadline: d(10, 15, -1),
    courseworkCutoff: d(12, 31, -1), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'By spring enrollment',
    timingExplanation: 'Rice accepts spring transfers and can review fall work that is in progress on October 15 once final grades arrive.',
    sourceUrls: src('https://admission.rice.edu/apply/transfer-applicants') },

  { id: 'brown.spring', institutionId: 'brown', entryTerm: 'spring', deadline: d(10, 1, -1),
    courseworkCutoff: d(1, 6), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'Final fall transcript due January 6',
    timingExplanation: 'Brown’s spring 2027 calendar accepts the final fall transcript after the application. A quarter-system applicant must have exactly five regular quarters before January; summer does not count.',
    allowedRegularQuartersAtEntry: [5],
    notes: ['Spring entry is limited to U.S. citizens and permanent residents.', 'Brown permits only one transfer application per calendar year of entry.'],
    sourceUrls: ['https://admission.brown.edu/transfer/calendar', 'https://admission.brown.edu/transfer/eligibility-requirements'] },
  { id: 'brown.fall', institutionId: 'brown', entryTerm: 'fall', deadline: d(3, 1),
    courseworkCutoff: d(6, 15), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'Final academic-year transcript due June 15',
    timingExplanation: 'Brown explicitly asks quarter-system students for winter finals by April 1 and spring progress grades by April 16. Fall entrants must have exactly 3, 4, or 6 regular quarters before September; summer does not count.',
    allowedRegularQuartersAtEntry: [3, 4, 6],
    notes: ['Brown permits only one transfer application per calendar year of entry.'],
    sourceUrls: ['https://admission.brown.edu/transfer/calendar', 'https://admission.brown.edu/transfer/eligibility-requirements'] },

  { id: 'northwestern.fall_ed', institutionId: 'northwestern', entryTerm: 'fall', round: 'Transfer Early Decision', deadline: d(3, 1),
    courseworkCutoff: d(6, 30), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'Academic year completed before fall enrollment',
    timingExplanation: 'Transfer Early Decision is binding. Northwestern says successful transfers typically arrive with at least 36 quarter hours, so spring work is included as contingent future work.',
    notes: ['Transfer Early Decision is binding if admitted with adequate financial aid.'],
    sourceUrls: src('https://admissions.northwestern.edu/apply/application-deadlines.html') },
  { id: 'northwestern.fall_rd', institutionId: 'northwestern', entryTerm: 'fall', round: 'Regular Decision', deadline: d(4, 1),
    courseworkCutoff: d(6, 30), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'Academic year completed before fall enrollment',
    timingExplanation: 'Northwestern’s regular transfer deadline is April 1. Spring work can support the expected full academic year by enrollment but remains contingent until completed.',
    sourceUrls: src('https://admissions.northwestern.edu/apply/application-deadlines.html') },

  { id: 'mit.spring', institutionId: 'mit', entryTerm: 'spring', deadline: d(10, 15, -1),
    courseworkCutoff: d(12, 31, -1), courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'At least two full-time terms completed before entry',
    timingExplanation: 'MIT accepts spring transfer applications only from U.S. citizens and permanent residents. Fall work may finish after the deadline but before February entry.',
    allowedRegularQuartersAtEntry: [2, 3, 4, 5],
    notes: ['Applying for spring entry prevents another MIT transfer application for fall entry in the same calendar year.'],
    sourceUrls: src('https://mitadmissions.org/apply/transfer/deadlines/') },
];

/** Fall-only/common cycles whose target-specific timing is still conservative. */
function simpleFallTemplates(): DeadlineTemplate[] {
  const springCutoff = (id: string, institutionId: string, day: number, url: string, explanation: string): DeadlineTemplate => ({
    id, institutionId, entryTerm: 'fall', deadline: d(3, day), courseworkCutoff: d(6, 30),
    courseworkTiming: 'completed_by', publishedThrough: 2027,
    timingLabel: 'End of spring before enrollment', timingExplanation: explanation, sourceUrls: src(url),
  });
  return [
    springCutoff('upenn.fall', 'upenn', 15, 'https://admissions.upenn.edu/how-to-apply/transfer-applicants/requirements-deadlines', 'Penn requires one full year of transferable coursework by the spring before enrollment; the immediately preceding summer usually cannot be used to reach that minimum.'),
    springCutoff('columbia.fall', 'columbia', 1, 'https://undergrad.admissions.columbia.edu/apply/transfer', 'Columbia permits applicants who have earned or are registered to complete 24 points by enrollment, so spring work is included as contingent.'),
    { id: 'uchicago.fall_ted', institutionId: 'uchicago', entryTerm: 'fall', round: 'Transfer Early Decision',
      deadline: d(3, 1), courseworkCutoff: d(6, 30), courseworkTiming: 'completed_by',
      historicalEstimate: true, timingLabel: 'End of spring before enrollment',
      timingExplanation: 'This March 1 date is a historical planning estimate, not a published deadline for the selected cycle. UChicago historically used March 1 for Transfer Early Decision and moved it to the next business day when needed. Spring coursework may be reported as current or planned and is contingent on the final transcript.',
      notes: ['Transfer Early Decision is binding.', 'Verify the selected cycle on UChicago’s official application page before applying.'],
      sourceUrls: [
        'https://collegeadmissions.uchicago.edu/account/',
        'https://collegeadmissions.uchicago.edu/files/documents/uchicago-glance.pdf',
        'https://collegeadmissions.uchicago.edu/apply/application/required-materials/',
      ] },
    { id: 'uchicago.fall_rolling', institutionId: 'uchicago', entryTerm: 'fall', round: 'Transfer Rolling Decision priority',
      deadline: d(3, 1), courseworkCutoff: d(6, 30), courseworkTiming: 'completed_by',
      historicalEstimate: true, timingLabel: 'End of spring before enrollment',
      timingExplanation: 'This March 1 priority date is a historical planning estimate, not a published deadline for the selected cycle. An official historical UChicago guide listed March 1 for Transfer Rolling Decision priority, moving to the next business day when needed. Spring coursework may be reported as current or planned and is contingent on the final transcript.',
      notes: ['This is a priority date from historical official material, not a confirmed current-cycle deadline.', 'Verify that rolling transfer remains available for the selected cycle before applying.'],
      sourceUrls: [
        'https://collegeadmissions.uchicago.edu/files/documents/uchicago-glance.pdf',
        'https://collegeadmissions.uchicago.edu/apply/application/required-materials/',
      ] },
    springCutoff('duke.fall', 'duke', 15, 'https://admissions.duke.edu/apply/', 'Duke requires at least one completed college semester to apply; later spring work is shown as contingent preparation for enrollment.'),
    springCutoff('rice.fall', 'rice', 15, 'https://admission.rice.edu/apply/transfer-applicants', 'Rice accepts fall transfers by March 15; spring coursework is shown separately as contingent work completed before enrollment.'),
    springCutoff('dartmouth.fall', 'dartmouth', 1, 'https://admissions.dartmouth.edu/glossary-term/transfer', 'Dartmouth admits transfers for fall only and reviews the current college year; spring work is contingent until the final transcript.'),
    springCutoff('yale.fall', 'yale', 1, 'https://admissions.yale.edu/transfer-details', 'Yale requires at least two transferable course credits before entry and reviews the current academic year; exam credit is not transferable.'),
    springCutoff('harvard.fall', 'harvard', 1, 'https://college.harvard.edu/admissions/apply/transfer-applicants', 'Harvard requires one continuous full-time academic year by enrollment; spring completes that year but Harvard awards no transfer credit for AP/IB or the immediately preceding summer.'),
    springCutoff('princeton.fall', 'princeton', 1, 'https://admission.princeton.edu/transfer-students', 'Princeton requires one or more full-time years by the spring before enrollment. Testing is optional for fall 2027 and required again for fall 2028 entry.'),
    springCutoff('stanford.fall', 'stanford', 15, 'https://admission.stanford.edu/apply/transfer/', 'Stanford’s deadline is March 15. Spring courses are displayed as contingent preparation, not as work already completed at application.'),
    { id: 'mit.fall', institutionId: 'mit', entryTerm: 'fall', deadline: d(3, 1), courseworkCutoff: d(6, 30),
      courseworkTiming: 'completed_by', publishedThrough: 2027, timingLabel: 'Before fall entry',
      timingExplanation: 'MIT requires at least two full-time terms before entry and caps applicants at five terms. Spring work after March 1 is contingent until complete.',
      allowedRegularQuartersAtEntry: [2, 3, 4, 5],
      sourceUrls: src('https://mitadmissions.org/apply/transfer/deadlines/') },
  ];
}

const UCI_TERM_DATES: Record<string, { start: string; end: string }> = {
  '2026-summer-session_1': { start: '2026-06-22', end: '2026-07-29' },
  '2026-summer-ten_week': { start: '2026-06-22', end: '2026-08-28' },
  '2026-summer-session_2': { start: '2026-08-03', end: '2026-09-09' },
  '2026-fall': { start: '2026-09-24', end: '2026-12-11' },
  '2027-winter': { start: '2027-01-04', end: '2027-03-19' },
  '2027-spring': { start: '2027-03-29', end: '2027-06-11' },
  '2027-summer-session_1': { start: '2027-06-21', end: '2027-07-28' },
  '2027-summer-ten_week': { start: '2027-06-21', end: '2027-08-27' },
  '2027-summer-session_2': { start: '2027-08-02', end: '2027-09-08' },
  '2027-fall': { start: '2027-09-23', end: '2027-12-10' },
  '2028-winter': { start: '2028-01-10', end: '2028-03-24' },
  '2028-spring': { start: '2028-04-03', end: '2028-06-16' },
  '2028-summer-session_1': { start: '2028-06-26', end: '2028-08-03' },
  '2028-summer-ten_week': { start: '2028-06-26', end: '2028-09-01' },
  '2028-summer-session_2': { start: '2028-08-07', end: '2028-09-13' },
  '2028-fall': { start: '2028-09-28', end: '2028-12-15' },
  '2029-winter': { start: '2029-01-08', end: '2029-03-23' },
  '2029-spring': { start: '2029-04-02', end: '2029-06-15' },
  '2029-summer-session_1': { start: '2029-06-25', end: '2029-08-01' },
  '2029-summer-ten_week': { start: '2029-06-25', end: '2029-08-31' },
  '2029-summer-session_2': { start: '2029-08-06', end: '2029-09-12' },
  '2029-fall': { start: '2029-09-27', end: '2029-12-14' },
  '2030-winter': { start: '2030-01-07', end: '2030-03-22' },
  '2030-spring': { start: '2030-04-01', end: '2030-06-14' },
};

export const UCI_CALENDAR_SOURCES = [
  'https://www.reg.uci.edu/calendars/quarterly/2026-2027/quarterly26-27.html',
  'https://reg.uci.edu/calendars/quarterly/2027-2028/quarterly27-28.html',
  'https://reg.uci.edu/calendars/academic/tenyr-24-34.html',
];

function iso(spec: RelativeDate, entryYear: number): string {
  const year = entryYear + spec.yearOffset;
  return `${year}-${String(spec.month).padStart(2, '0')}-${String(spec.day).padStart(2, '0')}`;
}

function asTime(value: string): number {
  return Date.parse(`${value}T12:00:00Z`);
}

export function formatCycleDate(value: string | undefined): string {
  if (!value) return 'Not yet published';
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T12:00:00Z`));
}

export function formatEntry(cycle: Pick<ApplicationCycle, 'entryTerm' | 'entryYear' | 'round'>): string {
  const term = cycle.entryTerm.charAt(0).toUpperCase() + cycle.entryTerm.slice(1);
  return `${term} ${cycle.entryYear}${cycle.round ? ` — ${cycle.round}` : ''}`;
}

export function applicationCyclesForProgram(
  institution: TransferInstitution,
  program: TransferProgram,
  entryYears: number[] = [2027, 2028, 2029, 2030],
): ApplicationCycle[] {
  const institutionTemplates = TEMPLATES.filter((template) => template.institutionId === institution.id);
  const specific = institutionTemplates.filter((template) => template.programIds?.includes(program.id));
  const generic = institutionTemplates.filter((template) => !template.programIds);
  const templates = [...generic, ...specific].filter((template) =>
    program.eligibility.entryTerms.includes(template.entryTerm) || specific.includes(template),
  );

  return entryYears.flatMap((entryYear) => templates.map((template): ApplicationCycle => {
    const applicationDeadline = template.deadline ? iso(template.deadline, entryYear) : undefined;
    return {
      id: `${program.id}:${template.id}:${entryYear}`,
      institutionId: institution.id,
      programId: program.id,
      entryYear,
      entryTerm: template.entryTerm,
      round: template.round,
      applicationDeadline,
      courseworkCutoff: iso(template.courseworkCutoff, entryYear),
      courseworkTiming: template.courseworkTiming,
      timingLabel: template.timingLabel,
      timingExplanation: template.timingExplanation,
      sourceUrls: template.sourceUrls,
      projected: !template.historicalEstimate && applicationDeadline !== undefined && entryYear > (template.publishedThrough ?? -Infinity),
      historicalEstimate: template.historicalEstimate ?? false,
      minimumCompletedQuartersAtApplication: template.minimumCompletedQuartersAtApplication,
      allowedRegularQuartersAtEntry: template.allowedRegularQuartersAtEntry,
      notes: template.notes ?? [],
    };
  })).sort((a, b) => {
    const dateA = a.applicationDeadline ? asTime(a.applicationDeadline) : Number.MAX_SAFE_INTEGER;
    const dateB = b.applicationDeadline ? asTime(b.applicationDeadline) : Number.MAX_SAFE_INTEGER;
    return dateA - dateB || a.entryYear - b.entryYear;
  });
}

function allowedTerms(terms: Term[], date: string, timing: CourseworkTiming): Term[] {
  const cutoff = asTime(date);
  return terms.filter((term) => {
    const window = UCI_TERM_DATES[term.id];
    if (!window) return false;
    return asTime(timing === 'completed_by' ? window.end : window.start) <= cutoff;
  });
}

function makeSnapshot(
  claims: Claim[],
  terms: Term[],
  allowed: Term[],
  label: string,
  creditTotals: { examQuarterUnits: number; manualQuarterUnits: number },
): TransferSnapshot {
  const sequence = new Map(terms.map((term) => [term.id, term.sequence]));
  const last = allowed[allowed.length - 1] ?? terms[0];
  if (!last) throw new Error('Cannot evaluate a deadline without a UCI timeline.');
  return buildSnapshot(
    claims,
    sequence,
    last.id,
    label,
    creditTotals,
    new Set(allowed.map((term) => term.id)),
  );
}

function completedAtApplication(terms: Term[], deadline: string): Term[] {
  return allowedTerms(terms, deadline, 'completed_by');
}

export function evaluateApplicationCycle(
  institution: TransferInstitution,
  program: TransferProgram,
  cycle: ApplicationCycle,
  terms: Term[],
  claims: Claim[],
  courseIndex: Map<string, Course>,
  creditTotals: { examQuarterUnits: number; manualQuarterUnits: number },
): DeadlineAudit {
  if (!cycle.applicationDeadline) {
    return {
      cycle, atApplication: null, byCourseworkCutoff: null, applicationResult: null, result: null,
      readiness: 'deadline_unpublished', headline: 'Application deadline not yet published',
      reasons: ['The school has not published a dependable date for this cycle, so ZotPath will not guess which UCI terms fall before it.'],
      termsAtApplication: [], termsAllowedAfterApplication: [], excludedTerms: terms,
    };
  }

  const appTerms = allowedTerms(terms, cycle.applicationDeadline, 'started_by');
  const effectiveTerms = allowedTerms(terms, cycle.courseworkCutoff, cycle.courseworkTiming);
  const completedAppTerms = completedAtApplication(terms, cycle.applicationDeadline);
  const appSnapshot = makeSnapshot(
    claims, terms, appTerms, `application deadline (${formatCycleDate(cycle.applicationDeadline)})`, creditTotals,
  );
  const effectiveSnapshot = makeSnapshot(
    claims, terms, effectiveTerms, `${cycle.timingLabel} (${formatCycleDate(cycle.courseworkCutoff)})`, creditTotals,
  );
  const applicationResult = evaluateProgram(institution, program, appSnapshot, courseIndex);
  const result = evaluateProgram(institution, program, effectiveSnapshot, courseIndex);
  const reasons: string[] = [];
  let readiness: DeadlineReadiness;

  if (program.eligibility.closedToTransfer) {
    readiness = 'closed';
    reasons.push(program.eligibility.closedToTransfer);
  } else {
    const minimum = cycle.minimumCompletedQuartersAtApplication;
    const completedSnapshot = makeSnapshot(
      claims, terms, completedAppTerms, `completed by ${formatCycleDate(cycle.applicationDeadline)}`, creditTotals,
    );
    if (minimum !== undefined && completedSnapshot.regularQuartersCompleted < minimum) {
      readiness = 'not_eligible';
      reasons.push(`This cycle requires at least ${minimum} completed regular college quarter${minimum === 1 ? '' : 's'} by the application deadline; the plan shows ${completedSnapshot.regularQuartersCompleted}.`);
    } else if (
      cycle.allowedRegularQuartersAtEntry &&
      !cycle.allowedRegularQuartersAtEntry.includes(effectiveSnapshot.regularQuartersCompleted)
    ) {
      readiness = 'not_eligible';
      const singular = cycle.allowedRegularQuartersAtEntry.length === 1 && cycle.allowedRegularQuartersAtEntry[0] === 1;
      reasons.push(`This entry term accepts exactly ${cycle.allowedRegularQuartersAtEntry.join(', ')} regular quarter${singular ? '' : 's'} before entry; the plan shows ${effectiveSnapshot.regularQuartersCompleted}.`);
    } else if (result.eligibility === 'closed') {
      readiness = 'closed';
    } else if (result.eligibility === 'blocked') {
      readiness = 'not_eligible';
      reasons.push(...result.failingRules.map((entry) => `${entry.rule.title}: ${entry.detail}`));
    } else if (result.eligibility === 'needs_review') {
      readiness = 'needs_review';
      reasons.push('At least one blocking rule depends on information the planner cannot verify automatically.');
    } else if (result.coursework === 'gaps' || result.coursework === 'not_started') {
      readiness = 'gaps';
      reasons.push(`${result.blockingGaps.length} required preparation item${result.blockingGaps.length === 1 ? ' is' : 's are'} still missing by the allowed coursework cutoff.`);
    } else if (effectiveTerms.some((term) => !appTerms.some((atApp) => atApp.id === term.id))) {
      readiness = 'on_track';
      reasons.push('The plan clears the machine-checkable rules only after including coursework the school permits after the application deadline.');
    } else {
      readiness = 'eligible';
      reasons.push('No machine-checkable application or coursework rule fails by this deadline.');
    }
  }

  const appIds = new Set(appTerms.map((term) => term.id));
  const effectiveIds = new Set(effectiveTerms.map((term) => term.id));
  const headline: Record<DeadlineReadiness, string> = {
    eligible: 'Eligible to submit on this plan',
    on_track: 'On track if later permitted courses are completed',
    gaps: 'Coursework gaps remain for this deadline',
    not_eligible: 'Not eligible on this plan for this deadline',
    needs_review: 'Potentially eligible — manual review required',
    closed: 'This program is closed to external transfers',
    deadline_unpublished: 'Application deadline not yet published',
  };

  return {
    cycle, atApplication: appSnapshot, byCourseworkCutoff: effectiveSnapshot,
    applicationResult, result, readiness, headline: headline[readiness], reasons,
    termsAtApplication: appTerms,
    termsAllowedAfterApplication: effectiveTerms.filter((term) => !appIds.has(term.id)),
    excludedTerms: terms.filter((term) => !effectiveIds.has(term.id)),
  };
}

export function deadlineRegistryProblems(institutions: TransferInstitution[]): string[] {
  const problems: string[] = [];
  for (const institution of institutions) {
    for (const program of institution.programs) {
      const cycles = applicationCyclesForProgram(institution, program, [2027]);
      if (cycles.length === 0) problems.push(`${program.id} has no deadline cycle`);
      for (const entryTerm of program.eligibility.entryTerms) {
        if (!cycles.some((cycle) => cycle.entryTerm === entryTerm)) {
          problems.push(`${program.id} has no ${entryTerm} deadline cycle`);
        }
      }
    }
  }
  return problems;
}
