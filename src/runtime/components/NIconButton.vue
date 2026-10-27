<!--
  A circular icon-only tappable button — the same GridLayout+@tap pattern
  NButton uses (see its own comment on why: NativeScript's native <Button>
  can only ever hold a plain text Label, nothing else), sized to a real
  circle and rendering a single <NSvg> instead of a <Label>.

  `icon` takes raw `<svg>...</svg>` markup, not an Iconify name string —
  resolve a name against an installed icon set first with
  `resolveIconSvg()` (src/runtime/icons.ts), e.g.:

    import lucideIcons from '@iconify-json/lucide/icons.json'
    import { resolveIconSvg } from 'vastx-native/runtime/icons.js'
    const heartIcon = resolveIconSvg(lucideIcons, 'heart', { color: '#ff0000' })
    <NIconButton :icon="heartIcon" @tap="..." />

  Keeping `icon` as plain markup (not doing the Iconify lookup inside this
  component) means NIconButton works with any SVG source, not just
  Iconify, and keeps this component free of a hard dependency on any one
  icon-set package.
-->
<template>
  <GridLayout
    rows="auto"
    columns="auto"
    :style="containerStyle"
    :isEnabled="!disabled"
    @tap="onTap"
  >
    <NSvg :src="icon" stretch="aspectFit" :style="iconStyle" />
  </GridLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { colors, resolveThemeColor, type ThemeColor } from '../theme'
import NSvg from './NSvg.vue'

export interface NIconButtonProps {
  /** Raw `<svg>...</svg>` markup — see resolveIconSvg() for turning an Iconify name into this. */
  icon: string
  variant?: ThemeColor | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}

const props = withDefaults(defineProps<NIconButtonProps>(), {
  variant: 'primary',
  size: 'md',
  disabled: false
})

const emit = defineEmits<{ tap: [] }>()

// Button diameter per size — matches NButton's own sm/md/lg scale closely
// enough to sit next to it in the same row without looking mismatched.
const diameters = { sm: 32, md: 44, lg: 56 } as const

const palette = computed(() => {
  if (props.disabled) return { background: colors.disabled, border: colors.disabled }
  if (props.variant === 'outline') return { background: 'transparent', border: colors.primary }
  if (props.variant === 'ghost') return { background: 'transparent', border: 'transparent' }
  const themed = resolveThemeColor(props.variant)
  return { background: themed.background, border: themed.background }
})

const containerStyle = computed(() => {
  const diameter = diameters[props.size]
  return {
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
    backgroundColor: palette.value.background,
    borderColor: palette.value.border,
    borderWidth: props.variant === 'outline' ? 1 : 0,
    opacity: props.disabled ? 0.7 : 1,
    horizontalAlignment: 'left' as const
  }
})

const iconStyle = computed(() => {
  const iconSize = diameters[props.size] * 0.5
  return {
    width: iconSize,
    height: iconSize,
    horizontalAlignment: 'center' as const,
    verticalAlignment: 'middle' as const
  }
})

function onTap() {
  if (props.disabled) return
  emit('tap')
}
</script>
