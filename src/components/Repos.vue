<template>
  <v-card>
    <v-card-title>
      <span id="title">Repos</span>
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn dark small color="light-blue" v-on="on" @click="goto">
            <v-icon>add</v-icon>
          </v-btn>
        </template>
        <span>Add your own awesome-streaming project</span>
      </v-tooltip>
      <v-spacer />
      <v-text-field v-model="search" append-icon="search" label="Search" single-line hide-details></v-text-field>
    </v-card-title>
    <v-data-table
      :headers="headers"
      :items="items"
      :sort-by="['lastUpdateSortValue']"
      :sort-desc="[true]"
      :items-per-page="100"
      :search="search"
      hide-default-footer
      class="elevation-1"
    >
      <template v-slot:body="{ items }">
        <tbody>
          <tr v-for="item in items" :key="item.name">
            <td>
              <a :href="item.link" target="_blank">{{ item.name }}</a>
            </td>
            <td>{{ item.description }}</td>
            <td>{{ item.stars }}</td>
            <td>{{ item.forks }}</td>
            <td>{{ item.lastTag }}</td>
            <td>{{ item.lastUpdate }}</td>
          </tr>
        </tbody>
      </template>
    </v-data-table>
  </v-card>
</template>

<script>
import repos from "../assets/repos.json";

function normalizeRepos(items) {
  return items
    .map(item => ({
      ...item,
      lastUpdateSortValue: Date.parse(item.lastUpdate) || 0
    }))
    .sort((left, right) => right.lastUpdateSortValue - left.lastUpdateSortValue);
}

export default {
  data() {
    return {
      search: "",
      headers: [
        { text: "Name", value: "name" },
        { text: "Description", value: "description", sortable: false },
        { text: "Stars", value: "stars" },
        { text: "Forks", value: "forks" },
        { text: "LastTag", value: "lastTag" },
        { text: "LastUpdate", value: "lastUpdateSortValue" }
      ],
      items: normalizeRepos(repos)
    };
  },
  methods: {
    goto: function() {
      window.open("https://github.com/manuzhang/awesome-streaming", "_blank");
    }
  }
};
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

#title {
  margin-right: 10px;
}
</style>
