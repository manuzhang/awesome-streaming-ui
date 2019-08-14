<template>
    <v-card>
    <v-card-title>
      Repos
      <v-spacer></v-spacer>
      <v-text-field
        v-model="search"
        append-icon="search"
        label="Search"
        single-line
        hide-details
      ></v-text-field>
    </v-card-title>
  <v-data-table
    :headers="headers"
    :items="items"
    :sort-by="['lastUpdate']"
    :sort-desc="[true]"
    :items-per-page="100"
    :search="search"
    hide-default-footer
    class="elevation-1"
  >
    <template v-slot:body="{ items }">
      <tbody>
        <tr v-for="item in items" :key="item.name">
          <td><a :href="item.link" target="_blank">{{ item.name }}</a></td>
          <td>{{ item.description }}</td>
          <td>{{ item.stars }}</td>
          <td>{{ item.forks }}</td>
          <td>{{ item.lastUpdate }}</td>
        </tr>
      </tbody>
    </template>
  </v-data-table>
</v-card>
</template>

<script>

import repos from '../assets/repos.json'

export default {
  data () {
    return {
      search: '',
      headers: [
        { text: 'Name', value: 'name' },
        { text: 'Description', value: 'description', sortable: false },
        { text: 'Stars', value: 'stars' },
        { text: 'Forks', value: 'forks' },
        { text: 'LastUpdate', value: 'lastUpdate' }
      ],
      items: repos,
    };
  },
  methods: {
    goto: function(url) {
      window.open(url, "_blank");
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h3 {
  margin: 40px 0 0;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}
</style>
