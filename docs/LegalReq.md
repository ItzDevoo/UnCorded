# UnCorded — Legal Requirements Research

Compiled 2026-03-16. Research covers US federal, state, EU, and platform-specific obligations for a chat app with P2P file sharing, Stripe payments, and OAuth login.

---

## Priority Tiers

### Tier 1 — Must-Do Before Launch (Non-Negotiable)

These carry criminal liability or platform-killing risk if ignored.

**CSAM Reporting (18 U.S.C. Section 2258A)**

- UnCorded IS covered regardless of P2P architecture — "electronic communication service" is broadly defined
- Mandatory reporting to NCMEC CyberTipline upon "actual knowledge" of CSAM
- Willful blindness is the biggest legal risk — courts (Aimster) ruled that designing systems to avoid knowledge supports inference of willful blindness
- REPORT Act (May 2024): expanded to trafficking/enticement, 1-year evidence preservation, penalties up to $1M
- Section 230 provides ZERO protection for federal CSAM criminal liability
- **Action:** Implement client-side PDQ hashing + Safer by Thorn API (82M+ verified hashes, startup-friendly). Block transfer, preserve evidence, report to NCMEC on match.

**DMCA Agent Registration**

- Register at copyright.gov — costs $6, covers up to 10 domains
- Expires every 3 years — must renew
- Without this, you lose DMCA safe harbor protection entirely
- Must also implement notice-and-takedown process and repeat infringer policy in ToS
- **Action:** Register DMCA agent. Add DMCA process to ToS.

**Grokster Inducement Theory (MGM v. Grokster, 2005)**

- A platform that promotes P2P for infringement is liable even if the tech has legit uses
- NEVER market, advertise, or position file sharing in ways suggesting piracy
- **Action:** Marketing/copy review. Emphasize legitimate use cases only.

**Minimum Age Gate**

- COPPA: under-13 data collection requires verifiable parental consent
- Standard approach: require 13+ at signup with self-reported DOB
- COPPA 2025 update (compliance by April 2026): chat data from children now classified as sensitive personal info
- **Action:** Add DOB field at registration. Reject under-13. State in ToS.

### Tier 2 — Should-Do Before Launch (Legally Required but Lower Risk)

**Privacy Policy**

- Required by GDPR (any EU users), COPPA, state laws, and OAuth providers
- Must disclose: data collected, legal basis, third-party processors, retention periods, user rights, P2P IP exposure
- Third-party processors to list: Cloudflare (CDN/R2), Neon (database), Stripe (payments), Discord (OAuth), Google (OAuth), Redis provider
- P2P-specific: "Your IP address is shared directly with the receiving user during file transfers"
- OAuth data: Discord provides user ID, username, avatar, email. Google provides email, name, picture URL.
- Stripe: disclose as payment processor, no card data touches our servers
- **Action:** Write privacy policy covering all of the above.

**Terms of Service**

- Acceptable Use Policy: prohibit CSAM, non-consensual images, harassment, malware, copyright infringement, spam, doxxing
- DMCA: notice-and-takedown process, counter-notification, repeat infringer policy
- P2P disclaimers: files never touch server, users responsible for legality
- Subscription: auto-renewal disclosure, cancellation method, amount
- Termination: grounds, notice, data handling
- Arbitration: clickwrap agreement, 30-day opt-out, small claims carve-out
- **Action:** Write ToS with all sections.

**Subscription Disclosures**

- California (strictest US): must disclose auto-renewal, amount, how to cancel, get affirmative consent
- Must provide online cancellation matching signup medium
- Stripe Customer Portal already handles cancellation — just need disclosures in ToS
- **Action:** Add auto-renewal disclosure to checkout flow and ToS.

### Tier 3 — Should-Do Near-Term (Growing Risk, Monitor)

**TAKE IT DOWN Act (May 2025, compliance by May 2026)**

- Must remove non-consensual intimate images within 48 hours of notice
- Need a notice-and-removal workflow (extend existing report system)
- **Action:** Add "non-consensual intimate image" category to report system. Build 48-hour removal process.

**EU Digital Services Act (DSA)**

