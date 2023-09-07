<script setup lang="ts">

import {onMounted, onUnmounted, reactive} from 'vue'
import {createPostier} from './composables/Postier' 
import { v4 as uuidv4 } from 'uuid';
const compte = reactive([]);

const postierInstance = createPostier()

onMounted(() => {
  postierInstance.subscribe('counter',compte)
})

onUnmounted(() => {
  postierInstance.unsubscribe('counter')
})


function createOne(){
  compte.push({
    value : 0,
    id : uuidv4()
  });
}

function getIndex(id : string){
  for(var i = 0; i < compte.length;i++){
    var elem = compte[i]
    if(elem.id == id){
      return i
    }
  }
}

function addOne(id : string){
  var curIndex = getIndex(id)
  compte[curIndex].value += 1
}

function deleteOne(id : string){
  var curIndex = getIndex(id)
  compte.splice(curIndex,1)
}


</script>

<template>
  
  <ul>
    <li v-for="elem in compte">
      {{elem.value}}
      <button @click="addOne(elem.id)">+1</button>
      <button @click="deleteOne(elem.id)">-1</button>
    </li>
  </ul>
  <button @click="createOne()"> +1 </button>
</template>

<style scoped>
</style>
