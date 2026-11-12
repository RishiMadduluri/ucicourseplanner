import type { TransferSatisfaction } from './types';

/**
 * Reusable UCI-side building blocks.
 *
 * Every target on the user's list asks for the same dozen or so things —
 * "two semesters of calculus", "calculus-based physics with lab", "one
 * programming course". Naming those once keeps the per-school data honest and
 * makes a correction to the UCI side propagate everywhere.
 *
 * Sequence facts these encode (2026-27 UCI Catalogue):
 *   - Lower-division writing is WRITING 50 + WRITING 60, or the Humanities Core
 *     writing sequence. WRITING 39A/B/C no longer exist.
 *   - CHEM 1A has no companion lab; CHEM 1LC's prerequisite is CHEM 1B. The
 *     clean "general chemistry with lab" pair at UCI is CHEM M2A + CHEM M2LA.
 *   - I&C SCI 46 already requires I&C SCI 33 and I&C SCI 45C, so a data
 *     structures requirement resolves through 46.
 *   - MATH 2D and 2E together cover a semester-system multivariable course;
 *     a quarter-system target's single multivariable course is MATH 2D.
 */

export const course = (code: string): TransferSatisfaction => ({ kind: 'course', code });
export const allOf = (...children: TransferSatisfaction[]): TransferSatisfaction => ({ kind: 'all_of', children });
export const anyOf = (...children: TransferSatisfaction[]): TransferSatisfaction => ({ kind: 'any_of', children });
export const nOf = (n: number, ...children: TransferSatisfaction[]): TransferSatisfaction => ({ kind: 'n_of', n, children });
export const evidence = (key: string, prompt: string): TransferSatisfaction => ({
  kind: 'external_evidence',
  key,
  prompt,
});

// ---- mathematics ---------------------------------------------------------

/** Calculus I. */
export const CALC_1 = course('MATH 2A');
/** Calculus II. */
export const CALC_2 = course('MATH 2B');
/** A full single-variable calculus sequence. */
export const CALC_SEQUENCE = allOf(CALC_1, CALC_2);
/** A semester-system "Calculus III / multivariable" course. */
export const MULTIVARIABLE_FULL = allOf(course('MATH 2D'), course('MATH 2E'));
/** A quarter-system multivariable course. */
export const MULTIVARIABLE_ONE_TERM = course('MATH 2D');
/** Linear algebra. I&C SCI 6N is computational and is not always accepted. */
export const LINEAR_ALGEBRA = anyOf(course('MATH 3A'), course('I&C SCI 6N'));
export const LINEAR_ALGEBRA_STRICT = course('MATH 3A');
/** Ordinary differential equations. */
export const DIFFERENTIAL_EQUATIONS = course('MATH 3D');
/**
 * A single course covering BOTH linear algebra and differential equations
 * (Berkeley Math 54, USC MATH 225) needs both UCI courses.
 */
export const LINEAR_ALGEBRA_AND_ODE = allOf(course('MATH 3A'), course('MATH 3D'));
/** Discrete mathematics / proof-based transition course. */
export const DISCRETE_MATH = anyOf(course('I&C SCI 6D'), course('MATH 13'), course('I&C SCI 6B'));
/** Introductory probability and statistics. */
export const PROBABILITY_STATISTICS = anyOf(
  course('STATS 67'),
  course('STATS 7'),
  course('EECS 55'),
);

// ---- computing -----------------------------------------------------------

/** CS1 — a first programming course. */
export const INTRO_PROGRAMMING = anyOf(
  allOf(course('I&C SCI 31'), course('I&C SCI 32')),
  course('I&C SCI H32'),
  course('EECS 10'),
  course('EECS 12'),
  course('MATH 9'),
);
/** CS2 — a second programming course. */
export const PROGRAMMING_2 = anyOf(course('I&C SCI 33'), course('EECS 22'), course('I&C SCI 45J'));
/** A C or C++ course, which several engineering schools name explicitly. */
export const C_OR_CPP = anyOf(course('I&C SCI 45C'), course('EECS 20'), course('EECS 22'));
/** A Java course — the Allen School's sequence is taught in Java. */
export const JAVA = anyOf(course('I&C SCI 45J'), course('EECS 40'));
/** Data structures. I&C SCI 46 already presumes 33 and 45C. */
export const DATA_STRUCTURES = course('I&C SCI 46');
/** Computer organization / systems. */
export const COMPUTER_SYSTEMS = anyOf(course('I&C SCI 51'), course('EECS 20'));
/** Digital logic design. */
export const DIGITAL_LOGIC = allOf(course('EECS 31'), course('EECS 31L'));
/** Introductory circuits. */
export const CIRCUITS = allOf(course('EECS 70A'), course('EECS 70LA'));

