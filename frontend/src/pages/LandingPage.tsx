import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useScrollReveal } from '../hooks/useScrollReveal';
import './LandingPage.css';

const TRUST_ITEMS = [
  { icon: '📘', label: 'Built on Published Policy' },
  { icon: '🏥', label: '40+ UK Medical Schools' },
  { icon: '🎓', label: 'Every Qualification Route' },
  { icon: '🔎', label: 'Free to Use' },
];

const FEATURE_CARDS = [
  {
    title: 'Eligibility Check',
    text: 'We check your academic profile, admissions test scores and personal circumstances against each university’s published entry requirements — A-levels, Highers, IB, BTEC, Access to HE, graduate entry and international routes.',
    points: [
      'Every qualification route supported',
      'Contextual and widening-access criteria included',
      'Checked against current published policy',
    ],
  },
  {
    title: 'Interview Band Prediction',
    text: 'Where a university publishes a scoring or banding methodology, we run your profile through it to estimate your realistic interview likelihood — not a guess, a calculation.',
    points: [
      'Evidence-based scoring, not rules of thumb',
      'Reflects each school’s actual selection model',
      'Clear about where evidence is limited',
    ],
  },
  {
    title: 'Decision Transparency',
    text: 'Every result comes with the reasoning behind it — which checks you passed, which you didn’t, and exactly which published requirement each check is traced to.',
    points: [
      'See the reasoning, not just the verdict',
      'Traced to official admissions documentation',
      'Flags gaps instead of guessing past them',
    ],
  },
];

const PROGRAMMES = [
  {
    title: 'UCAT Preparation',
    text: 'Structured coaching across all four subtests, from a full 9–10 week programme to an intensive sprint — led by students who sat the UCAT in the last two cycles.',
    href: 'https://www.medibrainuk.co.uk/ucat.html',
    cta: 'Explore UCAT Programme',
  },
  {
    title: 'Medical Interview Prep',
    text: 'MMI and panel interview coaching with people who sat medical school interviews in 2025 and 2026 — stations, ethics, hot topics and communication under real time pressure.',
    href: 'https://www.medibrainuk.co.uk/medical-interview-preparation.html',
    cta: 'Explore Interview Prep',
  },
  {
    title: 'Personal Statement',
    text: 'Coached through the new 3-question UCAS format, with a dedicated mentor, structured feedback and multiple draft rounds before your deadline.',
    href: 'https://www.medibrainuk.co.uk/ucas-personal-statement.html',
    cta: 'Explore PS Support',
  },
  {
    title: 'Confidence Coaching',
    text: 'Knowing the right answer isn’t enough if nerves take over on the day. Confidence coaching works on composure, delivery and thinking clearly under pressure.',
    href: 'https://www.medibrainuk.co.uk/medical-interview-preparation.html',
    cta: 'Explore Confidence Coaching',
  },
  {
    title: 'A-Level Support',
    text: 'Achieve the top grades medical schools demand. Specialist coaching in Biology, Chemistry, Mathematics and Psychology at A-Level, GCSE and Scottish Highers.',
    href: 'https://www.medibrainuk.co.uk/alevel.html',
    cta: 'Explore A-Level Support',
  },
  {
    title: 'University Consultation',
    text: 'Not sure which medical schools fit your profile? A 1:1 consultation to help you shortlist realistically and build a balanced UCAS application.',
    href: 'https://www.medibrainuk.co.uk/university-consultation.html',
    cta: 'Explore Consultation',
  },
];

const PROCESS_STEPS = [
  {
    number: '1',
    title: 'Enter Your Profile',
    text: 'Add your grades, admissions test scores and qualification route — whichever pathway applies to you.',
  },
  {
    number: '2',
    title: 'Select Universities',
    text: 'Choose from 40+ UK medical schools, or let us assess your full shortlist at once.',
  },
  {
    number: '3',
    title: 'Get Evidence-Based Results',
    text: 'Receive a result card per university: eligibility, interview likelihood and the reasoning behind it.',
  },
  {
    number: '4',
    title: 'Understand Your Gaps',
    text: 'See exactly what’s holding an application back, so you can strengthen it before you apply.',
  },
];

