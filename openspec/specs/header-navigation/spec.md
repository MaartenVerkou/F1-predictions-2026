# header-navigation Specification

## Purpose
Defines the shared header navigation and utility controls for desktop and collapsed phone layouts.

## Requirements
### Requirement: Header navigation presents consistent primary actions
The system SHALL present header navigation and utility actions with predictable ordering, recognizable icons, and consistent interaction states across desktop and collapsed phone layouts.

Feature: Header navigation

Rule: Authenticated users MUST get predictable navigation and utility controls across desktop and collapsed phone layouts.

#### Scenario: Admin collapsed menu prioritizes admin workflow
- **GIVEN** an authenticated admin user on a phone-sized viewport
- **WHEN** the user opens the header menu
- **THEN** the visible menu items MUST be ordered Admin, Dashboard, Account, Language, and Theme
- **AND** the Admin item MUST be first only for admin users

#### Scenario: Authenticated desktop header uses account action
- **GIVEN** an authenticated user on a desktop viewport
- **WHEN** the header is rendered
- **THEN** the header MUST show Account as an icon action instead of "signed in as" status copy
- **AND** Dashboard MUST be shown with its icon and label when space allows

#### Scenario: Header utility states are visually consistent
- **GIVEN** a user can see header navigation, language, and theme controls
- **WHEN** a control is hovered, focused, or selected
- **THEN** the controls MUST use a consistent shape, spacing, and state treatment
- **AND** selected states in dark mode MUST remain subtle rather than using a harsh red filled treatment
