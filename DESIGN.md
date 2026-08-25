---
name: The Journey
colors:
  surface: '#ffffff'
  surface-dim: '#dde0eb'
  surface-bright: '#ffffff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f8'
  surface-container: '#eceef4'
  surface-container-high: '#e4e6ee'
  surface-container-highest: '#dadde8'
  on-surface: '#141a2c'
  on-surface-variant: '#545d73'
  inverse-surface: '#1d2748'
  inverse-on-surface: '#f0f1f7'
  outline: '#959db3'
  outline-variant: '#d2d6e3'
  surface-tint: '#2643a8'
  primary: '#1a2b6d'
  on-primary: '#ffffff'
  primary-container: '#eef1fb'
  on-primary-container: '#162258'
  inverse-primary: '#a6baee'
  secondary: '#7a6655'
  on-secondary: '#ffffff'
  secondary-container: '#f5efe9'
  on-secondary-container: '#4d3d31'
  tertiary: '#d4890a'
  on-tertiary: '#ffffff'
  tertiary-container: '#fdf2dc'
  on-tertiary-container: '#382500'
  error: '#be2a2a'
  on-error: '#ffffff'
  error-container: '#fbebeb'
  on-error-container: '#410002'
  success: '#159050'
  on-success: '#ffffff'
  success-container: '#e5f7ed'
  on-success-container: '#053119'
  warning: '#c87a06'
  on-warning: '#ffffff'
  warning-container: '#fdf1dc'
  on-warning-container: '#3b2200'
  info: '#2563a8'
  on-info: '#ffffff'
  info-container: '#eaf2fb'
  on-info-container: '#081f3b'
  background: '#f6f7fa'
  on-background: '#141a2c'
typography:
  display-xl:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.03em
  display-lg:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 60px
    letterSpacing: -0.02em
  display-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: 0
  title-lg:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: 0
  title-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: 0
  body-lg:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: 0
  body-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0
  body-sm:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0
  label-lg:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0
  label-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
rounded:
  none: 0px
  xs: 4px
  sm: 6px
  DEFAULT: 8px
  md: 8px
  lg: 12px
  xl: 16px
  2xl: 24px
  full: 9999px
spacing:
  unit: 4px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style
The design system is built on the pillars of **Clarity, Trust, Depth, and Arabic-first**. The aesthetic follows an **Ink & Horizon** direction, utilizing Deep Ink Blue and Warm Stone to convey professionalism, authority, and humanity.

## Colors
The palette is deep, grounded, and sophisticated.
- **Primary (Deep Ink):** Used for primary actions, active navigation, and brand-critical elements.
- **Secondary (Warm Stone):** Used for secondary actions and supporting elements to add warmth.
- **Accent (Discovery Gold):** Used sparingly (max 2 per screen) for active timers or premium badges.

## Semantic Color Mapping
Semantic colors must NOT be used as decorative brand colors. They are strictly reserved for communicating status and urgency:
- **SUCCESS (Verified Green #159050):** Verified Agent, Confirmed Price, Successful completion states.
- **WARNING (Amber #C87A06):** Pending Review, Near Expiration, Attention Required.
- **ERROR (Firm Red #BE2A2A):** Validation Errors, Rejected Offers, Rejected Verification, Destructive Actions.
- **INFO (Deep Horizon #2563A8):** Informational banners, System Messages, Neutral guidance.

## Typography
The design system utilizes **IBM Plex Sans Arabic** (integrated via the `ibmPlexSans` family) to provide a geometric yet humanist feel, perfect for a trust-first product.
- **RTL Optimization:** All type styles are designed with Right-to-Left (RTL) reading patterns as the priority.

## Layout & Spacing
The design system uses a **Fixed Grid** model for desktop to maintain a premium, editorial feel, transitioning to a fluid model for mobile.

- **Desktop:** 12-column grid, 1280px max-width, 24px gutters.
- **Mobile:** Single column with 16px side margins.
- **RTL Flow:** Layouts are mirrored. Primary text alignment is right-justified.
- **Rhythm:** All spacing (padding, margins) must be multiples of 4px.

## Elevation & Depth
This design system employs **Tonal Layering** supplemented by **Ambient Shadows** to create a sense of organized depth without visual noise. No colored shadows. No glow effects.
- **Level 0 (Base):** Near White (#F6F7FA) background.
- **Level XS (Inputs at rest):** White surface with `Shadow XS` (0 1px 2px rgba(20,26,44,0.06)).
- **Level 1 (Cards/Modules):** White (#FFFFFF) surface with `Shadow SM` (0 2px 8px rgba(20,26,44,0.08)).
- **Level 2 (Hover/Active):** White surface with `Shadow MD` (0 4px 16px rgba(20,26,44,0.10)).
- **Level 3 (Modals/Overlays):** White surface with `Shadow LG` (0 8px 32px rgba(20,26,44,0.12)).
- **Level XL (Full-screen overlays):** White surface with `Shadow XL` (0 16px 48px rgba(20,26,44,0.16)).

## Shapes & Radius
A structured yet approachable shape language is used. The global default is 8px, with explicit semantic overrides:
- **Standard Elements (rounded-md / 8px):** Buttons, Inputs, Standard cards, Standard interactive containers.
- **Small Elements (rounded-sm / 6px):** Tags and small buttons only.
- **Pill / Chip Radius (rounded-full / 9999px):** Verification badges, Status chips, Filter chips, Compact categorical pills, Rating pills.
- **Large Elements (rounded-xl / 16px):** The Hero Search Module.
