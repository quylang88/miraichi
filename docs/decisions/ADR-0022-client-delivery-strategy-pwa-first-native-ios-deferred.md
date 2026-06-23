# ADR-0022: Client Delivery Strategy (PWA-First, Native iOS Deferred)

* **Status**: Accepted
* **Date**: 2026-06-23
* **Accepted Date**: 2026-06-23
* **Owner Approval**: Approved by project owner
* **Implementation Status**: PWA shell alignment only

---

## 1. Context
To deliver a high-quality client dashboard on short cycles, the project needs a clear client delivery strategy. We must decide whether to develop a native client (iOS), a web-based client, or a wrapped hybrid client, considering developer overhead, distribution complexity, and immediate MVP requirements.

## 2. Options Considered
* **Option A**: Native iOS now
* **Option B**: PWA-first web app now, native iOS deferred
* **Option C**: Hybrid wrapper now (e.g. Capacitor/Cordova)

## 3. Decision
Choose **Option B** (PWA-first web app now, native iOS deferred).

## 4. Rationale
* **Faster MVP iteration**: Allows quick deployment and updates directly to the web without waiting for App Store approval loops.
* **Works with existing apps/web scaffold**: Maximizes reuse of the existing single-page application scaffold.
* **Keeps one client codebase**: Minimizes context switching and synchronization overhead between multiple client platforms.
* **Native iOS can be revisited later**: The architectural decoupling allows adding a native client later if required.
* **Avoids premature App Store/native decisions**: Prevents committing to native provisioning, build pipelines, and store guidelines before core features are validated.

## 5. Consequences
* `apps/web` becomes the primary client target for feature delivery.
* PWA metadata, service worker caching, and app shell resources can be added directly to the web app to provide a mobile-app-like experience.
* iOS native client development remains deferred.

## 6. Explicit Exclusions
* No native iOS app structure.
* No Swift/SwiftUI code.
* No React Native/Expo/Capacitor/Cordova dependencies or mobile native wrappers.
* No App Store deployment workflows.
* No push notifications yet.
* No offline data persistence beyond caching the static app shell.
