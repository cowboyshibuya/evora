# Reporting security issues

Avoid filing publicly visible reports containing credentials, real company data, invitation links or exploitable private details. Contact the maintainer privately through the repository owner's available contact channel. A dedicated security reporting address can be added when the public repository is established.

Include the affected version, reproduction steps using test accounts, expected access boundaries and observed impact.

The primary boundaries are authenticated user sessions, company memberships and roles, company-scoped records and R2 object access. Production must configure an HTTPS origin, a strong authentication secret, database migrations and Google/GitHub OAuth credentials before accepting real users.
