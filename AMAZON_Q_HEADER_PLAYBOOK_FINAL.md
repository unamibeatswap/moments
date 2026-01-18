# AMAZON Q PROMPT PLAYBOOK
## Admin Dashboard Header Refactor

**Project:** Unami Foundation – Moments App  
**Scope:** Admin Dashboard Header + Brand System  
**Constraint:** Non-breaking, incremental, production-safe  
**Status:** ✅ Ready for Implementation

---

## 📋 FILES TO ANALYZE (SCAN FIRST)

### Primary Files
- `/workspaces/moments/public/admin-dashboard.html` - Main admin UI
- `/workspaces/moments/public/css/admin-header.css` - Header styles
- `/workspaces/moments/public/css/design-system.css` - Design tokens
- `/workspaces/moments/public/logo.svg` - Brand artifact

### Secondary Files (DO NOT MODIFY)
- `/workspaces/moments/src/admin.js` - API routes
- `/workspaces/moments/README.md` - System context

---

## 🎯 SYSTEM ROLE

You are a **Senior Frontend Architect & Design Systems Engineer** working inside an active production repository.

### Your Responsibility
- Improve visual hierarchy and usability
- Apply brand consistency from logo artifact
- Make incremental, reversible UI changes
- Respect existing layout, routing, and logic

### You Must NOT
- ❌ Introduce new routes
- ❌ Change backend logic
- ❌ Alter authentication or permissions
- ❌ Redesign the entire UI
- ❌ Add new dependencies

---

## 🔍 BRAND SOURCE OF TRUTH

### Logo Location
**File:** `/workspaces/moments/public/logo.svg`

**Current Logo:** Simple blue square with white "M"
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect rx="18" width="100" height="100" fill="#2563eb" />
  <text x="50" y="58" font-size="44" text-anchor="middle" fill="white">M</text>
</svg>
```

### Extracted Brand Colors
From existing design system (`design-system.css`):

```css
:root {
  --brand-primary: #2563eb;      /* Blue - System/Admin/Trust */
  --brand-primary-hover: #1d4ed8;
  --brand-success: #16a34a;      /* Green - Automation/Flow */
  --brand-warning: #f59e0b;      /* Yellow - Community/Learners */
  --brand-danger: #dc2626;       /* Red - Alerts/Moderation */
}
```

### Brand Semantics (Apply Strictly)
- 🔵 **Blue (#2563eb)** → System / Admin / Trust
- 🟢 **Green (#16a34a)** → Automation / Flow / Success
- 🟡 **Yellow (#f59e0b)** → Community / Learners / Warnings
- 🔴 **Red (#dc2626)** → Alerts / Moderation / Danger

**Rule:** Use colors as meaning, not decoration.

---

## 📐 BEFORE → AFTER (VISUAL STRUCTURE)

### BEFORE (Current State)
```
┌─────────────────────────────────────────────────┐
│ [Top Nav: Home | Community | Join | Admin]     │ 50px
├─────────────────────────────────────────────────┤
│ Unami Foundation Admin                          │
│ Super Administrator                             │ 60px
│ [user@email.com] [Sign Out]                    │
├─────────────────────────────────────────────────┤
│ 📊 💬 📢 💰 👥 🚨 📡 📻 ⚙️ 🔐 💰 ❓          │ 48px
└─────────────────────────────────────────────────┘
Total Header: ~158px
```

### AFTER (Target State)
```
┌─────────────────────────────────────────────────┐
│ [Top Nav: Home | Community | Join | Admin]     │ 50px
├─────────────────────────────────────────────────┤
│ [M] Analytics                    [☰] [Sign Out] │ 48px
├─────────────────────────────────────────────────┤
│ 📊 💬 📢 | 💰 👥 | 🚨 📡 | ⚙️ 🔐 💰 ❓       │ 44px
└─────────────────────────────────────────────────┘
Total Header: ~142px (10% reduction minimum)
```

### Key Changes
1. **Remove:** "Unami Foundation Admin" + "Super Administrator" text
2. **Simplify:** Logo icon only (no text)
3. **Relocate:** User email + Sign Out to hamburger menu
4. **Group:** Navigation icons by function with subtle dividers
5. **Reduce:** Padding and spacing throughout

---

## 🎯 REQUIRED OUTCOMES

### Header Refactor Goals
1. ✅ Reduce header height by 10-15% (target: <145px)
2. ✅ Remove stacked identity text
3. ✅ Move "Sign Out" to hamburger menu
4. ✅ Keep all functionality intact
5. ✅ Improve mobile landscape behavior

### Success Metrics (Must Pass)
- [ ] Header height: <145px on desktop
- [ ] Header height: <100px on mobile landscape
- [ ] Time to first content: <200ms
- [ ] All navigation icons clickable
- [ ] Sign out accessible in <2 clicks
- [ ] No horizontal scroll on 320px width
- [ ] Logo recognizable at 32px size

---

## 🚫 WHAT TO REMOVE (SAFE, IMMEDIATE)

### Remove These Elements
```html
<!-- ❌ REMOVE -->
<div class="admin-branding">
  <h1>Unami Foundation Admin</h1>
