import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Product } from '../composables/useProducts'

interface CartLine {
  product: Product
  quantity: number
}

// Auto-imported like composables/utils: vastx-native reads this file's real
// exports, so `useCartStore` is available everywhere even though the file
// is called `cart.ts`.
export const useCartStore = defineStore('cart', () => {
  const lines = ref<CartLine[]>([])

  const itemCount = computed(() => lines.value.reduce((sum, line) => sum + line.quantity, 0))
  const totalInCents = computed(() => lines.value.reduce((sum, line) => sum + line.product.priceInCents * line.quantity, 0))

  function addItem(product: Product) {
    const existing = lines.value.find(line => line.product.id === product.id)
    if (existing) {
      existing.quantity++
    } else {
      lines.value.push({ product, quantity: 1 })
    }
  }

  function removeItem(productId: string) {
    lines.value = lines.value.filter(line => line.product.id !== productId)
  }

  return { lines, itemCount, totalInCents, addItem, removeItem }
}, {
  // Saved on the device and restored at startup (vastx-native's Pinia
  // plugin), so the cart survives the app being closed.
  persist: true
})
