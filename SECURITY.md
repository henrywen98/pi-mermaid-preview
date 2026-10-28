# Security

## Supported version

Security fixes target the latest tagged release.
This project has not received a formal security audit.

## Report a vulnerability

Use GitHub private vulnerability reporting:

https://github.com/henrywen98/pi-mermaid-preview/security/advisories/new

Do not include credentials or private conversation content.
Use a small synthetic diagram to demonstrate the issue.

## Trust boundary

Pi extensions run with the same permissions as Pi.
The renderer process is not a security sandbox.

The extension limits message size, source size, process duration, and output.
It strips terminal control characters and does not pass the parent environment to the renderer.
These controls reduce specific risks. They do not make hostile dependencies safe.

The package pins its direct renderer version and includes a lockfile.
Git installations can resolve transitive dependencies differently, depending on the host package manager.
Recheck the installed dependency tree after updates.

The extension does not intentionally read credential files, start a shell, or make network requests.
It reads the last assistant reply from the current session branch.
It passes the selected diagram to the local renderer through standard input.
It does not append the preview to model context or the session transcript.

The original assistant reply remains subject to Pi's normal storage and provider behavior.
