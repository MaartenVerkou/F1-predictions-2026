## ADDED Requirements

### Requirement: Full-document navigation remains visually stable
The system SHALL render full-document page navigations without avoidable typography or section-size shifts after initial content appears.

Feature: Stable page loading

Rule: Server-rendered route changes MUST produce stable shared shell and page content dimensions without masking instability through artificial delays or animations.

#### Scenario: Dashboard navigation under delayed fonts
- **GIVEN** a browser starts on the home page with font file delivery delayed
- **WHEN** the user navigates to the dashboard page
- **THEN** the dashboard heading and primary content sections MUST not change dimensions beyond the layout stability budget after first render
- **AND** cumulative layout shift MUST remain within the accepted budget for the navigation

#### Scenario: Header remains stable during route changes
- **GIVEN** a browser has loaded any public or authenticated page
- **WHEN** the user navigates to another server-rendered page
- **THEN** the fixed header height and main content offset MUST remain stable before and after shared JavaScript bootstrap

### Requirement: Critical static assets are versioned and cacheable
The system SHALL serve shared CSS, JavaScript, font, and header brand assets with versioned URLs and cache headers suitable for repeat navigation.

Feature: Stable page loading

Rule: Long-lived browser caching MUST only be used for assets whose URL changes when content changes.

#### Scenario: Shared assets use versioned URLs
- **GIVEN** the shared HTML head is rendered
- **WHEN** the browser requests shared CSS, JavaScript, fonts, or header brand images
- **THEN** each critical asset URL MUST include a content version or equivalent cache-busting identifier

#### Scenario: Repeat navigation reuses cached static assets
- **GIVEN** a browser has loaded one page of the app
- **WHEN** the user navigates to another page in the same session
- **THEN** the browser SHOULD be able to reuse unchanged shared CSS, JavaScript, font, and header brand assets without full revalidation

### Requirement: Typography loads deterministically
The system SHALL avoid depending on live third-party font delivery during page render for the app's core typography.

Feature: Stable page loading

Rule: The app MUST either self-host required webfont assets with stable metrics and preload/cache them, or use a deliberate system font stack that does not swap after render.

#### Scenario: Third-party font service unavailable
- **GIVEN** the browser cannot reach external font providers
- **WHEN** the user loads or navigates between app pages
- **THEN** visible text MUST render with the intended stable metrics path
- **AND** page sections MUST not resize due to a late third-party font swap

### Requirement: Header-critical images are right-sized
The system SHALL use appropriately sized image assets for the shared header brand mark.

Feature: Stable page loading

Rule: Header imagery MUST be optimized for its rendered size and theme variants.

#### Scenario: Header logo asset weight is bounded
- **GIVEN** the header logo renders at approximately 50px square
- **WHEN** the browser requests the light or dark header logo
- **THEN** the downloaded header logo asset MUST be sized for header display rather than social or marketing use
- **AND** the header MUST preserve its layout dimensions while the image loads