const DIFFERENTIATORS = [
  {
    role: 'Not a Guess',
    title: 'Every Result Traced to Official Policy',
    text: 'We don’t estimate your chances from vibes or averages. Every check is mapped to a university’s own published entry requirements and admissions methodology.',
  },
  {
    role: 'Every Route Covered',
    title: 'Built for How Applicants Actually Qualify',
    text: 'A-levels, Scottish Highers, IB, BTEC, Access to HE, graduate entry and international qualifications are all supported — not just the standard A-level path.',
    featured: true,
  },
  {
    role: 'Honest by Design',
    title: 'We Tell You When We’re Not Sure',
    text: 'When evidence is limited, or a human adviser should really check something, ApplySmart says so plainly — instead of returning a confident-sounding guess.',
  },
];

export function LandingPage() {
  const scope = useRef<HTMLDivElement>(null);
  useScrollReveal(scope);

  return (
    <div className="landing-page" ref={scope}>
      <section className="ls-hero">
        <div className="ls-hero-glow ls-hero-glow--gold" aria-hidden="true" />
        <div className="ls-hero-glow ls-hero-glow--green" aria-hidden="true" />
        <div className="ls-hero-dots" aria-hidden="true" />
        <div className="ls-hero-inner">
          <div className="ls-hero-content fade-up">
            <span className="ls-label">Evidence-Based Medical Admissions Guidance</span>
            <h1 className="ls-hero-title">
              Know Your Realistic Chances
              <br />
              <em>Before You Apply</em>
            </h1>
            <p className="ls-hero-sub">
              ApplySmart turns your academic profile, admissions test scores and personal
              circumstances into clear, evidence-based guidance for each UK medical school on
              your list &mdash; so you can build a smarter, more balanced application.
            </p>
            <div className="ls-hero-actions">
              <Link to="/assessment" className="btn-gold">
                Start Your Assessment
              </Link>
              <Link to="/assessment/universities" className="btn-gold-outline">
                University Explorer
              </Link>
            </div>
            <div className="ls-hero-stats">
              <span className="ls-stat-pill">Evidence-Based</span>
              <span className="ls-stat-pill">40+ Medical Schools</span>
              <span className="ls-stat-pill">Every Qualification Route</span>
            </div>
          </div>

          <div className="ls-hero-card fade-up" style={{ '--delay': '150ms' } as React.CSSProperties}>
            <div className="ls-hero-card-label">What We Check</div>
            {[
              ['🧬', 'Academic Grades', 'A-levels, Highers, IB, BTEC and more'],
              ['🧠', 'Admissions Test Scores', 'UCAT and university-specific thresholds'],
              ['📄', 'Personal Circumstances', 'Contextual and widening-access criteria'],
              ['🗂️', 'Interview Likelihood', 'Based on each school’s published methodology'],
            ].map(([icon, title, text]) => (
              <div className="ls-hero-card-item" key={title}>
                <div className="ls-hero-card-icon">{icon}</div>
                <div className="ls-hero-card-text">
                  <strong>{title}</strong>
                  <span>{text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="ls-trust-bar">
        <div className="ls-trust-bar-inner fade-up">
          {TRUST_ITEMS.map(({ icon, label }, index) => (
            <span className="ls-trust-item-wrap" key={label}>
              {index > 0 && <span className="ls-trust-divider" aria-hidden="true" />}
              <span className="ls-trust-item">
                <span aria-hidden="true">{icon}</span> {label}
              </span>
            </span>
          ))}
        </div>
      </div>

      <section className="ls-section ls-bg-white">
        <div className="ls-section-inner">
          <div className="ls-section-head fade-up">
            <span className="ls-eyebrow">What ApplySmart Does</span>
            <span className="ls-gold-rule" aria-hidden="true" />
            <h2>
              Everything You Need to Assess
              <br />
              Your Medical School Chances
            </h2>
            <p className="ls-lead">
              Each check is built around what medical schools actually publish — not
              assumptions, not averages.
            </p>
          </div>
          <div className="ls-card-grid">
            {FEATURE_CARDS.map((card, index) => (
              <div
                className="ls-feature-card fade-up"
                style={{ '--delay': `${index * 100}ms` } as React.CSSProperties}
                key={card.title}
              >
                <h3>{card.title}</h3>
                <p>{card.text}</p>
                <ul>
                  {card.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ls-section ls-bg-ivory">
        <div className="ls-section-inner">
          <div className="ls-section-head fade-up">
            <span className="ls-eyebrow">Coaching From MediBrain UK</span>
            <span className="ls-gold-rule" aria-hidden="true" />
            <h2>
              Want Hands-On Help Closing
              <br />
              the Gaps ApplySmart Finds?
            </h2>
            <p className="ls-lead">
              ApplySmart is free and evidence-based. When you&rsquo;re ready for 1:1 or small-group
              coaching, MediBrain UK&rsquo;s programmes are built and taught by people who&rsquo;ve
              been through the same process recently.
            </p>
          </div>
          <div className="ls-card-grid">
            {PROGRAMMES.map((programme, index) => (
              <div
                className="ls-programme-card fade-up"
                style={{ '--delay': `${(index % 3) * 100}ms` } as React.CSSProperties}
                key={programme.title}
              >
                <h3>{programme.title}</h3>
                <p>{programme.text}</p>
                <a
                  href={programme.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ls-programme-link"
                >
                  {programme.cta}
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ls-section ls-bg-white">
        <div className="ls-section-inner">
          <div className="ls-section-head fade-up">
            <span className="ls-eyebrow">Our Process</span>
            <span className="ls-gold-rule" aria-hidden="true" />
            <h2>From Profile to Prediction in Minutes</h2>
          </div>
          <div className="ls-process-grid">
            {PROCESS_STEPS.map((step, index) => (
              <div
                className="ls-process-step fade-up"
                style={{ '--delay': `${index * 100}ms` } as React.CSSProperties}
                key={step.number}
              >
                <div className="ls-step-number">{step.number}</div>
                <h4>{step.title}</h4>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ls-section ls-bg-ivory">
        <div className="ls-section-inner">
          <div className="ls-section-head fade-up">
            <span className="ls-eyebrow">The ApplySmart Difference</span>
            <span className="ls-gold-rule" aria-hidden="true" />
            <h2>
              Other Tools Give You a Guess.
              <br />
              We Give You Evidence.
            </h2>
          </div>
          <div className="ls-card-grid ls-card-grid-3">
            {DIFFERENTIATORS.map((item, index) => (
              <div
                className={`ls-usp-card fade-up${item.featured ? ' ls-usp-card--featured' : ''}`}
                style={{ '--delay': `${index * 100}ms` } as React.CSSProperties}
                key={item.title}
              >
                <div className="ls-usp-role">{item.role}</div>
                <h4>{item.title}</h4>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ls-cta-banner">
        <div className="ls-cta-glow" aria-hidden="true" />
        <div className="ls-section-inner ls-cta-inner fade-up">
          <span className="ls-eyebrow ls-eyebrow-light">Ready to Begin?</span>
          <span className="ls-gold-rule" aria-hidden="true" />
          <h2 className="ls-cta-title">Start Your Free Assessment Today</h2>
          <p className="ls-cta-sub">
            Get evidence-based guidance for every UK medical school on your list &mdash; free,
            in minutes.
          </p>
          <div className="ls-hero-actions ls-cta-actions">
            <Link to="/assessment" className="btn-gold">
              Start Your Assessment
            </Link>
            <Link to="/assessment/universities" className="btn-gold-outline">
              University Explorer
            </Link>
          </div>
        </div>
      </section>

      <p className="ls-disclaimer">
        ApplySmart provides guidance based on historical and published admissions information.
        It does not guarantee an interview or offer from any university &mdash; always confirm
        current requirements on the university&rsquo;s own website.
      </p>
    </div>
  );
}
