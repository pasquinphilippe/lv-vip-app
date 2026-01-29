# Polaris App Home - Quick Reference

## Available Components

### Layout
- `s-page` - Main container with `heading`, `inlineSize` (base|large), slots: `aside`, `primary-action`, `secondary-action`, `back-action`
- `s-section` - Card-like container (level 1 = styled card). Props: `heading`, `padding` (base|none)
- `s-grid` - CSS Grid. Props: `gridTemplateColumns`, `gap`. Use responsive: `@container (inline-size <= 400px) 1fr, 1fr 1fr 1fr 1fr`
- `s-stack` - Flexbox. Props: `direction` (inline|block), `gap`
- `s-box` - Generic container. Props: `padding`, `background`, `border`, `borderRadius`
- `s-divider` - Props: `direction` (inline|block)

### Typography
- `s-heading` - Headings (auto-levels within sections)
- `s-text` - Inline text. Props: `variant` (bodySm|bodyMd|headingLg), `tone` (subdued|critical|success|warning|info)
- `s-paragraph` - Block text

### Actions
- `s-button` - Props: `variant` (primary|secondary|tertiary), `size` (slim), `tone` (critical), `href`, `disabled`, `submit`
- `s-button-group` - Group buttons
- `s-link` - Navigation links. Props: `href`, `variant`
- `s-clickable` - Interactive container. Props: `href`, `padding`, `borderRadius`

### Feedback
- `s-badge` - Props: `tone` (success|warning|critical|info), `icon`, `size` (small)
- `s-banner` - Important messages. Props: `tone`, `heading`
- `s-spinner` - Loading indicator

### Data
- `s-table` - Auto-responsive. Props: `paginate`, `hasNextPage`, `loading`, `layout` (list|table|auto)
  - `s-table-header-row` → `s-table-header` (props: `format`, `listSlot`)
  - `s-table-body` → `s-table-row` → `s-table-cell`

### Forms
- `s-text-field` - Props: `name`, `label`, `placeholder`, `required`, `error`, `value`, `type`, `prefix`, `suffix`
- `s-select` - Contains `s-option` children. Props: `name`, `label`, `required`
- `s-number-field` - Numeric input with props: `min`, `max`, `step`
- `s-checkbox`, `s-switch` - Boolean inputs
- `s-search-field` - Search with props: `labelAccessibilityVisibility` (exclusive)

### Overlays
- `s-modal` - Props: `heading`, `id`, `padding` (base|none), `size`. Use `commandFor` on button to trigger.
  - Slots: `primary-action`, `secondary-action`
- `s-popover` - Tooltips/dropdowns

### Media
- `s-avatar` - User avatar
- `s-icon` - Icons
- `s-thumbnail` - Image preview
- `s-image` - Full image

## Patterns

### Metrics Card (KPI Dashboard)
```jsx
<s-section padding="base">
  <s-grid
    gridTemplateColumns="@container (inline-size <= 400px) 1fr, 1fr auto 1fr auto 1fr"
    gap="small"
  >
    <s-clickable href="" paddingBlock="small-400" paddingInline="small-100" borderRadius="base">
      <s-grid gap="small-300">
        <s-heading>Metric Label</s-heading>
        <s-stack direction="inline" gap="small-200">
          <s-text>1,234</s-text>
          <s-badge tone="success" icon="arrow-up">12%</s-badge>
        </s-stack>
      </s-grid>
    </s-clickable>
    <s-divider direction="block" />
    <!-- More metrics... -->
  </s-grid>
</s-section>
```

### Page with Sidebar
```jsx
<s-page heading="Title" inlineSize="base">
  <s-button slot="primary-action" variant="primary">Action</s-button>
  
  <s-section heading="Main Content">
    <!-- Content -->
  </s-section>
  
  <s-section slot="aside" heading="Sidebar">
    <!-- Sidebar content -->
  </s-section>
</s-page>
```

### Modal with Form
```jsx
<s-button commandFor="my-modal">Open Modal</s-button>

<s-modal id="my-modal" heading="Modal Title">
  <s-stack direction="block" gap="large">
    <s-text-field name="field" label="Label" required />
    <s-select name="type" label="Type">
      <s-option value="a">Option A</s-option>
      <s-option value="b">Option B</s-option>
    </s-select>
  </s-stack>
  
  <s-button slot="primary-action" variant="primary" submit>Save</s-button>
  <s-button slot="secondary-action" variant="secondary">Cancel</s-button>
</s-modal>
```

### Data Table
```jsx
<s-table paginate hasNextPage>
  <s-table-header-row>
    <s-table-header listSlot="primary">Name</s-table-header>
    <s-table-header format="currency">Price</s-table-header>
    <s-table-header>Status</s-table-header>
  </s-table-header-row>
  <s-table-body>
    <s-table-row>
      <s-table-cell>Item Name</s-table-cell>
      <s-table-cell>$99.00</s-table-cell>
      <s-table-cell><s-badge tone="success">Active</s-badge></s-table-cell>
    </s-table-row>
  </s-table-body>
</s-table>
```

## Gap/Padding Scale
- `none`, `small-100`, `small-200`, `small-300`, `small-400`
- `base`, `large`, `large-100`, `large-200`, etc.

## Don't Use (Not Available)
- ❌ `s-card` - Use `s-section` instead
- ❌ `s-navigation` - Use `s-stack` with `s-link`
- ❌ `s-empty-state` - Build with `s-section` + `s-heading` + `s-paragraph` + `s-button`
- ❌ `columns={[...]}` on grid - Use `gridTemplateColumns="1fr 1fr"`
