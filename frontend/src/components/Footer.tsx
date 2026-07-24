import { Link } from 'react-router-dom';
import './Footer.css';

const SOCIAL_LINKS = [
  { label: 'Instagram', href: 'https://www.instagram.com/medibrainuk' },
  { label: 'Facebook', href: 'https://www.facebook.com/medibrainuk1' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/medibrain-uk' },
  { label: 'X', href: 'https://x.com/MediBrainUK' },
];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-grid">
          <div className="footer-col footer-col--brand">
            <div className="footer-brand">
              <div className="footer-brand-logo" aria-hidden="true">
                AS
              </div>
              <div className="footer-brand-text">
                <span className="footer-brand-name">
                  Apply<em>Smart</em>
                </span>
                <span className="footer-brand-tagline">Medical Admissions Guidance</span>
              </div>
            </div>
            <p className="footer-desc">
              ApplySmart is a MediBrain UK product &mdash; evidence-based medical school
              admissions guidance that turns your academic profile into a clear, honest picture
              of your chances.
            </p>
            <div className="footer-social">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-btn"
                  aria-label={`MediBrain UK on ${social.label}`}
                >
                  {social.label.slice(0, 2)}
                </a>
              ))}
            </div>
          </div>

          <div className="footer-col">
            <h6 className="footer-heading">ApplySmart</h6>
            <ul className="footer-links">
              <li>
                <Link to="/">Home</Link>
              </li>
              <li>
                <Link to="/assessment">Start Assessment</Link>
              </li>
              <li>
                <Link to="/assessment/universities">Browse Universities</Link>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h6 className="footer-heading">Company</h6>
            <ul className="footer-links">
              <li>
                <a href="https://www.medibrainuk.co.uk/about.html">About Us</a>
              </li>
              <li>
                <a href="https://www.medibrainuk.co.uk/pricing.html">Pricing</a>
              </li>
              <li>
                <a href="https://www.medibrainuk.co.uk/contact.html">Contact</a>
              </li>
              <li>
                <a href="https://www.medibrainuk.co.uk/privacy-policy.html">Privacy Policy</a>
              </li>
              <li>
                <a href="https://www.medibrainuk.co.uk/terms-and-conditions.html">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h6 className="footer-heading">Get in Touch</h6>
            <div className="footer-contact-item">
              <span className="footer-contact-icon" aria-hidden="true">
                ✉
              </span>
              <a href="mailto:info@medibrainuk.co.uk">info@medibrainuk.co.uk</a>
            </div>
            <div className="footer-contact-item">
              <span className="footer-contact-icon" aria-hidden="true">
                ☎
              </span>
              <a href="tel:+447346147072">+44 (0) 7346 147 072</a>
            </div>
            <div className="footer-contact-item">
              <span className="footer-contact-icon" aria-hidden="true">
                📍
              </span>
              <span>Bolton &amp; Online &mdash; Serving Students Across the UK</span>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <span>&copy; 2026 MediBrain UK Ltd. All rights reserved.</span>
        <span>Part of the MediBrain UK family of tools.</span>
      </div>
    </footer>
  );
}
