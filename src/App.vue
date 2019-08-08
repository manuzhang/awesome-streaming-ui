<template>
  <v-app>
    <v-app-bar app>
      <v-toolbar-title v-text="title"></v-toolbar-title>
      <v-spacer></v-spacer>
    </v-app-bar>
    <v-content>
      <Repos/>
    </v-content>
   <!-- <v-footer :fixed="fixed" app>
      <span>&copy; 2019</span>
    </v-footer> --> 
  </v-app>
</template>

<script>
import Repos from './components/Repos'

export default {
  name: 'App',
  components: {
    Repos
  },
  data () {
    return {
      title: 'Awesome Streaming'
    }
  }
}
</script>