- Applies to ANY platform with EU users, but micro/small enterprises (<50 employees, <10M EUR) are exempt from most obligations
- Still required: illegal content reporting mechanism (report system exists), content moderation transparency in ToS, point of contact
- **Action:** Existing report system mostly covers this. Add content moderation section to ToS.

**EU 14-Day Withdrawal Right**

- EU consumers can cancel subscriptions within 14 days without justification
- Pro-rata refund for usage during cooling-off period
- Cancel button required in-platform by June 2026
- **Action:** Stripe Customer Portal may already cover this. Verify.

### Tier 4 — Probably Don't Apply Yet (Small Scale)

**CCPA/CPRA (California)**

- Triggers at: $26.6M revenue OR 100K California consumers/year OR 50%+ revenue from data sales
- Solo dev startup almost certainly below all thresholds
- Monitor as you grow

**US State Privacy Laws (20 states)**

- Most use Virginia-style thresholds: 100K consumers OR 25K + 50% data revenue
- Rhode Island has low threshold (35K consumers)
- Unlikely to apply at small scale

**GDPR Data Protection Officer**

- Only required if core activities involve large-scale monitoring or sensitive data processing
- A general chat app does NOT trigger this

**GDPR Data Portability**

- Users can request data export in machine-readable format
- Low priority for small scale, but account deletion (already built) covers the spirit

---

## Privacy Policy — Required Disclosures Checklist

- [ ] Identity and contact details of data controller
- [ ] Data collected: email, username, display name, avatar, IP, messages, session cookies
- [ ] Legal basis for processing (contractual necessity, legitimate interest)
- [ ] Third-party processors with links to their privacy policies
- [ ] P2P IP address exposure warning
- [ ] Data retention periods per category
- [ ] International data transfers (US processing, SCCs via processors)
- [ ] User rights (access, rectification, deletion)
- [ ] Cookie disclosure (session auth only)
- [ ] Age restriction (13+)
- [ ] OAuth data received (Discord: user ID, username, email, avatar; Google: email, name, picture)
- [ ] Stripe payment processing disclosure
- [ ] Security measures (encryption, password hashing)
- [ ] How to contact for privacy requests
- [ ] How policy changes are communicated

## Terms of Service — Required Sections Checklist

- [ ] Description of services and tiers
- [ ] User eligibility / age restriction (13+)
- [ ] Account registration and security
- [ ] Acceptable Use Policy (CSAM, harassment, malware, copyright, spam, doxxing, non-consensual images)
- [ ] User-generated content license (display, transmit, store messages)
- [ ] DMCA process (notice-and-takedown, counter-notification, repeat infringer policy)
- [ ] P2P file sharing disclaimers and liability limitations
- [ ] Subscription terms (auto-renewal, amount, cancellation, refund policy)
- [ ] Account termination (grounds, notice, data handling, appeal)
- [ ] Disclaimers and limitation of liability ("AS IS")
- [ ] Indemnification
- [ ] Dispute resolution / arbitration (clickwrap, 30-day opt-out, small claims carve-out)
- [ ] Modification of terms
- [ ] Contact information
- [ ] DMCA agent contact info

---

## P2P-Specific Legal Considerations

**IP Address Exposure**

- WebRTC requires exchanging public IP addresses between peers via ICE
- Both users' IPs are exposed to each other during file transfers
- STUN servers also see both IPs
- TURN relay (paid users) sees the data stream
- Privacy policy MUST disclose this clearly
- Consider in-app notice before first file transfer

**Grokster Inducement Risk**

- MGM v. Grokster (2005) — still controlling law
- Platform liable if it "distributes a device with the object of promoting its use to infringe copyright"
- NEVER market file sharing for piracy. Emphasize legitimate use.
- Napster was liable partly due to central indexing — UnCorded stores magnet URIs (file receipts), which could be seen similarly
- Strong 512(a) conduit defense since files never touch server

**DMCA Safe Harbor**

- 512(a) — conduit (P2P transfers)
- 512(c) — storage (chat messages)
- Requirements: registered DMCA agent, notice-and-takedown, repeat infringer policy, no actual knowledge

---

## CSAM Technical Implementation Plan

**Recommended Stack:**

