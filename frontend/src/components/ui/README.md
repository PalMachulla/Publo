# Atomic Design UI System

A comprehensive, accessible UI component library built with Radix UI primitives and Tailwind CSS, following atomic design principles.

## Overview

This UI system is organized into:
- **Atoms**: Basic building blocks (Button, Input, Checkbox, etc.)
- **Molecules**: Simple combinations of atoms (FormField, ToggleGroup, etc.)
- **Organisms**: Complex UI sections built from molecules and atoms

## Design Principles

1. **Accessibility First**: All components use Radix UI primitives for WCAG 2.1 AA compliance
2. **Type Safety**: Strict TypeScript typing throughout
3. **Composability**: Components can be combined and extended
4. **Consistency**: Unified design language across the application
5. **Security**: Input validation and sanitization built-in (maxLength, pattern validation)

## Atoms

### Button

Versatile button component with multiple variants and sizes.

```tsx
import { Button } from '@/components/ui'

// Basic usage
<Button onClick={handleClick}>Click me</Button>

// Variants
<Button variant="default">Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="primary">Primary</Button>
<Button variant="success">Success</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>

// States
<Button loading>Loading...</Button>
<Button disabled>Disabled</Button>
```

### Input

Text input with validation states and character count.

```tsx
import { Input } from '@/components/ui'

// Basic usage
<Input 
  value={value}
  onChange={(e) => setValue(e.target.value)}
  placeholder="Enter text..."
/>

// With validation
<Input 
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={!!emailError}
  type="email"
/>

// With character count
<Input 
  value={title}
  onChange={(e) => setTitle(e.target.value)}
  maxLength={100}
  showCount
/>
```

### Textarea

Multi-line text input with auto-resize option.

```tsx
import { Textarea } from '@/components/ui'

// Basic usage
<Textarea 
  value={description}
  onChange={(e) => setDescription(e.target.value)}
  rows={4}
/>

// Auto-resize
<Textarea 
  value={content}
  onChange={(e) => setContent(e.target.value)}
  autoResize
/>

// With character count
<Textarea 
  value={bio}
  onChange={(e) => setBio(e.target.value)}
  maxLength={500}
  showCount
/>
```

### Select

Accessible dropdown select with keyboard navigation.

```tsx
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui'

<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
    <SelectItem value="option3">Option 3</SelectItem>
  </SelectContent>
</Select>
```

### Checkbox

Accessible checkbox with indeterminate state support.

```tsx
import { Checkbox } from '@/components/ui'

<label className="flex items-center gap-2 cursor-pointer">
  <Checkbox 
    checked={isChecked}
    onCheckedChange={(checked) => setIsChecked(checked as boolean)}
  />
  <span>Accept terms and conditions</span>
</label>
```

### Slider

Range slider with labels and value formatting.

```tsx
import { Slider } from '@/components/ui'

<Slider
  label="Volume"
  value={[volume]}
  onValueChange={(value) => setVolume(value[0])}
  min={0}
  max={100}
  step={1}
  minLabel="Quiet"
  maxLabel="Loud"
  valueFormatter={(v) => `${v}%`}
/>
```

### Label

Form label with required indicator support.

```tsx
import { Label } from '@/components/ui'

<Label>Name</Label>
<Label required>Email</Label>
```

### Badge

Compact status/tag indicator with multiple variants.

```tsx
import { Badge } from '@/components/ui'

// Variants
<Badge variant="default">Default</Badge>
<Badge variant="primary">Primary</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="danger">Danger</Badge>
<Badge variant="info">Info</Badge>
<Badge variant="purple">Purple</Badge>
<Badge variant="outline">Outline</Badge>

// Sizes
<Badge size="sm">Small</Badge>
<Badge size="md">Medium</Badge>
<Badge size="lg">Large</Badge>

// Example: Model pricing
<Badge variant="outline" size="sm">
  💵 $0.10/1M tokens
</Badge>
```

### Card

Versatile container component for grouping content.

```tsx
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from '@/components/ui'

// Basic card
<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description text</CardDescription>
  </CardHeader>
  <CardContent>
    Main content here
  </CardContent>
  <CardFooter>
    Footer content
  </CardFooter>
</Card>

// Interactive card with selection
<Card 
  variant="interactive" 
  onClick={handleClick}
>
  Clickable card
</Card>

<Card variant="selected">
  Selected state
</Card>
```

### Radio

Radio button group for single selection.

```tsx
import { RadioGroup, RadioItem } from '@/components/ui'

<RadioGroup 
  value={selected} 
  onValueChange={setSelected}
>
  <RadioItem 
    value="option1" 
    label="Option 1" 
    description="Description for option 1" 
  />
  <RadioItem 
    value="option2" 
    label="Option 2" 
    description="Description for option 2" 
  />
</RadioGroup>

// Horizontal orientation
<RadioGroup 
  value={selected} 
  onValueChange={setSelected}
  orientation="horizontal"
>
  <RadioItem value="yes" label="Yes" />
  <RadioItem value="no" label="No" />
</RadioGroup>
```

## Molecules

### FormField

Combines label, input, and error message handling.

```tsx
import { FormField, Input } from '@/components/ui'

<FormField
  label="Email"
  required
  error={emailError}
  hint="We'll never share your email"
>
  <Input
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    error={!!emailError}
  />
</FormField>
```

### ToggleGroup

Single or multiple selection toggle buttons.

```tsx
import { ToggleGroup, ToggleGroupItem } from '@/components/ui'

// Single selection
<ToggleGroup
  type="single"
  value={selected}
  onValueChange={setSelected}
>
  <ToggleGroupItem value="option1">Option 1</ToggleGroupItem>
  <ToggleGroupItem value="option2">Option 2</ToggleGroupItem>
  <ToggleGroupItem value="option3">Option 3</ToggleGroupItem>
</ToggleGroup>

// Multiple selection
<ToggleGroup
  type="multiple"
  value={selected}
  onValueChange={setSelected}
>
  <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
  <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
  <ToggleGroupItem value="underline">Underline</ToggleGroupItem>
</ToggleGroup>
```

### CollapsibleSection

Accordion-style collapsible section with icon support.

```tsx
import { CollapsibleSection } from '@/components/ui'

<CollapsibleSection
  title="Advanced Settings"
  defaultOpen={false}
  icon={<span>🔧</span>}
>
  {/* Section content */}
</CollapsibleSection>
```

## Accessibility Features

All components include:
- **Keyboard Navigation**: Full keyboard support (Tab, Enter, Space, Arrow keys)
- **Screen Reader Support**: Proper ARIA labels and roles
- **Focus Management**: Visible focus indicators
- **Color Contrast**: WCAG AA compliant color combinations

## Styling

Components use Tailwind CSS utility classes and can be customized via:
- `className` prop for additional styles
- CSS variables for theme customization
- Tailwind's `@apply` directive for extending styles

## Security

Following security best practices:
- All inputs support `maxLength` validation
- Pattern validation for specific formats (e.g., hex colors)
- No `dangerouslySetInnerHTML` used
- Type-safe APIs prevent injection attacks

## Examples in the Codebase

See `/Users/palmac/Aiakaki/Code/publo/frontend/src/components/panels/ClusterPanel.tsx` for comprehensive real-world usage of all components.

## Browser Support

- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)

## Resources

- [Radix UI Documentation](https://www.radix-ui.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

