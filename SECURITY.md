# Security Model & Licensing Architecture

School Foundry (Offline Edition) is designed for high-security, offline-first environments. Since the application runs completely locally, traditional cloud-based authentication methods (like OAuth or JWT-based SaaS auth) are not applicable. 

Instead, we employ a robust hardware-locked licensing model to ensure that the software can only be used on authorized machines, protecting intellectual property and preventing unauthorized distribution.

## 1. Hardware Fingerprinting (Machine ID)

The core of our security model is the `Machine ID`, a unique 12-character identifier derived from the physical hardware of the host machine.

### Extraction Process
The application securely queries the host operating system (currently optimized for Windows) to extract immutable hardware identifiers:
1. **Motherboard UUID**: Extracted via `wmic csproduct get UUID` or PowerShell's `Get-CimInstance Win32_ComputerSystemProduct`.
2. **CPU Processor ID**: Extracted via `wmic cpu get ProcessorId` or PowerShell's `Get-CimInstance Win32_Processor`.

### Hashing & Truncation
To ensure privacy and prevent reverse-engineering of the hardware specifics:
- The UUID and CPU ID are concatenated with a static, hardcoded salt (`STATIC_SALT`).
- The resulting string is hashed using **SHA-256**.
- The first 12 characters of the resulting hex digest are converted to uppercase to form the final `Machine ID` (e.g., `DEAA1860B03D`).

*Implementation details can be found in `src/lib/machine-id.ts`.*

## 2. Symmetric Offline Activation (License Key)

To activate the software, the user must provide a 16-character `Activation Key` that corresponds to their `Machine ID`.

### Key Generation
The `Activation Key` is generated using a symmetric **HMAC-SHA256** algorithm.
- **Secret**: A highly secure, shared secret (`LICENSE_SECRET`) known only to the application and the external Keygen Web App.
- **Payload**: The `Machine ID`.
- **Output**: The HMAC output is truncated to 16 characters, formatted into 4 groups of 4 (e.g., `ABCD-1234-EFGH-5678`), and provided to the user.

### Validation Flow
When the user enters the `Activation Key`:
1. The application generates the expected key internally using the current hardware's `Machine ID` and the embedded `LICENSE_SECRET`.
2. It compares the normalized entered key (stripping dashes and whitespace, converting to uppercase) against the expected key.
3. If they match, the key is written to a local `.lic` file in the user's application data directory (`userData`).

### Startup Verification
On every application boot, the `LicenseGate` component intercepts the rendering pipeline. It reads the local `.lic` file and performs the validation flow again. If the hardware has changed significantly (e.g., a motherboard swap) or the file is missing/tampered with, access is revoked, and the user is redirected to the activation screen.

*Implementation details can be found in `src/license/validator.ts`.*

## 3. Local Data Security

- **Database**: All application data is stored in a local SQLite3 database.
- **Financial Precision**: All monetary values are stored as `INTEGER` cents to prevent floating-point arithmetic errors and ensure absolute financial accuracy.
- **Activity Logging**: Critical actions (like voiding payments, adding students, and application errors) are logged to the `activity_log` table to maintain a secure audit trail for administrators.

## 4. Administrative Security

- **Void Key**: A separate, administrative `Void Key` can be configured in the Settings. This allows lower-privileged users to perform sensitive actions (like voiding a payment) only if an administrator provides the Void Key at the time of the action.
- **Role-Based Access**: The application distinguishes between `admin` and `user` roles, restricting access to settings, fee structures, and activity logs.
