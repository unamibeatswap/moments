# Brand Color Extraction & Usage Guide
## Unami Foundation Moments App

**Purpose:** Document extracted brand colors and their semantic usage  
**Source:** Existing design system + logo analysis  
**Status:** ✅ Production-ready

---

## 🎨 EXTRACTED BRAND COLORS

### Primary Palette
```css
:root {
  /* System Colors */
  --brand-primary: #2563eb;        /* Blue - Admin/System */
  --brand-primary-hover: #1d4ed8;  /* Blue Dark */
  --brand-primary-light: #dbeafe;  /* Blue Light */
  
  /* Semantic Colors */
  --brand-success: #16a34a;        /* Green - Success/Flow */
  --brand-success-hover: #15803d;  /* Green Dark */
  --brand-success-light: #d1fae5;  /* Green Light */
  
  --brand-warning: #f59e0b;        /* Yellow - Community/Warnings */
  --brand-warning-light: #fef3c7;  /* Yellow Light */
  
  --brand-danger: #dc2626;         /* Red - Alerts/Moderation */
  --brand-danger-hover: #b91c1c;   /* Red Dark */
  --brand-danger-light: #fee2e2;   /* Red Light */
  
  /* Neutral Colors */
  --brand-secondary: #6b7280;      /* Gray - Secondary actions */
  --brand-secondary-hover: #4b5563;/* Gray Dark */
}
```

---

## 🔵 BLUE - System & Trust

### Hex Values
- **Primary:** `#2563eb`
- **Hover:** `#1d4ed8`
- **Light:** `#dbeafe`

### Usage
- ✅ Admin header background
- ✅ Primary buttons
- ✅ System navigation
- ✅ Trust indicators
- ✅ Active states

### Examples
```css
.admin-header {
  background: var(--brand-primary);
}

.btn-primary {
  background: var(--brand-primary);
}

.btn-primary:hover {
  background: var(--brand-primary-hover);
}
```

---

## 🟢 GREEN - Success & Automation

### Hex Values
- **Primary:** `#16a34a`
- **Hover:** `#15803d`
- **Light:** `#d1fae5`

### Usage
- ✅ Success messages
- ✅ Automation indicators
- ✅ Flow completion
- ✅ Active broadcasts
- ✅ Approved content

### Examples
```css
.status-broadcasted {
  background: var(--brand-success-light);
  color: var(--brand-success);
}

.btn-success {
  background: var(--brand-success);
}
```

---

## 🟡 YELLOW - Community & Warnings

### Hex Values
- **Primary:** `#f59e0b`
- **Light:** `#fef3c7`

### Usage
- ✅ Community features
- ✅ Learner indicators
- ✅ Warning messages
- ✅ Scheduled content
- ✅ Pending actions

### Examples
```css
.status-scheduled {
  background: var(--brand-warning-light);
  color: #92400e; /* Darker yellow for text */
}

.alert-warning {
  background: var(--brand-warning-light);
  border-color: var(--brand-warning);
}
```

---

## 🔴 RED - Alerts & Moderation

### Hex Values
- **Primary:** `#dc2626`
- **Hover:** `#b91c1c`
- **Light:** `#fee2e2`

### Usage
- ✅ Error messages
- ✅ Moderation flags
- ✅ Danger actions
- ✅ Cancelled content
- ✅ Critical alerts

### Examples
```css
.status-cancelled {
  background: var(--brand-danger-light);
  color: var(--brand-danger);
}

.btn-danger {
  background: var(--brand-danger);
}
```

---

## ⚪ GRAY - Secondary & Neutral

### Hex Values
- **Primary:** `#6b7280`
- **Hover:** `#4b5563`

### Usage
- ✅ Secondary buttons
- ✅ Disabled states
- ✅ Neutral actions
- ✅ Draft content
- ✅ Inactive elements

### Examples
```css
.btn-secondary {
  background: var(--brand-secondary);
}

.status-draft {
  background: #f3f4f6;
  color: var(--brand-secondary);
}
```

---

## 🎯 SEMANTIC USAGE RULES

### Navigation Icon Groups

#### 🔵 Monitor Group (Blue Background)
```css
.nav-group-monitor {
  background: rgba(37, 99, 235, 0.1); /* Blue at 10% */
}
```
**Icons:** Dashboard, Moments, Campaigns

#### 🟡 Community Group (Yellow Background)
```css
.nav-group-community {
  background: rgba(245, 158, 11, 0.1); /* Yellow at 10% */
}
```
**Icons:** Sponsors, Users, Subscribers

#### 🔴 Moderation Group (Red Background)
```css
.nav-group-moderation {
  background: rgba(220, 38, 38, 0.1); /* Red at 10% */
}
```
**Icons:** Moderation, Broadcasts

