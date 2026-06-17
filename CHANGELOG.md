# Changelog

All notable changes to this project are documented in this file.

## [v2.0.0] - 2026-06-17

### Breaking

- Changed magnet and screw size inputs from radius to diameter. Existing feature definitions that used the old radius parameters need to be updated.

### Added

- Added an optional `Magnet Lead-In` setting for magnet holes.
- Added a `Lead-In Size` setting for the magnet lead-in, capped internally for small holes.

## [v1.1.0] - 2026-05-30

### Added

- Added an advanced `Unit Size` parameter.

### Changed

- Improved magnet and screw hole creation so holes are skipped when the selected size does not fit the generated base.
- Reused the configurable unit size throughout base, body, and pattern geometry.
- Centralized magnet easy-remover sizing.

## [v1.0.10] - 2026-03-21

### Fixed

- Fixed stackable-lip and label-height behavior for filled and non-stackable bins.

## [v1.0.9] - 2025-06-03

### Fixed

- Allowed 2-unit-tall bins to be generated without labels.

## [v1.0.8] - 2025-05-23

### Changed

- Increased the magnet easy-remover size.

## [v1.0.7] - 2025-05-23

### Added

- Added screw holes.
- Added optional easy removers for magnet holes.

### Changed

- Simplified internal geometry queries and renamed internal variables.

## [v1.0.6] - 2025-05-19

### Fixed

- Fixed wall thickness handling when the finger slide is enabled.

## [v1.0.5] - 2025-05-19

### Added

- Made the finger slide height configurable.

## [v1.0.4] - 2025-05-19

### Added

- Added the initial Gridfinity bin FeatureScript.
- Added magnet holes, stackable lids, shell/hollow geometry, labels, and finger slides.
- Added the feature icon, README, and license.
- Added configurable body wall thickness.

### Changed

- Moved labels and finger slides to opposite sides.
- Swapped row and column handling.

### Fixed

- Fixed early face-query issues in base geometry.