</div>

<!-- ❌ REMOVE -->
<div class="admin-user-role">Super Administrator</div>

<!-- ❌ REMOVE (move to menu) -->
<span id="user-email">user@email.com</span>
```

### Keep These Elements (Relocate)
- User email → Hamburger menu
- User role → Hamburger menu
- Sign Out button → Hamburger menu

---

## 🏗️ HEADER STRUCTURE (TARGET STATE)

### Layer 1: Compact Control Bar (48px)
```
┌─────────────────────────────────────────────────┐
│ [M Logo]  Current Section Name    [☰] [Sign Out]│
└─────────────────────────────────────────────────┘
```

**Left:** Logo icon only (32px, no text)  
**Center:** Dynamic page context (e.g., "Analytics", "Moderation")  
**Right:** Hamburger menu + Sign Out

### Layer 2: Grouped Navigation (44px)
```
┌─────────────────────────────────────────────────┐
│ 📊 💬 📢 | 💰 👥 | 🚨 📡 | ⚙️ 🔐 💰 ❓       │
└─────────────────────────────────────────────────┘
```

**Groups:**
- 🔵 **Monitor** (Analytics, Moments, Campaigns)
- 🟡 **Community** (Sponsors, Users, Subscribers)
- 🔴 **Moderation** (Moderation, Broadcasts)
- ⚙️ **System** (Settings, Authority, Budget, Help)

**Visual Grouping:** Subtle vertical dividers (`|`) or 2px gap

---

## 📱 RESPONSIVE BEHAVIOR (MANDATORY)

### Desktop (>768px)
- Header: 142px total
- Navigation: Full labels visible
- Logo: 32px with hover tooltip

### Tablet (768px)
- Header: 120px total
- Navigation: Icons + short labels
- Logo: 28px

### Mobile Portrait (<768px)
- Header: 100px total
- Navigation: Icons only (horizontal scroll)
- Logo: 24px

### Mobile Landscape (<500px height)
```css
@media (max-height: 500px) and (orientation: landscape) {
  .admin-header {
    height: 80px; /* Minimal header */
  }
  .admin-nav {
    display: none; /* Hide nav, use hamburger only */
  }
}
```

---

## 🔄 ROLLBACK STRATEGY (MANDATORY)

### Before Making Changes
1. **Create backup:**
   ```bash
   cp public/admin-dashboard.html public/admin-dashboard.html.backup
   cp public/css/admin-header.css public/css/admin-header.css.backup
   ```

2. **Use CSS classes, not inline styles**
3. **Comment out old code, don't delete**
4. **Test in browser DevTools first**
5. **Commit with clear message:**
   ```
   refactor: reduce admin header height by 10%
   
   - Remove stacked identity text
   - Move user controls to hamburger menu
   - Group navigation icons by function
   - Improve mobile landscape behavior
   ```

### Rollback Command
```bash
git revert HEAD  # If committed
# OR
mv public/admin-dashboard.html.backup public/admin-dashboard.html
mv public/css/admin-header.css.backup public/css/admin-header.css
```

---

## 🛠️ IMPLEMENTATION STRATEGY

### Phase 1: CSS-Only Changes (Safest)
```css
/* admin-header.css */
.admin-header-top {
  padding: 0.75rem 0; /* Reduce from 1rem */
}

