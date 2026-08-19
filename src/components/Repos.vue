<template>
  <div>
    <v-card
      v-for="section in sections"
      :key="section.title"
      :class="{ 'archived-section': section.isArchived }"
    >
      <v-card-title>
        <span class="section-title">{{ section.title }}</span>
        <v-chip small outlined>{{ sectionItems(section).length }}</v-chip>
        <v-tooltip v-if="!section.isArchived" bottom>
          <template v-slot:activator="{ on }">
            <v-btn dark small color="light-blue" class="add-project" v-on="on" @click="goto">
              <v-icon>add</v-icon>
            </v-btn>
          </template>
          <span>Add your own awesome-streaming project</span>
        </v-tooltip>
        <v-spacer />
        <v-text-field
          v-model="section.search"
          append-icon="search"
          :label="'Search ' + section.title.toLowerCase() + ' projects'"
          single-line
          hide-details
        ></v-text-field>
      </v-card-title>
      <v-card-subtitle v-if="section.isArchived">
        Archived projects retain their last known metadata without daily refreshes.
      </v-card-subtitle>
      <v-data-table
        :headers="headers"
        :items="sectionItems(section)"
        :sort-by="['lastUpdateSortValue']"
        :sort-desc="[true]"
        :items-per-page="100"
        :search="section.search"
        hide-default-footer
        class="elevation-1"
      >
        <template v-slot:body="{ items }">
          <tbody>
            <tr
              v-for="item in items"
              :key="item.name"
              :class="{ 'archived-project': section.isArchived }"
            >
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
  </div>
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
      sections: [
        { title: "Active", isArchived: false, search: "" },
        { title: "Archived", isArchived: true, search: "" }
      ],
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
    },
    sectionItems: function(section) {
      return this.items.filter(item => (item.isArchived === true) === section.isArchived);
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

.section-title {
  margin-right: 10px;
}

.add-project {
  margin-left: 10px;
}

.archived-section {
  margin-top: 24px;
  background-color: #f5f5f5;
}

.archived-project,
.archived-project:hover {
  background-color: #f5f5f5 !important;
}
</style>
