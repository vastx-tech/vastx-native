<template>
  <!-- scrollable="false": a <ListView> is its own scrolling, cell-
       recycling container (real view reuse — Android RecyclerView/iOS
       UITableView cell reuse under the hood, confirmed via
       recycleNativeView: 'auto' in list-view-common.js) — nesting it
       inside NPage's default ScrollView would force it to measure its
       full, unbounded content height to fit the outer scroller, which
       defeats recycling entirely (only ever renders a fixed few
       screen-fuls of cells if given a real bounded height instead). -->
  <NPage title="Shop" :scrollable="false">
    <!-- gap-4 avoided on purpose: a real Android bug (see ARCHITECTURE.md,
         `gap`/`row-gap` is disabled framework-wide) drops a flex
         container's last child entirely when a non-zero row-gap is set —
         margin on every child but the last gets the same spacing safely. -->
    <NFlex class="flex-col p-5" style="height: 100%">
      <SectionHeader title="Featured gear" :subtitle="`${products.length} items`" class="mb-4" />

      <!-- flexGrow: 1 gives the list the header/button's leftover space
           in this flex column — the same real flex-item property
           flex()'s own `grow` option sets, just written inline here. -->
      <ListView :items="products" style="flexGrow: 1" class="mb-4">
        <template #default="{ item }">
          <ProductCard
            :product="item"
            @tap="openProduct(item.id)"
            @add="cart.addItem(item)"
          />
        </template>
      </ListView>

      <NButton
        :text="`View cart (${cart.itemCount})`"
        variant="outline"
        @tap="openCart"
      />
    </NFlex>
  </NPage>
</template>

<script setup lang="ts">
// useProducts(), useNativeRouter() and useCartStore() below are all
// auto-imported (this project's composable, vastx-native's own, and this
// project's Pinia store). ProductCard/SectionHeader (project components)
// are explicitly imported — component auto-import isn't covered; see this
// app's README.
import ProductCard from '../components/ProductCard.vue'
import SectionHeader from '../components/SectionHeader.vue'

const { products } = useProducts()
const { navigate } = useNativeRouter()
const cart = useCartStore()

function openProduct(id: string) {
  navigate('products_id', { params: { id } })
}

function openCart() {
  navigate('cart')
}
</script>
