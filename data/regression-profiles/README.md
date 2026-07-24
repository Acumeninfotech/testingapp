# ApplySmart applicant regression profiles

These files are canonical end-user applicant input fixtures used for full
ApplySmart result-card regression testing.

- UCAT cognitive totals always use the post-2025 `/2700` scale.
- Science Practical Endorsement is explicit for Biology, Chemistry, and
  Physics, using `pass`, `fail`, or `null` where it is not applicable.
- Every GCSE subject and grade is explicit. GCSE attainment must never be
  described with vague summaries.
- The fixtures contain no university-specific outcomes, decisions, result
  cards, or expected recommendations.
- Each profile is reusable across all completed universities.

The Scottish applicant is the sole GCSE exception: its GCSE fields are
explicitly null or empty because its National 5, Higher, and Advanced Higher
qualifications are recorded in `scottish_qualifications`.
