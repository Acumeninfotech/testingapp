import { useId } from 'react';
import type { PredictionResult } from '../api/types';

type AlternativeAcademicOfferContract = NonNullable<
  PredictionResult['result_card']['alternative_academic_offer']
>;

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function isRenderableOffer(
  offer: PredictionResult['result_card']['alternative_academic_offer'],
): offer is AlternativeAcademicOfferContract {
  return (
    (offer?.type === 'epq' || offer?.type === 'contextual' || offer?.type === 'contextual_epq') &&
    typeof offer.standard_offer === 'string' &&
    cleanText(offer.standard_offer).length > 0 &&
    typeof offer.alternative_offer === 'string' &&
    cleanText(offer.alternative_offer).length > 0
  );
}

export function AlternativeAcademicOffer({
  offer,
}: {
  offer?: PredictionResult['result_card']['alternative_academic_offer'];
}) {
  const headingId = useId();

  if (!isRenderableOffer(offer)) {
    return null;
  }

  const conditions = Array.isArray(offer.conditions)
    ? offer.conditions.map(cleanText).filter(Boolean)
    : [];
  const offerTypeLabel = offer.type === 'contextual'
    ? 'Contextual'
    : offer.type === 'contextual_epq'
      ? 'Contextual + EPQ'
      : 'EPQ';
  const alternativeLabel = offer.type === 'contextual'
    ? 'Contextual Offer'
    : offer.type === 'contextual_epq'
      ? 'Contextual EPQ Alternative'
      : 'EPQ Alternative';

  return (
    <section className="alternative-academic-offer" aria-labelledby={headingId}>
      <header className="alternative-academic-offer__header">
        <h4 id={headingId}>Alternative Academic Offer</h4>
        <span>{offerTypeLabel}</span>
      </header>

      <div className="alternative-academic-offer__options">
        <div>
          <span>Standard</span>
          <strong>{cleanText(offer.standard_offer)}</strong>
        </div>

        <div>
          <span>{alternativeLabel}</span>
          <strong>{cleanText(offer.alternative_offer)}</strong>
        </div>
      </div>

      {conditions.length > 0 && (
        <ul className="alternative-academic-offer__conditions" aria-label="Alternative offer conditions">
          {conditions.map((condition, index) => (
            <li key={`${condition}-${index}`}>{condition}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