1. Client-side PDQ hashing (open source, JS/WASM implementation exists) before `seedFile()`
2. Server-side hash check against Safer by Thorn API (82M+ verified hashes, designed for startups, free tier available)
3. On match: block transfer, flag user, preserve metadata for 1 year, auto-report to NCMEC CyberTipline

**Legal Notes:**

- Client-side hashing creates "actual knowledge" which triggers mandatory reporting — this is a GOOD thing (Good Samaritan protections cover voluntary scanning)
- NOT scanning is riskier than scanning (willful blindness argument)
- Must preserve evidence for 1 year per REPORT Act
- NCMEC CyberTipline reporting is done via their Electronic Service Provider portal

**Hash Database Access:**

- PDQ (Meta): open source, available on GitHub
- Safer by Thorn: API access for ESPs, includes PhotoDNA-equivalent hashes
- NCMEC hash lists: available to registered ESPs via their Industry Portal

---

## Geo-Restriction Option

If full compliance is too burdensome for a solo developer, you CAN geo-restrict:

- Block EU users to avoid GDPR/DSA obligations
- Block specific US states with aggressive minor protection laws
- Use Cloudflare's geo-IP to enforce restrictions

**However, these are still non-negotiable regardless of geo-restriction:**

- CSAM reporting (federal, applies to ALL US platforms)
- DMCA safe harbor (federal)
- COPPA (federal, 13+ age gate)
- Basic ToS and Privacy Policy
- Subscription auto-renewal disclosures (multiple state laws)

---

## Sources

Privacy:

- GDPR Compliance Guide 2026 (SecurePrivacy)
- CCPA Requirements 2026 (SecurePrivacy)
- COPPA 2025 Final Rule Amendments (Securiti)
- FTC COPPA Age Verification Policy Feb 2026 (Mayer Brown)
- Cloudflare GDPR/DPA documentation
- Neon GDPR/DPA documentation

Terms of Service:

- DMCA Safe Harbor Provisions (Congress.gov)
- DMCA Agent Registration FAQ (Copyright.gov)
- TAKE IT DOWN Act (Congress.gov, Skadden analysis)
- EU Digital Services Act (European Commission)
- Auto-Renewal Laws 2025 Roundup (Kelley Drye)
- California Auto-Renewal Amendments (Paul Hastings)

CSAM:

- 18 U.S.C. Section 2258A (federal reporting obligations)
- REPORT Act May 2024 (expanded obligations)
- Safer by Thorn documentation
- NCMEC CyberTipline ESP registration
- STOP CSAM Act status (Senate Judiciary)

P2P Legal:

- MGM v. Grokster (2005) — inducement theory
- EFF: What P2P Developers Need to Know About Copyright Law
- Section 230 reform analysis (Crowell & Moring)

---

## Current App State vs Requirements

| Requirement              | Status      | What Exists                        | What's Missing                                                        |
| ------------------------ | ----------- | ---------------------------------- | --------------------------------------------------------------------- |
| CSAM hashing             | PARTIAL     | PDQ hash scaffold + safety endpoint | Thorn API integration, auto-report to NCMEC, 1-year preservation     |
| DMCA agent               | NOT STARTED | —                                   | Registration at copyright.gov, agent contact on site                 |
| Age gate (13+)           | DONE        | DOB field at registration           | —                                                                    |
| Privacy Policy page      | DONE        | /privacy with 13 sections           | Fill in placeholder contact info                                     |
| Terms of Service page    | DONE        | /terms with 15 sections             | Fill in placeholder state/contact info                               |
| Acceptable Use Policy    | DONE        | AUP in ToS + intimate_image reports | —                                                                    |
| Subscription disclosures | DONE        | Auto-renewal language in ToS        | —                                                                    |
| P2P IP warning           | DONE        | P2PNoticeDialog + privacy policy    | —                                                                    |
| Content reporting        | DONE        | POST /api/reports + ReportDialog    | intimate_image category added                                        |
| Account deletion         | DONE        | Settings > Account > Delete         | —                                                                    |
| DMCA takedown process    | NOT STARTED | DMCA section in ToS                 | Notice intake UI, counter-notification, repeat infringer tracking     |

---

_This is research only — not legal advice. Consult a child safety / internet law attorney before finalizing compliance._
