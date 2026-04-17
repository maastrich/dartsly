<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Design target: mobile PWA only (iOS-first)

Dartsly is designed and optimised for **mobile devices running as an installed PWA**. Assume the app is standalone — no browser chrome, no URL bar, no back button. Design every screen as if it were a native iOS app.

Hard rules:
- **Mobile only.** Do not add desktop/tablet breakpoints, hover states as primary affordances, or multi-column layouts that only make sense on wide screens. One-handed thumb reach is the priority. `max-w-*` caps are fine, but never design *for* wider viewports.
- **Primary actions at the bottom.** Sticky CTAs, bottom sheets, bottom tab bars. Never put the main action at the top of a scroll.
- **Navigation lives at the bottom** (iOS tab-bar style). The top of the screen is for titles/context, not for nav links.
- **Respect safe areas.** Use `env(safe-area-inset-bottom)` / `env(safe-area-inset-top)` on any sticky top/bottom surface. Pattern: `pb-[max(0.75rem,env(safe-area-inset-bottom))]`.
- **Use `100dvh`, not `100vh`.** Dynamic viewport height avoids iOS Safari jump when the URL bar hides/shows (still matters for the install/share sheet and first paint pre-standalone).
- **Touch targets ≥ 44×44pt.** No tiny hover-only controls.
- **Haptics on meaningful actions.** Use `navigator.vibrate` where it adds feedback (see `haptic()` in `x01.tsx`).
- **Scroll the content, not the frame.** Long pages go inside a `flex-1 min-h-0 overflow-y-auto` region so the header and bottom bar stay pinned.
- **No `hover:` without a touch fallback.** Active/pressed states (`active:scale-*`) matter more than hover.
<!-- END:nextjs-agent-rules -->
