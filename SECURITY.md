# Interview Arena — Security & Compliance Architecture

## 1. Authentication & Role-Based Access Control (RBAC)

- **One Account, Multiple Roles**: Users have a single login identity with an array of assigned roles (`CANDIDATE`, `INTERVIEWER`, `ADMIN`).
- **Server-Side Authorization**: Hiding buttons in the frontend is not considered security. All endpoints in `/api/admin/*` and `/api/interviewer/*` enforce server-side role validation.
- **Interviewer Gating**: Only interviewers with `status === 'APPROVED'` (verified by completing two screening interviews and obtaining administrator sign-off) are permitted to claim paid interview sessions.

---

## 2. Payment & Webhook Security

- **Server-Side Price Validation**: Prices are strictly looked up from the backend tier configuration table (`store.tiers.get(tierCode).price`). Prices submitted in client POST bodies are completely ignored.
- **HMAC Signature Verification**: Razorpay payment signatures are validated on the server using `crypto.createHmac('sha256', secret)`.
- **Idempotent Webhook Processing**: Webhook delivery deduplicates events using order and transaction IDs to prevent duplicate fulfillment or double crediting.
- **Zero Card Data Storage**: The application never touches or persists raw credit/debit card numbers or CVVs. All transactions are tokenized via PCI-DSS compliant providers.

---

## 3. Data Protection & Meeting Privacy

- **Safe Queue Cards**: Public queue requests visible to waiting interviewers only disclose safe parameters (Tier, Track, Round, Target Role, Language, and Expected Earnings). Candidate email addresses and personal contact details are withheld.
- **Meeting Access Control**: Meeting URLs and live workspaces are restricted to the assigned candidate, assigned interviewer, and authenticated system administrators.
- **No Video Recording by Default**: The platform does not record video or audio streams by default, preserving candidate confidentiality and code of conduct standards.

---

## 4. Audit Logging

Every consequential administrative action is immutably logged with:
- Admin User ID & Email
- Action Name (e.g. `USER_SUSPENDED`, `TIER_UPDATED`, `REFUND_APPROVED`)
- Target Entity Type and ID
- Detailed reason / notes
- Originating IP address and timestamp
