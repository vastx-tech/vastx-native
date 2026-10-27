<template>
  <NPage title="VastX Native">
    <StackLayout style="padding: 20">
      <Label text="Running on:" style="color: gray" />
      <Label :text="`${device.os} ${device.osVersion} (${device.model})`" style="font-size: 18; font-weight: bold" />

      <Button text="Go to details" style="margin-top: 20" @tap="openDetails" />
    </StackLayout>
  </NPage>
</template>

<script setup lang="ts">
const device = useDevice()
const { navigate } = useNativeRouter()

function openDetails() {
  navigate('details_id', { params: { id: '42' } })
}
</script>