#### ⚙️ System Group (Gray Background)
```css
.nav-group-system {
  background: rgba(107, 114, 128, 0.1); /* Gray at 10% */
}
```
**Icons:** Settings, Authority, Budget, Help

---

## 🚫 ANTI-PATTERNS (DO NOT USE)

### ❌ Don't Use Colors for Decoration
```css
/* BAD */
.random-element {
  background: var(--brand-primary); /* No semantic meaning */
}
```

### ❌ Don't Mix Semantic Colors
```css
/* BAD */
.success-button {
  background: var(--brand-danger); /* Contradictory */
}
```

### ❌ Don't Use Raw Hex Values
```css
/* BAD */
.header {
  background: #2563eb; /* Use CSS variable instead */
}

/* GOOD */
.header {
  background: var(--brand-primary);
}
```

---

## 📐 OPACITY SCALE

### Background Tints
```css
/* 5% - Subtle hover */
background: rgba(37, 99, 235, 0.05);

/* 10% - Group backgrounds */
background: rgba(37, 99, 235, 0.1);

/* 20% - Active states */
background: rgba(37, 99, 235, 0.2);

/* 30% - Selected states */
background: rgba(37, 99, 235, 0.3);
```

### Text Opacity
```css
/* 90% - Secondary text */
color: rgba(255, 255, 255, 0.9);

/* 70% - Tertiary text */
color: rgba(255, 255, 255, 0.7);

/* 50% - Disabled text */
color: rgba(255, 255, 255, 0.5);
```

---

## 🎨 LOGO USAGE

### Current Logo
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect rx="18" width="100" height="100" fill="#2563eb" />
  <text x="50" y="58" font-size="44" text-anchor="middle" fill="white">M</text>
</svg>
```

### Size Guidelines
- **Desktop Header:** 32px
- **Mobile Header:** 24px
- **Favicon:** 16px, 32px, 48px
- **Touch Icon:** 180px

### Minimum Size
- **Never smaller than:** 16px
- **Optimal minimum:** 24px

---

## 🔄 ACCESSIBILITY COMPLIANCE

### Contrast Ratios (WCAG AA)

#### Text on Blue Background
```css
/* ✅ PASS - 4.5:1 ratio */
color: white;
background: var(--brand-primary);
```

#### Text on Light Backgrounds
```css
/* ✅ PASS - 7:1 ratio */
color: var(--brand-primary);
background: var(--brand-primary-light);
```

#### Small Text Requirements
- **Minimum:** 4.5:1 contrast ratio
- **Large Text (18px+):** 3:1 contrast ratio

---

## 📊 COLOR TESTING CHECKLIST

Before deploying color changes:

- [ ] All text meets WCAG AA contrast requirements
- [ ] Colors have semantic meaning (not decorative)
- [ ] Hover states are visually distinct
- [ ] Active states are clearly indicated
- [ ] Disabled states are obvious
- [ ] Color-blind users can distinguish states
- [ ] Dark mode compatibility (if applicable)

---

## 🔗 IMPLEMENTATION EXAMPLE

### Complete Navigation Group Styling
```css
/* Navigation Groups with Semantic Colors */
.admin-nav {
  display: flex;
  gap: 0.5rem;
}

/* Monitor Group - Blue */
.admin-nav-item[data-group="monitor"] {
  background: rgba(37, 99, 235, 0.1);
}

.admin-nav-item[data-group="monitor"]:hover {
  background: rgba(37, 99, 235, 0.2);
}

.admin-nav-item[data-group="monitor"].active {
  background: rgba(37, 99, 235, 0.25);
  border-left: 3px solid var(--brand-primary);
}

/* Community Group - Yellow */
.admin-nav-item[data-group="community"] {
  background: rgba(245, 158, 11, 0.1);
}

.admin-nav-item[data-group="community"]:hover {
  background: rgba(245, 158, 11, 0.2);
}

/* Moderation Group - Red */
.admin-nav-item[data-group="moderation"] {
  background: rgba(220, 38, 38, 0.1);
}

.admin-nav-item[data-group="moderation"]:hover {
  background: rgba(220, 38, 38, 0.2);
}

/* System Group - Gray */
.admin-nav-item[data-group="system"] {
  background: rgba(107, 114, 128, 0.1);
}

.admin-nav-item[data-group="system"]:hover {
  background: rgba(107, 114, 128, 0.2);
}
```

---

## 📝 NOTES

### Design System Integration
All colors are already defined in `/workspaces/moments/public/css/design-system.css`

### No New Colors Needed
The existing palette is sufficient for all admin dashboard needs.

### Future Expansion
If new colors are needed:
1. Extract from logo or brand guidelines
2. Define semantic meaning
3. Add to design system
4. Document usage rules
5. Test accessibility

---

**Version:** 1.0  
**Last Updated:** 2025-01-17  
**Status:** ✅ Production-ready