// ---- physical and life sciences -----------------------------------------

/** Calculus-based physics I, with laboratory. */
export const PHYSICS_1_WITH_LAB = allOf(course('PHYSICS 7C'), course('PHYSICS 7LC'));
/** Calculus-based physics II, with laboratory. */
export const PHYSICS_2_WITH_LAB = allOf(course('PHYSICS 7D'), course('PHYSICS 7LD'));
/** Calculus-based physics III (waves, optics, modern). */
export const PHYSICS_3 = course('PHYSICS 7E');
/** Physics I lecture only, where the target does not require a lab. */
export const PHYSICS_1 = course('PHYSICS 7C');
export const PHYSICS_2 = course('PHYSICS 7D');

/**
 * General chemistry WITH a laboratory. UCI's CHEM 1LC sits after CHEM 1B, so
 * the majors sequence (CHEM M2A + CHEM M2LA) is the only clean
 * one-term lecture-plus-lab pair.
 */
export const CHEMISTRY_1_WITH_LAB = anyOf(
  allOf(course('CHEM M2A'), course('CHEM M2LA')),
  allOf(course('CHEM 1A'), course('CHEM 1B'), course('CHEM 1LC')),
);
/** General chemistry lecture only. */
export const CHEMISTRY_1 = anyOf(course('CHEM 1A'), course('CHEM M2A'));
/** A second general chemistry course. */
export const CHEMISTRY_2 = anyOf(course('CHEM 1B'), course('CHEM M2B'));
/** Introductory biology. */
export const BIOLOGY_1 = anyOf(course('BIO SCI 93'), course('BIO SCI H93'));
export const BIOLOGY_SEQUENCE = allOf(
  anyOf(course('BIO SCI 93'), course('BIO SCI H93')),
  anyOf(course('BIO SCI 94'), course('BIO SCI H94')),
);

// ---- writing and general education ---------------------------------------

/**
 * UCI's lower-division writing requirement (GE Ia) is a two-course sequence:
 * WRITING 50 + WRITING 60, the Humanities Core writing sequence, or
 * WRITING 45 paired with one of them.
 */
export const ENGLISH_COMPOSITION_2 = anyOf(
  allOf(course('WRITING 50'), course('WRITING 60')),
  allOf(course('HUMAN 1AS'), course('HUMAN 1BS'), course('HUMAN 1CS')),
  allOf(course('WRITING 45'), course('WRITING 60')),
);
/** A single English composition course. */
export const ENGLISH_COMPOSITION_1 = anyOf(
  course('WRITING 50'),
  course('WRITING 60'),
  course('WRITING 45'),
  course('HUMAN 1AS'),
);

// ---- open-ended science requirements -------------------------------------

/** One natural science course. */
export const NATURAL_SCIENCE_ELECTIVE: TransferSatisfaction = {
  kind: 'course_range',
  n: 1,
  filter: {
    departments: ['PHYSICS', 'CHEM', 'BIO SCI', 'EARTHSS'],
    description: 'One natural science course (physics, chemistry, biology, or earth system science)',
  },
};


/** `n` lab-science courses drawn from the usual departments. */
export function labSciences(n: number): TransferSatisfaction {
  return {
    kind: 'course_range',
    n,
    filter: {
      departments: ['PHYSICS', 'CHEM', 'BIO SCI', 'EARTHSS'],
      description: `${n} laboratory science course${n === 1 ? '' : 's'} (physics, chemistry, biology, or earth system science)`,
    },
  };
}


/** `n` technical courses — UT Austin's "four technical courses" rule. */
export function technicalCourses(n: number): TransferSatisfaction {
  return {
    kind: 'course_range',
    n,
    filter: {
      departments: [
        'MATH', 'PHYSICS', 'CHEM', 'BIO SCI', 'EARTHSS', 'STATS',
        'I&C SCI', 'COMPSCI', 'EECS', 'ENGR', 'ENGRMAE', 'ENGRCEE', 'ENGRMSE', 'IN4MATX', 'SWE',
      ],
      description: `${n} technical courses (mathematics, science, computer science, or engineering)`,
    },
  };
}