.admin-branding h1 {
  display: none; /* Hide text, keep logo */
}

.admin-user-info {
  display: none; /* Move to menu */
}

.admin-nav-item {
  padding: 0.4rem 0.6rem; /* Reduce from 0.5rem 0.75rem */
}
```

### Phase 2: HTML Structure (Minimal)
- Add hamburger menu component
- Move user info into menu
- Add page context display

### Phase 3: JavaScript (If Needed)
- Toggle hamburger menu
- Update page context on navigation

### Preferences
- ✅ Prefer CSS/layout changes over component rewrites
- ✅ Hide elements conditionally (responsive)
- ✅ Avoid renaming components
- ✅ Keep diffs small and reviewable
- ✅ Ensure rollback is trivial

---

## ✅ VALIDATION CHECKLIST

After implementing changes, verify:

### Visual
- [ ] Header is visually lighter than content
- [ ] Logo is recognizable at small size
- [ ] Navigation groups are clear
- [ ] No text overflow on mobile

### Functional
- [ ] All navigation buttons work
- [ ] Sign out is accessible
- [ ] Hamburger menu opens/closes
- [ ] Page context updates correctly

### Performance
- [ ] No layout shift on load
- [ ] Smooth transitions (<200ms)
- [ ] No horizontal scroll

### Responsive
- [ ] Desktop: Full experience
- [ ] Tablet: Compact but usable
- [ ] Mobile portrait: Icon-only nav
- [ ] Mobile landscape: Minimal header

---

## 🎨 AUTHORITY LAYER VISUAL RULE (FUTURE-SAFE)

### Current State
- "🔐 Authority" button in navigation ✅ Keep
- "Super Administrator" text in header ❌ Remove

### Display Rules
**Do NOT display roles or authority in the header.**

Authority may appear only:
1. **Contextually** (e.g., moderation status)
2. **As signals** (dots, color, badges)
3. **Never as titles** like "Super Admin"

**Rationale:** The logo represents the system, not the user. The header supports work, not identity.

---

## 🚀 USAGE INSTRUCTIONS

### Step 1: Paste to Amazon Q
```
@admin-dashboard.html @admin-header.css @design-system.css @logo.svg

[PASTE THIS ENTIRE PLAYBOOK]

First, analyze the current header structure and confirm brand colors. 
Do not make changes yet—just report findings.
```

### Step 2: Review Findings
Amazon Q will report:
- Current header height
- Identified redundant elements
- Brand color extraction
- Proposed changes

### Step 3: Approve Implementation
```
Proceed with Phase 1 (CSS-only changes) first.
Show me the diff before applying.
```

### Step 4: Test Incrementally
```
Apply Phase 1 changes.
I will test and confirm before Phase 2.
```

---

## 🎯 FINAL PRINCIPLES (DO NOT VIOLATE)

1. **The logo represents the system, not the user.**
2. **The header supports work, not identity.**
3. **Colors convey meaning, not decoration.**
4. **Every change must be reversible.**
5. **Production safety over perfection.**

---

## 📊 EXPECTED OUTCOMES

### Immediate Benefits
- ✅ 10-15% more vertical space for content
- ✅ Cleaner, more professional appearance
- ✅ Better mobile landscape experience
- ✅ Faster visual hierarchy comprehension

### Long-term Benefits
- ✅ Scalable design system foundation
- ✅ Easier to add new navigation items
- ✅ Consistent brand application
- ✅ Improved accessibility

---

## 🔗 RELATED DOCUMENTATION

- **Main README:** `/workspaces/moments/README.md`
- **Authority Guide:** `/workspaces/moments/AUTHORITY_TEST_GUIDE.md`
- **Design System:** `/workspaces/moments/public/css/design-system.css`

---

**Version:** 1.0  
**Last Updated:** 2025-01-17  
**Status:** ✅ Ready for Amazon Q Implementation
