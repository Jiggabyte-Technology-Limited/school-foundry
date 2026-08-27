# Marketing, Distribution & Licensing Strategy

FeesFoundry is designed for the African B2B education sector. The go-to-market (GTM) strategy bypasses traditional SaaS marketing (like Google Ads or Twitter) in favor of high-trust, relationship-based channels where decision-makers (Headmasters, Bursars, and SDCs/SGAs) actively congregate.

## 1. Direct Acquisition Channels

### Headmaster & Bursar WhatsApp Groups
WhatsApp is the enterprise communication channel in Africa. 
- **Strategy:** Identify and infiltrate regional Headmaster Association WhatsApp groups. 
- **Execution:** Do not spam. Provide high-value, free resources first (e.g., "Free Excel template for termly fee reconciliation"). Once trust is established, introduce FeesFoundry as the automated, offline alternative to the spreadsheet.
- **Demo Distribution:** Share short, low-bandwidth video demos (under 5MB) showcasing the "Print Statement" and "Students Owing" features.

### Government & Education Agencies
- **Strategy:** Leverage Ministry of Education structures and regional District School Inspectors (DSIs).
- **Execution:** 
  - Obtain lists of registered schools per district.
  - Position FeesFoundry as a compliance and audit tool. Public schools struggle with audit trails; FeesFoundry’s immutable `activity_log` solves this.
  - Offer the software at a heavy discount (or free) to a DSI's flagship school to create a top-down recommendation.

### "Adopt-a-School" Donor Model
- **Strategy:** Target NGOs, corporate CSR (Corporate Social Responsibility) programs, and diaspora alumni associations.
- **Execution:** Instead of selling directly to underfunded schools, sell "Digital Transformation Packages" to corporate donors. A donor pays a flat fee to provide FeesFoundry, a low-cost laptop, and a thermal printer to a rural or peri-urban school. The donor receives a branded "Sponsor" plaque within the software.

## 2. Word of Mouth & Viral Loops

Schools are highly networked. When a Bursar at one school eliminates their weekend workload, they tell their peers at the next district meeting.
- **Referral Licensing:** Introduce a system where if a school refers another institution, both schools receive an extension on their license or free premium support.
- **Watermarked Outputs:** Ensure that all printed receipts and statements generated during trial periods carry a subtle "Powered by FeesFoundry" watermark. When parents show these professional receipts to parents at other schools, it drives inbound interest.

## 3. Training & Onboarding

Offline software requires offline enablement. If the school cannot figure out how to use the software without internet, the product has failed.
- **Embedded Documentation:** The entire User Guide is shipped inside the application. No web links.
- **Role-Based Handouts:** Provide printable, 1-page PDF "Cheat Sheets" with the installer:
  - *The Bursar's Guide to End-of-Day Reconciliation*
  - *The Admin's Guide to Setting Up Next Term*
- **WhatsApp Support Bot:** Utilize a Botpress-powered WhatsApp bot for automated support. Users can text "How do I void a receipt?" and receive step-by-step instructions via WhatsApp text (which requires negligible data).

## 4. Anti-Piracy & Licensing Framework

Selling offline desktop software natively introduces piracy risks (e.g., copying the `.exe` via flash drive). A pragmatic, non-draconian licensing approach is required.

### The "Hardware-Bound Offline License" Model
1. **Machine Fingerprinting:** Upon installation, the application generates a unique "Machine ID" based on the computer's motherboard UUID and CPU serial number.
2. **License Activation (Low-Bandwidth):** 
   - The user texts their Machine ID and payment proof to the FeesFoundry WhatsApp Business number.
   - The admin sends back an encrypted alphanumeric "License Key".
   - The user enters this key into the app to unlock it.
3. **Termly / Annual Validation:**
   - Even though it's a "One-Off Payment" or Annual License, the app requires a new key at the start of each Academic Year to prevent a single license from running indefinitely on copied machines.
   - *Grace Period:* If a license expires, the app degrades gracefully into "Read-Only Mode." Bursars can still view and print past receipts, but cannot add new payments until the new key is entered. **Never hold school data hostage.**

### Why this works:
- It requires zero internet connection from the application itself.
- It prevents casual USB-drive sharing among different schools.
- It forces an annual touchpoint with the customer, enabling upselling (e.g., selling thermal printer rolls or SMS bundles).