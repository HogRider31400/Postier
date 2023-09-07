<script setup lang="ts">

import {onMounted, onUnmounted, reactive} from 'vue'
import {createPostier} from './composables/Postier' 

const compte = reactive([]);

const postierInstance = createPostier()

onMounted(() => {
  postierInstance.subscribe('counter',compte)
})

onUnmounted(() => {
  postierInstance.unsubscribe('counter')
})


function addOne(){
  compte.push(1);
}


</script>

<template>
  
  <ul>
    <li v-for="elem in compte">
      {{ elem }}
    </li>
  </ul>
  <button @click="addOne()"> +1 </button>
</template>

<style scoped>
</style>
