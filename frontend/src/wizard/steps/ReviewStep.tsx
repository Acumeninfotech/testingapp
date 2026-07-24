import { requiresEnglishLanguageEvidence } from '../validation';
import type { StepProps } from './StepProps';

function SubjectGradeSummary({ subjects }: { subjects: { subject_id: string; grade: string }[] }) {
  return (
    <dl>
      {subjects
        .filter((s) => s.subject_id)
        .map((subject) => (
          <div key={subject.subject_id}>
            <dt>{subject.subject_id.replace(/_/g, ' ')}</dt>
            <dd>{subject.grade || '—'}</dd>
          </div>
        ))}
    </dl>
  );
}

export function ReviewStep({ profile }: StepProps) {
  const {
    applicant_identity,
    course_target,
    gcse_profile,
    a_level_profile,
    scottish_profile,
    ib_profile,
    btec_profile,
    access_to_he_profile,
    graduate_profile,
    international_qualification,
    english_language_profile,
    admissions_tests,
    university_ids,
  } = profile;
  const route = course_target.qualification_route;

  return (
    <div className="step-grid review-step">
      <p>Review your profile before submitting for a prediction.</p>

      <section>
        <h2>Identity</h2>
        <dl>
          <dt>Applicant type</dt>
          <dd>{applicant_identity.applicant_type || '—'}</dd>
          <dt>Fee status</dt>
          <dd>{applicant_identity.fee_status || '—'}</dd>
          <dt>Domicile</dt>
          <dd>{applicant_identity.domicile || '—'}</dd>
          <dt>Date of birth</dt>
          <dd>{applicant_identity.date_of_birth || '—'}</dd>
        </dl>
      </section>

      <section>
        <h2>Course target</h2>
        <dl>
          <dt>Qualification route</dt>
          <dd>{route.replace(/_/g, ' ')}</dd>
          <dt>Application year</dt>
          <dd>{course_target.application_year || '—'}</dd>
        </dl>
      </section>

      <section>
        <h2>GCSE grades</h2>
        <dl>
          {Object.entries(gcse_profile.subjects).map(([subject, grade]) => (
            <div key={subject}>
              <dt>{subject.replace(/_/g, ' ')}</dt>
              <dd>{grade || '—'}</dd>
            </div>
          ))}
        </dl>
      </section>

      {route === 'a_level' && (
        <section>
          <h2>A-levels</h2>
          <dl>
            {a_level_profile.subjects
              .filter((s) => s.subject_id)
              .map((subject) => (
                <div key={subject.subject_id}>
                  <dt>{subject.subject_id.replace(/_/g, ' ')}</dt>
                  <dd>
                    Predicted: {subject.predicted_grade || '—'}, Achieved: {subject.achieved_grade || '—'}
                  </dd>
                </div>
              ))}
          </dl>
        </section>
      )}

      {route === 'scottish' && (
        <section>
          <h2>Scottish qualifications</h2>
          <h3>Highers</h3>
          <SubjectGradeSummary subjects={scottish_profile.higher_subjects} />
          <h3>Advanced Highers</h3>
          <SubjectGradeSummary subjects={scottish_profile.advanced_higher_subjects} />
        </section>
      )}

      {route === 'international_baccalaureate' && (
        <section>
          <h2>IB profile</h2>
          <dl>
            <dt>Total points</dt>
            <dd>{ib_profile.total_points || '—'}</dd>
          </dl>
          <h3>Higher Level subjects</h3>
          <SubjectGradeSummary subjects={ib_profile.higher_level_subjects} />
        </section>
      )}

      {route === 'btec' && (
        <section>
          <h2>BTEC profile</h2>
          <dl>
            <dt>Qualification</dt>
            <dd>{btec_profile.qualification || '—'}</dd>
            <dt>Grade</dt>
            <dd>{btec_profile.grade || '—'}</dd>
          </dl>
        </section>
      )}

      {route === 'access_to_he' && (
        <section>
          <h2>Access to HE profile</h2>
          <dl>
            <dt>Provider approved by institution</dt>
            <dd>{access_to_he_profile.provider_approved_by_institution ? 'Yes' : 'No'}</dd>
            <dt>Requirements met</dt>
            <dd>{access_to_he_profile.requirements_met ? 'Yes' : 'No'}</dd>
          </dl>
        </section>
      )}

      {route === 'graduate' && (
        <section>
          <h2>Graduate profile</h2>
          <dl>
            <dt>Degree classification</dt>
            <dd>{graduate_profile.degree_classification || '—'}</dd>
            <dt>Degree status</dt>
            <dd>{graduate_profile.degree_status || '—'}</dd>
          </dl>
        </section>
      )}

      {route === 'international_qualification' && (
        <section>
          <h2>International qualification</h2>
          <dl>
            <dt>Qualification</dt>
            <dd>{international_qualification.name || '—'}</dd>
            <dt>Equivalence status</dt>
            <dd>{international_qualification.equivalence_status || '—'}</dd>
          </dl>
        </section>
      )}

      {requiresEnglishLanguageEvidence(profile) && (
        <section>
          <h2>English language evidence</h2>
          <dl>
            <dt>Test</dt>
            <dd>{english_language_profile.test ? english_language_profile.test.replace(/_/g, ' ') : '—'}</dd>
            <dt>Overall score</dt>
            <dd>{english_language_profile.overall || '—'}</dd>
          </dl>
        </section>
      )}

      <section>
        <h2>UCAT / SJT</h2>
        <dl>
          <dt>Total score</dt>
          <dd>{admissions_tests.ucat.total_score || '—'}</dd>
          <dt>SJT band</dt>
          <dd>{admissions_tests.ucat.sjt_band || '—'}</dd>
        </dl>
      </section>

      <section>
        <h2>Universities</h2>
        <p data-testid="review-university-count">{university_ids.length} selected</p>
      </section>
    </div>
  );
}
