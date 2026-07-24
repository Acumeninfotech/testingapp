import { Link } from 'react-router-dom';

export function AssessmentStartPage() {
  return (
    <section>
      <div className="page-header">
        <h1>Start your assessment</h1>
        <p>
          You&rsquo;ll answer a few short steps about your identity, qualifications, admissions
          test scores and personal circumstances, then choose which universities to check. It
          takes most applicants about 10&ndash;15 minutes, and you can come back and finish later
          &mdash; your answers are saved on this device as you go.
        </p>
      </div>
      <Link to="/assessment/wizard">
        <button type="button" className="btn btn-large">
          Start your profile
        </button>
      </Link>
    </section>
  );
}
