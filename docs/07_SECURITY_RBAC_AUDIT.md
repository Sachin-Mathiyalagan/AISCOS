# AISCOS — Security, Role-Based Access Control (RBAC) & Audit Model

## 1. Role-Based Access Control Matrix

| Resource / Action | Super Admin | Clinic Admin | Doctor | Nurse | Receptionist | Pharmacist | Lab Tech | Billing Staff | Patient |
|---|---|---|---|---|---|---|---|---|---|
| **View Audit Logs** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Manage Users & Roles** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Manage Clinic Schedules**| ✅ | ✅ | Own | ❌ | View | ❌ | ❌ | ❌ | View |
| **Patient Registration** | ✅ | ✅ | View | ✅ | ✅ | ❌ | ❌ | ❌ | Own |
| **Smart Check-in & Queue** | ✅ | ✅ | Call/Complete | Triage | Check-in | ❌ | ❌ | ❌ | View Own |
| **Conduct Encounter / SOAP** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Digital Prescriptions** | ❌ | ❌ | Issue | ❌ | ❌ | Dispense | ❌ | ❌ | View Own |
| **Lab Orders & Results** | ❌ | ❌ | Order/View | Collect | ❌ | ❌ | Process/Verify | ❌ | View Own |
| **Pharmacy Inventory** | ❌ | ✅ | View | ❌ | ❌ | Manage/Dispense| ❌ | ❌ | ❌ |
| **Invoicing & Payments** | ✅ | ✅ | View | ❌ | Create | View | View | Full Mgmt | Pay/View Own |
| **CDS & Guidelines RAG** | ❌ | ❌ | Full Access| View | ❌ | View | ❌ | ❌ | ❌ |

---

## 2. Security & Data Protection Guarantees

1. **Authentication & Session Tokens**:
   - Industry-standard Argon2id / Bcrypt password hashing with high work factor.
   - JWT tokens signed with secure HMAC-SHA256 and configurable expiration (Access: 60 mins, Refresh: 7 days).
2. **Access Control Verification**:
   - Backend validation on every protected route using FastAPI Dependency Injection (`get_current_user`, `require_roles([...])`).
   - Tenant boundaries enforced on all DB queries.
3. **Structured Immutable Audit Logging**:
   - Every read/write to protected health information (PHI) generates an append-only `audit_logs` entry storing `user_id`, `action`, `resource_type`, `resource_id`, `ip_address`, `timestamp`, and state diff.
4. **Data Validation & Sanitization**:
   - Strict Pydantic v2 validation for all API inputs.
   - SQL injection immunity via SQLAlchemy parameterized queries.
   - XSS sanitization for all clinical notes and freeform text.
